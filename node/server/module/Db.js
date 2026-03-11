//---------------------------------------------------------------------------------------------------------------------------------------------------------
/**
 * Db
 * 
 * Mini layer MySQL (mysql2/promise) pensato per uso didattico.
 *
 * Nota di sicurezza (importante e spesso ignorata):
 * - I placeholder "?" proteggono SOLO i valori, non i nomi di tabella/colonna.
 * - Per questo motivo qui usiamo una whitelist di tabelle consentite.
 */
//---------------------------------------------------------------------------------------------------------------------------------------------------------
"use strict"; // Abilita strict mode per evitare errori “silenziosi” e comportamenti ambigui.
//---------------------------------------------------------------------------------------------------------------------------------------------------------
const mysql = require("mysql2/promise"); // Importa il driver MySQL in versione promise-based (API async/await).
const FileLogger = require("./FileLogger"); // Importa un logger su file per tracciare operazioni e debug.
//---------------------------------------------------------------------------------------------------------------------------------------------------------
const logger = new FileLogger("./log/db.log"); // Istanzia un logger che scrive su ./log/db.log.
//---------------------------------------------------------------------------------------------------------------------------------------------------------
class Db { // Definisce la classe che incapsula l’accesso al DB tramite pool di connessioni.
  /**
   * Crea un Db con pool di connessioni.
   * @param {object} [opt]
   * @param {string} [opt.host] Host MySQL
   * @param {string} [opt.user] User MySQL
   * @param {string} [opt.password] Password MySQL
   * @param {string} [opt.database] Database MySQL
   */
  constructor(opt = {}) { // Costruttore: inizializza il pool e le policy di sicurezza (whitelist tabelle).
    this.pool = mysql.createPool({ // Crea un pool di connessioni per riuso efficiente e concorrenza controllata.
      host: opt.host || process.env.DB_HOST || "localhost", // Risolve host: opzione > env > default locale.
      user: opt.user || process.env.DB_USER || "root", // Risolve user: opzione > env > default root.
      password: opt.password || process.env.DB_PASS || "", // Risolve password: opzione > env > default vuota.
      database: opt.database || process.env.DB_NAME || "db_visite", // Risolve database: opzione > env > default auth_lab.
      waitForConnections: true, // Mette in coda le richieste se il pool è saturo invece di fallire subito.
      connectionLimit: 10, // Imposta il numero massimo di connessioni simultanee nel pool.
      queueLimit: 0 // 0 = nessun limite alla coda (attenzione: può crescere molto in overload).
    }); // Chiude la configurazione e crea effettivamente il pool.
//---------------------------------------------------------------------------------------------------------------------------------------------------------
    /** @type {Set<string>} */
    this.allowedTables = new Set(["utenti", "visite", "medici", "specializzazioni", "admin"]); // Whitelist: impedisce SQL injection su nomi tabella.
  }
//---------------------------------------------------------------------------------------------------------------------------------------------------------
  /**
   * Chiude il pool (utile nei test).
   * @returns {Promise<void>}
   */
  async close() { // Metodo async: chiude tutte le connessioni del pool in modo ordinato.
    await this.pool.end(); // Termina il pool (rilascia risorse e connessioni sottostanti).
  }
//---------------------------------------------------------------------------------------------------------------------------------------------------------
  /**
   * Verifica che la tabella sia tra quelle consentite.
   * @param {string} table
   * @throws {Error}
   * @returns {void}
   */
  #assertAllowedTable(table) { // Metodo privato: valida che il nome tabella sia ammesso (difesa su SQL dinamico).
    if (!this.allowedTables.has(table)) { // Controlla membership nella whitelist (Set => lookup O(1) medio).
      throw new Error(`Db: tabella non consentita: ${table}`); // Blocca l’operazione: tabella non permessa.
    } // Chiude il controllo di sicurezza.
  }
//---------------------------------------------------------------------------------------------------------------------------------------------------------
  /**
   * Esegue una query generica.
   * @param {string} sql
   * @param {any[]} [params=[]]
   * @returns {Promise<[any[], any]>} rows, fields
   */
  async query(sql, params = []) { // Metodo async: wrapper standard per eseguire SQL con parametri.
    logger.info(`[SQL] ${sql} :: ${JSON.stringify(params)}`); // Logga query e parametri (utile per debug e auditing).
    return await this.pool.execute(sql, params); // Esegue SQL parametrica (mysql2 gestisce escaping dei valori).
  }
