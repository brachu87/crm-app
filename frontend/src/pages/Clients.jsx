import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSectionPerms } from '../config/permissions';
import api from '../api/client';
import ClientModal from './ClientModal';
import ImportModal from '../components/ImportModal';

const fmtMoney = (v) => '$ ' + Math.round(v || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

function SaldoBadge({ saldo }) {
  if (saldo == null) return null;
  if (saldo <= 0) return (
    <span style={{ background: '#d1fae5', color: '#065f46', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
      ✓ Al día
    </span>
  );
  return (
    <span style={{ background: '#fee2e2', color: '#991b1b', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
      Debe {fmtMoney(saldo)}
    </span>
  );
}

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
  const can = useSectionPerms('clientes');
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  function load() {
    const url = showInactive ? '/clients?includeInactive=true' : '/clients';
    api.get(url).then((res) => setClients(res.data)).finally(() => setLoading(false));
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

  async function handleReactivate(client) {
    try {
      await api.put(`/clients/${client.id}`, { ...client, active: true });
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al reactivar');
    }
  }

  useEffect(load, [showInactive]);

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
          {can.importar && <button className="btn btn-secondary" onClick={() => setShowImportModal(true)}>↑ Importar Excel/CSV</button>}
          <button className="btn btn-secondary" onClick={() => setShowInactive(!showInactive)} style={{ color: showInactive ? 'var(--primary)' : undefined }}>
            {showInactive ? 'Ver activos' : 'Ver dados de baja'}
          </button>
          {clients.length > 0 && can.exportar && <button className="btn btn-secondary" onClick={() => exportCSV(clients)}>↓ Exportar CSV</button>}
          {can.crear && <button className="btn btn-primary" onClick={() => { setEditing(null); setShowModal(true); }}>+ Nuevo cliente</button>}
        </div>
      </div>

      {clients.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, teléfono o email..."
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', width: '100%', maxWidth: 320, fontSize: 14 }}
          />
        </div>
      )}

      {loading ? (
        <div className="page-spinner"><div className="spinner spinner-lg"></div><span>Cargando...</span></div>
      ) : clients.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <h3>Todavía no agregaste clientes</h3>
            <p>Agregá tu primer cliente para empezar a inscribirlo en actividades.</p>
            <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ marginTop: 12 }}>
              {can.crear && '+ Nuevo cliente'}
            </button>
          </div>
        </div>
      ) : (
        <div className="card">
          {filtered.length === 0 ? (
            <p style={{ color: 'var(--ink-soft)', padding: 8 }}>Sin resultados para "{search}"</p>
          ) : (
            <div className="table-wrap"><table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Teléfono</th>
                  <th>Email</th>
                  <th>Saldo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} style={{ opacity: c.active === false ? 0.5 : 1 }}>
                    <td>
                      <Link to={`/clientes/${c.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 30, height: 30, borderRadius: '50%', overflow: 'hidden', background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, fontWeight: 700, color: '#6366f1' }}>
                          <img
                            src={`/api/clients/${c.id}/photo?token=${localStorage.getItem('token')}`}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                          />
                          <span style={{ display: 'none', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>{c.name.charAt(0).toUpperCase()}</span>
                        </span>
                        {c.name}
                      </Link>
                    </td>
                    <td>{c.phone || '-'}</td>
                    <td>{c.email || '-'}</td>
                    <td><SaldoBadge saldo={c.saldo} /></td>
                    <td style={{ display: 'flex', gap: 6 }}>
                    {c.active !== false ? (
                      <>
                        <Link to={`/clientes/${c.id}`} className="btn btn-secondary btn-sm">Ver</Link>
                        {can.editar && <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(c); setShowModal(true); }}>Editar</button>}
                        {can.baja && <button className="btn btn-danger btn-sm" onClick={() => handleDeactivate(c)}>Dar de baja</button>}
                      </>
                    ) : (
                      <button className="btn btn-secondary btn-sm" style={{ color: '#10b981' }} onClick={() => handleReactivate(c)}>Reactivar</button>
                    )}
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
          title="Importar clientes desde Excel o CSV"
          columns={[
            { key: 'name',  labels: ['nombre','name'] },
            { key: 'phone', labels: ['telefono','teléfono','phone','cel','celular'] },
            { key: 'email', labels: ['email','correo','mail'] },
            { key: 'notes', labels: ['notas','notes','observaciones'] },
          ]}
          apiPath="/clients/import"
          payloadKey="clients"
          onClose={() => setShowImportModal(false)}
          onImported={() => { setShowImportModal(false); load(); }}
        />
      )}
    </div>
  );
}
