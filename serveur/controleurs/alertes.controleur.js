/* ============================================================
   controleurs/alertes.controleur.js — Couche HTTP des alertes
   ------------------------------------------------------------
   Évolution depuis l'EP2 :
     - chaque action passe req.utilisateur.id au service ;
     - les erreurs sont passées à next(erreur) plutôt que gérées
       localement (middleware central gère tout).

   Aucun appel Mongoose ici (séparation des couches).
   ============================================================ */

const service = require("../services/alertes.service");


/* ---------- 1. GET /api/alertes --------------------------- */

async function lister(req, res, next) {
  try {
    const enveloppe = await service.lister(req.query);
    res.status(200).json(enveloppe);
  } catch (erreur) {
    next(erreur);
  }
}


/* ---------- 2. GET /api/alertes/:id ----------------------- */

async function obtenir(req, res, next) {
  try {
    const alerte = await service.obtenirParId(req.params.id);
    if (!alerte) {
      return res.status(404).json({ message: "Alerte introuvable." });
    }
    res.status(200).json(alerte);
  } catch (erreur) {
    next(erreur);
  }
}


/* ---------- 3. POST /api/alertes -------------------------- */

async function creer(req, res, next) {
  try {
    // Seuls 4 champs sont acceptés du client. Le reste est ignoré.
    // creeePar est injecté par le service (req.utilisateur.id).
    const { source, type, niveau, message } = req.body || {};
    const alerte = await service.creer(
      { source, type, niveau, message },
      req.utilisateur.id
    );
    res.status(201).json({ message: "Alerte ajoutée.", alerte });
  } catch (erreur) {
    next(erreur);
  }
}


/* ---------- 4. PUT /api/alertes/:id ----------------------- */

async function remplacer(req, res, next) {
  try {
    const { source, type, niveau, message } = req.body || {};
    const alerte = await service.remplacer(
      req.params.id,
      { source, type, niveau, message },
      req.utilisateur.id
    );
    if (!alerte) {
      return res.status(404).json({ message: "Alerte introuvable." });
    }
    res.status(200).json({ message: "Alerte remplacée.", alerte });
  } catch (erreur) {
    next(erreur);
  }
}


/* ---------- 5. PATCH /api/alertes/:id/resolue ------------- */

async function resoudre(req, res, next) {
  try {
    const alerte = await service.resoudre(req.params.id, req.utilisateur.id);
    if (alerte === null) {
      return res.status(404).json({ message: "Alerte introuvable." });
    }
    res.status(200).json({ message: "Alerte résolue.", alerte });
  } catch (erreur) {
    next(erreur);
  }
}


/* ---------- 6. DELETE /api/alertes/:id -------------------- */

async function supprimer(req, res, next) {
  try {
    const alerte = await service.supprimer(req.params.id, req.utilisateur.id);
    if (!alerte) {
      return res.status(404).json({ message: "Alerte introuvable." });
    }
    res.status(200).json({
      message: "Alerte supprimée.",
      id:      req.params.id
    });
  } catch (erreur) {
    next(erreur);
  }
}


module.exports = {
  lister,
  obtenir,
  creer,
  remplacer,
  resoudre,
  supprimer
};
