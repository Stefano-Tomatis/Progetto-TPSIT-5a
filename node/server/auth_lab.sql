-- auth_lab.sql
-- Database didattico: dati pubblici + dati "protetti" (da filtrare lato backend)

DROP DATABASE IF EXISTS auth_lab;
CREATE DATABASE auth_lab
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE auth_lab;

-- Tabella utenti: contiene sia campi "pubblici" sia campi "riservati"
CREATE TABLE users (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  username     VARCHAR(50)  NOT NULL UNIQUE,
  display_name VARCHAR(80)  NOT NULL,
  role         ENUM('student','teacher','admin') NOT NULL DEFAULT 'student',

  -- Campi "riservati" (non mostrarli a tutti)
  email        VARCHAR(120) NOT NULL,
  phone        VARCHAR(30)  NULL,
  private_note TEXT         NULL,

  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- VIEW: espone solo i dati "pubblici" degli utenti
CREATE OR REPLACE VIEW users_public AS
SELECT
  id,
  username,
  display_name,
  role,
  created_at
FROM users;

-- Tabella "protetta": note/documenti riservati collegati a un utente
CREATE TABLE private_docs (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  owner_userid INT         NOT NULL,
  title        VARCHAR(120) NOT NULL,
  content      TEXT         NOT NULL,
  classification ENUM('restricted','confidential') NOT NULL DEFAULT 'restricted',
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_private_docs_user
    FOREIGN KEY (owner_userid) REFERENCES users(id)
    ON DELETE CASCADE
);

-- Dati demo (tutto finto, ovviamente)
INSERT INTO users (username, display_name, role, email, phone, private_note) VALUES
  ('mrossi',  'Marcello Rossi',  'teacher', 'm.rossi@demo.local', '+39 333 0000001', 'Accesso completo per demo.'),
  ('lbianchi','Luca Bianchi',    'student', 'l.bianchi@demo.local', '+39 333 0000002', 'Nota riservata: recupero verifiche.'),
  ('cverdi',  'Chiara Verdi',    'student', 'c.verdi@demo.local', '+39 333 0000003', 'Nota riservata: PEI/attenzioni didattiche.'),
  ('admin',   'Admin Demo',      'admin',   'admin@demo.local',    '+39 333 0000009', 'Account amministratore (demo).');

INSERT INTO private_docs (owner_userid, title, content, classification) VALUES
  (1, 'Verbale consiglio di classe', 'Documento di esempio: contenuto riservato.', 'confidential'),
  (2, 'Piano di recupero', 'Documento di esempio: obiettivi e scadenze.', 'restricted'),
  (3, 'Nota riservata', 'Documento di esempio: info interne.', 'restricted');
