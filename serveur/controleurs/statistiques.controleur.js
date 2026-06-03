/* ============================================================
   controleurs/statistiques.controleur.js — Etape 4
   ------------------------------------------------------------
   GET /api/statistiques  — administrateur uniquement.
   Renvoie les 4 sections agrégées calculées par le service.
   ============================================================ */

const service = require("../services/statistiques.service");


async function obtenir(req, res, next) {
  try {
    const tableau = await service.obtenirTableauDeBord();
    res.status(200).json(tableau);
  } catch (erreur) {
    next(erreur);
  }
}


module.exports = { obtenir };
