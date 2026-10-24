/* ============================================================
   Sistema de ventas (caja) - SQL Server
   Script 1: estructura de la base de datos

   - Se puede ejecutar varias veces: no borra nada y solo crea
     lo que falta (tablas, columnas nuevas e índices).
   - Respeta el diseño original; solo agrega 5 columnas:
       producto: imagen_url, origen, calorias
       venta:    subtotal, impuesto
   ============================================================ */

IF DB_ID('sistema_ventas') IS NULL
    CREATE DATABASE sistema_ventas;
GO

USE sistema_ventas;
GO

/* ---------- 1. TABLAS ---------- */

IF OBJECT_ID('dbo.categoria', 'U') IS NULL
CREATE TABLE categoria (
    id_categoria  INT IDENTITY(1,1) NOT NULL,
    nombre        VARCHAR(50)  NOT NULL,
    descripcion   VARCHAR(200) NULL,
    estado        BIT          NOT NULL CONSTRAINT DF_categoria_estado DEFAULT 1,
    CONSTRAINT PK_categoria PRIMARY KEY (id_categoria),
    CONSTRAINT UQ_categoria_nombre UNIQUE (nombre)
);
GO

IF OBJECT_ID('dbo.turno', 'U') IS NULL
CREATE TABLE turno (
    id_turno      INT IDENTITY(1,1) NOT NULL,
    nombre_turno  VARCHAR(30) NOT NULL,
    hora_inicio   TIME        NOT NULL,
    hora_fin      TIME        NOT NULL,
    estado        BIT         NOT NULL CONSTRAINT DF_turno_estado DEFAULT 1,
    CONSTRAINT PK_turno PRIMARY KEY (id_turno)
);
GO

IF OBJECT_ID('dbo.empleado', 'U') IS NULL
CREATE TABLE empleado (
    id_empleado        INT IDENTITY(1,1) NOT NULL,
    ci                 VARCHAR(15)   NOT NULL,
    nombres            VARCHAR(60)   NOT NULL,
    apellidos          VARCHAR(60)   NOT NULL,
    fecha_nacimiento   DATE          NULL,
    telefono           VARCHAR(15)   NULL,
    direccion          VARCHAR(150)  NULL,
    cargo              VARCHAR(50)   NOT NULL,
    area               VARCHAR(50)   NULL,
    fecha_contratacion DATE          NOT NULL,
    salario            DECIMAL(10,2) NOT NULL,
    estado             BIT           NOT NULL CONSTRAINT DF_empleado_estado DEFAULT 1,
    CONSTRAINT PK_empleado PRIMARY KEY (id_empleado),
    CONSTRAINT UQ_empleado_ci UNIQUE (ci),
    CONSTRAINT CK_empleado_salario CHECK (salario >= 0)
);
GO

IF OBJECT_ID('dbo.usuario_sistema', 'U') IS NULL
CREATE TABLE usuario_sistema (
    id_usuario       INT IDENTITY(1,1) NOT NULL,
    id_empleado      INT          NOT NULL,
    nombre_usuario   VARCHAR(50)  NOT NULL,
    contrasena_hash  VARCHAR(255) NOT NULL,
    rol              VARCHAR(30)  NOT NULL,
    ultimo_acceso    DATETIME2    NULL,
    estado           BIT          NOT NULL CONSTRAINT DF_usuario_estado DEFAULT 1,
    CONSTRAINT PK_usuario_sistema PRIMARY KEY (id_usuario),
    CONSTRAINT UQ_usuario_nombre_usuario UNIQUE (nombre_usuario),
    CONSTRAINT UQ_usuario_id_empleado UNIQUE (id_empleado),   -- 1 empleado = 1 usuario
    CONSTRAINT FK_usuario_empleado FOREIGN KEY (id_empleado)
        REFERENCES empleado (id_empleado)
);
GO

