const { PrismaClient } = require('@prisma/client');

// En Railway el volumen persistente está montado en /data. Si por algún motivo no
// está definida la variable DATABASE_URL en el entorno, usamos la ruta del volumen
// por defecto para que la app NO se caiga (las funciones de arranque y los crons
// necesitan la base de datos; sin esto, fallan y el server queda inestable -> 503).
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:/data/prod.db';
}

const prisma = new PrismaClient();

module.exports = prisma;
