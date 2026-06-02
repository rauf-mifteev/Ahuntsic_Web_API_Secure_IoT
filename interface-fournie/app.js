/* ============================================================
   app.js — Logique client de la console d'alertes
   ------------------------------------------------------------
   NE PAS MODIFIER dans le cadre du projet final, SAUF la
   première ligne (const API_URL) si vous changez le port HTTP.

   Ce fichier sert les deux pages (index.html et dashboard.html)
   en détectant dynamiquement quelle page est ouverte.

   Stockage côté client :
     - localStorage.token              : JWT
     - localStorage.utilisateur        : profil (JSON)
   ============================================================ */

const API_URL = "http://localhost:3000";


/* ============================================================
   Utilitaires partagés
   ============================================================ */

function obtenirToken() {
  return localStorage.getItem("token");
}

function obtenirUtilisateur() {
  const u = localStorage.getItem("utilisateur");
  return u ? JSON.parse(u) : null;
}

function deconnexion() {
  localStorage.removeItem("token");
  localStorage.removeItem("utilisateur");
  window.location.href = "index.html";
}

function afficherToast({ titre, message, type = "info", duree = 4000 }) {
  const zone = document.getElementById("zone-toasts");
  if (!zone) return;
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.innerHTML = `<strong>${escapeHtml(titre)}</strong>${message ? escapeHtml(message) : ""}`;
  zone.appendChild(t);
  setTimeout(() => t.remove(), duree);
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;").replaceAll("'", "&#039;");
}

async function appelerApi(chemin, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = obtenirToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const reponse = await fetch(`${API_URL}${chemin}`, { ...options, headers });

  if (reponse.status === 401) {
    deconnexion();
    throw new Error("Session expirée. Veuillez vous reconnecter.");
  }

  let corps = null;
  try { corps = await reponse.json(); } catch (_) { /* ignore */ }

  if (!reponse.ok) {
    const msg = (corps && corps.message) || `Erreur HTTP ${reponse.status}`;
    const e = new Error(msg);
    e.statut = reponse.status;
    throw e;
  }
  return corps;
}


/* ============================================================
   Page de connexion (index.html)
   ============================================================ */

function initialiserPageConnexion() {
  // Si déjà connecté, aller directement au dashboard.
  if (obtenirToken()) {
    window.location.href = "dashboard.html";
    return;
  }

  const form  = document.getElementById("form-connexion");
  const erreur = document.getElementById("msg-erreur");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    erreur.textContent = "";
    const courriel   = document.getElementById("courriel").value.trim();
    const motDePasse = document.getElementById("motDePasse").value;
    if (!courriel || !motDePasse) {
      erreur.textContent = "Courriel et mot de passe obligatoires.";
      return;
    }
    try {
      const r = await appelerApi("/api/auth/connexion", {
        method: "POST",
        body: JSON.stringify({ courriel, motDePasse })
      });
      localStorage.setItem("token", r.token);
      localStorage.setItem("utilisateur", JSON.stringify(r.utilisateur));
      window.location.href = "dashboard.html";
    } catch (ex) {
      erreur.textContent = ex.message;
    }
  });
}


/* ============================================================
   Page dashboard (dashboard.html)
   ============================================================ */

const Etat = {
  page:  1,
  limit: 10,
  filtreNiveau: "",
  filtreEtat:   "",
  filtreQ:      ""
};

let socket = null;

function initialiserPageDashboard() {
  // Si pas authentifié, retour à la connexion.
  const utilisateur = obtenirUtilisateur();
  if (!obtenirToken() || !utilisateur) {
    window.location.href = "index.html";
    return;
  }

  // Affichage utilisateur + rôle.
  document.getElementById("info-utilisateur").textContent =
    `${utilisateur.nom} (${utilisateur.role})`;

  // Visibilité des contrôles selon rôle.
  appliquerRole(utilisateur.role);

  // Branchement Socket.IO.
  brancherSocket();

  // Branchement UI.
  brancherUi();

  // Première charge des données.
  chargerAlertes();
}

function appliquerRole(role) {
  const peutCreer    = role === "operateur" || role === "administrateur";
  const peutAdmin    = role === "administrateur";

  document.getElementById("bloc-ajout").hidden       = !peutCreer;
  document.getElementById("btn-statistiques").hidden = !peutAdmin;
}