IF OBJECT_ID('dbo.producto', 'U') IS NULL
CREATE TABLE producto (
    id_producto    INT IDENTITY(1,1) NOT NULL,
    codigo_barras  VARCHAR(30)   NOT NULL,
    nombre         VARCHAR(100)  NOT NULL,
    id_categoria   INT           NOT NULL,
    precio_compra  DECIMAL(10,2) NOT NULL,
    precio_venta   DECIMAL(10,2) NOT NULL,
    stock_actual   DECIMAL(10,2) NOT NULL CONSTRAINT DF_producto_stock_actual DEFAULT 0,
    stock_minimo   DECIMAL(10,2) NOT NULL CONSTRAINT DF_producto_stock_minimo DEFAULT 0,
    unidad_medida  VARCHAR(20)   NOT NULL,
    estado         BIT           NOT NULL CONSTRAINT DF_producto_estado DEFAULT 1,
    CONSTRAINT PK_producto PRIMARY KEY (id_producto),
    CONSTRAINT UQ_producto_codigo_barras UNIQUE (codigo_barras),
    CONSTRAINT FK_producto_categoria FOREIGN KEY (id_categoria)
        REFERENCES categoria (id_categoria),
    CONSTRAINT CK_producto_precios CHECK (precio_compra >= 0 AND precio_venta >= 0),
    CONSTRAINT CK_producto_stock CHECK (stock_actual >= 0 AND stock_minimo >= 0)
);
GO

IF OBJECT_ID('dbo.venta', 'U') IS NULL
CREATE TABLE venta (
    id_venta     INT IDENTITY(1,1) NOT NULL,
    fecha_venta  DATETIME2     NOT NULL CONSTRAINT DF_venta_fecha DEFAULT SYSDATETIME(),
    id_usuario   INT           NOT NULL,
    id_turno     INT           NOT NULL,
    tipo_pago    VARCHAR(30)   NOT NULL,
    total        DECIMAL(10,2) NOT NULL,
    estado       BIT           NOT NULL CONSTRAINT DF_venta_estado DEFAULT 1,
    CONSTRAINT PK_venta PRIMARY KEY (id_venta),
    CONSTRAINT FK_venta_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuario_sistema (id_usuario),
    CONSTRAINT FK_venta_turno FOREIGN KEY (id_turno)
        REFERENCES turno (id_turno),
    CONSTRAINT CK_venta_total CHECK (total >= 0)
);
GO

IF OBJECT_ID('dbo.detalle_venta', 'U') IS NULL
CREATE TABLE detalle_venta (
    id_detalle       INT IDENTITY(1,1) NOT NULL,
    id_venta         INT           NOT NULL,
    id_producto      INT           NOT NULL,
    cantidad         DECIMAL(10,2) NOT NULL,
    precio_unitario  DECIMAL(10,2) NOT NULL,
    subtotal         DECIMAL(10,2) NOT NULL,
    CONSTRAINT PK_detalle_venta PRIMARY KEY (id_detalle),
    CONSTRAINT FK_detalle_venta_venta FOREIGN KEY (id_venta)
        REFERENCES venta (id_venta),
    CONSTRAINT FK_detalle_venta_producto FOREIGN KEY (id_producto)
        REFERENCES producto (id_producto),
    CONSTRAINT CK_detalle_cantidad CHECK (cantidad > 0),
    CONSTRAINT CK_detalle_valores CHECK (precio_unitario >= 0 AND subtotal >= 0)
);
GO

IF OBJECT_ID('dbo.ajuste_inventario', 'U') IS NULL
CREATE TABLE ajuste_inventario (
    id_ajuste         INT IDENTITY(1,1) NOT NULL,
    id_producto       INT           NOT NULL,
    id_usuario        INT           NOT NULL,
    fecha_ajuste      DATETIME2     NOT NULL CONSTRAINT DF_ajuste_fecha DEFAULT SYSDATETIME(),
    cantidad_antes    DECIMAL(10,2) NOT NULL,
    cantidad_despues  DECIMAL(10,2) NOT NULL,
    diferencia        DECIMAL(10,2) NOT NULL,
    motivo            VARCHAR(200)  NOT NULL,
    CONSTRAINT PK_ajuste_inventario PRIMARY KEY (id_ajuste),
    CONSTRAINT FK_ajuste_producto FOREIGN KEY (id_producto)
        REFERENCES producto (id_producto),
    CONSTRAINT FK_ajuste_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuario_sistema (id_usuario)
);
GO

