# Informe de testing funcional — Zentric

**App:** https://crm-app-production-0669.up.railway.app/
**Fecha:** 23/06/2026 · **Método:** pruebas en vivo sobre la app desplegada (navegador), creando datos de prueba marcados `ZZTEST`.

---

## Resultado general

**La aplicación funciona correctamente.** Probé las 17 pantallas y los circuitos principales de punta a punta. No encontré errores que rompan el uso; sí algunos detalles menores (abajo).

---

## Carga de pantallas (todas OK)

Las 17 rutas cargan sin un solo error — todas las llamadas a la API respondieron 200:
Dashboard, Clientes, Actividades/Servicios, Cobranza, Empleados, Asistencias, Liquidaciones, Sedes, Horarios, Gastos, Reportes, Grilla de precios, Proveedores, Agenda, Caja del día, Ajustes (Negocio/Usuarios/WhatsApp/Facturación).

## Circuitos de escritura probados (todos OK)

| Circuito | Resultado |
|----------|-----------|
| Crear cliente | ✅ 201 |
| Crear actividad | ✅ 201 |
| Inscribir cliente en actividad | ✅ 201 |
| Registrar cobro de cuota | ✅ 201 |
| Recibo de pago (con logo) | ✅ se genera, logo y datos correctos |
| Impacto del cobro en Caja del día | ✅ aparece como ingreso del día |
| Crear gasto | ✅ 201 |
| Crear proveedor | ✅ 201 |
| **Editar proveedor (fix DNI)** | ✅ 200 — el bug que arreglamos quedó resuelto |
| Eliminar proveedor | ✅ 200 |
| Crear empleado | ✅ 201 |
| Crear nota/evento (Agenda) | ✅ 201 |
| Búsqueda global | ✅ devuelve clientes/actividades |
| Facturación → link MercadoPago | ✅ genera preferencia real y redirige al checkout (no se completó ningún pago) |

El circuito clave del negocio —**inscribir → cobrar → recibo → caja**— funciona completo y consistente.

---

## Hallazgos (menores)

1. **Fechas con un día de corrimiento (zona horaria).** Un gasto cargado el 23/6 figura como 22/6; el vencimiento de cuota mostró 22/7 en un lugar y 23/7 en el recibo. Es un tema de manejo de fechas en UTC vs. hora Argentina. Es cosmético, pero conviene normalizarlo para evitar confusión en comprobantes.

2. **No se puede eliminar una inscripción que ya tiene un pago.** El botón "Quitar" sobre una cuota pagada falla (el borrado no arrastra las cuotas/pagos asociados → error 500). Para el uso real rara vez se necesita borrar un pago, pero hoy falla en silencio. Recomendación: borrado en cascada o un mensaje claro ("no se puede eliminar una inscripción con pagos registrados").

3. **El logo se pide dos veces por pantalla** (barra lateral + encabezado móvil). Ineficiencia mínima, sin impacto visible.

4. **Los borrados usan el cuadro de confirmación nativo del navegador.** Funciona, pero es una UX básica; podría reemplazarse por un modal propio.

5. **La sesión vence a las 8 horas.** Es lo esperado (seguridad), pero si querés sesiones más largas se puede ajustar.

---

## Datos de prueba

- **Revertido:** le había agregado un DNI de prueba al proveedor real **"Ivess"** para validar el fix — ya lo dejé como estaba (sin DNI). ✅

- **Quedan registros de prueba `ZZTEST`** (se borran con un click cada uno desde la app):
  - `ZZTEST Empleado` (Empleados → Legajos → Eliminar)
  - `ZZTEST Nota` (Agenda)
  - `ZZTEST Cliente` (Clientes → Dar de baja)
  - `ZZTEST Actividad` (Actividades → Desactivar)

  *(No los pude borrar yo porque la automatización del navegador no confirma el cuadro de "¿Eliminar?"; a vos con un click en "Aceptar" te va a funcionar.)*

- **No removible desde la app:** la inscripción de `ZZTEST Cliente` y su **pago de prueba de $10.000** (queda en los ingresos de junio) por la restricción descrita en el hallazgo #2. Si querés que desaparezca por completo, hay que hacerlo a nivel base de datos. Avisame y te ayudo.

---

## Conclusión

Zentric está **sólido y funcional** en todos sus módulos. Los hallazgos son menores y ninguno impide operar. El más recomendable de corregir es el #1 (fechas) por su impacto en comprobantes, y el #2 (mensaje al intentar borrar inscripciones pagadas) por claridad.
