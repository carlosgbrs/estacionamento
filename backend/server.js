// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { pool, initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Inicializa as tabelas
initDb();

// Função auxiliar para registrar logs de movimentação
async function registrarLog({ vagaId, acao, placa, cliente, usuarioId, detalhes }) {
  try {
    const sql = `
      INSERT INTO logs (vaga_id, acao, placa, cliente, usuario_id, detalhes)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    await pool.query(sql, [
      vagaId || null,
      acao,
      placa || null,
      cliente || null,
      usuarioId || null,
      detalhes || null,
    ]);
  } catch (err) {
    console.error('Erro ao registrar log:', err);
  }
}

// Rota teste
app.get('/', (req, res) => {
  res.json({ message: 'API de estacionamento (Supabase) funcionando 🚗' });
});

//
// AUTENTICAÇÃO / USUÁRIOS
//

// Criação de usuário (cadastro)
app.post('/usuarios', async (req, res) => {
  const { nome, email, senha } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios' });
  }

  const sql = `
    INSERT INTO usuarios (nome, email, senha)
    VALUES ($1, $2, $3)
    RETURNING id, nome, email
  `;

  try {
    const result = await pool.query(sql, [nome, email, senha]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao criar usuário:', err);
    if (err.code === '23505') {
      // violação de unique (email)
      return res.status(400).json({ error: 'E-mail já cadastrado' });
    }
    res.status(500).json({ error: 'Erro ao criar usuário' });
  }
});

// Login
app.post('/login', async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios' });
  }

  const sql = `
    SELECT id, nome, email
      FROM usuarios
     WHERE email = $1
       AND senha = $2
  `;

  try {
    const result = await pool.query(sql, [email, senha]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const usuario = result.rows[0];
    res.json({ usuario });
  } catch (err) {
    console.error('Erro ao realizar login:', err);
    res.status(500).json({ error: 'Erro ao realizar login' });
  }
});

//
// VAGAS
//

// 1) LISTAR TODAS AS VAGAS
app.get('/vagas', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vagas ORDER BY codigo');
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar vagas:', err);
    res.status(500).json({ error: 'Erro ao buscar vagas' });
  }
});

//
// 2) CRIAR UMA NOVA VAGA
//   body: { "codigo": "A01", "usuarioId": 1 }
//
app.post('/vagas', async (req, res) => {
  const { codigo, usuarioId } = req.body;

  if (!codigo) {
    return res.status(400).json({ error: 'Código da vaga é obrigatório' });
  }

  const sql = `
    INSERT INTO vagas (codigo, status)
    VALUES ($1, 'LIVRE')
    RETURNING id, codigo, status
  `;

  try {
    const result = await pool.query(sql, [codigo]);
    const vaga = result.rows[0];

    await registrarLog({
      vagaId: vaga.id,
      acao: 'CRIAR_VAGA',
      usuarioId,
      detalhes: `Vaga ${vaga.codigo} criada`,
    });

    res.status(201).json(vaga);
  } catch (err) {
    console.error('Erro ao criar vaga:', err);
    res.status(500).json({ error: 'Erro ao criar vaga (código pode já existir)' });
  }
});

//
// 3) REGISTRAR ENTRADA NA VAGA
//   PUT /vagas/:id/entrada
//   body: { "placa": "ABC1234", "cliente": "Fulano", "usuarioId": 1 }
//
app.put('/vagas/:id/entrada', async (req, res) => {
  const { id } = req.params;
  const { placa, cliente, usuarioId } = req.body;

  if (!placa || !cliente) {
    return res.status(400).json({ error: 'Placa e cliente são obrigatórios' });
  }

  const sql = `
    UPDATE vagas
       SET status = 'OCUPADA',
           placa = $1,
           cliente = $2,
           entrada = NOW()
     WHERE id = $3
       AND status = 'LIVRE'
  `;

  try {
    const result = await pool.query(sql, [placa, cliente, id]);
    if (result.rowCount === 0) {
      return res.status(400).json({ error: 'Vaga não encontrada ou não está LIVRE' });
    }

    await registrarLog({
      vagaId: id,
      acao: 'ENTRADA',
      placa,
      cliente,
      usuarioId,
      detalhes: 'Entrada registrada',
    });

    res.json({ message: 'Entrada registrada com sucesso' });
  } catch (err) {
    console.error('Erro ao registrar entrada:', err);
    res.status(500).json({ error: 'Erro ao registrar entrada' });
  }
});

//
// 4) REGISTRAR SAÍDA DA VAGA
//   PUT /vagas/:id/saida
//   body: { "usuarioId": 1 }
//
app.put('/vagas/:id/saida', async (req, res) => {
  const { id } = req.params;
  const { usuarioId } = req.body || {};

  const sqlBuscar = `
    SELECT placa, cliente
      FROM vagas
     WHERE id = $1
  `;

  const sql = `
    UPDATE vagas
       SET status = 'LIVRE',
           placa = NULL,
           cliente = NULL,
           entrada = NULL
     WHERE id = $1
       AND status = 'OCUPADA'
  `;

  try {
    const original = await pool.query(sqlBuscar, [id]);
    const dadosOriginais = original.rows[0] || {};

    const result = await pool.query(sql, [id]);
    if (result.rowCount === 0) {
      return res.status(400).json({ error: 'Vaga não encontrada ou não está OCUPADA' });
    }

    await registrarLog({
      vagaId: id,
      acao: 'SAIDA',
      placa: dadosOriginais.placa,
      cliente: dadosOriginais.cliente,
      usuarioId,
      detalhes: 'Saída registrada',
    });

    res.json({ message: 'Saída registrada com sucesso' });
  } catch (err) {
    console.error('Erro ao registrar saída:', err);
    res.status(500).json({ error: 'Erro ao registrar saída' });
  }
});

//
// 5) DELETAR VAGA (opcional)
//   DELETE /vagas/:id
//   body: { "usuarioId": 1 }
//
app.delete('/vagas/:id', async (req, res) => {
  const { id } = req.params;
  const { usuarioId } = req.body || {};

  const sqlBuscar = `
    SELECT codigo, placa, cliente
      FROM vagas
     WHERE id = $1
  `;

  try {
    const original = await pool.query(sqlBuscar, [id]);
    const dadosOriginais = original.rows[0];

    const result = await pool.query('DELETE FROM vagas WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Vaga não encontrada' });
    }

    await registrarLog({
      vagaId: id,
      acao: 'DELETAR_VAGA',
      placa: dadosOriginais?.placa,
      cliente: dadosOriginais?.cliente,
      usuarioId,
      detalhes: dadosOriginais
        ? `Vaga ${dadosOriginais.codigo} deletada`
        : 'Vaga deletada',
    });

    res.json({ message: 'Vaga deletada com sucesso' });
  } catch (err) {
    console.error('Erro ao deletar vaga:', err);
    res.status(500).json({ error: 'Erro ao deletar vaga' });
  }
});

//
// LOGS
//

// Listar últimos logs (para consulta / prova de auditoria)
app.get('/logs', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT l.*, v.codigo AS codigo_vaga, u.nome AS nome_usuario
         FROM logs l
         LEFT JOIN vagas v ON v.id = l.vaga_id
         LEFT JOIN usuarios u ON u.id = l.usuario_id
        ORDER BY l.criado_em DESC
        LIMIT 200`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar logs:', err);
    res.status(500).json({ error: 'Erro ao buscar logs' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
