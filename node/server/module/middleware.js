//---------------------------------------------------------------------------------------------------------------------------------------------------------
/**
 * middleware.js
 * -----------------------------------------------------------------------------
 * Collezione di middleware stile Express: (req, res, next).
 *
 * Pipeline consigliata:
 *   log -> cors -> json body -> session -> auth context -> oauth routes -> protect private data
 */
//---------------------------------------------------------------------------------------------------------------------------------------------------------
"use strict"; // Attiva strict mode per ridurre comportamenti ambigui ed errori silenziosi.
//---------------------------------------------------------------------------------------------------------------------------------------------------------
const FileLogger = require("./FileLogger"); // Importa il logger su file (strumento di tracing).
const SessionManager = require("./SessionManager"); // Importa il gestore sessioni (wrappa client-sessions o equivalente).
const JwtHandler = require("./JwtHandler"); // Importa la logica JWT (sign/verify).
const OAuthHandler = require("./OAuthHandler"); // Importa la logica OAuth (login/callback/profile/logout).
const Db = require("./Db"); // Importa il layer DB (pool MySQL + query helper).
//---------------------------------------------------------------------------------------------------------------------------------------------------------
const logger = new FileLogger("./log/middleware.log"); // Istanzia un logger dedicato a questo modulo.
//---------------------------------------------------------------------------------------------------------------------------------------------------------
// Dipendenze "globali" del backend (uniche istanze)
//---------------------------------------------------------------------------------------------------------------------------------------------------------
const SESSION_SECRET = process.env.SESSION_SECRET; // Legge secret sessione da variabili d’ambiente.
if (!SESSION_SECRET) throw new Error("SESSION_SECRET mancante in .env"); // Fail-fast: senza secret la sessione non è sicura/valida.

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET; // Legge secret JWT da variabili d’ambiente.
if (!ACCESS_TOKEN_SECRET) throw new Error("ACCESS_TOKEN_SECRET mancante in .env"); // Fail-fast: senza secret non si possono firmare/verificare token.

const db = new Db(); // Crea l’unica istanza Db (pool MySQL condiviso).

const sessionManager = new SessionManager({ // Crea il gestore sessioni configurandolo con secret e flag secure.
  secret: SESSION_SECRET, // Imposta il segreto usato per firmare/cifrare i cookie di sessione.
  secure: String(process.env.SESSION_SECURE || "false").toLowerCase() === "true" // Decide se cookie secure (solo HTTPS) in base a env.
});

const jwtHandler = new JwtHandler(ACCESS_TOKEN_SECRET, { expiresIn: "1h" }); // Crea l’handler JWT con durata token predefinita.

// OAuthHandler: gli passiamo db così può creare/mappare l'utente OAuth su users(id)
const oauthHandler = new OAuthHandler({ db }); // Istanzia OAuth handler passando Db per lookup/creazione utente.
//---------------------------------------------------------------------------------------------------------------------------------------------------------
// Utility
//---------------------------------------------------------------------------------------------------------------------------------------------------------
/**
 * Estrae pathname senza query (?a=1).
 * @param {object} req
 * @returns {string}
 */
function getPathname(req) { // Helper: normalizza il path eliminando la querystring.
  return String(req.url || "/").split("?")[0] || "/"; // Converte url in stringa, separa su "?" e prende solo il pathname.
}
//---------------------------------------------------------------------------------------------------------------------------------------------------------
/**
 * Invia JSON se possibile (evita doppie risposte).
 * @param {object} res
 * @param {number} status
 * @param {any} obj
 * @returns {void}
 */
function sendJson(res, status, obj) { // Helper: invio JSON centralizzato e “safe”.
  if (res.headersSent || res.writableEnded) return; // Evita doppio invio: se headers già inviati o response chiusa esce.
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" }); // Imposta status code e content-type JSON UTF-8.
  res.end(JSON.stringify(obj)); // Serializza l’oggetto e termina la risposta.
}
//---------------------------------------------------------------------------------------------------------------------------------------------------------
// 1) Logging (semplice ma utile)
//---------------------------------------------------------------------------------------------------------------------------------------------------------
/**
 * Logger middleware.
 * @param {object} req
 * @param {object} res
 * @param {Function} next
 * @returns {Promise<void>}
 */
