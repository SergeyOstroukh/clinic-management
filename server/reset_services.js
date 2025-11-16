// Скрипт для очистки и загрузки услуг
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const servicesData = require('./migrations/services_data');

const dbPath = path.join(__dirname, 'clinic.db');
const db = new sqlite3.Database(dbPath);

console.log('🔄 Начинаем загрузку услуг...');

db.serialize(() => {
  // Удаляем все услуги
  db.run("DELETE FROM services", (err) => {
    if (err) {
      console.error('❌ Ошибка при удалении услуг:', err.message);
      db.close();
      return;
    }
    console.log('✅ Старые услуги удалены');

    // Добавляем новые услуги
    const stmt = db.prepare("INSERT INTO services (name, price, description) VALUES (?, ?, ?)");
    let count = 0;
    
    servicesData.forEach(service => {
      stmt.run([service.name, service.price, service.description || ''], (err) => {
        if (err) {
          console.error(`❌ Ошибка при добавлении услуги "${service.name}":`, err.message);
        } else {
          count++;
        }
      });
    });
    
    stmt.finalize(() => {
      console.log(`✅ Загружено ${count} из ${servicesData.length} услуг`);
      console.log('🎉 Готово!');
      db.close();
    });
  });
});

