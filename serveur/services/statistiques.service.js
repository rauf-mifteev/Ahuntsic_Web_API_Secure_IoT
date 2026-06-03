/* ============================================================
   services/statistiques.service.js — Tableau de bord — Etape 4
   ------------------------------------------------------------
   Calcule 4 indicateurs sur les 24 dernières heures :
     - alertesParNiveau           (info / avertissement / critique)
     - alertesResoluesVsOuvertes  (resolues / ouvertes)
     - topSources                 (5 sources les plus fréquentes)
     - totalAlertes24h

   ============================================================ */

const Alerte = require("../modeles/Alerte");


async function obtenirTableauDeBord() {
  const debut24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Filtre commun : alertes des dernières 24 h.
  const match24h = { horodatage: { $gte: debut24h } };

  const [parNiveauRaw, etatRaw, topSourcesRaw, total] = await Promise.all([

    // 1) Compte par niveau
    Alerte.aggregate([
      { $match: match24h },
      { $group: { _id: "$niveau", compte: { $sum: 1 } } }
    ]),

    // 2) Compte résolues vs ouvertes
    Alerte.aggregate([
      { $match: match24h },
      { $group: { _id: "$resolue", compte: { $sum: 1 } } }
    ]),

    // 3) Top 5 sources
    Alerte.aggregate([
      { $match: match24h },
      { $group: { _id: "$source", compte: { $sum: 1 } } },
      { $sort:  { compte: -1 } },
      { $limit: 5 }
    ]),

    // 4) Total
    Alerte.countDocuments(match24h)
  ]);

  // Mise en forme — on garantit la présence des 3 niveaux
  // même si l'un d'eux n'a aucune alerte (compte = 0).
  const alertesParNiveau = { info: 0, avertissement: 0, critique: 0 };
  for (const ligne of parNiveauRaw) {
    if (ligne._id in alertesParNiveau) {
      alertesParNiveau[ligne._id] = ligne.compte;
    }
  }

  const alertesResoluesVsOuvertes = { resolues: 0, ouvertes: 0 };
  for (const ligne of etatRaw) {
    if (ligne._id === true)  alertesResoluesVsOuvertes.resolues = ligne.compte;
    if (ligne._id === false) alertesResoluesVsOuvertes.ouvertes = ligne.compte;
  }

  const topSources = topSourcesRaw.map((l) => ({
    source: l._id,
    compte: l.compte
  }));

  return {
    alertesParNiveau,
    alertesResoluesVsOuvertes,
    topSources,
    totalAlertes24h: total
  };
}


module.exports = { obtenirTableauDeBord };
