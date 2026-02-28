//---------------------------------------------------------------------------------------------------------------------------------------------------------
/**
 * HttpsServer
 * 
 * Server HTTPS minimale: stessa logica di HTTPServer ma con TLS.
 */
//---------------------------------------------------------------------------------------------------------------------------------------------------------
"use strict"; // Attiva strict mode: evita comportamenti ambigui e rende gli errori più espliciti.
//---------------------------------------------------------------------------------------------------------------------------------------------------------
const https = require("https"); // Importa il modulo core HTTPS per creare server con TLS.
const fs = require("fs"); // Importa il modulo core FS per leggere i file di chiave/certificato.
const path = require("path"); // Importa il modulo core PATH per costruire percorsi in modo cross-platform.
const FileLogger = require("./FileLogger"); // Importa il logger su file per tracciare eventi/errore del server.
//---------------------------------------------------------------------------------------------------------------------------------------------------------
class HttpsServer { // Classe wrapper che incapsula creazione, avvio e stop del server HTTPS.
  /**
   * @param {import("./Router")} router
   * @param {Array<Function>} [middlewares=[]]
   * @param {number} [port=3443]
   * @param {object} [tlsPaths]
   * @param {string} [tlsPaths.keyPath] path a server.key
   * @param {string} [tlsPaths.certPath] path a server.crt
   */
  constructor(router, middlewares = [], port = 3443, tlsPaths = {}) { // Costruttore: salva dipendenze e prepara opzioni TLS.
    this.router = router; // Memorizza il router che gestirà la logica di routing/middleware.
    this.middlewares = Array.isArray(middlewares) ? middlewares : []; // Normalizza i middleware: se non è array, usa array vuoto.
    this.port = port; // Salva la porta su cui il server HTTPS andrà in ascolto.
    this.logger = new FileLogger("./log/serverHTTPS.log"); // Istanzia un logger dedicato al server HTTPS.

    const keyPath = tlsPaths.keyPath || path.join(__dirname, "../certs/server.key"); // Risolve path della chiave privata: input > default.
    const certPath = tlsPaths.certPath || path.join(__dirname, "../certs/server.crt"); // Risolve path del certificato: input > default.

    this.tlsOptions = { // Prepara l’oggetto opzioni TLS richiesto da https.createServer().
      key: fs.readFileSync(keyPath), // Carica la chiave privata dal filesystem (sync: semplice/didattico).
      cert: fs.readFileSync(certPath) // Carica il certificato dal filesystem (sync: semplice/didattico).
    }; // Chiude l’oggetto di opzioni TLS.

    this.server = null; // Inizializza il riferimento al server: verrà creato in start().
  }
//---------------------------------------------------------------------------------------------------------------------------------------------------------
  /**
   * Avvia il server HTTPS.
   * @returns {void}
   */
  start() { // Avvia il server HTTPS creando il listener e mettendolo in ascolto.
    this.server = https.createServer(this.tlsOptions, async (req, res) => { // Crea server TLS e definisce l’handler richieste.
      try { // Protegge il flusso per evitare crash del processo su eccezioni non gestite.
        await this.router.handle(req, res, this.middlewares); // Delega gestione della richiesta al router con i middleware.

        // Paracadute: se per qualsiasi motivo nessuno ha risposto, chiudi con 404.
        if (!res.headersSent && !res.writableEnded) { // Verifica che non siano già stati inviati header e che la response non sia chiusa.
          res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); // Imposta status 404 e header coerenti per testo UTF-8.
          res.end("Not found"); // Termina la risposta con un body minimale.
        }
      } catch (err) { // Gestisce errori provenienti da router/middleware o da I/O durante la risposta.
        this.logger.error(`Server error: ${err?.message ?? String(err)}`); // Logga l’errore (robusto: optional chaining + fallback).

        if (!res.headersSent) { // Se gli header non sono stati inviati, possiamo impostare uno status 500.
          res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" }); // Imposta status 500 e content-type testuale.
        }
        if (!res.writableEnded) res.end("Errore interno del server"); // Se la response non è chiusa, invia messaggio e termina.
      }
    }); // Chiude la creazione del server e l’handler associato.

    this.server.listen(this.port, () => { // Avvia l’ascolto sulla porta configurata e registra callback “server pronto”.
      this.logger.info(`Server HTTPS avviato su https://localhost:${this.port}`); // Logga su file l’URL di ascolto.
      console.log(`Server HTTPS avviato su https://localhost:${this.port}`); // Stampa a console per feedback immediato in dev.
    }); // Chiude la chiamata listen.
  }
//---------------------------------------------------------------------------------------------------------------------------------------------------------
  /**
   * Ferma il server (utile nei test).
   * @returns {Promise<void>}
   */
  stop() { // Ferma il server HTTPS chiudendo il listener e risolvendo quando la chiusura è completata.
    return new Promise((resolve) => { // Wrappa la callback di close() in una Promise per uso comodo con await.
      if (!this.server) return resolve(); // Se il server non è stato avviato, risolve subito senza fare nulla.
      this.server.close(() => resolve()); // Chiude l’ascolto e risolve al completamento della chiusura.
    }); // Chiude la Promise.
  }
}
//---------------------------------------------------------------------------------------------------------------------------------------------------------
module.exports = HttpsServer; // Esporta la classe (CommonJS) per l’uso negli altri moduli.
//---------------------------------------------------------------------------------------------------------------------------------------------------------

