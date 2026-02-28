//-----------------------------------------------------------------------------------------------------------------------------------
/**
 * Router
 * -----------------------------------------------------------------------------
 * Router minimale con:
 * - registry rotte (match ESATTO: method + pathname)
 * - middleware stile Express (req, res, next)
 * - fallback SPA (Angular) dalla cartella public/ (index.html + asset)
 *
 * Nota: Non supporta path param (tipo /users/:id). Per didattica usiamo query string (?id=...).
 */
//-----------------------------------------------------------------------------------------------------------------------------------
"use strict"; // Abilita strict mode: evita comportamenti ambigui ed errori silenziosi.
//-----------------------------------------------------------------------------------------------------------------------------------
const url = require("url"); // Importa parser URL (querystring + pathname).
const fs = require("fs/promises"); // Importa FS promise-based per leggere file in async/await.
const path = require("path"); // Importa utility per path cross-platform.
const FileLogger = require("./FileLogger"); // Importa logger su file per tracciare routing e anomalie.
//-----------------------------------------------------------------------------------------------------------------------------------
const logger = new FileLogger("./log/router.log"); // Istanzia logger dedicato al router.
//-----------------------------------------------------------------------------------------------------------------------------------
class Router { // Definisce un router minimale con registry rotte, middleware chain e SPA fallback.
  /**
   * @param {object} [opt]
   * @param {string} [opt.publicDir="./public"] Cartella che contiene la build Angular (index.html + assets).
   */
  constructor({ publicDir = "./public" } = {}) { // Costruisce il router inizializzando registry e percorsi SPA.
    this.routes = { GET: {}, POST: {}, PUT: {}, PATCH: {}, DELETE: {} }; // Prepara dizionari per rotte per-method (match esatto).

    this.publicDir = path.resolve(publicDir); // Normalizza publicDir in path assoluto (evita ambiguità di cwd).
    this.indexPath = path.join(this.publicDir, "index.html"); // Costruisce il path assoluto di index.html.

    /** @type {string[]} prefissi che NON devono finire nel fallback SPA */
    this.apiPrefixes = ["/api/", "/oauth/", "/db/", "/auth/", "/session/", "/jwt/", "/health"]; // Elenco prefissi “API” da escludere dallo SPA fallback.
  }
//-----------------------------------------------------------------------------------------------------------------------------------
  /**
   * Registra una rotta (match esatto su pathname).
   * @param {"GET"|"POST"|"PUT"|"PATCH"|"DELETE"} method
   * @param {string} routePath
   * @param {(req:any, res:any)=>Promise<void>} handler
   */
  register(method, routePath, handler) { // Registra handler su method+path con match ESATTO.
    if (!this.routes[method]) throw new Error(`Metodo non supportato: ${method}`); // Valida il method: deve esistere nel registry.
    this.routes[method][routePath] = handler; // Associa handler al path per quel metodo HTTP.
    logger.info(`Route registered: ${method} ${routePath}`); // Logga registrazione route (utile per debug startup).
  }
//-----------------------------------------------------------------------------------------------------------------------------------
// Middleware runner (stile Express) - robusto ma leggibile
//-----------------------------------------------------------------------------------------------------------------------------------
  /**
   * Esegue i middleware in sequenza.
   *
   * Regola d'oro:
   * - un middleware "termina" la richiesta se scrive su res (writeHead/end/redirect)
   * - altrimenti deve chiamare next() per far proseguire la catena
   *
   * @param {any} req
   * @param {any} res
   * @param {Array<Function>} [middlewares=[]]
   * @returns {Promise<boolean>} true se qualcuno ha risposto, false se nessuno ha risposto
   */
  async #runMiddlewares(req, res, middlewares = []) { // Esegue una chain stile Express, gestendo anche il caso “next() non chiamato”.
    let index = 0; // Indice del middleware corrente nella lista.

