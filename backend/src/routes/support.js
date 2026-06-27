const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

router.use(auth);

// Base de conocimiento de Gestumio (cerebro del asistente).
const KB = `
Gestumio es un sistema de gestión (CRM) web para negocios que cobran cuotas o turnos:
gimnasios, academias, estudios (danza, pilates, yoga, artes marciales), escuelas deportivas,
estética, consultorios y profesionales de servicios. Se usa desde el navegador (compu o celular).

MÓDULOS Y CÓMO USARLOS:
- Clientes: base de clientes (nombre, teléfono, email, DNI/CUIT, foto, notas). Crear: menú Clientes → "Nuevo cliente". Editar: abrir la ficha → "Editar". Dar de baja desde la ficha (se conserva el historial). Importar desde Excel/CSV y exportar a Excel/CSV/PDF (desplegables "Importar"/"Exportar").
- Actividades/Servicios: Actividades = se cobran por cuota mensual (tienen precio, sede, cupo, día de vencimiento). Servicios = se cobran por turno. A cada actividad se le asignan empleados y horarios/clases.
- Agenda/Turnos: calendario (mes/semana/día/lista) con turnos, clases y notas/eventos. Crear con "+ Nuevo".
- Cobranza: muestra cuotas pendientes, cobradas y vencidas. Al inscribir un cliente se crea su primera cuota; las siguientes se generan solas cada mes. Registrar pago: pestaña Pendientes → cliente → "Confirmar cobro" → monto y método. Cada cobro genera recibo PDF (imprimir o enviar por WhatsApp). Filtros por fecha y búsqueda.
- Inscripciones: ficha del cliente → "Nueva inscripción" → actividad, monto y vencimiento.
- Bonificaciones/Becas: en la ficha del cliente, marcar una inscripción como bonificada (beca). El cliente NO paga mientras la beca está vigente; puede ser sin límite o hasta una fecha. Al vencer, vuelve a cobrarse el monto normal.
- Caja diaria: ingresos y egresos del día; los cobros entran solos.
- Gastos: egresos con categoría, proveedor, método y monto. Tiene búsqueda y filtros (categoría/proveedor/método/fecha) e importar/exportar Excel/CSV/PDF.
- Proveedores: contactos + cuenta corriente. Importar/exportar.
- Empleados: legajos (rol, sueldo, ingreso). Importar/exportar.
- Asistencias: control por semana según los días de las actividades asignadas; exportar Excel/CSV/PDF.
- Liquidaciones: cálculo y pago de sueldos (por hora o fijo), filtro por fecha, recibo de haberes en PDF (se puede enviar por WhatsApp).
- Horarios/Clases: clases semanales de cada actividad (día, hora, empleado, sede, cupo).
- Reportes: métricas e indicadores + búsqueda global.
- Grilla de precios, Sedes (varias sedes).
- Usuarios y permisos: el propietario crea usuarios y les da permisos por módulo y por acción.
- WhatsApp: se vincula el WhatsApp del negocio (escaneando un QR en Ajustes → WhatsApp). Sirve para enviar recordatorios y comprobantes de forma MANUAL (Cobranza → pestaña Recordatorios, botón "📱 Enviar" por cliente) y recibos en PDF. (El envío masivo/automático está desactivado por ahora.)
- Google Calendar: en Ajustes → Calendar se conecta una cuenta de Google y se sincronizan turnos, agenda y clases a un calendario "Gestumio".
- Facturación/Suscripción: prueba gratis al registrarse y luego suscripción mensual con MercadoPago. Si vence, la cuenta se bloquea pero los datos se conservan.

CIRCUITO PRINCIPAL: inscribir cliente → cobrar cuota → generar recibo → impacta en la caja del día.
`.trim();

const SYSTEM_PROMPT = `Sos el asistente de soporte de Gestumio dentro de la app. Ayudás al usuario (dueño o personal del negocio) a usar el sistema.
Reglas:
- Respondé SIEMPRE en español rioplatense, claro y breve (2-5 frases o pasos cortos). Usá pasos numerados cuando expliques cómo hacer algo.
- Respondé SOLO sobre Gestumio y cómo usarlo, usando la información de abajo. No inventes funciones que no existen.
- Si no sabés algo o el usuario reporta un error técnico, decile que escriba a soporte por WhatsApp al +54 9 11 7823-6708 (https://wa.me/5491178236708).
- No pidas ni manejes contraseñas ni datos de tarjeta.

INFORMACIÓN DE GESTUMIO:
${KB}`;

// POST /api/support/chat  { messages: [{role:'user'|'assistant', content}] }
router.post('/chat', async (req, res) => {
  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages requerido' });
  }
  if (!process.env.GROQ_API_KEY) {
    return res.status(503).json({ error: 'Asistente IA no configurado', code: 'NO_KEY' });
  }
  try {
    const clean = messages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));

    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        temperature: 0.3,
        max_tokens: 600,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...clean],
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      console.error('[groq]', r.status, t.slice(0, 300));
      return res.status(502).json({ error: 'El asistente no está disponible en este momento' });
    }
    const data = await r.json();
    const reply = data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : 'No pude generar una respuesta.';
    res.json({ reply });
  } catch (e) {
    console.error('[support chat]', e.message);
    res.status(500).json({ error: 'Error al consultar el asistente' });
  }
});

module.exports = router;
