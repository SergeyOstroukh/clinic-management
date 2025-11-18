require('dotenv').config();
const { db, usePostgres } = require('./database');

async function migrateWorkDate() {
  try {
    console.log('🔄 Миграция work_date: DATE -> VARCHAR(50)');
    
    if (usePostgres) {
      // Для PostgreSQL: изменяем тип колонки
      console.log('📊 Используется PostgreSQL');
      
      // Проверяем текущий тип колонки
      const checkType = await db.query(`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name = 'doctor_specific_dates' 
        AND column_name = 'work_date'
      `);
      
      if (checkType.length > 0 && checkType[0].data_type === 'date') {
        console.log('   Текущий тип: DATE');
        console.log('   Изменяю тип на VARCHAR(50)...');
        
        // Создаем временную колонку
        await db.query(`
          ALTER TABLE doctor_specific_dates 
          ADD COLUMN work_date_new VARCHAR(50)
        `);
        
        // Копируем данные, конвертируя DATE в строку YYYY-MM-DD
        await db.query(`
          UPDATE doctor_specific_dates 
          SET work_date_new = TO_CHAR(work_date, 'YYYY-MM-DD')
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
        
        console.log('✅ Миграция завершена успешно!');
      } else if (checkType.length > 0 && checkType[0].data_type === 'character varying') {
        console.log('✅ Колонка уже имеет тип VARCHAR, миграция не требуется');
      } else {
        console.log('⚠️  Колонка work_date не найдена или имеет неожиданный тип');
      }
    } else {
      // Для SQLite: изменяем тип колонки (SQLite не поддерживает ALTER COLUMN напрямую)
      console.log('📊 Используется SQLite');
      console.log('   SQLite не требует миграции - тип TEXT уже используется');
      console.log('✅ Миграция не требуется для SQLite');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка миграции:', error);
    process.exit(1);
  }
}

migrateWorkDate();