    const run = async () => { // Funzione ricorsiva/iterativa che avanza nella catena con next().
      // Se qualcuno ha già risposto, stop.
      if (res.headersSent || res.writableEnded) return true; // Se la response è partita/chiusa, considera la request gestita.

      // Fine lista: nessun middleware ha risposto.
      if (index >= middlewares.length) return false; // Se finiti i middleware e nessuno ha risposto, ritorna “non gestita”.

      const current = middlewares[index++]; // Preleva il middleware corrente e avanza l’indice.
      const name = current.name || `middleware#${index}`; // Ricava un nome per log più leggibili.

      // "continuation" è la PROMESSA della parte restante della catena.
      // Viene creata solo se qualcuno chiama next().
      let continuation = null; // Tiene la Promise della “coda” della chain, creata solo al primo next().

      const next = () => { // Funzione next() passata al middleware, come in Express.
        // Evita che next() venga eseguito 2 volte.
        if (!continuation) continuation = run(); // Se next() chiamato per la prima volta, crea la Promise che prosegue la chain.
        return continuation; // Ritorna la stessa Promise se next() viene richiamato ancora.
      };

      await current(req, res, next); // Esegue il middleware corrente (può rispondere o chiamare next()).

      // Se ha risposto, stop.
      if (res.headersSent || res.writableEnded) return true; // Se il middleware ha chiuso la response, request gestita.

      // Se ha chiamato next(), aspetta che la chain finisca davvero.
      if (continuation) return await continuation; // Se next() è stato chiamato, aspetta la catena restante.

      // Caso "bug": né risposta né next().
      logger.warn( // Logga la condizione tipica che in Express lascia la request “appesa”.
        `[MW] BLOCKED: ${name} did not call next() and did not send a response. ` + // Spiega quale middleware ha bloccato la chain.
        `url=${req.method} ${req.url}` // Aggiunge contesto su metodo e URL originale.
      );

      // In Express questa situazione lascia la request "appesa".
      // Qui facciamo fail-fast: rispondiamo 500 per rendere visibile l'errore.
      if (!res.headersSent && !res.writableEnded) { // Verifica che sia ancora possibile rispondere.
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" }); // Imposta 500 e content-type testuale UTF-8.
        res.end("Errore: un middleware non ha chiamato next() e non ha inviato risposta."); // Chiude la response con messaggio esplicito.
      }
      return true; // Considera la request gestita perché abbiamo risposto noi con 500.
    };

    return await run(); // Avvia la chain e ritorna se/come è stata gestita.
  }
//-----------------------------------------------------------------------------------------------------------------------------------
// SPA serving (Angular build dentro public/)
//-----------------------------------------------------------------------------------------------------------------------------------
  /**
   * Determina Content-Type in base all'estensione.
   * @param {string} filePath
   * @returns {string}
   */
  #contentType(filePath) { // Mappa estensione file -> MIME type per header Content-Type.
    const ext = path.extname(filePath).toLowerCase(); // Estrae estensione e la normalizza in lowercase.
    switch (ext) { // Seleziona il MIME corretto in base all’estensione.
      case ".html": return "text/html; charset=utf-8"; // MIME per HTML.
      case ".js": return "application/javascript; charset=utf-8"; // MIME per JavaScript.
      case ".css": return "text/css; charset=utf-8"; // MIME per CSS.
      case ".json": return "application/json; charset=utf-8"; // MIME per JSON.
      case ".map": return "application/json; charset=utf-8"; // Sourcemap trattata come JSON.
      case ".svg": return "image/svg+xml"; // MIME per SVG.
      case ".png": return "image/png"; // MIME per PNG.
      case ".jpg": // Raggruppa estensioni JPEG.
      case ".jpeg": return "image/jpeg"; // MIME per JPEG.
      case ".ico": return "image/x-icon"; // MIME per favicon/ico.
      case ".woff": return "font/woff"; // MIME per font WOFF.
      case ".woff2": return "font/woff2"; // MIME per font WOFF2.
      default: return "application/octet-stream"; // Fallback binario generico (sicuro per estensioni sconosciute).
    }
  }
//-----------------------------------------------------------------------------------------------------------------------------------
  /**
   * Protezione directory traversal: verifica che absPath sia dentro publicDir.
   * @param {string} absPath
   * @returns {boolean}
   */
  #isInsidePublic(absPath) { // Difende da path traversal: consente solo file dentro la cartella public.
    const base = this.publicDir.endsWith(path.sep) ? this.publicDir : this.publicDir + path.sep; // Normalizza base con separatore finale.
    return absPath === this.publicDir || absPath.startsWith(base); // True se è esattamente publicDir o un suo discendente.
  }
