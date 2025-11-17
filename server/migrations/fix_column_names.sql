-- Миграция: исправление названий колонок для совместимости с кодом
-- Выполнить ОДИН РАЗ на production (Railway)

-- Таблица clients
ALTER TABLE clients RENAME COLUMN lastname TO "lastName";
ALTER TABLE clients RENAME COLUMN firstname TO "firstName";
ALTER TABLE clients RENAME COLUMN middlename TO "middleName";

-- Таблица doctors
ALTER TABLE doctors RENAME COLUMN lastname TO "lastName";
ALTER TABLE doctors RENAME COLUMN firstname TO "firstName";
ALTER TABLE doctors RENAME COLUMN middlename TO "middleName";

-- Проверка
SELECT column_name FROM information_schema.columns WHERE table_name = 'clients';
SELECT column_name FROM information_schema.columns WHERE table_name = 'doctors';

