# TES Supermarket · Caja (SQL Server + ASP.NET Core + React)

Pantalla de caja conectada a la base de datos `sistema_ventas`.

```
sistema-ventas/
├── database/   01_crear_base_datos.sql · 02_datos_iniciales.sql
├── backend/    CajaApi (ASP.NET Core + Dapper + JWT)
└── frontend/   React + Vite + Tailwind
```

## Requisitos
- SQL Server (local) y SSMS
- .NET SDK 8 o superior
- Node.js 18 o superior

## 1. Base de datos
En SSMS abre y ejecuta, en este orden:
1. `database/01_crear_base_datos.sql` (crea la BD, tablas, 5 columnas nuevas e índices; se puede repetir sin problema)
2. `database/02_datos_iniciales.sql` (categorías, turnos y 25 productos)
3. `database/03_alta_disponibilidad.sql` (columna de idempotencia para ventas + consultas de comprobación del Availability Group). Con Always On, ejecútalo en la réplica **primaria**.

## 2. Backend
1. Abre `backend/CajaApi/appsettings.json` y ajusta `ConnectionStrings:Default` según tu instancia:
   - Instancia por defecto: `Server=localhost;...` (ya viene así)
   - SQL Express: `Server=localhost\\SQLEXPRESS;...`
   - Usuario y contraseña de SQL: `Server=localhost;Database=sistema_ventas;User Id=sa;Password=TU_CLAVE;TrustServerCertificate=True;`
2. Cambia `Jwt:Key` por una clave larga y secreta (mínimo 32 caracteres).
3. Ejecuta:
   ```
   cd backend/CajaApi
   dotnet run
   ```
   La API queda en http://localhost:5080. La primera vez crea dos usuarios:

   | Usuario | Contraseña | Rol |
   |---|---|---|
   | admin | Admin123! | admin (puede anular ventas y ver las de todas las cajas) |
   | cajero | Cajero123! | cajero |

   Cambia estas contraseñas antes de usarlo de verdad.

Si tu SDK es distinto de .NET 8 y quieres compilar para él, cambia `TargetFramework` en `CajaApi.csproj` (y la versión `8.0.*` de JwtBearer).

## 3. Frontend
```
cd frontend
npm install
npm run dev
```
Abre http://localhost:5173 e inicia sesión.

Las imágenes de los 25 productos iniciales van en `frontend/public/productos/` (por ejemplo `tomate.png`); los nombres están en la columna `imagen_url`. Las que sube el administrador desde la pantalla se guardan en `backend/CajaApi/wwwroot/uploads/productos/` (y su ruta, `/uploads/productos/<archivo>`, en la misma columna `imagen_url`); la API las entrega en `/uploads/productos/...` y también en `/api/uploads/productos/...`. Sin imagen se muestra un recuadro con la inicial.

## Qué hace
- Login con JWT; contraseñas con BCrypt en `usuario_sistema.contrasena_hash`.
- Catálogo por categoría, búsqueda por nombre y escaneo de código de barras (Enter).
- Orden actual, impuesto (5 %, configurable en `Caja:TasaImpuesto`), pago en Efectivo / Tarjeta / QR y cálculo de cambio.
- Al cobrar, una sola transacción: crea `venta` y `detalle_venta`, descuenta stock (si no alcanza, rechaza la venta), asigna el turno según la hora y registra en `auditoria`. Los precios siempre se toman de la BD.
- Ticket imprimible; "Ventas de hoy" con totales por tipo de pago; el admin puede anular una venta (devuelve el stock).
- Auditoría: LOGIN, LOGIN_FALLIDO, VENTA, ANULAR_VENTA, CREAR_PRODUCTO, EDITAR_PRODUCTO, ELIMINAR_PRODUCTO, DESACTIVAR_PRODUCTO y REACTIVAR_PRODUCTO.

