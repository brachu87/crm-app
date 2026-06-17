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
  const [payModal, setPayModal] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showStatement, setShowStatement] = useState(false);
  const [error, setError] = useState('');

  function load() {
    api.get(`/clients/${id}`).then((res) => setClient(res.data)).finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  async function registerPayment(enrollmentId, amount, method) {
    try {
      await api.post(`/enrollments/${enrollmentId}/pay`, { amount: Number(amount), method: method || undefined });
      setPayModal(null);
      load();
    } catch {
      setError('No se pudo registrar el pago');
    }
  }

  if (loading) return <p>Cargando...</p>;
  if (!client) return <p>Cliente no encontrado.</p>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{client.name}</h1>
          <p className="page-subtitle">
            {client.phone || 'Sin teléfono'} {client.email ? `· ${client.email}` : ''}
          </p>
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
          {client.birthday && <InfoField label="Cumpleaños" value={formatDate(client.birthday)} />}
          {client.notes && <InfoField label="Notas" value={client.notes} />}
        </div>
        {(client.emergencyContact || client.emergencyPhone || client.medicalNotes) && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
            <p style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Emergencia y salud</p>
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
                <th>Vence</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {client.enrollments.map((e) => (
                <tr key={e.id}>
                  <td><Link to={`/actividades/${e.activityId}`}>{e.activity.name}</Link></td>
                  <td>{formatMoney(e.amountDue)}</td>
                  <td>{formatDate(e.dueDate)}</td>
                  <td><span className={`pill pill-${e.paymentStatus}`}>{statusLabels[e.paymentStatus]}</span></td>
                  <td>
                    {e.paymentStatus !== 'paid' && (
                      <button className="btn btn-secondary btn-sm" onClick={() => setPayModal(e)}>Registrar pago</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      <h2 style={{ fontSize: 18, marginBottom: 12 }}>Historial de pagos</h2>
      <div className="card">
        {client.enrollments.every((e) => e.payments.length === 0) ? (
          <div className="empty-state">
            <h3>Sin pagos registrados</h3>
          </div>
        ) : (() => {
          const allPayments = client.enrollments
            .flatMap((e) => e.payments.map((p) => ({ ...p, activityName: e.activity.name })))
            .sort((a, b) => new Date(b.date) - new Date(a.date));
          const totalPaid = allPayments.reduce((s, p) => s + p.amount, 0);
          return (
            <>
              <div style={{ display: 'flex', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
                <div>
                  <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>Total pagado</p>
                  <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#10b981' }}>{formatMoney(totalPaid)}</p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>Cantidad de pagos</p>
                  <p style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{allPayments.length}</p>
                </div>
              </div>
              <div className="table-wrap"><table className="table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Actividad</th>
                    <th>Monto</th>
                    <th>Método</th>
                  </tr>
                </thead>
                <tbody>
                  {allPayments.map((p) => (
                    <tr key={p.id}>
                      <td>{formatDate(p.date)}</td>
                      <td>{p.activityName}</td>
                      <td style={{ fontWeight: 600, color: '#10b981' }}>{formatMoney(p.amount)}</td>
                      <td>{p.method || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </>
          );
        })()}
      </div>

      {payModal && (
        <PayModal
          enrollment={payModal}
          onClose={() => setPayModal(null)}
          onConfirm={registerPayment}
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
        <AccountStatement client={client} onClose={() => setShowStatement(false)} />
      )}
    </div>
  );
}

function AccountStatement({ client, onClose }) {
  const allPayments = client.enrollments
    .flatMap((e) => e.payments.map((p) => ({ ...p, activityName: e.activity.name })))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const totalPaid = allPayments.reduce((s, p) => s + p.amount, 0);
  const totalPending = client.enrollments
    .filter((e) => e.paymentStatus !== 'paid')
    .reduce((s, e) => s + (e.amountDue - (e.discount || 0)), 0);
  const today = new Date().toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' });

  function handlePrint() {
    window.print();
  }

  return (
    <div className="modal-overlay no-print" onClick={onClose}>
      <div
        className="modal"
        id="statement-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 620, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Header acciones - oculto al imprimir */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0 }}>Estado de cuenta</h2>
          <div style={{ display: 'flex', gap: 8 }}>
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
            <h3 style={{ fontSize: 16, margin: '0 0 8px', borderBottom: '1px solid #e5e7eb', paddingBottom: 6 }}>Datos del cliente</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px', fontSize: 14 }}>
              <div><span style={{ color: '#666' }}>Nombre:</span> <strong>{client.name}</strong></div>
              {client.phone && <div><span style={{ color: '#666' }}>Teléfono:</span> {client.phone}</div>}
              {client.email && <div><span style={{ color: '#666' }}>Email:</span> {client.email}</div>}
              {client.birthday && <div><span style={{ color: '#666' }}>Cumpleaños:</span> {formatDate(client.birthday)}</div>}
            </div>
          </div>

          {/* Inscripciones activas */}
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, margin: '0 0 8px', borderBottom: '1px solid #e5e7eb', paddingBottom: 6 }}>Inscripciones activas</h3>
            {client.enrollments.length === 0 ? (
              <p style={{ fontSize: 14, color: '#666' }}>Sin inscripciones.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: '#f3f4f6' }}>
                    <th style={{ textAlign: 'left', padding: '7px 10px', fontWeight: 600 }}>Actividad</th>
                    <th style={{ textAlign: 'right', padding: '7px 10px', fontWeight: 600 }}>Cuota</th>
                    <th style={{ textAlign: 'right', padding: '7px 10px', fontWeight: 600 }}>Descuento</th>
                    <th style={{ textAlign: 'right', padding: '7px 10px', fontWeight: 600 }}>Vence</th>
                    <th style={{ textAlign: 'center', padding: '7px 10px', fontWeight: 600 }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {client.enrollments.map((e) => {
                    const net = e.amountDue - (e.discount || 0);
                    const statusColor = { paid: '#16a34a', pending: '#b45309', overdue: '#dc2626' };
                    const statusText = { paid: 'Pagado', pending: 'Pendiente', overdue: 'Vencido' };
                    return (
                      <tr key={e.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
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
            <h3 style={{ fontSize: 16, margin: '0 0 8px', borderBottom: '1px solid #e5e7eb', paddingBottom: 6 }}>Historial de pagos</h3>
            {allPayments.length === 0 ? (
              <p style={{ fontSize: 14, color: '#666' }}>Sin pagos registrados.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: '#f3f4f6' }}>
                    <th style={{ textAlign: 'left', padding: '7px 10px', fontWeight: 600 }}>Fecha</th>
                    <th style={{ textAlign: 'left', padding: '7px 10px', fontWeight: 600 }}>Actividad</th>
                    <th style={{ textAlign: 'left', padding: '7px 10px', fontWeight: 600 }}>Método</th>
                    <th style={{ textAlign: 'right', padding: '7px 10px', fontWeight: 600 }}>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {allPayments.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
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
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '14px 18px' }}>
            <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Resumen</h3>
            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', fontSize: 14 }}>
              <div>
                <p style={{ margin: 0, color: '#666', fontSize: 12 }}>Total abonado</p>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#16a34a' }}>{formatMoney(totalPaid)}</p>
              </div>
              <div>
                <p style={{ margin: 0, color: '#666', fontSize: 12 }}>Saldo pendiente</p>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: totalPending > 0 ? '#dc2626' : '#16a34a' }}>{formatMoney(totalPending)}</p>
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

function InfoField({ label, value }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</p>
      <p style={{ margin: 0, fontSize: 14 }}>{value}</p>
    </div>
  );
}

function PayModal({ enrollment, onClose, onConfirm }) {
  const [amount, setAmount] = useState(enrollment.amountDue);
  const [method, setMethod] = useState('efectivo');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    await onConfirm(enrollment.id, amount, method);
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Registrar pago — {enrollment.activity.name}</h2>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Monto</label>
            <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div className="field">
            <label>Método</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="mercadopago">Mercado Pago</option>
              <option value="tarjeta">Tarjeta</option>
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Confirmar pago'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
