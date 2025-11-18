const { Pool } = require('pg');

// Проверка наличия DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.error('❌ ОШИБКА: DATABASE_URL не установлен!');
  console.error('   Установите переменную окружения DATABASE_URL');
  console.error('   Пример: postgresql://user:password@host:port/database');
  process.exit(1);
}

// PostgreSQL везде (локально и на проде)
console.log('🐘 Используется PostgreSQL');
console.log(`📡 DATABASE_URL: ${process.env.DATABASE_URL.substring(0, 30)}...`);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Обработка ошибок подключения
pool.on('error', (err) => {
  console.error('❌ Неожиданная ошибка подключения к PostgreSQL:', err);
});

// Проверка подключения при старте (не блокирующая)
// Реальная проверка будет при инициализации базы данных
pool.query('SELECT NOW()')
  .then(() => {
    console.log('✅ Подключение к PostgreSQL успешно установлено');
  })
  .catch((err) => {
    console.error('⚠️  Предупреждение: Не удалось проверить подключение к PostgreSQL:', err.message);
    console.error('   Сервер продолжит запуск, но может быть ошибка при инициализации БД');
    // Не убиваем процесс здесь - пусть инициализация базы данных покажет ошибку
  });

const db = {
  query: async (text, params = []) => {
    try {
      const result = await pool.query(text, params);
      return result.rows;
    } catch (error) {
      console.error('❌ PostgreSQL query error:', error.message);
      console.error('   Query:', text.substring(0, 100));
      if (params.length > 0) {
        console.error('   Params:', params);
      }
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
      console.error('❌ PostgreSQL run error:', error.message);
      console.error('   Query:', text.substring(0, 100));
      if (params.length > 0) {
        console.error('   Params:', params);
      }
      throw error;
    }
  },
  
  get: async (text, params = []) => {
    try {
      const result = await pool.query(text, params);
      return result.rows[0] || null;
    } catch (error) {
      console.error('❌ PostgreSQL get error:', error.message);
      console.error('   Query:', text.substring(0, 100));
      if (params.length > 0) {
        console.error('   Params:', params);
      }
      throw error;
    }
  },
  
  all: async (text, params = []) => {
    try {
      const result = await pool.query(text, params);
      return result.rows;
    } catch (error) {
      console.error('❌ PostgreSQL all error:', error.message);
      console.error('   Query:', text.substring(0, 100));
      if (params.length > 0) {
        console.error('   Params:', params);
      }
      throw error;
    }
  }
};

module.exports = {
  db,
  pool,
  usePostgres: true
};

