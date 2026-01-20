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
    
    await migrateMaterialTransactionsColumns();
    console.log('✅ Миграция колонок material_transactions проверена');
    
    await migrateAppointmentsClientIdNullable();
    console.log('✅ Миграция client_id в appointments проверена');
    
    await initializeDefaultData();
    console.log('✅ Данные по умолчанию проверены');
    
    await migrateMaterialWriteoffs();
    console.log('✅ Миграция списаний проверена');
    
    await migrateClientTreatmentPlan();
    console.log('✅ Миграция плана лечения проверена');
    
    await migrateClientDateOfBirthPassport();
    console.log('✅ Миграция даты рождения и паспорта проверена');
    
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
  
  // Таблица транзакций материалов (приходы и списания)
  await db.run(`
    CREATE TABLE IF NOT EXISTS material_transactions (
      id SERIAL PRIMARY KEY,
      material_id INTEGER NOT NULL,
      transaction_type TEXT NOT NULL CHECK (transaction_type IN ('receipt', 'writeoff')),
      quantity REAL NOT NULL,
      price REAL,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER,
      appointment_id INTEGER,
      FOREIGN KEY (material_id) REFERENCES materials(id),
      FOREIGN KEY (appointment_id) REFERENCES appointments(id)
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
  
  // Таблица составных услуг (готовые карточки услуг)
  await db.run(`
    CREATE TABLE IF NOT EXISTS composite_services (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Таблица связи составных услуг с подуслугами
  await db.run(`
    CREATE TABLE IF NOT EXISTS composite_service_services (
      id SERIAL PRIMARY KEY,
      composite_service_id INTEGER NOT NULL,
      service_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      display_order INTEGER DEFAULT 0,
      FOREIGN KEY (composite_service_id) REFERENCES composite_services(id) ON DELETE CASCADE,
      FOREIGN KEY (service_id) REFERENCES services(id)
    )
  `);
  
  // Таблица связи составных услуг с материалами
  await db.run(`
    CREATE TABLE IF NOT EXISTS composite_service_materials (
      id SERIAL PRIMARY KEY,
      composite_service_id INTEGER NOT NULL,
      material_id INTEGER NOT NULL,
      quantity REAL DEFAULT 1,
      display_order INTEGER DEFAULT 0,
      FOREIGN KEY (composite_service_id) REFERENCES composite_services(id) ON DELETE CASCADE,
      FOREIGN KEY (material_id) REFERENCES materials(id)
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

// Миграция: добавление колонки appointment_id в material_transactions
async function migrateMaterialTransactionsColumns() {
  try {
    const { usePostgres } = require('./database');
    
    if (!usePostgres) {
      console.log('   ℹ️  Миграция колонок доступна только для PostgreSQL');
      return;
    }

    // Проверяем, существует ли колонка appointment_id
    const columnExists = await db.all(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'material_transactions' 
        AND column_name = 'appointment_id'
    `);

    if (columnExists.length === 0) {
      console.log('   🔄 Добавление колонки appointment_id в material_transactions...');
      
      // Добавляем колонку appointment_id
      await db.run(`
        ALTER TABLE material_transactions 
        ADD COLUMN appointment_id INTEGER
      `);
      
      // Добавляем внешний ключ
      try {
        await db.run(`
          ALTER TABLE material_transactions 
          ADD CONSTRAINT fk_material_transactions_appointment 
          FOREIGN KEY (appointment_id) REFERENCES appointments(id)
        `);
      } catch (fkError) {
        // Если внешний ключ уже существует, игнорируем ошибку
        if (!fkError.message.includes('already exists')) {
          throw fkError;
        }
      }
      
      console.log('   ✅ Колонка appointment_id добавлена');
    } else {
      console.log('   ✅ Колонка appointment_id уже существует');
    }
  } catch (error) {
    console.error('   ⚠️  Ошибка миграции колонок:', error.message);
    // Не прерываем инициализацию, если миграция не удалась
  }
}

// Миграция: разрешить NULL для client_id в appointments
async function migrateAppointmentsClientIdNullable() {
  try {
    const { usePostgres } = require('./database');
    
    if (!usePostgres) {
      console.log('   ℹ️  Миграция client_id доступна только для PostgreSQL');
      return;
    }

    // Проверяем, можно ли уже установить NULL для client_id
    const columnInfo = await db.all(`
      SELECT is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'appointments' 
        AND column_name = 'client_id'
    `);

    if (columnInfo.length > 0 && columnInfo[0].is_nullable === 'NO') {
      console.log('   🔄 Изменение client_id на NULLABLE в appointments...');
      
      // Сначала удаляем старый внешний ключ (если есть)
      try {
        await db.run(`
          ALTER TABLE appointments 
          DROP CONSTRAINT IF EXISTS appointments_client_id_fkey
        `);
      } catch (fkError) {
        // Игнорируем ошибку, если ограничение не существует
        console.log('   ℹ️  Старое ограничение не найдено или уже удалено');
      }
      
      // Изменяем колонку, чтобы разрешить NULL
      await db.run(`
        ALTER TABLE appointments 
        ALTER COLUMN client_id DROP NOT NULL
      `);
      
      // Добавляем новый внешний ключ с ON DELETE SET NULL
      try {
        await db.run(`
          ALTER TABLE appointments 
          ADD CONSTRAINT appointments_client_id_fkey 
          FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
        `);
      } catch (fkError) {
        // Если ограничение уже существует, игнорируем ошибку
        if (!fkError.message.includes('already exists')) {
          throw fkError;
        }
      }
      
      console.log('   ✅ client_id теперь может быть NULL');
    } else {
      console.log('   ✅ client_id уже может быть NULL');
    }
  } catch (error) {
    console.error('   ⚠️  Ошибка миграции client_id:', error.message);
    // Не прерываем инициализацию, если миграция не удалась
  }
}

