// Capa de validación sistemática con Zod.
// Uso en una ruta:  router.post('/', validate(schemas.clientCreate), handler)
// Valida req.body contra el schema. Si falla, corta con 400 y un mensaje claro.
// Si pasa, deja el resultado parseado en req.validated (no pisa req.body).
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body || {});
  if (!result.success) {
    const issue = result.error.issues[0];
    const campo = issue && issue.path && issue.path.length ? issue.path.join('.') : null;
    const msg = issue ? issue.message : 'Datos inválidos';
    return res.status(400).json({ error: campo ? `${msg}` : msg, field: campo });
  }
  req.validated = result.data;
  next();
};

module.exports = validate;
