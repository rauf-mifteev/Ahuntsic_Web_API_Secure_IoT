/* ============================================================
   donnees/seed.js — Amorçage de la base
   ------------------------------------------------------------
   Crée 4 utilisateurs (3 humains + 1 agent de service)
   et 6 alertes météo couvrant les trois niveaux, dont une
   déjà résolue.

   Idempotent : on peut le relancer autant de fois qu'on veut
   (deleteMany sur toutes les collections avant insertion).

     npm run seed
   ============================================================ */

require("dotenv").config();

const mongoose              = require("mongoose");
const bcrypt                = require("bcrypt");
const { connecterBD }       = require("../config/bd");
const Utilisateur           = require("../modeles/Utilisateur");
const Alerte                = require("../modeles/Alerte");
const AlerteAuditSupression = require("../modeles/AlerteAuditSupression");


const MOT_DE_PASSE_DEMO = "Motdepasse1!";
const COUT_BCRYPT       = 10;


async function seed() {
  await connecterBD(process.env.MONGO_URI);

  // 1. Vider toutes les collections.
  console.log("Suppression des données existantes...");
  await Promise.all([
    Utilisateur.deleteMany({}),
    Alerte.deleteMany({}),
    AlerteAuditSupression.deleteMany({})
  ]);

  // 2. Création des utilisateurs (mot de passe haché).
  console.log("Création des utilisateurs...");
  const hache = await bcrypt.hash(MOT_DE_PASSE_DEMO, COUT_BCRYPT);

  const utilisateurs = await Utilisateur.insertMany([
    {
      courriel:        "lecteur@cours.qc.ca",
      nom:             "Etudiant Lecteur",
      motDePasseHache: hache,
      role:            "lecteur"
    },
    {
      courriel:        "operateur@cours.qc.ca",
      nom:             "Etudiant Operateur",
      motDePasseHache: hache,
      role:            "operateur"
    },
    {
      courriel:        "administrateur@cours.qc.ca",
      nom:             "Etudiant Administrateur",
      motDePasseHache: hache,
      role:            "administrateur"
    },
    {
      // Compte de service utilisé par l'agent-alertes.
      courriel:        "agent@cours.qc.ca",
      nom:             "Agent IoT (compte de service)",
      motDePasseHache: hache,
      role:            "operateur"
    }
  ]);

  const idAdmin = utilisateurs.find((u) => u.role === "administrateur")._id;

  // 3. Création des alertes météo (attribuées à l'administrateur).
  console.log("Création des alertes météo...");
  const maintenant = Date.now();

  await Alerte.insertMany([
    {
      source:     "Station Montreal-Nord",
      type:       "temperature",
      niveau:     "critique",
      message:    "Canicule : temperature de 38 C, seuil de 32 C depasse",
      horodatage: new Date(maintenant - 1000 * 60 * 60 * 2),
      creeePar:   idAdmin
    },
    {
      source:     "Station Laval-Sud",
      type:       "temperature",
      niveau:     "critique",
      message:    "Gel : temperature de -8 C, seuil de 0 C depasse",
      horodatage: new Date(maintenant - 1000 * 60 * 60 * 4),
      creeePar:   idAdmin
    },
    {
      source:     "Station Montreal-Nord",
      type:       "vent",
      niveau:     "avertissement",
      message:    "Vent violent : 85 km/h, seuil de 70 km/h depasse",
      horodatage: new Date(maintenant - 1000 * 60 * 60 * 6),
      creeePar:   idAdmin
    },
    {
      source:     "Station Longueuil-Est",
      type:       "precipitations",
      niveau:     "avertissement",
      message:    "Pluie intense : 45 mm/h, seuil de 30 mm/h depasse",
      horodatage: new Date(maintenant - 1000 * 60 * 30),
      creeePar:   idAdmin
    },
    {
      source:     "Station Laval-Sud",
      type:       "pression",
      niveau:     "info",
      message:    "Chute de pression : 985 hPa, seuil de 990 hPa depasse",
      horodatage: new Date(maintenant - 1000 * 60 * 60 * 12),
      resolue:    true,
      resolueAt:  new Date(maintenant - 1000 * 60 * 60 * 10),
      creeePar:   idAdmin,
      resoluePar: idAdmin
    },
    {
      source:     "Station Longueuil-Est",
      type:       "humidite",
      niveau:     "info",
      message:    "Humidite tres basse : 20%, seuil de 25% depasse",
      horodatage: new Date(maintenant - 1000 * 60 * 60 * 20),
      creeePar:   idAdmin
    }
  ]);

  console.log("");
  console.log("===============================================");
  console.log("Seed terminé.");
  console.log(`  Utilisateurs : ${utilisateurs.length}`);
  console.log("    - lecteur@cours.qc.ca         (role : lecteur)");
  console.log("    - operateur@cours.qc.ca       (role : operateur)");
  console.log("    - administrateur@cours.qc.ca  (role : administrateur)");
  console.log("    - agent@cours.qc.ca           (role : operateur, compte de service)");
  console.log(`  Mot de passe (tous) : ${MOT_DE_PASSE_DEMO}`);
  console.log("  Alertes : 6 meteo (3 niveaux, dont 1 resolue, 2 stations)");
  console.log("===============================================");

  await mongoose.disconnect();
}

seed().catch(async (erreur) => {
  console.error("Erreur de seed :", erreur);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
