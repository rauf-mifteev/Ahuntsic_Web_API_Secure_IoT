/* ============================================================
   config/config.js — Lecture et validation de la configuration
   ------------------------------------------------------------
   Centralise tout l'accès à process.env. Tous les autres
   modules font `require("./config/config")` et n'appellent
   plus jamais process.env directement.

   Le module échoue au DÉMARRAGE si :
     - une variable obligatoire manque,
     - JWT_SECRET fait moins de 32 caractères.

   ============================================================ */

require("dotenv").config();

function exiger(nom) {
  const v = process.env[nom];
  if (!v) {
    throw new Error(`Variable d'environnement manquante : ${nom}`);
  }
  return v;
}

const config = {
  // --- Réseau ---
  port:    parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || "development",

  // --- Base de données ---
  mongoUri: exiger("MONGO_URI"),

  // --- Authentification ---
  jwtSecret:     exiger("JWT_SECRET"),
  jwtExpiration: process.env.JWT_EXPIRATION || "2h",

  // --- CORS : liste blanche d'origines, séparée par virgules ---
  corsOrigines: (process.env.CORS_ORIGINES || "")
                  .split(",").map((s) => s.trim()).filter(Boolean),

  // --- Taille maximale du corps JSON ---
  tailleMaxCorps: process.env.TAILLE_MAX_CORPS || "100kb"
};

/* ---------- Validations supplémentaires ------------------- */

if (config.jwtSecret.length < 32) {
  throw new Error(
    "JWT_SECRET trop court (32 caractères minimum). " +
    "Générer un secret : node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\""
  );
}

module.exports = config;
