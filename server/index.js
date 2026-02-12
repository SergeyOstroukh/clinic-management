// .env в корне проекта (при запуске из server/ dotenv по умолчанию его не находит)
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('dotenv').config(); // fallback: server/.env
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcrypt');
const http = require('http');
const { Server } = require('socket.io');

// Импорт модуля базы данных
const { db, usePostgres } = require('./database');
const { initializeDatabase } = require('./init-db');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Socket.IO с CORS настройками
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true
  }
});

// Логируем подключения Socket.IO
io.on('connection', (socket) => {
  console.log(`🔌 Socket.IO: клиент подключен (${socket.id})`);
  
  socket.on('disconnect', () => {
    console.log(`🔌 Socket.IO: клиент отключен (${socket.id})`);
  });
});

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

// Нормализация формата даты: YYYY-MM-DD HH:MM:SS (без T и timezone)
function normalizeAppointmentDate(dateString) {
  if (!dateString) return dateString;
  
  // Преобразуем в строку
  let normalized = String(dateString);
  
  // Убираем 'T' и заменяем на пробел
  normalized = normalized.replace('T', ' ').trim();
  // Убираем timezone (Z или +HH:MM)
  if (normalized.includes('Z')) {
    normalized = normalized.replace('Z', '');
  }
  if (normalized.includes('+')) {
    normalized = normalized.split('+')[0].trim();
  }
  // Убираем timezone в формате -HH:MM
  if (normalized.match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}-\d{2}:\d{2}$/)) {
    normalized = normalized.substring(0, 19);
  }
  
  // Убеждаемся, что есть секунды (если формат YYYY-MM-DD HH:MM)
  if (normalized.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)) {
    normalized = normalized + ':00';
  }
  
  // Обрезаем до формата YYYY-MM-DD HH:MM:SS (ровно 19 символов)
  // ВАЖНО: НЕ обрезаем если строка уже правильной длины!
  if (normalized.length > 19) {
    normalized = normalized.substring(0, 19);
  }
  
  // Проверяем, что формат правильный
  const timeMatch = normalized.match(/^\d{4}-\d{2}-\d{2} (\d{2}):(\d{2}):(\d{2})$/);
  if (!timeMatch) {
    console.error('⚠️ Предупреждение: неправильный формат даты после нормализации:', normalized, 'исходная:', dateString);
  }
  
  return normalized;
}

// Нормализация даты для сравнения в SQL (только дата YYYY-MM-DD)
function normalizeDateForSQL(dateString) {
  if (!dateString) return dateString;
  
  // Если уже в формате YYYY-MM-DD, возвращаем как есть
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateString;
  }
  
  // Парсим дату и возвращаем в формате YYYY-MM-DD
  try {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('Ошибка нормализации даты:', error);
    return dateString;
  }
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
  const { lastName, firstName, middleName, phone, address, email, notes, date_of_birth, passport_number, citizenship_data, population_type } = req.body;
  
  try {
    const result = await db.query(
      'INSERT INTO clients ("lastName", "firstName", "middleName", phone, address, email, notes, date_of_birth, passport_number, citizenship_data, population_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id',
      [lastName, firstName, middleName, phone, address, email, notes, date_of_birth || null, passport_number || null, citizenship_data || null, population_type || 'city']
    );
    res.json({ id: result[0].id, lastName, firstName, middleName, phone, address, email, notes, date_of_birth: date_of_birth || null, passport_number: passport_number || null, citizenship_data: citizenship_data || null, population_type: population_type || 'city' });
  } catch (error) {
    console.error('Ошибка создания клиента:', error);
    res.status(500).json({ error: error.message });
  }
});

// Получить одного клиента по ID
app.get('/api/clients/:id', async (req, res) => {
  try {
    const client = await db.get(
      usePostgres
        ? 'SELECT * FROM clients WHERE id = $1'
        : 'SELECT * FROM clients WHERE id = ?',
      [req.params.id]
    );
    
    if (!client) {
      return res.status(404).json({ error: 'Клиент не найден' });
    }
    
    res.json(client);
  } catch (error) {
    console.error('Ошибка получения клиента:', error);
    res.status(500).json({ error: error.message });
  }
});

// Обновить клиента (только для главного админа или для обновления treatment_plan врачом)
app.put('/api/clients/:id', async (req, res) => {
  const { lastName, firstName, middleName, phone, address, email, notes, treatment_plan, currentUser, date_of_birth, passport_number, citizenship_data, population_type } = req.body;
  
  try {
    if (!currentUser) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    // Если обновляется только treatment_plan, разрешаем врачам
    const isOnlyTreatmentPlanUpdate = !lastName && !firstName && !middleName && !phone && !address && !email && !notes && treatment_plan !== undefined;
    
    if (!isOnlyTreatmentPlanUpdate && currentUser.role !== 'superadmin') {
      return res.status(403).json({ error: 'Доступ запрещен. Только главный администратор может редактировать клиентов.' });
    }
    
    if (isOnlyTreatmentPlanUpdate) {
      // Обновляем только план лечения
      const result = await db.run(
        usePostgres
          ? 'UPDATE clients SET treatment_plan = $1 WHERE id = $2'
          : 'UPDATE clients SET treatment_plan = ? WHERE id = ?',
        [treatment_plan || null, req.params.id]
      );
      
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Клиент не найден' });
      }
      
      res.json({ message: 'План лечения обновлен', changes: result.changes });
    } else {
      // Полное обновление (только для superadmin), включая date_of_birth, passport_number, citizenship_data и population_type
      const result = await db.run(
        usePostgres
          ? 'UPDATE clients SET "lastName" = $1, "firstName" = $2, "middleName" = $3, phone = $4, address = $5, email = $6, notes = $7, treatment_plan = $8, date_of_birth = $9, passport_number = $10, citizenship_data = $11, population_type = $12 WHERE id = $13'
          : 'UPDATE clients SET "lastName" = ?, "firstName" = ?, "middleName" = ?, phone = ?, address = ?, email = ?, notes = ?, treatment_plan = ?, date_of_birth = ?, passport_number = ?, citizenship_data = ?, population_type = ? WHERE id = ?',
        [lastName, firstName, middleName, phone, address, email, notes, treatment_plan || null, date_of_birth || null, passport_number || null, citizenship_data || null, population_type || 'city', req.params.id]
      );
      
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Клиент не найден' });
      }
      
      res.json({ message: 'Клиент обновлен', changes: result.changes });
    }
  } catch (error) {
    console.error('Ошибка обновления клиента:', error);
    res.status(500).json({ error: error.message });
  }
});