// Миграция: создание записей о списаниях для существующих appointment_materials
async function migrateMaterialWriteoffs() {
  try {
    const { usePostgres } = require('./database');
    
    if (!usePostgres) {
      console.log('   ℹ️  Миграция списаний доступна только для PostgreSQL');
      return;
    }

    // Проверяем, есть ли appointment_materials без соответствующих записей в material_transactions
    const missingWriteoffs = await db.all(`
      SELECT 
        am.appointment_id,
        am.material_id,
        am.quantity,
        a.doctor_id,
        m.price
      FROM appointment_materials am
      JOIN appointments a ON am.appointment_id = a.id
      JOIN materials m ON am.material_id = m.id
      WHERE NOT EXISTS (
        SELECT 1 
        FROM material_transactions mt 
        WHERE mt.appointment_id = am.appointment_id 
          AND mt.material_id = am.material_id
          AND mt.transaction_type = 'writeoff'
      )
      AND a.status IN ('ready_for_payment', 'completed')
    `);

    if (missingWriteoffs.length > 0) {
      console.log(`   🔄 Создание записей о списаниях для ${missingWriteoffs.length} существующих материалов...`);
      
      for (const item of missingWriteoffs) {
        // Создаем запись о списании
        await db.run(`
          INSERT INTO material_transactions 
            (material_id, transaction_type, quantity, price, notes, appointment_id, created_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          item.material_id,
          'writeoff',
          item.quantity,
          item.price,
          `Автоматическое списание при завершении приема #${item.appointment_id} (миграция)`,
          item.appointment_id,
          item.doctor_id
        ]);
      }
      
      console.log(`   ✅ Создано ${missingWriteoffs.length} записей о списаниях`);
    } else {
      console.log('   ✅ Все списания уже созданы');
    }
    
    // Обновляем created_by для записей, где есть appointment_id с doctor_id
    // Обновляем даже если created_by уже заполнен, чтобы синхронизировать данные
    const updateResult = await db.run(`
      UPDATE material_transactions mt
      SET created_by = (
        SELECT a.doctor_id 
        FROM appointments a 
        WHERE a.id = mt.appointment_id 
          AND a.doctor_id IS NOT NULL
        LIMIT 1
      )
      WHERE mt.transaction_type = 'writeoff'
        AND mt.appointment_id IS NOT NULL
        AND EXISTS (
          SELECT 1 
          FROM appointments a 
          WHERE a.id = mt.appointment_id 
            AND a.doctor_id IS NOT NULL
        )
        AND (
          mt.created_by IS NULL 
          OR mt.created_by != (
            SELECT a.doctor_id 
            FROM appointments a 
            WHERE a.id = mt.appointment_id 
            LIMIT 1
          )
        )
    `);
    
    if (updateResult && updateResult.changes > 0) {
      console.log(`   🔄 Обновлено ${updateResult.changes} записей о списаниях с информацией о враче из карточки приема`);
    } else {
      // Проверяем, сколько записей без врача осталось
      const withoutDoctor = await db.all(`
        SELECT COUNT(*) as count
        FROM material_transactions mt
        LEFT JOIN appointments a ON mt.appointment_id = a.id
        LEFT JOIN doctors d ON COALESCE(a.doctor_id, mt.created_by) = d.id
        WHERE mt.transaction_type = 'writeoff'
          AND mt.appointment_id IS NOT NULL
          AND d.id IS NULL
      `);
      const count = withoutDoctor[0]?.count || 0;
      if (count > 0) {
        console.log(`   ⚠️  Осталось ${count} записей о списаниях без врача (возможно, в appointments нет doctor_id)`);
      } else {
        console.log('   ✅ Все записи о списаниях синхронизированы с карточками приемов');
      }
    }
  } catch (error) {
    console.error('   ⚠️  Ошибка миграции списаний:', error.message);
    // Не прерываем инициализацию, если миграция не удалась
  }
}