-- Sin claves foráneas (como en el diagrama): los registros de auditoría
-- se conservan aunque se eliminen usuarios o registros.
IF OBJECT_ID('dbo.auditoria', 'U') IS NULL
CREATE TABLE auditoria (
    id_auditoria    INT IDENTITY(1,1) NOT NULL,
    fecha_accion    DATETIME2    NOT NULL CONSTRAINT DF_auditoria_fecha DEFAULT SYSDATETIME(),
    id_usuario      INT          NOT NULL,
    accion          VARCHAR(50)  NOT NULL,
    tabla_afectada  VARCHAR(50)  NULL,
    id_registro     INT          NULL,
    detalle         VARCHAR(MAX) NULL,
    direccion_ip    VARCHAR(50)  NULL,
    CONSTRAINT PK_auditoria PRIMARY KEY (id_auditoria)
);
GO

/* ---------- 2. COLUMNAS AGREGADAS PARA LA PANTALLA DE CAJA ---------- */

IF COL_LENGTH('dbo.producto', 'imagen_url') IS NULL
    ALTER TABLE producto ADD imagen_url VARCHAR(300) NULL;
GO
IF COL_LENGTH('dbo.producto', 'origen') IS NULL
    ALTER TABLE producto ADD origen VARCHAR(60) NULL;
GO
IF COL_LENGTH('dbo.producto', 'calorias') IS NULL
    ALTER TABLE producto ADD calorias INT NULL;
GO
IF COL_LENGTH('dbo.venta', 'subtotal') IS NULL
    ALTER TABLE venta ADD subtotal DECIMAL(10,2) NOT NULL CONSTRAINT DF_venta_subtotal DEFAULT 0;
GO
IF COL_LENGTH('dbo.venta', 'impuesto') IS NULL
    ALTER TABLE venta ADD impuesto DECIMAL(10,2) NOT NULL CONSTRAINT DF_venta_impuesto DEFAULT 0;
GO

/* ---------- 3. ÍNDICES ---------- */

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_producto_categoria' AND object_id = OBJECT_ID('dbo.producto'))
    CREATE INDEX IX_producto_categoria      ON producto (id_categoria);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_venta_usuario' AND object_id = OBJECT_ID('dbo.venta'))
    CREATE INDEX IX_venta_usuario           ON venta (id_usuario);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_venta_turno' AND object_id = OBJECT_ID('dbo.venta'))
    CREATE INDEX IX_venta_turno             ON venta (id_turno);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_venta_fecha' AND object_id = OBJECT_ID('dbo.venta'))
    CREATE INDEX IX_venta_fecha             ON venta (fecha_venta);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_detalle_venta_venta' AND object_id = OBJECT_ID('dbo.detalle_venta'))
    CREATE INDEX IX_detalle_venta_venta     ON detalle_venta (id_venta);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_detalle_venta_producto' AND object_id = OBJECT_ID('dbo.detalle_venta'))
    CREATE INDEX IX_detalle_venta_producto  ON detalle_venta (id_producto);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ajuste_producto' AND object_id = OBJECT_ID('dbo.ajuste_inventario'))
    CREATE INDEX IX_ajuste_producto         ON ajuste_inventario (id_producto);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ajuste_usuario' AND object_id = OBJECT_ID('dbo.ajuste_inventario'))
    CREATE INDEX IX_ajuste_usuario          ON ajuste_inventario (id_usuario);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_auditoria_usuario' AND object_id = OBJECT_ID('dbo.auditoria'))
    CREATE INDEX IX_auditoria_usuario       ON auditoria (id_usuario);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_auditoria_fecha' AND object_id = OBJECT_ID('dbo.auditoria'))
    CREATE INDEX IX_auditoria_fecha         ON auditoria (fecha_accion);
GO
