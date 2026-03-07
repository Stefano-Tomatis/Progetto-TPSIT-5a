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
const bcrypt = require("bcrypt")
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
    id: u.IdUtente, // Mantiene l’identificativo (utile per riferimenti e autorizzazioni).
    username: u.Username, // Mantiene lo username (identità applicativa).
    nome: u.Nome, // Normalizza displayName gestendo entrambe le convenzioni di naming.
    cognome: u.Cognome, // Mantiene il ruolo (serve per autorizzazione lato server/client).
    dataNascita: u.DataNascita, // Mantiene l’email (utile in profilo/contatti; valutare privacy in contesti reali).
    email: u.email, // Mantiene eventuale avatar/immagine profilo (tipico in OAuth).
    ruolo: u.ruolo
  };
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
  router.register("POST", "/session/login/user", async (req, res) => { // Registra login via sessione (demo didattica).
    const { email, password } = req.body || {}; // Estrae username/password dal body (con fallback a {}).

    if (!email || !password) { // Valida input: entrambi i campi devono esserci.
      sendJson(res, 400, { success: false, message: "Richiesta malformata" }); // Risponde 400: richiesta malformata.
      return; // Interrompe l’handler per evitare prosecuzione.
    }

    const u = await db.getUserByEmail(String(email)); // Recupera utente dal DB usando username come stringa.
    if (!u) { // Se non esiste in DB, login non può completarsi.
      sendJson(res, 404, { success: false, message: "Utente non esistente" }); // Risponde 404: risorsa (utente) non trovata.
      return; // Interrompe l’handler.
    }

    // Password demo (didattica): "password"
    if (password !== await bcrypt.compare(password, u.Pwd)) { // Controlla credenziali: password fissa per esercizio.
      sendJson(res, 401, { success: false, message: "Password errata" }); // Risponde 401: non autorizzato.
      return; // Interrompe l’handler.
    }

    if (!req.session) { // Verifica che il middleware session sia attivo e abbia popolato req.session.
      sendJson(res, 500, { success: false, message: "Errore inizializzazione sessione" }); // Risponde 500: configurazione server mancante.
      return; // Interrompe l’handler.
    }

    req.session.user = { // Scrive nella sessione i dati utente necessari (persistono tra richieste).
      id: u.IdUtente, // Salva id per riferimenti e autorizzazione.
      nome: u.Nome, // Salva username per UI/identità.
      cognome: u.Cognome, // Salva displayName (qui dal DB con naming snake_case).
      email: u.email, // Salva ruolo per controlli autorizzativi.
      dataNascita: u.DataNascita, // Salva email (profilo).
      username: u.Username,
      ruolo: "utente"
    };
    req.session.authMode = "session"; // Marca la sessione indicando la modalità di autenticazione.

    sendJson(res, 200, { 
        success: true, message: "Login effettuato", data: {
          user: safeUser(req.session.user)
      }
    }); // Risponde OK con utente sanitizzato.
  });

  router.register("POST", "/session/login/doctor", async (req, res) => { // Registra login via sessione (demo didattica).
    const { email, password } = req.body || {}; // Estrae username/password dal body (con fallback a {}).

    if (!email || !password) { // Valida input: entrambi i campi devono esserci.
      sendJson(res, 400, { success: false, message: "Richiesta malformata" }); // Risponde 400: richiesta malformata.
      return; // Interrompe l’handler per evitare prosecuzione.
    }

    const u = await db.getDoctorByEmail(String(email)); // Recupera utente dal DB usando username come stringa.
    if (!u) { // Se non esiste in DB, login non può completarsi.
      sendJson(res, 404, { success: false, message: "Utente non esistente" }); // Risponde 404: risorsa (utente) non trovata.
      return; // Interrompe l’handler.
    }

    // Password demo (didattica): "password"
    if (password !== await bcrypt.compare(password, u.Pwd)) { // Controlla credenziali: password fissa per esercizio.
      sendJson(res, 401, { success: false, message: "Password errata" }); // Risponde 401: non autorizzato.
      return; // Interrompe l’handler.
    }

    if (!req.session) { // Verifica che il middleware session sia attivo e abbia popolato req.session.
      sendJson(res, 500, { success: false, message: "Errore inizializzazione sessione" }); // Risponde 500: configurazione server mancante.
      return; // Interrompe l’handler.
    }

    req.session.user = { // Scrive nella sessione i dati utente necessari (persistono tra richieste).
      id: u.IdUtente, // Salva id per riferimenti e autorizzazione.
      nome: u.Nome, // Salva username per UI/identità.
      cognome: u.Cognome, // Salva displayName (qui dal DB con naming snake_case).
      email: u.email, // Salva ruolo per controlli autorizzativi.
      dataNascita: u.DataNascita, // Salva email (profilo).
      username: u.Username,
      ruolo: "medico"
    };
    req.session.authMode = "session"; // Marca la sessione indicando la modalità di autenticazione.

    sendJson(res, 200, { 
        success: true, message: "Login effettuato", data: {
          user: safeUser(req.session.user)
      }
    }); // Risponde OK con utente sanitizzato.
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
    sendJson(res, 200, { success: true, message: "Logout effettuato" }); // Risponde OK per confermare logout.
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
  router.register("GET", "/db/private/users", async (req, res) => { // Ottenimento tutti gli utenti
    const rows = await db.getAllUsers();
    sendJson(res, 200, { success: true, message: "ok", data: rows });
  });

  router.register("GET", "/db/private/doctors", async (req, res) => { // Ottenimento tutti i dottori
    const rows = await db.getAllDoctors();
    sendJson(res, 200, { success: true, message: "ok", data: rows });
  });

  router.register("GET", "/db/private/visits/user", async (req, res) => { // Ottenimento visite per utenti
    try{
      const dateStart = Date(req.query.dateStart)
      const dateEnd = Date(req.query.dateEnd)
      if(req.session.user.ruolo != "utente"){
        sendJson(res, 403, { success: false, message: "Richiesta non consentita"});
      }
      const rows = await db.getVisitsByUser(dateStart, dateEnd, req.session.user.id); 
      sendJson(res, 200, { success: true, message: "ok", data: rows });
    }
    catch(err){
      sendJson(res, 500, { success: false, message: "Errore interno del server"});
    }
  });

  router.register("GET", "/db/private/visits/doctor", async (req, res) => { //Ottenimento visite per dottori
    try{
      const dateStart = Date(req.query.dateStart)
      const dateEnd = Date(req.query.dateEnd)
      if(req.session.user.ruolo != "medico"){
        sendJson(res, 403, { success: false, message: "Richiesta non consentita"});
      }
      const rows = await db.getVisitsByDoctor(dateStart, dateEnd, req.session.user.id); 
      sendJson(res, 200, { success: true, message: "ok", data: rows }); 
    }
    catch(err){
      sendJson(res, 500, { success: false, message: "Errore interno del server"}); 
    }
  });

  router.register("GET", "/db/private/specs", async (req, res) => { // Ottenimento di tutte le specs
    const rows = await db.getAllSpecs();
    sendJson(res, 200, { success: true, message: "ok", data: rows });
  })

  router.register("GET", "/db/private/doctors/spec", async (req, res) => { //Ottenimento dottori per nome specializzazione
    try{
      const specName = Date(req.query.specName)
      if(req.session.user.ruolo != "utente"){
        sendJson(res, 403, { success: false, message: "Richiesta non consentita"});
      }
      const rows = await db.getDoctorsBySpecName(specName); 
      sendJson(res, 200, { success: true, message: "ok", data: rows }); 
    }
    catch(err){
      sendJson(res, 500, { success: false, message: "Errore interno del server"}); 
    }
  });


  logger.info("Listeners registered"); // Logga che la registrazione delle route è stata completata.
}
//---------------------------------------------------------------------------------------------------------------------------------------------------------
module.exports = registerListeners; // Esporta la funzione di registrazione per essere richiamata dal bootstrap del server.
//---------------------------------------------------------------------------------------------------------------------------------------------------------
