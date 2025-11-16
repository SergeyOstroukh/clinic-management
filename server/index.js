require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Middleware
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
};
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Инициализация базы данных
const dbPath = path.join(__dirname, 'clinic.db');
const db = new sqlite3.Database(dbPath);

// Создание таблиц
db.serialize(() => {
  // Таблица клиентов
  db.run(`CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Таблица услуг
  db.run(`CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Таблица записей
  db.run(`CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    appointment_date DATETIME NOT NULL,
    status TEXT DEFAULT 'scheduled',
    notes TEXT,
    total_price REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id)
  )`);

  // Таблица связи записей и услуг (многие ко многим)
  db.run(`CREATE TABLE IF NOT EXISTS appointment_services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    appointment_id INTEGER NOT NULL,
    service_id INTEGER NOT NULL,
    quantity INTEGER DEFAULT 1,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id),
    FOREIGN KEY (service_id) REFERENCES services(id)
  )`);

  // Добавляем тестовые данные, если база пустая
  db.get("SELECT COUNT(*) as count FROM services", (err, row) => {
    if (row.count === 0) {
      const defaultServices = [
        ['Консультация', 1500, 'Первичная консультация врача'],
        ['Осмотр', 2000, 'Полный осмотр пациента'],
        ['Анализы', 3000, 'Лабораторные анализы'],
        ['Процедура', 2500, 'Лечебная процедура']
      ];
      const stmt = db.prepare("INSERT INTO services (name, price, description) VALUES (?, ?, ?)");
      defaultServices.forEach(service => {
        stmt.run(service);
      });
      stmt.finalize();
    }
  });
});

// ========== API ROUTES ==========

// Получить всех клиентов
app.get('/api/clients', (req, res) => {
  db.all("SELECT * FROM clients ORDER BY created_at DESC", (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Создать клиента
app.post('/api/clients', (req, res) => {
  const { name, phone, email, notes } = req.body;
  db.run(
    "INSERT INTO clients (name, phone, email, notes) VALUES (?, ?, ?, ?)",
    [name, phone || null, email || null, notes || null],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, name, phone, email, notes });
    }
  );
});

// Получить все услуги
app.get('/api/services', (req, res) => {
  db.all("SELECT * FROM services ORDER BY name", (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Создать услугу
app.post('/api/services', (req, res) => {
  const { name, price, description } = req.body;
  db.run(
    "INSERT INTO services (name, price, description) VALUES (?, ?, ?)",
    [name, price, description || null],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, name, price, description });
    }
  );
});

// Обновить услугу
app.put('/api/services/:id', (req, res) => {
  const { name, price, description } = req.body;
  db.run(
    "UPDATE services SET name = ?, price = ?, description = ? WHERE id = ?",
    [name, price, description || null, req.params.id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Услуга обновлена', changes: this.changes });
    }
  );
});

// Удалить услугу
app.delete('/api/services/:id', (req, res) => {
  db.run("DELETE FROM services WHERE id = ?", [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Услуга удалена', changes: this.changes });
  });
});

// Получить все записи с информацией о клиентах и услугах
app.get('/api/appointments', (req, res) => {
  const query = `
    SELECT 
      a.*,
      c.name as client_name,
      c.phone as client_phone,
      c.email as client_email,
      GROUP_CONCAT(s.name || ' (' || s.price || ' руб.)') as services_list
    FROM appointments a
    LEFT JOIN clients c ON a.client_id = c.id
    LEFT JOIN appointment_services aps ON a.id = aps.appointment_id
    LEFT JOIN services s ON aps.service_id = s.id
    GROUP BY a.id
    ORDER BY a.appointment_date DESC
  `;
  
  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Создать запись
app.post('/api/appointments', (req, res) => {
  const { client_id, appointment_date, services, notes } = req.body;
  
  // Сначала создаем запись
  db.run(
    "INSERT INTO appointments (client_id, appointment_date, notes) VALUES (?, ?, ?)",
    [client_id, appointment_date, notes || null],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      const appointmentId = this.lastID;
      let totalPrice = 0;
      
      // Добавляем услуги и считаем общую стоимость
      if (services && services.length > 0) {
        const stmt = db.prepare("INSERT INTO appointment_services (appointment_id, service_id, quantity) VALUES (?, ?, ?)");
        let completed = 0;
        
        services.forEach(({ service_id, quantity = 1 }) => {
          // Получаем цену услуги
          db.get("SELECT price FROM services WHERE id = ?", [service_id], (err, service) => {
            if (!err && service) {
              totalPrice += service.price * quantity;
            }
            
            stmt.run([appointmentId, service_id, quantity], (err) => {
              if (err) {
                console.error('Ошибка добавления услуги:', err);
              }
              
              completed++;
              if (completed === services.length) {
                stmt.finalize();
                
                // Обновляем общую стоимость записи
                db.run(
                  "UPDATE appointments SET total_price = ? WHERE id = ?",
                  [totalPrice, appointmentId],
                  (err) => {
                    if (err) {
                      console.error('Ошибка обновления стоимости:', err);
                    }
                    res.json({ 
                      id: appointmentId, 
                      client_id, 
                      appointment_date, 
                      total_price: totalPrice,
                      message: 'Запись создана успешно' 
                    });
                  }
                );
              }
            });
          });
        });
      } else {
        res.json({ 
          id: appointmentId, 
          client_id, 
          appointment_date, 
          total_price: 0,
          message: 'Запись создана успешно' 
        });
      }
    }
  );
});

// Обновить запись
app.put('/api/appointments/:id', (req, res) => {
  const { appointment_date, services, notes, status } = req.body;
  
  db.run(
    "UPDATE appointments SET appointment_date = ?, notes = ?, status = ? WHERE id = ?",
    [appointment_date, notes || null, status || 'scheduled', req.params.id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // Если обновляются услуги, пересчитываем стоимость
      if (services) {
        // Удаляем старые услуги
        db.run("DELETE FROM appointment_services WHERE appointment_id = ?", [req.params.id], () => {
          // Добавляем новые услуги
          let totalPrice = 0;
          if (services.length > 0) {
            const stmt = db.prepare("INSERT INTO appointment_services (appointment_id, service_id, quantity) VALUES (?, ?, ?)");
            let completed = 0;
            
            services.forEach(({ service_id, quantity = 1 }) => {
              db.get("SELECT price FROM services WHERE id = ?", [service_id], (err, service) => {
                if (!err && service) {
                  totalPrice += service.price * quantity;
                }
                
                stmt.run([req.params.id, service_id, quantity], () => {
                  completed++;
                  if (completed === services.length) {
                    stmt.finalize();
                    db.run("UPDATE appointments SET total_price = ? WHERE id = ?", [totalPrice, req.params.id]);
                    res.json({ message: 'Запись обновлена', total_price: totalPrice });
                  }
                });
              });
            });
          } else {
            db.run("UPDATE appointments SET total_price = 0 WHERE id = ?", [req.params.id]);
            res.json({ message: 'Запись обновлена', total_price: 0 });
          }
        });
      } else {
        res.json({ message: 'Запись обновлена' });
      }
    }
  );
});

// Удалить запись
app.delete('/api/appointments/:id', (req, res) => {
  db.run("DELETE FROM appointment_services WHERE appointment_id = ?", [req.params.id], () => {
    db.run("DELETE FROM appointments WHERE id = ?", [req.params.id], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Запись удалена', changes: this.changes });
    });
  });
});

// Получить записи на определенную дату
app.get('/api/appointments/date/:date', (req, res) => {
  const date = req.params.date;
  const query = `
    SELECT 
      a.*,
      c.name as client_name,
      c.phone as client_phone
    FROM appointments a
    LEFT JOIN clients c ON a.client_id = c.id
    WHERE DATE(a.appointment_date) = DATE(?)
    ORDER BY a.appointment_date
  `;
  
  db.all(query, [date], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// В продакшене раздаем статические файлы React и SPA роутинг
if (NODE_ENV === 'production') {
  // Сначала раздаем статические файлы (CSS, JS, изображения)
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  // Все остальные запросы отправляем на React приложение (для SPA роутинга)
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📊 API доступен по адресу http://localhost:${PORT}/api`);
  if (NODE_ENV === 'production') {
    console.log(`🌐 Приложение доступно на http://localhost:${PORT}`);
  }
});