//-----------------------------------------------------------------------------------------------------------------------------------
  /**
   * Invia un file dal filesystem.
   * @param {any} res
   * @param {string} absPath
   * @returns {Promise<boolean>}
   */
  async #sendFile(res, absPath) { // Legge un file e lo invia come risposta HTTP 200.
    const buf = await fs.readFile(absPath); // Legge il contenuto completo del file in Buffer.
    res.writeHead(200, { "Content-Type": this.#contentType(absPath) }); // Imposta status 200 e content-type coerente con l’estensione.
    res.end(buf); // Invia buffer e chiude la response.
    return true; // Ritorna true: file inviato con successo.
  }
//-----------------------------------------------------------------------------------------------------------------------------------
  /**
   * Fallback SPA:
   * - GET /             -> index.html
   * - GET /asset.ext    -> prova file reale; se manca => false (quindi 404)
   * - GET /qualcosa     -> index.html (route Angular)
   *
   * @param {any} req
   * @param {any} res
   * @param {string} pathname
   * @returns {Promise<boolean>}
   */
  async #serveSpa(req, res, pathname) { // Gestisce serving SPA Angular (index + asset), evitando di intercettare le API.
    if (req.method !== "GET") return false; // SPA fallback solo per GET (non per POST/PUT/DELETE).

    // Non far "mangiare" alla SPA le API.
    if (this.apiPrefixes.some(p => pathname === p || pathname.startsWith(p))) return false; // Se è API, non fare fallback SPA.

    if (pathname === "/") { // Caso root: restituisce index.html.
      return await this.#sendFile(res, this.indexPath); // Serve la SPA entrypoint.
    }

    const hasExt = path.extname(pathname) !== ""; // True se la URL sembra un asset (ha estensione).

    // Asset: li serviamo solo se esistono davvero.
    if (hasExt) { // Branch asset: prova a servire file reale.
      const rel = pathname.replace(/^\/+/, "");     // "main.js", "assets/x.png"
      const abs = path.resolve(this.publicDir, rel); // Risolve path assoluto dell’asset richiesto dentro public.

      if (!this.#isInsidePublic(abs)) return false; // Blocca richieste fuori public (tentativi traversal).

      try { // Prova a verificare esistenza e natura del path.
        const st = await fs.stat(abs); // Ottiene informazioni sul filesystem (esistenza, tipo file/dir).
        if (st.isFile()) return await this.#sendFile(res, abs); // Se è file, invialo e termina con successo.
      } catch {
        return false; // file mancante -> lasciamo che il caller faccia 404
      }
      return false; // Caso non file (es. directory): non servire.
    }

    // Route Angular (senza estensione) -> index.html
    return await this.#sendFile(res, this.indexPath); // Per route client-side, rimanda a index.html.
  }
//-----------------------------------------------------------------------------------------------------------------------------------
// Dispatch principale
//-----------------------------------------------------------------------------------------------------------------------------------
  /**
   * Gestisce una request:
   * 1) run middleware
   * 2) route API (match esatto)
   * 3) fallback SPA
   * 4) 404
   *
   * @param {any} req
   * @param {any} res
   * @param {Array<Function>} [middlewares=[]]
   * @returns {Promise<boolean>} true se la richiesta è stata gestita (incluso 404/500)
   */
  async handle(req, res, middlewares = []) { // Dispatcher principale: middleware -> route -> SPA -> 404, con catch 500.
    const parsed = url.parse(req.url, true); // Parsifica URL ottenendo pathname e query (true => query come oggetto).
    req.query = parsed.query || {}; // Espone query su req per semplificare gli handler.
    const pathname = parsed.pathname || "/"; // Normalizza pathname: fallback a "/" se assente.

    const handler = this.routes[req.method]?.[pathname]; // Recupera handler registrato per method+pathname (match esatto).

    try { // Isola errori di middleware/handler/SPAsrv per rispondere 500 senza crash.
      // 1) Middleware (sempre)
      const mwHandled = await this.#runMiddlewares(req, res, middlewares); // Esegue chain middleware e vede se qualcuno ha risposto.
      if (mwHandled || res.headersSent || res.writableEnded) return true; // Se già gestita o response chiusa, stop.

      // 2) Route API
      if (handler) { // Se esiste handler registrato, eseguilo.
        await handler(req, res); // Esegue l’handler della rotta.
        return true; // Considera la request gestita (anche se handler non risponde: sarà un bug del handler).
      }

      // 3) SPA
      const spaOk = await this.#serveSpa(req, res, pathname); // Prova fallback SPA (index o asset).
      if (spaOk || res.headersSent || res.writableEnded) return true; // Se SPA ha risposto o response è chiusa, stop.

      // 4) 404 finale
      logger.warn(`Route not found: ${req.method} ${pathname}`); // Logga la rotta non trovata.
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); // Imposta 404 e content-type testuale.
      res.end("Not found"); // Chiude response con body minimale.
      return true; // Request gestita (con 404).

    } catch (err) { // Gestisce eccezioni non previste emerse in try.
      logger.error(`Router error: ${err?.message ?? String(err)}`); // Logga l’errore con fallback robusto.
      if (!res.headersSent && !res.writableEnded) { // Se possiamo ancora rispondere, inviamo 500.
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" }); // Imposta 500 e content-type testuale.
        res.end("Errore durante l’elaborazione della richiesta"); // Chiude response con messaggio generico.
      }
      return true; // Request gestita (con 500 o con response già inviata).
    }
  }
}
//-----------------------------------------------------------------------------------------------------------------------------------
module.exports = Router; // Esporta la classe Router (CommonJS) per essere usata dai server HTTP/HTTPS.
//-----------------------------------------------------------------------------------------------------------------------------------