function brancherSocket() {
  const indicateur = document.getElementById("indicateur-connexion");
  socket = io(API_URL, { auth: { token: obtenirToken() } });

  socket.on("connect",    () => indicateur.classList.add("connecte"));
  socket.on("disconnect", () => indicateur.classList.remove("connecte"));
  socket.on("connect_error", (e) => {
    afficherToast({ titre: "Socket déconnecté", message: e.message, type: "erreur" });
  });

  socket.on("alerte:nouvelle", (alerte) => {
    afficherToast({ titre: "Nouvelle alerte", message: `${alerte.source} — ${alerte.message}`, type: "info" });
    chargerAlertes(true); // recharge la page courante
  });

  socket.on("alerte:resolue", (alerte) => {
    afficherToast({ titre: "Alerte résolue", message: alerte.source, type: "succes" });
    chargerAlertes(true);
  });

  socket.on("alerte:supprimee", ({ id }) => {
    afficherToast({ titre: "Alerte supprimée", message: id, type: "info" });
    chargerAlertes(true);
  });
}

function brancherUi() {
  document.getElementById("btn-deconnexion").addEventListener("click", () => {
    if (socket) socket.disconnect();
    deconnexion();
  });

  document.getElementById("btn-rafraichir").addEventListener("click", () => {
    Etat.page = 1;
    chargerAlertes();
  });

  // Filtres : on debounce légèrement la recherche.
  let timeoutRecherche = null;
  document.getElementById("filtre-q").addEventListener("input", (e) => {
    clearTimeout(timeoutRecherche);
    timeoutRecherche = setTimeout(() => {
      Etat.filtreQ = e.target.value.trim();
      Etat.page    = 1;
      chargerAlertes();
    }, 300);
  });
  document.getElementById("filtre-niveau").addEventListener("change", (e) => {
    Etat.filtreNiveau = e.target.value;
    Etat.page         = 1;
    chargerAlertes();
  });
  document.getElementById("filtre-etat").addEventListener("change", (e) => {
    Etat.filtreEtat = e.target.value;
    Etat.page       = 1;
    chargerAlertes();
  });

  document.getElementById("btn-precedent").addEventListener("click", () => {
    if (Etat.page > 1) { Etat.page--; chargerAlertes(); }
  });
  document.getElementById("btn-suivant").addEventListener("click", () => {
    Etat.page++; chargerAlertes();
  });

  // Formulaire d'ajout (si visible).
  const formAjout = document.getElementById("form-ajout");
  if (formAjout) {
    formAjout.addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        source:  document.getElementById("ajout-source").value.trim(),
        type:    document.getElementById("ajout-type").value.trim(),
        niveau:  document.getElementById("ajout-niveau").value,
        message: document.getElementById("ajout-message").value.trim()
      };
      try {
        await appelerApi("/api/alertes", { method: "POST", body: JSON.stringify(payload) });
        formAjout.reset();
        // Socket.IO se chargera du rafraîchissement, mais on peut forcer.
      } catch (ex) {
        afficherToast({ titre: "Erreur", message: ex.message, type: "erreur" });
      }
    });
  }

  // Bouton Statistiques (admin).
  const btnStats = document.getElementById("btn-statistiques");
  if (btnStats) {
    btnStats.addEventListener("click", chargerStatistiques);
  }
}

async function chargerAlertes(silencieux = false) {
  const params = new URLSearchParams({
    page:  String(Etat.page),
    limit: String(Etat.limit)
  });
  if (Etat.filtreNiveau) params.set("niveau",  Etat.filtreNiveau);
  if (Etat.filtreEtat)   params.set("resolue", Etat.filtreEtat);
  if (Etat.filtreQ)      params.set("q",       Etat.filtreQ);

  try {
    const r = await appelerApi(`/api/alertes?${params.toString()}`);
    dessinerAlertes(r);
  } catch (ex) {
    if (!silencieux) {
      afficherToast({ titre: "Erreur de chargement", message: ex.message, type: "erreur" });
    }
  }
}

function dessinerAlertes(enveloppe) {
  const zone = document.getElementById("zone-alertes");
  zone.innerHTML = "";
  for (const a of enveloppe.donnees) {
    zone.appendChild(creerCarteAlerte(a));
  }

  document.getElementById("badge-total").textContent = enveloppe.total;
  document.getElementById("info-page").textContent =
    `Page ${enveloppe.page} / ${enveloppe.pages || 1}`;

  document.getElementById("btn-precedent").disabled = enveloppe.page <= 1;
  document.getElementById("btn-suivant").disabled   = enveloppe.page >= (enveloppe.pages || 1);
}

