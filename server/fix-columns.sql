-- Удаляем старые таблицы
DROP TABLE IF EXISTS appointment_materials CASCADE;
DROP TABLE IF EXISTS appointment_services CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS doctors CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS materials CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Создаем таблицы с правильными именами столбцов
CREATE TABLE clients (
  id SERIAL PRIMARY KEY,
  "lastName" TEXT,
  "firstName" TEXT,
  "middleName" TEXT,
  phone TEXT,
  address TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE services (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  description TEXT,
  category TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE doctors (
  id SERIAL PRIMARY KEY,
  "lastName" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "middleName" TEXT,
  specialization TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE appointments (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL,
  appointment_date TIMESTAMP NOT NULL,
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
);

CREATE TABLE appointment_services (
  id SERIAL PRIMARY KEY,
  appointment_id INTEGER NOT NULL,
  service_id INTEGER NOT NULL,
  quantity INTEGER DEFAULT 1,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id),
  FOREIGN KEY (service_id) REFERENCES services(id)
);

CREATE TABLE materials (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT,
  price REAL NOT NULL,
  stock REAL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE appointment_materials (
  id SERIAL PRIMARY KEY,
  appointment_id INTEGER NOT NULL,
  material_id INTEGER NOT NULL,
  quantity REAL DEFAULT 1,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id),
  FOREIGN KEY (material_id) REFERENCES materials(id)
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL,
  doctor_id INTEGER,
  full_name TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id)
);



