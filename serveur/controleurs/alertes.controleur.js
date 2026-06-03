/* ============================================================
   controleurs/alertes.controleur.js — Couche HTTP alertes étape 3
   ------------------------------------------------------------
   Evolutions par rapport à l'étape 1 :
     - après chaque opération réussie (POST, PATCH, DELETE),
       le contrôleur émet l'événement Socket.IO correspondant
       via req.app.get("io").emit(...).

   Le service retourne le document complet (populé), le
   contrôleur diffuse sur Socket.IO, puis répond au client REST.
   Le service ne sait toujours rien de Socket.IO.
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
    const { source, type, niveau, message } = req.body || {};
    const alerte = await service.creer(
      { source, type, niveau, message },
      req.utilisateur.id
    );

    // Diffusion temps réel après la persistance.
    // Tous les clients connectés reçoivent l'alerte complète.
    req.app.get("io").emit("alerte:nouvelle", alerte);

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

    // Un remplacement complet se traite comme une nouvelle alerte.
    req.app.get("io").emit("alerte:nouvelle", alerte);

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

    // L'interface affichera un toast "Alerte résolue" et
    // mettra à jour la carte (fond gris, champ resoluePar).
    req.app.get("io").emit("alerte:resolue", alerte);

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

    // La charge utile n'a besoin que de l'id pour que l'interface
    // sache quelle carte retirer de la liste.
    req.app.get("io").emit("alerte:supprimee", {
      id:           req.params.id,
      supprimeePar: { id: req.utilisateur.id }
    });

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