## Administración de productos (solo rol admin)
Al entrar como admin aparece el botón **Productos** en la cabecera. Desde ahí:
- **Nuevo producto** / **Editar**: código de barras, nombre, categoría, precios de compra y venta, stock actual y mínimo, unidad, origen, calorías e **imagen**: se sube desde el PC (clic o arrastrar) o se pega la **URL de una imagen de la web** (el servidor la descarga y la guarda como archivo propio, así no depende del otro sitio). JPG, PNG o WEBP, máx. 3 MB. Solo se descargan URL públicas (no localhost ni redes internas).
- **Eliminar**: si el producto nunca se vendió ni se ajustó, se borra de verdad (y su imagen subida). Si ya tiene ventas o ajustes, **se desactiva** (`estado = 0`): deja de aparecer en caja pero el historial de ventas y tickets queda intacto. Los desactivados se ven con "Mostrar desactivados" y se pueden **reactivar**.
- Si al editar cambias el stock, se registra una fila en `ajuste_inventario` (antes, después, diferencia y motivo).
- El código de barras no se puede repetir (ya lo exigía la BD con `UQ_producto_codigo_barras`).

## Endpoints
| Método | Ruta | Acceso |
|---|---|---|
| POST | /api/auth/login | público |
| GET | /api/auth/me | autenticado |
| GET | /api/caja/info · /api/categorias · /api/productos | autenticado |
| POST | /api/ventas | autenticado |
| GET | /api/ventas/hoy · /api/ventas/{id} | autenticado (cajero: solo las suyas) |
| POST | /api/ventas/{id}/anular | admin |
| GET | /api/admin/productos | admin (incluye desactivados y precio de compra) |
| POST | /api/admin/productos | admin (multipart/form-data, con `imagen` o `imagenWeb` opcional) |
| PUT | /api/admin/productos/{id} | admin (multipart/form-data; `imagen` nueva o `quitarImagen=true`) |
| DELETE | /api/admin/productos/{id} | admin (borra o desactiva según tenga historial) |
| POST | /api/admin/productos/{id}/reactivar | admin |

## Cambios respecto a tu script original
`producto`: + `imagen_url`, `origen`, `calorias` · `venta`: + `subtotal`, `impuesto`. Todo lo demás queda igual.

**La administración de productos no cambia la base de datos**: usa las tablas y columnas que ya existen (`producto`, `ajuste_inventario`, `auditoria`). No hay que volver a ejecutar ningún script.


## Alta disponibilidad (Always On) y pruebas de failover

**Conexión.** En `appsettings.json` cambia `TU_LISTENER` por el nombre del listener del Availability Group
(ej. `Server=tcp:listener-ventas,1433;...`). Ya incluye `MultiSubnetFailover=True` y reintentos de conexión.
Con `Trusted_Connection=True` la API debe correr con una cuenta que tenga acceso en **todas** las réplicas; con login SQL,
crea el mismo login (mismo SID) en cada réplica.

**Qué hace la app ante una caída**
- `Db.OpenAsync` reintenta la conexión (3 veces, esperando 3-6-9 s) ante errores temporales de SQL Server y limpia el pool.
- Un manejador global convierte los errores de conectividad en **503** con mensaje claro (el resto, en 500 genérico).
- El arranque no se cae si la BD no está disponible.
- El navegador corta peticiones colgadas (timeout) y reintenta las lecturas; el cobro se reintenta con una **clave de idempotencia**,
  así que si el corte ocurre justo al confirmar la venta, no se cobra dos veces.
- `GET /api/salud` (público) devuelve el servidor que responde (`@@SERVERNAME`), si es el primario y el tiempo de respuesta.

**Cómo probar**
1. Con la API en marcha: `powershell -File herramientas\probar-failover.ps1` (muestra el nodo cada segundo y mide los cortes).
2. Haz ventas desde la caja.
3. Fuerza el failover (apaga el primario o `ALTER AVAILABILITY GROUP [tu_ag] FAILOVER;` en la secundaria).
4. Comprueba: tiempo de recuperación, mensaje que vio el cajero, y que no hay ventas duplicadas
   (`SELECT clave_idempotencia, COUNT(*) FROM venta GROUP BY clave_idempotencia HAVING COUNT(*) > 1;`).

**Fuera del alcance de SQL Server:** las imágenes que sube el admin se guardan en `backend/CajaApi/wwwroot/uploads` del servidor de la API
(no en la BD), así que Always On no las replica.
