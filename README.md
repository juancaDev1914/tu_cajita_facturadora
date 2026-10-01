# 🛒 Tu Cajita Facturadora — Sistema de Punto de Venta

> **🚀 Producción:** https://tu-cajita-facturadora.vercel.app/
> **💻 Desarrollo local:** http://localhost:5173 (`npm run dev`)
> **📦 Repositorio:** https://github.com/juancaDev1914/tu_cajita_facturadora

Aplicación web **offline-first** de punto de venta (POS) completa, construida con React + Vite y empaquetada como **PWA instalable**. Diseñada para funcionar en tablets, PC y navegadores modernos como una aplicación de negocio local sin depender de un servidor backend continuo.

---

## 📋 Tabla de Contenidos

1. [Descripción General](#descripción-general)
2. [Características Principales](#características-principales)
3. [Arquitectura del Sistema](#arquitectura-del-sistema)
4. [Módulos y Funcionalidades](#módulos-y-funcionalidades)
5. [Autenticación y Roles](#autenticación-y-roles)
6. [Datos y Persistencia](#datos-y-persistencia)
7. [Modo Offline y Sincronización](#modo-offline-y-sincronización)
8. [Instalación y Ejecución](#instalación-y-ejecución)
9. [Estructura del Proyecto](#estructura-del-proyecto)
10. [Personalización](#personalización)
11. [Guía para Desarrolladores](#guía-para-desarrolladores)
12. [Flujos de Trabajo Comunes](#flujos-de-trabajo-comunes)
13. [Consideraciones de Seguridad](#consideraciones-de-seguridad)

---

## Descripción General

**Cajita POS** es una solución integral para pequeñas tiendas y comercios locales que necesitan:

- ✅ Facturación y control de caja en tiempo real
- ✅ Gestión de inventario con alertas de stock
- ✅ Historial completo de ventas
- ✅ Reportes y dashboards analíticos
- ✅ Gestión de deudas (por cobrar y por pagar)
- ✅ Sistema de nómina basado en ventas
- ✅ Administración de usuarios con roles

La aplicación está diseñada para trabajar **sin conexión a internet** y sincronizarse automáticamente cuando la red está disponible.

---

## Características Principales

### 🎯 Funcionalidades Clave

| Característica | Descripción |
|----------------|-------------|
| **Offline-First** | Funciona completamente sin internet; los datos se guardan localmente |
| **PWA Instalable** | Se puede instalar como aplicación nativa en dispositivos móviles y desktop |
| **Persistencia Local** | Usa IndexedDB para almacenar todos los datos del negocio |
| **Roles y Permisos** | Sistema de autenticación con dos roles: Administrador y Vendedor/Cajero |
| **Sincronización Automática** | Las operaciones realizadas sin conexión se envían automáticamente al recuperar la red |
| **Exportación de Datos** | Reportes exportables a CSV para análisis externo |
| **Impresión de Tickets** | Facturas y cupones imprimibles directamente desde la aplicación |

### 📱 Plataformas Soportadas

- **Tablets** (iPad, Android tablets)
- **PC/Mac** (navegadores modernos)
- **Navegadores móviles** (Chrome, Edge, Safari)
- **Modo instalado** (PWA como app nativa)

---

## Arquitectura del Sistema

### Diagrama de Flujo de Datos

```
┌─────────────────────────────────────────────────────────────────┐
│                         CAPA DE UI                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Vistas    │  │ Componentes │  │     Componentes UI      │ │
│  │  (Módulos)  │  │  Reutilizables│  │  (Sidebar, Modal, etc) │ │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘ │
└─────────┼────────────────┼──────────────────────┼────────────────┘
          │                │                      │
          ▼                ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      STORECONTEXT (React Context)               │
│  • Estado global de la aplicación                               │
│  • Lógica de negocio                                            │
│  • Gestión de sesión y autenticación                           │
│  • Coordinación de sincronización                              │
│  • Toast notifications                                          │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CAPA DE BASE DE DATOS                        │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐  │
│  │     IndexedDB       │  │         Outbox (Cola)           │  │
│  │  - Productos        │  │  - Operaciones pendientes       │  │
│  │  - Ventas           │  │  - Sincronización offline       │  │
│  │  - Usuarios         │  │                                 │  │
│  │  - Deudas           │  │                                 │  │
│  │  - Nómina           │  │                                 │  │
│  │  - Configuración    │  │                                 │  │
│  └─────────────────────┘  └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Componentes del Sistema

#### 1. **IndexedDB** (Base de Datos Local)
Almacena permanentemente todos los datos del negocio en el navegador:

| Almacén | Descripción |
|---------|-------------|
| `state` | Estado completo de la aplicación (productos, ventas, usuarios, etc.) |
| `outbox` | Cola de operaciones pendientes para sincronización |

#### 2. **StoreContext** (Contexto Global de React)
Actúa como puente entre la UI y la base de datos:

- Carga y persiste datos en IndexedDB
- Gestiona la sesión del usuario actual
- Controla el estado de conexión (online/offline)
- Coordina la sincronización de operaciones pendientes
- Proporciona funciones para CRUD de todos los módulos

#### 3. **Vistas (Módulos)**
Cada módulo es una vista principal que consume el contexto global:

| Vista | Propósito |
|-------|-----------|
| `LoginView` | Pantalla de inicio de sesión |
| `POSView` | Punto de venta / facturación |
| `InventoryView` | Gestión de inventario |
| `SalesView` | Historial de ventas |
| `ReportsView` | Reportes y análisis |
| `DashboardView` | Métricas y resumen |
| `UsersView` | Administración de usuarios |
| `DebtView` | Gestión de deudas |
| `PayrollView` | Nómina y pagos |

#### 4. **Componentes Reutilizables**
Elementos UI compartidos entre vistas:

- `Sidebar` — Navegación principal
- `Modal` — Ventanas emergentes
- `Toast` — Notificaciones temporales
- `BarChart` — Gráficos simples
- `Pagination` — Paginación de listas
- `MobileTopbar` — Barra superior para móviles

---

## Módulos y Funcionalidades

### 🏪 1. Caja / Facturación (POS)

**Descripción:** Módulo principal para registrar ventas y cobrar clientes.

**Flujo de trabajo:**

```
1. Buscar producto (por nombre o código)
   └─ Filtro por categoría
   └─ Búsqueda en tiempo real

2. Agregar al carrito
   └─ Control de stock disponible
   └─ Ajuste de cantidades (+/-)
   └─ Eliminación de items

3. Configurar venta
   └─ Nombre del cajero (auto o manual)
   └─ Cliente (opcional)
   └─ Descuento porcentual (0-100%)

4. Proceso de pago
   └─ Selección de medio de pago:
      • 💵 Efectivo
      • 💳 Tarjeta
      • 🏦 Transferencia
      • 📱 Nequi / Daviplata
   └─ Para efectivo: cálculo automático de cambio

5. Confirmación
   └─ Generación de número de factura
   └─ Actualización de stock
   └─ Registro en historial
   └─ Ticket imprimible
```

**Características especiales:**

- Control de stock en tiempo real
- Alertas de stock bajo
- Cálculo automático de cambio
- **Cantidad manual** — Toca la cantidad en el carrito y escríbela con el teclado numérico (también con los botones −/+); se ajusta sola entre 1 y el stock disponible
- Ticket con todos los detalles

---

### 📦 2. Inventario

**Descripción:** Gestión completa del catálogo de productos.

**Operaciones disponibles:**

| Operación | Descripción |
|-----------|-------------|
| **Crear producto** | Agregar nuevos productos con: código, nombre, categoría, precio, costo, stock mínimo |
| **Editar producto** | Modificar cualquier campo de un producto existente |
| **Eliminar producto** | Remover producto del inventario (con confirmación) |
| **Consultar ganancias** | Ver margen estimado por producto (precio - costo) |
| **Alertas de stock** | Indicadores visuales cuando el stock está por debajo del mínimo |

**Campos de un producto:**

```javascript
{
  id: "p01",              // Identificador único
  code: "P-001",         // Código de barras/reference
  name: "Arroz Diana 1kg", // Nombre descriptivo
  emoji: "🍚",           // Icono representativo
  category: "Despensa",  // Categoría para filtrado
  price: 4200,           // Precio de venta (COP)
  cost: 3000,            // Costo de adquisición (COP)
  stock: 90,             // Stock actual
  minStock: 15           // Stock mínimo antes de alerta
}
```

---

### 📜 3. Historial de Ventas

**Descripción:** Registro completo de todas las transacciones realizadas.

**Funcionalidades:**

- 🔍 **Búsqueda:** Por número de factura, cliente, cajero
- 📅 **Filtros:** Por rango de fechas, método de pago
- 📊 **Detalle:** Ver todos los items de cada venta
- ⏳ **Ventas pendientes:** Deja una venta sin cobrar y sigue con otras; al confirmar el pago se emite la factura electrónica
- ✏️ **Edición de pendientes:** Agrega, quita o cambia productos y el descuento de una factura pendiente (Historial → *Editar* o POS → ⏳ Pendientes → *Editar*); el stock y el total se recalculan al guardar
- 💸 **Aviso de cambio:** Al cobrar en efectivo, la notificación del cambio a devolver se queda 15 segundos en pantalla (se puede tocar para cerrarla antes)
- ⚠️ **Anulación:** Solo administradores pueden anular ventas (restaura el stock automáticamente)

**Estructura de una venta:**

```javascript
{
  id: "V-20260919-000001",     // Identificador único
  number: 1,                   // Número secuencial de factura
  date: "2026-09-19T14:30:00", // Fecha y hora ISO
  cashier: "Cajero 1",         // Nombre del cajero
  customer: "Ana Martínez",    // Cliente (opcional)
  items: [...],                // Array de items vendidos
  subtotal: 15000,            // Subtotal sin descuentos
  discountPct: 10,            // Porcentaje de descuento
  total: 13500,               // Total final
  paymentMethod: "efectivo",  // Medio de pago (null mientras esté pendiente)
  received: 15000,            // Efectivo recibido (si aplica)
  change: 1500,               // Cambio a devolver
  status: "completada",       // Estado: pendiente / completada / anulada
  paidAt: "...",              // Confirmación del pago (si aplica)
  pendingSince: "...",        // Desde cuándo está pendiente (si aplica)
  eInvoice: {                 // Factura electrónica (solo con pago confirmado)
    number: "FE-000001",
    issuedAt: "...",
    cuufe: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    status: "emitida"
  },
  pendingSync: false          // ¿Pendiente de sincronización?
}
```

**Flujo de facturación electrónica:**

```
Cobrar ahora (✅ Confirmar venta)  ──► status: completada + eInvoice emitida
Dejar sin cobrar (⏸ Dejar pendiente) ──► status: pendiente (stock reservado, SIN FE)
     └─ luego: 💳 Cobrar (POS / Historial) ──► status: completada + eInvoice emitida
     └─ o:    ✖️ Cancelar ──► status: anulada + stock devuelto (sin FE)
```

---

### 📈 4. Reportes

**Descripción:** Herramientas de análisis y visualización de datos.

**Tipos de reportes:**

| Reporte | Descripción |
|---------|-------------|
| **Ventas por período** | Totales de ventas en rangos de fechas |
| **Agrupación** | Por día, semana o mes |
| **Top productos** | Productos más vendidos |
| **Medios de pago** | Distribución por tipo de pago |
| **Comparativas** | Comparación con período anterior |
| **Ganancia total** | Utilidad de los productos vendidos (precio − costo) en el rango |
| **Ganancia por producto** | Unidades, ingresos, costo, utilidad y margen de cada producto |
| **Cuánto queda en base** | Ganancia − nómina pagada en el rango − deudas por pagar |

> **Cómo se calcula la ganancia:** cada venta congela el `cost` del producto en sus
> items al momento de cobrarse, así la utilidad histórica no cambia si después se
> edita el costo en el inventario. Las ventas anteriores a esta versión (o las de
> la demo) usan el costo actual del catálogo como respaldo. El descuento de la
> venta se reparte entre los items proporcionalmente, para que la utilidad por
> producto sea real.

**Opciones de exportación:**

- 📥 **CSV** — Descarga de datos para análisis en Excel u otras herramientas

---

### 📊 5. Dashboard

**Descripción:** Vista de métricas clave del negocio.

**Métricas disponibles:**

- 📊 **Semanales** — Rendimiento de la semana actual
- 📊 **Mensuales** — Resumen del mes en curso
- 📊 **Trimestrales** — Vista a mayor escala
- 🔄 **Comparación** — vs. período anterior (semana/mes/trimestre)
- 🏆 **Ganancia del período** — Utilidad (ingresos − costo de lo vendido) con su margen %

---

### 💰 6. Deudas

**Descripción:** Gestión de obligaciones financieras del negocio.

**Tipos de deudas:**

| Tipo | Descripción |
|------|-------------|
| **Por Cobrar** | Dinero que otros deben al negocio |
| **Por Pagar** | Dinero que el negocio debe a terceros |

**Funcionalidades:**

- Crear registros de deudas
- Editar montos y fechas
- 💵 **Abonos parciales** — Registra pagos parciales de una deuda del negocio *o* de una cuenta por cobrar (botón *💵 Abonar* en cada fila): monto, fecha y nota opcional
- 📊 **Progreso por deuda** — Barra de abonado con porcentaje y cuánto falta; al completar el monto la deuda pasa sola a *Pagada / Cobrada*
- 🗑️ **Quitar abonos** — Desde el mismo modal puedes borrar un abono mal digitado (y el estado se revierte)
- Eliminar registros
- **Balance neto** — Diferencia entre por cobrar y por pagar (los saldos ya descuentan los abonos)

---

### 💰 7. Apertura y cierre de caja (arqueo)

**Descripción:** Una sola caja para todo el negocio. Se abre con el efectivo inicial
y se cierra con el arqueo (dinero contado). Cada venta guarda su `sessionId`, así
que todas las ventas de la sesión entran en el mismo arqueo.

**Al cerrar la caja (modal de arqueo) se registra:**

| Campo | Para qué sirve |
|-------|----------------|
| Efectivo inicial | Dinero con el que se abrió el cajón |
| Ventas en el cajón | Solo los medios de pago físicos (lo de tarjeta/transferencia no está en el cajón) |
| **Retiros / egresos** | Entregas al patrón, pagos con dinero de la caja |
| Ingresos extra | Recargas, pago de fiado en efectivo, etc. |
| Dinero contado | Lo que realmente hay en el cajón → calcula faltante/sobrante |
| **Base para el día siguiente** | Cuánta plata se deja en el cajón para abrir mañana |

```
DEBE HABER = Efectivo inicial + Ventas en el cajón + Ingresos extra − Retiros
```

> **⚠️ "Otros medios" en $0 no significa que no hubo transferencias.** La tarjeta
> *🏦 Otros medios* suma únicamente los medios que están **fuera** del cajón. Si
> *Transferencia* o *Nequi* aparecen en $0, es que en
> *Configuración → Caja* están marcados como “entra al cajón” y por eso su plata
> se cuenta en *Efectivo en el cajón* (y termina pedindo más efectivo en el
> arqueo). Desmárcalos si ese dinero va a una cuenta o billetera. El modal y la
> pantalla de Configuración avisan cuando esa configuración no cuadra, y el
> desglose por medio de pago muestra el **total facturado** y cuánto quedó por
> fuera del cajón.

> **Base del día siguiente:** el monto que se anote **no altera el arqueo**. Solo
> dice cuánta plata queda en el cajón del resto de la que se entrega:
>
> ```
> EFECTIVO QUE SE ENTREGA = Dinero contado − Base para el día siguiente
> ```
>
> El modal trae atajos (*igual al inicial*, *dejar todo*, *sin base*) y al
> abrir la caja al día siguiente propone como efectivo inicial la base del último
> cierre, para no arrancar el día adivinando. El valor queda guardado en el
> historial de cierres y sale en el reporte imprimible y en el CSV.

**Ganancia en la caja:** el modal y la vista Caja muestran la **ganancia de los
productos vendidos en la sesión** (precio de venta − costo), con su margen, y el
detalle **producto por producto** (unidades, costo y ganancia de cada uno). Usa la
misma lógica de `utils/profit.js` que Reportes, así que el costo congelado en cada
venta manda y el descuento se reparte proporcionalmente.

El resumen (incluidos `profit`, `cost`, `nextOpeningCash` y el detalle por producto)
queda **congelado en el historial** de cierres, y también sale en el reporte
imprimible y en el CSV de cierres.

---

### 👥 8. Nómina

**Descripción:** Sistema de cálculo de pagos a empleados.

**Cómo funciona:**

```
Salario Total = Base del Período + (Ventas del Período × Porcentaje de Comisión)
```

**Periodicidad (día / semana / quincena / mes):**

La vista Nómina tiene pestañas para calcular la nómina por **Diario**, **Semanal**,
**Quincenal** o **Mensual**, con navegación ◀ Anterior / Actual / Siguiente ▶ y el
selector de fecha o mes según el período.

El salario base se guarda como **mensual**, así que en día, semana y quincena se
**prorratea** por los días que cubre el período sobre los días del mes. Sumar todos
los períodos de un mes da exactamente el salario base completo:

| Período | Fracción del mes (mes de 30 días) | Base de $1.300.000 |
|---------|----------------------------------|--------------------|
| Diario | 1/30 (3,3%) | $43.333 |
| Semanal | 7/30 (23,3%) | $303.333 |
| Quincenal | 15/30 (50%) | $650.000 |
| Mensual | 100% | $1.300.000 |

La comisión siempre es del período: se calcula sobre las ventas **completadas**
dentro del rango de fechas. En *Configuración → Nómina* se elige con qué período
arranca la vista (la pestaña siempre se puede cambiar ahí mismo).

Cada pago se guarda con una llave de período (`period`): `dia:2026-09-30`,
`semana:2026-09-28`, `quincena:2026-09-2`, `mes:2026-09`. Los pagos antiguos
(mensuales) se siguen leyendo y no se pierden.

**Configuración por usuario:**

| Campo | Descripción |
|-------|-------------|
| `baseSalary` | Salario base mensual (COP), se prorratea según el período |
| `commissionPct` | Porcentaje de comisión sobre ventas del período (%) |

**Ejemplo (mensual):**
- Salario base: $1,300,000
- Comisión: 1.5%
- Ventas del mes: $20,000,000
- **Total a pagar:** $1,300,000 + ($20,000,000 × 0.015) = **$1,600,000**

**Ejemplo (quincenal, mismo vendedor):**
- Base prorrateada: $1,300,000 × 50% = $650,000
- Ventas de la quincena: $8,000,000 → comisión $120,000
- **Total a pagar:** **$770,000**

---

### 👤 9. Usuarios

**Descripción:** Administración completa de cuentas de usuario.

**Operaciones disponibles (solo Admin):**

| Operación | Descripción |
|-----------|-------------|
| **Crear usuario** | Nuevo usuario con rol, contraseña y configuración |
| **Editar usuario** | Modificar nombre, rol, contraseña, salario, comisión |
| **Activar/Desactivar** | Habilitar o deshabilitar cuenta sin eliminar |
| **Eliminar usuario** | Borrar usuario (con validaciones de seguridad) |

**Validaciones de seguridad:**

- ❌ No se puede eliminar la propia cuenta
- ❌ No se puede eliminar el último administrador activo
- ✅ Las contraseñas se almacenan como hash (no en texto plano)

---

## Autenticación y Roles

### Sistema de Roles

La aplicación implementa dos roles con diferentes niveles de acceso:

| Rol | Acceso Completo |
|-----|-----------------|
| **👑 Administrador** | Caja, Inventario, Historial, Reportes, Dashboard, Deudas, Nómina, Usuarios |
| **🧾 Vendedor / Cajero** | Caja (facturación) y Mis ventas (solo las suyas, sin poder anular) |

### Credenciales de Demostración

| Usuario | Contraseña | Rol |
|---------|------------|-----|
| `admin` | `admin123` | Administrador |
| `cajero1` | `cajero123` | Vendedor/Cajero |
| `cajero2` | `cajero123` | Vendedor/Cajero |
| `cajero3` | `cajero123` | Vendedor/Cajero |
| `cajero4` | `cajero123` | Vendedor/Cajero |

### Flujo de Autenticación

```
1. Usuario ingresa credenciales
   └─ Username (case-insensitive)
   └─ Password

2. Validación
   └─ Buscar usuario en estado local
   └─ Verificar que esté activo
   └─ Comparar hash de contraseña

3. Sesión iniciada
   └─ ID de usuario guardado en sessionStorage
   └─ Usuario actual cargado desde contexto
   └─ Interfaz adaptada según rol
```

### Consideraciones por Rol

**Administrador:**
- ✅ Acceso a todos los módulos
- ✅ Puede anular ventas (restaura stock automáticamente)
- ✅ Puede gestionar todos los usuarios
- ✅ Puede configurar salarios y comisiones

**Vendedor/Cajero:**
- ✅ Puede facturar y operar la caja
- ✅ Ve solo sus propias ventas en el historial
- ❌ No puede anular ventas
- ❌ No tiene acceso a módulos administrativos

---

## Datos y Persistencia

### Tecnologías de Almacenamiento

| Almacenamiento | Uso | Duración |
|----------------|-----|----------|
| **IndexedDB** | Datos principales de la aplicación | Persistente (queda hasta que se borre) |
| **sessionStorage** | Sesión del usuario actual | Temporal (se mantiene en la pestaña) |
| **localStorage** (`cajita_pos_backup_v1`) | Copia del estado completo | Persistente (segunda capa local) |
| **localStorage** (`cajita_pos_sales_guard`) | **Red de seguridad de las ventas** | Persistente |

### Protección del historial de ventas

Las ventas son el dato más valioso del negocio y, al vivir en el navegador, no
se pueden recuperar si se borra el almacenamiento. Por eso la app las cuida en
cuatro puntos:

1. **Red de seguridad automática.** Cada autoguardado escribe una copia de las
   ventas en `localStorage` (`cajita_pos_sales_guard`). Si al arrancar el estado
   principal aparece *sin* ventas pero esta copia sí las tiene, se restauran
   automáticamente (cubre fallos de IndexedDB y borrados accidentales del
   almacenamiento). También se recalcula `nextInvoice` para no repetir números
   de factura.
2. **El asistente de configuración nunca destruye datos.** `completeSetup()`
   conserva ventas, inventario, deudas, nómina, cierres y la numeración; solo
   crea el usuario admin si no existe ninguno. Antes sí ponía todo en `[]`.
3. **El borrado manual es explícito.** *Zona de peligro → Borrar todos los
   datos* muestra cuántos productos y ventas se van a eliminar, avisa que no se
   puede deshacer y pide una confirmación adicional con el número exacto.
4. **Respalso manual.** El botón *💾 Descargar respaldo* exporta todo a un JSON.
   Es la única forma de llevar los datos a otro equipo o de protegerlos si se
   borra el navegador. Conviene hacerlo periódicamente.

### Estructura de Datos en IndexedDB

```
cajita-pos-db (Base de Datos)
├── state (Almacén de clave-valor)
│   └── "state" → {
│       products: [...],
│       sales: [...],
│       users: [...],
│       debts: [...],
│       payrolls: [...],
│       nextInvoice: 123
│   }
└── outbox (Almacén con keyPath: id)
    └── { id, type, payload, createdAt }
```

### Migración de Datos

La aplicación incluye migración automática desde versiones anteriores:

1. Al iniciar, busca en IndexedDB el estado actual
2. Si no existe, busca en localStorage las claves legacy:
   - `cajita_pos_state_v2`
   - `cajita_pos_data_v1`
3. Si encuentra datos legacy, los migra a IndexedDB
4. Si no hay datos, deja el estado vacío (en producción entra el asistente de
   configuración; en **desarrollo** se auto-cargan los datos de prueba, ver abajo)

### Datos de Demostración (solo desarrollo)

> ⚠️ Estos datos **solo existen en `npm run dev`**. Todo está protegido con
> `import.meta.env.DEV`, por lo que `npm run build` elimina el módulo
> `src/data/devSeed.js` del bundle: producción **nunca** los verá.

Formas de cargarlos:

1. **Automática** — `npm run dev` con la base del navegador vacía (primer arranque).
2. **Botón** — Configuración → Zona de peligro → 🧪 *Cargar datos demo*
   (permite "Agregar sin borrar" o "Reemplazar todo").
3. **Consola** — `__cargarDatosDemo()` (reemplaza todo) o
   `__cargarDatosDemo(false)` (agrega sin borrar).

**Qué crea:**

| Dato | Detalle |
|------|---------|
| Usuarios | `admin` / `admin123` + 4 cajeros (`cajero1..4` / `cajero123`) |
| Productos (18) | Despensa 🍚, Panadería 🍞, Lácteos 🥛, Bebidas 🥤, Snacks 🍟, Aseo 🧼 (2 con stock bajo) |
| Ventas | ~120 días con patrón realista (más ventas fines de semana), 3 pendientes de pago y 2 anuladas |
| Deudas | 5 registros (por cobrar / por pagar) |
| Nómina | Pago del mes anterior para cada cajero |
| Caja | 5 sesiones ya cerradas (una con faltante de arqueo) |
| Configuración | Negocio "Mi Tienda Demo" con todos los módulos activos |

Para probar el asistente de configuración inicial, borra el almacenamiento de la
app en DevTools (Application → Storage → Clear site data).

---

## Modo Offline y Sincronización

### Cómo Funciona el Offline-First

```
┌─────────────────────────────────────────────────────────────┐
│                    ESTADO DE CONEXIÓN                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🟢 EN LÍNEA                                               │
│  • Todas las operaciones se guardan localmente             │
│  • No hay operaciones pendientes                           │
│  • Sincronización no necesaria                             │
│                                                             │
│  🔴 SIN CONEXIÓN                                           │
│  • La app sigue funcionando normalmente                    │
│  • Las operaciones críticas se marcan como pendientes      │
│  • Se muestra indicador visual "Sin conexión"              │
│  • Las ventas tienen insignia ⏳ Pendiente                 │
│                                                             │
│  🔄 RECONECTANDO                                           │
│  • Al detectar conexión, se sincronizan automáticamente    │
│  • Las operaciones pendientes se envían                    │
│  • Se actualiza el estado de las ventas                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Operaciones que se Sincronizan

| Operación | Comportamiento Offline |
|-----------|----------------------|
| **Nueva venta** | Se marca como `pendingSync: true` y se agrega a outbox |
| **Nuevo producto** | Se agrega a outbox como `product_add` |
| **Actualizar producto** | Se agrega a outbox como `product_update` |
| **Eliminar producto** | Se agrega a outbox como `product_delete` |

### Flujo de Sincronización

```
1. Detectar que hay conexión (evento 'online' o navigator.onLine)

2. Recuperar todos los items del outbox
   └─ idbGet('outbox') → array de operaciones pendientes

3. Simular envío al servidor (setTimeout 700ms)
   └─ En producción, aquí iría la llamada API real

4. Procesar cada operación
   └─ Actualizar estado local (marcar ventas como sincronizadas)

5. Limpiar outbox
   └─ Eliminar operaciones ya procesadas

6. Actualizar UI
   └─ Quitar insignias de "pendiente"
   └─ Mostrar toast de confirmación
   └─ Actualizar timestamp de última sincronización
```

### Indicadores Visuales

| Indicador | Significado |
|-----------|-------------|
| **Estado en barra lateral** | En línea / Sin conexión / Sincronizando |
| **Insignia ⏳** | Venta con sincronización pendiente |
| **Toast de sincronización** | "X registro(s) sincronizado(s)" |
| **Botón de sincronización manual** | Forzar sincronización inmediata |

### Probando el Modo Offline

```
1. Ejecutar la aplicación en modo preview:
   npm run build && npm run preview

2. Abrir DevTools (F12) → Pestaña "Application" → "Service Workers"

3. Marcar la casilla "Offline"

4. Realizar una venta:
   └─ Verás el aviso "Sin conexión"
   └─ La venta se guarda localmente
   └─ Aparece insignia ⏳ en el historial

5. Desmarcar "Offline" para reconectar

6. Verificar que la venta se sincroniza automáticamente
```

---

## Instalación y Ejecución

### Requisitos Previos

- **Node.js** v18 o superior
- **npm** (viene con Node.js)

### Instalación

```bash
# 1. Clonar el repositorio (si aplica)
git clone <url-del-repositorio>
cd cajita_faturadora

# 2. Instalar dependencias
npm install
```

### Comandos Disponibles

| Comando | Descripción | Cuándo usarlo |
|---------|-------------|---------------|
| `npm run dev` | Inicia servidor de desarrollo con HMR | Durante desarrollo |
| `npm run build` | Compila la aplicación para producción | Antes de desplegar |
| `npm run preview` | Previsualiza el build de producción | Para probar PWA y offline |

### Flujos de Trabajo

#### Desarrollo Local

```bash
npm run dev
# Desarrollo: http://localhost:5173 (no usar en producción)
# Producción: https://tu-cajita-facturadora.vercel.app/
# El servidor se recarga automáticamente al guardar cambios
```

> **Nota:** En desarrollo, el service worker no está activo para no interferir con HMR (Hot Module Replacement).

#### Producción / PWA

```bash
npm run build && npm run preview
# Abre la URL mostrada (usualmente http://localhost:4173)
# Aquí la PWA está activa y funciona el modo offline
```

#### Instalar como PWA

1. Abre la aplicación en Chrome/Edge
2. Haz clic en el botón **📲 Instalar app** en la barra lateral
   - O busca el icono de instalación en la barra de direcciones del navegador
3. La app se abrirá en ventana propia y funcionará sin conexión

---

## Estructura del Proyecto

```
cajita_faturadora/
├── public/                      # Recursos estáticos
│   ├── favicon.svg              # Icono del navegador
│   ├── icons.svg                # Iconos de la app
│   ├── manifest.webmanifest    # Configuración de PWA
│   ├── sw.js                    # Service Worker (offline)
│   └── icons/                   # Iconos de diferentes tamaños
│
├── src/                         # Código fuente
│   ├── main.jsx                 # Punto de entrada (React)
│   ├── App.jsx                  # Componente raíz
│   ├── index.css                # Estilos globales
│   │
│   ├── components/              # Componentes UI reutilizables
│   │   ├── Sidebar.jsx          # Navegación principal
│   │   ├── Modal.jsx            # Ventanas emergentes
│   │   ├── Toast.jsx            # Notificaciones
│   │   ├── BarChart.jsx         # Gráficos simples
│   │   ├── Pagination.jsx       # Paginación
│   │   └── MobileTopbar.jsx     # Barra para móviles
│   │
│   ├── context/                 # Contextos de React
│   │   └── StoreContext.jsx     # Estado global + lógica de negocio
│   │
│   ├── data/                    # Datos iniciales
│   │   └── seed.js              # Productos y usuarios demo
│   │
│   ├── db/                      # Capa de base de datos
│   │   └── db.js                # IndexedDB + outbox (sincronización)
│   │
│   ├── hooks/                   # Custom hooks
│   │   └── useDebounce.js       # Debounce para inputs
│   │
│   ├── utils/                   # Utilidades
│   │   ├── format.js            # Formato de dinero, fechas, CSV
│   │   ├── profit.js            # Ganancia: costo vs. precio de lo vendido
│   │   ├── payroll.js           # Períodos de nómina (día/semana/quincena/mes)
│   │   └── auth.js              # Hash de contraseñas, roles
│   │
│   └── views/                   # Vistas / Módulos principales
│       ├── LoginView.jsx        # Pantalla de login
│       ├── POSView.jsx          # Punto de venta
│       ├── InventoryView.jsx    # Inventario
│       ├── SalesView.jsx        # Historial de ventas
│       ├── ReportsView.jsx      # Reportes
│       ├── DashboardView.jsx    # Dashboard
│       ├── UsersView.jsx        # Usuarios
│       ├── DebtView.jsx         # Deudas
│       └── PayrollView.jsx      # Nómina
│
├── index.html                   # HTML principal
├── package.json                 # Dependencias y scripts
├── vite.config.js               # Configuración de Vite
├── eslint.config.js             # Configuración de ESLint
└── .gitignore                   # Archivos ignorados por git
```

---

## Personalización

### Configuración de la Tienda

Editar `src/utils/format.js`:

```javascript
// ===== Configuración global del negocio =====
export const STORE_NAME = 'Mi Tienda'
export const STORE_ADDRESS = 'Cra 10 # 20-30, Local 4'
export const STORE_PHONE = '300 000 0000'

export const CURRENCY_CODE = 'COP'      // Código de moneda ISO
export const LOCALE = 'es-CO'           // Configuración regional

export const PAYMENT_METHODS = [
  { id: 'efectivo', label: '💵 Efectivo' },
  { id: 'tarjeta', label: '💳 Tarjeta' },
  { id: 'transferencia', label: '🏦 Transferencia' },
  { id: 'nequi', label: '📱 Nequi / Daviplata' },
]
```

### Agregar Productos Iniciales

Editar `src/data/seed.js`:

```javascript
const BASE_PRODUCTS = [
  {
    id: 'p01',
    code: 'P-001',
    name: 'Nombre del Producto',
    emoji: '🏷️',
    category: 'Categoría',
    price: 10000,
    cost: 7000,
    minStock: 10,
    baseStock: 50
  },
  // ... más productos
]
```

### Agregar Usuarios Iniciales

Editar `src/data/seed.js`, función `getSeedUsers()`:

```javascript
export function getSeedUsers() {
  return [
    {
      id: 'u-admin',
      username: 'admin',
      name: 'Administrador',
      role: 'admin',           // 'admin' o 'vendedor'
      passwordHash: hashPassword('contraseña'),
      active: true,
      baseSalary: 0,           // Solo para vendedores
      commissionPct: 0,        // Porcentaje de comisión
      createdAt: '2026-01-01',
    },
  ]
}
```

### Cambios en la UI

Los estilos están en `src/index.css`. Puedes modificar:

- Colores y temas
- Tipografías
- Espaciados y layout
- Componentes visuales

**Modales:** ocupan toda la pantalla en móvil (`height: 100dvh`) con cabecera fija arriba,
botones abajo y solo el contenido deslizable; en escritorio (≥768px) se convierten en un
diálogo centrado con anchos por tamaño: `sm` 480px, `md` 780px, `lg` 1040px, `xl` 1280px.

---

## Guía para Desarrolladores

### Principios de Modificación

#### ✅ Seguro de modificar

- Cambiar estilos y temas visuales
- Modificar textos y labels
- Ajustar formularios y validaciones de UI
- Agregar nuevas vistas que consuman datos existentes
- Crear componentes reutilizables

#### ⚠️ Modificar con cuidado

- **Esquema de datos:** Cambios en cómo se guardan los datos pueden causar pérdida o duplicación
- **Sesión y autenticación:** Alterar el flujo de login puede bloquear el acceso
- **Sincronización:** Cambios en el outbox pueden causar operaciones huérfanas
- **Formatos financieros:** Afecta a todo el sistema de moneda

### Flujo Recomendado para Extender la App

```
1. Crear vista o componente nuevo
   └─ En src/views/ o src/components/

2. Consumir datos existentes del contexto
   └─ import { useStore } from '../context/StoreContext.jsx'
   └─ Usar los datos que ya están disponibles

3. Si es necesario, agregar funciones al contexto
   └─ En StoreContext.jsx, agregar la función necesaria
   └─ Exponerla en el value del contexto

4. Si toca datos críticos, considerar sincronización
   └─ Usar pushOutbox() para operaciones que deben sincronizarse
   └─ Verificar comportamiento online y offline
```

### Patrones Comunes

#### Consumir el Contexto

```javascript
import { useStore } from '../context/StoreContext.jsx'

function MiComponente() {
  const {
    products,        // Array de productos
    sales,          // Array de ventas
    users,          // Array de usuarios
    currentUser,    // Usuario logueado
    isOnline,       // Estado de conexión
    addSale,        // Función para crear venta
    showToast,      // Mostrar notificación
    // ... más funciones disponibles
  } = useStore()

  // Usar los datos y funciones
}
```

#### Crear una Operación con Sincronización

```javascript
const miOperacion = (data) => {
  // 1. Actualizar estado local inmediatamente
  setState((prev) => ({
    ...prev,
    // ... transformar datos
  }))

  // 2. Si está offline, agregar a outbox
  if (!isOnline) {
    pushOutbox('mi_operacion', { payload: data })
  }

  // 3. Mostrar feedback al usuario
  showToast('Operación realizada')
}
```

#### Formato de Dinero

```javascript
import { formatMoney, compactMoney } from '../utils/format.js'

formatMoney(15000)        // "$15.000"
compactMoney(1500000)    // "$1.5M"
```

#### Formato de Fechas

```javascript
import { fmtDate, fmtHour, fmtDateTime } from '../utils/format.js'

fmtDate(new Date())       // "19/09/2026"
fmtHour(new Date())       // "14:30"
fmtDateTime(new Date())   // "19/09/2026 14:30"
```

---

## Flujos de Trabajo Comunes

### Flujo 1: Primera Configuración

```
1. Instalar la aplicación
   └─ npm install

2. Ejecutar en desarrollo
   └─ npm run dev

3. Iniciar sesión como admin
   └─ Usuario: admin
   └─ Contraseña: admin123

4. Configurar la tienda
   └─ Editar src/utils/format.js con nombre, dirección, teléfono

5. Personalizar productos
   └─ Editar src/data/seed.js con productos reales
   └─ O usar el módulo de inventario para agregar manualmente

6. Configurar usuarios
   └─ Crear cuentas para cada cajero
   └─ Asignar salarios y comisiones

7. Compilar para producción
   └─ npm run build && npm run preview
```

### Flujo 2: Operación Diaria

```
1. Abrir la aplicación
   └─ Si está instalada como PWA, abrir desde el icono

2. Iniciar sesión
   └─ Ingresar credenciales

3. Realizar ventas
   └─ Buscar productos
   └─ Agregar al carrito
   └─ Aplicar descuentos si es necesario
   └─ Cobrar y entregar ticket

4. Al final del día
   └─ Revisar historial de ventas
   └─ Verificar stock de productos críticos
   └─ Generar reportes si es necesario
```

### Flujo 3: Gestión de Inventario

```
1. Ir al módulo de Inventario

2. Para agregar producto:
   └─ Click en "Agregar Producto"
   └─ Completar todos los campos
   └─ Guardar

3. Para ajustar stock:
   └─ Editar producto existente
   └─ Modificar el campo stock
   └─ Guardar

4. Revisar alertas:
   └─ Productos con stock ≤ minStock aparecen marcados
   └─ Tomar acción: reordenar o ajustar minStock
```

### Flujo 4: Cierre de Mes

```
1. Generar reportes del mes
   └─ Ventas totales
   └─ Top productos
   └─ Distribución por medio de pago

2. Calcular nómina
   └─ Ir a módulo de Nómina
   └─ El sistema calcula automáticamente:
      • Salario base × número de empleados
      • Comisión por ventas de cada empleado

3. Revisar deudas
   └─ Por cobrar: seguir up con clientes
   └─ Por pagar: programar pagos

4. Exportar datos si es necesario
   └─ Descargar CSV para contabilidad externa
```

---

## Consideraciones de Seguridad

### Contraseñas

- Las contraseñas se almacenan como **hash** (no en texto plano)
- El algoritmo usado es djb2 (hash simple no reversible)
- Para producción real, se recomienda un algoritmo más robusto (bcrypt, argon2)

### Validaciones de Seguridad

| Validación | Descripción |
|------------|-------------|
| **Último admin** | No se puede eliminar el último administrador activo |
| **Auto-eliminación** | No se puede eliminar la propia cuenta |
| **Usuario inactivo** | Los usuarios inactivos no pueden iniciar sesión |
| **Case-insensitive** | El username se compara sin distinguir mayúsculas |

### Limitaciones

- **Sin encriptación de datos en reposo:** Los datos en IndexedDB no están encriptados
- **Sin autenticación de servidor:** No hay validación de servidor; todo es local
- **Sin backup automático:** Los datos dependen del navegador y dispositivo

> ⚠️ **Para uso en producción real**, considerar:
> - Implementar backend con autenticación real
> - Encriptar datos sensibles
> - Implementar backups periódicos
> - Usar HTTPS siempre

---

## Solución de Problemas

### Problemas Comunes

| Problema | Solución |
|----------|----------|
| **No se guardan los datos** | Verificar que IndexedDB esté disponible en el navegador |
| **No aparece el botón de instalar PWA** | Usar Chrome/Edge en HTTPS o localhost |
| **Los datos se resetearon** | Revisar si se borró el almacenamiento local del navegador |
| **No se sincronizan las ventas** | Verificar conexión a internet; forzar sincronización manual |
| **Error al iniciar** | Limpiar caché del navegador y reconstruir: `npm run build` |

### Resetear Datos de Demostración

Solo en desarrollo: en Configuración → Zona de peligro → 🧪 *Cargar datos demo*, o
desde la consola del navegador con `__cargarDatosDemo()` (reemplaza todo) /
`__cargarDatosDemo(false)` (agrega sin borrar). En producción ese botón y la
función no existen.

---

## Tecnologías Utilizadas

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| **React** | 18+ | Framework UI |
| **Vite** | 5+ | Build tool y dev server |
| **IndexedDB** | Nativo del navegador | Base de datos local |
| **Service Workers** | Nativo del navegador | Offline y PWA |
| **Web App Manifest** | Estándar W3C | Instalación como PWA |

---

## Licencia

Este proyecto es de código abierto. Consultar el archivo de licencia para más detalles.

---

## Contacto y Soporte

Para preguntas, sugerencias o reportes de problemas:

1. Revisar la documentación de este README
2. Examinar el código fuente en `src/`
3. Consultar los comentarios en el código para contexto adicional

---

*Documentación generada para Cajita POS v1.0*