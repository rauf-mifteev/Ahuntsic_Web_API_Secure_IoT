/* ============================================================
   agent-alertes/publier.js — Simulateur d'agent IoT
   ------------------------------------------------------------
   Programme autonome qui :
     1. Simule 5 capteurs météo (temperature, humidite, pression,
        vent, precipitations), chacun avec ses propres seuils.
     2. S'authentifie au démarrage via POST /api/auth/connexion
        avec le compte agent@cours.qc.ca (rôle opérateur).
     3. Boucle toutes les INTERVALLE_MS (défaut 5000 ms) :
        pour chaque capteur, lit une valeur simulée. Si la valeur
        sort des seuils, publie une alerte sur POST /api/alertes.
        Si elle est dans les seuils, ne publie rien.
     4. Gère le code 401 (jeton expiré) : se reconnecte puis
        réessaie une fois.
     5. Gère les erreurs réseau avec un retry simple :
        3 tentatives à 2 secondes d'intervalle, puis abandon.

   Aucune dépendance npm. Node 18+ fournit fetch nativement.
   Lancement : node publier.js
   Arrêt     : Ctrl+C
   ============================================================ */


// ============================================================
// 1) Réglages
// ============================================================

const API_URL       = "http://localhost:3000";
const COURRIEL      = "agent@cours.qc.ca";
const MOT_DE_PASSE  = "Motdepasse1!";
const INTERVALLE_MS = 5000;   // délai entre deux cycles de lecture
const RETRY_MAX     = 3;      // nombre max de tentatives sur erreur réseau
const RETRY_DELAI   = 2000;   // délai entre les tentatives (ms)


// ============================================================
// 2) Catalogue de capteurs simulés
//    Chaque capteur a un nom, un type, des seuils min/max et
//    une fonction generer() qui produit une valeur plausible.
//    La fonction sort des bornes environ 30% du temps.
// ============================================================

function aleaCentre(min, max, probaSortie = 0.30) {
  // Genere une valeur dans [min, max] la plupart du temps,
  // mais avec probaSortie de chance de tomber au-dessus ou au-dessous.
  if (Math.random() < probaSortie) {
    const amplitude = max - min;
    const ecart = amplitude * (0.10 + Math.random() * 0.30);
    const audessus = Math.random() < 0.5;
    return audessus ? max + ecart : min - ecart;
  }
  return min + Math.random() * (max - min);
}

// Applique les bornes physiques absolues d'un capteur.
// Certaines grandeurs ne peuvent pas depasser des limites physiques
// independamment des seuils d'alerte (ex. vitesse du vent >= 0,
// humidite entre 0 et 100, precipitations >= 0).
function clamp(valeur, physMin, physMax) {
  if (physMin !== undefined && valeur < physMin) return physMin;
  if (physMax !== undefined && valeur > physMax) return physMax;
  return valeur;
}

const CAPTEURS = [
  {
    nom:      "Station Montreal-Nord",
    type:     "temperature",
    unite:    "C",
    seuilMin: 0,
    seuilMax: 32,
    // Pas de borne physique absolue : la temperature peut etre negative
    // (gel) ou tres elevee (canicule extreme), les deux sont des alertes valides.
    generer:  function () { return Math.round(aleaCentre(0, 32) * 10) / 10; }
  },
  {
    nom:      "Station Laval-Sud",
    type:     "humidite",
    unite:    "%",
    seuilMin: 25,
    seuilMax: 90,
    // Humidite : borne physique absolue [0, 100].
    // En dessous de 0% ou au-dessus de 100% est physiquement impossible.
    generer:  function () { return clamp(Math.round(aleaCentre(25, 90)), 0, 100); }
  },
  {
    nom:      "Station Longueuil-Est",
    type:     "pression",
    unite:    "hPa",
    seuilMin: 990,
    seuilMax: 1030,
    // Pression : pas de borne absolue stricte appliquee ici.
    // Les valeurs extremes (ex. 940 hPa pour un ouragan) sont rares
    // mais physiquement possibles et valides comme alertes.
    generer:  function () { return Math.round(aleaCentre(990, 1030)); }
  },
  {
    nom:      "Station Montreal-Nord",
    type:     "vent",
    unite:    "km/h",
    seuilMin: 0,
    seuilMax: 70,
    // Vent : borne physique absolue >= 0.
    // Une vitesse de vent negative est physiquement impossible.
    generer:  function () { return clamp(Math.round(aleaCentre(0, 70)), 0, undefined); }
  },
  {
    nom:      "Station Laval-Sud",
    type:     "precipitations",
    unite:    "mm/h",
    seuilMin: 0,
    seuilMax: 30,
    // Precipitations : borne physique absolue >= 0.
    // Des precipitations negatives sont physiquement impossibles.
    generer:  function () { return clamp(Math.round(aleaCentre(0, 30) * 10) / 10, 0, undefined); }
  }
];


