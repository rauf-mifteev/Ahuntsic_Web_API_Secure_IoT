/* ============================================================
   routes/auth.routes.js
   ------------------------------------------------------------
   POST /api/auth/inscription   - public
   POST /api/auth/connexion     - public
   GET  /api/auth/moi           - protégé (tout rôle authentifié)
   ============================================================ */

const express = require("express");
const ctrl    = require("../controleurs/auth.controleur");
const { verifierToken } = require("../middlewares/auth.middleware");

const router = express.Router();

router.post("/inscription", ctrl.inscription);
router.post("/connexion",   ctrl.connexion);
router.get ("/moi",         verifierToken, ctrl.monProfil);

module.exports = router;
