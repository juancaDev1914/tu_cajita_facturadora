# 🛒 Cajita POS — Sistema de Punto de Venta

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
  paymentMethod: "efectivo",  // Medio de pago
  received: 15000,            // Efectivo recibido (si aplica)
  change: 1500,               // Cambio a devolver
  status: "completada",       // Estado: completada / anulada
  pendingSync: false          // ¿Pendiente de sincronización?
}
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
- Eliminar registros
- **Balance neto** — Diferencia entre por cobrar y por pagar

---

### 👥 7. Nómina

**Descripción:** Sistema de cálculo de pagos a empleados.

**Cómo funciona:**

```
Salario Total = Salario Base + (Ventas del Mes × Porcentaje de Comisión)
```

**Configuración por usuario:**

| Campo | Descripción |
|-------|-------------|
| `baseSalary` | Salario base mensual (COP) |
| `commissionPct` | Porcentaje de comisión sobre ventas (%) |

**Ejemplo:**
- Salario base: $1,300,000
- Comisión: 1.5%
- Ventas del mes: $20,000,000
- **Total a pagar:** $1,300,000 + ($20,000,000 × 0.015) = **$1,600,000**

---

### 👤 8. Usuarios

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
| **localStorage** | Migración desde versiones anteriores | Persistente (usado solo para migración) |

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
4. Si no hay datos, inicializa con datos de demostración

### Datos de Demostración

Al primera ejecución, la aplicación crea automáticamente:

**Productos iniciales (18 productos):**

| Categoría | Ejemplos |
|-----------|----------|
| Despensa | Arroz, Pasta, Aceite, Lentejas, Azúcar, Café |
| Panadería | Pan Tajado Blanco |
| Lácteos & Refrigerados | Huevos AA, Queso Campesino, Yogurt |
| Bebidas | Gaseosa, Agua, Jugo, Cerveza |
| Snacks | Papas Fritas, Chocorramo |
| Aseo | Detergente, Jabón |

**Ventas generadas:** ~120 días de ventas históricas con patrón realista (más ventas fines de semana).

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
# Abre http://localhost:5173 en tu navegador
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

Desde el código, existe la función `resetDemo()` en StoreContext que restaura los productos y ventas iniciales.

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