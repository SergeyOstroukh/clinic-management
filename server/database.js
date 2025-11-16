const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Определяем тип базы данных по переменной окружения
const usePostgres = !!process.env.DATABASE_URL;

let db;
let pool;

if (usePostgres) {
  // PostgreSQL для продакшена (Railway)
  console.log('🐘 Используется PostgreSQL');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  db = {
    query: async (text, params) => {
      try {
        const result = await pool.query(text, params);
        return result.rows;
      } catch (error) {
        console.error('PostgreSQL query error:', error);
        throw error;
      }
    },
    
    run: async (text, params) => {
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
    
    get: async (text, params) => {
      try {
        const result = await pool.query(text, params);
        return result.rows[0] || null;
      } catch (error) {
        console.error('PostgreSQL get error:', error);
        throw error;
      }
    },
    
    all: async (text, params) => {
      try {
        const result = await pool.query(text, params);
        return result.rows;
      } catch (error) {
        console.error('PostgreSQL all error:', error);
        throw error;
      }
    }
  };
} else {
  // SQLite для локальной разработки
  console.log('💾 Используется SQLite');
  const dbPath = path.join(__dirname, 'clinic.db');
  const sqliteDb = new sqlite3.Database(dbPath);
  
  db = {
    query: (text, params) => {
      return new Promise((resolve, reject) => {
        sqliteDb.all(text, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    },
    
    run: (text, params) => {
      return new Promise((resolve, reject) => {
        sqliteDb.run(text, params, function(err) {
          if (err) reject(err);
          else resolve({ lastID: this.lastID, changes: this.changes });
        });
      });
    },
    
    get: (text, params) => {
      return new Promise((resolve, reject) => {
        sqliteDb.get(text, params, (err, row) => {
          if (err) reject(err);
          else resolve(row || null);
        });
      });
    },
    
    all: (text, params) => {
      return new Promise((resolve, reject) => {
        sqliteDb.all(text, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    },
    
    // Специальный метод для SQLite serialize
    serialize: (callback) => {
      if (sqliteDb.serialize) {
        sqliteDb.serialize(callback);
      } else {
        callback();
      }
    }
  };
}

// Функция для получения SQL синтаксиса в зависимости от БД
const getSQL = () => {
  if (usePostgres) {
    return {
      // PostgreSQL синтаксис
      autoIncrement: 'SERIAL PRIMARY KEY',
      timestamp: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      text: 'TEXT',
      integer: 'INTEGER',
      real: 'REAL',
      boolean: 'BOOLEAN DEFAULT FALSE',
      
      // Параметры используют $1, $2 вместо ?
      placeholder: (index) => `$${index}`,
      
      // ALTER TABLE синтаксис
      addColumn: (table, column, type) => `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${type}`,
    };
  } else {
    return {
      // SQLite синтаксис
      autoIncrement: 'INTEGER PRIMARY KEY AUTOINCREMENT',
      timestamp: 'DATETIME DEFAULT CURRENT_TIMESTAMP',
      text: 'TEXT',
      integer: 'INTEGER',
      real: 'REAL',
      boolean: 'INTEGER DEFAULT 0',
      
      // Параметры используют ?
      placeholder: () => '?',
      
      // ALTER TABLE синтаксис
      addColumn: (table, column, type) => `ALTER TABLE ${table} ADD COLUMN ${column} ${type}`,
    };
  }
};

module.exports = {
  db,
  pool,
  usePostgres,
  getSQL
};

