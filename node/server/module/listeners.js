//---------------------------------------------------------------------------------------------------------------------------------------------------------
/**
 * listeners.js
 * 
 * Registra le rotte "API" sul Router.
 *
 * Obiettivo laboratorio:
 * - 3 modalità di autenticazione (session, jwt, oauth)
 * - endpoint pubblici (dati "puliti")
 * - endpoint privati (dati sensibili) protetti da auth
 */
//---------------------------------------------------------------------------------------------------------------------------------------------------------
"use strict"; // Attiva strict mode: evita errori silenziosi e comportamenti ambigui.
//---------------------------------------------------------------------------------------------------------------------------------------------------------
const FileLogger = require("./FileLogger"); // Importa il logger su file per tracciare eventi e debug.
// Importiamo istanze condivise da middleware.js (evita 2 pool DB e 2 jwtHandler diversi).
const middlewares = require("./middleware"); // Carica il modulo middleware che espone istanze condivise (db, jwtHandler, ecc.).
//---------------------------------------------------------------------------------------------------------------------------------------------------------
const db = middlewares.db; // Estrae l’istanza DB condivisa (evita duplicazioni di pool/connessioni).
const jwtHandler = middlewares.jwtHandler; // Estrae l’istanza JWT condivisa (coerenza su secret/expires).
const logger = new FileLogger("./log/listeners.log"); // Crea un logger dedicato alla registrazione delle route.
//---------------------------------------------------------------------------------------------------------------------------------------------------------
/**
 * Invia JSON in modo sicuro (evita doppie risposte).
 * @param {object} res
 * @param {number} status
 * @param {any} obj
 * @returns {void}
 */
function sendJson(res, status, obj) { // Helper: invio JSON centralizzato e “safe”.
  if (res.headersSent || res.writableEnded) return; // Evita doppie risposte: se la response è già partita/chiusa esce.
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" }); // Imposta status e content-type JSON UTF-8.
  res.end(JSON.stringify(obj)); // Serializza l’oggetto e chiude la risposta HTTP.
}
//---------------------------------------------------------------------------------------------------------------------------------------------------------
/**
 * Sanitizza l'utente (evita di restituire info inutili/sensibili).
 * @param {any} u
 * @returns {any|null}
 */
function safeUser(u) { // Helper: riduce l’oggetto utente ai soli campi utili/consentiti.
  if (!u) return null; // Se l’utente è null/undefined, ritorna null (nessun dato).
  return { // Costruisce un oggetto “pulito” senza campi sensibili o superflui.
    id: u.id, // Mantiene l’identificativo (utile per riferimenti e autorizzazioni).
    username: u.username, // Mantiene lo username (identità applicativa).
    displayName: u.displayName ?? u.display_name, // Normalizza displayName gestendo entrambe le convenzioni di naming.
    role: u.role, // Mantiene il ruolo (serve per autorizzazione lato server/client).
    email: u.email, // Mantiene l’email (utile in profilo/contatti; valutare privacy in contesti reali).
    picture: u.picture // Mantiene eventuale avatar/immagine profilo (tipico in OAuth).
  };
}
//---------------------------------------------------------------------------------------------------------------------------------------------------------
/**
 * Determina se un ruolo può vedere "tutti" i dati riservati.
 * @param {string} role
 * @returns {boolean}
 */
function isStaff(role) { // Helper: controlla se il ruolo è “privilegiato”.
  return role === "admin" || role === "teacher"; // Ritorna true per admin/teacher, false per altri ruoli.
}
//---------------------------------------------------------------------------------------------------------------------------------------------------------
/**
 * Registra le rotte sul Router.
 * @param {import("./Router")} router
 * @returns {void}
 */
