import { useState } from 'react';
import * as XLSX from 'xlsx';
import api from '../api/client';

/**
 * Reutilizable para clientes y proveedores.
 * Props:
 *   entity      — 'clients' | 'suppliers'
 *   title       — string mostrado en el modal
 *   columns     — [{ key, labels }]  labels = sinónimos en encabezado
 *   apiPath     — ruta POST backend  ej: '/clients/import'
 *   payloadKey  — nombre del array en el body  ej: 'clients'
 *   onClose     — fn
 *   onImported  — fn llamada tras importar
 */
export default function ImportModal({ title, columns, apiPath, payloadKey, onClose, onImported }) {
  const [preview, setPreview] = useState([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  function normalizeKey(raw) {
    return raw.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  }

  function mapRow(rawRow) {
    const mapped = {};
    const keys = Object.keys(rawRow);
    for (const col of columns) {
      const match = keys.find(k => col.labels.map(normalizeKey).includes(normalizeKey(k)));
      mapped[col.key] = match ? String(rawRow[match] ?? '').trim() : '';
    }
    return mapped;
  }

  function parseExcel(buffer) {
    const wb = XLSX.read(buffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    return rows.map(mapRow).filter(r => r[columns[0].key]);
  }

  function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
    return lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.replace(/^"|"$/g, '').trim());
      const obj = {};
      headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
      return mapRow(obj);
    }).filter(r => r[columns[0].key]);
  }

  function handleFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    setPreview([]); setResult(null); setError('');
    const ext = f.name.split('.').pop().toLowerCase();
    const reader = new FileReader();
    if (ext === 'csv') {
      reader.onload = ev => setPreview(parseCSV(ev.target.result));
      reader.readAsText(f, 'UTF-8');
    } else {
      reader.onload = ev => setPreview(parseExcel(ev.target.result));
      reader.readAsArrayBuffer(f);
    }
  }

  async function handleImport() {
    if (preview.length === 0) return;
    setImporting(true); setError('');
    try {
      const res = await api.post(apiPath, { [payloadKey]: preview });
      setResult(res.data);
      if (res.data.created > 0) setTimeout(onImported, 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al importar');
    } finally {
      setImporting(false);
    }
  }

  function downloadTemplate() {
    const headers = columns.map(c => c.header || c.key);
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
    XLSX.writeFile(wb, `plantilla_${payloadKey}.xlsx`);
  }

  const nameKey = columns[0].key;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <h2>{title}</h2>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 8 }}>
          Columnas: <strong>{columns.map(c => c.header || c.key).join(', ')}</strong>
        </p>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 16 }}>
          Formatos aceptados: <strong>.xlsx, .xls, .csv</strong>
        </p>
        {error && <div className="error-banner">{error}</div>}

        {result ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
            <p style={{ fontWeight: 700, fontSize: 18 }}>{result.created} registros importados</p>
            {result.errors?.length > 0 && (
              <p style={{ color: '#ef4444', fontSize: 13 }}>{result.errors.length} filas con error</p>
            )}
          </div>
        ) : (
          <>
            <div className="field">
              <label>Archivo Excel o CSV</label>
              <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} />
            </div>

            <button
              onClick={downloadTemplate}
              style={{
                background: 'none', border: 'none', color: 'var(--primary)',
                fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 16,
                textDecoration: 'underline',
              }}
            >
              ⬇ Descargar plantilla Excel
            </button>

            {preview.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 8 }}>
                  <strong>{preview.length}</strong> registros detectados — vista previa:
                </p>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {columns.map(c => (
                          <th key={c.key} style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid var(--border)', color: 'var(--ink-soft)' }}>
                            {c.header || c.key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.slice(0, 5).map((row, i) => (
                        <tr key={i}>
                          {columns.map(c => (
                            <td key={c.key} style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>
                              {row[c.key] || <span style={{ color: 'var(--ink-soft)' }}>—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {preview.length > 5 && (
                  <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 6 }}>
                    ... y {preview.length - 5} más
                  </p>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
              <button
                className="btn btn-primary"
                onClick={handleImport}
                disabled={preview.length === 0 || importing}
              >
                {importing ? 'Importando...' : `Importar ${preview.length > 0 ? preview.length + ' registros' : ''}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
