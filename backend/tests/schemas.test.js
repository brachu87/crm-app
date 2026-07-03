// Tests de la capa de validación (Zod). Cubren los circuitos críticos:
// login, registro, alta de cliente, gasto (monto), y turno.
const validate = require('../src/lib/validate');
const schemas = require('../src/schemas');

// Ejecuta el middleware validate(schema) con un body y devuelve {code, body, validated}
function run(schema, body) {
  return new Promise((resolve) => {
    const req = { body };
    const res = {
      _code: 200,
      status(c) { this._code = c; return this; },
      json(o) { resolve({ code: this._code, body: o }); },
    };
    validate(schema)(req, res, () => resolve({ code: 200, validated: req.validated }));
  });
}

describe('login', () => {
  it('rechaza sin email', async () => {
    const r = await run(schemas.login, { password: 'x' });
    expect(r.code).toBe(400);
    expect(r.body.field).toBe('email');
  });
  it('rechaza sin contraseña', async () => {
    const r = await run(schemas.login, { email: 'a@b.com' });
    expect(r.code).toBe(400);
    expect(r.body.field).toBe('password');
  });
  it('acepta credenciales completas', async () => {
    const r = await run(schemas.login, { email: 'a@b.com', password: 'x' });
    expect(r.code).toBe(200);
    expect(r.validated.email).toBe('a@b.com');
  });
});

describe('register', () => {
  it('exige contraseña de 8+ caracteres', async () => {
    const r = await run(schemas.register, { businessName: 'G', name: 'A', email: 'a@b.com', password: '123', businessPhone: '11' });
    expect(r.code).toBe(400);
    expect(r.body.field).toBe('password');
  });
  it('normaliza el email a minúsculas', async () => {
    const r = await run(schemas.register, { businessName: 'Gym', name: 'Ana', email: 'ANA@X.com', password: '12345678', businessPhone: '1122334455' });
    expect(r.code).toBe(200);
    expect(r.validated.email).toBe('ana@x.com');
  });
  it('rechaza email inválido', async () => {
    const r = await run(schemas.register, { businessName: 'Gym', name: 'Ana', email: 'no-mail', password: '12345678', businessPhone: '11' });
    expect(r.code).toBe(400);
    expect(r.body.field).toBe('email');
  });
});

describe('clientCreate', () => {
  it('exige nombre', async () => {
    const r = await run(schemas.clientCreate, { email: 'j@x.com' });
    expect(r.code).toBe(400);
    expect(r.body.field).toBe('name');
  });
  it('rechaza email inválido', async () => {
    const r = await run(schemas.clientCreate, { name: 'Juan', email: 'no-mail' });
    expect(r.code).toBe(400);
    expect(r.body.field).toBe('email');
  });
  it('permite email vacío (opcional)', async () => {
    const r = await run(schemas.clientCreate, { name: 'Juan', email: '' });
    expect(r.code).toBe(200);
  });
  it('conserva campos extra (passthrough)', async () => {
    const r = await run(schemas.clientCreate, { name: 'Juan', dni: '123', foo: 'bar' });
    expect(r.code).toBe(200);
    expect(r.validated.foo).toBe('bar');
  });
});

describe('expenseCreate', () => {
  it('rechaza monto negativo', async () => {
    const r = await run(schemas.expenseCreate, { amount: -5, category: 'Luz' });
    expect(r.code).toBe(400);
    expect(r.body.field).toBe('amount');
  });
  it('rechaza monto cero', async () => {
    const r = await run(schemas.expenseCreate, { amount: 0, category: 'Luz' });
    expect(r.code).toBe(400);
  });
  it('exige categoría', async () => {
    const r = await run(schemas.expenseCreate, { amount: 100 });
    expect(r.code).toBe(400);
    expect(r.body.field).toBe('category');
  });
  it('parsea monto en formato AR "1.234,50" -> 1234.5', async () => {
    const r = await run(schemas.expenseCreate, { amount: '1.234,50', category: 'Luz' });
    expect(r.code).toBe(200);
    expect(r.validated.amount).toBeCloseTo(1234.5);
  });
  it('acepta monto numérico positivo', async () => {
    const r = await run(schemas.expenseCreate, { amount: 999.99, category: 'Alquiler' });
    expect(r.code).toBe(200);
    expect(r.validated.amount).toBeCloseTo(999.99);
  });
});

describe('expenseUpdate', () => {
  it('permite body parcial sin monto', async () => {
    const r = await run(schemas.expenseUpdate, { category: 'Otros' });
    expect(r.code).toBe(200);
  });
  it('sigue rechazando monto negativo si viene', async () => {
    const r = await run(schemas.expenseUpdate, { amount: -1 });
    expect(r.code).toBe(400);
  });
});

describe('appointmentCreate', () => {
  it('exige cliente', async () => {
    const r = await run(schemas.appointmentCreate, { date: '2026-07-10' });
    expect(r.code).toBe(400);
    expect(r.body.field).toBe('clientId');
  });
  it('exige fecha', async () => {
    const r = await run(schemas.appointmentCreate, { clientId: 'c1' });
    expect(r.code).toBe(400);
    expect(r.body.field).toBe('date');
  });
  it('acepta turno válido y parsea precio', async () => {
    const r = await run(schemas.appointmentCreate, { clientId: 'c1', date: '2026-07-10', price: '500' });
    expect(r.code).toBe(200);
    expect(r.validated.price).toBe(500);
  });
});
