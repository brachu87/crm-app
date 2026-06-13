# Deploy en Railway — Guía paso a paso

## Requisitos previos
- Tener una cuenta en [GitHub](https://github.com)
- Tener una cuenta en [Railway](https://railway.app) (podés entrar con tu cuenta de GitHub)

---

## PASO 1 — Subir el código a GitHub

1. Doble click en `subir-a-github.bat`
2. Seguir las instrucciones en pantalla
3. Crear el repositorio en github.com/new cuando se pida

---

## PASO 2 — Crear el proyecto en Railway

1. Ir a [railway.app](https://railway.app) → **New Project**
2. Elegir **Deploy from GitHub repo**
3. Seleccionar el repo `crm-app`
4. Railway detecta automáticamente el `nixpacks.toml` y empieza a buildear

---

## PASO 3 — Crear el volumen para la base de datos

La base de datos SQLite necesita un lugar permanente para guardar los datos:

1. En tu proyecto Railway, click en **Add Service → Volume**
2. Montar el volumen en: `/data`
3. Asociarlo al servicio del CRM

---

## PASO 4 — Configurar las variables de entorno

En Railway, ir a tu servicio → pestaña **Variables** → agregar:

| Variable | Valor |
|----------|-------|
| `DATABASE_URL` | `file:/data/prod.db` |
| `JWT_SECRET` | (inventar una cadena larga y random, ej: `mi-crm-secreto-2024-xyz-abc-123`) |

Railway setea `PORT` automáticamente, no hace falta agregarlo.

---

## PASO 5 — Obtener la URL pública

1. En Railway, ir a tu servicio → pestaña **Settings**
2. En la sección **Domains**, click en **Generate Domain**
3. Te da una URL tipo `https://crm-app-production.up.railway.app`
4. ¡Esa URL funciona desde cualquier celular o navegador!

---

## Actualizar el CRM después de hacer cambios

Cada vez que hacés cambios en el código y querés que se reflejen en la nube:

```
cd C:\crm-app
git add .
git commit -m "descripcion del cambio"
git push
```

Railway detecta el push y redeploya automáticamente.

---

## Notas importantes

- **Backup**: Los datos están en el volumen de Railway. Hacé backups periódicos descargando el archivo `prod.db` desde la consola de Railway.
- **Local vs Nube**: Tu versión local sigue funcionando igual con `iniciar-crm.bat`. Son bases de datos separadas.
- **Costo**: Railway tiene un plan gratuito con $5 de crédito mensual. Para un CRM pequeño suele alcanzar o costar muy poco.
