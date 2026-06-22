import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/client';
import ClientModal from './ClientModal';

const statusLabels = {
  paid: 'Pagado',
  pending: 'Pendiente',
  overdue: 'Vencido',
};

function formatMoney(value) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value || 0);
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('es-AR', { timeZone: 'UTC' });
}

export default function ClientDetail() {
  const { id } = useParams();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showStatement, setShowStatement] = useState(false);
  const [bonModal, setBonModal] = useState(null);
  const [error, setError] = useState('');
  const [photoTs, setPhotoTs] = useState(Date.now());
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [account, setAccount] = useState(null);
  const [movModal, setMovModal] = useState(false);
  const [editMontoEnrollment, setEditMontoEnrollment] = useState(null);

  function load() {
    api.get(`/clients/${id}`).then((res) => setClient(res.data)).finally(() => setLoading(false));
  }

  function loadNotes() {
    api.get(`/clients/${id}/notes`).then((res) => setNotes(res.data));
  }

  function loadAccount() {
    api.get(`/clients/${id}/account`).then((res) => setAccount(res.data)).catch(() => {});
  }

  useEffect(() => { load(); loadNotes(); loadAccount(); }, [id]);

  async function addNote(e) {
    e.preventDefault();
    if (!newNote.trim()) return;
    setSavingNote(true);
    try {
      await api.post(`/clients/${id}/notes`, { content: newNote });
      setNewNote('');
      loadNotes();
    } finally {
      setSavingNote(false);
    }
  }

  async function deleteNote(noteId) {
    if (!window.confirm('¿Eliminar esta nota?')) return;
    await api.delete(`/clients/${id}/notes/${noteId}`);
    loadNotes();
  }

  async function uploadPhoto(file) {
    const fd = new FormData();
    fd.append('photo', file);
    try {
      await api.post(`/clients/${id}/photo`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setPhotoTs(Date.now());
    } catch (err) {
      alert('No se pudo subir la foto');
    }
  }

  if (loading) return <p>Cargando...</p>;
  if (!client) return <p>Cliente no encontrado.</p>;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <label style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }} title="Cambiar foto">
            <div style={{ width: 60, height: 60, borderRadius: '50%', overflow: 'hidden', background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, color: 'var(--ink-soft)', border: '2px solid var(--border)' }}>
              <img
                src={`/api/clients/${id}/photo?t=${photoTs}&token=${localStorage.getItem('token')}`}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
              />
              <span style={{ display: 'none', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', fontSize: 22, background: '#6366f1', color: 'white', borderRadius: '50%' }}>
                {client.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div style={{ position: 'absolute', bottom: 0, right: 0, width: 18, height: 18, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'white' }}>+</div>
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files[0] && uploadPhoto(e.target.files[0])} />
          </label>
          <div>
            <h1>{client.name}</h1>
            <p className="page-subtitle">
              {client.phone || 'Sin teléfono'} {client.email ? `· ${client.email}` : ''}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setShowStatement(true)}>📄 Estado de cuenta</button>
          <button className="btn btn-secondary" onClick={() => setShowEdit(true)}>Editar</button>
          <Link to="/clientes" className="btn btn-secondary">Volver</Link>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* Ficha del cliente */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          {client.phone && <InfoField label="Teléfono" value={client.phone} />}
          {client.email && <InfoField label="Email" value={client.email} />}
          {client.dni && <InfoField label="DNI" value={client.dni} />}
          {client.birthday && <InfoField label="Cumpleaños" value={formatDate(client.birthday)} />}
          {client.globalDiscount > 0 && <InfoField label="Bonificación general" value={`${client.globalDiscount}%`} />}
          {client.notes && <InfoField label="Notas" value={client.notes} />}
        </div>
        {(client.responsableName || client.responsablePhone) && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <p style={{ fontSize: 11, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, fontWeight: 700 }}>⚠️ Menor de edad — Adulto responsable</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
              {client.responsableName && <InfoField label="Nombre del responsable" value={client.responsableName} />}
              {client.responsablePhone && <InfoField label="Teléfono del responsable" value={client.responsablePhone} />}
            </div>
          </div>
        )}
        {(client.emergencyContact || client.emergencyPhone || client.medicalNotes) && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <p style={{ fontSize: 11, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Emergencia y salud</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
              {client.emergencyContact && <InfoField label="Contacto de emergencia" value={client.emergencyContact} />}
              {client.emergencyPhone && <InfoField label="Teléfono de emergencia" value={client.emergencyPhone} />}
              {client.medicalNotes && <InfoField label="Observaciones médicas" value={client.medicalNotes} />}
            </div>
          </div>
        )}
      </div>

      <h2 style={{ fontSize: 18, marginBottom: 12 }}>Actividades</h2>
      {client.enrollments.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <h3>No está inscripto en ninguna actividad</h3>
            <p>Ve a la actividad correspondiente para inscribir a este cliente.</p>
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="table-wrap"><table className="table">
            <thead>
              <tr>
                <th>Actividad</th>
                <th>Monto</th>
                <th>Vigencia</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {client.enrollments.map((e) => (
                <tr key={e.id}>
                  <td><Link to={`/actividades/${e.activityId}`}>{e.activity.name}</Link></td>
                  <td>
                    <span>{formatMoney(e.amountDue)}</span>
                    {client.globalDiscount > 0 && (
                      <div style={{ fontSize: 11, color: '#10b981' }}>
                        con {client.globalDiscount}% bonif: {formatMoney(e.amountDue * (1 - client.globalDiscount / 100))}
                      </div>
                    )}
                    <button
                      onClick={() => setEditMontoEnrollment(e)}
                      style={{ display: 'block', marginTop: 3, background: 'none', border: 'none', color: 'var(--primary)', fontSize: 11, cursor: 'pointer', padding: 0 }}
                    >✏️ editar monto</button>
                  </td>
                  <td>
                    <div style={{ fontSize: 12 }}>
                      {e.startDate && <span style={{ color: 'var(--ink-soft)' }}>{formatDate(e.startDate)}</span>}
                      {e.startDate && e.dueDate && <span style={{ color: 'var(--ink-soft)', margin: '0 4px' }}>→</span>}
                      {e.dueDate && (
                        <span style={{ color: new Date(e.dueDate) < new Date() && e.paymentStatus !== 'paid' ? '#dc2626' : 'inherit', fontWeight: new Date(e.dueDate) < new Date() ? 600 : 400 }}>
                          {formatDate(e.dueDate)}
                        </span>
                      )}
                      {!e.dueDate && <span style={{ color: 'var(--ink-soft)' }}>—</span>}
                    </div>
                    {e.bonificada ? (
                      <span onClick={() => setBonModal(e)} title="Editar bonificación" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '1px 6px', borderRadius: 8, background: '#dcfce7', color: '#15803d', fontSize: 11, fontWeight: 600, marginTop: 3 }}>
                        ✓ Beca {e.bonificadaHasta ? `· hasta ${formatDate(e.bonificadaHasta)}` : '· sin límite'}
                      </span>
                    ) : (
                      <button onClick={() => setBonModal(e)} className="btn btn-secondary btn-sm" style={{ fontSize: 10, marginTop: 3, padding: '1px 6px' }}>+ Bonificar</button>
                    )}
                  </td>
                  <td><span className={`pill pill-${e.paymentStatus}`}>{statusLabels[e.paymentStatus]}</span></td>
                  <td></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      <h2 style={{ fontSize: 18, marginBottom: 12 }}>Historial de pagos</h2>
      <div className="card">
        {(() => {
          // Unificar todos los movimientos: cuotas + trabajos/turnos + manuales
          const entries = [];
          client.enrollments.forEach((e) => {
            e.payments.forEach((p) => {
              entries.push({ id: `pay-${p.id}`, date: p.date, kind: 'cuota', label: e.activity.name, amount: p.amount, method: p.method, positive: true });
            });
          });
          if (account?.appointmentMovements) {
            account.appointmentMovements.forEach((m) => {
              entries.push({ id: `appt-${m.id}`, date: m.date, kind: m.paymentStatus === 'paid' ? 'trabajo' : 'turno-pendiente', label: m.description, amount: m.amount, positive: m.paymentStatus === 'paid', pending: m.paymentStatus !== 'paid' });
            });
          }
          if (account?.movements) {
            account.movements.forEach((m) => {
              entries.push({ id: `mov-${m.id}`, date: m.date, kind: m.type === 'abono' ? 'abono' : 'cargo', label: m.description || (m.type === 'abono' ? 'Abono manual' : 'Cargo manual'), amount: m.amount, positive: m.type === 'abono', isManual: true, movId: m.id });
            });
          }
          entries.sort((a, b) => new Date(b.date) - new Date(a.date));

          if (entries.length === 0) return <div className="empty-state"><h3>Sin movimientos registrados</h3></div>;

          const totalPaid = entries.filter(e => e.positive).reduce((s, e) => s + e.amount, 0);
          const kindLabel = { cuota: 'Cuota', trabajo: 'Trabajo', 'turno-pendiente': 'Turno pendiente', abono: 'Abono', cargo: 'Cargo' };
          const kindStyle = {
            cuota:            { background: '#dcfce7', color: '#15803d' },
            trabajo:          { background: '#dcfce7', color: '#15803d' },
            'turno-pendiente':{ background: '#fef9c3', color: '#92400e' },
            abono:            { background: '#dbeafe', color: '#1d4ed8' },
            cargo:            { background: '#fee2e2', color: '#dc2626' },
          };
          return (
            <>
              <div style={{ display: 'flex', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
                <div>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-soft)' }}>Total cobrado</p>
                  <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#10b981' }}>{formatMoney(totalPaid)}</p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-soft)' }}>Movimientos</p>
                  <p style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{entries.length}</p>
                </div>
              </div>
              <div className="table-wrap"><table className="table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Descripción</th>
                    <th>Monto</th>
                    <th>Método</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <td>{formatDate(e.date)}</td>
                      <td><span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, fontWeight: 600, ...kindStyle[e.kind] }}>{kindLabel[e.kind]}</span></td>
                      <td style={{ fontSize: 13 }}>{e.label || '-'}</td>
                      <td style={{ fontWeight: 600, color: e.positive ? '#10b981' : e.pending ? '#d97706' : '#dc2626' }}>
                        {e.positive ? '+' : e.pending ? '' : '-'}{formatMoney(e.amount)}
                      </td>
                      <td>{e.method || '-'}</td>
                      <td>
                        {e.isManual && (
                          <button onClick={async () => { await api.delete(`/clients/${id}/account/${e.movId}`); loadAccount(); }}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16, padding: '0 2px' }}>×</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </>
          );
        })()}
      </div>

      {/* Cuenta Corriente — saldo y acción */}
      <h2 style={{ fontSize: 18, marginBottom: 12, marginTop: 24 }}>Cuenta corriente</h2>
      <div className="card" style={{ marginBottom: 24 }}>
        {account ? (
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 120 }}>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Saldo</p>
              <p style={{ margin: 0, fontSize: 26, fontWeight: 700, color: account.balance > 0 ? '#dc2626' : '#10b981' }}>
                {account.balance > 0 ? `Debe ${formatMoney(account.balance)}` : account.balance < 0 ? `A favor ${formatMoney(Math.abs(account.balance))}` : 'Al día ✓'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-soft)' }}>Cargado</p>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{formatMoney(account.totalCharged + account.manualCargos + (account.apptCharged || 0))}</p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-soft)' }}>Pagado</p>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#10b981' }}>{formatMoney(account.totalPaid + account.manualAbonos + (account.apptPaid || 0))}</p>
              </div>
            </div>
            <button className="btn btn-secondary" style={{ fontSize: 13 }} onClick={() => setMovModal(true)}>+ Movimiento</button>
          </div>
        ) : (
          <p style={{ color: 'var(--ink-soft)', fontSize: 14, textAlign: 'center', margin: 0 }}>Cargando...</p>
        )}
      </div>

      {/* Notas del cliente */}
      <h2 style={{ fontSize: 18, marginBottom: 12, marginTop: 24 }}>Notas</h2>
      <div className="card" style={{ marginBottom: 24 }}>
        <form onSubmit={addNote} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Agregar nota..."
            style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: 'var(--surface)' }}
          />
          <button type="submit" className="btn btn-primary" disabled={savingNote || !newNote.trim()}>
            {savingNote ? '...' : 'Agregar'}
          </button>
        </form>
        {notes.length === 0 ? (
          <p style={{ color: 'var(--ink-soft)', fontSize: 14, textAlign: 'center', padding: '12px 0' }}>Sin notas aún.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {notes.map((n) => (
              <div key={n.id} style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 14 }}>{n.content}</p>
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--ink-soft)' }}>
                    {new Date(n.createdAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                </div>
                <button onClick={() => deleteNote(n.id)} title="Eliminar" style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16, padding: '0 4px', lineHeight: 1 }}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>


      {bonModal && (
        <BonificacionModal
          enrollment={bonModal}
          onClose={() => setBonModal(null)}
          onSaved={() => { setBonModal(null); load(); }}
        />
      )}
      {movModal && (
        <MovimientoModal
          clientId={id}
          onClose={() => setMovModal(false)}
          onSaved={() => { setMovModal(false); loadAccount(); }}
        />
      )}
      {editMontoEnrollment && (
        <QuickEditMontoModal
          enrollment={editMontoEnrollment}
          onClose={() => setEditMontoEnrollment(null)}
          onSaved={() => { setEditMontoEnrollment(null); load(); }}
        />
      )}
      {showEdit && (
        <ClientModal
          client={client}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); load(); }}
        />
      )}
      {showStatement && (
        <AccountStatement client={client} account={account} onClose={() => setShowStatement(false)} />
      )}
    </div>
  );
}

