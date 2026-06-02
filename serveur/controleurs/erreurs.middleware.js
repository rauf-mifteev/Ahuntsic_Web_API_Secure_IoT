/* ============================================================
   controleurs/erreurs.middleware.js — Middleware d'erreur central
   ------------------------------------------------------------
   Middleware Express à QUATRE arguments (err, req, res, next).
   Express l'achemine automatiquement quand un contrôleur appelle
   next(erreur) ou laisse remonter une exception async.

   Codes utilisés :
     400  validation, cast, paramètre invalide, conflit d'état
     401  authentification ratée
     409  clé dupliquée (ex. courriel déjà pris)
     413  payload trop gros (limite express.json)
     500  erreur inattendue
   ============================================================ */

function middlewareErreur(erreur, req, res, next) {
  // 1. Validation Mongoose
  if (erreur && erreur.name === "ValidationError") {
    const messages = Object.values(erreur.errors).map((e) => e.message);
    return res.status(400).json({ message: messages.join(" ") });
  }

  // 2. Cast Mongoose (id mal formé)
  if (erreur && erreur.name === "CastError") {
    return res.status(400).json({ message: "Identifiant invalide." });
  }

  // 3. Erreurs métier nommées
  if (erreur && (
        erreur.name === "ChampManquant"     ||
        erreur.name === "ParametreInvalide" ||
        erreur.name === "ConflitEtat"
      )) {
    return res.status(400).json({ message: erreur.message });
  }

  // 4. Échec d'authentification
  if (erreur && erreur.name === "AuthInvalide") {
    return res.status(401).json({ message: erreur.message });
  }

  // 5. Clé dupliquée MongoDB (ex. courriel déjà pris)
  if (erreur && erreur.code === 11000) {
    return res.status(409).json({ message: "Conflit : cette valeur est déjà utilisée." });
  }

  // 6. Corps JSON trop volumineux
  if (erreur && erreur.type === "entity.too.large") {
    return res.status(413).json({ message: "Corps de requête trop volumineux." });
  }

  // 7. Tout le reste : erreur serveur (pas de stack-trace au client)
  console.error("Erreur non interceptée :", erreur);
  res.status(500).json({ message: "Erreur serveur." });
}

module.exports = { middlewareErreur };
