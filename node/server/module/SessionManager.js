/**
 * SessionManager // Classe: incapsula la configurazione del middleware di sessione.
 * - Obiettivo: creare una sola volta il middleware e poi fornirlo al server. Evita duplicazioni e rende chiara la responsabilità.
 */
//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------
"use strict"; // Attiva strict mode: regole più rigide e meno comportamenti ambigui.
//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const clientSessions = require("client-sessions"); // Importa la libreria "client-sessions" per gestire sessioni basate su cookie firmati.
//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------
class SessionManager { // Definisce una classe che gestisce configurazione e accesso al middleware di sessione.
//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  /**
   * Costruisce il SessionManager e configura il middleware di sessione. // Scopo: centralizzare tutte le opzioni in un unico posto.
   * @param {object} [opt={}] Oggetto opzioni (opzionale). // Se non passato, verranno usati i default.
   * @param {string} opt.secret Chiave segreta obbligatoria per firmare/cifrare il cookie di sessione. // Senza secret la sessione non è sicura.
   * @param {number} [opt.duration=86400000] Durata massima della sessione in millisecondi (default 24h). // Dopo questa scadenza la sessione è invalidata.
   * @param {number} [opt.activeDuration=300000] Estensione “sliding” in ms (default 5 min). // Se l’utente è attivo, la sessione viene prolungata.
   * @param {boolean} [opt.secure=false] Se true, il cookie viene inviato solo in HTTPS. // In HTTP locale deve restare false o il browser non salva il cookie.
   * @throws {Error} Se secret non è fornita. // Fail-fast: evita configurazioni incomplete.
   */

  constructor({ secret, duration = 24 * 60 * 60 * 1000, activeDuration = 5 * 60 * 1000, secure = false } = {}) { // Usa destructuring con default per rendere chiari i parametri.
    if (!secret) { // Controllo: secret è obbligatoria per garantire integrità del cookie.
      throw new Error("SessionManager: secret obbligatorio"); // Lancia un errore esplicito (messaggio didattico).
    }

    this.sessionMiddleware = clientSessions({ // Crea il middleware vero e proprio (funzione da chiamare su ogni request).
      cookieName: "session", // Nome del cookie nel browser (es. "session" → req.session).
      secret, // Secret usata da client-sessions per firmare/cifrare il contenuto della sessione.
      duration, // Durata massima: oltre questo tempo il cookie di sessione scade.
      activeDuration, // Durata “attiva”: estende la sessione se l’utente continua a fare richieste.
      cookie: { // Impostazioni specifiche del cookie HTTP.
        httpOnly: true, // Impedisce l’accesso al cookie via JavaScript (mitiga attacchi XSS).
        sameSite: "lax", // Riduce invio del cookie in contesti cross-site (mitiga CSRF in molti casi).
        secure, // Se true, cookie inviato solo su HTTPS (in HTTP locale -> spesso non viene salvato).
        path: "/" // Rende il cookie valido per tutte le rotte del sito (non solo per una sottocartella).
      }
    });
  }
//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  /**
   * Restituisce il middleware di sessione configurato. // Scopo: il server lo usa come “pezzo” da inserire nella pipeline.
   * @returns {Function} Middleware (req, res, next) prodotto da client-sessions. // Da chiamare per ogni richiesta HTTP.
   */

  getMiddleware() { // Metodo pubblico: espone la funzione middleware senza esporre i dettagli di client-sessions.
    return this.sessionMiddleware; // Ritorna il middleware pronto all’uso.
  }
//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------
} 
//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------
module.exports = SessionManager; // Esporta la classe: chi importa crea new SessionManager(...) e poi usa getMiddleware().
//--------------------------------------------------------------------------------------------------------------------------------------------------------------------------
