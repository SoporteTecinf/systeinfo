CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(180) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'customer',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  slug VARCHAR(120) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  category_id INTEGER REFERENCES categories(id),
  name VARCHAR(180) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(12,2) NOT NULL CHECK(price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
  image_url TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  shipping_address JSONB NOT NULL,
  payment_status VARCHAR(30) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL
);

INSERT INTO categories(name,slug) VALUES
('Electrónica','electronica'),('Automotriz','automotriz'),
('Hogar','hogar'),('Mascotas','mascotas'),('Ropa','ropa'),
('Herramientas','herramientas')
ON CONFLICT DO NOTHING;

INSERT INTO products(category_id,name,description,price,stock,image_url)
SELECT c.id,'Audífonos Bluetooth Pro','Audio inalámbrico con cancelación de ruido.',39.99,25,''
FROM categories c WHERE c.slug='electronica'
AND NOT EXISTS (SELECT 1 FROM products WHERE name='Audífonos Bluetooth Pro');

INSERT INTO products(category_id,name,description,price,stock,image_url)
SELECT c.id,'Compresor portátil 12V','Inflador compacto para vehículos.',69.99,18,''
FROM categories c WHERE c.slug='automotriz'
AND NOT EXISTS (SELECT 1 FROM products WHERE name='Compresor portátil 12V');

INSERT INTO products(category_id,name,description,price,stock,image_url)
SELECT c.id,'Robot aspirador','Limpieza automática para el hogar.',229.99,10,''
FROM categories c WHERE c.slug='hogar'
AND NOT EXISTS (SELECT 1 FROM products WHERE name='Robot aspirador');

INSERT INTO products(category_id,name,description,price,stock,image_url)
SELECT c.id,'Cama acolchada para mascota','Cómoda y lavable.',34.99,20,''
FROM categories c WHERE c.slug='mascotas'
AND NOT EXISTS (SELECT 1 FROM products WHERE name='Cama acolchada para mascota');