// Инициализация данных по умолчанию
async function initializeDefaultData() {
  console.log('📝 Проверка данных по умолчанию...');
  
  const bcrypt = require('bcrypt');
  
  // Проверяем, есть ли пользователи
  const users = await db.all('SELECT * FROM users');
  
  if (users.length === 0) {
    console.log('👥 Создание главного администратора по умолчанию...');
    
    const bcrypt = require('bcrypt');
    
    // Проверяем, есть ли переменные окружения для создания первого администратора
    const initialAdminUsername = process.env.INITIAL_ADMIN_USERNAME || 'admin';
    const initialAdminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'admin';
    
    try {
      // Хешируем пароль
      const hashedPassword = await bcrypt.hash(initialAdminPassword, 10);
      
      // Создаем главного администратора
      await db.query(
        'INSERT INTO users (username, password, role, full_name) VALUES ($1, $2, $3, $4)',
        [initialAdminUsername, hashedPassword, 'superadmin', 'Главный администратор']
      );
      
      console.log(`✅ Главный администратор "${initialAdminUsername}" создан`);
      console.log(`   Логин: ${initialAdminUsername}`);
      console.log(`   Пароль: ${initialAdminPassword}`);
      console.log('⚠️  ВАЖНО: После первого входа обязательно смените пароль через интерфейс!');
    } catch (error) {
      console.error('❌ Ошибка создания главного администратора:', error.message);
      console.log('   Создайте главного администратора через API endpoint /api/setup/first-admin');
    }
  } else {
    // Проверяем, есть ли врачи без doctor_id
    const doctorsWithoutId = await db.all(
      "SELECT * FROM users WHERE role = 'doctor' AND doctor_id IS NULL"
    );
    
    if (doctorsWithoutId.length > 0) {
      console.log(`🔧 Обновление ${doctorsWithoutId.length} пользователей-врачей без doctor_id...`);
      
      // Получаем первого врача из базы
      const firstDoctor = await db.get('SELECT id FROM doctors ORDER BY id LIMIT 1');
      
      if (firstDoctor) {
        // Обновляем всех врачей без doctor_id
        for (const user of doctorsWithoutId) {
          await db.run(
            'UPDATE users SET doctor_id = $1 WHERE id = $2',
            [firstDoctor.id, user.id]
          );
        }
        console.log('✅ Пользователи-врачи обновлены');
      }
    }
    
    // Проверяем, есть ли пользователи с открытыми паролями (без хеширования)
    const usersWithPlainPasswords = await db.all(
      "SELECT id, username FROM users WHERE password NOT LIKE '$2%'"
    );
    
    if (usersWithPlainPasswords.length > 0) {
      console.log(`⚠️  Найдено ${usersWithPlainPasswords.length} пользователей с открытыми паролями.`);
      console.log('   Рекомендуется обновить пароли через интерфейс для безопасности.');
    }
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

// Миграция: добавление поля treatment_plan в таблицу clients
async function migrateClientTreatmentPlan() {
  try {
    const { usePostgres } = require('./database');
    
    if (!usePostgres) {
      console.log('   ℹ️  Миграция treatment_plan доступна только для PostgreSQL');
      return;
    }

    // Проверяем, существует ли колонка treatment_plan
    const columnExists = await db.all(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'clients' 
        AND column_name = 'treatment_plan'
    `);

    if (columnExists.length === 0) {
      console.log('   🔄 Добавление поля treatment_plan в таблицу clients...');
      
      await db.run(`
        ALTER TABLE clients 
        ADD COLUMN treatment_plan TEXT
      `);
      
      console.log('   ✅ Поле treatment_plan добавлено');
    } else {
      console.log('   ✅ Поле treatment_plan уже существует');
    }
  } catch (error) {
    console.error('   ⚠️  Ошибка миграции treatment_plan:', error.message);
    // Не прерываем инициализацию, если миграция не удалась
  }
}

// Миграция: добавление полей date_of_birth и passport_number в таблицу clients
async function migrateClientDateOfBirthPassport() {
  try {
    const { usePostgres } = require('./database');
    
    if (!usePostgres) {
      console.log('   ℹ️  Миграция date_of_birth/passport_number доступна только для PostgreSQL');
      return;
    }

    for (const { column, type, desc } of [
      { column: 'date_of_birth', type: 'DATE', desc: 'даты рождения' },
      { column: 'passport_number', type: 'TEXT', desc: 'номера паспорта' }
    ]) {
      const columnExists = await db.all(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'clients' AND column_name = $1
      `, [column]);

      if (columnExists.length === 0) {
        console.log(`   🔄 Добавление поля ${column} в таблицу clients...`);
        await db.run(`ALTER TABLE clients ADD COLUMN ${column} ${type}`);
        console.log(`   ✅ Поле ${desc} добавлено`);
      } else {
        console.log(`   ✅ Поле ${desc} уже существует`);
      }
    }
  } catch (error) {
    console.error('   ⚠️  Ошибка миграции date_of_birth/passport_number:', error.message);
  }
}

module.exports = { initializeDatabase };