async function loggerMiddleware(req, res, next) { // Middleware: misura e logga richiesta/risposta.
  const t0 = Date.now(); // Timestamp iniziale per calcolare il tempo di gestione.
  const pathname = getPathname(req); // Estrae pathname “pulito” (senza query).

  logger.info(`[REQ] ${req.method} ${pathname}`); // Logga la richiesta in ingresso (metodo + path).

  await next(); // Passa il controllo al middleware successivo e aspetta che la catena completi.

  const ms = Date.now() - t0; // Calcola durata totale di gestione in millisecondi.
  logger.info(`[RES] ${req.method} ${pathname} headersSent=${res.headersSent} ended=${res.writableEnded} (${ms}ms)`); // Logga stato finale response.
}
//---------------------------------------------------------------------------------------------------------------------------------------------------------
// 2) CORS (solo per sviluppo con ng serve su 4200)
//---------------------------------------------------------------------------------------------------------------------------------------------------------
/**
 * CORS middleware.
 * In produzione (stesso origin) puoi anche disattivarlo.
 *
 * @param {object} req
 * @param {object} res
 * @param {Function} next
 * @returns {Promise<void>}
 */
async function corsMiddleware(req, res, next) { // Middleware: abilita CORS per origins consentite (dev).
  const origin = req.headers.origin; // Legge l’header Origin (presente nelle richieste cross-origin).
  const allowed = (process.env.CORS_ORIGINS || "http://localhost:4200") // Prende la whitelist origins da env, fallback a Angular dev server.
    .split(",") // Permette più origins separati da virgola.
    .map(s => s.trim()) // Rimuove spazi inutili.
    .filter(Boolean); // Elimina stringhe vuote (robustezza parsing).

  if (origin && allowed.includes(origin)) { // Applica CORS solo se origin esiste ed è nella whitelist.
    res.setHeader("Access-Control-Allow-Origin", origin); // Consente l’origin specifico (non "*", così supporta credenziali).
    res.setHeader("Vary", "Origin"); // Indica ai cache che la risposta varia in base all’Origin.
    res.setHeader("Access-Control-Allow-Credentials", "true"); // Permette cookie/credenziali cross-origin.
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization"); // Consente header tipici per JSON e Bearer token.
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS"); // Consente metodi usati dall’app.
  }

  if (req.method === "OPTIONS") { // Intercetta le richieste preflight CORS.
    // Preflight: risposta vuota e stop.
    if (!res.headersSent) res.writeHead(204); // Risponde “No Content” se non sono già stati inviati header.
    res.end(); // Termina subito la response (il preflight non deve proseguire nella pipeline).
    return; // Stop esplicito: non si chiama next() dopo un preflight gestito.
  }

  await next(); // Prosegue nella pipeline se non è preflight.
}
//---------------------------------------------------------------------------------------------------------------------------------------------------------
// 3) JSON body parser (mini)
//---------------------------------------------------------------------------------------------------------------------------------------------------------
/**
 * Legge il body della request come stringa.
 * @param {object} req
 * @returns {Promise<string>}
 */
function readBody(req) { // Helper: accumula chunk e restituisce il body completo come stringa.
  return new Promise((resolve, reject) => { // Wrappa la lettura eventi stream in una Promise.
    let data = ""; // Buffer stringa dove accumulare i chunk.
    req.on("data", chunk => (data += chunk)); // Appende ogni chunk ricevuto dallo stream request.
    req.on("end", () => resolve(data)); // A fine stream risolve con il body completo.
    req.on("error", reject); // Propaga errori di stream tramite reject.
  });
}
//---------------------------------------------------------------------------------------------------------------------------------------------------------
/**
 * jsonBodyMiddleware
 * - imposta req.body (oggetto) se Content-Type è application/json.
 * - se non è JSON, imposta req.body = {} (evita undefined).
 *
 * @param {object} req
 * @param {object} res
 * @param {Function} next
 * @returns {Promise<void>}
 */
