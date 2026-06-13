// Helper para asegurarse de que cualquier recurso consultado pertenezca
// al businessId del usuario autenticado (multi-tenant isolation)

function scopedWhere(req, extra = {}) {
  return { ...extra, businessId: req.user.businessId };
}

module.exports = { scopedWhere };