function creerCarteAlerte(a) {
  const role = (obtenirUtilisateur() || {}).role;
  const peutResoudre = !a.resolue && (role === "operateur" || role === "administrateur");
  const peutSupprimer = role === "administrateur";

  const carte = document.createElement("article");
  carte.className = `carte-alerte niveau-${a.niveau} ${a.resolue ? "resolue" : ""}`;
  carte.dataset.id = a.id;

  const horoStr = a.horodatage ? new Date(a.horodatage).toLocaleString("fr-CA") : "";

  carte.innerHTML = `
    <div class="ligne1">
      <span class="source">${escapeHtml(a.source)}</span>
      <span class="type">${escapeHtml(a.type)}</span>
      <span class="niveau ${a.niveau}">${escapeHtml(a.niveau)}</span>
    </div>
    <div class="actions"></div>
    <div class="message">${escapeHtml(a.message)}</div>
    <div class="meta">
      <span>📅 ${horoStr}</span>
      ${a.creeePar    ? ` · 👤 créée par <em>${escapeHtml(a.creeePar.courriel || "?")}</em>`    : ""}
      ${a.resoluePar  ? ` · ✅ résolue par <em>${escapeHtml(a.resoluePar.courriel || "?")}</em>` : ""}
    </div>
  `;

  const actions = carte.querySelector(".actions");

  if (peutResoudre) {
    const btn = document.createElement("button");
    btn.textContent = "Résoudre";
    btn.className = "bouton-secondaire";
    btn.addEventListener("click", () => resoudreAlerte(a.id));
    actions.appendChild(btn);
  }
  if (peutSupprimer) {
    const btn = document.createElement("button");
    btn.textContent = "Supprimer";
    btn.className = "bouton-secondaire";
    btn.addEventListener("click", () => supprimerAlerte(a.id));
    actions.appendChild(btn);
  }

  return carte;
}

async function resoudreAlerte(id) {
  try {
    await appelerApi(`/api/alertes/${id}/resolue`, { method: "PATCH" });
  } catch (ex) {
    afficherToast({ titre: "Erreur", message: ex.message, type: "erreur" });
  }
}

async function supprimerAlerte(id) {
  if (!confirm("Supprimer définitivement cette alerte ?")) return;
  try {
    await appelerApi(`/api/alertes/${id}`, { method: "DELETE" });
  } catch (ex) {
    afficherToast({ titre: "Erreur", message: ex.message, type: "erreur" });
  }
}

async function chargerStatistiques() {
  const bloc = document.getElementById("bloc-statistiques");
  const zone = document.getElementById("zone-statistiques");
  bloc.hidden = false;
  zone.innerHTML = "Chargement…";
  try {
    const s = await appelerApi("/api/statistiques");
    zone.innerHTML = `
      <div class="grille-stats">
        <div class="carte-stat">
          <h3>Total 24 h</h3>
          <div class="valeur-grosse">${s.totalAlertes24h}</div>
        </div>
        <div class="carte-stat">
          <h3>Par niveau</h3>
          <ul>
            <li>info : <strong>${s.alertesParNiveau.info}</strong></li>
            <li>avertissement : <strong>${s.alertesParNiveau.avertissement}</strong></li>
            <li>critique : <strong>${s.alertesParNiveau.critique}</strong></li>
          </ul>
        </div>
        <div class="carte-stat">
          <h3>État</h3>
          <ul>
            <li>ouvertes : <strong>${s.alertesResoluesVsOuvertes.ouvertes}</strong></li>
            <li>résolues : <strong>${s.alertesResoluesVsOuvertes.resolues}</strong></li>
          </ul>
        </div>
        <div class="carte-stat">
          <h3>Top sources</h3>
          <ul>
            ${s.topSources.map((x) => `<li>${escapeHtml(x.source)} : <strong>${x.compte}</strong></li>`).join("")}
          </ul>
        </div>
      </div>
    `;
  } catch (ex) {
    zone.textContent = `Erreur : ${ex.message}`;
  }
}


/* ============================================================
   Point d'entrée — détection de la page ouverte
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("form-connexion")) {
    initialiserPageConnexion();
  } else if (document.getElementById("zone-alertes")) {
    initialiserPageDashboard();
  }
});