//---------------------------------------------------------------------------------------------------------------------------------------------------------
  /**
   * SELECT * FROM table [WHERE ...]
   * @param {string} table Tabella o view (whitelist).
   * @param {string} [where=""] Condizione SENZA parola "WHERE" (es. "id = ?").
   * @param {any[]} [params=[]] Parametri per i placeholder.
   * @returns {Promise<any[]>}
   */
  async read(table, where = "", params = []) { // Metodo async: legge record con SELECT opzionalmente filtrata.
    this.#assertAllowedTable(table); // Valida la tabella per evitare injection via interpolazione del nome.

    const sql = where // Costruisce la query scegliendo tra SELECT semplice o SELECT con WHERE.
      ? `SELECT * FROM ${table} WHERE ${where}` // Caso filtrato: concatena nome tabella (whitelist) + where (parametrico per valori).
      : `SELECT * FROM ${table}`; // Caso non filtrato: restituisce tutti i record della tabella/view.

    const [rows] = await this.query(sql, params); // Esegue query e destruttura solo rows (fields non usato qui).
    return rows; // Ritorna l’array di righe risultanti (oggetti JS).
  }

  async delete(table, where = "", params = []) { // Metodo async: cancella record con DELETE opzionalmente filtrata.
    this.#assertAllowedTable(table); // Valida la tabella per evitare injection via interpolazione del nome.

    const sql = where // Costruisce la query scegliendo tra SELECT semplice o SELECT con WHERE.
      ? `DELETE FROM ${table} WHERE ${where}` // Caso filtrato: concatena nome tabella (whitelist) + where (parametrico per valori).
      : `DELETE FROM ${table}`; // Caso non filtrato: restituisce tutti i record della tabella/view.

    const [rows] = await this.query(sql, params); // Esegue query e destruttura solo rows (fields non usato qui).
    return rows; // Ritorna l’array di righe risultanti (oggetti JS).
  }
//---------------------------------------------------------------------------------------------------------------------------------------------------------
  /**
   * INSERT su tabella consentita.
   * @param {string} table
   * @param {object} data
   * @returns {Promise<number>} insertId
   */
  async create(table, data) { // Metodo async: inserisce un record costruendo dinamicamente colonne e placeholder.
    this.#assertAllowedTable(table); // Valida la tabella perché viene interpolata nel SQL.

    const keys = Object.keys(data); // Estrae le chiavi dell’oggetto data come lista di colonne.
    const cols = keys.map(k => `\`${k}\``).join(", "); // Crea elenco colonne quotate con backtick (protezione da keyword/char speciali).
    const placeholders = keys.map(() => "?").join(", "); // Genera N placeholder "?" per query parametrica.
    const values = keys.map(k => data[k]); // Allinea i valori all’ordine delle colonne (fondamentale per coerenza insert).

    const sql = `INSERT INTO ${table} (${cols}) VALUES (${placeholders})`; // Compone l’INSERT con colonne e placeholder.
    const [result] = await this.query(sql, values); // Esegue l’INSERT e ottiene l’oggetto risultato del driver.
    return result.insertId; // Ritorna l’id autoincrement generato (se presente).
  }
//---------------------------------------------------------------------------------------------------------------------------------------------------------
  /**
   * Trova un utente per email (utile per OAuth).
   * @param {string} email
   * @returns {Promise<{id:number, username:string, display_name:string, role:string, email:string}|null>}
   */
  async getUserByEmail(email) { // Metodo async: recupera il primo utente che matcha l’email.
    const rows = await this.read("utenti", "email = ?", [email]); // SELECT parametrica per evitare injection sui valori.
    return rows[0] || null; // Ritorna il primo record o null se non trovato.
  }

  async getUserById(id) { // Metodo async: recupera il primo utente che matcha l’email.
    const rows = await this.read("utenti", "IdUtente = ?", [id]); // SELECT parametrica per evitare injection sui valori.
    return rows[0] || null; // Ritorna il primo record o null se non trovato.
  }

  async getAllUsers(){
    const rows = await this.read("utenti"); // SELECT parametrica per evitare injection sui valori.
    return rows || null;
  }

  async getAllDoctors(){
    const rows = await this.read("medici"); // SELECT parametrica per evitare injection sui valori.
    return rows || null; // Ritorna il primo record o null se non trovato.
  }

  async getAllAdmins(){
    const rows = await this.read("admin"); // SELECT parametrica per evitare injection sui valori.
    return rows || null; // Ritorna il primo record o null se non trovato.
  }

  async getAllSpecs(){
    const rows = await this.read("specializzazioni"); // SELECT parametrica per evitare injection sui valori.
    return rows || null; // Ritorna il primo record o null se non trovato.
  }

  async getDoctorByEmail(email){
    const rows = await this.read("medici", "email = ?", [email]); // SELECT parametrica per evitare injection sui valori.
    return rows[0] || null; // Ritorna il primo record o null se non trovato.
  }

  async getDoctorById(id){
    const rows = await this.read("medici", "IdMedico = ?", [id]); // SELECT parametrica per evitare injection sui valori.
    return rows[0] || null; // Ritorna il primo record o null se non trovato.
  }

  async getFreeHours(idDoc, day){
    const rows = await this.read("visite", "IdMedico = ? and DataOrario >= ? and DataOrario <= ?", [idDoc, day + " 00:00:01", day + " 23:59:59"]); // SELECT parametrica per evitare injection sui valori.
    let oreDisp = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"]
    let oreFin = oreDisp.filter(v => {
      for(let j = 0; j < rows.length; j++){
        if(rows[j].DataOrario.toString().includes(v)){
          return false
        }
      }
      return true
    })
    return oreFin
  }

  async newVisit(date, time, docId, userId){
    const res = await this.create("visite", { "IdVisita": null, "IdUtente": userId, "IdMedico": docId, "DataOrario": date + " " + time})
    return res
  }

  async deleteVisit(id){
    const ret = await this.delete("visite", "IdVisita = ?", [id])
    return ret
  }

  async getAdminByEmail(email){
    const rows = await this.read("admin", "email = ?", [email]); // SELECT parametrica per evitare injection sui valori.
    return rows[0] || null; // Ritorna il primo record o null se non trovato.
  }

  async getVisitsByUser(uId){
    const rows = await this.read("visite", "IdUtente = ?", [uId]); // SELECT parametrica per evitare injection sui valori.
    return rows || null; // Ritorna il primo record o null se non trovato.
  }

  async getVisitsByDoctor(dateStart, dateEnd, uId){
    const rows = await this.read("visite", "IdMedico = ? and DataOrario >= ? and DataOrario <= ?", [uId, dateStart, dateEnd]); // SELECT parametrica per evitare injection sui valori.
    return rows || null; // Ritorna il primo record o null se non trovato.
  }

  async getVisitsByDoctorNoDate(uId){
    const rows = await this.read("visite", "IdMedico = ?", [uId]); // SELECT parametrica per evitare injection sui valori.
    return rows || null; // Ritorna il primo record o null se non trovato.
  }

  async getSpecIdByName(name){
    const rows = await this.read("specializzazioni", "Nome = ?", [name]); // SELECT parametrica per evitare injection sui valori.
    return rows[0].IdSpecializzazione || null; // Ritorna il primo record o null se non trovato.
  }

  async getSpecNameById(id){
    const rows = await this.read("specializzazioni", "IdSpecializzazioni = ?", [id]); // SELECT parametrica per evitare injection sui valori.
    return rows[0].Nome || null; // Ritorna il primo record o null se non trovato.
  }

  async getDoctorsBySpecName(specName){
    const idSpec = await this.getSpecIdByName(specName)
    const rows = await this.read("medici", "IdSpecializzazione = ?", [idSpec]); // SELECT parametrica per evitare injection sui valori.
    return rows || null; // Ritorna il primo record o null se non trovato.
  }
