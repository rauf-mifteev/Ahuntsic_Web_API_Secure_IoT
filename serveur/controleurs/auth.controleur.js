/* ============================================================
   controleurs/auth.controleur.js — Couche HTTP de l'auth
   ------------------------------------------------------------
   Trois fonctions :

     inscription(req, res, next)
       POST /api/auth/inscription
       Corps : { courriel, nom, motDePasse }
       Renvoie 201 + { message, utilisateur }  (sans motDePasseHache).

     connexion(req, res, next)
       POST /api/auth/connexion
       Corps : { courriel, motDePasse }
       Renvoie 200 + { message, token, utilisateur }.

     monProfil(req, res, next)
       GET /api/auth/moi
       Renvoie le profil de l'utilisateur identifié par le jeton.
   ============================================================ */

const service     = require("../services/auth.service");
const Utilisateur = require("../modeles/Utilisateur");


async function inscription(req, res, next) {
  try {
    const { courriel, nom, motDePasse } = req.body || {};
    const utilisateur = await service.inscrire({ courriel, nom, motDePasse });
    res.status(201).json({
      message: "Inscription réussie.",
      utilisateur
    });
  } catch (erreur) {
    next(erreur);
  }
}


async function connexion(req, res, next) {
  try {
    const { courriel, motDePasse } = req.body || {};
    const { utilisateur, token } = await service.connecter({ courriel, motDePasse });
    res.status(200).json({
      message: "Connexion réussie.",
      token,
      utilisateur
    });
  } catch (erreur) {
    next(erreur);
  }
}


async function monProfil(req, res, next) {
  try {
    const utilisateur = await Utilisateur.findById(req.utilisateur.id);
    if (!utilisateur) {
      return res.status(404).json({ message: "Utilisateur introuvable." });
    }
    res.status(200).json({ utilisateur });
  } catch (erreur) {
    next(erreur);
  }
}


module.exports = {
  inscription,
  connexion,
  monProfil
};
