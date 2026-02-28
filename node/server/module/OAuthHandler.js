//------------------------------------------------------------------------------------------------------------------------------------------------
/**
 * OAuthHandler
 * -----------------------------------------------------------------------------
 * Gestisce un login Google (OAuth 2.0 + OpenID Connect) lato backend.
 *
 * Idea didattica:
 * - Il frontend NON parla con Google.
 * - Il browser viene solo "reindirizzato" su Google e poi torna su /oauth/callback.
 * - Dopo il login, sul backend creiamo una sessione applicativa (cookie) e basta.
 */
//------------------------------------------------------------------------------------------------------------------------------------------------
"use strict"; // Abilita strict mode: previene errori silenziosi e comportamenti ambigui.
//------------------------------------------------------------------------------------------------------------------------------------------------
const { URL, URLSearchParams } = require("url"); // Importa costruttori URL e parser querystring (SearchParams).
const { OAuth2Client } = require("google-auth-library"); // Importa il client OAuth2 ufficiale per Google (token + verify).
const FileLogger = require("./FileLogger"); // Importa logger su file per tracciare il flow OAuth.
const { performance } = require("perf_hooks"); // Importa misurazioni ad alta precisione (performance.now()).
const crypto = require("crypto"); // Importa crypto per generare state/nonce random (anti-CSRF/anti-replay).
//------------------------------------------------------------------------------------------------------------------------------------------------
const logger = new FileLogger("./log/oauth.log"); // Crea un logger dedicato alle operazioni OAuth.
//------------------------------------------------------------------------------------------------------------------------------------------------
class OAuthHandler { // Definisce un handler OAuth che espone metodi per /oauth/login, /oauth/callback, ecc.
  /**
   * @param {object} [opt]
   * @param {import("./Db")} [opt.db] Db (opzionale) per creare/mappare l'utente OAuth su un utente locale.
   */
  constructor({ db } = {}) { // Costruttore: valida env, crea client OAuth2 e salva riferimento al DB (opzionale).
    this._requireEnv("GOOGLE_CLIENT_ID"); // Verifica presenza di GOOGLE_CLIENT_ID (necessario per OAuth/OIDC).
    this._requireEnv("GOOGLE_CLIENT_SECRET"); // Verifica presenza di GOOGLE_CLIENT_SECRET (necessario per scambio code->token).
    this._requireEnv("GOOGLE_REDIRECT_URI"); // Verifica presenza di GOOGLE_REDIRECT_URI (callback registrata su Google).

    this.client = new OAuth2Client( // Crea un client OAuth2 configurato con le credenziali e la redirect URI.
      process.env.GOOGLE_CLIENT_ID, // Client ID Google (identifica l'app).
      process.env.GOOGLE_CLIENT_SECRET, // Client secret Google (autentica l'app al token endpoint).
      process.env.GOOGLE_REDIRECT_URI // Redirect URI (deve combaciare con quella configurata in Console).
    );

    this.db = db || null; // Salva Db se passato, altrimenti null (flow OAuth può funzionare anche senza mappatura locale).
  }

//------------------------------------------------------------------------------------------------------------------------------------------------
// Helper "safe send": evita doppie risposte (tipico errore quando la pipeline continua)
//------------------------------------------------------------------------------------------------------------------------------------------------
  /**
   * @param {object} res
   * @returns {boolean} true se NON è più lecito scrivere (già inviato/chiuso)
   */
  _alreadyReplied(res) { // Helper: controlla se la response è già stata inviata o chiusa.
    return !!(res.headersSent || res.writableEnded); // Ritorna true se headers già inviati o stream risposta terminato.
  }
//------------------------------------------------------------------------------------------------------------------------------------------------
  /**
   * @param {object} res
   * @param {number} status
   * @param {string} text
   * @returns {void}
   */
  _sendText(res, status, text) { // Helper: invia testo plain in modo sicuro (no doppia risposta).
    if (this._alreadyReplied(res)) return; // Se non è più lecito scrivere, esce senza fare nulla.
    res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" }); // Imposta status e content-type testuale UTF-8.
    res.end(text); // Invia body testuale e chiude la response.
  }
//------------------------------------------------------------------------------------------------------------------------------------------------
  /**
   * @param {object} res
   * @param {number} status
   * @param {any} obj
   * @returns {void}
   */
  _sendJson(res, status, obj) { // Helper: invia JSON in modo sicuro (no doppia risposta).
    if (this._alreadyReplied(res)) return; // Se la response è già partita/chiusa, evita doppio invio.
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" }); // Imposta status e header per JSON UTF-8.
    res.end(JSON.stringify(obj)); // Serializza oggetto e termina la response.
  }
//------------------------------------------------------------------------------------------------------------------------------------------------
  /**
   * @param {object} res
   * @param {string} location
   * @returns {void}
   */
  _redirect(res, location) { // Helper: redirect HTTP 302 verso un'altra URL.
    if (this._alreadyReplied(res)) return; // Evita redirect se la response è già stata inviata/chiusa.
    res.writeHead(302, { Location: location }); // Imposta status 302 e header Location.
    res.end(); // Chiude la response senza body.
  }
//------------------------------------------------------------------------------------------------------------------------------------------------
  /**
   * @param {string} name
   * @returns {void}
   */
  _requireEnv(name) { // Helper: fail-fast se una variabile d'ambiente necessaria manca.
    if (!process.env[name]) throw new Error(`OAuthHandler: variabile ambiente mancante: ${name}`); // Lancia errore se env non definita.
  }
//------------------------------------------------------------------------------------------------------------------------------------------------
  /**
   * @param {object} req
   * @returns {URLSearchParams}
   */
  _getSearchParams(req) { // Helper: estrae i parametri query dalla URL della request.
    return new URL(req.url || "/", "http://localhost").searchParams; // Costruisce URL fittizio e ritorna SearchParams della query.
  }
//------------------------------------------------------------------------------------------------------------------------------------------------
  /**
   * @param {object} req
   * @param {object} res
   * @returns {boolean}
   */
  _requireSession(req, res) { // Helper: verifica presenza di req.session (dipende dal middleware session).
    if (!req.session) { // Se req.session non esiste, la pipeline session non è stata configurata correttamente.
      this._sendText(res, 500, "Session middleware non configurato"); // Risponde 500 perché è un problema lato server/config.
      logger.error("Session middleware non configurato (req.session assente)"); // Logga l'anomalia per diagnosi.
      return false; // Indica al chiamante che non può proseguire.
    }
    return true; // Session presente: ok proseguire.
  }

//------------------------------------------------------------------------------------------------------------------------------------------------
// Rotte OAuth
//------------------------------------------------------------------------------------------------------------------------------------------------
  /**
   * GET /oauth/login
   * Reindirizza il browser su Google (Authorization Endpoint).
   * @param {object} req
   * @param {object} res
   * @returns {Promise<void>}
   */
  async authenticate(req, res) { // Avvia il flow OAuth costruendo l'URL di autorizzazione e facendo redirect.
    if (!this._requireSession(req, res)) return; // Se manca session, stop: non possiamo salvare state/nonce.

    const state = crypto.randomUUID(); // anti-CSRF
    const nonce = crypto.randomUUID(); // anti-replay (OIDC)

    req.session.oauthState = state; // Salva state in session per verificarlo nel callback (difesa CSRF).
    req.session.oauthNonce = nonce; // Salva nonce in session per verificarlo nel callback (difesa replay).

    const params = new URLSearchParams({ // Costruisce querystring per l'Authorization Endpoint.
      client_id: process.env.GOOGLE_CLIENT_ID, // Identifica l'app verso Google.
      redirect_uri: process.env.GOOGLE_REDIRECT_URI, // Dove Google deve reindirizzare dopo il consenso.
      response_type: "code", // Richiede Authorization Code (flow standard server-side).
      scope: "email profile", // Scope minimi: email + profilo base (OIDC-like).
      state, // Stato random per protezione CSRF.
      nonce, // Nonce random per protezione anti-replay su OIDC.
      prompt: "select_account" // Forza selezione account (utile in contesti didattici multi-account).
    });

    const authUrl = `https://accounts.google.com/o/oauth2/auth?${params.toString()}`; // Compone l'URL completo di autorizzazione.
    logger.info("OAuth login initiated"); // Logga l'avvio del login.
    this._redirect(res, authUrl); // Reindirizza il browser verso Google.
  }
//------------------------------------------------------------------------------------------------------------------------------------------------
  /**
   * GET /oauth/callback
   * Riceve code+state da Google, scambia code->token e crea sessione applicativa.
   * @param {object} req
   * @param {object} res
   * @returns {Promise<void>}
   */
  async handleCallback(req, res) { // Gestisce il ritorno da Google: scambia code per token, verifica id_token, crea sessione.
    if (!this._requireSession(req, res)) return; // Senza session non possiamo validare state/nonce.

    const start = performance.now(); // Timestamp iniziale per misurare durata del callback.
    const sp = this._getSearchParams(req); // Recupera i parametri query (code, state, ecc.).

    const code = sp.get("code"); // Estrae authorization code.
    const returnedState = sp.get("state"); // Estrae state restituito dal provider.

    if (!code) { // Se manca code, il callback è incompleto/errato.
      this._sendText(res, 400, "Codice OAuth mancante"); // Risponde 400: richiesta non valida.
      return; // Stop: non si può proseguire senza code.
    }

    if (!returnedState || returnedState !== req.session.oauthState) { // Verifica state: deve esistere e combaciare con quello salvato in session.
      this._sendText(res, 403, "State non valido"); // Risponde 403: possibile CSRF/flow manomesso.
      return; // Stop: stato non affidabile.
    }

    try { // Protegge l'intero blocco di scambio token e verifica OIDC.
      const { tokens } = await this.client.getToken(code); // Scambia code per tokens (access_token, id_token, ecc.).
      if (!tokens?.id_token) { // Verifica che l'id_token sia presente (necessario per ottenere claim OIDC verificati).
        this._sendText(res, 500, "ID Token mancante nella risposta OAuth"); // Risponde 500: risposta provider inattesa.
        return; // Stop: senza id_token non possiamo verificare identità.
      }

      const ticket = await this.client.verifyIdToken({ // Verifica firma e audience dell'id_token (step OIDC fondamentale).
        idToken: tokens.id_token, // Token ID da verificare.
        audience: process.env.GOOGLE_CLIENT_ID // Audience attesa: deve essere il nostro client id.
      });

      const payload = ticket.getPayload(); // claim OIDC verificati
      if (!payload) { // Se payload è null, non abbiamo i claim utente.
        this._sendText(res, 500, "Payload OAuth mancante"); // Risponde 500: condizione anomala.
        return; // Stop: senza payload non si costruisce sessione.
      }

      // Nonce (anti-replay). NOTA: in molti provider è in payload.nonce.
      if (payload.nonce !== req.session.oauthNonce) { // Verifica che il nonce nel token corrisponda a quello salvato in session.
        this._sendText(res, 403, "Nonce non valido"); // Risponde 403: possibile replay/flow non coerente.
        return; // Stop: nonce non affidabile.
      }

      delete req.session.oauthState; // Rimuove state dalla session: non serve più e riduce superficie d'attacco.
      delete req.session.oauthNonce; // Rimuove nonce dalla session: non serve più e riduce superficie d'attacco.

      // Mappatura su utente "locale" (db) per avere id numerico e ruolo.
      let localUser = null; // Prepara variabile per eventuale utente locale creato/trovato nel DB.
      if (this.db && payload.email) { // Procede solo se DB disponibile e l'email è presente nei claim.
        localUser = await this.db.ensureUserFromOAuth({ // Crea o recupera utente locale a partire dai dati OAuth.
          email: payload.email, // Email come chiave principale.
          displayName: payload.name || payload.email, // Nome visualizzato: preferisce payload.name, altrimenti email.
          role: "teacher" // Ruolo assegnato (impostazione didattica).
        });
      }

      req.session.user = { // Crea l'utente applicativo in sessione (fonte per authContext).
        id: localUser?.id ?? payload.sub, // Preferisce id numerico locale, altrimenti subject OIDC (stringa).
        username: localUser?.username ?? (payload.email ? payload.email.split("@")[0] : payload.sub), // Username locale o derivato dall'email.
        displayName: localUser?.display_name ?? payload.name, // Nome visualizzato: locale o claim OIDC.
        role: localUser?.role ?? "student", // Ruolo: locale o fallback student.
        email: payload.email, // Email dal claim OIDC (se presente).
        picture: payload.picture // Avatar/immagine profilo dal claim OIDC (se presente).
      };

      req.session.authMode = "oauth"; // Marca la modalità di autenticazione corrente come OAuth.

      const duration = performance.now() - start; // Calcola durata callback in ms.
      logger.performance("OAuth callback OK", duration); // Logga performance per capire latenza/tempi del flow.

      // SPA alla root: route Angular
      this._redirect(res, "/dashboard"); // Dopo login, reindirizza a una route client-side della SPA.
    } catch (err) { // Gestisce errori di rete, token invalidi, verify fallito, ecc.
      logger.error(`Errore OAuth: ${err?.message ?? String(err)}`); // Logga l'errore con fallback robusto.

      // IMPORTANTISSIMO: se per qualche motivo qualcuno ha già risposto, non provarci di nuovo.
      if (this._alreadyReplied(res)) return; // Evita doppia risposta in caso la response sia già partita/chiusa.

      this._sendText(res, 500, "Errore durante autenticazione OAuth"); // Risponde 500 generico (didattico) per failure flow.
    }
  }
//------------------------------------------------------------------------------------------------------------------------------------------------
  /**
   * GET /oauth/profile
   * @param {object} req
   * @param {object} res
   * @returns {Promise<void>}
   */
  async getProfile(req, res) { // Restituisce i dati utente in sessione (profilo corrente).
    if (!req.session?.user) { // Se non c'è utente in sessione, non è autenticato.
      this._sendJson(res, 401, { error: "Non autenticato" }); // Risponde 401: serve login.
      return; // Stop: niente profilo da inviare.
    }
    this._sendJson(res, 200, req.session.user); // Invia il profilo utente salvato in sessione.
  }
//------------------------------------------------------------------------------------------------------------------------------------------------
  /**
   * GET /oauth/logout
   * @param {object} req
   * @param {object} res
   * @returns {void}
   */
  logout(req, res) { // Esegue logout applicativo: reset session e redirect alla home.
    if (req.session) req.session.reset(); // Se esiste una sessione, la resetta (rimuove user/authMode e cookie).
    this._redirect(res, "/"); // Reindirizza alla root della SPA/sito.
  }
}
//------------------------------------------------------------------------------------------------------------------------------------------------
module.exports = OAuthHandler; // Esporta la classe OAuthHandler (CommonJS) per essere usata dal middleware/router.
//------------------------------------------------------------------------------------------------------------------------------------------------

