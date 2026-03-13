# Gastos Tarjeta

Aplicación personal para el seguimiento de gastos con tarjetas de crédito. Permite registrar compras en cuotas, visualizar el impacto mensual por tarjeta, proyectar gastos futuros, gestionar el flujo de caja y hacer backup de los datos.

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19 + Vite + Tailwind CSS v4 |
| Backend | Go + Chi router |
| Base de datos | PostgreSQL |
| Auth | JWT (HS256, 7 días) |
| Deploy backend | Render |
| Deploy frontend | Vercel |

---

## Estructura del proyecto

```
gastos-tarjeta/
├── backend/
│   ├── cmd/
│   │   ├── server/          # Servidor HTTP principal
│   │   └── migrate-csv/     # Script de importación desde CSV
│   ├── internal/
│   │   ├── db/              # Conexión a PostgreSQL (pgx)
│   │   ├── handlers/        # Handlers HTTP por dominio
│   │   ├── middleware/      # Middleware de autenticación JWT
│   │   └── models/          # Structs compartidos
│   ├── migrations/          # Scripts SQL de migración
│   ├── .env                 # Variables de entorno locales (no commitear)
│   ├── .env.example         # Plantilla de variables de entorno
│   └── go.mod
├── frontend/
│   ├── src/
│   │   ├── api/             # Cliente HTTP centralizado
│   │   ├── context/         # AuthContext (JWT en memoria)
│   │   ├── pages/           # Páginas principales
│   │   ├── components/      # Componentes reutilizables
│   │   └── hooks/           # Custom hooks
│   ├── .env.local           # Variables de entorno locales (no commitear)
│   ├── .env.example         # Plantilla de variables de entorno
│   └── vercel.json
└── render.yaml              # Configuración de deploy en Render
```

---

## Requisitos previos

- **Go** 1.21+
- **Node.js** 18+ y **npm**
- **PostgreSQL** 14+

---

## Configuración local

### 1. Clonar el repositorio

```bash
git clone https://github.com/Ren14/gastos-tarjeta.git
cd gastos-tarjeta
```

### 2. Base de datos

Crear la base de datos en PostgreSQL:

```sql
CREATE DATABASE gastos_tarjeta;
```

Ejecutar las migraciones en orden:

```bash
psql -d gastos_tarjeta -f backend/migrations/003_cashflow.sql
psql -d gastos_tarjeta -f backend/migrations/004_expense_color.sql
psql -d gastos_tarjeta -f backend/migrations/005_cashflow_entry_color.sql
```

> Las migraciones 001 y 002 crean las tablas base (cards, categories, expenses, etc.). Si la base está vacía, asegurate de tener el schema inicial antes de aplicar estas migraciones.

### 3. Variables de entorno — Backend

Copiar la plantilla y completar los valores:

```bash
cp backend/.env.example backend/.env
```

Editar `backend/.env`:

```env
DATABASE_URL=postgres://postgres:tu_password@localhost:5432/gastos_tarjeta?sslmode=disable
PORT=8080
AUTH_USERNAME=admin
AUTH_PASSWORD=tu_password_seguro
JWT_SECRET=tu_clave_secreta_larga_y_aleatoria
```

### 4. Variables de entorno — Frontend

Copiar la plantilla y completar los valores:

```bash
cp frontend/.env.example frontend/.env.local
```

Editar `frontend/.env.local`:

```env
VITE_API_URL=http://localhost:8080/api/v1
```

---

## Ejecutar en desarrollo

### Backend

```bash
cd backend
go mod download
go run ./cmd/server
```

El servidor queda escuchando en `http://localhost:8080`.

### Frontend

En otra terminal:

```bash
cd frontend
npm install
npm run dev
```

La app queda disponible en `http://localhost:5173`.

---

## Compilar para producción

### Backend

```bash
cd backend
go build -o server ./cmd/server
./server
```

### Frontend

