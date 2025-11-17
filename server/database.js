const { Pool } = require('pg');

// PostgreSQL везде (локально и на проде)
console.log('🐘 Используется PostgreSQL');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const db = {
  query: async (text, params = []) => {
    try {
      const result = await pool.query(text, params);
      return result.rows;
    } catch (error) {
      console.error('PostgreSQL query error:', error);
      throw error;
    }
  },
  
  run: async (text, params = []) => {
    try {
      const result = await pool.query(text, params);
      return {
        lastID: result.rows[0]?.id || null,
        changes: result.rowCount
      };
    } catch (error) {
      console.error('PostgreSQL run error:', error);
      throw error;
    }
  },
  
  get: async (text, params = []) => {
    try {
      const result = await pool.query(text, params);
      return result.rows[0] || null;
    } catch (error) {
      console.error('PostgreSQL get error:', error);
      throw error;
    }
  },
  
  all: async (text, params = []) => {
    try {
      const result = await pool.query(text, params);
      return result.rows;
    } catch (error) {
      console.error('PostgreSQL all error:', error);
      throw error;
    }
  }
};

module.exports = {
  db,
  pool,
  usePostgres: true
};

