require('dotenv').config();
const readline = require('readline');
const { db } = require('./database');

// Проверяем аргумент командной строки для автоматического подтверждения
const autoConfirm = process.argv.includes('--yes') || process.argv.includes('-y');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function clearAppointments() {
  try {
    // Показываем информацию о подключении к БД
    const dbUrl = process.env.DATABASE_URL || 'не указан';
    const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') || dbUrl.includes('postgresql://postgres');
    
    console.log('\n🔍 Информация о подключении к базе данных:');
    if (isLocal) {
      console.log('   ✅ Локальная база данных (localhost)');
    } else {
      console.log('   ⚠️  УДАЛЕННАЯ база данных!');
      console.log(`   URL: ${dbUrl.substring(0, 50)}...`);
    }
    
    // Сначала показываем количество записей
    const countResult = await db.query('SELECT COUNT(*) as count FROM appointments');
    const count = countResult[0]?.count || 0;
    
    console.log(`\n📊 Найдено записей в базе: ${count}`);
    
    if (count === 0) {
      console.log('✅ Записей нет, нечего удалять.');
      rl.close();
      process.exit(0);
    }
    
    // Запрашиваем подтверждение
    console.log('\n⚠️  ВНИМАНИЕ: Это удалит ВСЕ записи пациентов (appointments)!');
    if (!isLocal) {
      console.log('   ⚠️  ВНИМАНИЕ: Вы подключены к УДАЛЕННОЙ базе данных!');
      console.log('   ⚠️  Это может удалить данные на продакшене!');
    }
    console.log('   ✅ Услуги (services) останутся нетронутыми');
    console.log('   ✅ Расписание врачей (schedules) останется нетронутым');
    console.log('   📝 Будут удалены только записи и их связи с услугами/материалами');
    
    let answer;
    if (autoConfirm) {
      console.log('\n✅ Автоматическое подтверждение (--yes)');
      answer = 'ДА';
    } else {
      answer = await question('\nВы уверены? Введите "ДА" для подтверждения: ');
    }
    
    if (answer.trim().toUpperCase() !== 'ДА') {
      console.log('❌ Операция отменена.');
      rl.close();
      process.exit(0);
    }
    
    console.log('\n🗑️  Начинаю очистку записей пациентов...');
    console.log('   (Услуги и расписание врачей останутся нетронутыми)');
    
    // Сначала удаляем связанные данные из записей
    console.log('   Удаляю услуги из записей (appointment_services)...');
    const servicesResult = await db.run('DELETE FROM appointment_services');
    console.log(`      Удалено связей с услугами: ${servicesResult.changes || 0}`);
    
    console.log('   Удаляю материалы из записей (appointment_materials)...');
    const materialsResult = await db.run('DELETE FROM appointment_materials');
    console.log(`      Удалено связей с материалами: ${materialsResult.changes || 0}`);
    
    // Затем удаляем сами записи
    console.log('   Удаляю записи пациентов (appointments)...');
    const result = await db.run('DELETE FROM appointments');
    
    console.log(`\n✅ Успешно удалено записей: ${result.changes || 0}`);
    console.log('📝 Связанные услуги и материалы из записей также удалены.');
    console.log('✅ Услуги (services) и расписание врачей (schedules) остались нетронутыми.');
    console.log('\n✨ Записи пациентов очищены!');
    
    rl.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Ошибка при очистке записей:', error);
    rl.close();
    process.exit(1);
  }
}

clearAppointments();