async function jsonBodyMiddleware(req, res, next) { // Middleware: parse JSON body quando opportuno.
  const ct = String(req.headers["content-type"] || ""); // Normalizza content-type a stringa (mai undefined).
  const wantsJson = ct.includes("application/json"); // Determina se il client dichiara JSON.
  const canHaveBody = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method); // Stabilisce quali metodi possono avere body.

  req.body = {}; // Inizializza sempre req.body per evitare undefined downstream.

  if (canHaveBody && wantsJson) { // Parsifica solo se il metodo può avere body e il content-type è JSON.
    try { // Isola parse errors e lettura body.
      const raw = await readBody(req); // Legge body completo come stringa.
      if (raw && raw.trim().length) req.body = JSON.parse(raw); // Se non è vuoto, effettua parse JSON e assegna a req.body.
    } catch (e) { // Cattura JSON.parse error o errori stream.
      sendJson(res, 400, { error: "JSON non valido" }); // Risponde 400: input non parseabile come JSON.
      return; // Stop pipeline: richiesta malformata.
    }
  }

  await next(); // Prosegue nella pipeline con req.body impostato.
}
//---------------------------------------------------------------------------------------------------------------------------------------------------------
// 4) Session middleware (client-sessions)
//---------------------------------------------------------------------------------------------------------------------------------------------------------
/**
 * sessionMiddleware
 * @param {object} req
 * @param {object} res
 * @param {Function} next
 * @returns {Promise<void>}
 */
async function sessionMiddleware(req, res, next) { // Middleware: applica sessioni (cookie) alla request/response.
  const mw = sessionManager.getMiddleware(); // Recupera la funzione middleware “callback style”.
  // client-sessions è un middleware "callback style": lo wrappiamo in Promise.
  await new Promise((resolve, reject) => { // Converte callback(err) in Promise per usare await.
    mw(req, res, (err) => (err ? reject(err) : resolve())); // Esegue il middleware session e risolve/rifiuta in base a err.
  });
  await next(); // Prosegue con req.session disponibile.
}
//---------------------------------------------------------------------------------------------------------------------------------------------------------
// 5) Auth context: session OR jwt (non protegge, solo "riconosce")
//---------------------------------------------------------------------------------------------------------------------------------------------------------
/**
 * authContextMiddleware
 * - se c'è req.session.user => autentica via cookie (session / oauth)
 * - altrimenti, se c'è Authorization: Bearer ... => verifica JWT e mette req.user
 *
 * @param {object} req
 * @param {object} res
 * @param {Function} next
 * @returns {Promise<void>}
 */
async function authContextMiddleware(req, res, next) { // Middleware: riconosce l’utente da session o JWT e popola req.user.
  req.auth = null; // Inizializza contesto auth (evita residui o undefined).
  req.user = null; // Inizializza utente corrente (nessun utente finché non autenticato).

  if (req.session?.user) { // Prima priorità: sessione già presente (cookie).
    req.auth = { mode: req.session.authMode || "session", user: req.session.user }; // Salva meta-info di autenticazione.
    req.user = req.session.user; // Espone l’utente in modo uniforme per i listener/route.
    await next(); // Prosegue: utente già determinato.
    return; // Stop qui: non serve controllare header Authorization.
  }

  const authHeader = String(req.headers.authorization || ""); // Legge Authorization in modo robusto.
  if (authHeader.startsWith("Bearer ")) { // Controlla schema Bearer per token JWT.
    const token = authHeader.slice(7).trim(); // Estrae il token rimuovendo "Bearer " e spazi.
    try { // Protegge verify da eccezioni (token scaduto, firma errata, ecc.).
      const payload = jwtHandler.verifyToken(token); // Verifica firma/scadenza e ottiene payload.
      req.auth = { mode: "jwt", user: payload }; // Salva meta-info: modalità jwt e payload come user.
      req.user = payload; // Espone payload come utente “corrente” per le route.
    } catch (e) { // Gestisce token invalido o scaduto.
      sendJson(res, 401, { error: "JWT non valido o scaduto" }); // Risponde 401: autenticazione fallita.
      return; // Stop pipeline: richiesta non autenticata via JWT.
    }
  }

  await next(); // Prosegue: autenticato (req.user valorizzato) oppure anonimo (req.user null).
}
//---------------------------------------------------------------------------------------------------------------------------------------------------------
// 6) OAuth routes "centralizzate" nel middleware (terminale)
//---------------------------------------------------------------------------------------------------------------------------------------------------------
/**
 * oauthRoutesMiddleware
 * Intercetta SOLO GET /oauth/*
 *
 * @param {object} req
 * @param {object} res
 * @param {Function} next
 * @returns {Promise<void>}
 */
