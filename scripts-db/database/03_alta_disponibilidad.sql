/* ============================================================
   Sistema de ventas (caja) - SQL Server
   Script 3: preparación para Always On (alta disponibilidad)

   - Ejecutar en la réplica PRIMARIA (el cambio se replica solo
     a las secundarias, porque la BD ya está en el grupo).
   - Se puede repetir sin problema.
   ============================================================ */

USE sistema_ventas;
GO

/* ---------- 1. Clave de idempotencia en venta ----------
   El navegador genera un GUID por cada venta. Si tras un failover
   la petición se repite, la API reconoce la clave y devuelve la venta
   ya registrada en lugar de cobrar dos veces. */
IF COL_LENGTH('dbo.venta', 'clave_idempotencia') IS NULL
    ALTER TABLE dbo.venta ADD clave_idempotencia UNIQUEIDENTIFIER NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_venta_clave_idempotencia' AND object_id = OBJECT_ID('dbo.venta'))
    CREATE UNIQUE INDEX UX_venta_clave_idempotencia
        ON dbo.venta (clave_idempotencia)
        WHERE clave_idempotencia IS NOT NULL;
GO

/* ---------- 2. Comprobaciones útiles del Availability Group ---------- */

-- La BD debe estar en modo de recuperación FULL (requisito del AG)
SELECT name, recovery_model_desc FROM sys.databases WHERE name = 'sistema_ventas';

-- Estado de las réplicas y de la sincronización
SELECT ar.replica_server_name,
       ars.role_desc,
       ars.connected_state_desc,
       ars.synchronization_health_desc
FROM sys.dm_hadr_availability_replica_states ars
JOIN sys.availability_replicas ar ON ar.replica_id = ars.replica_id;

SELECT DB_NAME(database_id) AS base_datos,
       synchronization_state_desc,
       synchronization_health_desc
FROM sys.dm_hadr_database_replica_states
WHERE is_local = 1;

-- Logins que existen en el primario: deben existir TAMBIÉN en la réplica secundaria
SELECT name, type_desc FROM sys.server_principals
WHERE type IN ('S', 'U', 'G') AND name NOT LIKE '##%' AND name NOT LIKE 'NT %';
GO
