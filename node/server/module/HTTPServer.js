//---------------------------------------------------------------------------------------------------------------------------------------------------------
/**
 * HTTPServer
 * 
 * Server HTTP minimale: delega TUTTO a Router.handle().
 * Il Router è responsabile di:
 * - middleware
 * - API route
 * - SPA fallback
 * - 404
 */
//---------------------------------------------------------------------------------------------------------------------------------------------------------
"use strict"; // Abilita strict mode per evitare comportamenti ambigui e errori silenziosi.
//---------------------------------------------------------------------------------------------------------------------------------------------------------
const http = require("http"); // Importa il modulo core HTTP per creare un server.
const FileLogger = require("./FileLogger"); // Importa il logger su file per tracciare avvii ed errori.
//---------------------------------------------------------------------------------------------------------------------------------------------------------
class HttpServer { // Classe wrapper: incapsula creazione, avvio e stop del server HTTP.
  /**
   * @param {import("./Router")} router
   * @param {Array<Function>} [middlewares=[]]
   * @param {number} [port=3000]
   */
  constructor(router, middlewares = [], port = 3000) { // Costruttore: riceve router, middleware opzionali e porta.
    this.router = router; // Salva il router: sarà l’unico “dispatcher” delle richieste.
    this.middlewares = Array.isArray(middlewares) ? middlewares : []; // Normalizza middlewares: se non è array => array vuoto.
    this.port = port; // Salva la porta di ascolto del server.
    this.logger = new FileLogger("./log/serverHTTP.log"); // Crea un logger dedicato al server HTTP.
    this.server = null; // Inizializza il riferimento al server (sarà valorizzato in start()).
  }
//---------------------------------------------------------------------------------------------------------------------------------------------------------
  /**
   * Avvia il server.
   * @returns {void}
   */
  start() { // Metodo di avvio: crea server e mette in ascolto sulla porta configurata.
    this.server = http.createServer(async (req, res) => { // Crea il server e definisce l’handler per ogni richiesta.
      try { // Protegge l’intero flusso richiesta/risposta per evitare crash del processo.
        await this.router.handle(req, res, this.middlewares); // Delega la richiesta al router, passando i middleware condivisi.

        // Paracadute: se per qualsiasi motivo nessuno ha risposto, chiudi con 404.
        if (!res.headersSent && !res.writableEnded) { // Verifica che non siano già stati inviati header e che la response non sia chiusa.
          res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); // Imposta status e header per una risposta testuale UTF-8.
          res.end("Not found"); // Termina la risposta con un body minimale.
        }
      } catch (err) { // Gestisce errori lanciati da router/middleware o da I/O durante la gestione richiesta.
        this.logger.error(`Server error: ${err?.message ?? String(err)}`); // Logga l’errore in modo robusto (con optional chaining + fallback).

        if (!res.headersSent) { // Se gli header non sono ancora stati inviati, possiamo impostare un 500 coerente.
          res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" }); // Imposta status 500 e content-type testuale.
        }
        if (!res.writableEnded) res.end("Errore interno del server"); // Se la response non è chiusa, invia messaggio e termina.
      }
    });

    this.server.listen(this.port, () => { // Avvia l’ascolto sulla porta e registra callback “server pronto”.
      this.logger.info(`Server HTTP avviato su http://localhost:${this.port}`); // Logga su file l’URL di ascolto.
      console.log(`Server HTTP avviato su http://localhost:${this.port}`); // Stampa a console per feedback immediato in dev.
    });
  }
//---------------------------------------------------------------------------------------------------------------------------------------------------------
  /**
   * Ferma il server (utile nei test).
   * @returns {Promise<void>}
   */
  stop() { // Metodo di stop: chiude il server se esiste, restituendo una Promise.
    return new Promise((resolve) => { // Wrappa la callback di close() in una Promise per uso comodo con await.
      if (!this.server) return resolve(); // Se il server non è stato avviato, risolve subito senza fare nulla.
      this.server.close(() => resolve()); // Chiude l’ascolto e risolve quando la chiusura è completata.
    });
  }
//---------------------------------------------------------------------------------------------------------------------------------------------------------
}
//---------------------------------------------------------------------------------------------------------------------------------------------------------
module.exports = HttpServer; // Esporta la classe (CommonJS) per permettere import/require dagli altri moduli.
//---------------------------------------------------------------------------------------------------------------------------------------------------------
