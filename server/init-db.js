const { db } = require('./database');

// Инициализация базы данных
async function initializeDatabase() {
  console.log('🔧 Инициализация базы данных PostgreSQL...');
  
  try {
    await initializePostgreSQL();
    console.log('✅ Таблицы созданы/проверены');
    
    await migrateWorkDateIfNeeded();
    console.log('✅ Миграция дат расписания проверена');
    
    await migrateAppointmentDateIfNeeded();
    console.log('✅ Миграция дат записей проверена');
    
    await initializeDefaultData();
    console.log('✅ Данные по умолчанию проверены');
    
    console.log('✅ База данных инициализирована');
  } catch (error) {
    console.error('❌ Ошибка инициализации базы данных:', error.message);
    console.error('   Stack:', error.stack);
    throw error;
  }
}

// Инициализация PostgreSQL
async function initializePostgreSQL() {
  console.log('📊 Создание таблиц PostgreSQL...');
  
  try {
    // Таблица клиентов
    await db.run(`
    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      "lastName" TEXT,
      "firstName" TEXT,
      "middleName" TEXT,
      phone TEXT,
      address TEXT,
      email TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Таблица услуг
  await db.run(`
    CREATE TABLE IF NOT EXISTS services (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      description TEXT,
      category TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Таблица врачей
  await db.run(`
    CREATE TABLE IF NOT EXISTS doctors (
      id SERIAL PRIMARY KEY,
      "lastName" TEXT NOT NULL,
      "firstName" TEXT NOT NULL,
      "middleName" TEXT,
      specialization TEXT,
      phone TEXT,
      email TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Таблица записей
  await db.run(`
    CREATE TABLE IF NOT EXISTS appointments (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL,
      appointment_date VARCHAR(50) NOT NULL,
      doctor_id INTEGER,
      status TEXT DEFAULT 'scheduled',
      called_today BOOLEAN DEFAULT FALSE,
      notes TEXT,
      total_price REAL DEFAULT 0,
      diagnosis TEXT,
      discount_amount REAL DEFAULT 0,
      paid BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (doctor_id) REFERENCES doctors(id)
    )
  `);
  
  // Таблица связи записей и услуг
  await db.run(`
    CREATE TABLE IF NOT EXISTS appointment_services (
      id SERIAL PRIMARY KEY,
      appointment_id INTEGER NOT NULL,
      service_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      FOREIGN KEY (appointment_id) REFERENCES appointments(id),
      FOREIGN KEY (service_id) REFERENCES services(id)
    )
  `);
  
  // Таблица материалов
  await db.run(`
    CREATE TABLE IF NOT EXISTS materials (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      unit TEXT,
      price REAL NOT NULL,
      stock REAL DEFAULT 0,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Таблица связи записей и материалов
  await db.run(`
    CREATE TABLE IF NOT EXISTS appointment_materials (
      id SERIAL PRIMARY KEY,
      appointment_id INTEGER NOT NULL,
      material_id INTEGER NOT NULL,
      quantity REAL DEFAULT 1,
      FOREIGN KEY (appointment_id) REFERENCES appointments(id),
      FOREIGN KEY (material_id) REFERENCES materials(id)
    )
  `);
  
  // Таблица расписания врачей (регулярное - по дням недели)
  await db.run(`
    CREATE TABLE IF NOT EXISTS doctor_schedules (
      id SERIAL PRIMARY KEY,
      doctor_id INTEGER NOT NULL,
      day_of_week INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id)
    )
  `);
  
  // Таблица точечных дат работы врачей
  await db.run(`
    CREATE TABLE IF NOT EXISTS doctor_specific_dates (
      id SERIAL PRIMARY KEY,
      doctor_id INTEGER NOT NULL,
      work_date VARCHAR(50) NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id)
    )
  `);
  
  // Таблица пользователей
  await db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      doctor_id INTEGER,
      full_name TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id)
    )
  `);
  
  console.log('   ✓ Все таблицы проверены');
  } catch (error) {
    console.error('❌ Ошибка создания таблиц:', error.message);
    throw error;
  }
}

// Миграция work_date: DATE -> VARCHAR(50) и исправление формата
async function migrateWorkDateIfNeeded() {
  try {
    // Проверяем, существует ли таблица
    const tableExists = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'doctor_specific_dates'
      )
    `);
    
    if (!tableExists[0]?.exists) {
      console.log('   ℹ️  Таблица doctor_specific_dates не существует, миграция не требуется');
      return;
    }
    
    // Проверяем текущий тип колонки
    const checkType = await db.query(`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'doctor_specific_dates' 
      AND column_name = 'work_date'
    `);
    
    if (checkType.length === 0) {
      console.log('   ℹ️  Колонка work_date не найдена');
      return;
    }
    
    const currentType = checkType[0].data_type;
    
    if (currentType === 'date') {
      console.log('   🔄 Миграция work_date: DATE -> VARCHAR(50)...');
      
      // Создаем временную колонку
      await db.query(`
        ALTER TABLE doctor_specific_dates 
        ADD COLUMN IF NOT EXISTS work_date_new VARCHAR(50)
      `);
      
      // Копируем данные, конвертируя DATE в строку YYYY-MM-DD
      await db.query(`
        UPDATE doctor_specific_dates 
        SET work_date_new = TO_CHAR(work_date, 'YYYY-MM-DD')
        WHERE work_date_new IS NULL
      `);
      
      // Удаляем старую колонку
      await db.query(`
        ALTER TABLE doctor_specific_dates 
        DROP COLUMN work_date
      `);
      
      // Переименовываем новую колонку
      await db.query(`
        ALTER TABLE doctor_specific_dates 
        RENAME COLUMN work_date_new TO work_date
      `);
      
      // Добавляем NOT NULL constraint
      await db.query(`
        ALTER TABLE doctor_specific_dates 
        ALTER COLUMN work_date SET NOT NULL
      `);
      
      console.log('   ✅ Миграция типа колонки завершена');
    } else if (currentType === 'character varying' || currentType === 'varchar') {
      // Колонка уже VARCHAR, но нужно проверить формат данных
      console.log('   🔍 Проверка формата данных work_date...');
      
      // Проверяем, есть ли записи с неправильным форматом (с временем или другой формат)
      const badFormat = await db.query(`
        SELECT id, work_date 
        FROM doctor_specific_dates 
        WHERE work_date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        LIMIT 10
      `);
      
      if (badFormat.length > 0) {
        console.log(`   🔄 Исправление формата ${badFormat.length} записей...`);
        
        // Исправляем формат: убираем время, оставляем только дату
        await db.query(`
          UPDATE doctor_specific_dates 
          SET work_date = SUBSTRING(work_date, 1, 10)
          WHERE work_date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        `);
        
        // Также исправляем записи с форматом 'YYYY-MM-DDTHH:MM:SS'
        await db.query(`
          UPDATE doctor_specific_dates 
          SET work_date = SPLIT_PART(work_date, 'T', 1)
          WHERE work_date LIKE '%T%'
        `);
        
        console.log('   ✅ Формат данных исправлен');
      } else {
        console.log('   ✅ Формат данных правильный');
      }
    } else {
      console.log(`   ⚠️  Неожиданный тип колонки: ${currentType}`);
    }
  } catch (error) {
    console.error('   ⚠️  Ошибка миграции work_date:', error.message);
    // Не прерываем инициализацию, если миграция не удалась
    // Возможно, таблица уже в правильном формате
  }
}

// Миграция appointment_date: исправление формата существующих записей
async function migrateAppointmentDateIfNeeded() {
  try {
    // Проверяем, существует ли таблица
    const tableExists = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'appointments'
      )
    `);
    
    if (!tableExists[0]?.exists) {
      console.log('   ℹ️  Таблица appointments не существует, миграция не требуется');
      return;
    }
    
    // Проверяем, есть ли записи с неправильным форматом (с 'T' или timezone)
    const badFormat = await db.query(`
      SELECT id, appointment_date 
      FROM appointments 
      WHERE appointment_date LIKE '%T%' 
         OR appointment_date LIKE '%Z%'
         OR appointment_date LIKE '%+%'
         OR appointment_date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}$'
      LIMIT 10
    `);
    
    if (badFormat.length > 0) {
      console.log(`   🔄 Исправление формата appointment_date для ${badFormat.length} записей...`);
      
      // Исправляем формат: убираем 'T', timezone, приводим к YYYY-MM-DD HH:MM:SS
      await db.query(`
        UPDATE appointments 
        SET appointment_date = 
          SUBSTRING(
            REPLACE(
              REPLACE(
                REPLACE(
                  SPLIT_PART(appointment_date, '+', 1),
                  'T', ' '
                ),
                'Z', ''
              ),
              '-', '-'
            ),
            1, 19
          )
        WHERE appointment_date LIKE '%T%' 
           OR appointment_date LIKE '%Z%'
           OR appointment_date LIKE '%+%'
           OR appointment_date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}$'
      `);
      
      // Также добавляем секунды, если их нет
      await db.query(`
        UPDATE appointments 
        SET appointment_date = appointment_date || ':00'
        WHERE appointment_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}$'
      `);
      
      console.log('   ✅ Формат appointment_date исправлен');
    } else {
      console.log('   ✅ Формат appointment_date правильный');
    }
  } catch (error) {
    console.error('   ⚠️  Ошибка миграции appointment_date:', error.message);
    // Не прерываем инициализацию, если миграция не удалась
  }
}

// Инициализация данных по умолчанию
async function initializeDefaultData() {
  console.log('📝 Проверка данных по умолчанию...');
  
  // Проверяем, есть ли пользователи
  const users = await db.all('SELECT * FROM users');
  
  if (users.length === 0) {
    console.log('👥 Создание пользователей по умолчанию...');
    
    // Создаем врача по умолчанию
    const result = await db.query(
      'INSERT INTO doctors ("lastName", "firstName", specialization) VALUES ($1, $2, $3) RETURNING id',
      ['Иванов', 'Иван', 'Терапевт']
    );
    const doctorId = result[0].id;
    
    // Создаем пользователей
    const defaultUsers = [
      { username: 'Admin', password: 'admin', role: 'superadmin', full_name: 'Главный администратор' },
      { username: 'Administrator', password: 'administrator', role: 'administrator', full_name: 'Администратор' },
      { username: 'Doctor1', password: 'doctor', role: 'doctor', doctor_id: doctorId, full_name: 'Иванов Иван' }
    ];
    
    for (const user of defaultUsers) {
      await db.run(
        'INSERT INTO users (username, password, role, doctor_id, full_name) VALUES ($1, $2, $3, $4, $5)',
        [user.username, user.password, user.role, user.doctor_id || null, user.full_name]
      );
    }
    
    console.log('✅ Пользователи созданы');
  }
  
  // Проверяем, есть ли материалы
  const materials = await db.all('SELECT * FROM materials');
  
  if (materials.length === 0) {
    console.log('📦 Создание материалов по умолчанию...');
    
    const defaultMaterials = [
      { name: 'Перчатки медицинские', unit: 'пара', price: 0.50, stock: 100 },
      { name: 'Шприц одноразовый', unit: 'шт', price: 0.30, stock: 50 },
      { name: 'Бинт стерильный', unit: 'шт', price: 1.20, stock: 30 }
    ];
    
    for (const material of defaultMaterials) {
      await db.run(
        'INSERT INTO materials (name, unit, price, stock) VALUES ($1, $2, $3, $4)',
        [material.name, material.unit, material.price, material.stock]
      );
    }
    
    console.log('✅ Материалы созданы');
  }
  
  // Проверяем, есть ли услуги
  const services = await db.all('SELECT * FROM services');
  
  if (services.length === 0) {
    console.log('💼 Импорт услуг...');
    
    try {
      const servicesData = require('./migrations/services_data');
      
      for (const service of servicesData) {
        await db.run(
          'INSERT INTO services (name, price, category) VALUES ($1, $2, $3)',
          [service.name, service.price, service.category || null]
        );
      }
      
      console.log(`✅ Импортировано услуг: ${servicesData.length}`);
    } catch (error) {
      console.log('⚠️ Файл services_data.js не найден, пропускаем импорт услуг');
    }
  }
}

module.exports = { initializeDatabase };

