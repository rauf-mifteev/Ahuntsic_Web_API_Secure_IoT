/* ============================================================
   services/alertes.service.js — Logique métier des alertes
   ------------------------------------------------------------
   
   Ce module ne touche jamais à req / res, ni à Socket.IO.
   ============================================================ */

const Alerte                = require("../modeles/Alerte");
const AlerteAuditSupression = require("../modeles/AlerteAuditSupression");
const Utilisateur           = require("../modeles/Utilisateur");
const { construireOptions, enveloppePaginee } = require("./requete");

/* ---------- Aide ----------------------------------------- */

function erreurConflitEtat(message) {
  const e = new Error(message);
  e.name = "ConflitEtat";
  return e;
}

// Champs exposés pour les références populées.
const CHAMPS_REFS = "courriel nom";


/* ---------- 1. Lister ------------------------------------ */

async function lister(query = {}) {
  const { filtre, tri, page, limit, skip } = construireOptions(query);

  const [donnees, total] = await Promise.all([
    Alerte.find(filtre)
          .sort(tri).skip(skip).limit(limit)
          .populate("creeePar resoluePar", CHAMPS_REFS),
    Alerte.countDocuments(filtre)
  ]);

  return enveloppePaginee(donnees, total, page, limit);
}


/* ---------- 2. Obtenir par id ---------------------------- */

async function obtenirParId(id) {
  return Alerte.findById(id).populate("creeePar resoluePar", CHAMPS_REFS);
}


/* ---------- 3. Créer ------------------------------------- */

async function creer({ source, type, niveau, message }, utilisateurId) {
  const alerte = await Alerte.create({
    source, type, niveau, message,
    creeePar: utilisateurId
  });
  return Alerte.findById(alerte._id).populate("creeePar resoluePar", CHAMPS_REFS);
}


/* ---------- 4. Remplacer (PUT) --------------------------- */

async function remplacer(id, { source, type, niveau, message }, utilisateurId) {
  const alerte = await Alerte.findByIdAndUpdate(
    id,
    {
      source, type, niveau, message,
      horodatage: new Date(),
      resolue:    false,
      resolueAt:  null,
      creeePar:   utilisateurId,
      resoluePar: null
    },
    { new: true, runValidators: true, overwrite: true }
  );
  if (!alerte) return null;
  return Alerte.findById(alerte._id).populate("creeePar resoluePar", CHAMPS_REFS);
}


/* ---------- 5. Résoudre (PATCH) -------------------------- */

async function resoudre(id, utilisateurId) {
  const alerte = await Alerte.findById(id);
  if (!alerte) return null;

  if (alerte.resolue) {
    throw erreurConflitEtat("Cette alerte est déjà résolue.");
  }

  alerte.resolue    = true;
  alerte.resolueAt  = new Date();
  alerte.resoluePar = utilisateurId;
  await alerte.save();

  return Alerte.findById(alerte._id).populate("creeePar resoluePar", CHAMPS_REFS);
}


/* ---------- 6. Supprimer --------------------------------- */

async function supprimer(id, utilisateurId) {
  // 1) Charger l'alerte AVANT la suppression pour capturer l'aperçu.
  const alerte = await Alerte.findById(id);
  if (!alerte) return { alerte: null, supprimeeParCourriel: null };

  // 2) Récupérer le courriel de l'utilisateur qui supprime
  const utilisateur = await Utilisateur.findById(utilisateurId).select("courriel");
  const supprimeeParCourriel = utilisateur ? utilisateur.courriel : "inconnu";

  // 3) Écrire l'audit (traçabilité).
  await AlerteAuditSupression.create({
    alerteId:     alerte._id,
    supprimeePar: utilisateurId,
    apercuSource: alerte.source,
    apercuNiveau: alerte.niveau
  });

  // 4) Supprimer définitivement.
  await alerte.deleteOne();

  return { alerte, supprimeeParCourriel };
}


module.exports = {
  lister,
  obtenirParId,
  creer,
  remplacer,
  resoudre,
  supprimer
};
