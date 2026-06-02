/* ============================================================
   modeles/AlerteAuditSupression.js — Audit des suppressions
   ------------------------------------------------------------
   Conserve une trace de "qui a supprimé quelle alerte".
   Une copie minimale de l'alerte (apercu) est enregistrée
   pour pouvoir interpréter l'historique même après la
   suppression définitive du document original.

   ============================================================ */

const mongoose = require("mongoose");

const auditSchema = new mongoose.Schema(
  {
    alerteId: {
      type:     mongoose.Schema.Types.ObjectId,
      required: true,
      index:    true
    },

    supprimeePar: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Utilisateur",
      required: true
    },

    supprimeeLe: {
      type:    Date,
      default: Date.now,
      index:   true
    },

    // Aperçu — copie des champs clés au moment de la suppression.
    apercuSource:  { type: String },
    apercuNiveau:  { type: String }
  },
  {
    timestamps: false,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        return ret;
      }
    }
  }
);

module.exports = mongoose.model("AlerteAuditSupression", auditSchema);