//---------------------------------------------------------------------------------------------------------------------------------------------------------
  /**
   * Crea (se manca) un utente locale a partire dai dati OAuth (email/name).
   * Ritorna sempre un utente "users" con id numerico.
   *
   * @param {object} info
   * @param {string} info.email
   * @param {string} info.displayName
   * @param {string} [info.role="student"]
   * @returns {Promise<{id:number, username:string, display_name:string, role:string, email:string}>}
   */
  async ensureUserFromOAuth({ email, displayName, role = "teacher" }) { // Metodo async: upsert “manuale” per utente OAuth demo.
    const existing = await this.getUserByEmail(email); // Cerca un utente già presente con la stessa email.
    if (existing) return existing; // Se esiste, evita insert e restituisce direttamente il record.

    // username "safe": parte prima della @, solo [a-z0-9._-]
    const base = String(email).split("@")[0].toLowerCase().replace(/[^a-z0-9._-]/g, ""); // Normalizza username da email (sanificazione).
    let username = base || "user"; // Imposta username base, oppure fallback "user" se base è vuota.

    // Evita collisioni su username
    for (let i = 0; i < 20; i++) { // Tenta fino a 20 volte per trovare uno username non già usato.
      const u = await this.getUserByUsername(username); // Verifica se lo username corrente è già occupato.
      if (!u) break; // Se non esiste, esce dal loop mantenendo lo username valido.
      username = `${base || "user"}_${Math.floor(Math.random() * 9000 + 1000)}`; // Genera suffisso numerico 4 cifre per ridurre collisioni.
    } // Chiude il ciclo di tentativi anti-collisione.

    const id = await this.create("users", { // Inserisce un nuovo record utente nella tabella users.
      username, // Salva lo username risolto (unico o quasi, per la demo).
      display_name: displayName || username, // Salva display name; fallback allo username se mancante.
      role, // Salva il ruolo (default dato dal destructuring del parametro).
      email, // Salva email come identificativo principale in ambito OAuth.
      phone: null, // Imposta phone a null (campo opzionale/non fornito da OAuth).
      private_note: "Creato automaticamente via OAuth." // Nota interna didattica per tracciare la creazione automatica.
    }); // Chiude l’oggetto dati e completa l’INSERT.

    const created = await this.read("users", "id = ?", [id]); // Rilegge dal DB il record appena creato (fonte di verità).
    return created[0]; // Ritorna il record creato (primo e unico match per id).
  }
}
//---------------------------------------------------------------------------------------------------------------------------------------------------------
module.exports = Db; // Esporta la classe Db per essere usata dagli altri moduli (CommonJS).
//---------------------------------------------------------------------------------------------------------------------------------------------------------
