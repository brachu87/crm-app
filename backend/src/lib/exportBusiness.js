// Exporta TODOS los datos de un negocio a un ZIP (un CSV por tabla).
// Se usa para portabilidad de datos (baja del cliente) y como respaldo descargable.
const prisma = require('../prisma');
let Prisma = null;
try { ({ Prisma } = require('@prisma/client')); } catch (_) {}
const AdmZip = require('adm-zip');

// Campos sensibles que NO se exportan (auth/tokens)
const SENSITIVE = new Set(['password', 'portalPassword', 'waToken', 'googleCalendarToken', 'googleCalendarId']);

// Nombres amigables de archivo por modelo
const FRIENDLY = {
  User: 'Usuarios', Client: 'Clientes', ClientNote: 'NotasDeClientes', Activity: 'Actividades',
  Enrollment: 'Inscripciones', Cuota: 'Cuotas', Payment: 'Pagos', Supplier: 'Proveedores',
  Note: 'Agenda', DailyCash: 'CajaDiaria', Employee: 'Empleados', Expense: 'Gastos',
  AccountMovement: 'MovimientosDeCuenta', Branch: 'Sedes', ActivityEmployee: 'ActividadEmpleados',
  ClassSchedule: 'Clases', Attendance: 'Asistencias', PayrollRecord: 'Liquidaciones',
  Service: 'Servicios', Appointment: 'Turnos', ManualIncome: 'IngresosManuales',
  ClassReservation: 'ReservasDeClases', ServiceSchedule: 'HorariosDeServicios',
};

// Modelos sin businessId: cómo filtrarlos por relación al negocio
function relationalWhere(name, businessId) {
  switch (name) {
    case 'ClientNote':       return { client: { businessId } };
    case 'Enrollment':       return { client: { businessId } };
    case 'Cuota':            return { enrollment: { client: { businessId } } };
    case 'Payment':          return { cuota: { enrollment: { client: { businessId } } } };
    case 'ActivityEmployee': return { activity: { businessId } };
    default:                 return null;
  }
}

function csvEscape(v) {
  if (v == null) return '';
  if (v instanceof Date) v = v.toISOString();
  if (typeof v === 'object') v = JSON.stringify(v);
  v = String(v);
  return /[",\n\r;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}

function toCsv(rows) {
  if (!rows || !rows.length) return '';
  const cols = Object.keys(rows[0]).filter((c) => !SENSITIVE.has(c));
  const head = cols.join(',');
  const body = rows.map((r) => cols.map((c) => csvEscape(r[c])).join(',')).join('\r\n');
  return head + '\r\n' + body;
}

async function buildBusinessZip(businessId) {
  const zip = new AdmZip();
  const models = (Prisma && Prisma.dmmf && Prisma.dmmf.datamodel.models) || [];
  const resumen = [];

  for (const m of models) {
    if (m.name === 'Business') continue; // no exportamos la fila del negocio (tiene tokens)
    const key = m.name.charAt(0).toLowerCase() + m.name.slice(1);
    const delegate = prisma[key];
    if (!delegate || typeof delegate.findMany !== 'function') continue;

    const hasBiz = m.fields.some((f) => f.name === 'businessId');
    let where = null;
    if (hasBiz) where = { businessId };
    else where = relationalWhere(m.name, businessId);
    if (!where) continue; // modelo no vinculable al negocio → se omite

    let rows = [];
    try { rows = await delegate.findMany({ where }); }
    catch (e) { console.warn('[export] no se pudo exportar', m.name, e.message); continue; }

    // limpiar campos sensibles de cada fila
    rows = rows.map((r) => { const o = { ...r }; for (const k of SENSITIVE) delete o[k]; return o; });

    const fname = (FRIENDLY[m.name] || m.name) + '.csv';
    zip.addFile(fname, Buffer.from('﻿' + toCsv(rows), 'utf8')); // BOM para Excel
    resumen.push(`${fname}: ${rows.length} registro(s)`);
  }

  const lee =
    'Exportación de datos de Gestumio\r\n' +
    'Fecha: ' + new Date().toLocaleString('es-AR') + '\r\n\r\n' +
    'Cada archivo .csv corresponde a una tabla del sistema. Se pueden abrir con Excel o Google Sheets.\r\n' +
    'No se incluyen contraseñas ni tokens por seguridad.\r\n\r\n' +
    'Contenido:\r\n' + resumen.sort().join('\r\n') + '\r\n';
  zip.addFile('LEEME.txt', Buffer.from('﻿' + lee, 'utf8'));

  return zip.toBuffer();
}

module.exports = { buildBusinessZip };
