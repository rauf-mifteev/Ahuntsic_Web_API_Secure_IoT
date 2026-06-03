/* ============================================================
   socket.js — Initialisation de Socket.IO - Etape 2
   ------------------------------------------------------------
   - Authentification par JWT à la poignée de main (io.use).
     Le client envoie son jeton dans socket.handshake.auth.token.
   - Rejet propre (next(new Error(...))) des sockets non
     authentifiés.
   - L'instance io est retournée pour être exposée à Express via
     app.set("io", io).
   ============================================================ */

const { Server } = require("socket.io");
const jwt        = require("jsonwebtoken");
const config     = require("./config/config");


function initialiser(serveurHttp) {
  const io = new Server(serveurHttp, {
    cors: {
      origin: (origine, callback) => {
        if (!origine || origine === "null") return callback(null, true); // file://
        if (config.corsOrigines.includes(origine)) return callback(null, true);
        return callback(new Error(`Origine non autorisée : ${origine}`));
      },
      credentials: true
    }
  });

  // Poignée de main JWT : seul un utilisateur connecté peut ouvrir le socket.
  // Le client envoie son token dans : socket.handshake.auth.token
  io.use((socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentification requise."));
    }
    try {
      const charge = jwt.verify(token, config.jwtSecret);
      socket.utilisateur = { id: charge.id, role: charge.role };
      next();
    } catch (erreur) {
      next(new Error("Jeton invalide ou expiré."));
    }
  });

  // Journalisation des connexions/déconnexions.
  io.on("connection", (socket) => {
    console.log(`socket+ ${socket.id} (${socket.utilisateur.role})`);
    socket.on("disconnect", () => {
      console.log(`socket- ${socket.id}`);
    });
  });

  return io;
}


module.exports = { initialiser };
