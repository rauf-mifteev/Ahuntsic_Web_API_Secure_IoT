/* ============================================================
   services/requete.js — Parsing des paramètres de la route liste
   ------------------------------------------------------------
   Convertit req.query en :
     { filtre, tri, page, limit, skip }

   Lève une erreur métier (name: "ParametreInvalide") si un
   paramètre est mal formé. Le middleware central traduit cette
   erreur en réponse HTTP 400.
   ============================================================ */

const NIVEAUX_AUTORISES = ["info", "avertissement", "critique"];
const CHAMPS_TRI        = ["horodatage", "niveau", "createdAt"];
const LIMIT_DEFAUT      = 10;
const LIMIT_MAX         = 100;

function erreurParametre(message) {
  const e = new Error(message);
  e.name = "ParametreInvalide";
  return e;
}

function estPresent(valeur) {
  return valeur !== undefined && valeur !== null && String(valeur).trim() !== "";
}

function construireOptions(query = {}) {
  const filtre = {};

  // --- Filtre exact : niveau --------------------------------
  if (estPresent(query.niveau)) {
    const niveau = String(query.niveau).trim();
    if (!NIVEAUX_AUTORISES.includes(niveau)) {
      throw erreurParametre(
        `Le paramètre 'niveau' doit valoir ${NIVEAUX_AUTORISES.join(", ")}.`
      );
    }
    filtre.niveau = niveau;
  }

  // --- Filtre exact : type ----------------------------------
  if (estPresent(query.type)) {
    filtre.type = String(query.type).trim().toLowerCase();
  }

  // --- Filtre exact : resolue (string -> booleen) ----------
  if (estPresent(query.resolue)) {
    const v = String(query.resolue).trim().toLowerCase();
    if (v === "true")       filtre.resolue = true;
    else if (v === "false") filtre.resolue = false;
    else {
      throw erreurParametre(
        "Le paramètre 'resolue' doit valoir \"true\" ou \"false\"."
      );
    }
  }

  // --- Recherche regex sur le message ----------------------
  if (estPresent(query.q)) {
    filtre.message = {
      $regex:   String(query.q).trim(),
      $options: "i"
    };
  }

  // --- Plage de dates sur horodatage -----------------------
  if (estPresent(query.since) || estPresent(query.until)) {
    filtre.horodatage = {};
    if (estPresent(query.since)) {
      const d = new Date(query.since);
      if (Number.isNaN(d.getTime())) {
        throw erreurParametre(
          "Le paramètre 'since' n'est pas une date ISO 8601 valide."
        );
      }
      filtre.horodatage.$gte = d;
    }
    if (estPresent(query.until)) {
      const d = new Date(query.until);
      if (Number.isNaN(d.getTime())) {
        throw erreurParametre(
          "Le paramètre 'until' n'est pas une date ISO 8601 valide."
        );
      }
      filtre.horodatage.$lte = d;
    }
  }

  // --- Tri --------------------------------------------------
  const champTri = estPresent(query.sort) ? String(query.sort).trim() : "horodatage";
  if (!CHAMPS_TRI.includes(champTri)) {
    throw erreurParametre(
      `Le paramètre 'sort' doit valoir ${CHAMPS_TRI.join(", ")}.`
    );
  }
  const direction = String(query.order || "desc").toLowerCase() === "asc" ? 1 : -1;
  const tri = { [champTri]: direction };

  // --- Pagination ------------------------------------------
  const page = estPresent(query.page) ? parseInt(query.page, 10) : 1;
  if (!Number.isInteger(page) || page < 1) {
    throw erreurParametre("Le paramètre 'page' doit être un entier >= 1.");
  }

  const limit = estPresent(query.limit) ? parseInt(query.limit, 10) : LIMIT_DEFAUT;
  if (!Number.isInteger(limit) || limit < 1 || limit > LIMIT_MAX) {
    throw erreurParametre(
      `Le paramètre 'limit' doit être un entier entre 1 et ${LIMIT_MAX}.`
    );
  }

  return {
    filtre,
    tri,
    page,
    limit,
    skip: (page - 1) * limit
  };
}

function enveloppePaginee(donnees, total, page, limit) {
  return {
    donnees,
    total,
    page,
    limit,
    pages: limit > 0 ? Math.ceil(total / limit) : 0
  };
}

module.exports = { construireOptions, enveloppePaginee };
