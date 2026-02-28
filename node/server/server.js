//---------------------------------------------------------------------------------------------------------------------------------
/**
 * server.js (entrypoint)
 * 
 * Bootstrap applicazione:
 * - carica env
 * - crea Router
 * - registra listeners (API)
 * - avvia HTTP e (opzionale) HTTPS
 */
//---------------------------------------------------------------------------------------------------------------------------------
"use strict"; // Attiva strict mode per rendere più evidenti errori e assegnazioni “strane”.
//---------------------------------------------------------------------------------------------------------------------------------
require("dotenv").config(); // Carica le variabili d’ambiente da file .env in process.env.
const path = require("path"); // Importa utilità per comporre percorsi filesystem cross-platform.
const Router = require("./module/Router"); // Importa la classe Router (dispatcher principale).
const HttpServer = require("./module/HTTPServer"); // Importa il wrapper del server HTTP.
const HttpsServer = require("./module/HttpsServer"); // Importa il wrapper del server HTTPS (TLS).
const middlewares = require("./module/middleware"); // Importa la pipeline di middleware (array + istanze condivise).
const registerListeners = require("./module/listeners"); // Importa la funzione che registra tutte le route API.
//---------------------------------------------------------------------------------------------------------------------------------
try { // Protegge il bootstrap: se fallisce una dipendenza/config, blocca subito l’avvio.
  // Cartella "public" dove metti la build Angular (index.html + assets).
  const publicDir = path.join(__dirname, process.env.PUBLIC_DIR || "public"); // Risolve la cartella public: env > default "public".

  const router = new Router({ publicDir }); // Crea il router passando il publicDir per servire SPA e asset.
  registerListeners(router); // Registra sul router tutti gli endpoint API (health, auth, db, ecc.).

  const httpPort = Number(process.env.PORT || 3000); // Legge la porta HTTP da env e la converte in numero (fallback 3000).
  new HttpServer(router, middlewares, httpPort).start(); // Istanzia e avvia il server HTTP con router e middleware.

  // HTTPS opzionale (in laboratorio spesso serve per OAuth)
  const enableHttps = String(process.env.ENABLE_HTTPS || "true").toLowerCase() === "true"; // Converte env in booleano string-robusto.
  if (enableHttps) { // Se abilitato, avvia anche il server HTTPS.
    const httpsPort = Number(process.env.HTTPS_PORT || 3443); // Legge la porta HTTPS da env e la converte in numero (fallback 3443).
    new HttpsServer(router, middlewares, httpsPort).start(); // Istanzia e avvia il server HTTPS con router e middleware.
  }

} catch (err) { // Gestisce errori di bootstrap (es. env mancanti, cert non trovati, moduli rotti).
  console.error("Bootstrap failed:", err); // Stampa su stderr l’errore per diagnosi immediata.
  process.exit(1); // Termina il processo con exit code != 0 (segnala failure al sistema/runner).
}
//---------------------------------------------------------------------------------------------------------------------------------

