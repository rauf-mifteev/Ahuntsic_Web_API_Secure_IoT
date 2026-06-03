/* ============================================================
   routes/statistiques.routes.js — Etape 4
   ------------------------------------------------------------
   GET /api/statistiques  — administrateur uniquement.
   ============================================================ */

const express = require("express");
const ctrl    = require("../controleurs/statistiques.controleur");
const { verifierToken, autoriserRoles } = require("../middlewares/auth.middleware");

const router = express.Router();

router.get(
  "/",
  verifierToken,
  autoriserRoles("administrateur"),
  ctrl.obtenir
);

module.exports = router;
