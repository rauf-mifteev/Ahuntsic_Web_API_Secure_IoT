/* ============================================================
   modeles/Alerte.js — Schéma Mongoose pour les alertes
   ------------------------------------------------------------
   Évolution depuis l'examen pratique 2 :
     - ajout de creeePar   (référence vers Utilisateur)
     - ajout de resoluePar (référence vers Utilisateur)
     Les champs source/type/niveau/message/horodatage/resolue
   ============================================================ */

const mongoose = require("mongoose");

const NIVEAUX_AUTORISES = ["info", "avertissement", "critique"];

const alerteSchema = new mongoose.Schema(
  {
    source: {
      type:      String,
      required:  [true, "Le champ 'source' est obligatoire."],
      trim:      true,
      minlength: [2,  "Le champ 'source' doit faire au moins 2 caractères."],
      maxlength: [80, "Le champ 'source' ne peut pas dépasser 80 caractères."]
    },
    type: {
      type:      String,
      required:  [true, "Le champ 'type' est obligatoire."],
      trim:      true,
      lowercase: true
    },
    niveau: {
      type:     String,
      required: [true, "Le champ 'niveau' est obligatoire."],
      enum: {
        values:  NIVEAUX_AUTORISES,
        message: "Le champ 'niveau' doit valoir info, avertissement ou critique."
      }
    },
    message: {
      type:      String,
      required:  [true, "Le champ 'message' est obligatoire."],
      trim:      true,
      minlength: [3,   "Le champ 'message' doit faire au moins 3 caractères."],
      maxlength: [200, "Le champ 'message' ne peut pas dépasser 200 caractères."]
    },
    horodatage: {
      type:    Date,
      default: Date.now,
      index:   true
    },
    resolue: {
      type:    Boolean,
      default: false
    },
    resolueAt: {
      type:    Date,
      default: null
    },

    // --- Traçabilité (nouveauté du projet final) ---
    creeePar: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Utilisateur",
      required: true
    },
    resoluePar: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "Utilisateur",
      default: null
    }
  },
  {
    timestamps: true,
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

// Index utile : recherche fréquente "alertes non résolues récentes".
alerteSchema.index({ resolue: 1, horodatage: -1 });

module.exports = mongoose.model("Alerte", alerteSchema);
module.exports.NIVEAUX_AUTORISES = NIVEAUX_AUTORISES;