function registerListeners(router) { // Entry-point: collega gli endpoint API al router.
//---------------------------------------------------------------------------------------------------------------------------------------------------------
// Healthcheck
//---------------------------------------------------------------------------------------------------------------------------------------------------------
  /**
   * Handler: GET /health
   * @param {any} req
   * @param {any} res
   * @returns {Promise<void>}
   */
  router.register("GET", "/health", async (req, res) => { // Registra endpoint di healthcheck (sempre pubblico).
    sendJson(res, 200, { ok: true, time: new Date().toISOString() }); // Risponde con OK e timestamp ISO.
  });
//--------------------------------------------------------------------------------------------------------------------------------------------------------
// Auth: info session/jwt corrente
//---------------------------------------------------------------------------------------------------------------------------------------------------------
  /**
   * Handler: GET /auth/me
   * @param {any} req
   * @param {any} res
   * @returns {Promise<void>}
   */
  router.register("GET", "/auth/me", async (req, res) => { // Registra endpoint che descrive lo stato auth corrente.
    const authenticated = !!req.user; // Converte req.user in booleano per sapere se è autenticato.
    sendJson(res, 200, { // Invia al client un payload diagnostico (utile per UI).
      authenticated, // Espone se l’utente è autenticato o meno.
      mode: req.auth?.mode ?? null, // Espone la modalità di auth (session/jwt/oauth) se presente.
      user: authenticated ? safeUser(req.user) : null // Espone utente sanitizzato solo se autenticato.
    });
  });
//---------------------------------------------------------------------------------------------------------------------------------------------------------
// SESSION login
// POST /session/login { username, password }
//---------------------------------------------------------------------------------------------------------------------------------------------------------
  /**
   * Handler: POST /session/login
   * @param {any} req
   * @param {any} res
   * @returns {Promise<void>}
   */
  router.register("POST", "/session/login", async (req, res) => { // Registra login via sessione (demo didattica).
    const { username, password } = req.body || {}; // Estrae username/password dal body (con fallback a {}).

    if (!username || !password) { // Valida input: entrambi i campi devono esserci.
      sendJson(res, 400, { error: "username e password obbligatori" }); // Risponde 400: richiesta malformata.
      return; // Interrompe l’handler per evitare prosecuzione.
    }

    // Password demo (didattica): "password"
    if (password !== "password") { // Controlla credenziali: password fissa per esercizio.
      sendJson(res, 401, { error: "Credenziali non valide" }); // Risponde 401: non autorizzato.
      return; // Interrompe l’handler.
    }

    const u = await db.getUserByUsername(String(username)); // Recupera utente dal DB usando username come stringa.
    if (!u) { // Se non esiste in DB, login non può completarsi.
      sendJson(res, 404, { error: "Utente non trovato nel DB" }); // Risponde 404: risorsa (utente) non trovata.
      return; // Interrompe l’handler.
    }

    if (!req.session) { // Verifica che il middleware session sia attivo e abbia popolato req.session.
      sendJson(res, 500, { error: "Session middleware non configurato" }); // Risponde 500: configurazione server mancante.
      return; // Interrompe l’handler.
    }

    req.session.user = { // Scrive nella sessione i dati utente necessari (persistono tra richieste).
      id: u.id, // Salva id per riferimenti e autorizzazione.
      username: u.username, // Salva username per UI/identità.
      displayName: u.display_name, // Salva displayName (qui dal DB con naming snake_case).
      role: u.role, // Salva ruolo per controlli autorizzativi.
      email: u.email // Salva email (profilo).
    };
    req.session.authMode = "session"; // Marca la sessione indicando la modalità di autenticazione.

    sendJson(res, 200, { ok: true, mode: "session", user: safeUser(req.session.user) }); // Risponde OK con utente sanitizzato.
  });
//---------------------------------------------------------------------------------------------------------------------------------------------------------
// POST /session/logout
//---------------------------------------------------------------------------------------------------------------------------------------------------------
  /**
   * Handler: POST /session/logout
   * @param {any} req
   * @param {any} res
   * @returns {Promise<void>}
   */
  router.register("POST", "/session/logout", async (req, res) => { // Registra logout session-based.
    if (req.session) req.session.reset(); // Se esiste una sessione, la resetta (logout effettivo).
    sendJson(res, 200, { ok: true }); // Risponde OK per confermare logout.
  });
//---------------------------------------------------------------------------------------------------------------------------------------------------------
// JWT login (demo)
// POST /jwt/login { username, password } -> { token, user }
// ---------------------------------------------------------------------------
  /**
   * Handler: POST /jwt/login
   * @param {any} req
   * @param {any} res
   * @returns {Promise<void>}
   */
  router.register("POST", "/jwt/login", async (req, res) => { // Registra login via JWT (demo didattica).
    const { username, password } = req.body || {}; // Estrae username/password dal body (con fallback a {}).

    if (req.session) req.session.reset(); // Se esiste sessione, la azzera per evitare “mischiare” session e JWT.
    
    if (!username || !password) { // Valida input: entrambi obbligatori.
      sendJson(res, 400, { error: "username e password obbligatori" }); // Risponde 400: richiesta incompleta.
      return; // Interrompe l’handler.
    }

    if (password !== "password") { // Password fissa per demo (non usare in produzione).
      sendJson(res, 401, { error: "Credenziali non valide" }); // Risponde 401: credenziali errate.
      return; // Interrompe l’handler.
    }

    const u = await db.getUserByUsername(String(username)); // Recupera utente dal DB in base allo username.
    if (!u) { // Se utente non esiste, non si può generare token.
      sendJson(res, 404, { error: "Utente non trovato nel DB" }); // Risponde 404: utente inesistente.
      return; // Interrompe l’handler.
    }

    // Payload JWT "minimo": quello che ti serve per autorizzare.
    const payload = { // Prepara payload essenziale: dati minimi per autorizzazione lato server.
      id: u.id, // Inserisce id utente nel token.
      username: u.username, // Inserisce username nel token.
      displayName: u.display_name, // Inserisce displayName nel token (dal DB).
      role: u.role // Inserisce ruolo nel token (base per RBAC).
    };

    const token = jwtHandler.generateToken(payload); // Genera un JWT firmato usando l’handler centralizzato.

    sendJson(res, 200, { ok: true, mode: "jwt", token, user: safeUser(payload) }); // Risponde con token e user sanitizzato.
  });

//---------------------------------------------------------------------------------------------------------------------------------------------------------
// DB: PUBBLICO (nessuna auth)
//---------------------------------------------------------------------------------------------------------------------------------------------------------
  /**
   * Handler: GET /db/public/users
   * @param {any} req
   * @param {any} res
   * @returns {Promise<void>}
   */
  router.register("GET", "/db/public/users", async (req, res) => { // Registra endpoint pubblico: lista utenti “pulita”.
    const rows = await db.listPublicUsers(); // Legge dal DB la view/risorsa pubblica degli utenti.
    sendJson(res, 200, rows); // Invia al client l’elenco utenti pubblici.
  });
//---------------------------------------------------------------------------------------------------------------------------------------------------------
  /**
   * Handler: GET /db/public/user?id=...
   * @param {any} req
   * @param {any} res
   * @returns {Promise<void>}
   */
  router.register("GET", "/db/public/user", async (req, res) => { // Registra endpoint pubblico: dettaglio utente per id.
    const id = Number(req.query?.id); // Converte il parametro query id in numero.
    if (!Number.isFinite(id) || id <= 0) { // Valida che id sia un numero finito e positivo.
      sendJson(res, 400, { error: "Parametro query id non valido" }); // Risponde 400 se id è errato.
      return; // Interrompe l’handler.
    }
    const user = await db.getPublicUserById(id); // Recupera l’utente pubblico dal DB in base all’id.
    if (!user) { // Se non esiste, restituisce 404.
      sendJson(res, 404, { error: "Utente non trovato" }); // Risponde 404: utente inesistente.
      return; // Interrompe l’handler.
    }
    sendJson(res, 200, user); // Invia l’oggetto utente pubblico.
  });
//---------------------------------------------------------------------------------------------------------------------------------------------------------
  // DB: PRIVATO (protetto da middleware: /db/private/* richiede auth)
  // - staff (admin/teacher): vede tutto
  // - student: vede solo se stesso + i suoi documenti
//---------------------------------------------------------------------------------------------------------------------------------------------------------
  /**
   * Handler: GET /db/private/users
   * @param {any} req
   * @param {any} res
   * @returns {Promise<void>}
   */
  router.register("GET", "/db/private/users", async (req, res) => { // Registra endpoint privato: lista utenti (con RBAC).
    const role = req.user?.role; // Legge il ruolo dell’utente autenticato (popolato dal middleware auth).
    if (isStaff(role)) { // Se staff, può vedere tutti gli utenti privati.
      const rows = await db.listPrivateUsers(); // Legge lista completa utenti (incl. campi riservati).
      sendJson(res, 200, rows); // Invia l’elenco completo.
      return; // Interrompe qui: ramo staff già gestito.
    }

    // studente: restituiamo lista con solo "me"
    const me = await db.getPrivateUserById(Number(req.user.id)); // Per student, recupera solo il proprio record completo.
    sendJson(res, 200, me ? [me] : []); // Risponde con array: [me] oppure [] se non trovato.
  });

  /**
   * Handler: GET /db/private/user?id=... (opzionale)
   * @param {any} req
   * @param {any} res
   * @returns {Promise<void>}
   */
  router.register("GET", "/db/private/user", async (req, res) => { // Registra endpoint privato: dettaglio utente (con RBAC).
    const requestedId = req.query?.id ? Number(req.query.id) : Number(req.user.id); // Usa id query se presente, altrimenti id dell’utente.
    if (!Number.isFinite(requestedId) || requestedId <= 0) { // Valida id richiesto: numero finito e positivo.
      sendJson(res, 400, { error: "Parametro query id non valido" }); // Risponde 400 se id non valido.
      return; // Interrompe l’handler.
    }

    const role = req.user?.role; // Legge il ruolo dell’utente autenticato.
    if (!isStaff(role) && requestedId !== Number(req.user.id)) { // Se non staff, può chiedere solo il proprio profilo.
      sendJson(res, 403, { error: "Non autorizzato: puoi vedere solo il tuo profilo" }); // Risponde 403: accesso negato.
      return; // Interrompe l’handler.
    }

    const u = await db.getPrivateUserById(requestedId); // Recupera utente privato dal DB con l’id richiesto.
    if (!u) { // Se l’utente non esiste, restituisce 404.
      sendJson(res, 404, { error: "Utente non trovato" }); // Risponde 404.
      return; // Interrompe l’handler.
    }

    sendJson(res, 200, u); // Invia l’utente privato completo al client.
  });
//---------------------------------------------------------------------------------------------------------------------------------------------------------
  /**
   * Handler: GET /db/private/docs
   * @param {any} req
   * @param {any} res
   * @returns {Promise<void>}
   */
  router.register("GET", "/db/private/docs", async (req, res) => { // Registra endpoint privato: documenti (con RBAC).
    const role = req.user?.role; // Legge ruolo corrente.
    const owner = isStaff(role) ? null : Number(req.user.id); // Staff vede tutti (null), student vede solo i propri (id).
    const docs = await db.listPrivateDocs(owner); // Recupera documenti dal DB filtrando per owner se necessario.
    sendJson(res, 200, docs); // Invia la lista documenti al client.
  });

  logger.info("Listeners registered"); // Logga che la registrazione delle route è stata completata.
}
//---------------------------------------------------------------------------------------------------------------------------------------------------------
module.exports = registerListeners; // Esporta la funzione di registrazione per essere richiamata dal bootstrap del server.
//---------------------------------------------------------------------------------------------------------------------------------------------------------
