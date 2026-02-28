//---------------------------------------------------------------------------------------------------------------------------------------------------------
/**
 * FileLogger
 * 
 * Logger minimale su file (didattico).
 * - Scrive righe timestampate
 * - Metodi: info/warn/error/performance
 */
//---------------------------------------------------------------------------------------------------------------------------------------------------------
"use strict"; // Attiva strict mode: meno comportamenti ambigui, errori più “rumorosi”.
//---------------------------------------------------------------------------------------------------------------------------------------------------------
const fs = require("fs"); // Importa il modulo core per operazioni su filesystem.
const path = require("path"); // Importa il modulo core per manipolare path in modo cross-platform.
//---------------------------------------------------------------------------------------------------------------------------------------------------------
class FileLogger { // Definisce un logger minimale che scrive su file.
  /**
   * @param {string} filePath
   */
  constructor(filePath) { // Costruisce il logger configurando il percorso di output.
    this.filePath = filePath; // Memorizza il path del file di log come stato dell’istanza.
    this.#ensureDir(); // Garantisce che la cartella del file esista prima di scrivere.
  }
//---------------------------------------------------------------------------------------------------------------------------------------------------------
  /**
   * Assicura l’esistenza della directory che conterrà il file di log.
   * @returns {void}
   */
  #ensureDir() { // Metodo privato: prepara l’ambiente di scrittura.
    const dir = path.dirname(this.filePath); // Estrae la directory dal percorso completo del file.
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); // Crea la directory se manca (ricorsiva per path annidati).
  }
//---------------------------------------------------------------------------------------------------------------------------------------------------------
  /**
   * Scrive una riga di log sul file con timestamp ISO.
   * @param {"INFO"|"WARN"|"ERROR"|"PERF"} level
   * @param {string} msg
   * @returns {void}
   */
  #write(level, msg) { // Metodo privato: centralizza la logica di formattazione e scrittura.
    const line = `[${new Date().toISOString()}] [${level}] ${msg}\n`; // Compone la riga con timestamp + livello + messaggio.
    try { // Protegge la scrittura: un errore su I/O non deve buttare giù l’app.
      fs.appendFileSync(this.filePath, line, "utf-8"); // Appende in modo sincrono (semplice/didattico) una riga al file.
    } catch { // Cattura errori di scrittura (permessi, path invalido, disco pieno, ecc.).
      // Se non riesce a scrivere su file, almeno non crashiamo.
    }
  }
//---------------------------------------------------------------------------------------------------------------------------------------------------------
  /**
   * Log informativo.
   * @param {string} msg
   * @returns {void}
   */
  info(msg) { // Espone un log a livello INFO.
    this.#write("INFO", msg); // Delego al writer privato, fissando il livello.
  }
//---------------------------------------------------------------------------------------------------------------------------------------------------------
  /**
   * Log di warning.
   * @param {string} msg
   * @returns {void}
   */
  warn(msg) { // Espone un log a livello WARN.
    this.#write("WARN", msg); // Delego al writer privato, fissando il livello.
  }
//---------------------------------------------------------------------------------------------------------------------------------------------------------
  /**
   * Log di errore.
   * @param {string} msg
   * @returns {void}
   */
  error(msg) { // Espone un log a livello ERROR.
    this.#write("ERROR", msg); // Delego al writer privato, fissando il livello.
  }
//---------------------------------------------------------------------------------------------------------------------------------------------------------
  /**
   * Log di performance (tempo in ms).
   * @param {string} label
   * @param {number} ms
   * @returns {void}
   */
  performance(label, ms) { // Espone un log a livello PERF per misurazioni temporali.
    this.#write("PERF", `${label} (${ms.toFixed(1)}ms)`); // Formatto i ms a 1 decimale e delego al writer privato.
  }
}
//---------------------------------------------------------------------------------------------------------------------------------------------------------
module.exports = FileLogger; // Esporta la classe (CommonJS) per l’uso negli altri moduli.
//---------------------------------------------------------------------------------------------------------------------------------------------------------
