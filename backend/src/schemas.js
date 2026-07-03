// Schemas de validación (Zod) para los endpoints clave.
// Los mensajes están en español para mostrarse tal cual al usuario.
const { z } = require('zod');

const str = (max = 255) => z.string().trim().max(max, `Máximo ${max} caracteres`);
const reqStr = (max, msg) => z.string({ required_error: msg, invalid_type_error: msg }).trim().min(1, msg).max(max, `Máximo ${max} caracteres`);
const optStr = (max = 255) => z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  z.string().trim().max(max, `Máximo ${max} caracteres`).optional()
);
// Número que puede venir como string ("100", "1.234,50") o number.
// Se le pasa el ZodNumber ya con sus restricciones (.positive(), .min(), etc.)
const numLike = (inner) => z.preprocess((v) => {
  if (v === '' || v === null || v === undefined) return undefined;
  if (typeof v === 'string') {
    const cleaned = v.replace(/\./g, '').replace(',', '.').replace(/[^0-9.\-]/g, '');
    const n = parseFloat(cleaned);
    return isNaN(n) ? v : n;
  }
  return v;
}, inner);

const email = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
  z.string().email('Email inválido').max(200, 'Email demasiado largo')
);
const optEmail = z.preprocess(
  (v) => (v === '' || v == null ? undefined : (typeof v === 'string' ? v.trim().toLowerCase() : v)),
  z.string().email('Email inválido').max(200, 'Email demasiado largo').optional()
);

const schemas = {
  register: z.object({
    businessName: reqStr(100, 'El nombre del negocio es obligatorio'),
    name: reqStr(100, 'Tu nombre es obligatorio'),
    email,
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(200),
    businessPhone: reqStr(30, 'El teléfono es obligatorio'),
    category: optStr(50),
  }).passthrough(),

  login: z.object({
    email: reqStr(200, 'Ingresá tu email'),
    password: reqStr(200, 'Ingresá tu contraseña'),
  }).passthrough(),

  clientCreate: z.object({
    name: reqStr(120, 'El nombre es obligatorio'),
    email: optEmail,
    phone: optStr(40),
    dni: optStr(20),
    cuit: optStr(20),
    notes: optStr(2000),
    birthday: optStr(40),
    emergencyContact: optStr(120),
    emergencyPhone: optStr(40),
    medicalNotes: optStr(2000),
    responsableName: optStr(120),
    responsablePhone: optStr(40),
    globalDiscount: numLike(z.number().min(0, 'El descuento no puede ser negativo').max(100, 'El descuento no puede superar 100%')).optional(),
  }).passthrough(),

  expenseCreate: z.object({
    amount: numLike(z.number({ required_error: 'El monto es obligatorio', invalid_type_error: 'El monto debe ser un número' }).positive('El monto debe ser un número mayor a 0')),
    category: reqStr(80, 'La categoría es obligatoria'),
    description: optStr(500),
    paymentMethod: optStr(60),
    date: optStr(40),
    supplierId: optStr(60),
  }).passthrough(),

  expenseUpdate: z.object({
    amount: numLike(z.number({ invalid_type_error: 'El monto debe ser un número' }).positive('El monto debe ser un número mayor a 0')).optional(),
    category: optStr(80),
    description: optStr(500),
    paymentMethod: optStr(60),
    date: optStr(40),
    supplierId: optStr(60),
  }).passthrough(),

  appointmentCreate: z.object({
    clientId: reqStr(60, 'Falta el cliente'),
    serviceId: optStr(60),
    employeeId: optStr(60),
    branchId: optStr(60),
    date: reqStr(40, 'Falta la fecha'),
    startTime: optStr(10),
    endTime: optStr(10),
    price: numLike(z.number().min(0, 'El precio no puede ser negativo')).optional(),
    notes: optStr(1000),
    description: optStr(1000),
    isQuickWork: z.boolean().optional(),
  }).passthrough(),
};

module.exports = schemas;
