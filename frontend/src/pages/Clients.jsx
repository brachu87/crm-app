import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import ClientModal from './ClientModal';

function exportCSV(clients) {
  const rows = [
    ['Nombre', 'Teléfono', 'Email', 'Notas'],
    ...clients.map((c) => [c.name, c.phone || '', c.email || '', c.notes || '']),
  ];
  const csv = rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
  a.download = 'clientes.csv';
  a.click();
}

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');

  function load() {
    api.get('/clients').then((res) => setClients(res.data)).finally(() => setLoading(false));
  }

  async function handleDeactivate(client) {
    if (!window.confirm(`¿Dar de baja a ${client.name}? Va a dejar de aparecer en la lista de clientes activos.`)) return;
    try {
      await api.put(`/clients/${client.id}`, { ...client, active: false });
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al dar de baja');
    }
  }

  useEffect(load, []);

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Clientes</h1>
          <p className="page-subtitle">Tu base de clientes</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setShowImportModal(true)}>↑ Importar CSV</button>
          {clients.length > 0 && (
            <button className="btn btn-secondary" onClick={() => exportCSV(clients)}>↓ Exportar CSV</button>
          )}
          <button className="btn btn-primary" onClick={() => { setEditing(null); setShowModal(true); }}>+ Nuevo cliente</button>
        </div>
      </div>

      {clients.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, teléfono o email..."
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', width: 300, fontSize: 14 }}
          />
        </div>
      )}

      {loading ? (
        <p>Cargando...</p>
      ) : clients.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <h3>Todavía no agregaste clientes</h3>
            <p>Agregá tu primer cliente para empezar a inscribirlo en actividades.</p>
            <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ marginTop: 12 }}>
              + Nuevo cliente
            </button>
          </div>
        </div>
      ) : (
        <div className="card">
          {filtered.length === 0 ? (
            <p style={{ color: '#9ca3af', padding: 8 }}>Sin resultados para "{search}"</p>
          ) : (
            <div className="table-wrap"><table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Teléfono</th>
                  <th>Email</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td><Link to={`/clientes/${c.id}`}>{c.name}</Link></td>
                    <td>{c.phone || '-'}</td>
                    <td>{c.email || '-'}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                    <Link to={`/clientes/${c.id}`} className="btn btn-secondary btn-sm">Ver</Link>
                    <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(c); setShowModal(true); }}>Editar</button>
                    <button className="btn btn-secondary btn-sm" style={{ color: '#ef4444' }} onClick={() => handleDeactivate(c)}>Dar de baja</button>
                  </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
      )}

      {showModal && (
        <ClientModal
          client={editing}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onImported={() => { setShowImportModal(false); load(); }}
        />
      )}
    </div>
  );
}

function ImportModal({ onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  function parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map((h) => h.replace(/"/g, '').trim().toLowerCase());
    return lines.slice(1).map((line) => {
      const vals = line.split(',').map((v) => v.replace(/^"|"$/g, '').trim());
      const obj = {};
      headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
      // Normalize common header names
      return {
        name: obj.nombre || obj.name || '',
        phone: obj.telefono || obj.teléfono || obj.phone || '',
        email: obj.email || obj.correo || '',
        notes: obj.notas || obj.notes || '',
      };
    }).filter((r) => r.name);
  }

  function handleFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(parseCSV(ev.target.result));
    reader.readAsText(f, 'UTF-8');
  }

  async function handleImport() {
    if (preview.length === 0) return;
    setImporting(true);
    setError('');
    try {
      const res = await api.post('/clients/import', { clients: preview });
      setResult(res.data);
      if (res.data.created > 0) setTimeout(onImported, 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al importar');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <h2>Importar clientes desde CSV</h2>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
          El archivo debe tener columnas: <strong>nombre, telefono, email, notas</strong> (la primera fila es el encabezado).
        </p>
        {error && <div className="error-banner">{error}</div>}
        {result ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <p style={{ fontSize: 24, margin: 0 }}>✓</p>
            <p style={{ fontWeight: 600 }}>{result.created} clientes importados</p>
            {result.errors.length > 0 && <p style={{ color: '#ef4444', fontSize: 13 }}>{result.errors.length} filas con error</p>}
          </div>
        ) : (
          <>
            <div className="field">
              <label>Archivo CSV</label>
              <input type="file" accept=".csv" onChange={handleFile} />
            </div>
            {preview.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
                  {preview.length} clientes detectados — primeros 3:
                </p>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['Nombre', 'Teléfono', 'Email'].map((h) => <th key={h} style={{ textAlign: 'left', padding: '3px 4px', color: '#9ca3af' }}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 3).map((r, i) => (
                      <tr key={i} style={{ borderTop: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '3px 4px' }}>{r.name}</td>
                        <td style={{ padding: '3px 4px' }}>{r.phone || '-'}</td>
                        <td style={{ padding: '3px 4px' }}>{r.email || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleImport} disabled={importing || preview.length === 0}>
                {importing ? 'Importando...' : `Importar ${preview.length} clientes`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