```bash
cd frontend
npm run build
# Los archivos estáticos quedan en frontend/dist/
```

---

## Autenticación

La app requiere login al acceder. Las credenciales se configuran con las variables `AUTH_USERNAME` y `AUTH_PASSWORD` en el backend.

- El token JWT dura **7 días**
- Se almacena en memoria (se pierde al refrescar la página — comportamiento esperado para uso personal)
- Cualquier request con token inválido o expirado redirige automáticamente al login

---

## API — Endpoints principales

Todos los endpoints requieren el header `Authorization: Bearer <token>`, excepto el login.

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/v1/auth/login` | Login — retorna JWT |
| `GET` | `/api/v1/expenses` | Listar gastos |
| `POST` | `/api/v1/expenses` | Crear gasto |
| `PUT` | `/api/v1/expenses/{id}` | Actualizar gasto |
| `DELETE` | `/api/v1/expenses/{id}` | Eliminar gasto |
| `GET` | `/api/v1/summary/monthly` | Resumen mensual |
| `GET` | `/api/v1/summary/projection` | Proyección próximos meses |
| `GET` | `/api/v1/cashflow/card-totals` | Totales por tarjeta (Flujo) |
| `POST` | `/api/v1/admin/export-db` | Exportar backup SQL |
| `POST` | `/api/v1/admin/import-db` | Restaurar desde backup SQL |
| `POST` | `/api/v1/admin/truncate-db` | Vaciar todas las tablas |

---

## Importar gastos desde CSV

El script `migrate-csv` permite importar gastos desde un archivo CSV de resumen de tarjeta.

### Formato del CSV

| Columna | Contenido |
|---------|-----------|
| A | Fecha de compra (`DD/MM`) |
| B | Detalle / comercio |
| C | Nombre de la tarjeta |
| D en adelante | Cuotas mensuales (abril, mayo, junio…) |

Las fechas sin año se infieren así: meses 1–9 → año 2026, meses 10–12 → 2025.

### Uso

```bash
cd backend

# Vista previa sin escribir nada
go run ./cmd/migrate-csv --dry-run /ruta/al/archivo.csv

# Importar definitivamente
go run ./cmd/migrate-csv /ruta/al/archivo.csv
```

El script hace fuzzy matching de nombres de tarjetas. Si no encuentra coincidencia, crea la tarjeta automáticamente en la base de datos.

En el path `db/bkp/` existe un archivo que se puede importar para tener data real y comprobar la funcionalidad. 
---

## Deploy

### Backend — Render

El archivo `render.yaml` en la raíz configura el deploy automático.

Variables de entorno a configurar en el dashboard de Render:

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | Connection string de PostgreSQL |
| `PORT` | Puerto (Render lo inyecta automáticamente) |
| `AUTH_USERNAME` | Usuario para el login |
| `AUTH_PASSWORD` | Contraseña para el login |
| `JWT_SECRET` | Clave secreta para firmar tokens JWT |

### Frontend — Vercel

Conectar el repositorio en Vercel. La configuración en `frontend/vercel.json` ya define el build command y output directory.

Variable de entorno a configurar en el dashboard de Vercel:

| Variable | Valor |
|----------|-------|
| `VITE_API_URL` | URL pública del backend en Render (ej: `https://gastos-tarjeta-api.onrender.com/api/v1`) |

---

## Funcionalidades

- **Resumen mensual**: vista matricial de gastos por tarjeta, cuotas proyectadas, impacto real vs estimado
- **Proyección**: próximos 6 meses con estimación de gastos recurrentes
- **Flujo de caja**: ingresos y egresos mensuales con categorías configurables
- **Tarjetas recurrentes**: suscripciones en USD con conversión automática al tipo de cambio vigente
- **Cotización USD**: historial de tipo de cambio para conversión de gastos en dólares
- **Backup**: exportar e importar la base de datos completa en formato SQL
- **Importación CSV**: migrar resúmenes de tarjeta desde archivos CSV
