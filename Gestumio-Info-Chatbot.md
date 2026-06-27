# Gestumio — Base de conocimiento para el chatbot

> Documento de referencia con toda la información de Gestumio para responder consultas por WhatsApp (ventas y soporte). Tono sugerido para el bot: cercano, claro y en español rioplatense.

---

## 1. ¿Qué es Gestumio?

Gestumio es un **sistema de gestión (CRM) para negocios que cobran cuotas o turnos**: gimnasios, academias, estudios de danza, escuelas deportivas, centros de estética, profesionales de servicios, etc. Permite llevar en un solo lugar los **clientes, los cobros, la agenda de turnos, los empleados, los gastos y la caja**, con **recordatorios y recibos automáticos por WhatsApp**.

Es una aplicación **web** (se usa desde el navegador, en computadora o celular) — no hace falta instalar nada.

**Frase corta:** *"Gestumio es la app para administrar tu negocio: clientes, cobranzas, turnos y WhatsApp automático, todo en un solo lugar."*

---

## 2. ¿Para quién es?

- Gimnasios y centros de entrenamiento (musculación, crossfit, funcional).
- Academias y estudios (danza, pilates, yoga, artes marciales, natación).
- Escuelas deportivas y clubes.
- Centros de estética, peluquerías, consultorios y profesionales que dan **turnos**.
- Cualquier negocio que cobre **cuotas mensuales** o **servicios por turno** y quiera ordenar sus cobros.

---

## 3. Cómo empezar

1. Entrar a la web de Gestumio y **registrarse** (crear la cuenta del negocio).
2. Se activa una **prueba gratuita** para usar el sistema sin pagar.
3. Cargar los datos del negocio (nombre, logo), las actividades/servicios y los clientes.
4. Cuando termina la prueba, se activa la **suscripción mensual** para seguir usándolo.

> El registro se puede hacer con email y contraseña, o con **cuenta de Google**.

---

## 4. Precios y suscripción

- **Prueba gratuita** al registrarse (período de prueba sin costo).
- Luego, **suscripción mensual** que se paga online con **MercadoPago** (tarjeta).
- Si la suscripción vence, la cuenta se bloquea hasta regularizar el pago (los datos no se pierden).

> ⚠️ **Importante para el bot:** confirmar el **precio y la duración exacta de la prueba vigentes** antes de responder montos, porque pueden cambiar. (Completar acá el valor actual: prueba de ___ días / suscripción de $______ por mes.)

---

## 5. Módulos y funciones

### Clientes
Base de datos de clientes con nombre, teléfono, email, DNI/CUIT, foto y notas. Permite **buscar**, ver el detalle de cada cliente (sus inscripciones, cuotas y cuenta corriente) y **dar de baja/reactivar**. Se pueden **importar desde Excel/CSV** y **exportar a Excel, CSV o PDF**.

### Actividades / Servicios
- **Actividades:** lo que se cobra por **cuota mensual** (ej. "Musculación", "Pilates"). Tienen precio, sede, cupo y día de vencimiento.
- **Servicios / Turnos:** lo que se cobra **por turno** (ej. una sesión de masaje). Se agendan con cliente, fecha, hora y profesional.
- A cada actividad se le pueden **asignar empleados** y armar sus **horarios/clases semanales**.

### Agenda / Turnos
Calendario (vista mes, semana, día y lista) con los **turnos**, las **clases** de las actividades y los **eventos/notas** propios. Se pueden crear, editar y eliminar eventos.

### Cobranza (cuotas y pagos)
El corazón del sistema. Muestra las **cuotas pendientes, cobradas y vencidas** por cliente.
- Al inscribir un cliente en una actividad se genera su **primera cuota**.
- Las cuotas siguientes se **generan automáticamente** cada mes según el vencimiento.
- Se registran **pagos** (totales o parciales) con su método de pago.
- Cada cobro genera un **recibo en PDF** (con el logo del negocio) que se puede imprimir o **enviar por WhatsApp**.
- Filtros por **fecha** y búsqueda por cliente.

### Bonificaciones / Becas
Se puede marcar una inscripción como **bonificada (beca)**: el cliente **no paga mientras la beca esté vigente**. La beca puede ser **sin límite** o **hasta una fecha**; cuando vence, **vuelve a cobrarse el monto normal** automáticamente.

### Caja diaria
Registro de **ingresos y egresos del día**. Los cobros impactan automáticamente como ingreso; permite ver el saldo de la jornada.

### Gastos
Registro de egresos del negocio con categoría, descripción, proveedor, método de pago y monto. Tiene **búsqueda y filtros** (por categoría, proveedor, método y fecha) e **importar/exportar Excel, CSV y PDF**.

### Proveedores
Listado de proveedores con datos de contacto, CUIT/DNI y **cuenta corriente** (movimientos). Importar/exportar Excel, CSV y PDF.

### Empleados
Legajos de empleados (datos, rol, sueldo, fecha de ingreso). Se vinculan con actividades, asistencias y liquidaciones. Importar/exportar Excel, CSV y PDF.

### Asistencias
Control de asistencia de empleados por semana, tomando los **días de las actividades/horarios** en los que están asignados. Permite marcar presente/ausente/medio día y registra horas. Se puede **exportar a Excel, CSV o PDF**.

### Liquidaciones (sueldos)
Calcula y registra el **pago de sueldos** (por hora o sueldo fijo), con filtro por **fecha** y por empleado. Genera el **recibo de haberes en PDF**, que se puede **enviar por WhatsApp**.

