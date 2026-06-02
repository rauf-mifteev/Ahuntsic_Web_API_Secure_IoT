/* ============================================================
   app.js — Point d'entrée du serveur (Projet final — Etape 1)
   ------------------------------------------------------------
   Evolutions par rapport à l'EP2 :
     1. Lecture/validation de la config dans config/config.js.
     2. CORS avec liste blanche d'origines.
     3. express.json avec limite de taille.
     4. Routes /api/auth et /api/alertes (protégées par rôle).
     5. Middleware d'erreur central (4 arguments) en queue.

   ============================================================ */

const express = require("express");
const cors    = require("cors");

const config              = require("./config/config");
const { connecterBD }     = require("./config/bd");
const { middlewareErreur }= require("./controleurs/erreurs.middleware");

const authRoutes    = require("./routes/auth.routes");
const alertesRoutes = require("./routes/alertes.routes");


const app = express();


/* ------------------------------------------------------------
   1) Middlewares globaux
   ------------------------------------------------------------ */

app.use(cors({
  origin: (origine, callback) => {
    //if (!origine) return callback(null, true);    // Insomnia / curl
    if (!origine || origine === "null") return callback(null, true); // Insomnia / curl / file://
    if (config.corsOrigines.includes(origine)) return callback(null, true);
    return callback(new Error(`Origine non autorisée : ${origine}`));
  },
  credentials: true
}));

app.use(express.json({ limit: config.tailleMaxCorps }));

// Journalisation : méthode + URL + statut + durée.
app.use((req, res, next) => {
  const debut = Date.now();
  res.on("finish", () => {
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} (${Date.now() - debut}ms)`);
  });
  next();
});


/* ------------------------------------------------------------
   2) Routes
   ------------------------------------------------------------ */

app.use("/api/auth",    authRoutes);
app.use("/api/alertes", alertesRoutes);

// 404 par défaut pour les URLs inconnues.
app.use((req, res) => {
  res.status(404).json({ message: "Ressource introuvable." });
});

// Middleware d'erreur central 
app.use(middlewareErreur);


/* ------------------------------------------------------------
   3) Démarrage
   ------------------------------------------------------------ */

const PORT = config.port;

async function demarrer() {
  try {
    await connecterBD(config.mongoUri);
    app.listen(PORT, () => {
      console.log(`Serveur en écoute sur http://localhost:${PORT}`);
    });
  } catch (erreur) {
    console.error("Démarrage annulé :", erreur.message);
    process.exit(1);
  }
}

demarrer();
