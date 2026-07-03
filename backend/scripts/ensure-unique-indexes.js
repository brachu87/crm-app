// Crea índices únicos parciales para evitar clientes duplicados a nivel base de datos
// (defensa en profundidad: la validación de la app ya bloquea duplicados nuevos).
//
// Diseño a prueba de fallos: corre en cada arranque DESPUÉS de `prisma db push`.
// - Si NO hay duplicados previos -> crea el índice (idempotente, IF NOT EXISTS).
// - Si HAY duplicados -> los detecta, los loguea y NO crea el índice, sin tumbar el deploy.
//   Una vez que se limpian los duplicados, el próximo arranque crea el índice solo.
//
// Unicidad por negocio: (businessId, dni), ignorando NULL.
// NOTA: el email NO se hace único a propósito — las familias comparten correo.
const prisma = require('../src/prisma');

const TARGETS = [
  { field: 'dni', index: 'client_business_dni_uniq', label: 'DNI' },
];

async function findDuplicates(field) {
  // Agrupa por (businessId, campo) y devuelve los que se repiten.
  const rows = await prisma.$queryRawUnsafe(
    `SELECT "businessId", "${field}" AS value, COUNT(*)::int AS count
       FROM "Client"
      WHERE "${field}" IS NOT NULL AND "${field}" <> ''
      GROUP BY "businessId", "${field}"
     HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
      LIMIT 50`
  );
  return rows;
}

async function ensureUniqueIndexes() {
  const isPostgres = (process.env.DATABASE_URL || '').startsWith('postgres');
  if (!isPostgres) {
    console.log('[índices] No es PostgreSQL: se omite la creación de índices únicos.');
    return { skipped: true };
  }

  const result = { created: [], blocked: [] };

  for (const t of TARGETS) {
    try {
      const dups = await findDuplicates(t.field);
      if (dups && dups.length) {
        result.blocked.push(t.label);
        console.warn(
          `[índices] ⚠ No se creó el índice único de ${t.label}: hay ${dups.length} valor(es) duplicado(s). ` +
          `Corregilos y se creará solo en el próximo deploy. Ejemplos:`
        );
        for (const d of dups.slice(0, 10)) {
          console.warn(`   - negocio ${d.businessId} | ${t.label}="${d.value}" x${d.count}`);
        }
        continue;
      }
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "${t.index}" ` +
        `ON "Client" ("businessId", "${t.field}") ` +
        `WHERE "${t.field}" IS NOT NULL AND "${t.field}" <> ''`
      );
      result.created.push(t.label);
      console.log(`[índices] ✓ Índice único de ${t.label} por negocio asegurado.`);
    } catch (e) {
      // Nunca tumbar el arranque por esto.
      console.error(`[índices] Error asegurando índice de ${t.label} (se continúa):`, e.message);
    }
  }
  return result;
}

module.exports = ensureUniqueIndexes;

// Permite correrlo manualmente:  node backend/scripts/ensure-unique-indexes.js
if (require.main === module) {
  ensureUniqueIndexes()
    .then((r) => { console.log('[índices] Resultado:', JSON.stringify(r)); return prisma.$disconnect(); })
    .catch((e) => { console.error(e); process.exit(1); });
}
