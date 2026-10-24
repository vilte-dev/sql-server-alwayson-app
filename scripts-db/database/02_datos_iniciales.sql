/* ============================================================
   Sistema de ventas (caja) - SQL Server
   Script 2: datos iniciales (categorías, turnos y productos)

   Ejecutar DESPUÉS de 01_crear_base_datos.sql.
   Se puede ejecutar varias veces sin duplicar datos.

   Los usuarios (admin y cajero) los crea la API automáticamente
   la primera vez que arranca, porque necesita generar el hash
   BCrypt de las contraseñas.
   ============================================================ */

USE sistema_ventas;
GO

/* ---------- Categorías ---------- */
INSERT INTO categoria (nombre, descripcion)
SELECT v.nombre, v.descripcion
FROM (VALUES
    (N'Verduras',    N'Verduras y hortalizas frescas'),
    (N'Frutas',      N'Frutas de temporada'),
    (N'Carnes',      N'Carnes rojas y aves'),
    (N'Mariscos',    N'Pescados y mariscos'),
    (N'Lácteos',     N'Leche, quesos y derivados'),
    (N'Panadería',   N'Pan y repostería')
) AS v(nombre, descripcion)
WHERE NOT EXISTS (SELECT 1 FROM categoria c WHERE c.nombre = v.nombre);
GO

/* ---------- Turnos (el de la noche cruza la medianoche) ---------- */
INSERT INTO turno (nombre_turno, hora_inicio, hora_fin)
SELECT v.nombre_turno, v.hora_inicio, v.hora_fin
FROM (VALUES
    (N'Mañana', CAST('06:00' AS TIME), CAST('14:00' AS TIME)),
    (N'Tarde',  CAST('14:00' AS TIME), CAST('22:00' AS TIME)),
    (N'Noche',  CAST('22:00' AS TIME), CAST('06:00' AS TIME))
) AS v(nombre_turno, hora_inicio, hora_fin)
WHERE NOT EXISTS (SELECT 1 FROM turno t WHERE t.nombre_turno = v.nombre_turno);
GO

/* ---------- Productos ----------
   precio_compra es un costo aproximado (≈70% del precio de venta).
   imagen_url apunta a frontend/public/productos/<archivo>. Si el archivo
   no existe, la pantalla muestra un recuadro con la inicial del producto.
   unidad_medida: 'unidad' o 'kg' (los 'kg' se venden de a 0.5).
*/
INSERT INTO producto (codigo_barras, nombre, id_categoria, precio_compra, precio_venta,
                      stock_actual, stock_minimo, unidad_medida, imagen_url, origen, calorias)
SELECT v.codigo, v.nombre, c.id_categoria, v.compra, v.venta,
       v.stock, v.minimo, v.unidad, v.imagen, v.origen, v.calorias
