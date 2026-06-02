/* ============================================================
   services/alertes.service.js — Logique métier des alertes
   ------------------------------------------------------------
   Évolution depuis l'examen pratique 2 :
     - lister() / obtenirParId() utilisent .populate() pour
       exposer creeePar / resoluePar avec courriel + nom ;
     - creer(donnees, utilisateurId) injecte creeePar ;
     - resoudre(id, utilisateurId) injecte resoluePar ;
     - supprimer(id, utilisateurId) écrit un audit avant la
       suppression définitive (collection AlerteAuditSupression).

   Ce module ne touche jamais à req / res, ni à Socket.IO.
   ============================================================ */

const Alerte                = require("../modeles/Alerte");
const AlerteAuditSupression = require("../modeles/AlerteAuditSupression");
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
  // On ne passe que les 4 champs métier autorisés au client.
  // creeePar est injecté ici, pas par le client.
  const alerte = await Alerte.create({
    source, type, niveau, message,
    creeePar: utilisateurId
  });
  // Re-fetch pour bénéficier du populate dans la réponse.
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
  if (!alerte) return null;

  // 2) Écrire l'audit (traçabilité).
  await AlerteAuditSupression.create({
    alerteId:     alerte._id,
    supprimeePar: utilisateurId,
    apercuSource: alerte.source,
    apercuNiveau: alerte.niveau
  });

  // 3) Supprimer définitivement.
  await alerte.deleteOne();
  return alerte;
}


module.exports = {
  lister,
  obtenirParId,
  creer,
  remplacer,
  resoudre,
  supprimer
};
