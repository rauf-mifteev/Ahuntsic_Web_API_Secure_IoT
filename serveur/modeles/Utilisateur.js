/* ============================================================
   modeles/Utilisateur.js — Schéma Mongoose des utilisateurs
   ------------------------------------------------------------
   Détails importants :
     - courriel est UNIQUE et validé par une regex simple.
     - motDePasseHache est marqué « select: false » : Mongoose
       n'inclut jamais ce champ dans une réponse, sauf si on le
       demande explicitement.
     - role est un enum strict : « lecteur », « operateur »,
       « administrateur ». La valeur par défaut est « lecteur ».
     - toJSON.transform garantit (ceinture ET bretelles) que
       motDePasseHache n'apparaîtra jamais dans une réponse JSON.
   ============================================================ */

const mongoose = require("mongoose");

const ROLES_AUTORISES = ["lecteur", "operateur", "administrateur"];

const utilisateurSchema = new mongoose.Schema(
  {
    courriel: {
      type:      String,
      required:  [true, "Le courriel est obligatoire."],
      unique:    true,
      lowercase: true,
      trim:      true,
      match:     [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Le courriel n'est pas valide."
      ]
    },

    nom: {
      type:      String,
      required:  [true, "Le nom est obligatoire."],
      trim:      true,
      minlength: [2,  "Le nom doit contenir au moins 2 caractères."],
      maxlength: [80, "Le nom ne peut pas dépasser 80 caractères."]
    },

    motDePasseHache: {
      type:     String,
      required: true,
      select:   false   // n'apparaît JAMAIS dans les réponses sauf demande explicite
    },

    role: {
      type: String,
      enum: {
        values:  ROLES_AUTORISES,
        message: "Rôle invalide. Valeurs acceptées : lecteur, operateur, administrateur."
      },
      default: "lecteur"
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
        // Double protection : même si un .select("+motDePasseHache") s'échappe,
        // le champ ne sortira pas dans la réponse JSON.
        delete ret.motDePasseHache;
        return ret;
      }
    }
  }
);

const Utilisateur = mongoose.model("Utilisateur", utilisateurSchema);
module.exports = Utilisateur;
module.exports.ROLES_AUTORISES = ROLES_AUTORISES;