FROM (VALUES
 -- Verduras
 ('7790001000011', N'Zanahoria',    N'Verduras', 0.60, 0.89, 120, 15, 'kg',     '/productos/zanahoria.png',  N'EE. UU.',          41),
 ('7790001000028', N'Brócoli',      N'Verduras', 2.40, 3.49,  60, 10, 'unidad', '/productos/brocoli.png',    N'México',           34),
 ('7790001000035', N'Tomate',       N'Verduras', 0.50, 0.75, 150, 20, 'kg',     '/productos/tomate.png',     N'España',           22),
 ('7790001000042', N'Pepino',       N'Verduras', 0.85, 1.25,  90, 12, 'unidad', '/productos/pepino.png',     N'Canadá',           15),
 ('7790001000059', N'Champiñón',    N'Verduras', 1.40, 1.99,  50, 10, 'unidad', '/productos/champinon.png',  N'Granja local',     22),
 ('7790001000066', N'Papa',         N'Verduras', 0.40, 0.60, 300, 40, 'kg',     '/productos/papa.png',       N'Idaho, EE. UU.',   77),
 ('7790001000073', N'Cebolla',      N'Verduras', 0.60, 0.85, 200, 25, 'kg',     '/productos/cebolla.png',    N'México',           40),
 ('7790001000080', N'Berenjena',    N'Verduras', 1.05, 1.50,  70, 10, 'unidad', '/productos/berenjena.png',  N'Italia',           25),
 ('7790001000097', N'Lechuga',      N'Verduras', 1.40, 1.99,  80, 12, 'unidad', '/productos/lechuga.png',    N'California, EE. UU.', 15),
 ('7790001000103', N'Repollo',      N'Verduras', 0.90, 1.29,  75, 10, 'unidad', '/productos/repollo.png',    N'EE. UU.',          25),
 ('7790001000110', N'Ají',          N'Verduras', 0.15, 0.25, 400, 50, 'unidad', '/productos/aji.png',        N'México',           40),
 ('7790001000127', N'Choclo',       N'Verduras', 0.60, 0.89, 140, 20, 'unidad', '/productos/choclo.png',     N'EE. UU.',          96),
 -- Frutas
 ('7790002000018', N'Manzana',      N'Frutas',   1.10, 1.60, 160, 20, 'kg',     '/productos/manzana.png',    N'Chile',            52),
 ('7790002000025', N'Plátano',      N'Frutas',   0.70, 1.05, 180, 25, 'kg',     '/productos/platano.png',    N'Ecuador',          89),
 ('7790002000032', N'Naranja',      N'Frutas',   0.80, 1.20, 140, 20, 'kg',     '/productos/naranja.png',    N'Bolivia',          47),
 ('7790002000049', N'Frutilla',     N'Frutas',   2.60, 3.80,  45, 10, 'unidad', '/productos/frutilla.png',   N'Bolivia',          32),
 -- Carnes
 ('7790003000015', N'Pechuga de pollo', N'Carnes', 3.80, 5.50, 60, 10, 'kg',    '/productos/pollo.png',      N'Bolivia',          165),
 ('7790003000022', N'Carne molida',     N'Carnes', 4.90, 7.20, 50, 10, 'kg',    '/productos/carne-molida.png', N'Bolivia',        250),
 -- Mariscos
 ('7790004000012', N'Filete de salmón', N'Mariscos', 9.50, 13.90, 25, 5, 'kg',  '/productos/salmon.png',     N'Chile',            208),
 ('7790004000029', N'Camarones',        N'Mariscos', 8.20, 11.90, 20, 5, 'kg',  '/productos/camarones.png',  N'Ecuador',          99),
 -- Lácteos
 ('7790005000019', N'Leche entera 1 L', N'Lácteos', 0.85, 1.25, 120, 20, 'unidad', '/productos/leche.png',   N'Bolivia',          61),
 ('7790005000026', N'Queso fresco',     N'Lácteos', 3.60, 5.20,  40, 8,  'kg',     '/productos/queso.png',   N'Bolivia',          264),
 ('7790005000033', N'Yogur natural',    N'Lácteos', 0.70, 1.05,  90, 15, 'unidad', '/productos/yogur.png',   N'Bolivia',          59),
 -- Panadería
 ('7790006000010', N'Pan de molde',     N'Panadería', 1.30, 1.90,  60, 10, 'unidad', '/productos/pan-molde.png', N'Local',        265),
 ('7790006000027', N'Croissant',        N'Panadería', 0.55, 0.85, 100, 15, 'unidad', '/productos/croissant.png', N'Local',        406)
) AS v(codigo, nombre, categoria, compra, venta, stock, minimo, unidad, imagen, origen, calorias)
JOIN categoria c ON c.nombre = v.categoria
WHERE NOT EXISTS (SELECT 1 FROM producto p WHERE p.codigo_barras = v.codigo);
GO

SELECT c.nombre AS categoria, COUNT(*) AS productos
FROM producto p JOIN categoria c ON c.id_categoria = p.id_categoria
GROUP BY c.nombre;
GO
