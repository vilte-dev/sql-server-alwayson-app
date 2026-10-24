# SQL Server Always On Availability Groups & Integración de Aplicación

Este repositorio centralizado contiene la documentación de infraestructura, el mapa de ruta y el código fuente de la aplicación utilizados para implementar y validar una solución de **Alta Disponibilidad (HA)** y **Recuperación ante Desastres (DR)** en un entorno de tres computadoras físicas.

---

## 🗺️ Arquitectura Física y Direccionamiento de Red

Para garantizar el quórum del clúster y evitar el escenario de *Split-Brain* (Cerebro Dividido), se utiliza una topología de **2 Nodos de Datos + 1 Nodo Testigo/Dominio**. 

| Dispositivo Físico | Dirección IP | Rol en el Clúster (WSFC) | Componente de Software |
| :--- | :--- | :--- | :--- |
| **PC-01 (Principal)** | `192.168.1.11` | Nodo Activo (1 Voto) | Réplica Primaria SQL Server + Backend IIS |
| **PC-02 (Respaldo)** | `192.168.1.12` | Nodo Activo (1 Voto) | Réplica Secundaria SQL Server + Backend IIS |
| **PC-03 (Testigo)** | `192.168.1.13` | Testigo de Archivo (1 Voto) | Controlador de Dominio Active Directory + DNS |
| **WSFC-CLUSTER** | `192.168.1.20` | IP Virtual del Clúster | Nombre de Red del Clúster de Windows |
| **AG-LISTENER** | `192.168.1.30` | IP Virtual del Listener | Punto de Acceso Único para la Aplicación |

---

## 📁 Estructura Sugerida del Repositorio

* `/infraestructura-docs`: Guías de configuración paso a paso del sistema operativo.
* `/scripts-db`: Scripts SQL para la creación de endpoints, respaldos y monitoreo.
* `/app-proyecto/backend-aspnet`: API REST construida en ASP.NET Core.
* `/app-proyecto/frontend-react`: Interfaz de usuario construida en React.

---

## 🚀 Mapa de Ruta y Control de Avances

### 🔲 Fase 1: Red, Dominio y Seguridad (PC-03)
- [ ] Configurar IPs estáticas en el mismo segmento para las 3 PCs físicas.
- [ ] Promover la `PC-03` como Controlador de Dominio (Active Directory) y Servidor DNS.
- [ ] Unir la `PC-01` y la `PC-02` al dominio del laboratorio.
- [ ] Crear la cuenta de servicio en el dominio (ej. `dominio\sqlservice`) para ejecutar SQL Server.
- [ ] Habilitar puertos en el Firewall de Windows: `1433` (SQL), `5022` (Always On), `3343` (WSFC), `445` (SMB).

### 🔲 Fase 2: Windows Server Failover Cluster & Quórum (Testigo)
- [ ] Instalar la característica *Failover Clustering* en `PC-01` y `PC-02`.
- [ ] Ejecutar el asistente de validación de clúster con ambos nodos de datos.
- [ ] Crear el clúster virtual asignándole la IP fija `192.168.1.20`.
- [ ] Crear y compartir una carpeta en la `PC-03` (ej. `C:\ClusterWitness`) con permisos de Control Total para el clúster.
- [ ] Configurar el Quórum en el WSFC seleccionando **File Share Witness** apuntando a `\\192.168.1.13\ClusterWitness`.

### 🔲 Fase 3: Configuración de SQL Server y Always On
- [ ] Instalar SQL Server en `PC-01` y `PC-02` usando la cuenta de servicio del dominio.
- [ ] Habilitar **AlwaysOn High Availability** en *SQL Server Configuration Manager* en ambos nodos.
- [ ] Configurar la base de datos de la app en modo de recuperación completo (*Full Recovery*) y realizar el backup inicial.

### 🔲 Fase 4: Grupo de Disponibilidad (AG) y Listener
- [ ] Crear el Grupo de Disponibilidad (AG) configurando `PC-01` como Primaria y `PC-02` como Secundaria (Modo Sincrónico + Failover Automático).
- [ ] Crear el registro A en el DNS de la `PC-03` vinculando el nombre del Listener a la IP `192.168.1.30`.
- [ ] Agregar el Listener en SQL Server usando el puerto `1433`.

### 🔲 Fase 5: Despliegue e Integración de la Aplicación (Local)
- [ ] **Configurar Cadena de Conexión:** Modificar el `appsettings.json` del backend de ASP.NET para apuntar al Listener con soporte multi-subred:
  ```json
  "ConnectionStrings": {
    "DefaultConnection": "Server=AG-LISTENER,1433;Database=AppDB;User Id=sa;Password=TuPassword;MultiSubnetFailover=True;"
  }
  ```
- [ ] Desplegar el backend de ASP.NET localmente en IIS o mediante la CLI de .NET en los nodos de datos.
- [ ] Levantar el frontend de React localmente configurando la URL base hacia la IP del backend.

---

## 🧪 Escenario de Prueba de Conmutación (Failover)

Para defender exitosamente el proyecto, se realizará la siguiente demostración en vivo:
1. Navegar por la aplicación en React realizando operaciones CRUD (los datos se guardan en la `PC-01`).
2. **Simulación de Fallo:** Desconectar físicamente el cable de red de la `PC-01`.
3. El clúster detectará la pérdida del nodo, mantendrá el quórum gracias al voto de la `PC-02` y el voto de la `PC-03` (Testigo).
4. El Listener redirigirá el tráfico automáticamente a la `PC-02` (ahora promovida a Primaria).
5. Refrescar la aplicación en React para demostrar que sigue operativa y leyendo datos sin cambiar una sola línea de código o IP.

---

## 👥 Equipo de Trabajo
* **[Tu Nombre / Usuario de GitHub]** - Configuración de Red, Active Directory, Testigo de Quórum (PC-03) y Frontend React.
* **[Nombre de tu Compañero / Usuario de GitHub]** - Configuración de WSFC, Always On (PC-01/PC-02) y Backend ASP.NET.
