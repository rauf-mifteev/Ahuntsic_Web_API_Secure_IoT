/* ============================================================
   config/bd.js — Connexion à MongoDB via Mongoose
   ------------------------------------------------------------
   Encapsule l'établissement de la connexion. Les transitions
   importantes sont journalisées pour que le démarrage soit
   visible dans la console.
   ============================================================ */

const mongoose = require("mongoose");

async function connecterBD(uri) {
  if (!uri) {
    throw new Error("MONGO_URI est manquante. Vérifiez votre fichier .env.");
  }

  mongoose.connection.on("connected",    () => console.log("MongoDB : connecté"));
  mongoose.connection.on("error",        (e) => console.error("MongoDB : erreur -", e.message));
  mongoose.connection.on("disconnected", () => console.warn("MongoDB : déconnecté"));

  await mongoose.connect(uri);
}

module.exports = { connecterBD };
