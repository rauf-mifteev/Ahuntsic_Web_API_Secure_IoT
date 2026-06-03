/* ============================================================
   app.js — Point d'entrée du serveur (Projet final — Etape 2)
   ------------------------------------------------------------
   Evolutions par rapport à l'étape 1 :
     1. On crée un serveur HTTP explicite (http.createServer).
     2. Socket.IO est branché sur ce serveur HTTP via socket.js.
     3. L'instance io est exposée à Express via app.set("io", io).
     4. Le serveur écoute sur serveurHttp (pas directement app).
   ============================================================ */

const http    = require("http");
const express = require("express");
const cors    = require("cors");

const config              = require("./config/config");
const { connecterBD }     = require("./config/bd");
const { initialiser }     = require("./socket");
const { middlewareErreur }= require("./controleurs/erreurs.middleware");

const authRoutes    = require("./routes/auth.routes");
const alertesRoutes = require("./routes/alertes.routes");


const app = express();


/* ------------------------------------------------------------
   1) Middlewares globaux
   ------------------------------------------------------------ */

app.use(cors({
  origin: (origine, callback) => {
    //if (!origine) return callback(null, true);
    if (!origine || origine === "null") return callback(null, true); // Insomnia / curl / file://
    if (config.corsOrigines.includes(origine)) return callback(null, true);
    return callback(new Error(`Origine non autorisée : ${origine}`));
  },
  credentials: true
}));

app.use(express.json({ limit: config.tailleMaxCorps }));

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

app.use((req, res) => {
  res.status(404).json({ message: "Ressource introuvable." });
});

app.use(middlewareErreur);


/* ------------------------------------------------------------
   3) Serveur HTTP + Socket.IO
   ------------------------------------------------------------ */

// On crée d'abord le serveur HTTP à partir de l'app Express,
// puis on y branche Socket.IO. Les deux partagent le même port.
const serveurHttp = http.createServer(app);
const io          = initialiser(serveurHttp);

// Mise à disposition de `io` pour les contrôleurs :
//   req.app.get("io").emit("alerte:nouvelle", alerte)
app.set("io", io);


/* ------------------------------------------------------------
   4) Démarrage
   ------------------------------------------------------------ */

async function demarrer() {
  try {
    await connecterBD(config.mongoUri);
    serveurHttp.listen(config.port, () => {
      console.log(`HTTP + Socket.IO sur http://localhost:${config.port}  [${config.nodeEnv}]`);
    });
  } catch (erreur) {
    console.error("Démarrage annulé :", erreur.message);
    process.exit(1);
  }
}

demarrer();
