require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

// Импорт модуля базы данных
const { db, usePostgres } = require('./database');
const { initializeDatabase } = require('./init-db');

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
initializeDatabase().then(() => {
  console.log('✅ База данных готова к работе');
}).catch(err => {
  console.error('❌ Ошибка инициализации БД:', err);
  process.exit(1);
});

// Вспомогательная функция для параметров запросов
function param(index) {
  return usePostgres ? `$${index}` : '?';
}

// ======================
// API ENDPOINTS
// ======================

// ========== CLIENTS ==========

// Получить всех клиентов
app.get('/api/clients', async (req, res) => {
  try {
    const clients = await db.all('SELECT * FROM clients ORDER BY "lastName", "firstName"');
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Создать клиента
app.post('/api/clients', async (req, res) => {
  const { lastName, firstName, middleName, phone, address, email, notes } = req.body;
  
  try {
    const result = await db.query(
      'INSERT INTO clients ("lastName", "firstName", "middleName", phone, address, email, notes) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [lastName, firstName, middleName, phone, address, email, notes]
    );
    res.json({ id: result[0].id, lastName, firstName, middleName, phone, address, email, notes });
  } catch (error) {
    console.error('Ошибка создания клиента:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== SERVICES ==========

// Получить все услуги
app.get('/api/services', async (req, res) => {
  try {
    const services = await db.all('SELECT * FROM services ORDER BY category, name');
    res.json(services);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Создать услугу
app.post('/api/services', async (req, res) => {
  const { name, price, description, category } = req.body;
  
  try {
    if (usePostgres) {
      const result = await db.query(
        'INSERT INTO services (name, price, description, category) VALUES ($1, $2, $3, $4) RETURNING id',
        [name, price, description || null, category || null]
      );
      res.json({ id: result[0].id, name, price, description, category });
    } else {
      const result = await db.run(
        'INSERT INTO services (name, price, description, category) VALUES (?, ?, ?, ?)',
        [name, price, description || null, category || null]
      );
      res.json({ id: result.lastID, name, price, description, category });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Обновить услугу
app.put('/api/services/:id', async (req, res) => {
  const { name, price, description, category } = req.body;
  
  try {
    const result = await db.run(
      usePostgres
        ? 'UPDATE services SET name = $1, price = $2, description = $3, category = $4 WHERE id = $5'
        : 'UPDATE services SET name = ?, price = ?, description = ?, category = ? WHERE id = ?',
      [name, price, description || null, category || null, req.params.id]
    );
    res.json({ message: 'Услуга обновлена', changes: result.changes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Удалить услугу
app.delete('/api/services/:id', async (req, res) => {
  try {
    const result = await db.run(
      usePostgres ? 'DELETE FROM services WHERE id = $1' : 'DELETE FROM services WHERE id = ?',
      [req.params.id]
    );
    res.json({ message: 'Услуга удалена', changes: result.changes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== DOCTORS ==========

// Получить всех врачей
app.get('/api/doctors', async (req, res) => {
  try {
    const doctors = await db.all('SELECT * FROM doctors ORDER BY "lastName", "firstName"');
    res.json(doctors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Создать врача
app.post('/api/doctors', async (req, res) => {
  const { lastName, firstName, middleName, specialization, phone, email } = req.body;
  
  try {
    const result = await db.query(
      'INSERT INTO doctors ("lastName", "firstName", "middleName", specialization, phone, email) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [lastName, firstName, middleName, specialization, phone, email]
    );
    res.json({ id: result[0].id, lastName, firstName, middleName, specialization, phone, email });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Обновить врача
app.put('/api/doctors/:id', async (req, res) => {
  const { lastName, firstName, middleName, specialization, phone, email } = req.body;
  
  try {
    const result = await db.run(
      'UPDATE doctors SET "lastName" = $1, "firstName" = $2, "middleName" = $3, specialization = $4, phone = $5, email = $6 WHERE id = $7',
      [lastName, firstName, middleName, specialization, phone, email, req.params.id]
    );
    res.json({ message: 'Врач обновлен', changes: result.changes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Удалить врача
app.delete('/api/doctors/:id', async (req, res) => {
  try {
    const result = await db.run(
      usePostgres ? 'DELETE FROM doctors WHERE id = $1' : 'DELETE FROM doctors WHERE id = ?',
      [req.params.id]
    );
    res.json({ message: 'Врач удален', changes: result.changes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== MATERIALS ==========

// Получить все материалы
app.get('/api/materials', async (req, res) => {
  try {
    const materials = await db.all('SELECT * FROM materials ORDER BY name');
    res.json(materials);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Создать материал
app.post('/api/materials', async (req, res) => {
  const { name, unit, price, stock, description } = req.body;
  
  try {
    if (usePostgres) {
      const result = await db.query(
        'INSERT INTO materials (name, unit, price, stock, description) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [name, unit, price, stock || 0, description]
      );
      res.json({ id: result[0].id, name, unit, price, stock, description });
    } else {
      const result = await db.run(
        'INSERT INTO materials (name, unit, price, stock, description) VALUES (?, ?, ?, ?, ?)',
        [name, unit, price, stock || 0, description]
      );
      res.json({ id: result.lastID, name, unit, price, stock, description });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Обновить материал
app.put('/api/materials/:id', async (req, res) => {
  const { name, unit, price, stock, description } = req.body;
  
  try {
    const result = await db.run(
      usePostgres
        ? 'UPDATE materials SET name = $1, unit = $2, price = $3, stock = $4, description = $5 WHERE id = $6'
        : 'UPDATE materials SET name = ?, unit = ?, price = ?, stock = ?, description = ? WHERE id = ?',
      [name, unit, price, stock, description, req.params.id]
    );
    res.json({ message: 'Материал обновлен', changes: result.changes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Удалить материал
app.delete('/api/materials/:id', async (req, res) => {
  try {
    const result = await db.run(
      usePostgres ? 'DELETE FROM materials WHERE id = $1' : 'DELETE FROM materials WHERE id = ?',
      [req.params.id]
    );
    res.json({ message: 'Материал удален', changes: result.changes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== APPOINTMENTS ==========

// Получить все записи с информацией о клиентах и услугах
app.get('/api/appointments', async (req, res) => {
  try {
    const appointments = await db.all(`
      SELECT 
        a.*,
        d."lastName" as doctor_lastName,
        d."firstName" as doctor_firstName,
        d."middleName" as doctor_middleName,
        d.specialization as doctor_specialization
      FROM appointments a
      LEFT JOIN doctors d ON a.doctor_id = d.id
      ORDER BY a.id ASC
    `);
    
    // Получаем услуги и материалы для каждой записи
    const appointmentsWithData = await Promise.all(appointments.map(async (appointment) => {
      // Получаем услуги
      const services = await db.all(
        usePostgres
          ? `SELECT aps.service_id, aps.quantity, s.name, s.price 
             FROM appointment_services aps
             JOIN services s ON aps.service_id = s.id
             WHERE aps.appointment_id = $1`
          : `SELECT aps.service_id, aps.quantity, s.name, s.price 
             FROM appointment_services aps
             JOIN services s ON aps.service_id = s.id
             WHERE aps.appointment_id = ?`,
        [appointment.id]
      );
      
      // Получаем материалы
      const materials = await db.all(
        usePostgres
          ? `SELECT apm.material_id, apm.quantity, m.name, m.price, m.unit
             FROM appointment_materials apm
             JOIN materials m ON apm.material_id = m.id
             WHERE apm.appointment_id = $1`
          : `SELECT apm.material_id, apm.quantity, m.name, m.price, m.unit
             FROM appointment_materials apm
             JOIN materials m ON apm.material_id = m.id
             WHERE apm.appointment_id = ?`,
        [appointment.id]
      );
      
      return {
        ...appointment,
        services: services.map(s => ({
          service_id: s.service_id,
          name: s.name,
          price: s.price,
          quantity: s.quantity
        })),
        materials: materials.map(m => ({
          material_id: m.material_id,
          name: m.name,
          price: m.price,
          quantity: m.quantity,
          unit: m.unit
        }))
      };
    }));
    
    res.json(appointmentsWithData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Создать запись
app.post('/api/appointments', async (req, res) => {
  const { client_id, appointment_date, doctor_id, services, notes } = req.body;
  
  try {
    // Создаем запись
    let appointmentId;
    
    if (usePostgres) {
      const result = await db.query(
        'INSERT INTO appointments (client_id, appointment_date, doctor_id, notes, status) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [client_id, appointment_date, doctor_id, notes, 'scheduled']
      );
      appointmentId = result[0].id;
    } else {
      const result = await db.run(
        'INSERT INTO appointments (client_id, appointment_date, doctor_id, notes, status) VALUES (?, ?, ?, ?, ?)',
        [client_id, appointment_date, doctor_id, notes, 'scheduled']
      );
      appointmentId = result.lastID;
    }
    
    // Добавляем услуги
    if (services && services.length > 0) {
      for (const service of services) {
        await db.run(
          usePostgres
            ? 'INSERT INTO appointment_services (appointment_id, service_id, quantity) VALUES ($1, $2, $3)'
            : 'INSERT INTO appointment_services (appointment_id, service_id, quantity) VALUES (?, ?, ?)',
          [appointmentId, service.service_id, service.quantity || 1]
        );
      }
    }
    
    res.json({
      id: appointmentId,
      client_id,
      appointment_date,
      doctor_id,
      services,
      notes
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Обновить статус звонка
app.patch('/api/appointments/:id/call-status', async (req, res) => {
  const { called_today } = req.body;
  
  try {
    const result = await db.run(
      usePostgres
        ? 'UPDATE appointments SET called_today = $1 WHERE id = $2'
        : 'UPDATE appointments SET called_today = ? WHERE id = ?',
      [called_today ? true : false, req.params.id]
    );
    res.json({ message: 'Статус звонка обновлен', changes: result.changes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Обновить статус записи
app.patch('/api/appointments/:id/status', async (req, res) => {
  const { status, discount_amount } = req.body;
  
  try {
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;
    
    updateFields.push(usePostgres ? `status = $${paramIndex}` : 'status = ?');
    updateValues.push(status);
    paramIndex++;
    
    if (discount_amount !== undefined) {
      updateFields.push(usePostgres ? `discount_amount = $${paramIndex}` : 'discount_amount = ?');
      updateValues.push(discount_amount);
      paramIndex++;
    }
    
    updateValues.push(req.params.id);
    
    const result = await db.run(
      `UPDATE appointments SET ${updateFields.join(', ')} WHERE id = ${usePostgres ? `$${paramIndex}` : '?'}`,
      updateValues
    );
    
    res.json({ message: 'Статус обновлен', status, changes: result.changes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Завершить оплату
app.patch('/api/appointments/:id/complete-payment', async (req, res) => {
  const { discount_amount } = req.body;
  
  try {
    const result = await db.run(
      usePostgres
        ? 'UPDATE appointments SET status = $1, paid = $2, discount_amount = $3 WHERE id = $4'
        : 'UPDATE appointments SET status = ?, paid = ?, discount_amount = ? WHERE id = ?',
      ['completed', true, discount_amount || 0, req.params.id]
    );
    res.json({
      message: 'Оплата завершена',
      status: 'completed',
      paid: true,
      changes: result.changes
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Завершить прием (врач)
app.patch('/api/appointments/:id/complete-visit', async (req, res) => {
  const { diagnosis, services, materials } = req.body;
  
  try {
    // Удаляем старые услуги и материалы
    await db.run(
      usePostgres
        ? 'DELETE FROM appointment_services WHERE appointment_id = $1'
        : 'DELETE FROM appointment_services WHERE appointment_id = ?',
      [req.params.id]
    );
    
    await db.run(
      usePostgres
        ? 'DELETE FROM appointment_materials WHERE appointment_id = $1'
        : 'DELETE FROM appointment_materials WHERE appointment_id = ?',
      [req.params.id]
    );
    
    // Добавляем новые услуги
    if (services && services.length > 0) {
      for (const service of services) {
        await db.run(
          usePostgres
            ? 'INSERT INTO appointment_services (appointment_id, service_id, quantity) VALUES ($1, $2, $3)'
            : 'INSERT INTO appointment_services (appointment_id, service_id, quantity) VALUES (?, ?, ?)',
          [req.params.id, service.service_id, service.quantity || 1]
        );
      }
    }
    
    // Добавляем новые материалы
    if (materials && materials.length > 0) {
      for (const material of materials) {
        await db.run(
          usePostgres
            ? 'INSERT INTO appointment_materials (appointment_id, material_id, quantity) VALUES ($1, $2, $3)'
            : 'INSERT INTO appointment_materials (appointment_id, material_id, quantity) VALUES (?, ?, ?)',
          [req.params.id, material.material_id, material.quantity || 1]
        );
      }
    }
    
    // Рассчитываем общую стоимость
    let totalPrice = 0;
    
    // Стоимость услуг
    if (services && services.length > 0) {
      for (const service of services) {
        const serviceData = await db.get(
          usePostgres ? 'SELECT price FROM services WHERE id = $1' : 'SELECT price FROM services WHERE id = ?',
          [service.service_id]
        );
        if (serviceData) {
          totalPrice += serviceData.price * (service.quantity || 1);
        }
      }
    }
    
    // Стоимость материалов
    if (materials && materials.length > 0) {
      for (const material of materials) {
        const materialData = await db.get(
          usePostgres ? 'SELECT price FROM materials WHERE id = $1' : 'SELECT price FROM materials WHERE id = ?',
          [material.material_id]
        );
        if (materialData) {
          totalPrice += materialData.price * (material.quantity || 1);
        }
      }
    }
    
    // Обновляем запись
    await db.run(
      usePostgres
        ? 'UPDATE appointments SET diagnosis = $1, status = $2, total_price = $3 WHERE id = $4'
        : 'UPDATE appointments SET diagnosis = ?, status = ?, total_price = ? WHERE id = ?',
      [diagnosis, 'ready_for_payment', totalPrice, req.params.id]
    );
    
    res.json({ message: 'Прием завершен', status: 'ready_for_payment' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Получить историю визитов клиента
app.get('/api/clients/:id/appointments', async (req, res) => {
  try {
    const appointments = await db.all(
      usePostgres
        ? 'SELECT * FROM appointments WHERE client_id = $1 ORDER BY appointment_date DESC'
        : 'SELECT * FROM appointments WHERE client_id = ? ORDER BY appointment_date DESC',
      [req.params.id]
    );
    
    // Получаем услуги и материалы для каждой записи
    const appointmentsWithData = await Promise.all(appointments.map(async (appointment) => {
      // Получаем услуги
      const services = await db.all(
        usePostgres
          ? `SELECT aps.service_id, aps.quantity, s.name, s.price 
             FROM appointment_services aps
             JOIN services s ON aps.service_id = s.id
             WHERE aps.appointment_id = $1`
          : `SELECT aps.service_id, aps.quantity, s.name, s.price 
             FROM appointment_services aps
             JOIN services s ON aps.service_id = s.id
             WHERE aps.appointment_id = ?`,
        [appointment.id]
      );
      
      // Получаем материалы
      const materials = await db.all(
        usePostgres
          ? `SELECT apm.material_id, apm.quantity, m.name, m.price, m.unit
             FROM appointment_materials apm
             JOIN materials m ON apm.material_id = m.id
             WHERE apm.appointment_id = $1`
          : `SELECT apm.material_id, apm.quantity, m.name, m.price, m.unit
             FROM appointment_materials apm
             JOIN materials m ON apm.material_id = m.id
             WHERE apm.appointment_id = ?`,
        [appointment.id]
      );
      
      // Получаем врача
      const doctor = await db.get(
        'SELECT "lastName", "firstName", "middleName", specialization FROM doctors WHERE id = $1',
        [appointment.doctor_id]
      );
      
      return {
        ...appointment,
        services: services.map(s => ({
          service_id: s.service_id,
          name: s.name,
          price: s.price,
          quantity: s.quantity
        })),
        materials: materials.map(m => ({
          material_id: m.material_id,
          name: m.name,
          price: m.price,
          quantity: m.quantity,
          unit: m.unit
        })),
        doctor: doctor || null
      };
    }));
    
    res.json(appointmentsWithData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== USERS / AUTH ==========

// Логин
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const user = await db.get(
      usePostgres
        ? 'SELECT * FROM users WHERE username = $1 AND password = $2'
        : 'SELECT * FROM users WHERE username = ? AND password = ?',
      [username, password]
    );
    
    if (!user) {
      return res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
    }
    
    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      doctor_id: user.doctor_id,
      full_name: user.full_name
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Проверка текущего пользователя
app.get('/api/auth/me', async (req, res) => {
  // В простой реализации без сессий/токенов
  res.json({ message: 'Not implemented' });
});

// Логаут
app.post('/api/auth/logout', (req, res) => {
  res.json({ message: 'Logged out' });
});

// ======================
// СТАТИЧЕСКИЕ ФАЙЛЫ (для продакшена)
// ======================

if (NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`🌍 Режим: ${NODE_ENV}`);
  console.log(`💾 База данных: ${usePostgres ? 'PostgreSQL' : 'SQLite'}`);
});

