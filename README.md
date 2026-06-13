# CRM Multi-tenant — Gestión de clientes y actividades

App para gestionar clientes, actividades (clases, turnos, servicios) e
inscripciones con estado de pago. Pensada para gimnasios, centros estéticos
y emprendimientos similares.

## Requisitos

- Node.js 18 o superior (https://nodejs.org)

## 1. Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

Esto crea la base de datos SQLite (`backend/prisma/dev.db`) y levanta el
servidor en `http://localhost:4000`.

## 2. Frontend

En otra terminal:

```bash
cd frontend
npm install
npm run dev
```

Te va a dar una URL tipo `http://localhost:5173`. Abrila en el navegador.

## 3. Primer uso

1. Entrá a `http://localhost:5173`
2. Click en "Crear cuenta"
3. Completá los datos de tu negocio (nombre, tipo, tu usuario)
4. Ya podés crear actividades, clientes, e inscribirlos con su estado de pago

## Notas

- `backend/.env` tiene `JWT_SECRET` — cambialo por algo aleatorio antes de
  usar esto en producción.
- La base de datos es SQLite (un archivo local). Para producción conviene
  migrar a PostgreSQL: solo hay que cambiar `provider` y `DATABASE_URL` en
  `backend/prisma/schema.prisma`.
- Para resetear todos los datos: borrá `backend/prisma/dev.db` y corré de
  nuevo `npx prisma migrate dev`.

## Estructura

```
backend/
  src/
    routes/        endpoints: auth, clients, activities, enrollments, dashboard
    middleware/     autenticación JWT + aislamiento por negocio (multi-tenant)
    prisma.js       cliente de base de datos
  prisma/schema.prisma  modelo de datos

frontend/
  src/
    pages/          pantallas: login, registro, dashboard, actividades, clientes, cobranza
    components/      layout con sidebar
    context/         sesión / autenticación
    api/             cliente HTTP (axios)
```