### Horarios / Clases
Definición de las **clases semanales** de cada actividad (día, horario, empleado, sede, cupo).

### Reportes
Métricas e indicadores del negocio (ingresos, gastos, estado de inscripciones, flujo financiero) y **búsqueda global**.

### Grilla de precios
Listado de precios de actividades/servicios para tener todo a la vista.

### Sedes
Soporte para **varias sedes** del mismo negocio.

### Usuarios y permisos
El propietario puede crear **usuarios** (personal) y darles **permisos granulares por módulo y por acción** (ver, crear, editar, eliminar, importar, exportar, etc.), para que cada persona acceda solo a lo que necesita.

### WhatsApp
- Conexión de WhatsApp **por negocio** (cada negocio usa su propio número).
- **Recordatorios automáticos** de cuotas próximas a vencer y vencidas.
- **Envío directo** desde la app (sin copiar y pegar): recordatorios y comprobantes.
- **Envío de recibos en PDF** (cobros y recibos de haberes) por WhatsApp.

### Google Calendar
Integración para **sincronizar la agenda con Google Calendar** (turnos, agenda y clases) en un calendario dedicado "Gestumio", con opciones para elegir qué sincronizar desde Ajustes.

### Facturación / Suscripción
Sección donde el negocio gestiona su **suscripción** y pago mensual (MercadoPago), y descarga el **manual de usuario**.

---

## 6. Circuitos clave (cómo funciona)

**Inscribir → Cobrar → Recibo → Caja:**
1. Se inscribe al cliente en una actividad → se crea su primera cuota.
2. Se registra el cobro de la cuota (método de pago).
3. Se genera el recibo en PDF (se imprime o se manda por WhatsApp).
4. El cobro aparece automáticamente como **ingreso en la Caja del día**.

**Cuotas y vencimientos:**
- Cada actividad puede tener un **día de vencimiento** fijo.
- El sistema **genera automáticamente** la cuota del mes cuando corresponde.
- Las cuotas impagas pasadas la fecha se marcan como **vencidas**.

**Becas/Bonificaciones:**
- Beca **vigente** → la cuota queda en **$0**.
- Beca **vencida** (pasó la fecha) → vuelve a cobrarse el **monto normal**.
- Beca **sin límite** → gratis mientras esté activa.

---

## 7. Seguridad y datos

- Cada negocio tiene sus datos **aislados** (multi-negocio).
- Acceso con usuario y contraseña (o Google), con **permisos por usuario**.
- Los datos quedan guardados aunque venza la suscripción.

---

## 8. Preguntas frecuentes (FAQ)

**¿Qué es Gestumio?**
Un sistema para administrar tu negocio: clientes, cobranzas, turnos, empleados y WhatsApp automático, todo desde el navegador.

**¿Necesito instalar algo?**
No. Es una app web, se usa desde el navegador en compu o celular.

**¿Sirve para gimnasios/academias/estudios?**
Sí. Está pensado para negocios que cobran cuotas mensuales o turnos: gimnasios, academias, estudios, escuelas deportivas, estética, consultorios, etc.

**¿Tiene prueba gratis?**
Sí, al registrarte tenés una prueba gratuita. (Completar duración vigente.)

**¿Cuánto cuesta?**
Se paga una suscripción mensual con MercadoPago. (Completar el precio vigente.)

**¿Cómo pago la suscripción?**
Online con MercadoPago (tarjeta), desde la sección Facturación.

**¿Puedo cargar mis clientes de un Excel?**
Sí. Clientes, proveedores, empleados y gastos se pueden **importar desde Excel o CSV**, y exportar a Excel, CSV o PDF.

**¿Manda recordatorios por WhatsApp?**
Sí. Conectás tu WhatsApp y el sistema manda **recordatorios automáticos** de cuotas y envíos directos, además de los **recibos en PDF**.

**¿Cada negocio usa su propio WhatsApp?**
Sí, la conexión de WhatsApp es por negocio (tu propio número).

**¿Genera recibos?**
Sí, recibos de cobro y de sueldos en PDF (con tu logo), para imprimir o mandar por WhatsApp.

**¿Puedo darle acceso a mis empleados?**
Sí. Creás usuarios y les das permisos por módulo y por acción (ver, crear, editar, etc.).

**¿Maneja varias sedes?**
Sí, soporta múltiples sedes.

**¿Cómo funcionan las cuotas?**
Al inscribir un cliente se crea su cuota; las siguientes se generan automáticamente cada mes según el vencimiento.

**¿Puedo hacer descuentos o becas?**
Sí. Podés bonificar (beca) una inscripción: el cliente no paga mientras la beca esté vigente; podés ponerle una fecha de fin o dejarla sin límite.

**¿Se integra con Google Calendar?**
Sí, podés sincronizar turnos, agenda y clases con Google Calendar.

**¿Si no pago la suscripción pierdo mis datos?**
No. La cuenta se bloquea hasta regularizar, pero los datos se conservan.

**¿Puedo usarlo desde el celular?**
Sí, está adaptado para celular.

**¿Cómo registro un pago?**
Desde Cobranza, elegís la cuota del cliente y registrás el pago con su método; se genera el recibo y se suma a la caja del día.

---

## 9. Soporte / contacto

- Para soporte o consultas: (completar email / WhatsApp / horario de atención del negocio).
- Manual de usuario disponible dentro de la app (sección Facturación).

---

*Notas para quien configura el chatbot:* completar los campos entre paréntesis (precio, duración de prueba, datos de contacto) con la información vigente. Mantener este documento actualizado cuando cambien precios o funciones.