// ============================================================
// 3) Déterminer le niveau d'alerte selon l'écart aux seuils
//    Stratégie : ratio de l'écart sur la demi-plage des seuils.
//      < 25%  -> "info"
//      25-75% -> "avertissement"
//      > 75%  -> "critique"
// ============================================================

function calculerNiveau(valeur, capteur) {
  const demiPlage = (capteur.seuilMax - capteur.seuilMin) / 2;
  let ecart;

  if (valeur > capteur.seuilMax) {
    ecart = valeur - capteur.seuilMax;
  } else if (valeur < capteur.seuilMin) {
    ecart = capteur.seuilMin - valeur;
  } else {
    return null;   // valeur dans les seuils -> pas d'alerte
  }

  const ratio = ecart / demiPlage;
  if (ratio > 0.75) return "critique";
  if (ratio > 0.25) return "avertissement";
  return "info";
}


// ============================================================
// 4) Authentification
// ============================================================

let jeton = null;

async function seConnecter() {
  const reponse = await fetch(`${API_URL}/api/auth/connexion`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ courriel: COURRIEL, motDePasse: MOT_DE_PASSE })
  });
  if (!reponse.ok) {
    throw new Error(`Connexion échouée : ${reponse.status}`);
  }
  const donnees = await reponse.json();
  jeton = donnees.token;
}


// ============================================================
// 5) Publication d'une alerte
//    Gestion du 401 (jeton expiré) : reconnexion + 1 retry.
//    Gestion des erreurs réseau : 3 tentatives à 2s d'intervalle.
// ============================================================

async function publierAlerte(alerte) {
  for (let tentative = 1; tentative <= RETRY_MAX; tentative++) {
    try {
      let reponse = await fetch(`${API_URL}/api/alertes`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${jeton}`
        },
        body: JSON.stringify(alerte)
      });

      // Jeton expiré : se reconnecter et réessayer UNE fois.
      if (reponse.status === 401) {
        console.log("    [agent] jeton expiré, reconnexion...");
        await seConnecter();
        reponse = await fetch(`${API_URL}/api/alertes`, {
          method:  "POST",
          headers: {
            "Content-Type":  "application/json",
            "Authorization": `Bearer ${jeton}`
          },
          body: JSON.stringify(alerte)
        });
      }

      if (!reponse.ok) {
        throw new Error(`HTTP ${reponse.status}`);
      }
      return;   // succès, on sort de la boucle

    } catch (err) {
      if (tentative === RETRY_MAX) {
        console.error(`    [agent] échec après ${RETRY_MAX} tentatives : ${err.message}`);
        return;
      }
      console.warn(`    [agent] tentative ${tentative}/${RETRY_MAX} échouée (${err.message}), retry dans ${RETRY_DELAI}ms`);
      await new Promise((r) => setTimeout(r, RETRY_DELAI));
    }
  }
}


// ============================================================
// 6) Boucle principale : lecture des capteurs et publication
// ============================================================

async function boucle() {
  for (const capteur of CAPTEURS) {
    const valeur = capteur.generer();
    const niveau = calculerNiveau(valeur, capteur);

    if (niveau === null) {
      // Valeur dans les seuils -> on logue sans publier.
      console.log(
        `  [OK]    ${capteur.type.padEnd(14)} ${capteur.nom.padEnd(24)} = ${String(valeur).padStart(7)} ${capteur.unite}`
      );
      continue;
    }

    // Valeur hors des seuils -> construction et publication de l'alerte.
    const alerte = {
      source:  capteur.nom,
      type:    capteur.type,
      niveau:  niveau,
      message: `${capteur.type} : ${valeur} ${capteur.unite} hors des seuils [${capteur.seuilMin}, ${capteur.seuilMax}]`
    };

    console.log(
      `  [ALERT] ${capteur.type.padEnd(14)} ${capteur.nom.padEnd(24)} = ${String(valeur).padStart(7)} ${capteur.unite}  -> ${niveau}`
    );
    await publierAlerte(alerte);
  }
}


// ============================================================
// 7) Démarrage
// ============================================================

(async function demarrer() {
  console.log("Simulateur agent IoT -- démarrage...");

  try {
    await seConnecter();
    console.log(`Connecté en tant que ${COURRIEL}.`);
    console.log(`${CAPTEURS.length} capteurs simulés.`);
    console.log(`Cycle de lecture toutes les ${INTERVALLE_MS} ms. Ctrl+C pour arrêter.\n`);
  } catch (err) {
    console.error("Démarrage échoué :", err.message);
    process.exit(1);
  }

  // Premier cycle immédiat, puis intervalle régulier.
  await boucle();
  setInterval(boucle, INTERVALLE_MS);
})();
