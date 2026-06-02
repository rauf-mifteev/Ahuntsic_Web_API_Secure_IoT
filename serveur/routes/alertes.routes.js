/* ============================================================
   routes/alertes.routes.js — Câblage des 6 routes alertes
   ------------------------------------------------------------
   Toutes les routes sont précédées par verifierToken.
   Le rôle requis pour chaque action est imposé via autoriserRoles.

   Matrice de contrôle d'accès :
     lecteur       : GET (liste, détail)
     operateur     : + POST, PATCH /:id/resolue
     administrateur: + PUT, DELETE
   ============================================================ */

const express = require("express");
const ctrl    = require("../controleurs/alertes.controleur");
const { verifierToken, autoriserRoles } = require("../middlewares/auth.middleware");

const router = express.Router();

// Toutes les routes alertes nécessitent un jeton valide.
router.use(verifierToken);

// Lecture : tous les rôles authentifiés.
router.get   ("/",                                                          ctrl.lister);
router.get   ("/:id",                                                       ctrl.obtenir);

// Création + résolution : opérateur ou administrateur.
router.post  ("/",            autoriserRoles("operateur", "administrateur"), ctrl.creer);
router.patch ("/:id/resolue", autoriserRoles("operateur", "administrateur"), ctrl.resoudre);

// Remplacement + suppression : administrateur uniquement.
router.put   ("/:id",         autoriserRoles("administrateur"),              ctrl.remplacer);
router.delete("/:id",         autoriserRoles("administrateur"),              ctrl.supprimer);

module.exports = router;
