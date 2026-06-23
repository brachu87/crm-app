# Informe de verificación — Zentric (CRM)

**App:** https://crm-app-production-0669.up.railway.app/
**Repo:** github.com/brachu87/crm-app · **Fecha:** 23/06/2026
**Alcance:** funcional · arquitectura · UX/UI · seguridad básica

---

## 0. Hallazgo previo: tu carpeta local está desactualizada

La carpeta local `C:\crm-app` es una **versión vieja y mínima** (commit inicial, ~13 archivos de rutas). Lo que realmente está **desplegado en Railway es `origin/main` de GitHub** (commit `c51eaef`), que es mucho más grande: ~27 módulos de rutas, 22 modelos de datos y unas 19.000 líneas adicionales (WhatsApp, facturación, nómina, turnos, etc.).

Además, tu carpeta local tiene **cambios sin commitear** sobre esa versión vieja. **Recomendación:** trabajá siempre sobre la versión de GitHub (`git pull`) y no sobre la carpeta local actual, o vas a pisar/perder trabajo. Este informe se basa en la versión real desplegada (GitHub).

---

## 1. Arquitectura

Monolito Node desplegado en Railway (nixpacks). El backend Express sirve también el frontend ya compilado en producción.

| Capa | Tecnología |
|------|-----------|
| Backend | Node ≥18, Express 5, Prisma ORM |
| Base de datos | SQLite (archivo en volumen `/data`) |
| Frontend | React 19, Vite, React Router 7, Axios |
| Auth | JWT (expira 8h) + bcrypt; roles owner/staff + permisos granulares (JSON) |
| Integraciones | MercadoPago (cobros/suscripción), WhatsApp (Baileys + Meta), email (nodemailer/resend), Google OAuth, cron de recordatorios |

**Modelo de negocio (SaaS):** prueba gratuita, suscripción mensual vía MercadoPago ($75.000 ARS), panel de administración propio en `/admin`, y bloqueo automático de cuentas vencidas.

**Multi-tenant:** cada negocio (`Business`) aísla sus datos por `businessId`, presente en el token JWT y aplicado consistentemente en las consultas.

**Funciona correctamente:** probé la app en vivo (sesión activa). Dashboard con métricas reales, gráficos de flujo financiero y estado de inscripciones, lista de clientes con saldos y acciones, importación/exportación CSV, búsqueda y navegación — todo renderiza bien.

---

## 2. Seguridad — lo que está bien

El backend está notablemente bien endurecido para un proyecto de este tipo:

- **Helmet** + `x-powered-by` deshabilitado.
- **Rate limiting** en tres niveles: global (300/15min), login/registro (20/15min) y subida de archivos (20/hora).
- **CORS con allowlist** (no abierto a cualquier origen).
- **Contraseñas con bcrypt**, mínimo 8 caracteres, validación de email y sanitización de inputs.
- **JWT_SECRET validado** (si falta, el server responde error en vez de firmar con `undefined`).
- **Aislamiento multi-tenant consistente**, incluido el endpoint de fotos (sanea path traversal, filtra mime, límite 5 MB) y la búsqueda.
- **SQL parametrizado** en todas las queries crudas — no hay inyección SQL.
- **Webhook de MercadoPago verifica firma HMAC**.
- **Panel admin** protegido por `ADMIN_SECRET` (con largo mínimo y retardo anti fuerza bruta).
- `.env` correctamente excluido de git.

---

## 3. Seguridad — a corregir (prioridad)

**🟠 Media — Token JWT en la URL.** Las imágenes (fotos de clientes y logo) piden el token como query string: `/api/clients/:id/photo?token=eyJ...`. Los tokens en la URL quedan en logs de servidor, proxies e historial del navegador. *Sugerencia:* servir las imágenes con cookie httpOnly o tokens de un solo uso de vida corta para recursos.

