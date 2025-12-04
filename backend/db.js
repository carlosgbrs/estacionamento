// db.js
require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL não definida no .env');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false, // necessário em muitos ambientes de cloud (Supabase, Render, etc.)
  },
});

// Garantir que as tabelas existam
async function initDb() {
  const createVagasSQL = `
    CREATE TABLE IF NOT EXISTS vagas (
      id SERIAL PRIMARY KEY,
      codigo TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('LIVRE', 'OCUPADA')),
      placa TEXT,
      cliente TEXT,
      entrada TIMESTAMP
    );
  `;

  const createUsuariosSQL = `
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      senha TEXT NOT NULL,
      criado_em TIMESTAMP DEFAULT NOW()
    );
  `;

  const createLogsSQL = `
    CREATE TABLE IF NOT EXISTS logs (
      id SERIAL PRIMARY KEY,
      vaga_id INTEGER REFERENCES vagas(id) ON DELETE SET NULL,
      acao TEXT NOT NULL,
      placa TEXT,
      cliente TEXT,
      usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      detalhes TEXT,
      criado_em TIMESTAMP DEFAULT NOW()
    );
  `;

  try {
    await pool.query(createVagasSQL);
    await pool.query(createUsuariosSQL);
    await pool.query(createLogsSQL);
    console.log('Tabelas "vagas", "usuarios" e "logs" verificadas/criadas com sucesso');
  } catch (err) {
    console.error('Erro ao criar tabelas:', err);
    process.exit(1);
  }
}

module.exports = {
  pool,
  initDb,
};
