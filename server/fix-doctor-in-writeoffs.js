const { db, usePostgres } = require('./database');

async function fixDoctorInWriteoffs() {
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
    
    console.log(`✅ Обновлено ${result.changes || result.rowCount || 0} записей`);
    
    // Проверяем результат
    const checkQuery = usePostgres
      ? `SELECT 
           mt.id,
           mt.appointment_id,
           mt.created_by,
           a.doctor_id as appointment_doctor_id,
           COALESCE(d2."lastName", d."lastName") || ' ' || COALESCE(d2."firstName", d."firstName") as doctor_name
         FROM material_transactions mt
         LEFT JOIN appointments a ON mt.appointment_id = a.id
         LEFT JOIN doctors d2 ON a.doctor_id = d2.id
         LEFT JOIN doctors d ON mt.created_by = d.id
         WHERE mt.transaction_type = 'writeoff'
           AND mt.appointment_id IS NOT NULL
         LIMIT 10`
      : `SELECT 
           mt.id,
           mt.appointment_id,
           mt.created_by,
           a.doctor_id as appointment_doctor_id,
           COALESCE(d2.lastName, d.lastName) || ' ' || COALESCE(d2.firstName, d.firstName) as doctor_name
         FROM material_transactions mt
         LEFT JOIN appointments a ON mt.appointment_id = a.id
         LEFT JOIN doctors d2 ON a.doctor_id = d2.id
         LEFT JOIN doctors d ON mt.created_by = d.id
         WHERE mt.transaction_type = 'writeoff'
           AND mt.appointment_id IS NOT NULL
         LIMIT 10`;
    
    const samples = await db.all(checkQuery);
    console.log('\n📊 Примеры обновленных записей:');
    samples.forEach(sample => {
      console.log(`   ID: ${sample.id}, Appointment: ${sample.appointment_id}, Doctor: ${sample.doctor_name || 'не указан'}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  }
}

fixDoctorInWriteoffs();