**🟠 Media — Webhook de pago "fail-open".** La verificación de firma del webhook de MercadoPago solo corre si `MP_WEBHOOK_SECRET` está configurada. Si no lo está, cualquiera podría hacer un POST falso a `/api/billing/webhook` y activar una suscripción. *Acción:* verificá que `MP_WEBHOOK_SECRET` esté seteada en Railway.

**🟡 Media-baja — CSP deshabilitada.** Helmet corre con `contentSecurityPolicy: false` (porque la app usa scripts/estilos inline). Esto reduce la protección contra XSS. Sumado a que el JWT se guarda en `localStorage` (accesible por JS), un XSS permitiría robar la sesión. *Sugerencia:* mover a estilos/scripts externos y habilitar una CSP.

**🟡 Baja — `subscriptionCheck` falla abierto.** Ante un error de base de datos, deja pasar al usuario (decisión intencional para no bloquear, pero conviene tenerlo presente).

---

## 4. Funcionamiento — bugs e inconsistencias

**🟠 WhatsApp es una conexión global, no por negocio.** El cliente Baileys es un *singleton* a nivel de todo el servidor (`let sock` en `whatsappBaileys.js`). Es decir, **toda la plataforma comparte una sola sesión/número de WhatsApp**, no una por cada negocio. Para un SaaS multi-tenant esto es una limitación importante: los recordatorios de todos los negocios saldrían del mismo número, y solo un negocio puede estar "conectado" a la vez. *Requiere rediseño* si se quiere WhatsApp por cliente.

**🟡 Fotos de clientes dan 401 en el listado.** En `Clients.jsx` la miniatura se pide sin token (`/api/clients/:id/photo`), entonces devuelve 401 (16 requests fallidos por carga). En `ClientDetail.jsx` sí se incluye el token y funciona. No es visible para el usuario (cae en avatar con inicial), pero son requests innecesarios e inconsistentes. *Fix simple:* agregar `?token=` en `Clients.jsx` igual que en `ClientDetail.jsx`.

**🟡 Período de prueba inconsistente.** Conviven 14 días (`admin.js`, flujo de login) y 15 días (`index.js` barrido de trials, `billing.js`). Unificar a un solo valor.

**🟢 Detalles de UI.** Formato de números inconsistente en el dashboard (los gastos muestran centavos, los ingresos no); el donut de inscripciones suma 101% por redondeo.

**🟡 Migraciones frágiles.** En el arranque se ejecutan ~10 funciones `ensureXColumn()` con `ALTER TABLE` crudo en vez de migraciones formales de Prisma. Funciona, pero es propenso a errores y difícil de auditar el estado real del esquema.

---

## 5. Escalabilidad

- **SQLite** es un archivo único: limita la concurrencia y el crecimiento. Para un SaaS con varios negocios activos conviene migrar a **PostgreSQL** (el propio README lo sugiere). Prisma facilita el cambio.
- **Proceso único** que mezcla API + cron + WhatsApp + archivos. Funciona para pocos clientes; a futuro conviene separar los jobs (cron/WhatsApp) del servidor web.
- **Backups manuales** del volumen — conviene automatizarlos.

---

## 6. Prioridades recomendadas

1. Confirmar `MP_WEBHOOK_SECRET` en Railway (riesgo de activación de pagos falsos).
2. Sincronizar tu carpeta local con GitHub para no perder/pisar trabajo.
3. Sacar el token JWT de las URLs de imágenes.
4. Rediseñar WhatsApp para que sea por negocio (si es un objetivo del producto).
5. Unificar el período de prueba (14 vs 15 días) y arreglar el `?token=` de las fotos en el listado.
6. Planificar la migración a PostgreSQL antes de escalar.

**Veredicto general:** la app está bien construida, funciona y tiene una base de seguridad sólida y poco común para un proyecto de este tamaño. Los puntos críticos son el webhook fail-open, la conexión única de WhatsApp y la elección de SQLite de cara al crecimiento.
