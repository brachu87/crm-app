-- Google OAuth: el password puede quedar vacío.
-- En SQLite NO se puede `ALTER COLUMN ... DROP NOT NULL` (eso es sintaxis de PostgreSQL),
-- y la app crea los usuarios de Google con password = '' (string vacío), así que no se
-- requiere que la columna sea nullable. Migración no-op (válida en SQLite).
PRAGMA foreign_keys=ON;
