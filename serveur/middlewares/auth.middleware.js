/* ============================================================
   middlewares/auth.middleware.js — Authentification & autorisation
   ------------------------------------------------------------
   Deux middlewares :

     verifierToken(req, res, next)
       - Lit l'en-tête Authorization: Bearer <token>.
       - Vérifie la signature et l'expiration du jeton.
       - Attache { id, role } à req.utilisateur.
       - Répond 401 si jeton absent, mal formé, invalide ou expiré.

     autoriserRoles(...rolesAutorises)
       - Retourne un middleware qui répond 403 si
         req.utilisateur.role n'est pas dans la liste.
       - Doit toujours être placé apres verifierToken.

   Codes HTTP utilisés :
     401  authentification ratée
     403  pas de permission malgré authentification réussie
   ============================================================ */

const jwt    = require("jsonwebtoken");
const config = require("../config/config");


function verifierToken(req, res, next) {
  const entete = req.headers.authorization || "";

  if (!entete.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Jeton manquant. Ajoutez l'en-tête 'Authorization: Bearer <token>'."
    });
  }

  const token = entete.slice(7).trim();

  if (!token) {
    return res.status(401).json({ message: "Jeton manquant." });
  }

  try {
    const charge = jwt.verify(token, config.jwtSecret);
    req.utilisateur = {
      id:   charge.id,
      role: charge.role
    };
    next();
  } catch (erreur) {
    if (erreur.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Jeton expiré. Reconnectez-vous." });
    }
    // Couvre JsonWebTokenError, NotBeforeError, etc.
    return res.status(401).json({ message: "Jeton invalide." });
  }
}


function autoriserRoles(...rolesAutorises) {
  return function (req, res, next) {
    if (!req.utilisateur) {
      // Garde-fou : un développeur a placé autoriserRoles sans verifierToken.
      return res.status(401).json({ message: "Authentification requise." });
    }
    if (!rolesAutorises.includes(req.utilisateur.role)) {
      return res.status(403).json({
        message: "Accès refusé. Rôle requis : " + rolesAutorises.join(" ou ") + "."
      });
    }
    next();
  };
}


module.exports = {
  verifierToken,
  autoriserRoles
};
