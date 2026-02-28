/**----------------------------------------------------------------------------------------------------------------------
JwtHandler 
- Incapsula generazione e verifica di token JWT
- Separa opzioni di firma (signOptions) e opzioni di verifica (verifyOptions)
- Imposta un default di scadenza (expiresIn) per evitare token “eterni”
*/
//----------------------------------------------------------------------------------------------------------------------
"use strict"; // Attiva strict mode: aiuta a evitare errori “silenziosi” e rende il codice più prevedibile.
//----------------------------------------------------------------------------------------------------------------------
const jwt = require("jsonwebtoken"); // Importa la libreria jsonwebtoken: fornisce sign/verify/decode dei JWT.
//----------------------------------------------------------------------------------------------------------------------
class JwtHandler { // Definisce una classe che centralizza la gestione JWT (creazione, verifica, decodifica).
//----------------------------------------------------------------------------------------------------------------------
  /**
   * Costruisce un gestore JWT configurando secret e opzioni. // Scopo: creare un unico punto dove definire regole JWT.
   * @param {string} secret Chiave segreta per firmare e verificare i token (es. HS256). // Deve restare privata sul server.
   * @param {object} [signOptions={}] Opzioni per jwt.sign (es. expiresIn, issuer, audience). // Usate solo nella creazione del token.
   * @param {object} [verifyOptions={}] Opzioni per jwt.verify (es. issuer, audience, algorithms). // Usate solo nella verifica del token.
   * @throws {Error} Se secret non è fornita. // Evita istanze “inutili” che fallirebbero a runtime.
   */

  constructor(secret, signOptions = {}, verifyOptions = {}) { // Inizializza l'istanza con configurazione e controlli.
    if (!secret) { // Controllo d'ingresso: senza secret non si può firmare né verificare nulla.
      throw new Error("JwtHandler: secret obbligatorio"); // Errore esplicito e didattico: chiarisce la causa.
    } 

    this.secret = secret; // Memorizza la secret per firmare e verificare token JWT.

    this.signOptions = { // Opzioni per la firma: impostiamo un default didattico per evitare token senza scadenza.
      expiresIn: "1h", // Default: il token dura 1 ora (si può cambiare passando signOptions).
      ...signOptions // Merge: le opzioni passate dal chiamante possono sovrascrivere i default.
    }; 

    this.verifyOptions = { // Opzioni per la verifica: tenute separate perché sign e verify non devono per forza combaciare.
      ...verifyOptions // Copia delle opzioni di verifica (issuer/audience/algorithms, ecc.) se fornite.
    }; 
  } 
//----------------------------------------------------------------------------------------------------------------------
  /**
   * Genera un token JWT firmato usando secret e signOptions. // Scopo: produrre un token da dare al client dopo login.
   * @param {object} payload Dati da includere nel token (es. { id, role }). // Evitare dati sensibili (password, segreti).
   * @returns {string} Token JWT firmato. // Stringa compatta "header.payload.signature".
   * @throws {Error} Se payload non è un oggetto valido. // Evita token creati con input errato.
   */

  generateToken(payload) { // Crea un JWT a partire dal payload fornito.
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) { // Verifica payload: deve essere un oggetto “plain”, non null e non array.
      throw new Error("JwtHandler: payload deve essere un oggetto"); // Messaggio chiaro per studenti e debug.
    }

    return jwt.sign(payload, this.secret, this.signOptions); // Firma il token usando secret + opzioni (expiresIn, issuer, ecc.).
  } 
//----------------------------------------------------------------------------------------------------------------------
  /**
   * Verifica un token JWT e restituisce il payload verificato. Scopo: autenticazione/authorization lato server.
   * @param {string} token Token JWT ricevuto (tipicamente dall'header Authorization). // Deve essere una stringa non vuota.
   * @returns {object} Payload decodificato e verificato (inclusi claims standard). // Es. { id, role, iat, exp }.
   * @throws {Error} Se token manca o non è valido/scaduto. jwt.verify lancia errori (TokenExpiredError, JsonWebTokenError, ecc.).
   */

  verifyToken(token) { // Verifica firma, scadenza e (se configurati) issuer/audience/algoritmi.
    if (!token || typeof token !== "string") { // Controllo d'ingresso: evita chiamate a verify con null/undefined/oggetti.
      throw new Error("JwtHandler: token mancante"); // Errore esplicito per rendere subito chiaro il problema.
    } // Fine validazione token.

    return jwt.verify(token, this.secret, this.verifyOptions); // Verifica la firma e i vincoli (exp, issuer, audience, algorithms...).
  } 
//----------------------------------------------------------------------------------------------------------------------
  /**
   * Decodifica un token SENZA verificarlo (solo ispezione/debug). // Scopo: leggere payload/header senza validare la firma.
   * Attenzione: non usare questo metodo per autenticazione, perché un token falso verrebbe comunque “letto”. Punto fondamentale.
   * @param {string} token Token JWT da decodificare. // Stringa JWT.
   * @returns {object|null} Payload decodificato oppure null se la stringa non è un JWT decodificabile. Non garantisce autenticità.
   * @throws {Error} Se token manca. // Mantiene coerenza con gli altri metodi.
   */

  decodeUnsafe(token) { // Metodo utile per debug/log o per leggere rapidamente claim non critici.
    if (!token || typeof token !== "string") { // Controllo d'ingresso: evita decode su valori non validi.
      throw new Error("JwtHandler: token mancante"); // Messaggio chiaro.
    } 
    return jwt.decode(token); // Decodifica header/payload senza verifica della firma (nessuna sicurezza).
  }
//----------------------------------------------------------------------------------------------------------------------
} 
//----------------------------------------------------------------------------------------------------------------------
module.exports = JwtHandler; // Esporta la classe (CommonJS): chi importa crea new JwtHandler(secret, signOptions, verifyOptions).
//----------------------------------------------------------------------------------------------------------------------