async function oauthRoutesMiddleware(req, res, next) { // Middleware: intercetta rotte OAuth e termina la response (non chiama next).
  const pathname = getPathname(req); // Estrae pathname senza querystring.

  if (req.method !== "GET" || !pathname.startsWith("/oauth/")) { // Filtra: solo GET e solo path OAuth.
    await next(); // Se non è OAuth, lascia passare.
    return; // Stop qui: questo middleware non gestisce la request.
  }

  logger.info(`[OAUTH] intercepted ${req.method} ${pathname}`); // Logga l’intercetto OAuth per debug/tracing.

  switch (pathname) { // Dispatch in base alla route OAuth.
    case "/oauth/login": // Endpoint che avvia il flow OAuth.
      return oauthHandler.authenticate(req, res); // Delego all’OAuthHandler (termina response).

    case "/oauth/callback": // Endpoint di callback dopo autorizzazione provider.
      return oauthHandler.handleCallback(req, res); // Gestisce callback (termina response).

    case "/oauth/profile": // Endpoint che restituisce profilo OAuth corrente.
      return oauthHandler.getProfile(req, res); // Recupera profilo (termina response).

    case "/oauth/logout": // Endpoint logout OAuth/sessione associata.
      return oauthHandler.logout(req, res); // Esegue logout (termina response).

    default: // Qualsiasi altra route /oauth/* non prevista.
      sendJson(res, 404, { error: "OAuth route non prevista" }); // Risponde 404: endpoint inesistente.
      return; // Stop: response inviata.
  }
}
//---------------------------------------------------------------------------------------------------------------------------------------------------------
// 7) Protezione dati riservati (accetta session OR jwt)
//---------------------------------------------------------------------------------------------------------------------------------------------------------
/**
 * protectPrivateDataMiddleware
 * Protegge /db/private/*: serve autenticazione (session o jwt).
 *
 * @param {object} req
 * @param {object} res
 * @param {Function} next
 * @returns {Promise<void>}
 */
async function protectPrivateDataMiddleware(req, res, next) { // Middleware: blocca l’accesso ai path privati se non autenticato.
  const pathname = getPathname(req); // Estrae pathname senza querystring.

  if (!pathname.startsWith("/db/private/")) { // Applica protezione solo ai path che iniziano con /db/private/.
    await next(); // Se non è un path privato, lascia passare.
    return; // Stop qui: questo middleware non gestisce la request.
  }

  if (!req.auth || !req.user) { // Verifica che authContext abbia riconosciuto un utente (session o JWT).
    sendJson(res, 401, { error: "Non autenticato" }); // Risponde 401: serve login/token valido.
    return; // Stop pipeline: accesso negato.
  }

  await next(); // Prosegue: utente autenticato.
}
//---------------------------------------------------------------------------------------------------------------------------------------------------------
// Export: ordine importante
//---------------------------------------------------------------------------------------------------------------------------------------------------------
module.exports = [ // Esporta l’array dei middleware: l’ordine definisce la pipeline di esecuzione.
  loggerMiddleware, // 1) logging: misura e logga richieste/risposte.
  corsMiddleware, // 2) CORS: permette richieste cross-origin in dev.
  jsonBodyMiddleware, // 3) JSON body parser: popola req.body.
  sessionMiddleware, // 4) session: popola req.session da cookie.
  authContextMiddleware, // 5) auth context: popola req.user da session o JWT.
  oauthRoutesMiddleware, // 6) OAuth routes: intercetta e termina /oauth/*.
  protectPrivateDataMiddleware // 7) protect private: blocca /db/private/* se non autenticato.
]; // Chiude l’export dell’array pipeline.
//---------------------------------------------------------------------------------------------------------------------------------------------------------
// Export “di servizio” per i listener (Db/Jwt)
//---------------------------------------------------------------------------------------------------------------------------------------------------------
module.exports.db = db; // Espone l’istanza Db condivisa per evitare nuove connessioni altrove.
module.exports.jwtHandler = jwtHandler; // Espone l’istanza JwtHandler condivisa (stesso secret/config).
