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

// Нормализация формата даты: YYYY-MM-DD HH:MM:SS (без T и timezone)
function normalizeAppointmentDate(dateString) {
  if (!dateString) return dateString;
  
  let normalized = dateString;
  // Убираем 'T' и заменяем на пробел
  normalized = normalized.replace('T', ' ');
  // Убираем timezone (Z или +HH:MM)
  if (normalized.includes('Z')) {
    normalized = normalized.replace('Z', '');
  }
  if (normalized.includes('+')) {
    normalized = normalized.split('+')[0];
  }
  // Убеждаемся, что есть секунды
  if (normalized.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)) {
    normalized = normalized + ':00';
  }
  // Обрезаем до формата YYYY-MM-DD HH:MM:SS
  if (normalized.length > 19) {
    normalized = normalized.substring(0, 19);
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

// Создать запись
app.post('/api/appointments', async (req, res) => {
  const { client_id, appointment_date, doctor_id, services, notes } = req.body;
  
  try {
    // Нормализуем формат даты: YYYY-MM-DD HH:MM:SS (без T и timezone)
    const dateToSave = normalizeAppointmentDate(appointment_date);
    
    // Проверяем, нет ли уже записи на это время для этого врача
    const existingAppointment = await db.get(
      usePostgres
        ? `SELECT id, appointment_date FROM appointments 
           WHERE doctor_id = $1 
           AND appointment_date::timestamp(0) = $2::timestamp(0)
           AND status != $3`
        : 'SELECT id FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND status != ?',
      [doctor_id, dateToSave, 'cancelled']
    );
    
    if (existingAppointment) {
      return res.status(400).json({ 
        error: 'На это время уже есть запись. Пожалуйста, выберите другое время.' 
      });
    }
    
    // Создаем запись
    let appointmentId;
    
    if (usePostgres) {
      const result = await db.query(
        'INSERT INTO appointments (client_id, appointment_date, doctor_id, notes, status) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [client_id, dateToSave, doctor_id, notes, 'scheduled']
      );
      appointmentId = result[0].id;
    } else {
      const result = await db.run(
        'INSERT INTO appointments (client_id, appointment_date, doctor_id, notes, status) VALUES (?, ?, ?, ?, ?)',
        [client_id, dateToSave, doctor_id, notes, 'scheduled']
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
      appointment_date: dateToSave,
      doctor_id,
      services,
      notes
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Обновить запись (редактирование)
app.put('/api/appointments/:id', async (req, res) => {
  const { appointment_date, doctor_id, services, notes } = req.body;
  
  try {
    console.log('Обновление записи ID:', req.params.id);
    console.log('Данные:', { appointment_date, doctor_id, services, notes });
    
    // Нормализуем формат даты: YYYY-MM-DD HH:MM:SS (без T и timezone)
    const dateToSave = normalizeAppointmentDate(appointment_date);
    
    // Обновляем основную информацию о записи
    await db.run(
      usePostgres
        ? 'UPDATE appointments SET appointment_date = $1, doctor_id = $2, notes = $3 WHERE id = $4'
        : 'UPDATE appointments SET appointment_date = ?, doctor_id = ?, notes = ? WHERE id = ?',
      [dateToSave, doctor_id, notes || '', req.params.id]
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
    res.json({
      message: 'Запись обновлена',
      id: req.params.id,
      appointment_date: dateToSave,
      doctor_id,
      services,
      notes
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
    
    // Получаем информацию о записи для автоматического списания
    const appointment = await db.get(
      usePostgres ? 'SELECT doctor_id FROM appointments WHERE id = $1' : 'SELECT doctor_id FROM appointments WHERE id = ?',
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
              appointment?.doctor_id || null
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
    
    // Формируем данные для Excel
    const excelData = data.map((item, idx) => {
      const row = {
        '№': idx + 1,
        'Дата': new Date(item.date).toLocaleDateString('ru-RU'),
        'Материал': item.material_name,
        'Единица измерения': item.unit || '-',
        'Количество': item.quantity,
        'Цена за единицу': item.price ? item.price.toFixed(2) : '-',
        'Сумма': item.total ? item.total.toFixed(2) : '-',
        'Примечание': item.notes || '-'
      };
      
      // Добавляем колонку "Врач" для списаний (writeoffs)
      if (type === 'writeoffs' || type === 'usage') {
        if (item.doctor_lastName) {
          row['Врач'] = `${item.doctor_lastName} ${item.doctor_firstName || ''} ${item.doctor_middleName || ''}`.trim();
        } else {
          row['Врач'] = item.appointment_id ? 'Автоматическое списание' : 'Ручное списание';
        }
      }
      
      return row;
    });
    
    // Добавляем итоговую строку
    const total = data.reduce((sum, item) => sum + (item.total || 0), 0);
    const totalRow = {
      '№': '',
      'Дата': '',
      'Материал': '',
      'Единица измерения': '',
      'Количество': '',
      'Цена за единицу': 'ИТОГО:',
      'Сумма': total.toFixed(2),
      'Примечание': ''
    };
    if (type === 'writeoffs' || type === 'usage') {
      totalRow['Врач'] = '';
    }
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
        a.appointment_date,
        a.status,
        a.notes,
        a.diagnosis,
        a.client_id,
        c."firstName" as client_first_name,
        c."lastName" as client_last_name,
        c.phone as client_phone
      FROM appointments a
      JOIN clients c ON a.client_id = c.id
      WHERE a.doctor_id = ${usePostgres ? '$1' : '?'}
        AND DATE(a.appointment_date) >= ${usePostgres ? '$2' : '?'}
        AND DATE(a.appointment_date) <= ${usePostgres ? '$3' : '?'}
      ORDER BY a.appointment_date
    `;
    
    const appointments = await db.all(query, [doctorId, startDate, endDate]);
    
    // Получаем услуги для каждой записи
    const appointmentsWithServices = await Promise.all(appointments.map(async (appointment) => {
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
      
      return {
        ...appointment,
        services: services
      };
    }));
    
    res.json(appointmentsWithServices);
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
    res.json(appointments);
  } catch (error) {
    console.error('Ошибка получения записей врача на день:', error);
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

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`🌍 Режим: ${NODE_ENV}`);
  console.log(`💾 База данных: ${usePostgres ? 'PostgreSQL' : 'SQLite'}`);
});