// Удалить клиента (только для главного админа)
app.delete('/api/clients/:id', async (req, res) => {
  try {
    const { currentUser, deleteAppointments } = req.body;
    
    // Проверка прав доступа
    if (!currentUser || currentUser.role !== 'superadmin') {
      return res.status(403).json({ error: 'Доступ запрещен. Только главный администратор может удалять клиентов.' });
    }
    
    const clientId = req.params.id;
    
    // Проверяем, есть ли записи у этого клиента
    const appointments = await db.all(
      usePostgres 
        ? 'SELECT COUNT(*) as count FROM appointments WHERE client_id = $1'
        : 'SELECT COUNT(*) as count FROM appointments WHERE client_id = ?',
      [clientId]
    );
    
    const appointmentCount = appointments[0]?.count || 0;
    
    // Если есть записи, обрабатываем их в зависимости от выбора пользователя
    // По умолчанию, если параметр не передан, обнуляем client_id (оставляем записи)
    if (appointmentCount > 0) {
      if (deleteAppointments === true) {
        // Получаем ID всех записей клиента
        const clientAppointments = await db.all(
          usePostgres
            ? 'SELECT id FROM appointments WHERE client_id = $1'
            : 'SELECT id FROM appointments WHERE client_id = ?',
          [clientId]
        );
        
        // Удаляем связанные данные для каждой записи
        for (const appointment of clientAppointments) {
          const appointmentId = appointment.id;
          
          // Удаляем услуги записи
          await db.run(
            usePostgres
              ? 'DELETE FROM appointment_services WHERE appointment_id = $1'
              : 'DELETE FROM appointment_services WHERE appointment_id = ?',
            [appointmentId]
          );
          
          // Удаляем материалы записи
          await db.run(
            usePostgres
              ? 'DELETE FROM appointment_materials WHERE appointment_id = $1'
              : 'DELETE FROM appointment_materials WHERE appointment_id = ?',
            [appointmentId]
          );
          
          // Удаляем транзакции материалов, связанные с записью
          await db.run(
            usePostgres
              ? 'UPDATE material_transactions SET appointment_id = NULL WHERE appointment_id = $1'
              : 'UPDATE material_transactions SET appointment_id = NULL WHERE appointment_id = ?',
            [appointmentId]
          );
        }
        
        // Теперь удаляем сами записи
        await db.run(
          usePostgres
            ? 'DELETE FROM appointments WHERE client_id = $1'
            : 'DELETE FROM appointments WHERE client_id = ?',
          [clientId]
        );
        console.log(`✅ Удалено ${appointmentCount} записей клиента #${clientId} со всеми связанными данными`);
      } else {
        // Обнуляем client_id в записях (записи остаются, но без привязки к клиенту)
        await db.run(
          usePostgres
            ? 'UPDATE appointments SET client_id = NULL WHERE client_id = $1'
            : 'UPDATE appointments SET client_id = NULL WHERE client_id = ?',
          [clientId]
        );
        console.log(`✅ Обнулен client_id для ${appointmentCount} записей (записи сохранены)`);
      }
    }
    
    // Удаляем клиента
    const result = await db.run(
      usePostgres ? 'DELETE FROM clients WHERE id = $1' : 'DELETE FROM clients WHERE id = ?',
      [clientId]
    );
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Клиент не найден' });
    }
    
    console.log(`✅ Клиент #${clientId} удален`);
    
    res.json({ 
      message: 'Клиент удален', 
      changes: result.changes,
      appointmentsProcessed: appointmentCount,
      appointmentsDeleted: deleteAppointments === true
    });
  } catch (error) {
    console.error('Ошибка удаления клиента:', error);
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
    const serviceId = req.params.id;
    
    // Проверяем, используется ли услуга в записях
    const appointmentsCount = await db.get(
      usePostgres
        ? 'SELECT COUNT(*) as count FROM appointment_services WHERE service_id = $1'
        : 'SELECT COUNT(*) as count FROM appointment_services WHERE service_id = ?',
      [serviceId]
    );
    
    // Проверяем, используется ли услуга в составных услугах
    const compositeCount = await db.get(
      usePostgres
        ? 'SELECT COUNT(*) as count FROM composite_service_services WHERE service_id = $1'
        : 'SELECT COUNT(*) as count FROM composite_service_services WHERE service_id = ?',
      [serviceId]
    );
    
    // Преобразуем в числа (PostgreSQL может вернуть строку)
    const appointmentsCountNum = parseInt(appointmentsCount?.count || 0, 10);
    const compositeCountNum = parseInt(compositeCount?.count || 0, 10);
    const totalUsage = appointmentsCountNum + compositeCountNum;
    
    if (totalUsage > 0) {
      // Удаляем все связи перед удалением услуги
      // Удаляем из записей
      if (appointmentsCountNum > 0) {
        await db.run(
          usePostgres
            ? 'DELETE FROM appointment_services WHERE service_id = $1'
            : 'DELETE FROM appointment_services WHERE service_id = ?',
          [serviceId]
        );
      }
      
      // Удаляем из составных услуг
      if (compositeCountNum > 0) {
        await db.run(
          usePostgres
            ? 'DELETE FROM composite_service_services WHERE service_id = $1'
            : 'DELETE FROM composite_service_services WHERE service_id = ?',
          [serviceId]
        );
      }
    }
    
    // Теперь удаляем саму услугу
    const result = await db.run(
      usePostgres ? 'DELETE FROM services WHERE id = $1' : 'DELETE FROM services WHERE id = ?',
      [serviceId]
    );
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Услуга не найдена' });
    }
    
    res.json({ 
      message: 'Услуга удалена', 
      changes: result.changes,
      removedLinks: totalUsage
    });
  } catch (error) {
    console.error('Ошибка удаления услуги:', error);
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

// Получить одного врача по ID
app.get('/api/doctors/:id', async (req, res) => {
  try {
    const doctor = await db.get(
      usePostgres 
        ? 'SELECT * FROM doctors WHERE id = $1'
        : 'SELECT * FROM doctors WHERE id = ?',
      [req.params.id]
    );
    
    if (!doctor) {
      return res.status(404).json({ error: 'Врач не найден' });
    }
    
    res.json(doctor);
  } catch (error) {
    console.error('Ошибка получения врача:', error);
    res.status(500).json({ error: error.message });
  }
});

// Создать врача
app.post('/api/doctors', async (req, res) => {
  const { lastName, firstName, middleName, specialization, phone, email, createUser, username, password, currentUser } = req.body;
  
  try {
    // Проверка прав доступа для создания пользователя
    if (createUser && (!currentUser || currentUser.role !== 'superadmin')) {
      return res.status(403).json({ error: 'Доступ запрещен. Только главный администратор может создавать пользователей.' });
    }
    
    // Создаем врача
    const result = await db.query(
      'INSERT INTO doctors ("lastName", "firstName", "middleName", specialization, phone, email) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [lastName, firstName, middleName, specialization, phone, email]
    );
    const doctorId = result[0].id;
    
    // Если нужно создать пользователя для врача
    if (createUser && username && password) {
      // Проверяем, не существует ли уже пользователь с таким именем
      const existingUser = await db.get(
        'SELECT id FROM users WHERE username = $1',
        [username]
      );
      
      if (existingUser) {
        // Если пользователь уже существует, просто обновляем doctor_id
        await db.run(
          'UPDATE users SET doctor_id = $1 WHERE id = $2',
          [doctorId, existingUser.id]
        );
      } else {
        // Хешируем пароль
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Формируем полное имя
        const fullName = `${lastName} ${firstName} ${middleName || ''}`.trim();
        
        // Создаем пользователя
        await db.query(
          'INSERT INTO users (username, password, role, doctor_id, full_name) VALUES ($1, $2, $3, $4, $5)',
          [username, hashedPassword, 'doctor', doctorId, fullName]
        );
      }
    }
    
    res.json({ 
      id: doctorId, 
      lastName, 
      firstName, 
      middleName, 
      specialization, 
      phone, 
      email,
      userCreated: createUser && username && password
    });
  } catch (error) {
    console.error('Ошибка создания врача:', error);
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
// ВАЖНО: Записи (appointments) НЕ удаляются, только обнуляется doctor_id
app.delete('/api/doctors/:id', async (req, res) => {
  try {
    const doctorId = req.params.id;
    
    // Проверяем, есть ли записи у этого врача
    const appointments = await db.all(
      usePostgres 
        ? 'SELECT COUNT(*) as count FROM appointments WHERE doctor_id = $1'
        : 'SELECT COUNT(*) as count FROM appointments WHERE doctor_id = ?',
      [doctorId]
    );
    
    const appointmentCount = appointments[0]?.count || 0;
    
    // ВАЖНО: Записи НЕ удаляем, только обнуляем doctor_id, чтобы записи остались в базе
    if (appointmentCount > 0) {
      await db.run(
        usePostgres
          ? 'UPDATE appointments SET doctor_id = NULL WHERE doctor_id = $1'
          : 'UPDATE appointments SET doctor_id = NULL WHERE doctor_id = ?',
        [doctorId]
      );
      console.log(`✅ Обнулен doctor_id для ${appointmentCount} записей (записи сохранены)`);
    }
    
    // Также обнуляем doctor_id в users, если есть связанный пользователь
    await db.run(
      usePostgres
        ? 'UPDATE users SET doctor_id = NULL WHERE doctor_id = $1'
        : 'UPDATE users SET doctor_id = NULL WHERE doctor_id = ?',
      [doctorId]
    );
    
    // Удаляем расписание врача (регулярное - по дням недели)
    const schedulesResult = await db.run(
      usePostgres
        ? 'DELETE FROM doctor_schedules WHERE doctor_id = $1'
        : 'DELETE FROM doctor_schedules WHERE doctor_id = ?',
      [doctorId]
    );
    if (schedulesResult.changes > 0) {
      console.log(`✅ Удалено ${schedulesResult.changes} записей расписания врача`);
    }
    
    // Удаляем точечные даты работы врача
    const specificDatesResult = await db.run(
      usePostgres
        ? 'DELETE FROM doctor_specific_dates WHERE doctor_id = $1'
        : 'DELETE FROM doctor_specific_dates WHERE doctor_id = ?',
      [doctorId]
    );
    if (specificDatesResult.changes > 0) {
      console.log(`✅ Удалено ${specificDatesResult.changes} точечных дат работы врача`);
    }
    
    // Теперь удаляем только самого врача (все связанные данные уже обработаны выше)
    const result = await db.run(
      usePostgres ? 'DELETE FROM doctors WHERE id = $1' : 'DELETE FROM doctors WHERE id = ?',
      [doctorId]
    );
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Врач не найден' });
    }
    
    console.log(`✅ Врач #${doctorId} удален. Записей обновлено: ${appointmentCount} (записи сохранены)`);
    
    res.json({ 
      message: 'Врач удален', 
      changes: result.changes,
      appointmentsUpdated: appointmentCount,
      appointmentsPreserved: true // Явно указываем, что записи сохранены
    });
  } catch (error) {
    console.error('Ошибка удаления врача:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== DOCTOR NOTIFICATIONS ==========

// Получить записи в статусе "waiting" для врача (для уведомлений)
app.get('/api/doctors/:id/waiting-patients', async (req, res) => {
  try {
    const doctorId = req.params.id;
    const today = new Date().toISOString().split('T')[0];
    
    // Получаем записи со статусом "waiting" на сегодня для этого врача
    const waitingPatients = await db.all(
      usePostgres
        ? `SELECT a.id, a.appointment_date, a.status,
                  c."firstName" as client_first_name, c."lastName" as client_last_name, c."middleName" as client_middle_name
           FROM appointments a
           JOIN clients c ON a.client_id = c.id
           WHERE a.doctor_id = $1 
             AND a.status = 'waiting'
             AND DATE(a.appointment_date::timestamp) = $2
           ORDER BY a.appointment_date ASC`
        : `SELECT a.id, a.appointment_date, a.status,
                  c.firstName as client_first_name, c.lastName as client_last_name, c.middleName as client_middle_name
           FROM appointments a
           JOIN clients c ON a.client_id = c.id
           WHERE a.doctor_id = ? 
             AND a.status = 'waiting'
             AND DATE(a.appointment_date) = ?
           ORDER BY a.appointment_date ASC`,
      [doctorId, today]
    );
    
    res.json(waitingPatients);
  } catch (error) {
    console.error('Ошибка получения ожидающих пациентов:', error);
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
    const materialId = req.params.id;
    
    // Проверяем, используется ли материал в записях
    const appointmentsCount = await db.get(
      usePostgres
        ? 'SELECT COUNT(*) as count FROM appointment_materials WHERE material_id = $1'
        : 'SELECT COUNT(*) as count FROM appointment_materials WHERE material_id = ?',
      [materialId]
    );
    
    // Проверяем, используется ли материал в составных услугах
    const compositeCount = await db.get(
      usePostgres
        ? 'SELECT COUNT(*) as count FROM composite_service_materials WHERE material_id = $1'
        : 'SELECT COUNT(*) as count FROM composite_service_materials WHERE material_id = ?',
      [materialId]
    );
    
    // Проверяем, используется ли материал в транзакциях
    const transactionsCount = await db.get(
      usePostgres
        ? 'SELECT COUNT(*) as count FROM material_transactions WHERE material_id = $1'
        : 'SELECT COUNT(*) as count FROM material_transactions WHERE material_id = ?',
      [materialId]
    );
    
    // Преобразуем в числа (PostgreSQL может вернуть строку)
    const appointmentsCountNum = parseInt(appointmentsCount?.count || 0, 10);
    const compositeCountNum = parseInt(compositeCount?.count || 0, 10);
    const transactionsCountNum = parseInt(transactionsCount?.count || 0, 10);
    const totalUsage = appointmentsCountNum + compositeCountNum + transactionsCountNum;
    
    if (totalUsage > 0) {
      // Удаляем все связи перед удалением материала
      // Удаляем из записей
      if (appointmentsCountNum > 0) {
        await db.run(
          usePostgres
            ? 'DELETE FROM appointment_materials WHERE material_id = $1'
            : 'DELETE FROM appointment_materials WHERE material_id = ?',
          [materialId]
        );
      }
      
      // Удаляем из составных услуг
      if (compositeCountNum > 0) {
        await db.run(
          usePostgres
            ? 'DELETE FROM composite_service_materials WHERE material_id = $1'
            : 'DELETE FROM composite_service_materials WHERE material_id = ?',
          [materialId]
        );
      }
      
      // Удаляем транзакции материалов
      if (transactionsCountNum > 0) {
        await db.run(
          usePostgres
            ? 'DELETE FROM material_transactions WHERE material_id = $1'
            : 'DELETE FROM material_transactions WHERE material_id = ?',
          [materialId]
        );
      }
    }
    
    // Теперь удаляем сам материал
    const result = await db.run(
      usePostgres ? 'DELETE FROM materials WHERE id = $1' : 'DELETE FROM materials WHERE id = ?',
      [materialId]
    );
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Материал не найден' });
    }
    
    res.json({ 
      message: 'Материал удален', 
      changes: result.changes,
      removedLinks: totalUsage
    });
  } catch (error) {
    console.error('Ошибка удаления материала:', error);
    res.status(500).json({ error: error.message });
  }
});

// Списание материала
app.post('/api/materials/writeoff', async (req, res) => {
  const { material_id, quantity, notes } = req.body;
  
  try {
    if (!material_id || !quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Неверные данные для списания' });
    }

    // Получаем текущий остаток материала
    const material = await db.get(
      usePostgres ? 'SELECT * FROM materials WHERE id = $1' : 'SELECT * FROM materials WHERE id = ?',
      [material_id]
    );

    if (!material) {
      return res.status(404).json({ error: 'Материал не найден' });
    }

    if (material.stock < quantity) {
      return res.status(400).json({ error: 'Недостаточно материала на складе' });
    }

    // Создаем запись о списании (ручное списание, appointment_id = null)
    await db.run(
      usePostgres
        ? 'INSERT INTO material_transactions (material_id, transaction_type, quantity, price, notes, appointment_id, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7)'
        : 'INSERT INTO material_transactions (material_id, transaction_type, quantity, price, notes, appointment_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [material_id, 'writeoff', quantity, material.price, notes || 'Ручное списание', null, null]
    );

    // Уменьшаем остаток
    const newStock = material.stock - quantity;
    await db.run(
      usePostgres
        ? 'UPDATE materials SET stock = $1 WHERE id = $2'
        : 'UPDATE materials SET stock = ? WHERE id = ?',
      [newStock, material_id]
    );

    res.json({ 
      message: 'Материал успешно списан',
      material_id,
      quantity,
      new_stock: newStock
    });
  } catch (error) {
    console.error('Ошибка списания материала:', error);
    res.status(500).json({ error: error.message });
  }
});

// Приход материала
app.post('/api/materials/receipt', async (req, res) => {
  const { material_id, quantity, price, notes, receipt_date } = req.body;
  
  try {
    if (!material_id || !quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Неверные данные для прихода' });
    }

    // Получаем текущий остаток материала
    const material = await db.get(
      usePostgres ? 'SELECT * FROM materials WHERE id = $1' : 'SELECT * FROM materials WHERE id = ?',
      [material_id]
    );

    if (!material) {
      return res.status(404).json({ error: 'Материал не найден' });
    }

    // Используем переданную цену или цену из материала
    const receiptPrice = price || material.price;

    // Формируем дату: если передана, используем её, иначе текущая дата
    let receiptDate = receipt_date;
    if (!receiptDate) {
      receiptDate = new Date().toISOString();
    } else {
      // Убеждаемся, что дата в правильном формате
      receiptDate = new Date(receiptDate).toISOString();
    }

    // Создаем запись о приходе с указанной датой
    await db.run(
      usePostgres
        ? 'INSERT INTO material_transactions (material_id, transaction_type, quantity, price, notes, created_at) VALUES ($1, $2, $3, $4, $5, $6::timestamp)'
        : 'INSERT INTO material_transactions (material_id, transaction_type, quantity, price, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [material_id, 'receipt', quantity, receiptPrice, notes || '', receiptDate]
    );

    // Увеличиваем остаток
    const newStock = material.stock + quantity;
    await db.run(
      usePostgres
        ? 'UPDATE materials SET stock = $1 WHERE id = $2'
        : 'UPDATE materials SET stock = ? WHERE id = ?',
      [newStock, material_id]
    );

    res.json({ 
      message: 'Материал успешно добавлен',
      material_id,
      quantity,
      new_stock: newStock
    });
  } catch (error) {
    console.error('Ошибка прихода материала:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== COMPOSITE SERVICES ==========

// Получить все составные услуги
app.get('/api/composite-services', async (req, res) => {
  try {
    const compositeServices = await db.all(`
      SELECT cs.*,
        (SELECT COUNT(*) FROM composite_service_services WHERE composite_service_id = cs.id) as services_count,
        (SELECT COUNT(*) FROM composite_service_materials WHERE composite_service_id = cs.id) as materials_count
      FROM composite_services cs
      ORDER BY cs.name
    `);
    
    // Для каждой составной услуги получаем подуслуги и материалы
    for (const cs of compositeServices) {
      const services = await db.all(`
        SELECT s.*, css.quantity, css.display_order
        FROM composite_service_services css
        JOIN services s ON css.service_id = s.id
        WHERE css.composite_service_id = $1
        ORDER BY css.display_order, s.name
      `, [cs.id]);
      
      const materials = await db.all(`
        SELECT m.*, csm.quantity, csm.display_order
        FROM composite_service_materials csm
        JOIN materials m ON csm.material_id = m.id
        WHERE csm.composite_service_id = $1
        ORDER BY csm.display_order, m.name
      `, [cs.id]);
      
      cs.services = services;
      cs.materials = materials;
    }
    
    res.json(compositeServices);
  } catch (error) {
    console.error('Ошибка получения составных услуг:', error);
    res.status(500).json({ error: error.message });
  }
});

// Получить одну составную услугу
app.get('/api/composite-services/:id', async (req, res) => {
  try {
    const compositeService = await db.get(
      'SELECT * FROM composite_services WHERE id = $1',
      [req.params.id]
    );
    
    if (!compositeService) {
      return res.status(404).json({ error: 'Составная услуга не найдена' });
    }
    
    const services = await db.all(`
      SELECT s.*, css.quantity, css.display_order
      FROM composite_service_services css
      JOIN services s ON css.service_id = s.id
      WHERE css.composite_service_id = $1
      ORDER BY css.display_order, s.name
    `, [req.params.id]);
    
    const materials = await db.all(`
      SELECT m.*, csm.quantity, csm.display_order
      FROM composite_service_materials csm
      JOIN materials m ON csm.material_id = m.id
      WHERE csm.composite_service_id = $1
      ORDER BY csm.display_order, m.name
    `, [req.params.id]);
    
    compositeService.services = services;
    compositeService.materials = materials;
    
    res.json(compositeService);
  } catch (error) {
    console.error('Ошибка получения составной услуги:', error);
    res.status(500).json({ error: error.message });
  }
});

// Создать составную услугу
app.post('/api/composite-services', async (req, res) => {
  const { name, description, category, services, materials, is_active } = req.body;
  
  try {
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Название обязательно' });
    }
    
    if (!services || services.length === 0) {
      return res.status(400).json({ error: 'Необходимо добавить хотя бы одну подуслугу' });
    }
    
    // Создаем составную услугу
    const result = await db.query(
      'INSERT INTO composite_services (name, description, category, is_active) VALUES ($1, $2, $3, $4) RETURNING id',
      [name.trim(), description || null, category || null, is_active !== false]
    );
    
    const compositeServiceId = result[0].id;
    
    // Добавляем подуслуги
    if (services && services.length > 0) {
      for (let i = 0; i < services.length; i++) {
        const service = services[i];
        await db.run(
          'INSERT INTO composite_service_services (composite_service_id, service_id, quantity, display_order) VALUES ($1, $2, $3, $4)',
          [compositeServiceId, service.service_id, service.quantity || 1, i]
        );
      }
    }
    
    // Добавляем материалы
    if (materials && materials.length > 0) {
      for (let i = 0; i < materials.length; i++) {
        const material = materials[i];
        await db.run(
          'INSERT INTO composite_service_materials (composite_service_id, material_id, quantity, display_order) VALUES ($1, $2, $3, $4)',
          [compositeServiceId, material.material_id, material.quantity || 1, i]
        );
      }
    }
    
    // Получаем созданную услугу со всеми данными
    const created = await db.get(
      'SELECT * FROM composite_services WHERE id = $1',
      [compositeServiceId]
    );
    
    const createdServices = await db.all(`
      SELECT s.*, css.quantity, css.display_order
      FROM composite_service_services css
      JOIN services s ON css.service_id = s.id
      WHERE css.composite_service_id = $1
      ORDER BY css.display_order
    `, [compositeServiceId]);
    
    const createdMaterials = await db.all(`
      SELECT m.*, csm.quantity, csm.display_order
      FROM composite_service_materials csm
      JOIN materials m ON csm.material_id = m.id
      WHERE csm.composite_service_id = $1
      ORDER BY csm.display_order
    `, [compositeServiceId]);
    
    created.services = createdServices;
    created.materials = createdMaterials;
    
    res.status(201).json(created);
  } catch (error) {
    console.error('Ошибка создания составной услуги:', error);
    res.status(500).json({ error: error.message });
  }
});

// Обновить составную услугу
app.put('/api/composite-services/:id', async (req, res) => {
  const { name, description, category, services, materials, is_active } = req.body;
  
  try {
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Название обязательно' });
    }
    
    if (!services || services.length === 0) {
      return res.status(400).json({ error: 'Необходимо добавить хотя бы одну подуслугу' });
    }
    
    // Обновляем основную информацию
    await db.run(
      'UPDATE composite_services SET name = $1, description = $2, category = $3, is_active = $4 WHERE id = $5',
      [name.trim(), description || null, category || null, is_active !== false, req.params.id]
    );
    
    // Удаляем старые связи
    await db.run(
      'DELETE FROM composite_service_services WHERE composite_service_id = $1',
      [req.params.id]
    );
    await db.run(
      'DELETE FROM composite_service_materials WHERE composite_service_id = $1',
      [req.params.id]
    );
    
    // Добавляем новые подуслуги
    if (services && services.length > 0) {
      for (let i = 0; i < services.length; i++) {
        const service = services[i];
        await db.run(
          'INSERT INTO composite_service_services (composite_service_id, service_id, quantity, display_order) VALUES ($1, $2, $3, $4)',
          [req.params.id, service.service_id, service.quantity || 1, i]
        );
      }
    }
    
    // Добавляем новые материалы
    if (materials && materials.length > 0) {
      for (let i = 0; i < materials.length; i++) {
        const material = materials[i];
        await db.run(
          'INSERT INTO composite_service_materials (composite_service_id, material_id, quantity, display_order) VALUES ($1, $2, $3, $4)',
          [req.params.id, material.material_id, material.quantity || 1, i]
        );
      }
    }
    
    // Получаем обновленную услугу
    const updated = await db.get(
      'SELECT * FROM composite_services WHERE id = $1',
      [req.params.id]
    );
    
    const updatedServices = await db.all(`
      SELECT s.*, css.quantity, css.display_order
      FROM composite_service_services css
      JOIN services s ON css.service_id = s.id
      WHERE css.composite_service_id = $1
      ORDER BY css.display_order
    `, [req.params.id]);
    
    const updatedMaterials = await db.all(`
      SELECT m.*, csm.quantity, csm.display_order
      FROM composite_service_materials csm
      JOIN materials m ON csm.material_id = m.id
      WHERE csm.composite_service_id = $1
      ORDER BY csm.display_order
    `, [req.params.id]);
    
    updated.services = updatedServices;
    updated.materials = updatedMaterials;
    
    res.json(updated);
  } catch (error) {
    console.error('Ошибка обновления составной услуги:', error);
    res.status(500).json({ error: error.message });
  }
});

// Удалить составную услугу
app.delete('/api/composite-services/:id', async (req, res) => {
  try {
    const result = await db.run(
      'DELETE FROM composite_services WHERE id = $1',
      [req.params.id]
    );
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Составная услуга не найдена' });
    }
    
    res.json({ message: 'Составная услуга удалена', changes: result.changes });
  } catch (error) {
    console.error('Ошибка удаления составной услуги:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== APPOINTMENTS ==========

// Получить все записи с информацией о клиентах и услугах
app.get('/api/appointments', async (req, res) => {
  try {
    // ВАЖНО: Для PostgreSQL используем TO_CHAR чтобы получить appointment_date в правильном формате
    const appointments = await db.all(
      usePostgres
        ? `SELECT 
            a.id,
            a.client_id,
            ${usePostgres ? "TO_CHAR(a.appointment_date::timestamp, 'YYYY-MM-DD HH24:MI:SS')::text" : "a.appointment_date"} as appointment_date,
            a.doctor_id,
            a.status,
            a.notes,
            a.diagnosis,
            a.total_price,
            a.discount_amount,
            a.paid,
            a.called_today,
            a.created_at,
            COALESCE(a.duration, 30) as duration,
            d."lastName" as doctor_lastName,
            d."firstName" as doctor_firstName,
            d."middleName" as doctor_middleName,
            d.specialization as doctor_specialization
          FROM appointments a
          LEFT JOIN doctors d ON a.doctor_id = d.id
          ORDER BY a.id ASC`
        : `SELECT 
            a.*,
            d.lastName as doctor_lastName,
            d.firstName as doctor_firstName,
            d.middleName as doctor_middleName,
            d.specialization as doctor_specialization
          FROM appointments a
          LEFT JOIN doctors d ON a.doctor_id = d.id
          ORDER BY a.id ASC`
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
      
      // ВАЖНО: Получаем appointment_date из БД напрямую в правильном формате
      // Это гарантирует, что мы получаем правильное время с минутами
      let normalizedAppointmentDate;
      const dbDate = await db.get(
        usePostgres
          ? `SELECT TO_CHAR(appointment_date::timestamp, 'YYYY-MM-DD HH24:MI:SS')::text as appointment_date FROM appointments WHERE id = $1`
          : `SELECT strftime('%Y-%m-%d %H:%M:%S', appointment_date) as appointment_date FROM appointments WHERE id = ?`,
        [appointment.id]
      );
      
      if (dbDate && dbDate.appointment_date) {
        normalizedAppointmentDate = String(dbDate.appointment_date);
      } else {
        // Fallback: используем то, что пришло из первого запроса
        let dateStr = appointment.appointment_date;
        
        if (dateStr instanceof Date) {
          const year = dateStr.getFullYear();
          const month = String(dateStr.getMonth() + 1).padStart(2, '0');
          const day = String(dateStr.getDate()).padStart(2, '0');
          const hours = String(dateStr.getHours()).padStart(2, '0');
          const minutes = String(dateStr.getMinutes()).padStart(2, '0');
          const seconds = String(dateStr.getSeconds()).padStart(2, '0');
          normalizedAppointmentDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        } else {
          normalizedAppointmentDate = normalizeAppointmentDate(String(dateStr));
        }
      }
      
      return {
        ...appointment,
        appointment_date: normalizedAppointmentDate,
        // Нормализуем called_today: boolean -> 1/0 для совместимости с клиентом
        called_today: appointment.called_today === true || appointment.called_today === 1 ? 1 : 0,
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

// Получить отложенные записи формы 037/у для врача
// ВАЖНО: этот маршрут ДОЛЖЕН быть перед /api/appointments/:id, иначе Express перехватит "deferred-forms" как :id
app.get('/api/appointments/deferred-forms', async (req, res) => {
  const { doctor_id } = req.query;
  if (!doctor_id) {
    return res.status(400).json({ error: 'doctor_id обязателен' });
  }
  try {
    const deferred = await db.all(
      usePostgres
        ? `SELECT a.id, a.appointment_date, a.diagnosis, a.status, a.form_deferred,
             c."lastName", c."firstName", c."middleName", c.address, c.citizenship_data, c.date_of_birth, c.population_type,
             d."lastName" AS doctor_last_name, d."firstName" AS doctor_first_name
           FROM appointments a
           LEFT JOIN clients c ON a.client_id = c.id
           LEFT JOIN doctors d ON a.doctor_id = d.id
           WHERE a.doctor_id = $1 AND a.form_deferred = true
           ORDER BY a.appointment_date DESC`
        : `SELECT a.id, a.appointment_date, a.diagnosis, a.status, a.form_deferred,
             c."lastName", c."firstName", c."middleName", c.address, c.citizenship_data, c.date_of_birth, c.population_type,
             d."lastName" AS doctor_last_name, d."firstName" AS doctor_first_name
           FROM appointments a
           LEFT JOIN clients c ON a.client_id = c.id
           LEFT JOIN doctors d ON a.doctor_id = d.id
           WHERE a.doctor_id = ? AND a.form_deferred = 1
           ORDER BY a.appointment_date DESC`,
      [doctor_id]
    );
    res.json(deferred);
  } catch (error) {
    console.error('Ошибка получения отложенных форм:', error);
    res.status(500).json({ error: error.message });
  }
});

// Получить одну запись по ID с услугами и материалами
app.get('/api/appointments/:id', async (req, res) => {
  try {
    const appointment = await db.get(
      usePostgres
        ? `SELECT 
            a.*,
            d."lastName" as doctor_lastName,
            d."firstName" as doctor_firstName,
            d."middleName" as doctor_middleName,
            d.specialization as doctor_specialization
          FROM appointments a
          LEFT JOIN doctors d ON a.doctor_id = d.id
          WHERE a.id = $1`
        : `SELECT 
            a.*,
            d."lastName" as doctor_lastName,
            d."firstName" as doctor_firstName,
            d."middleName" as doctor_middleName,
            d.specialization as doctor_specialization
          FROM appointments a
          LEFT JOIN doctors d ON a.doctor_id = d.id
          WHERE a.id = ?`,
      [req.params.id]
    );

    if (!appointment) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }

    // applied_composites: для восстановления составных в CompleteVisit
    let applied = appointment.applied_composites;
    if (typeof applied === 'string') {
      try { applied = JSON.parse(applied); } catch (e) { applied = []; }
    }
    if (!Array.isArray(applied)) applied = [];

    // Получаем все услуги
    const servicesFlat = await db.all(
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

    // Вычитаем вклад составных, остаток — индивидуальные услуги
    const bySid = {};
    for (const s of servicesFlat) {
      bySid[s.service_id] = (bySid[s.service_id] || 0) + (s.quantity || 1);
    }
    for (const ac of applied) {
      if (!ac || typeof ac !== 'object' || !ac.composite_service_id) continue;
      const cid = ac.composite_service_id;
      const qty = ac.quantity || 1;
      const css = await db.all(usePostgres ? 'SELECT service_id, quantity FROM composite_service_services WHERE composite_service_id = $1' : 'SELECT service_id, quantity FROM composite_service_services WHERE composite_service_id = ?', [cid]);
      for (const row of css) {
        const k = row.service_id;
        const sub = (row.quantity || 1) * qty;
        bySid[k] = (bySid[k] || 0) - sub;
        if (bySid[k] <= 0) delete bySid[k];
      }
    }
    const individualServices = [];
    for (const [sid, q] of Object.entries(bySid)) {
      if (q <= 0) continue;
      const s = servicesFlat.find(x => String(x.service_id) === String(sid));
      individualServices.push({ service_id: parseInt(sid, 10), name: s?.name || '-', price: s?.price || 0, quantity: q });
    }

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

    // Получаем информацию о клиенте
    const client = await db.get(
      usePostgres
        ? `SELECT id, "lastName", "firstName", "middleName", phone FROM clients WHERE id = $1`                                                                 
        : `SELECT id, "lastName", "firstName", "middleName", phone FROM clients WHERE id = ?`,                                                                 
      [appointment.client_id]
    );

    // Нормализуем appointment_date для корректного отображения времени
    let normalizedAppointmentDate = appointment.appointment_date;
    if (normalizedAppointmentDate) {
      normalizedAppointmentDate = normalizeAppointmentDate(normalizedAppointmentDate.toString());
    }
    
    const appointmentWithData = {
      ...appointment,
      appointment_date: normalizedAppointmentDate,
      called_today: appointment.called_today === true || appointment.called_today === 1 ? 1 : 0,
      applied_composites: applied,
      services: individualServices.map(s => ({
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
      client: client || null
    };

    res.json(appointmentWithData);
  } catch (error) {
    console.error('Ошибка получения записи:', error);
    res.status(500).json({ error: error.message });
  }
});

// Создать запись
app.post('/api/appointments', async (req, res) => {
  const { client_id, appointment_date, doctor_id, services, notes, duration = 30 } = req.body;
  
  try {
    // Нормализуем формат даты: YYYY-MM-DD HH:MM:SS (без T и timezone)
    const dateToSave = normalizeAppointmentDate(appointment_date);
    
    // Проверяем конфликты с учетом duration
    // Новая запись: [dateToSave, dateToSave + duration]
    // Существующая запись: [existing.appointment_date, existing.appointment_date + existing.duration]
    // Конфликт есть, если интервалы пересекаются
    const conflictingAppointment = await db.get(
      usePostgres
        ? `SELECT id, appointment_date, duration FROM appointments 
           WHERE doctor_id = $1 
           AND status != $2
           AND (
             -- Новая запись начинается во время существующей
             ($3::timestamp >= appointment_date::timestamp 
              AND $3::timestamp < (appointment_date::timestamp + (COALESCE(duration, 30) || ' minutes')::interval))
             OR
             -- Новая запись заканчивается во время существующей
             (($3::timestamp + ($4 || ' minutes')::interval) > appointment_date::timestamp 
              AND ($3::timestamp + ($4 || ' minutes')::interval) <= (appointment_date::timestamp + (COALESCE(duration, 30) || ' minutes')::interval))
             OR
             -- Новая запись полностью покрывает существующую
             ($3::timestamp <= appointment_date::timestamp 
              AND ($3::timestamp + ($4 || ' minutes')::interval) >= (appointment_date::timestamp + (COALESCE(duration, 30) || ' minutes')::interval))
           )`
        : `SELECT id FROM appointments WHERE doctor_id = ? AND status != ? 
           AND (
             datetime(?) >= datetime(appointment_date) 
             AND datetime(?) < datetime(appointment_date, '+' || COALESCE(duration, 30) || ' minutes')
             OR datetime(?, '+' || ? || ' minutes') > datetime(appointment_date)
             AND datetime(?, '+' || ? || ' minutes') <= datetime(appointment_date, '+' || COALESCE(duration, 30) || ' minutes')
           )`,
      usePostgres 
        ? [doctor_id, 'cancelled', dateToSave, duration]
        : [doctor_id, 'cancelled', dateToSave, dateToSave, dateToSave, duration, dateToSave, duration]
    );
    
    if (conflictingAppointment) {
      return res.status(400).json({ 
        error: 'На это время уже есть запись или время пересекается с другой записью. Пожалуйста, выберите другое время.' 
      });
    }
    
    // Создаем запись
    let appointmentId;
    
    if (usePostgres) {
      const result = await db.query(
        'INSERT INTO appointments (client_id, appointment_date, doctor_id, notes, status, duration) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, appointment_date',
        [client_id, dateToSave, doctor_id, notes, 'scheduled', duration]
      );
      appointmentId = result[0].id;
      
      // ВАЖНО: Преобразуем в строку для возврата клиенту
      let dateForResponse = String(result[0].appointment_date);
      if (dateForResponse instanceof Date || dateForResponse.match(/^[A-Z][a-z]{2}\s+[A-Z][a-z]{2}/)) {
        // Если это объект Date или формат toString(), получаем из БД заново
        const dbCheck = await db.get(
          `SELECT TO_CHAR(appointment_date::timestamp, 'YYYY-MM-DD HH24:MI:SS')::text as appointment_date FROM appointments WHERE id = $1`,
          [appointmentId]
        );
        if (dbCheck && dbCheck.appointment_date) {
          dateForResponse = String(dbCheck.appointment_date);
        }
      }
    } else {
      const result = await db.run(
        'INSERT INTO appointments (client_id, appointment_date, doctor_id, notes, status, duration) VALUES (?, ?, ?, ?, ?, ?)',
        [client_id, dateToSave, doctor_id, notes, 'scheduled', duration]
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
    
    // ВАЖНО: Получаем сохраненную дату из БД для возврата клиенту
    // Это гарантирует, что мы возвращаем то, что реально сохранилось
    let finalAppointmentDate = dateToSave;
    if (usePostgres) {
      const saved = await db.get(
        `SELECT TO_CHAR(appointment_date::timestamp, 'YYYY-MM-DD HH24:MI:SS')::text as appointment_date FROM appointments WHERE id = $1`,
        [appointmentId]
      );
      if (saved && saved.appointment_date) {
        finalAppointmentDate = String(saved.appointment_date);
      }
    }
    
    // Real-time: уведомляем все подключенные клиенты о новой записи
    io.emit('appointmentCreated', { 
      appointmentId,
      doctor_id,
      type: 'new_appointment'
    });
    
    res.json({
      id: appointmentId,
      client_id,
      appointment_date: finalAppointmentDate,
      doctor_id,
      services,
      notes,
      duration
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Обновить запись (редактирование)
app.put('/api/appointments/:id', async (req, res) => {
  const { appointment_date, doctor_id, services, notes, duration = 30 } = req.body;
  
  try {
    // Нормализуем формат даты: YYYY-MM-DD HH:MM:SS (без T и timezone)
    const dateToSave = normalizeAppointmentDate(appointment_date);
    
    // Проверяем конфликты с учетом duration (исключая текущую запись)
    const conflictingAppointment = await db.get(
      usePostgres
        ? `SELECT id, appointment_date, duration FROM appointments 
           WHERE doctor_id = $1 
           AND status != $2
           AND id != $5
           AND (
             -- Новая запись начинается во время существующей
             ($3::timestamp >= appointment_date::timestamp 
              AND $3::timestamp < (appointment_date::timestamp + (COALESCE(duration, 30) || ' minutes')::interval))
             OR
             -- Новая запись заканчивается во время существующей
             (($3::timestamp + ($4 || ' minutes')::interval) > appointment_date::timestamp 
              AND ($3::timestamp + ($4 || ' minutes')::interval) <= (appointment_date::timestamp + (COALESCE(duration, 30) || ' minutes')::interval))
             OR
             -- Новая запись полностью покрывает существующую
             ($3::timestamp <= appointment_date::timestamp 
              AND ($3::timestamp + ($4 || ' minutes')::interval) >= (appointment_date::timestamp + (COALESCE(duration, 30) || ' minutes')::interval))
           )`
        : `SELECT id FROM appointments WHERE doctor_id = ? AND status != ? AND id != ?
           AND (
             datetime(?) >= datetime(appointment_date) 
             AND datetime(?) < datetime(appointment_date, '+' || COALESCE(duration, 30) || ' minutes')
           )`,
      usePostgres 
        ? [doctor_id, 'cancelled', dateToSave, duration, req.params.id]
        : [doctor_id, 'cancelled', req.params.id, dateToSave, dateToSave]
    );
    
    if (conflictingAppointment) {
      return res.status(400).json({ 
        error: 'На это время уже есть запись или время пересекается с другой записью. Пожалуйста, выберите другое время.' 
      });
    }
    
    // Обновляем основную информацию о записи
    await db.run(
      usePostgres
        ? 'UPDATE appointments SET appointment_date = $1, doctor_id = $2, notes = $3, duration = $4 WHERE id = $5'
        : 'UPDATE appointments SET appointment_date = ?, doctor_id = ?, notes = ?, duration = ? WHERE id = ?',
      [dateToSave, doctor_id, notes || '', duration, req.params.id]
    );
    
    // Удаляем старые услуги
    await db.run(
      usePostgres
        ? 'DELETE FROM appointment_services WHERE appointment_id = $1'
        : 'DELETE FROM appointment_services WHERE appointment_id = ?',
      [req.params.id]
    );
    
    // Добавляем новые услуги
    if (services && services.length > 0) {
      for (const service of services) {
        console.log('Добавление услуги:', service);
        await db.run(
          usePostgres
            ? 'INSERT INTO appointment_services (appointment_id, service_id, quantity) VALUES ($1, $2, $3)'
            : 'INSERT INTO appointment_services (appointment_id, service_id, quantity) VALUES (?, ?, ?)',
          [req.params.id, service.service_id, service.quantity || 1]
        );
      }
    }
    
    console.log('✅ Запись успешно обновлена');
    
    // Real-time: уведомляем все подключенные клиенты
    io.emit('appointmentUpdated', { 
      appointmentId: parseInt(req.params.id), 
      doctor_id,
      type: 'appointment_edited'
    });
    
    res.json({
      message: 'Запись обновлена',
      id: req.params.id,
      appointment_date: dateToSave,
      doctor_id,
      services,
      notes,
      duration
    });
  } catch (error) {
    console.error('❌ Ошибка обновления записи:', error);
    res.status(500).json({ error: error.message });
  }
});

// Обновить статус звонка
app.patch('/api/appointments/:id/call-status', async (req, res) => {
  const { called_today } = req.body;
  
  try {
    // Нормализуем значение: принимаем 1/0 или true/false, сохраняем как boolean
    const boolValue = called_today === 1 || called_today === true;
    
    const result = await db.run(
      usePostgres
        ? 'UPDATE appointments SET called_today = $1 WHERE id = $2'
        : 'UPDATE appointments SET called_today = ? WHERE id = ?',
      [boolValue, req.params.id]
    );
    
    // Real-time: уведомляем все подключенные клиенты
    io.emit('appointmentUpdated', { 
      appointmentId: parseInt(req.params.id), 
      type: 'call_status_change'
    });
    
    // Возвращаем нормализованное значение для клиента
    res.json({ 
      message: 'Статус звонка обновлен', 
      called_today: boolValue ? 1 : 0,
      changes: result.changes 
    });
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
    
    // Real-time: уведомляем все подключенные клиенты
    io.emit('appointmentUpdated', { 
      appointmentId: parseInt(req.params.id), 
      status,
      type: 'status_change'
    });
    
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
    // Real-time: уведомляем все подключенные клиенты
    io.emit('appointmentUpdated', { 
      appointmentId: parseInt(req.params.id), 
      status: 'completed',
      type: 'payment_completed'
    });
    
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
  const { diagnosis, services, materials, treatment_plan, applied_composites, visit_type, diagnosis_code, treatment_code, treatment_description, preventive_work, treatment_stage, form_deferred } = req.body;
  
  try {
    // Получаем старые материалы для восстановления остатков
    const oldMaterials = await db.all(
      usePostgres
        ? 'SELECT material_id, quantity FROM appointment_materials WHERE appointment_id = $1'
        : 'SELECT material_id, quantity FROM appointment_materials WHERE appointment_id = ?',
      [req.params.id]
    );
    
    // Восстанавливаем остатки для старых материалов (отменяем старое списание)
    for (const oldMaterial of oldMaterials) {
      const materialData = await db.get(
        usePostgres ? 'SELECT * FROM materials WHERE id = $1' : 'SELECT * FROM materials WHERE id = ?',
        [oldMaterial.material_id]
      );
      
      if (materialData) {
        // Удаляем старые записи о списании для этого приема
        await db.run(
          usePostgres
            ? 'DELETE FROM material_transactions WHERE appointment_id = $1 AND material_id = $2 AND transaction_type = $3'
            : 'DELETE FROM material_transactions WHERE appointment_id = ? AND material_id = ? AND transaction_type = ?',
          [req.params.id, oldMaterial.material_id, 'writeoff']
        );
        
        // Восстанавливаем остаток
        const restoredStock = materialData.stock + oldMaterial.quantity;
        await db.run(
          usePostgres
            ? 'UPDATE materials SET stock = $1 WHERE id = $2'
            : 'UPDATE materials SET stock = ? WHERE id = ?',
          [restoredStock, oldMaterial.material_id]
        );
      }
    }
    
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
    
    // Получаем информацию о записи (используем один запрос для doctor_id и client_id)
    const appointmentData = await db.get(
      usePostgres
        ? 'SELECT doctor_id, client_id FROM appointments WHERE id = $1'
        : 'SELECT doctor_id, client_id FROM appointments WHERE id = ?',
      [req.params.id]
    );
    
    // Добавляем новые материалы и автоматически списываем их
    if (materials && materials.length > 0) {
      for (const material of materials) {
        const materialQuantity = material.quantity || 1;
        
        // Добавляем материал к записи
        await db.run(
          usePostgres
            ? 'INSERT INTO appointment_materials (appointment_id, material_id, quantity) VALUES ($1, $2, $3)'
            : 'INSERT INTO appointment_materials (appointment_id, material_id, quantity) VALUES (?, ?, ?)',
          [req.params.id, material.material_id, materialQuantity]
        );
        
        // Получаем информацию о материале для списания
        const materialData = await db.get(
          usePostgres ? 'SELECT * FROM materials WHERE id = $1' : 'SELECT * FROM materials WHERE id = ?',
          [material.material_id]
        );
        
        if (materialData) {
          // Проверяем, достаточно ли материала на складе
          if (materialData.stock < materialQuantity) {
            console.warn(`⚠️ Недостаточно материала ${materialData.name} на складе. Остаток: ${materialData.stock}, требуется: ${materialQuantity}`);
            // Продолжаем выполнение, но логируем предупреждение
          }
          
          // Создаем запись о списании (автоматическое)
          await db.run(
            usePostgres
              ? 'INSERT INTO material_transactions (material_id, transaction_type, quantity, price, notes, appointment_id, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7)'
              : 'INSERT INTO material_transactions (material_id, transaction_type, quantity, price, notes, appointment_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
              material.material_id,
              'writeoff',
              materialQuantity,
              materialData.price,
              `Автоматическое списание при завершении приема #${req.params.id}`,
              req.params.id,
              appointmentData?.doctor_id || null
            ]
          );
          
          // Уменьшаем остаток материала
          const newStock = Math.max(0, materialData.stock - materialQuantity); // Не позволяем уйти в минус
          await db.run(
            usePostgres
              ? 'UPDATE materials SET stock = $1 WHERE id = $2'
              : 'UPDATE materials SET stock = ? WHERE id = ?',
            [newStock, material.material_id]
          );
        }
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
    
    // Обновляем запись (applied_composites — составные услуги для отображения в карточке)
    const appliedCompositesJson = Array.isArray(applied_composites) && applied_composites.length > 0
      ? JSON.stringify(applied_composites.map(c => ({ composite_service_id: c.composite_service_id, quantity: c.quantity || 1 })))
      : '[]';
    const isDeferred = form_deferred === true;
    await db.run(
      usePostgres
        ? `UPDATE appointments SET diagnosis = $1, status = $2, total_price = $3, applied_composites = $4::jsonb,
           visit_type = $5, diagnosis_code = $6, treatment_code = $7, treatment_description = $8, preventive_work = $9, treatment_stage = $10,
           form_deferred = $11
           WHERE id = $12`
        : `UPDATE appointments SET diagnosis = ?, status = ?, total_price = ?, applied_composites = ?,
           visit_type = ?, diagnosis_code = ?, treatment_code = ?, treatment_description = ?, preventive_work = ?, treatment_stage = ?,
           form_deferred = ?
           WHERE id = ?`,
      [diagnosis, 'ready_for_payment', totalPrice, appliedCompositesJson,
       isDeferred ? null : (visit_type || null),
       isDeferred ? null : (diagnosis_code || null),
       isDeferred ? null : (treatment_code || null),
       isDeferred ? null : (treatment_description || null),
       isDeferred ? null : (preventive_work || null),
       isDeferred ? null : (treatment_stage || null),
       isDeferred,
       req.params.id]
    );

    // Сохраняем план лечения, если он был передан и найден клиент
    if (appointmentData?.client_id && treatment_plan !== undefined) {
      const normalizedPlan = treatment_plan ? treatment_plan.trim() : '';
      await db.run(
        usePostgres
          ? 'UPDATE clients SET treatment_plan = $1 WHERE id = $2'
          : 'UPDATE clients SET treatment_plan = ? WHERE id = ?',
        [normalizedPlan || null, appointmentData.client_id]
      );
      console.log(
        `✅ План лечения сохранен для клиента ${appointmentData.client_id}:`,
        normalizedPlan ? `${normalizedPlan.length} символов` : 'пустой'
      );
    }

    // === АВТОМАТИЧЕСКОЕ СОЗДАНИЕ ЗАПИСИ ФОРМЫ 037/у ===
    // Пропускаем создание записи формы, если врач выбрал «заполнить позже»
    let formRecordWarning = null;
    if (!isDeferred) try {
      // Получаем полные данные о записи и клиенте
      const fullAppointment = await db.get(
        usePostgres
          ? 'SELECT a.*, c."lastName", c."firstName", c."middleName", c.address, c.citizenship_data, c.date_of_birth, c.population_type FROM appointments a LEFT JOIN clients c ON a.client_id = c.id WHERE a.id = $1'
          : 'SELECT a.*, c."lastName", c."firstName", c."middleName", c.address, c.citizenship_data, c.date_of_birth, c.population_type FROM appointments a LEFT JOIN clients c ON a.client_id = c.id WHERE a.id = ?',
        [req.params.id]
      );

      if (fullAppointment && fullAppointment.doctor_id) {
        // Формируем ФИО
        const patientName = [fullAppointment.lastName, fullAppointment.firstName, fullAppointment.middleName].filter(Boolean).join(' ');
        
        // Вычисляем возраст из даты рождения
        let patientAge = null;
        if (fullAppointment.date_of_birth) {
          const dob = new Date(fullAppointment.date_of_birth);
          const today = new Date();
          patientAge = today.getFullYear() - dob.getFullYear();
          const m = today.getMonth() - dob.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
            patientAge--;
          }
        }

        // Определяем дату и время записи — безопасный парсинг (Date объект, строка или null)
        let rawDate = fullAppointment.appointment_date;
        // Если PostgreSQL вернул Date объект — конвертируем в строку
        if (rawDate instanceof Date) {
          rawDate = rawDate.toISOString();
        }
        const appointmentDate = (rawDate && typeof rawDate === 'string') ? rawDate : new Date().toISOString().split('T')[0];
        let recordDate = appointmentDate;
        let recordTime = null;
        if (typeof appointmentDate === 'string' && appointmentDate.includes(' ')) {
          const parts = appointmentDate.split(' ');
          recordDate = parts[0];
          recordTime = parts[1] || null;
        } else if (typeof appointmentDate === 'string' && appointmentDate.includes('T')) {
          const parts = appointmentDate.split('T');
          recordDate = parts[0];
          recordTime = parts[1] ? parts[1].substring(0, 5) : null;
        }

        // Удаляем старую запись для этого приёма (если перезавершается)
        await db.run(
          usePostgres
            ? 'DELETE FROM doctor_work_records WHERE appointment_id = $1'
            : 'DELETE FROM doctor_work_records WHERE appointment_id = ?',
          [req.params.id]
        );

        // Создаём новую запись формы 037/у
        await db.run(
          usePostgres
            ? `INSERT INTO doctor_work_records 
               (doctor_id, record_date, record_time, patient_name, patient_address, citizenship_data, patient_age, visit_type, preventive_work, diagnosis_code, diagnosis_description, treatment_code, treatment_description, treatment_stage, population_type, appointment_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`
            : `INSERT INTO doctor_work_records 
               (doctor_id, record_date, record_time, patient_name, patient_address, citizenship_data, patient_age, visit_type, preventive_work, diagnosis_code, diagnosis_description, treatment_code, treatment_description, treatment_stage, population_type, appointment_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            fullAppointment.doctor_id,
            recordDate,
            recordTime,
            patientName || 'Неизвестный пациент',
            fullAppointment.address || null,
            fullAppointment.citizenship_data || null,
            patientAge,
            visit_type || null,
            preventive_work || null,
            diagnosis_code || null,
            diagnosis || null,
            treatment_code || null,
            treatment_description || null,
            treatment_stage || null,
            fullAppointment.population_type || 'city',
            parseInt(req.params.id)
          ]
        );
        console.log(`✅ Запись формы 037/у автоматически создана для приёма #${req.params.id}, diagnosis_code=${diagnosis_code}, treatment_code=${treatment_code}`);
      } else {
        formRecordWarning = 'Не удалось создать запись формы 037/у: не найден врач для записи';
        console.warn(`⚠️  ${formRecordWarning} (appointment #${req.params.id})`);
      }
    } catch (workRecordError) {
      // Не прерываем завершение приёма из-за ошибки формы 037/у, но передаём предупреждение клиенту
      formRecordWarning = `Ошибка создания записи формы 037/у: ${workRecordError.message}`;
      console.error(`⚠️  ${formRecordWarning} (appointment #${req.params.id})`, workRecordError.stack);
    }
    
    // Real-time: уведомляем все подключенные клиенты
    io.emit('appointmentUpdated', { 
      appointmentId: parseInt(req.params.id), 
      status: 'ready_for_payment',
      type: 'visit_completed'
    });
    
    const response = { message: 'Прием завершен', status: 'ready_for_payment', form_deferred: isDeferred };
    if (formRecordWarning) response.formWarning = formRecordWarning;
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Заполнить отложенные данные формы 037/у
app.patch('/api/appointments/:id/fill-deferred-form', async (req, res) => {
  const { visit_type, diagnosis_code, treatment_code, treatment_description, preventive_work, treatment_stage } = req.body;
  try {
    // Проверяем, что запись существует и form_deferred = true
    const appointment = await db.get(
      usePostgres
        ? 'SELECT a.*, c."lastName", c."firstName", c."middleName", c.address, c.citizenship_data, c.date_of_birth, c.population_type FROM appointments a LEFT JOIN clients c ON a.client_id = c.id WHERE a.id = $1'
        : 'SELECT a.*, c."lastName", c."firstName", c."middleName", c.address, c.citizenship_data, c.date_of_birth, c.population_type FROM appointments a LEFT JOIN clients c ON a.client_id = c.id WHERE a.id = ?',
      [req.params.id]
    );

    if (!appointment) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }
    if (!appointment.form_deferred) {
      return res.status(400).json({ error: 'Форма уже заполнена для этой записи' });
    }

    // Обновляем поля формы и снимаем флаг form_deferred
    await db.run(
      usePostgres
        ? `UPDATE appointments SET 
             visit_type = $1, diagnosis_code = $2, treatment_code = $3, 
             treatment_description = $4, preventive_work = $5, treatment_stage = $6,
             form_deferred = false
           WHERE id = $7`
        : `UPDATE appointments SET 
             visit_type = ?, diagnosis_code = ?, treatment_code = ?, 
             treatment_description = ?, preventive_work = ?, treatment_stage = ?,
             form_deferred = 0
           WHERE id = ?`,
      [
        visit_type || null, diagnosis_code || null, treatment_code || null,
        treatment_description || null, preventive_work || null, treatment_stage || null,
        req.params.id
      ]
    );

    // Создаём запись формы 037/у (тот же код, что и в complete-visit)
    let formRecordWarning = null;
    try {
      if (appointment.doctor_id) {
        const patientName = [appointment.lastName, appointment.firstName, appointment.middleName].filter(Boolean).join(' ');
        
        let patientAge = null;
        if (appointment.date_of_birth) {
          const dob = new Date(appointment.date_of_birth);
          const today = new Date();
          patientAge = today.getFullYear() - dob.getFullYear();
          const m = today.getMonth() - dob.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
            patientAge--;
          }
        }

        // Безопасный парсинг даты (Date объект, строка или null)
        let rawDate = appointment.appointment_date;
        if (rawDate instanceof Date) {
          rawDate = rawDate.toISOString();
        }
        const appointmentDate = (rawDate && typeof rawDate === 'string') ? rawDate : new Date().toISOString().split('T')[0];
        let recordDate = appointmentDate;
        let recordTime = null;
        if (typeof appointmentDate === 'string' && appointmentDate.includes(' ')) {
          const parts = appointmentDate.split(' ');
          recordDate = parts[0];
          recordTime = parts[1] || null;
        } else if (typeof appointmentDate === 'string' && appointmentDate.includes('T')) {
          const parts = appointmentDate.split('T');
          recordDate = parts[0];
          recordTime = parts[1] ? parts[1].substring(0, 5) : null;
        }

        // Удаляем старую запись для этого приёма (если была)
        await db.run(
          usePostgres
            ? 'DELETE FROM doctor_work_records WHERE appointment_id = $1'
            : 'DELETE FROM doctor_work_records WHERE appointment_id = ?',
          [req.params.id]
        );

        // Создаём новую запись формы 037/у
        await db.run(
          usePostgres
            ? `INSERT INTO doctor_work_records 
               (doctor_id, record_date, record_time, patient_name, patient_address, citizenship_data, patient_age, visit_type, preventive_work, diagnosis_code, diagnosis_description, treatment_code, treatment_description, treatment_stage, population_type, appointment_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`
            : `INSERT INTO doctor_work_records 
               (doctor_id, record_date, record_time, patient_name, patient_address, citizenship_data, patient_age, visit_type, preventive_work, diagnosis_code, diagnosis_description, treatment_code, treatment_description, treatment_stage, population_type, appointment_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            appointment.doctor_id,
            recordDate,
            recordTime,
            patientName || 'Неизвестный пациент',
            appointment.address || null,
            appointment.citizenship_data || null,
            patientAge,
            visit_type || null,
            preventive_work || null,
            diagnosis_code || null,
            appointment.diagnosis || null,
            treatment_code || null,
            treatment_description || null,
            treatment_stage || null,
            appointment.population_type || 'city',
            parseInt(req.params.id)
          ]
        );
        console.log(`✅ Запись формы 037/у создана из отложенных для приёма #${req.params.id}, diagnosis_code=${diagnosis_code}, treatment_code=${treatment_code}`);
      } else {
        formRecordWarning = 'Не удалось создать запись формы 037/у: не найден врач';
        console.warn(`⚠️  ${formRecordWarning} (appointment #${req.params.id})`);
      }
    } catch (workRecordError) {
      formRecordWarning = `Ошибка создания записи формы 037/у: ${workRecordError.message}`;
      console.error(`⚠️  ${formRecordWarning} (appointment #${req.params.id})`, workRecordError.stack);
    }

    // Real-time уведомление
    io.emit('appointmentUpdated', {
      appointmentId: parseInt(req.params.id),
      type: 'deferred_form_filled'
    });

    const response = { message: 'Данные формы 037/у заполнены', form_deferred: false };
    if (formRecordWarning) response.formWarning = formRecordWarning;
    res.json(response);
  } catch (error) {
    console.error('Ошибка заполнения отложенной формы:', error);
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
      
      // Нормализуем appointment_date для корректного отображения времени
      let normalizedAppointmentDate = appointment.appointment_date;
      if (normalizedAppointmentDate) {
        normalizedAppointmentDate = normalizeAppointmentDate(normalizedAppointmentDate.toString());
      }
      
      return {
        ...appointment,
        appointment_date: normalizedAppointmentDate,
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

// ========== STATISTICS ==========

// Получить статистику по материалам
app.get('/api/statistics/materials', async (req, res) => {
  try {
    let { date, month, year, doctor_id } = req.query;
    
    // Нормализуем входные даты
    if (date) {
      date = normalizeDateForSQL(date);
    }
    if (month) {
      month = parseInt(month);
    }
    if (year) {
      year = parseInt(year);
    }
    
    // Получаем текущие остатки
    const currentStock = await db.all('SELECT * FROM materials ORDER BY name');
    
    // Формируем условия для фильтрации по дате
    let dateCondition = '';
    const dateParams = [];
    
    // Получаем приходы
    let receiptsQuery = '';
    let receiptsParams = [];
    
    if (date) {
      // Фильтр по конкретному дню
      receiptsQuery = usePostgres
        ? `SELECT 
            mt.id,
            mt.created_at as date,
            m.name as material_name,
            m.unit,
            mt.quantity,
            mt.price,
            (mt.quantity * mt.price) as total,
            mt.notes
          FROM material_transactions mt
          JOIN materials m ON mt.material_id = m.id
          WHERE mt.transaction_type = 'receipt' 
            AND DATE(mt.created_at) = $1::date
          ORDER BY mt.created_at DESC`
        : `SELECT 
            mt.id,
            mt.created_at as date,
            m.name as material_name,
            m.unit,
            mt.quantity,
            mt.price,
            (mt.quantity * mt.price) as total,
            mt.notes
          FROM material_transactions mt
          JOIN materials m ON mt.material_id = m.id
          WHERE mt.transaction_type = 'receipt' 
            AND DATE(mt.created_at) = ?
          ORDER BY mt.created_at DESC`;
      receiptsParams.push(date);
    } else if (month && year) {
      // Фильтр по месяцу
      receiptsQuery = usePostgres
        ? `SELECT 
            mt.id,
            mt.created_at as date,
            m.name as material_name,
            m.unit,
            mt.quantity,
            mt.price,
            (mt.quantity * mt.price) as total,
            mt.notes
          FROM material_transactions mt
          JOIN materials m ON mt.material_id = m.id
          WHERE mt.transaction_type = 'receipt' 
            AND EXTRACT(MONTH FROM mt.created_at) = $1 
            AND EXTRACT(YEAR FROM mt.created_at) = $2
          ORDER BY mt.created_at DESC`
        : `SELECT 
            mt.id,
            mt.created_at as date,
            m.name as material_name,
            m.unit,
            mt.quantity,
            mt.price,
            (mt.quantity * mt.price) as total,
            mt.notes
          FROM material_transactions mt
          JOIN materials m ON mt.material_id = m.id
          WHERE mt.transaction_type = 'receipt' 
            AND strftime('%m', mt.created_at) = ? 
            AND strftime('%Y', mt.created_at) = ?
          ORDER BY mt.created_at DESC`;
      receiptsParams.push(month, year);
    } else {
      // За все время
      receiptsQuery = `SELECT 
        mt.id,
        mt.created_at as date,
        m.name as material_name,
        m.unit,
        mt.quantity,
        mt.price,
        (mt.quantity * mt.price) as total,
        mt.notes
      FROM material_transactions mt
      JOIN materials m ON mt.material_id = m.id
      WHERE mt.transaction_type = 'receipt'
      ORDER BY mt.created_at DESC`;
    }
    
    const receipts = await db.all(receiptsQuery, receiptsParams);
    
    // Получаем использование (из appointment_materials)
    let usageQuery = '';
    let usageParams = [];
    
    if (date) {
      usageQuery = usePostgres
        ? `SELECT 
            am.id,
            a.appointment_date as date,
            m.name as material_name,
            m.unit,
            am.quantity,
            m.price,
            (am.quantity * m.price) as total,
            '' as notes
          FROM appointment_materials am
          JOIN materials m ON am.material_id = m.id
          JOIN appointments a ON am.appointment_id = a.id
          WHERE DATE(a.appointment_date::timestamp) = $1::date
          ORDER BY a.appointment_date DESC`
        : `SELECT 
            am.id,
            a.appointment_date as date,
            m.name as material_name,
            m.unit,
            am.quantity,
            m.price,
            (am.quantity * m.price) as total,
            '' as notes
          FROM appointment_materials am
          JOIN materials m ON am.material_id = m.id
          JOIN appointments a ON am.appointment_id = a.id
          WHERE DATE(a.appointment_date) = ?
          ORDER BY a.appointment_date DESC`;
      usageParams.push(date);
    } else if (month && year) {
      usageQuery = usePostgres
        ? `SELECT 
            am.id,
            a.appointment_date as date,
            m.name as material_name,
            m.unit,
            am.quantity,
            m.price,
            (am.quantity * m.price) as total,
            '' as notes
          FROM appointment_materials am
          JOIN materials m ON am.material_id = m.id
          JOIN appointments a ON am.appointment_id = a.id
          WHERE EXTRACT(MONTH FROM a.appointment_date::timestamp) = $1 
            AND EXTRACT(YEAR FROM a.appointment_date::timestamp) = $2
          ORDER BY a.appointment_date DESC`
        : `SELECT 
            am.id,
            a.appointment_date as date,
            m.name as material_name,
            m.unit,
            am.quantity,
            m.price,
            (am.quantity * m.price) as total,
            '' as notes
          FROM appointment_materials am
          JOIN materials m ON am.material_id = m.id
          JOIN appointments a ON am.appointment_id = a.id
          WHERE strftime('%m', a.appointment_date) = ? 
            AND strftime('%Y', a.appointment_date) = ?
          ORDER BY a.appointment_date DESC`;
      usageParams.push(month, year);
    } else {
      // За все время
      usageQuery = `SELECT 
        am.id,
        a.appointment_date as date,
        m.name as material_name,
        m.unit,
        am.quantity,
        m.price,
        (am.quantity * m.price) as total,
        '' as notes
      FROM appointment_materials am
      JOIN materials m ON am.material_id = m.id
      JOIN appointments a ON am.appointment_id = a.id
      ORDER BY a.appointment_date DESC`;
    }
    
    const usage = await db.all(usageQuery, usageParams);
    
    // Получаем списания (writeoffs) с информацией о врачах
    let writeoffsQuery = '';
    let writeoffsParams = [];
    
    if (date) {
      writeoffsQuery = usePostgres
        ? `SELECT 
            mt.id,
            mt.created_at as date,
            m.name as material_name,
            m.unit,
            mt.quantity,
            mt.price,
            (mt.quantity * mt.price) as total,
            mt.notes,
            mt.appointment_id,
            (SELECT "firstName" FROM doctors WHERE id = COALESCE(a.doctor_id, mt.created_by) LIMIT 1) as doctor_firstName,
            (SELECT "lastName" FROM doctors WHERE id = COALESCE(a.doctor_id, mt.created_by) LIMIT 1) as doctor_lastName,
            (SELECT "middleName" FROM doctors WHERE id = COALESCE(a.doctor_id, mt.created_by) LIMIT 1) as doctor_middleName,
            COALESCE(a.doctor_id, mt.created_by) as doctor_id
          FROM material_transactions mt
          JOIN materials m ON mt.material_id = m.id
          LEFT JOIN appointments a ON mt.appointment_id = a.id
          WHERE mt.transaction_type = 'writeoff'
            AND DATE(mt.created_at) = $1::date
          ORDER BY mt.created_at DESC`
        : `SELECT 
            mt.id,
            mt.created_at as date,
            m.name as material_name,
            m.unit,
            mt.quantity,
            mt.price,
            (mt.quantity * mt.price) as total,
            mt.notes,
            mt.appointment_id,
            (SELECT firstName FROM doctors WHERE id = COALESCE(a.doctor_id, mt.created_by) LIMIT 1) as doctor_firstName,
            (SELECT lastName FROM doctors WHERE id = COALESCE(a.doctor_id, mt.created_by) LIMIT 1) as doctor_lastName,
            (SELECT middleName FROM doctors WHERE id = COALESCE(a.doctor_id, mt.created_by) LIMIT 1) as doctor_middleName,
            COALESCE(a.doctor_id, mt.created_by) as doctor_id
          FROM material_transactions mt
          JOIN materials m ON mt.material_id = m.id
          LEFT JOIN appointments a ON mt.appointment_id = a.id
          WHERE mt.transaction_type = 'writeoff'
            AND DATE(mt.created_at) = ?
          ORDER BY mt.created_at DESC`;
      writeoffsParams.push(date);
    } else if (month && year) {
      writeoffsQuery = usePostgres
        ? `SELECT 
            mt.id,
            mt.created_at as date,
            m.name as material_name,
            m.unit,
            mt.quantity,
            mt.price,
            (mt.quantity * mt.price) as total,
            mt.notes,
            mt.appointment_id,
            (SELECT "firstName" FROM doctors WHERE id = COALESCE(a.doctor_id, mt.created_by) LIMIT 1) as doctor_firstName,
            (SELECT "lastName" FROM doctors WHERE id = COALESCE(a.doctor_id, mt.created_by) LIMIT 1) as doctor_lastName,
            (SELECT "middleName" FROM doctors WHERE id = COALESCE(a.doctor_id, mt.created_by) LIMIT 1) as doctor_middleName,
            COALESCE(a.doctor_id, mt.created_by) as doctor_id
          FROM material_transactions mt
          JOIN materials m ON mt.material_id = m.id
          LEFT JOIN appointments a ON mt.appointment_id = a.id
          WHERE mt.transaction_type = 'writeoff'
            AND EXTRACT(MONTH FROM mt.created_at) = $1 
            AND EXTRACT(YEAR FROM mt.created_at) = $2
          ORDER BY mt.created_at DESC`
        : `SELECT 
            mt.id,
            mt.created_at as date,
            m.name as material_name,
            m.unit,
            mt.quantity,
            mt.price,
            (mt.quantity * mt.price) as total,
            mt.notes,
            mt.appointment_id,
            (SELECT firstName FROM doctors WHERE id = COALESCE(a.doctor_id, mt.created_by) LIMIT 1) as doctor_firstName,
            (SELECT lastName FROM doctors WHERE id = COALESCE(a.doctor_id, mt.created_by) LIMIT 1) as doctor_lastName,
            (SELECT middleName FROM doctors WHERE id = COALESCE(a.doctor_id, mt.created_by) LIMIT 1) as doctor_middleName,
            COALESCE(a.doctor_id, mt.created_by) as doctor_id
          FROM material_transactions mt
          JOIN materials m ON mt.material_id = m.id
          LEFT JOIN appointments a ON mt.appointment_id = a.id
          WHERE mt.transaction_type = 'writeoff'
            AND strftime('%m', mt.created_at) = ? 
            AND strftime('%Y', mt.created_at) = ?
          ORDER BY mt.created_at DESC`;
      writeoffsParams.push(month, year);
    } else {
      writeoffsQuery = usePostgres
        ? `SELECT 
            mt.id,
            mt.created_at as date,
            m.name as material_name,
            m.unit,
            mt.quantity,
            mt.price,
            (mt.quantity * mt.price) as total,
            mt.notes,
            mt.appointment_id,
            (SELECT "firstName" FROM doctors WHERE id = COALESCE(a.doctor_id, mt.created_by) LIMIT 1) as doctor_firstName,
            (SELECT "lastName" FROM doctors WHERE id = COALESCE(a.doctor_id, mt.created_by) LIMIT 1) as doctor_lastName,
            (SELECT "middleName" FROM doctors WHERE id = COALESCE(a.doctor_id, mt.created_by) LIMIT 1) as doctor_middleName,
            COALESCE(a.doctor_id, mt.created_by) as doctor_id
          FROM material_transactions mt
          JOIN materials m ON mt.material_id = m.id
          LEFT JOIN appointments a ON mt.appointment_id = a.id
          WHERE mt.transaction_type = 'writeoff'
          ORDER BY mt.created_at DESC`
        : `SELECT 
            mt.id,
            mt.created_at as date,
            m.name as material_name,
            m.unit,
            mt.quantity,
            mt.price,
            (mt.quantity * mt.price) as total,
            mt.notes,
            mt.appointment_id,
            (SELECT firstName FROM doctors WHERE id = COALESCE(a.doctor_id, mt.created_by) LIMIT 1) as doctor_firstName,
            (SELECT lastName FROM doctors WHERE id = COALESCE(a.doctor_id, mt.created_by) LIMIT 1) as doctor_lastName,
            (SELECT middleName FROM doctors WHERE id = COALESCE(a.doctor_id, mt.created_by) LIMIT 1) as doctor_middleName,
            COALESCE(a.doctor_id, mt.created_by) as doctor_id
          FROM material_transactions mt
          JOIN materials m ON mt.material_id = m.id
          LEFT JOIN appointments a ON mt.appointment_id = a.id
          WHERE mt.transaction_type = 'writeoff'
          ORDER BY mt.created_at DESC`;
    }
    
    // Применяем фильтр по врачу, если указан
    if (doctor_id) {
      const doctorFilter = usePostgres 
        ? ` AND COALESCE(a.doctor_id, mt.created_by) = $${writeoffsParams.length + 1}`
        : ` AND COALESCE(a.doctor_id, mt.created_by) = ?`;
      // Добавляем фильтр перед ORDER BY
      writeoffsQuery = writeoffsQuery.replace(
        /ORDER BY/i,
        `${doctorFilter}\n          ORDER BY`
      );
      writeoffsParams.push(doctor_id);
    }
    
    const writeoffs = await db.all(writeoffsQuery, writeoffsParams);
    
    // Получаем список врачей для фильтра
    const doctors = await db.all(usePostgres 
      ? 'SELECT id, "firstName", "lastName", "middleName" FROM doctors ORDER BY "lastName"'
      : 'SELECT id, firstName, lastName, middleName FROM doctors ORDER BY lastName'
    );
    
    // Рассчитываем суммы
    const receiptsTotal = receipts.reduce((sum, r) => sum + (r.total || 0), 0);
    const usageTotal = usage.reduce((sum, u) => sum + (u.total || 0), 0);
    const writeoffsTotal = writeoffs.reduce((sum, w) => sum + (w.total || 0), 0);
    
    res.json({
      currentStock: currentStock.map(m => ({
        ...m,
        total_value: m.price * m.stock
      })),
      receipts,
      usage,
      writeoffs,
      doctors,
      totals: {
        receipts: receiptsTotal,
        usage: usageTotal,
        writeoffs: writeoffsTotal
      }
    });
  } catch (error) {
    console.error('Ошибка загрузки статистики:', error);
    res.status(500).json({ error: error.message });
  }
});

// Исправить данные о врачах в списаниях (синхронизация created_by с doctor_id из appointments)
app.post('/api/statistics/materials/fix-doctors', async (req, res) => {
  try {
    console.log('🔄 Обновление данных о врачах в списаниях материалов...');
    
    // Принудительно обновляем created_by для всех записей, где есть appointment_id
    const updateQuery = usePostgres
      ? `UPDATE material_transactions mt
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
           )`
      : `UPDATE material_transactions mt
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
           )`;
    
    const result = await db.run(updateQuery);
    const updatedCount = result.changes || result.rowCount || 0;
    
    console.log(`✅ Обновлено ${updatedCount} записей`);
    
    res.json({ 
      success: true, 
      message: `Обновлено ${updatedCount} записей о списаниях с информацией о враче`,
      updated: updatedCount
    });
  } catch (error) {
    console.error('❌ Ошибка обновления данных о врачах:', error);
    res.status(500).json({ error: error.message });
  }
});

// Выгрузка отчета в Excel
app.get('/api/statistics/materials/export', async (req, res) => {
  try {
    const XLSX = require('xlsx');
    let { type, date, month, year } = req.query;
    
    // Поддержка старого названия 'usage' для обратной совместимости
    if (type === 'usage') {
      type = 'writeoffs';
    }
    
    // Нормализуем входные даты
    if (date) {
      date = normalizeDateForSQL(date);
    }
    if (month) {
      month = parseInt(month);
    }
    if (year) {
      year = parseInt(year);
    }
    
    // Получаем данные аналогично статистике
    let query = '';
    let params = [];
    
    if (type === 'receipts') {
      if (date) {
        query = usePostgres
          ? `SELECT 
              mt.created_at as date,
              m.name as material_name,
              m.unit,
              mt.quantity,
              mt.price,
              (mt.quantity * mt.price) as total,
              mt.notes
            FROM material_transactions mt
            JOIN materials m ON mt.material_id = m.id
            WHERE mt.transaction_type = 'receipt' 
              AND DATE(mt.created_at) = $1::date
            ORDER BY mt.created_at DESC`
          : `SELECT 
              mt.created_at as date,
              m.name as material_name,
              m.unit,
              mt.quantity,
              mt.price,
              (mt.quantity * mt.price) as total,
              mt.notes
            FROM material_transactions mt
            JOIN materials m ON mt.material_id = m.id
            WHERE mt.transaction_type = 'receipt' 
              AND DATE(mt.created_at) = ?
            ORDER BY mt.created_at DESC`;
        params.push(date);
      } else if (month && year) {
        query = usePostgres
          ? `SELECT 
              mt.created_at as date,
              m.name as material_name,
              m.unit,
              mt.quantity,
              mt.price,
              (mt.quantity * mt.price) as total,
              mt.notes
            FROM material_transactions mt
            JOIN materials m ON mt.material_id = m.id
            WHERE mt.transaction_type = 'receipt' 
              AND EXTRACT(MONTH FROM mt.created_at) = $1 
              AND EXTRACT(YEAR FROM mt.created_at) = $2
            ORDER BY mt.created_at DESC`
          : `SELECT 
              mt.created_at as date,
              m.name as material_name,
              m.unit,
              mt.quantity,
              mt.price,
              (mt.quantity * mt.price) as total,
              mt.notes
            FROM material_transactions mt
            JOIN materials m ON mt.material_id = m.id
            WHERE mt.transaction_type = 'receipt' 
              AND strftime('%m', mt.created_at) = ? 
              AND strftime('%Y', mt.created_at) = ?
            ORDER BY mt.created_at DESC`;
        params.push(month, year);
      } else {
        query = `SELECT 
          mt.created_at as date,
          m.name as material_name,
          m.unit,
          mt.quantity,
          mt.price,
          (mt.quantity * mt.price) as total,
          mt.notes
        FROM material_transactions mt
        JOIN materials m ON mt.material_id = m.id
        WHERE mt.transaction_type = 'receipt'
        ORDER BY mt.created_at DESC`;
      }
    } else {
      // usage - используем реальные списания из material_transactions
      if (date) {
        query = usePostgres
          ? `SELECT 
              mt.created_at as date,
              m.name as material_name,
              m.unit,
              mt.quantity,
              mt.price,
              (mt.quantity * mt.price) as total,
              mt.notes,
              mt.appointment_id,
              COALESCE(d."firstName", d2."firstName") as doctor_firstName,
              COALESCE(d."lastName", d2."lastName") as doctor_lastName,
              COALESCE(d."middleName", d2."middleName") as doctor_middleName
            FROM material_transactions mt
            JOIN materials m ON mt.material_id = m.id
            LEFT JOIN appointments a ON mt.appointment_id = a.id
            LEFT JOIN doctors d ON mt.created_by = d.id
            LEFT JOIN doctors d2 ON a.doctor_id = d2.id
            WHERE mt.transaction_type = 'writeoff'
              AND DATE(mt.created_at) = $1::date
            ORDER BY mt.created_at DESC`
          : `SELECT 
              mt.created_at as date,
              m.name as material_name,
              m.unit,
              mt.quantity,
              mt.price,
              (mt.quantity * mt.price) as total,
              mt.notes,
              mt.appointment_id,
              COALESCE(d.firstName, d2.firstName) as doctor_firstName,
              COALESCE(d.lastName, d2.lastName) as doctor_lastName,
              COALESCE(d.middleName, d2.middleName) as doctor_middleName
            FROM material_transactions mt
            JOIN materials m ON mt.material_id = m.id
            LEFT JOIN appointments a ON mt.appointment_id = a.id
            LEFT JOIN doctors d ON mt.created_by = d.id
            LEFT JOIN doctors d2 ON a.doctor_id = d2.id
            WHERE mt.transaction_type = 'writeoff'
              AND DATE(mt.created_at) = ?
            ORDER BY mt.created_at DESC`;
        params.push(date);
      } else if (month && year) {
        query = usePostgres
          ? `SELECT 
              mt.created_at as date,
              m.name as material_name,
              m.unit,
              mt.quantity,
              mt.price,
              (mt.quantity * mt.price) as total,
              mt.notes,
              mt.appointment_id,
              COALESCE(d."firstName", d2."firstName") as doctor_firstName,
              COALESCE(d."lastName", d2."lastName") as doctor_lastName,
              COALESCE(d."middleName", d2."middleName") as doctor_middleName
            FROM material_transactions mt
            JOIN materials m ON mt.material_id = m.id
            LEFT JOIN appointments a ON mt.appointment_id = a.id
            LEFT JOIN doctors d ON mt.created_by = d.id
            LEFT JOIN doctors d2 ON a.doctor_id = d2.id
            WHERE mt.transaction_type = 'writeoff'
              AND EXTRACT(MONTH FROM mt.created_at) = $1 
              AND EXTRACT(YEAR FROM mt.created_at) = $2
            ORDER BY mt.created_at DESC`
          : `SELECT 
              mt.created_at as date,
              m.name as material_name,
              m.unit,
              mt.quantity,
              mt.price,
              (mt.quantity * mt.price) as total,
              mt.notes,
              mt.appointment_id,
              COALESCE(d.firstName, d2.firstName) as doctor_firstName,
              COALESCE(d.lastName, d2.lastName) as doctor_lastName,
              COALESCE(d.middleName, d2.middleName) as doctor_middleName
            FROM material_transactions mt
            JOIN materials m ON mt.material_id = m.id
            LEFT JOIN appointments a ON mt.appointment_id = a.id
            LEFT JOIN doctors d ON mt.created_by = d.id
            LEFT JOIN doctors d2 ON a.doctor_id = d2.id
            WHERE mt.transaction_type = 'writeoff'
              AND strftime('%m', mt.created_at) = ? 
              AND strftime('%Y', mt.created_at) = ?
            ORDER BY mt.created_at DESC`;
        params.push(month, year);
      } else {
        query = usePostgres
          ? `SELECT 
              mt.created_at as date,
              m.name as material_name,
              m.unit,
              mt.quantity,
              mt.price,
              (mt.quantity * mt.price) as total,
              mt.notes,
              mt.appointment_id,
              COALESCE(d."firstName", d2."firstName") as doctor_firstName,
              COALESCE(d."lastName", d2."lastName") as doctor_lastName,
              COALESCE(d."middleName", d2."middleName") as doctor_middleName
            FROM material_transactions mt
            JOIN materials m ON mt.material_id = m.id
            LEFT JOIN appointments a ON mt.appointment_id = a.id
            LEFT JOIN doctors d ON mt.created_by = d.id
            LEFT JOIN doctors d2 ON a.doctor_id = d2.id
            WHERE mt.transaction_type = 'writeoff'
            ORDER BY mt.created_at DESC`
          : `SELECT 
              mt.created_at as date,
              m.name as material_name,
              m.unit,
              mt.quantity,
              mt.price,
              (mt.quantity * mt.price) as total,
              mt.notes,
              mt.appointment_id,
              COALESCE(d.firstName, d2.firstName) as doctor_firstName,
              COALESCE(d.lastName, d2.lastName) as doctor_lastName,
              COALESCE(d.middleName, d2.middleName) as doctor_middleName
            FROM material_transactions mt
            JOIN materials m ON mt.material_id = m.id
            LEFT JOIN appointments a ON mt.appointment_id = a.id
            LEFT JOIN doctors d ON mt.created_by = d.id
            LEFT JOIN doctors d2 ON a.doctor_id = d2.id
            WHERE mt.transaction_type = 'writeoff'
            ORDER BY mt.created_at DESC`;
      }
    }
    
    const data = await db.all(query, params);
    
    // Группируем материалы по названию и единице измерения, суммируя количество и стоимость
    const groupedMaterials = {};
    
    data.forEach(item => {
      const key = `${item.material_name}_${item.unit || ''}`;
      
      if (!groupedMaterials[key]) {
        groupedMaterials[key] = {
          material_name: item.material_name,
          unit: item.unit || '-',
          totalQuantity: 0,
          totalAmount: 0,
          priceSum: 0,
          priceCount: 0,
          dates: new Set(),
          notes: []
        };
      }
      
      const group = groupedMaterials[key];
      group.totalQuantity += parseFloat(item.quantity) || 0;
      group.totalAmount += parseFloat(item.total) || 0;
      
      if (item.price) {
        group.priceSum += parseFloat(item.price);
        group.priceCount += 1;
      }
      
      // Сохраняем даты для отображения диапазона
      if (item.date) {
        group.dates.add(new Date(item.date).toLocaleDateString('ru-RU'));
      }
      
      // Сохраняем примечания только для ручных списаний (не автоматических)
      // Автоматические списания имеют appointment_id или содержат "Автоматическое списание"
      const isAutomatic = item.appointment_id || 
                         (item.notes && item.notes.includes('Автоматическое списание'));
      
      if (!isAutomatic && item.notes && item.notes.trim() && !group.notes.includes(item.notes.trim())) {
        if (group.notes.length < 3) {
          group.notes.push(item.notes.trim());
        }
      }
    });
    
    // Формируем данные для Excel из сгруппированных материалов
    const excelData = Object.values(groupedMaterials).map((group, idx) => {
      // Вычисляем среднюю цену за единицу
      const avgPrice = group.priceCount > 0 ? (group.totalAmount / group.totalQuantity) : null;
      
      // Формируем строку с датами (диапазон или список)
      let dateRange = '';
      const datesArray = Array.from(group.dates).sort();
      if (datesArray.length === 1) {
        dateRange = datesArray[0];
      } else if (datesArray.length <= 3) {
        dateRange = datesArray.join(', ');
      } else {
        dateRange = `${datesArray[0]} - ${datesArray[datesArray.length - 1]}`;
      }
      
      const row = {
        '№': idx + 1,
        'Период': dateRange || '-',
        'Материал': group.material_name,
        'Единица измерения': group.unit,
        'Количество': group.totalQuantity.toFixed(2),
        'Цена за единицу': avgPrice ? avgPrice.toFixed(2) : '-',
        'Сумма': group.totalAmount.toFixed(2),
        'Примечание': group.notes.length > 0 ? group.notes.join('; ') : '-'
      };
      
      return row;
    });
    
    // Сортируем по названию материала
    excelData.sort((a, b) => a['Материал'].localeCompare(b['Материал']));
    
    // Обновляем номера после сортировки
    excelData.forEach((row, idx) => {
      row['№'] = idx + 1;
    });
    
    // Добавляем итоговую строку
    const total = Object.values(groupedMaterials).reduce((sum, group) => sum + group.totalAmount, 0);
    const totalRow = {
      '№': '',
      'Период': '',
      'Материал': '',
      'Единица измерения': '',
      'Количество': '',
      'Цена за единицу': 'ИТОГО:',
      'Сумма': total.toFixed(2),
      'Примечание': ''
    };
    excelData.push(totalRow);
    
    // Создаем книгу Excel
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    const sheetName = type === 'receipts' ? 'Приходы' : 'Списания';
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    
    // Генерируем буфер
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    // Определяем имя файла
    let fileName = `отчет_${type === 'receipts' ? 'приходы' : 'списания'}`;
    if (date) {
      fileName += `_${date}`;
    } else if (month && year) {
      fileName += `_${year}-${String(month).padStart(2, '0')}`;
    } else {
      fileName += '_все_время';
    }
    fileName += '.xlsx';
    
    // Отправляем файл
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.send(excelBuffer);
  } catch (error) {
    console.error('Ошибка выгрузки отчета:', error);
    res.status(500).json({ error: error.message });
  }
});

// Выгрузка записей (appointments) в Excel
app.get('/api/statistics/appointments/export', async (req, res) => {
  try {
    const XLSX = require('xlsx');
    let { date, month, year, startDate, endDate } = req.query;
    
    // Нормализуем входные даты
    if (date) {
      date = normalizeDateForSQL(date);
    }
    if (month) {
      month = parseInt(month);
    }
    if (year) {
      year = parseInt(year);
    }
    if (startDate) {
      startDate = normalizeDateForSQL(startDate);
    }
    if (endDate) {
      endDate = normalizeDateForSQL(endDate);
    }
    
    // Формируем запрос в зависимости от фильтров
    let query = '';
    let params = [];
    
    if (date) {
      // За один день
      query = usePostgres
        ? `SELECT 
            a.id,
            a.appointment_date,
            a.client_id,
            a.doctor_id,
            COALESCE(c."lastName", '') as client_lastName,
            COALESCE(c."firstName", '') as client_firstName,
            COALESCE(c."middleName", '') as client_middleName,
            COALESCE(c.phone, '') as client_phone,
            COALESCE(d."lastName", '') as doctor_lastName,
            COALESCE(d."firstName", '') as doctor_firstName,
            COALESCE(d."middleName", '') as doctor_middleName,
            a.status,
            a.diagnosis,
            a.total_price,
            a.discount_amount,
            a.paid
          FROM appointments a
          LEFT JOIN clients c ON a.client_id = c.id
          LEFT JOIN doctors d ON a.doctor_id = d.id
          WHERE DATE(a.appointment_date::timestamp) = $1::date
          ORDER BY a.appointment_date`
        : `SELECT 
            a.id,
            a.appointment_date,
            a.client_id,
            a.doctor_id,
            COALESCE(c.lastName, '') as client_lastName,
            COALESCE(c.firstName, '') as client_firstName,
            COALESCE(c.middleName, '') as client_middleName,
            COALESCE(c.phone, '') as client_phone,
            COALESCE(d.lastName, '') as doctor_lastName,
            COALESCE(d.firstName, '') as doctor_firstName,
            COALESCE(d.middleName, '') as doctor_middleName,
            a.status,
            a.diagnosis,
            a.total_price,
            a.discount_amount,
            a.paid
          FROM appointments a
          LEFT JOIN clients c ON a.client_id = c.id
          LEFT JOIN doctors d ON a.doctor_id = d.id
          WHERE DATE(a.appointment_date) = ?
          ORDER BY a.appointment_date`;
      params.push(date);
    } else if (startDate && endDate) {
      // За период
      query = usePostgres
        ? `SELECT 
            a.id,
            a.appointment_date,
            a.client_id,
            a.doctor_id,
            COALESCE(c."lastName", '') as client_lastName,
            COALESCE(c."firstName", '') as client_firstName,
            COALESCE(c."middleName", '') as client_middleName,
            COALESCE(c.phone, '') as client_phone,
            COALESCE(d."lastName", '') as doctor_lastName,
            COALESCE(d."firstName", '') as doctor_firstName,
            COALESCE(d."middleName", '') as doctor_middleName,
            a.status,
            a.diagnosis,
            a.total_price,
            a.discount_amount,
            a.paid
          FROM appointments a
          LEFT JOIN clients c ON a.client_id = c.id
          LEFT JOIN doctors d ON a.doctor_id = d.id
          WHERE DATE(a.appointment_date::timestamp) BETWEEN $1::date AND $2::date
          ORDER BY a.appointment_date`
          : `SELECT 
            a.id,
            a.appointment_date,
            a.client_id,
            a.doctor_id,
            COALESCE(c.lastName, '') as client_lastName,
            COALESCE(c.firstName, '') as client_firstName,
            COALESCE(c.middleName, '') as client_middleName,
            COALESCE(c.phone, '') as client_phone,
            COALESCE(d.lastName, '') as doctor_lastName,
            COALESCE(d.firstName, '') as doctor_firstName,
            COALESCE(d.middleName, '') as doctor_middleName,
            a.status,
            a.diagnosis,
            a.total_price,
            a.discount_amount,
            a.paid
          FROM appointments a
          LEFT JOIN clients c ON a.client_id = c.id
          LEFT JOIN doctors d ON a.doctor_id = d.id
          WHERE DATE(a.appointment_date) BETWEEN ? AND ?
          ORDER BY a.appointment_date`;
      params.push(startDate, endDate);
    } else if (month && year) {
      // За месяц
      query = usePostgres
        ? `SELECT 
            a.id,
            a.appointment_date,
            a.client_id,
            a.doctor_id,
            COALESCE(c."lastName", '') as client_lastName,
            COALESCE(c."firstName", '') as client_firstName,
            COALESCE(c."middleName", '') as client_middleName,
            COALESCE(c.phone, '') as client_phone,
            COALESCE(d."lastName", '') as doctor_lastName,
            COALESCE(d."firstName", '') as doctor_firstName,
            COALESCE(d."middleName", '') as doctor_middleName,
            a.status,
            a.diagnosis,
            a.total_price,
            a.discount_amount,
            a.paid
          FROM appointments a
          LEFT JOIN clients c ON a.client_id = c.id
          LEFT JOIN doctors d ON a.doctor_id = d.id
          WHERE EXTRACT(MONTH FROM a.appointment_date::timestamp) = $1 
            AND EXTRACT(YEAR FROM a.appointment_date::timestamp) = $2
          ORDER BY a.appointment_date`
          : `SELECT 
            a.id,
            a.appointment_date,
            a.client_id,
            a.doctor_id,
            COALESCE(c.lastName, '') as client_lastName,
            COALESCE(c.firstName, '') as client_firstName,
            COALESCE(c.middleName, '') as client_middleName,
            COALESCE(c.phone, '') as client_phone,
            COALESCE(d.lastName, '') as doctor_lastName,
            COALESCE(d.firstName, '') as doctor_firstName,
            COALESCE(d.middleName, '') as doctor_middleName,
            a.status,
            a.diagnosis,
            a.total_price,
            a.discount_amount,
            a.paid
          FROM appointments a
          LEFT JOIN clients c ON a.client_id = c.id
          LEFT JOIN doctors d ON a.doctor_id = d.id
          WHERE strftime('%m', a.appointment_date) = ? 
            AND strftime('%Y', a.appointment_date) = ?
          ORDER BY a.appointment_date`;
      params.push(month, year);
    } else {
      // За все время
      query = usePostgres
        ? `SELECT 
            a.id,
            a.appointment_date,
            a.client_id,
            a.doctor_id,
            COALESCE(c."lastName", '') as client_lastName,
            COALESCE(c."firstName", '') as client_firstName,
            COALESCE(c."middleName", '') as client_middleName,
            COALESCE(c.phone, '') as client_phone,
            COALESCE(d."lastName", '') as doctor_lastName,
            COALESCE(d."firstName", '') as doctor_firstName,
            COALESCE(d."middleName", '') as doctor_middleName,
            a.status,
            a.diagnosis,
            a.total_price,
            a.discount_amount,
            a.paid
          FROM appointments a
          LEFT JOIN clients c ON a.client_id = c.id
          LEFT JOIN doctors d ON a.doctor_id = d.id
          ORDER BY a.appointment_date`
          : `SELECT 
            a.id,
            a.appointment_date,
            a.client_id,
            a.doctor_id,
            COALESCE(c.lastName, '') as client_lastName,
            COALESCE(c.firstName, '') as client_firstName,
            COALESCE(c.middleName, '') as client_middleName,
            COALESCE(c.phone, '') as client_phone,
            COALESCE(d.lastName, '') as doctor_lastName,
            COALESCE(d.firstName, '') as doctor_firstName,
            COALESCE(d.middleName, '') as doctor_middleName,
            a.status,
            a.diagnosis,
            a.total_price,
            a.discount_amount,
            a.paid
          FROM appointments a
          LEFT JOIN clients c ON a.client_id = c.id
          LEFT JOIN doctors d ON a.doctor_id = d.id
          ORDER BY a.appointment_date`;
    }
    
    const appointments = await db.all(query, params);
    
    console.log(`📊 Найдено записей для экспорта: ${appointments.length}`);
    
    // Отладочное логирование первых записей
    if (appointments.length > 0) {
      const firstApt = appointments[0];
      console.log('🔍 Первая запись из базы:');
      console.log('   ID:', firstApt.id);
      console.log('   client_id:', firstApt.client_id);
      console.log('   doctor_id:', firstApt.doctor_id);
      console.log('   Все ключи:', Object.keys(firstApt));
      console.log('   Поля клиента:', {
        client_lastName: firstApt.client_lastName,
        client_firstName: firstApt.client_firstName,
        client_middleName: firstApt.client_middleName,
        client_phone: firstApt.client_phone
      });
      console.log('   Поля врача:', {
        doctor_lastName: firstApt.doctor_lastName,
        doctor_firstName: firstApt.doctor_firstName,
        doctor_middleName: firstApt.doctor_middleName
      });
      
      // Проверяем, есть ли данные в связанных таблицах
      if (firstApt.client_id) {
        const clientCheck = await db.get('SELECT "lastName", "firstName", "middleName" FROM clients WHERE id = $1', [firstApt.client_id]);
        console.log('   Проверка клиента в БД:', clientCheck);
      }
      if (firstApt.doctor_id) {
        const doctorCheck = await db.get('SELECT "lastName", "firstName", "middleName" FROM doctors WHERE id = $1', [firstApt.doctor_id]);
        console.log('   Проверка врача в БД:', doctorCheck);
      }
    }
    
    // Для каждой записи получаем услуги
    const excelData = [];
    
    for (const apt of appointments) {
      // Получаем услуги для этой записи
      const services = await db.all(
        usePostgres
          ? `SELECT s.name, s.category, as2.quantity
             FROM appointment_services as2
             JOIN services s ON as2.service_id = s.id
             WHERE as2.appointment_id = $1`
          : `SELECT s.name, s.category, as2.quantity
             FROM appointment_services as2
             JOIN services s ON as2.service_id = s.id
             WHERE as2.appointment_id = ?`,
        [apt.id]
      );
      
      // Формируем строку с услугами
      const servicesList = services.map(s => {
        const qty = s.quantity > 1 ? ` (x${s.quantity})` : '';
        return s.name + qty;
      }).join('; ') || '-';
      
      // Парсим дату и время
      let appointmentDate = '';
      let appointmentTime = '';
      if (apt.appointment_date) {
        const dateStr = apt.appointment_date.toString();
        const datePart = dateStr.split(' ')[0] || dateStr.split('T')[0];
        const timePart = dateStr.includes(' ') ? dateStr.split(' ')[1] : (dateStr.includes('T') ? dateStr.split('T')[1] : '');
        appointmentDate = datePart;
        appointmentTime = timePart ? timePart.substring(0, 5) : '';
      }
      
      // Формируем ФИО клиента - проверяем разные варианты имен полей (PostgreSQL может возвращать в разном регистре)
      const clientParts = [];
      // Проверяем все возможные варианты имен полей
      const clientLastName = apt.client_lastName || apt.client_lastname || apt['client_lastName'] || apt['client_lastname'] || '';
      const clientFirstName = apt.client_firstName || apt.client_firstname || apt['client_firstName'] || apt['client_firstname'] || '';
      const clientMiddleName = apt.client_middleName || apt.client_middlename || apt['client_middleName'] || apt['client_middlename'] || '';
      
      // Убираем пустые строки и пробелы
      if (clientLastName && String(clientLastName).trim() && String(clientLastName).trim() !== '') {
        clientParts.push(String(clientLastName).trim());
      }
      if (clientFirstName && String(clientFirstName).trim() && String(clientFirstName).trim() !== '') {
        clientParts.push(String(clientFirstName).trim());
      }
      if (clientMiddleName && String(clientMiddleName).trim() && String(clientMiddleName).trim() !== '') {
        clientParts.push(String(clientMiddleName).trim());
      }
      const clientName = clientParts.length > 0 ? clientParts.join(' ') : '-';
      
      // Формируем ФИО врача - проверяем разные варианты имен полей
      const doctorParts = [];
      const doctorLastName = apt.doctor_lastName || apt.doctor_lastname || apt['doctor_lastName'] || apt['doctor_lastname'] || '';
      const doctorFirstName = apt.doctor_firstName || apt.doctor_firstname || apt['doctor_firstName'] || apt['doctor_firstname'] || '';
      const doctorMiddleName = apt.doctor_middleName || apt.doctor_middlename || apt['doctor_middleName'] || apt['doctor_middlename'] || '';
      
      if (doctorLastName && String(doctorLastName).trim() && String(doctorLastName).trim() !== '') {
        doctorParts.push(String(doctorLastName).trim());
      }
      if (doctorFirstName && String(doctorFirstName).trim() && String(doctorFirstName).trim() !== '') {
        doctorParts.push(String(doctorFirstName).trim());
      }
      if (doctorMiddleName && String(doctorMiddleName).trim() && String(doctorMiddleName).trim() !== '') {
        doctorParts.push(String(doctorMiddleName).trim());
      }
      const doctorName = doctorParts.length > 0 ? doctorParts.join(' ') : '-';
      
      // Отладочное логирование для первых нескольких записей
      if (excelData.length < 3) {
        console.log(`🔍 Запись #${apt.id}:`, {
          client_id: apt.client_id,
          doctor_id: apt.doctor_id,
          client_lastName_raw: apt.client_lastName,
          client_firstName_raw: apt.client_firstName,
          client_middleName_raw: apt.client_middleName,
          doctor_lastName_raw: apt.doctor_lastName,
          doctor_firstName_raw: apt.doctor_firstName,
          doctor_middleName_raw: apt.doctor_middleName,
          clientName_result: clientName,
          doctorName_result: doctorName,
          allKeys: Object.keys(apt).filter(k => k.includes('client') || k.includes('doctor'))
        });
      }
      
      const row = {
        '№': apt.id,
        'Дата': appointmentDate,
        'Время': appointmentTime,
        'Клиент': clientName,
        'Телефон': apt.client_phone || apt['client_phone'] || '-',
        'Врач': doctorName,
        'Услуги': servicesList,
        'Диагноз': apt.diagnosis || '-',
        'Статус': apt.status || '-',
        'Стоимость': apt.total_price ? parseFloat(apt.total_price).toFixed(2) : '0.00',
        'Скидка': apt.discount_amount ? parseFloat(apt.discount_amount).toFixed(2) : '0.00',
        'Оплачено': apt.paid ? 'Да' : 'Нет'
      };
      
      // Логируем для отладки
      if (clientName === '-' && apt.id) {
        console.log(`⚠️ Запись #${apt.id}: клиент не найден (client_id: ${apt.client_id || 'null'}, поля: ${JSON.stringify({client_lastName, client_firstName, client_middleName})})`);
      }
      if (doctorName === '-' && apt.id) {
        console.log(`⚠️ Запись #${apt.id}: врач не найден (doctor_id: ${apt.doctor_id || 'null'}, поля: ${JSON.stringify({doctor_lastName, doctor_firstName, doctor_middleName})})`);
      }
      
      excelData.push(row);
    }
    
    // Добавляем итоговую строку
    const totalAmount = appointments.reduce((sum, apt) => sum + (parseFloat(apt.total_price) || 0), 0);
    const totalDiscount = appointments.reduce((sum, apt) => sum + (parseFloat(apt.discount_amount) || 0), 0);
    const totalRow = {
      '№': '',
      'Дата': '',
      'Время': '',
      'Клиент': '',
      'Телефон': '',
      'Врач': '',
      'Услуги': '',
      'Диагноз': '',
      'Статус': '',
      'Стоимость': totalAmount.toFixed(2),
      'Скидка': totalDiscount.toFixed(2),
      'Оплачено': `Всего записей: ${appointments.length}`
    };
    excelData.push(totalRow);
    
    // Создаем книгу Excel
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Записи');
    
    // Генерируем буфер
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    // Определяем имя файла
    let fileName = 'отчет_записи';
    if (date) {
      fileName += `_${date}`;
    } else if (startDate && endDate) {
      fileName += `_${startDate}_${endDate}`;
    } else if (month && year) {
      fileName += `_${year}-${String(month).padStart(2, '0')}`;
    } else {
      fileName += '_все_время';
    }
    fileName += '.xlsx';
    
    // Отправляем файл
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.send(excelBuffer);
  } catch (error) {
    console.error('Ошибка выгрузки записей:', error);
    res.status(500).json({ error: error.message });
  }
});

// Выгрузка всех клиентов в Excel
app.get('/api/statistics/clients/export', async (req, res) => {
  try {
    const XLSX = require('xlsx');
    
    // Получаем всех клиентов
    const clients = await db.all(`
      SELECT 
        id,
        "lastName",
        "firstName",
        "middleName",
        phone,
        address,
        email,
        notes,
        date_of_birth,
        passport_number,
        created_at
      FROM clients
      ORDER BY "lastName", "firstName", "middleName"
    `);
    
    // Формируем данные для Excel
    const excelData = clients.map((client, idx) => ({
      '№': idx + 1,
      'ID': client.id,
      'Фамилия': client.lastName || '-',
      'Имя': client.firstName || '-',
      'Отчество': client.middleName || '-',
      'Телефон': client.phone || '-',
      'Адрес': client.address || '-',
      'Email': client.email || '-',
      'Дата рождения': client.date_of_birth ? new Date(client.date_of_birth).toLocaleDateString('ru-RU') : '-',
      'Номер паспорта': client.passport_number || '-',
      'Примечания': client.notes || '-',
      'Дата регистрации': client.created_at ? new Date(client.created_at).toLocaleDateString('ru-RU') : '-'
    }));
    
    // Добавляем итоговую строку
    const totalRow = {
      '№': '',
      'ID': '',
      'Фамилия': '',
      'Имя': '',
      'Отчество': '',
      'Телефон': '',
      'Адрес': '',
      'Email': '',
      'Дата рождения': '',
      'Номер паспорта': '',
      'Примечания': `Всего клиентов: ${clients.length}`,
      'Дата регистрации': ''
    };
    excelData.push(totalRow);
    
    // Создаем книгу Excel
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Клиенты');
    
    // Генерируем буфер
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    // Определяем имя файла
    const fileName = `база_клиентов_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    // Отправляем файл
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.send(excelBuffer);
  } catch (error) {
    console.error('Ошибка выгрузки клиентов:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== USERS / AUTH ==========

// Middleware для проверки прав доступа (только для superadmin)
const requireSuperAdmin = async (req, res, next) => {
  try {
    // В реальном приложении здесь должна быть проверка токена/сессии
    // Для простоты проверяем через заголовок или body
    const { currentUser } = req.body;
    
    if (!currentUser || currentUser.role !== 'superadmin') {
      return res.status(403).json({ error: 'Доступ запрещен. Требуется роль главного администратора.' });
    }
    
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Логин
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const user = await db.get(
      usePostgres
        ? 'SELECT * FROM users WHERE username = $1'
        : 'SELECT * FROM users WHERE username = ?',
      [username]
    );
    
    if (!user) {
      return res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
    }
    
    // Проверяем пароль (поддерживаем как хешированные, так и старые открытые пароли для миграции)
    let passwordValid = false;
    if (user.password.startsWith('$2')) {
      // Пароль хеширован с bcrypt
      passwordValid = await bcrypt.compare(password, user.password);
    } else {
      // Старый формат (открытый пароль) - для обратной совместимости
      passwordValid = user.password === password;
    }
    
    if (!passwordValid) {
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
    console.error('Ошибка входа:', error);
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

// Создать первого главного администратора (только если в системе нет пользователей)
app.post('/api/setup/first-admin', async (req, res) => {
  try {
    const { username, password, full_name } = req.body;
    
    // Проверяем, есть ли уже пользователи в системе
    const existingUsers = await db.all('SELECT COUNT(*) as count FROM users');
    const userCount = existingUsers[0]?.count || 0;
    
    if (userCount > 0) {
      return res.status(403).json({ 
        error: 'В системе уже есть пользователи. Используйте обычный endpoint /api/users для создания новых пользователей (требуется авторизация главного администратора).' 
      });
    }
    
    // Валидация
    if (!username || !password) {
      return res.status(400).json({ error: 'Имя пользователя и пароль обязательны' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
    }
    
    // Проверяем, не существует ли уже пользователь с таким именем
    const existingUser = await db.get(
      usePostgres
        ? 'SELECT id FROM users WHERE username = $1'
        : 'SELECT id FROM users WHERE username = ?',
      [username]
    );
    
    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с таким именем уже существует' });
    }
    
    // Хешируем пароль
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Создаем главного администратора
    if (usePostgres) {
      const result = await db.query(
        'INSERT INTO users (username, password, role, full_name) VALUES ($1, $2, $3, $4) RETURNING id, username, role, full_name',
        [username, hashedPassword, 'superadmin', full_name || 'Главный администратор']
      );
      console.log(`✅ Первый главный администратор "${username}" создан через API`);
      res.json({ 
        message: 'Главный администратор успешно создан',
        user: result[0]
      });
    } else {
      const result = await db.run(
        'INSERT INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)',
        [username, hashedPassword, 'superadmin', full_name || 'Главный администратор']
      );
      console.log(`✅ Первый главный администратор "${username}" создан через API`);
      res.json({ 
        message: 'Главный администратор успешно создан',
        user: { id: result.lastID, username, role: 'superadmin', full_name: full_name || 'Главный администратор' }
      });
    }
  } catch (error) {
    console.error('Ошибка создания первого администратора:', error);
    res.status(500).json({ error: error.message });
  }
});

// Сменить пароль пользователя
// ТОЛЬКО главный администратор может менять пароли (свой и других пользователей)
app.post('/api/users/change-password', async (req, res) => {
  try {
    const { userId, currentPassword, newPassword, currentUser } = req.body;
    
    // Валидация
    if (!userId || !newPassword) {
      return res.status(400).json({ error: 'ID пользователя и новый пароль обязательны' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
    }
    
    // Проверяем права доступа - ТОЛЬКО главный администратор может менять пароли
    if (!currentUser) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }
    
    if (currentUser.role !== 'superadmin') {
      return res.status(403).json({ error: 'Только главный администратор может менять пароли' });
    }
    
    // Получаем пользователя
    const user = await db.get(
      usePostgres
        ? 'SELECT * FROM users WHERE id = $1'
        : 'SELECT * FROM users WHERE id = ?',
      [userId]
    );
    
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    // Если главный админ меняет свой пароль, проверяем текущий пароль
    // Если меняет чужой пароль, текущий пароль не требуется
    if (currentUser.id === parseInt(userId)) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Текущий пароль обязателен для смены своего пароля' });
      }
      
      // Проверяем текущий пароль
      let passwordValid = false;
      if (user.password.startsWith('$2')) {
        passwordValid = await bcrypt.compare(currentPassword, user.password);
      } else {
        passwordValid = user.password === currentPassword;
      }
      
      if (!passwordValid) {
        return res.status(401).json({ error: 'Неверный текущий пароль' });
      }
    }
    
    // Хешируем новый пароль
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Обновляем пароль
    await db.run(
      usePostgres
        ? 'UPDATE users SET password = $1 WHERE id = $2'
        : 'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, userId]
    );
    
    console.log(`✅ Пароль пользователя #${userId} изменен`);
    
    res.json({ message: 'Пароль успешно изменен' });
  } catch (error) {
    console.error('Ошибка смены пароля:', error);
    res.status(500).json({ error: error.message });
  }
});

// Получить список пользователей (только для главного админа)
app.get('/api/users', async (req, res) => {
  try {
    const { role, doctor_id } = req.query;
    
    let query = '';
    let params = [];
    
    if (doctor_id) {
      // Получаем пользователя по doctor_id
      query = usePostgres
        ? 'SELECT id, username, role, full_name, doctor_id, created_at FROM users WHERE doctor_id = $1'
        : 'SELECT id, username, role, full_name, doctor_id, created_at FROM users WHERE doctor_id = ?';
      params.push(doctor_id);
    } else if (role) {
      query = usePostgres
        ? 'SELECT id, username, role, full_name, doctor_id, created_at FROM users WHERE role = $1 ORDER BY username'
        : 'SELECT id, username, role, full_name, doctor_id, created_at FROM users WHERE role = ? ORDER BY username';
      params.push(role);
    } else {
      query = 'SELECT id, username, role, full_name, doctor_id, created_at FROM users ORDER BY role, username';
    }
    
    const users = await db.all(query, params);
    
    // Не возвращаем пароли
    const safeUsers = users.map(u => ({
      id: u.id,
      username: u.username,
      role: u.role,
      full_name: u.full_name,
      doctor_id: u.doctor_id,
      created_at: u.created_at
    }));
    
    // Если запрашивали по doctor_id, возвращаем одного пользователя или null
    if (doctor_id) {
      res.json(safeUsers[0] || null);
    } else {
      res.json(safeUsers);
    }
  } catch (error) {
    console.error('Ошибка получения пользователей:', error);
    res.status(500).json({ error: error.message });
  }
});

// Удалить пользователя (только для главного админа)
app.delete('/api/users/:id', async (req, res) => {
  try {
    const { currentUser } = req.body;
    
    // Проверка прав доступа
    if (!currentUser || currentUser.role !== 'superadmin') {
      return res.status(403).json({ error: 'Доступ запрещен. Только главный администратор может удалять пользователей.' });
    }
    
    const userId = req.params.id;
    
    // Нельзя удалить самого себя
    if (currentUser.id === parseInt(userId)) {
      return res.status(400).json({ error: 'Нельзя удалить свой собственный аккаунт' });
    }
    
    // Проверяем, существует ли пользователь
    const user = await db.get(
      usePostgres
        ? 'SELECT id, role FROM users WHERE id = $1'
        : 'SELECT id, role FROM users WHERE id = ?',
      [userId]
    );
    
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    // Удаляем пользователя
    const result = await db.run(
      usePostgres
        ? 'DELETE FROM users WHERE id = $1'
        : 'DELETE FROM users WHERE id = ?',
      [userId]
    );
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    console.log(`✅ Пользователь #${userId} удален`);
    
    res.json({ message: 'Пользователь удален' });
  } catch (error) {
    console.error('Ошибка удаления пользователя:', error);
    res.status(500).json({ error: error.message });
  }
});

// Создать пользователя (только для главного админа)
app.post('/api/users', async (req, res) => {
  try {
    const { username, password, role, doctor_id, full_name, currentUser } = req.body;
    
    // Проверка прав доступа
    if (!currentUser || currentUser.role !== 'superadmin') {
      return res.status(403).json({ error: 'Доступ запрещен. Только главный администратор может создавать пользователей.' });
    }
    
    // Валидация
    if (!username || !password) {
      return res.status(400).json({ error: 'Имя пользователя и пароль обязательны' });
    }
    
    if (!['superadmin', 'administrator', 'doctor'].includes(role)) {
      return res.status(400).json({ error: 'Недопустимая роль' });
    }
    
    // Проверяем, не существует ли уже пользователь с таким именем
    const existingUser = await db.get(
      usePostgres
        ? 'SELECT id FROM users WHERE username = $1'
        : 'SELECT id FROM users WHERE username = ?',
      [username]
    );
    
    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с таким именем уже существует' });
    }
    
    // Хешируем пароль
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Создаем пользователя
    if (usePostgres) {
      const result = await db.query(
        'INSERT INTO users (username, password, role, doctor_id, full_name) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, role, doctor_id, full_name',
        [username, hashedPassword, role, doctor_id || null, full_name || null]
      );
      res.json({ 
        message: 'Пользователь создан',
        user: result[0]
      });
    } else {
      const result = await db.run(
        'INSERT INTO users (username, password, role, doctor_id, full_name) VALUES (?, ?, ?, ?, ?)',
        [username, hashedPassword, role, doctor_id || null, full_name || null]
      );
      res.json({ 
        message: 'Пользователь создан',
        user: { id: result.lastID, username, role, doctor_id, full_name }
      });
    }
  } catch (error) {
    console.error('Ошибка создания пользователя:', error);
    res.status(500).json({ error: error.message });
  }
});

// ======================
// РАСПИСАНИЕ ВРАЧЕЙ
// ======================

// Получить расписание всех врачей или конкретного врача
app.get('/api/schedules', async (req, res) => {
  try {
    const { doctor_id } = req.query;
    let query = `
      SELECT 
        ds.id, 
        ds.doctor_id, 
        ds.day_of_week, 
        ds.start_time, 
        ds.end_time, 
        ds.is_active,
        d."firstName" as doctor_first_name,
        d."lastName" as doctor_last_name,
        d.specialization
      FROM doctor_schedules ds
      JOIN doctors d ON ds.doctor_id = d.id
      WHERE ds.is_active = ${usePostgres ? 'true' : '1'}
    `;
    
    const params = [];
    if (doctor_id) {
      query += usePostgres ? ' AND ds.doctor_id = $1' : ' AND ds.doctor_id = ?';
      params.push(doctor_id);
    }
    
    query += ' ORDER BY ds.doctor_id, ds.day_of_week, ds.start_time';
    
    const schedules = await db.all(query, params);
    res.json(schedules);
  } catch (error) {
    console.error('Ошибка получения расписания:', error);
    res.status(500).json({ error: error.message });
  }
});

// Создать слот расписания (только для врачей и админов)
app.post('/api/schedules', async (req, res) => {
  const { doctor_id, day_of_week, start_time, end_time } = req.body;
  
  try {
    if (usePostgres) {
      const result = await db.query(
        'INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time) VALUES ($1, $2, $3, $4) RETURNING id',
        [doctor_id, day_of_week, start_time, end_time]
      );
      res.json({ 
        id: result[0].id, 
        doctor_id, 
        day_of_week, 
        start_time, 
        end_time,
        is_active: true
      });
    } else {
      const result = await db.run(
        'INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?)',
        [doctor_id, day_of_week, start_time, end_time]
      );
      res.json({ 
        id: result.lastID, 
        doctor_id, 
        day_of_week, 
        start_time, 
        end_time,
        is_active: true
      });
    }
  } catch (error) {
    console.error('Ошибка создания расписания:', error);
    res.status(500).json({ error: error.message });
  }
});

// Обновить слот расписания
app.put('/api/schedules/:id', async (req, res) => {
  const { day_of_week, start_time, end_time, is_active } = req.body;
  
  try {
    await db.run(
      usePostgres 
        ? 'UPDATE doctor_schedules SET day_of_week = $1, start_time = $2, end_time = $3, is_active = $4 WHERE id = $5'
        : 'UPDATE doctor_schedules SET day_of_week = ?, start_time = ?, end_time = ?, is_active = ? WHERE id = ?',
      [day_of_week, start_time, end_time, is_active, req.params.id]
    );
    res.json({ message: 'Расписание обновлено', id: req.params.id });
  } catch (error) {
    console.error('Ошибка обновления расписания:', error);
    res.status(500).json({ error: error.message });
  }
});

// Удалить слот расписания
app.delete('/api/schedules/:id', async (req, res) => {
  try {
    await db.run(
      usePostgres ? 'DELETE FROM doctor_schedules WHERE id = $1' : 'DELETE FROM doctor_schedules WHERE id = ?',
      [req.params.id]
    );
    res.json({ message: 'Расписание удалено' });
  } catch (error) {
    console.error('Ошибка удаления расписания:', error);
    res.status(500).json({ error: error.message });
  }
});

// ======================
// ТОЧЕЧНЫЕ ДАТЫ РАБОТЫ ВРАЧЕЙ
// ======================

// Получить точечные даты
app.get('/api/specific-dates', async (req, res) => {
  try {
    const { doctor_id } = req.query;
    let query = `
      SELECT 
        sd.id, 
        sd.doctor_id, 
        sd.work_date, 
        sd.start_time, 
        sd.end_time, 
        sd.is_active,
        d."firstName" as doctor_first_name,
        d."lastName" as doctor_last_name,
        d.specialization
      FROM doctor_specific_dates sd
      JOIN doctors d ON sd.doctor_id = d.id
      WHERE sd.is_active = ${usePostgres ? 'true' : '1'}
    `;
    
    const params = [];
    if (doctor_id) {
      query += usePostgres ? ' AND sd.doctor_id = $1' : ' AND sd.doctor_id = ?';
      params.push(doctor_id);
    }
    
    query += ' ORDER BY sd.work_date, sd.start_time';
    
    const dates = await db.all(query, params);
    res.json(dates);
  } catch (error) {
    console.error('Ошибка получения точечных дат:', error);
    res.status(500).json({ error: error.message });
  }
});

// Создать точечную дату
app.post('/api/specific-dates', async (req, res) => {
  const { doctor_id, work_date, start_time, end_time } = req.body;
  
  try {
    // Убеждаемся, что work_date в формате YYYY-MM-DD (без времени)
    let dateToSave = work_date;
    if (work_date && work_date.includes('T')) {
      dateToSave = work_date.split('T')[0];
    }
    if (dateToSave && dateToSave.length > 10) {
      dateToSave = dateToSave.substring(0, 10);
    }
    
    if (usePostgres) {
      const result = await db.query(
        'INSERT INTO doctor_specific_dates (doctor_id, work_date, start_time, end_time) VALUES ($1, $2, $3, $4) RETURNING id',
        [doctor_id, dateToSave, start_time, end_time]
      );
      res.json({ 
        id: result[0].id, 
        doctor_id, 
        work_date: dateToSave, 
        start_time, 
        end_time,
        is_active: true
      });
    } else {
      const result = await db.run(
        'INSERT INTO doctor_specific_dates (doctor_id, work_date, start_time, end_time) VALUES (?, ?, ?, ?)',
        [doctor_id, dateToSave, start_time, end_time]
      );
      res.json({ 
        id: result.lastID, 
        doctor_id, 
        work_date: dateToSave, 
        start_time, 
        end_time,
        is_active: true
      });
    }
  } catch (error) {
    console.error('Ошибка создания точечной даты:', error);
    res.status(500).json({ error: error.message });
  }
});

// Удалить точечную дату
app.delete('/api/specific-dates/:id', async (req, res) => {
  try {
    await db.run(
      usePostgres ? 'DELETE FROM doctor_specific_dates WHERE id = $1' : 'DELETE FROM doctor_specific_dates WHERE id = ?',
      [req.params.id]
    );
    res.json({ message: 'Точечная дата удалена' });
  } catch (error) {
    console.error('Ошибка удаления точечной даты:', error);
    res.status(500).json({ error: error.message });
  }
});

// Получить записи врача на месяц
app.get('/api/doctors/:id/monthly-appointments', async (req, res) => {
  try {
    const { year, month } = req.query;
    const doctorId = req.params.id;
    
    // Формируем даты начала и конца месяца
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    // Получаем последний день месяца БЕЗ конвертации timezone
    const lastDay = new Date(year, parseInt(month), 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    
    const query = `
      SELECT 
        a.id,
        ${usePostgres 
          ? "TO_CHAR(a.appointment_date::timestamp, 'YYYY-MM-DD HH24:MI:SS')::text" 
          : "strftime('%Y-%m-%d %H:%M:%S', a.appointment_date)"} as appointment_date,
        a.status,
        a.notes,
        a.diagnosis,
        a.client_id,
        COALESCE(a.duration, 30) as duration,
        c."firstName" as client_first_name,
        c."lastName" as client_last_name,
        c.phone as client_phone
      FROM appointments a
      JOIN clients c ON a.client_id = c.id
      WHERE a.doctor_id = ${usePostgres ? '$1' : '?'}
        AND DATE(a.appointment_date${usePostgres ? '::timestamp' : ''}) >= ${usePostgres ? '$2' : '?'}
        AND DATE(a.appointment_date${usePostgres ? '::timestamp' : ''}) <= ${usePostgres ? '$3' : '?'}
      ORDER BY a.appointment_date
    `;
    
    const appointments = await db.all(query, [doctorId, startDate, endDate]);
    
    // Нормализуем даты в строки
    const normalizeDate = (dateVal) => {
      if (dateVal instanceof Date) {
        const y = dateVal.getFullYear();
        const m = String(dateVal.getMonth() + 1).padStart(2, '0');
        const d = String(dateVal.getDate()).padStart(2, '0');
        const h = String(dateVal.getHours()).padStart(2, '0');
        const mi = String(dateVal.getMinutes()).padStart(2, '0');
        const s = String(dateVal.getSeconds()).padStart(2, '0');
        return `${y}-${m}-${d} ${h}:${mi}:${s}`;
      }
      return normalizeAppointmentDate(String(dateVal));
    };

    const appointmentIds = appointments.map(a => a.id);
    
    // Загружаем услуги для ВСЕХ записей одним запросом (вместо N отдельных)
    let servicesMap = {};
    if (appointmentIds.length > 0) {
      const placeholders = usePostgres
        ? appointmentIds.map((_, i) => `$${i + 1}`).join(',')
        : appointmentIds.map(() => '?').join(',');
      
      const allServices = await db.all(
        `SELECT aps.appointment_id, aps.service_id, aps.quantity, s.name, s.price 
         FROM appointment_services aps
         JOIN services s ON aps.service_id = s.id
         WHERE aps.appointment_id IN (${placeholders})`,
        appointmentIds
      );
      
      // Группируем услуги по appointment_id
      for (const svc of allServices) {
        if (!servicesMap[svc.appointment_id]) {
          servicesMap[svc.appointment_id] = [];
        }
        servicesMap[svc.appointment_id].push({
          service_id: svc.service_id,
          quantity: svc.quantity,
          name: svc.name,
          price: svc.price
        });
      }
    }

    // Собираем финальный результат (без дополнительных SQL-запросов)
    const finalAppointments = appointments.map(apt => ({
      ...apt,
      appointment_date: normalizeDate(apt.appointment_date),
      services: servicesMap[apt.id] || []
    }));
    
    res.json(finalAppointments);
  } catch (error) {
    console.error('Ошибка получения записей врача:', error);
    res.status(500).json({ error: error.message });
  }
});

// Получить записи врача на конкретный день
app.get('/api/doctors/:id/daily-appointments', async (req, res) => {
  try {
    const { date } = req.query;
    const doctorId = req.params.id;
    
    const query = `
      SELECT 
        a.id,
        a.appointment_date,
        a.status,
        a.notes,
        a.diagnosis,
        COALESCE(a.duration, 30) as duration,
        c."firstName" as client_first_name,
        c."lastName" as client_last_name,
        c.phone as client_phone
      FROM appointments a
      JOIN clients c ON a.client_id = c.id
      WHERE a.doctor_id = ${usePostgres ? '$1' : '?'}
        AND DATE(a.appointment_date) = ${usePostgres ? '$2' : '?'}
      ORDER BY a.appointment_date
    `;
    
    const appointments = await db.all(query, [doctorId, date]);
    
    // Нормализуем appointment_date для корректного отображения времени
    const normalizedAppointments = appointments.map(appointment => {
      let normalizedAppointmentDate = appointment.appointment_date;
      if (normalizedAppointmentDate) {
        normalizedAppointmentDate = normalizeAppointmentDate(normalizedAppointmentDate.toString());
      }
      return {
        ...appointment,
        appointment_date: normalizedAppointmentDate
      };
    });
    
    res.json(normalizedAppointments);
  } catch (error) {
    console.error('Ошибка получения записей врача на день:', error);
    res.status(500).json({ error: error.message });
  }
});

// ======================
// ФОРМА 037/у — ЛИСТОК УЧЁТА РАБОТЫ ВРАЧА
// ======================

// Получить записи формы 037/у (с фильтрами)
app.get('/api/doctor-work-records', async (req, res) => {
  try {
    const { doctor_id, date_from, date_to, month, year } = req.query;
    
    let query = `
      SELECT dwr.*, 
             d."lastName" as doctor_last_name, 
             d."firstName" as doctor_first_name, 
             d."middleName" as doctor_middle_name,
             d.specialization as doctor_specialization
      FROM doctor_work_records dwr
      LEFT JOIN doctors d ON dwr.doctor_id = d.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    
    if (doctor_id) {
      query += ` AND dwr.doctor_id = $${paramIndex++}`;
      params.push(doctor_id);
    }
    
    if (date_from && date_to) {
      query += ` AND dwr.record_date >= $${paramIndex++} AND dwr.record_date <= $${paramIndex++}`;
      params.push(date_from, date_to);
    } else if (month && year) {
      query += ` AND EXTRACT(MONTH FROM dwr.record_date) = $${paramIndex++} AND EXTRACT(YEAR FROM dwr.record_date) = $${paramIndex++}`;
      params.push(month, year);
    }
    
    query += ' ORDER BY dwr.record_date DESC, dwr.record_time DESC';
    
    const records = await db.all(query, params);
    res.json(records);
  } catch (error) {
    console.error('Ошибка получения записей 037/у:', error);
    res.status(500).json({ error: error.message });
  }
});

// Получить одну запись
app.get('/api/doctor-work-records/:id', async (req, res) => {
  try {
    const record = await db.get(
      `SELECT dwr.*, 
              d."lastName" as doctor_last_name, 
              d."firstName" as doctor_first_name, 
              d."middleName" as doctor_middle_name
       FROM doctor_work_records dwr
       LEFT JOIN doctors d ON dwr.doctor_id = d.id
       WHERE dwr.id = $1`,
      [req.params.id]
    );
    if (!record) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }
    res.json(record);
  } catch (error) {
    console.error('Ошибка получения записи 037/у:', error);
    res.status(500).json({ error: error.message });
  }
});

// Создать запись
app.post('/api/doctor-work-records', async (req, res) => {
  try {
    const {
      doctor_id, record_date, record_time, patient_name,
      patient_address, citizenship_data, patient_age,
      visit_type, preventive_work, diagnosis_code,
      diagnosis_description, treatment_code, treatment_description,
      treatment_stage, population_type,
      appointment_id
    } = req.body;
    
    if (!doctor_id || !record_date || !patient_name) {
      return res.status(400).json({ error: 'Обязательные поля: doctor_id, record_date, patient_name' });
    }
    
    const result = await db.run(`
      INSERT INTO doctor_work_records 
        (doctor_id, record_date, record_time, patient_name, patient_address, 
         citizenship_data, patient_age, visit_type, preventive_work,
         diagnosis_code, diagnosis_description, treatment_code, treatment_description,
         treatment_stage, population_type, appointment_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING id
    `, [
      doctor_id, record_date, record_time || null, patient_name,
      patient_address || null, citizenship_data || null, patient_age || null,
      visit_type || null, preventive_work || null, diagnosis_code || null,
      diagnosis_description || null, treatment_code || null, treatment_description || null,
      treatment_stage || null, population_type || 'city',
      appointment_id || null
    ]);
    
    const newId = result.id || result.lastID;
    res.status(201).json({ id: newId, message: 'Запись создана' });
  } catch (error) {
    console.error('Ошибка создания записи 037/у:', error);
    res.status(500).json({ error: error.message });
  }
});

// Обновить запись
app.put('/api/doctor-work-records/:id', async (req, res) => {
  try {
    const {
      doctor_id, record_date, record_time, patient_name,
      patient_address, citizenship_data, patient_age,
      visit_type, preventive_work, diagnosis_code,
      diagnosis_description, treatment_code, treatment_description,
      treatment_stage, population_type
    } = req.body;
    
    await db.run(`
      UPDATE doctor_work_records SET
        doctor_id = $1, record_date = $2, record_time = $3, patient_name = $4,
        patient_address = $5, citizenship_data = $6, patient_age = $7,
        visit_type = $8, preventive_work = $9, diagnosis_code = $10,
        diagnosis_description = $11, treatment_code = $12, treatment_description = $13,
        treatment_stage = $14, population_type = $15,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $16
    `, [
      doctor_id, record_date, record_time || null, patient_name,
      patient_address || null, citizenship_data || null, patient_age || null,
      visit_type || null, preventive_work || null, diagnosis_code || null,
      diagnosis_description || null, treatment_code || null, treatment_description || null,
      treatment_stage || null, population_type || 'city',
      req.params.id
    ]);
    
    res.json({ message: 'Запись обновлена' });
  } catch (error) {
    console.error('Ошибка обновления записи 037/у:', error);
    res.status(500).json({ error: error.message });
  }
});

// Удалить запись
app.delete('/api/doctor-work-records/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM doctor_work_records WHERE id = $1', [req.params.id]);
    res.json({ message: 'Запись удалена' });
  } catch (error) {
    console.error('Ошибка удаления записи 037/у:', error);
    res.status(500).json({ error: error.message });
  }
});

// ======================
// ФОРМА 039/у — ДНЕВНИК УЧЁТА РАБОТЫ (СВОДНЫЙ ОТЧЁТ)
// ======================

// Генерация сводного отчёта 039/у на основе данных 037/у
app.get('/api/report-039', async (req, res) => {
  try {
    const { doctor_id, month, year } = req.query;
    
    if (!doctor_id || !month || !year) {
      return res.status(400).json({ error: 'Обязательные параметры: doctor_id, month, year' });
    }
    
    // Получаем данные врача
    const doctor = await db.get('SELECT * FROM doctors WHERE id = $1', [doctor_id]);
    if (!doctor) {
      return res.status(404).json({ error: 'Врач не найден' });
    }
    
    // Получаем все записи за месяц
    const records = await db.all(`
      SELECT * FROM doctor_work_records 
      WHERE doctor_id = $1 
        AND EXTRACT(MONTH FROM record_date) = $2 
        AND EXTRACT(YEAR FROM record_date) = $3
      ORDER BY record_date, record_time
    `, [doctor_id, month, year]);
    
    // Количество рабочих дней
    const workDays = await db.all(`
      SELECT DISTINCT record_date FROM doctor_work_records
      WHERE doctor_id = $1 
        AND EXTRACT(MONTH FROM record_date) = $2 
        AND EXTRACT(YEAR FROM record_date) = $3
      ORDER BY record_date
    `, [doctor_id, month, year]);
    
    // Группировка по дням для дневника
    const dailyData = {};
    for (const record of records) {
      const day = new Date(record.record_date).getDate();
      if (!dailyData[day]) {
        dailyData[day] = [];
      }
      dailyData[day].push(record);
    }
    
    // Подсчёт показателей формы 039/у
    const summary = {
      // Общее число посещений
      totalVisits: records.length,
      // Число первичных посещений
      primaryVisits: records.filter(r => r.visit_type === 'primary').length,
      // Число повторных посещений
      repeatVisits: records.filter(r => r.visit_type === 'repeat').length,
      // Профилактические
      preventiveVisits: records.filter(r => r.visit_type === 'preventive').length,
      
      // Диагнозы по группам (на основе кодов из формы 039/у)
      diagnosisCounts: {},
      // Лечебные мероприятия по группам
      treatmentCounts: {},
      
      // Рабочие дни
      workDaysCount: workDays.length,
      workDates: workDays.map(d => d.record_date),
      
      // Дневные данные
      dailyData
    };
    
    // Группировка диагнозов по кодам (поддержка мультивыбора через запятую)
    for (const record of records) {
      if (record.diagnosis_code) {
        const codes = record.diagnosis_code.split(',').map(s => s.trim()).filter(Boolean);
        for (const code of codes) {
          summary.diagnosisCounts[code] = (summary.diagnosisCounts[code] || 0) + 1;
        }
      }
    }
    
    // Группировка лечения по кодам (поддержка мультивыбора через запятую)
    for (const record of records) {
      if (record.treatment_code) {
        const codes = record.treatment_code.split(',').map(s => s.trim()).filter(Boolean);
        for (const code of codes) {
          summary.treatmentCounts[code] = (summary.treatmentCounts[code] || 0) + 1;
        }
      }
    }
    
    res.json({
      doctor,
      month: parseInt(month),
      year: parseInt(year),
      records,
      summary
    });
  } catch (error) {
    console.error('Ошибка генерации отчёта 039/у:', error);
    res.status(500).json({ error: error.message });
  }
});

// ======================
// ДИАГНОСТИКА: проверка таблицы doctor_work_records
// ======================

app.get('/api/debug/doctor-work-records-check', async (req, res) => {
  try {
    // Проверяем, существует ли таблица
    const tableExists = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'doctor_work_records'
      )
    `);

    if (!tableExists[0]?.exists) {
      return res.json({ ok: false, error: 'Таблица doctor_work_records не существует' });
    }

    // Получаем список колонок таблицы
    const columns = await db.all(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'doctor_work_records'
      ORDER BY ordinal_position
    `);
    const columnNames = columns.map(c => c.column_name);

    // Проверяем обязательные колонки
    const requiredColumns = [
      'doctor_id', 'record_date', 'record_time', 'patient_name', 'patient_address',
      'citizenship_data', 'patient_age', 'visit_type', 'preventive_work',
      'diagnosis_code', 'diagnosis_description', 'treatment_code', 'treatment_description',
      'treatment_stage', 'population_type', 'appointment_id'
    ];
    const missingColumns = requiredColumns.filter(c => !columnNames.includes(c));

    // Считаем общее количество записей
    const countResult = await db.get('SELECT COUNT(*) as total FROM doctor_work_records');
    
    // Последние 5 записей (для диагностики)
    const recentRecords = await db.all(`
      SELECT id, doctor_id, record_date, diagnosis_code, treatment_code, visit_type, appointment_id, created_at
      FROM doctor_work_records ORDER BY id DESC LIMIT 5
    `);

    res.json({
      ok: missingColumns.length === 0,
      tableExists: true,
      columns: columnNames,
      missingColumns,
      totalRecords: countResult?.total || 0,
      recentRecords
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message, stack: error.stack });
  }
});

// ======================
// РЕМОНТ: пересоздание doctor_work_records для завершённых приёмов, у которых записи формы потерялись
// ======================

app.post('/api/debug/repair-work-records', async (req, res) => {
  try {
    // Находим все завершённые приёмы (status IN ('ready_for_payment','completed','paid'))
    // у которых form_deferred = false (форма должна была быть создана)
    // и для которых НЕТ записи в doctor_work_records
    const orphanedAppointments = await db.all(`
      SELECT a.id, a.doctor_id, a.appointment_date, a.diagnosis, a.visit_type,
             a.diagnosis_code, a.treatment_code, a.treatment_description,
             a.preventive_work, a.treatment_stage, a.form_deferred,
             c."lastName", c."firstName", c."middleName", c.address, 
             c.citizenship_data, c.date_of_birth, c.population_type
      FROM appointments a
      LEFT JOIN clients c ON a.client_id = c.id
      LEFT JOIN doctor_work_records dwr ON dwr.appointment_id = a.id
      WHERE a.status IN ('ready_for_payment', 'completed', 'paid')
        AND a.doctor_id IS NOT NULL
        AND (a.form_deferred IS NULL OR a.form_deferred = false)
        AND dwr.id IS NULL
      ORDER BY a.id DESC
    `);

    if (orphanedAppointments.length === 0) {
      return res.json({ repaired: 0, message: 'Все завершённые приёмы имеют записи в doctor_work_records' });
    }

    let repaired = 0;
    const errors = [];

    for (const appt of orphanedAppointments) {
      try {
        const patientName = [appt.lastName, appt.firstName, appt.middleName].filter(Boolean).join(' ');
        
        let patientAge = null;
        if (appt.date_of_birth) {
          const dob = new Date(appt.date_of_birth);
          const today = new Date();
          patientAge = today.getFullYear() - dob.getFullYear();
          const m = today.getMonth() - dob.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
            patientAge--;
          }
        }

        let rawDate = appt.appointment_date;
        if (rawDate instanceof Date) rawDate = rawDate.toISOString();
        const appointmentDate = (rawDate && typeof rawDate === 'string') ? rawDate : new Date().toISOString().split('T')[0];
        let recordDate = appointmentDate;
        let recordTime = null;
        if (typeof appointmentDate === 'string' && appointmentDate.includes(' ')) {
          const parts = appointmentDate.split(' ');
          recordDate = parts[0];
          recordTime = parts[1] || null;
        } else if (typeof appointmentDate === 'string' && appointmentDate.includes('T')) {
          const parts = appointmentDate.split('T');
          recordDate = parts[0];
          recordTime = parts[1] ? parts[1].substring(0, 5) : null;
        }

        await db.run(`
          INSERT INTO doctor_work_records 
          (doctor_id, record_date, record_time, patient_name, patient_address, citizenship_data, patient_age, visit_type, preventive_work, diagnosis_code, diagnosis_description, treatment_code, treatment_description, treatment_stage, population_type, appointment_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        `, [
          appt.doctor_id,
          recordDate,
          recordTime,
          patientName || 'Неизвестный пациент',
          appt.address || null,
          appt.citizenship_data || null,
          patientAge,
          appt.visit_type || null,
          appt.preventive_work || null,
          appt.diagnosis_code || null,
          appt.diagnosis || null,
          appt.treatment_code || null,
          appt.treatment_description || null,
          appt.treatment_stage || null,
          appt.population_type || 'city',
          appt.id
        ]);
        repaired++;
        console.log(`🔧 Восстановлена запись формы 037/у для приёма #${appt.id}`);
      } catch (insertError) {
        errors.push({ appointmentId: appt.id, error: insertError.message });
        console.error(`⚠️  Ошибка восстановления записи для приёма #${appt.id}:`, insertError.message);
      }
    }

    res.json({
      found: orphanedAppointments.length,
      repaired,
      errors: errors.length > 0 ? errors : undefined,
      message: `Восстановлено ${repaired} из ${orphanedAppointments.length} записей`
    });
  } catch (error) {
    console.error('Ошибка ремонта doctor_work_records:', error);
    res.status(500).json({ error: error.message });
  }
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

// Запуск сервера (через http server для Socket.IO)
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`🌍 Режим: ${NODE_ENV}`);
  console.log(`💾 База данных: ${usePostgres ? 'PostgreSQL' : 'SQLite'}`);
  console.log(`🔌 Socket.IO: real-time синхронизация включена`);
});

