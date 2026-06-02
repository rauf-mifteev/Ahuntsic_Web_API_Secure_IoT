/* ============================================================
   services/auth.service.js — Authentification
   ------------------------------------------------------------
   Trois opérations exposées :

     inscrire({ courriel, nom, motDePasse })
       - Valide la longueur minimale du mot de passe.
       - Hache avec bcrypt (coût 10).
       - Crée l'utilisateur avec le rôle PAR DÉFAUT (lecteur).
         Le rôle ne peut PAS être imposé par le client.

     connecter({ courriel, motDePasse })
       - Cherche l'utilisateur par courriel.
       - Compare le mot de passe au hash avec bcrypt.compare.
       - Signe un JWT contenant { id, role } valable JWT_EXPIRATION.
       - Renvoie { utilisateur, token }.
       - En cas d'échec, lève AuthInvalide avec un message NEUTRE
         (pour ne pas divulguer si le courriel existe).

     verifier(token)
       Utilitaire — décode et vérifie le jeton hors middleware.
   ============================================================ */

const bcrypt      = require("bcrypt");
const jwt         = require("jsonwebtoken");
const config      = require("../config/config");
const Utilisateur = require("../modeles/Utilisateur");


const COUT_BCRYPT  = 10;
const LONG_MIN_MOT = 8;


function erreurAuthInvalide() {
  const e = new Error("Courriel ou mot de passe incorrect.");
  e.name = "AuthInvalide";
  return e;
}

function erreurParametre(message) {
  const e = new Error(message);
  e.name = "ParametreInvalide";
  return e;
}


/* ---------- 1. Inscription -------------------------------- */

async function inscrire({ courriel, nom, motDePasse }) {
  if (!motDePasse || typeof motDePasse !== "string"
      || motDePasse.length < LONG_MIN_MOT) {
    throw erreurParametre(
      `Le mot de passe doit faire au moins ${LONG_MIN_MOT} caractères.`
    );
  }

  const motDePasseHache = await bcrypt.hash(motDePasse, COUT_BCRYPT);

  // role NON inclus : Mongoose applique la valeur par défaut (lecteur).
  // Toute valeur de role envoyée par le client est neutralisée.
  return Utilisateur.create({
    courriel,
    nom,
    motDePasseHache
  });
}


/* ---------- 2. Connexion ---------------------------------- */

async function connecter({ courriel, motDePasse }) {
  if (!courriel || !motDePasse) {
    throw erreurAuthInvalide();
  }

  // select("+motDePasseHache") est nécessaire car le champ est select:false.
  const utilisateur = await Utilisateur
    .findOne({ courriel: String(courriel).trim().toLowerCase() })
    .select("+motDePasseHache");

  if (!utilisateur) {
    throw erreurAuthInvalide();
  }

  const ok = await bcrypt.compare(motDePasse, utilisateur.motDePasseHache);
  if (!ok) {
    throw erreurAuthInvalide();
  }

  const token = jwt.sign(
    { id: utilisateur._id.toString(), role: utilisateur.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiration }
  );

  return { utilisateur, token };
}


/* ---------- 3. Vérification (utilitaire) ------------------ */

function verifier(token) {
  return jwt.verify(token, config.jwtSecret);
}


module.exports = {
  inscrire,
  connecter,
  verifier
};
