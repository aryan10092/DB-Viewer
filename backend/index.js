const express = require('express');
const cors = require('cors');
const { Client } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

// Postgres connection endpoint
app.post('/api/test-connection', async (req, res) => {
  const { host, port, user, password, database } = req.body;
  const client = new Client({
    host,
    port,
    user,
    password,
    database,
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client.connect();
    await client.end();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// tables endpoint
app.post('/api/list-tables', async (req, res) => {
  const { host, port, user, password, database } = req.body;
  const client = new Client({
    host,
    port,
    user,
    password,
    database,
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client.connect();
    const result = await client.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name;
    `);
    await client.end();
    res.json({ success: true, tables: result.rows });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// SQL query endpoint
app.post('/api/query', async (req, res) => {
  const { host, port, user, password, database, query } = req.body;
  const client = new Client({
    host,
    port,
    user,
    password,
    database,
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client.connect();
    const result = await client.query(query);
    await client.end();
    res.json({ success: true, columns: result.fields.map(f => f.name), rows: result.rows });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
}); 