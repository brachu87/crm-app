import { useState } from 'react';
import api from '../api/client';

export default function ClientModal({ client, onClose, onSaved }) {
  const isEdit = !!client;
  const [form, setForm] = useState({
    name: client?.name || '',
    phone: client?.phone || '',
    email: client?.email || '',
    dni: client?.dni || '',
    notes: client?.notes || '',
    birthday: client?.birthday ? client.birthday.slice(0, 10) : '',
    emergencyContact: client?.emergencyContact || '',
    emergencyPhone: client?.emergencyPhone || '',
    medicalNotes: client?.medicalNotes || '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showExtra, setShowExtra] = useState(
    !!(client?.emergencyContact || client?.emergencyPhone || client?.medicalNotes)
  );

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
        notes: form.notes || undefined,
        birthday: form.birthday || undefined,
        emergencyContact: form.emergencyContact || undefined,
        emergencyPhone: form.emergencyPhone || undefined,
        medicalNotes: form.medicalNotes || undefined,
      };
      if (isEdit) {
        await api.put(`/clients/${client.id}`, payload);
      } else {
        await api.post('/clients', payload);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo guardar el cliente');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isEdit ? 'Editar cliente' : 'Nuevo cliente'}</h2>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Nombre *</label>
            <input value={form.name} onChange={(e) => update('name', e.target.value)} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Teléfono</label>
              <input value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="Ej: 11 5555 5555" />
            </div>
            <div className="field">
              <label>Fecha de nacimiento</label>
              <input type="date" value={form.birthday} onChange={(e) => update('birthday', e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Email</label>
              <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
            </div>
            <div className="field">
              <label>DNI</label>
              <input value={form.dni} onChange={(e) => update('dni', e.target.value)} placeholder="Ej: 12345678" />
            </div>
          </div>
          <div className="field">
            <label>Notas</label>
            <textarea rows="2" value={form.notes} onChange={(e) => update('notes', e.target.value)} />
          </div>
          <button
            type="button"
            onClick={() => setShowExtra(!showExtra)}
            style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 13, padding: '4px 0', cursor: 'pointer', marginBottom: 8 }}
          >
            {showExtra ? '▲ Ocultar datos extra' : '▼ Emergencia y datos médicos'}
          </button>
          {showExtra && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
