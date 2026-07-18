import { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import api from '../api/client';

function getAge(birthday) {
  if (!birthday) return null;
  const today = new Date();
  const bday = new Date(birthday);
  let age = today.getFullYear() - bday.getFullYear();
  const m = today.getMonth() - bday.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < bday.getDate())) age--;
  return age;
}

export default function ClientModal({ client, onClose, onSaved }) {
  const isEdit = !!client;
  const [padronLoading, setPadronLoading] = useState(false);
  const [form, setForm] = useState({
    name: client?.name || '',
    phone: client?.phone || '',
    email: client?.email || '',
    dni: client?.dni || '',
    cuit: client?.cuit || '',
    notes: client?.notes || '',
    birthday: client?.birthday ? client.birthday.slice(0, 10) : '',
    emergencyContact: client?.emergencyContact || '',
    emergencyPhone: client?.emergencyPhone || '',
    medicalNotes: client?.medicalNotes || '',
    responsableName: client?.responsableName || '',
    responsablePhone: client?.responsablePhone || '',
    globalDiscount: client?.globalDiscount != null ? String(client.globalDiscount) : '0',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const [showExtra, setShowExtra] = useState(
    !!(client?.emergencyContact || client?.emergencyPhone || client?.medicalNotes)
  );
  const [activities, setActivities] = useState([]);
  const [assignActivityId, setAssignActivityId] = useState('');

  useEffect(() => {
    if (!isEdit) api.get('/activities').then((r) => setActivities(r.data)).catch(() => {});
  }, [isEdit]);

  const age = getAge(form.birthday);
  const isMinor = age !== null && age < 18;

  async function buscarPadronCli() {
    const cuit = String(form.cuit || '').replace(/\D/g, '');
    if (cuit.length < 11) { alert('Ingresá un CUIT válido (11 dígitos).'); return; }
    setPadronLoading(true);
    try {
      const r = await api.post('/facturacion/padron', { cuit });
      if (r.data.razonSocial) setForm((f) => ({ ...f, name: r.data.razonSocial }));
      else alert('No se encontraron datos para ese CUIT.');
    } catch (e) { alert(e.response?.data?.error || 'No se pudo consultar el padrón'); }
    finally { setPadronLoading(false); }
  }

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        phone: form.phone || undefined,
        email: form.email || undefined,
        dni: form.dni || undefined,
        cuit: form.cuit || undefined,
        notes: form.notes || undefined,
        birthday: form.birthday || undefined,
        emergencyContact: form.emergencyContact || undefined,
        emergencyPhone: form.emergencyPhone || undefined,
        medicalNotes: form.medicalNotes || undefined,
        responsableName: form.responsableName || undefined,
        responsablePhone: form.responsablePhone || undefined,
        globalDiscount: Number(form.globalDiscount) || 0,
      };
      if (isEdit) {
        await api.put(`/clients/${client.id}`, payload);
      } else {
        const res = await api.post('/clients', payload);
        // Inscripción inmediata a una actividad (opcional)
        if (assignActivityId && res?.data?.id) {
          const act = activities.find((a) => a.id === assignActivityId);
          try {
            await api.post('/enrollments', {
              clientId: res.data.id,
              activityId: assignActivityId,
              amountDue: act ? Number(act.price) || 0 : 0,
              startDate: new Date().toISOString().slice(0, 10),
            });
          } catch (_) { /* si falla la inscripción, el cliente igual quedó creado */ }
        }
      }
      toast(isEdit ? 'Cliente actualizado' : 'Cliente creado', 'success');
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo guardar el cliente');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isEdit ? 'Editar cliente' : 'Nuevo cliente'}</h2>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Nombre *</label>
            <input value={form.name} onChange={(e) => update('name', e.target.value)} required />
          </div>
          <div className="two-col-grid">
            <div className="field">
              <label>Teléfono</label>
              <input value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="Ej: 11 5555 5555" />
            </div>
            <div className="field">
              <label>Fecha de nacimiento</label>
              <input type="date" value={form.birthday} onChange={(e) => update('birthday', e.target.value)} />
            </div>
          </div>
          <div className="two-col-grid">
            <div className="field">
              <label>Email</label>
              <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
            </div>
            <div className="field">
              <label>DNI</label>
              <input value={form.dni} onChange={(e) => update('dni', e.target.value)} placeholder="Ej: 12345678" />
            </div>
          </div>
          <div className="two-col-grid">
            <div className="field">
              <label>CUIT / CUIL</label>
              <div style={{ display: 'flex', gap: 6 }}>
              <input value={form.cuit} onChange={(e) => update('cuit', e.target.value)} placeholder="XX-XXXXXXXX-X" style={{ flex: 1 }} />
              <button type="button" className="btn btn-secondary" style={{ padding: '0 10px', whiteSpace: 'nowrap' }} onClick={buscarPadronCli} disabled={padronLoading} title="Autocompletar nombre desde AFIP">{padronLoading ? '…' : '🔍 AFIP'}</button>
            </div>
            </div>
            <div />
          </div>
          <div className="two-col-grid">
            <div className="field">
              <label>Bonificación general (%)</label>
              <input
                type="number" min="0" max="100" step="1"
                value={form.globalDiscount}
                onChange={(e) => update('globalDiscount', e.target.value)}
                placeholder="0"
              />
            </div>
            <div />
          </div>
          <div className="field">
            <label>Notas</label>
            <textarea rows="2" value={form.notes} onChange={(e) => update('notes', e.target.value)} />
          </div>

          {/* Adulto responsable — solo si es menor de 18 */}
          {isMinor && (
            <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
              <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: '#92400e' }}>
                ⚠️ Menor de edad — Adulto responsable
              </p>
              <div className="two-col-grid">
                <div className="field">
                  <label>Nombre del responsable</label>
                  <input value={form.responsableName} onChange={(e) => update('responsableName', e.target.value)} placeholder="Nombre completo" />
                </div>
                <div className="field">
                  <label>Teléfono del responsable</label>
                  <input value={form.responsablePhone} onChange={(e) => update('responsablePhone', e.target.value)} placeholder="11 5555 5555" />
                </div>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowExtra(!showExtra)}
            style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 14, padding: '4px 0', cursor: 'pointer', marginBottom: 8 }}
          >
            {showExtra ? '▲ Ocultar datos extra' : '▼ Emergencia y datos médicos'}
          </button>
          {showExtra && (
            <>
              <div className="two-col-grid">
                <div className="field">
                  <label>Contacto de emergencia</label>
                  <input value={form.emergencyContact} onChange={(e) => update('emergencyContact', e.target.value)} placeholder="Nombre y relación" />
                </div>
                <div className="field">
                  <label>Teléfono de emergencia</label>
                  <input value={form.emergencyPhone} onChange={(e) => update('emergencyPhone', e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label>Observaciones médicas</label>
                <textarea rows="2" value={form.medicalNotes} onChange={(e) => update('medicalNotes', e.target.value)} placeholder="Alergias, condiciones, medicación..." />
              </div>
            </>
          )}
          {!isEdit && activities.length > 0 && (
            <div className="field">
              <label>Inscribir a una actividad (opcional)</label>
              <select value={assignActivityId} onChange={(e) => setAssignActivityId(e.target.value)}>
                <option value="">No inscribir por ahora</option>
                {activities.map((a) => (<option key={a.id} value={a.id}>{a.name} — ${Number(a.price).toLocaleString('es-AR')}</option>))}
              </select>
            </div>
          )}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