function AccountStatement({ client, account, onClose }) {
  const allPayments = client.enrollments
    .flatMap((e) => e.payments.map((p) => ({ ...p, activityName: e.activity.name })))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const totalPaid = allPayments.reduce((s, p) => s + p.amount, 0);
  // Saldo real reconciliado (todas las cuotas + movimientos manuales): usa la cuenta
  // corriente autoritativa y cae a un cálculo por cuotas si todavía no cargó.
  const balance = account
    ? account.balance
    : client.enrollments
        .flatMap((e) => e.cuotas || [])
        .reduce((s, c) => s + Math.max(0, c.amountDue - (c.discount || 0)), 0) - totalPaid;
  const today = new Date().toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' });

  function handlePrint() {
    window.print();
  }

  return (
    <div className="modal-overlay no-print">
      <div
        className="modal"
        id="statement-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 620, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Header acciones - oculto al imprimir */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0 }}>Estado de cuenta</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={handlePrint}>🖨 Imprimir / Guardar PDF</button>
            <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
          </div>
        </div>

        {/* Contenido imprimible */}
        <div style={{ fontFamily: 'sans-serif', color: '#111' }}>
          {/* Encabezado del documento */}
          <div style={{ borderBottom: '2px solid #3D5A4C', paddingBottom: 16, marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 22, color: '#3D5A4C' }}>Estado de Cuenta</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#666' }}>Generado el {today}</p>
          </div>

          {/* Datos del cliente */}
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, margin: '0 0 8px', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>Datos del cliente</h3>
            <div className="two-col-grid" style={{ gap: '6px 20px', fontSize: 14 }}>
              <div><span style={{ color: '#666' }}>Nombre:</span> <strong>{client.name}</strong></div>
              {client.phone && <div><span style={{ color: '#666' }}>Teléfono:</span> {client.phone}</div>}
              {client.email && <div><span style={{ color: '#666' }}>Email:</span> {client.email}</div>}
              {client.birthday && <div><span style={{ color: '#666' }}>Cumpleaños:</span> {formatDate(client.birthday)}</div>}
            </div>
          </div>

          {/* Inscripciones activas */}
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, margin: '0 0 8px', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>Inscripciones activas</h3>
            {client.enrollments.length === 0 ? (
              <p style={{ fontSize: 14, color: '#666' }}>Sin inscripciones.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: 'var(--bg)' }}>
                    <th style={{ textAlign: 'left', padding: '7px 10px', fontWeight: 600 }}>Actividad</th>
                    <th style={{ textAlign: 'right', padding: '7px 10px', fontWeight: 600 }}>Cuota</th>
                    <th style={{ textAlign: 'right', padding: '7px 10px', fontWeight: 600 }}>Descuento</th>
                    <th style={{ textAlign: 'right', padding: '7px 10px', fontWeight: 600 }}>Vence</th>
                    <th style={{ textAlign: 'center', padding: '7px 10px', fontWeight: 600 }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {client.enrollments.map((e) => {
                    const net = Math.max(0, e.amountDue - (e.discount || 0));
                    const statusColor = { paid: '#16a34a', pending: '#b45309', overdue: '#dc2626' };
                    const statusText = { paid: 'Pagado', pending: 'Pendiente', overdue: 'Vencido' };
                    return (
                      <tr key={e.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '7px 10px' }}>{e.activity.name}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right' }}>{formatMoney(e.amountDue)}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', color: '#666' }}>
                          {e.discount > 0 ? `-${formatMoney(e.discount)}` : '-'}
                        </td>
                        <td style={{ padding: '7px 10px', textAlign: 'right' }}>{formatDate(e.dueDate)}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'center', color: statusColor[e.paymentStatus], fontWeight: 600 }}>
                          {statusText[e.paymentStatus]}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Historial de pagos */}
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, margin: '0 0 8px', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>Historial de pagos</h3>
            {allPayments.length === 0 ? (
              <p style={{ fontSize: 14, color: '#666' }}>Sin pagos registrados.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: 'var(--bg)' }}>
                    <th style={{ textAlign: 'left', padding: '7px 10px', fontWeight: 600 }}>Fecha</th>
                    <th style={{ textAlign: 'left', padding: '7px 10px', fontWeight: 600 }}>Actividad</th>
                    <th style={{ textAlign: 'left', padding: '7px 10px', fontWeight: 600 }}>Método</th>
                    <th style={{ textAlign: 'right', padding: '7px 10px', fontWeight: 600 }}>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {allPayments.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '7px 10px' }}>{formatDate(p.date)}</td>
                      <td style={{ padding: '7px 10px' }}>{p.activityName}</td>
                      <td style={{ padding: '7px 10px', color: '#666' }}>{p.method || '-'}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>{formatMoney(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Resumen */}
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 18px' }}>
            <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Resumen</h3>
            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', fontSize: 14 }}>
              <div>
                <p style={{ margin: 0, color: '#666', fontSize: 12 }}>Total abonado</p>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#16a34a' }}>{formatMoney(totalPaid)}</p>
              </div>
              <div>
                <p style={{ margin: 0, color: '#666', fontSize: 12 }}>Saldo</p>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: balance > 0 ? '#dc2626' : '#16a34a' }}>
                  {balance > 0 ? `Debe ${formatMoney(balance)}` : balance < 0 ? `A favor ${formatMoney(Math.abs(balance))}` : 'Al día'}
                </p>
              </div>
              <div>
                <p style={{ margin: 0, color: '#666', fontSize: 12 }}>Cantidad de pagos</p>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{allPayments.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickEditMontoModal({ enrollment, onClose, onSaved }) {
  const [amount, setAmount] = useState(String(enrollment.amountDue));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!amount || isNaN(Number(amount))) return setError('Ingresá un monto válido');
    setSaving(true);
    try {
      await api.patch(`/enrollments/${enrollment.id}`, { amountDue: Number(amount) });
      onSaved();
    } catch {
      setError('No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <h2>Editar monto — {enrollment.activity.name}</h2>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Monto mensual ($)</label>
            <input
              type="number" min="0" step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InfoField({ label, value }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</p>
      <p style={{ margin: 0, fontSize: 14 }}>{value}</p>
    </div>
  );
}

function BonificacionModal({ enrollment, onClose, onSaved }) {
  const [bonificada, setBonificada] = useState(!!enrollment.bonificada);
  const [sinLimite, setSinLimite] = useState(!enrollment.bonificadaHasta);
  const [hasta, setHasta] = useState(
    enrollment.bonificadaHasta
      ? new Date(enrollment.bonificadaHasta).toISOString().slice(0, 10)
      : ''
  );
  const [montoGratis, setMontoGratis] = useState(
    enrollment.bonificada && enrollment.amountDue === 0
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await import('../api/client').then(({ default: api }) =>
        api.patch(`/enrollments/${enrollment.id}`, {
          bonificada,
          bonificadaHasta: bonificada && !sinLimite && hasta ? hasta : null,
          ...(bonificada && montoGratis ? { amountDue: 0, discount: 0 } : {}),
        })
      );
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginBottom: 4 }}>Bonificación — {enrollment.activity.name}</h2>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 20 }}>
          Indicá si esta actividad está bonificada para <strong>{enrollment.client?.name || 'este cliente'}</strong>.
        </p>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, cursor: 'pointer', padding: '12px 14px', borderRadius: 10, border: `2px solid ${bonificada ? '#10b981' : 'var(--border)'}`, background: bonificada ? '#f0fdf4' : 'var(--surface)', transition: 'all .15s' }}>
            <input
              type="checkbox"
              checked={bonificada}
              onChange={(e) => setBonificada(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: '#10b981', cursor: 'pointer' }}
            />
            <div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>Actividad bonificada</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ink-soft)' }}>El cliente no paga o paga un monto reducido</p>
            </div>
          </label>

          {bonificada && (
            <div style={{ paddingLeft: 4 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'pointer', fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={montoGratis}
                  onChange={(e) => setMontoGratis(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: '#10b981' }}
                />
                Pone el monto a $0 (beca total)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, cursor: 'pointer', fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={sinLimite}
                  onChange={(e) => setSinLimite(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: '#6366f1' }}
                />
                Sin tiempo determinado
              </label>

              {!sinLimite && (
                <div className="field">
                  <label>Bonificado hasta</label>
                  <input
                    type="date"
                    value={hasta}
                    onChange={(e) => setHasta(e.target.value)}
                    required={!sinLimite}
                  />
                </div>
              )}
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MovimientoModal({ clientId, onClose, onSaved }) {
  const [form, setForm] = useState({ type: 'cargo', amount: '', description: '', date: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) return setError('Monto inválido');
    setSaving(true);
    try {
      await api.post(`/clients/${clientId}/account`, { type: form.type, amount: Number(form.amount), description: form.description || undefined, date: form.date });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar');
    } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
        <h2>Nuevo movimiento</h2>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Tipo</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['cargo', '↑ Cargo (debe)'], ['abono', '↓ Abono (pagó)']].map(([val, label]) => (
                <label key={val} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, border: `2px solid ${form.type === val ? (val === 'cargo' ? '#dc2626' : '#10b981') : 'var(--border)'}`, background: form.type === val ? (val === 'cargo' ? '#fee2e2' : '#dcfce7') : 'var(--surface)', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all .15s' }}>
                  <input type="radio" name="type" value={val} checked={form.type === val} onChange={() => set('type', val)} style={{ display: 'none' }} />
                  <span style={{ color: form.type === val ? (val === 'cargo' ? '#dc2626' : '#15803d') : 'var(--ink)' }}>{label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="two-col-grid">
            <div className="field">
              <label>Monto ($)</label>
              <input type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => set('amount', e.target.value)} required autoFocus />
            </div>
            <div className="field">
              <label>Fecha</label>
              <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Descripción (opcional)</label>
            <input value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Ej: Pago parcial, ajuste de cuota..." />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
