import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const STEPS = ['Bienvenida', 'Tu negocio', 'Primera actividad', 'Primer cliente'];

const CATEGORIES = [
  { value: 'gym', label: '🏋️ Gimnasio' },
  { value: 'pilates', label: '🧘 Pilates / Yoga' },
  { value: 'crossfit', label: '💪 CrossFit / Funcional' },
  { value: 'natacion', label: '🏊 Natación' },
  { value: 'artes_marciales', label: '🥋 Artes marciales' },
  { value: 'danza', label: '💃 Danza / Baile' },
  { value: 'otro', label: '🏪 Otro' },
];

export default function OnboardingWizard({ onComplete }) {
  const { business, updateBusiness } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Step 2 — negocio
  const [bizName, setBizName] = useState(business?.name || '');
  const [bizCategory, setBizCategory] = useState(business?.category || 'gym');
  const [bizPhone, setBizPhone] = useState(business?.phone || '');

  // Step 3 — actividad
  const [actName, setActName] = useState('');
  const [actPrice, setActPrice] = useState('');

  // Step 4 — cliente
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');

  const progress = (step / (STEPS.length - 1)) * 100;

  async function handleNext() {
    setError('');
    if (step === 1) {
      if (!bizName.trim()) return setError('Ingresá el nombre de tu negocio');
      setSaving(true);
      try {
        const res = await api.put('/business', { name: bizName, category: bizCategory, phone: bizPhone });
        updateBusiness(res.data);
      } catch { setError('No se pudo guardar. Intentá de nuevo.'); setSaving(false); return; }
      setSaving(false);
    }
    if (step === 2) {
      if (!actName.trim()) return setError('Ingresá el nombre de la actividad');
      setSaving(true);
      try {
        await api.post('/activities', { name: actName, price: Number(actPrice) || 0 });
      } catch { setError('No se pudo guardar la actividad.'); setSaving(false); return; }
      setSaving(false);
    }
    if (step === 3) {
      if (!clientName.trim()) return setError('Ingresá el nombre del cliente');
      setSaving(true);
      try {
        await api.post('/clients', { name: clientName, phone: clientPhone });
      } catch { setError('No se pudo guardar el cliente.'); setSaving(false); return; }
      setSaving(false);
      onComplete();
      return;
    }
    setStep(s => s + 1);
  }

  function handleSkip() { onComplete(); }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 20, width: '100%', maxWidth: 520,
        boxShadow: '0 24px 60px rgba(0,0,0,0.25)', overflow: 'hidden',
      }}>
        {/* Barra de progreso */}
        <div style={{ height: 4, background: 'var(--border)' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'var(--primary)', transition: 'width 0.4s ease' }} />
        </div>

        {/* Indicador de pasos */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 24px 0', gap: 4 }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', fontSize: 12, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: i < step ? 'var(--primary)' : i === step ? 'var(--accent)' : 'var(--border)',
                color: i <= step ? '#fff' : 'var(--ink-soft)',
                transition: 'all 0.3s',
              }}>
                {i < step ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 10, color: i === step ? 'var(--ink)' : 'var(--ink-soft)', marginTop: 4, textAlign: 'center' }}>{s}</span>
            </div>
          ))}
        </div>

        {/* Contenido */}
        <div style={{ padding: '28px 32px 24px' }}>
          {step === 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>👋</div>
              <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 10, color: 'var(--primary)' }}>¡Bienvenido a Gestumio!</h2>
              <p style={{ color: 'var(--ink-soft)', fontSize: 15, lineHeight: 1.6, marginBottom: 8 }}>
                Vamos a configurar tu cuenta en <strong>3 pasos rápidos</strong> para que puedas empezar a gestionar tu negocio hoy mismo.
              </p>
              <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>Solo te va a llevar 2 minutos.</p>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, color: 'var(--primary)' }}>Contanos sobre tu negocio</h2>
              <p style={{ color: 'var(--ink-soft)', fontSize: 14, marginBottom: 20 }}>Estos datos aparecen en tus reportes y documentos.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="field">
                  <label>Nombre del negocio *</label>
                  <input value={bizName} onChange={e => setBizName(e.target.value)} placeholder="Ej: Gimnasio El Campeón" autoFocus />
                </div>
                <div className="field">
                  <label>Rubro</label>
                  <select value={bizCategory} onChange={e => setBizCategory(e.target.value)}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Teléfono del negocio</label>
                  <input value={bizPhone} onChange={e => setBizPhone(e.target.value)} placeholder="Ej: 1134567890" inputMode="tel" />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, color: 'var(--primary)' }}>¿Qué actividades ofrecés?</h2>
              <p style={{ color: 'var(--ink-soft)', fontSize: 14, marginBottom: 20 }}>Cargá la principal. Después podés agregar más desde el menú Actividades.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="field">
                  <label>Nombre de la actividad *</label>
                  <input value={actName} onChange={e => setActName(e.target.value)} placeholder="Ej: Musculación, Pilates, Natación..." autoFocus />
                </div>
                <div className="field">
                  <label>Precio mensual (ARS)</label>
                  <input value={actPrice} onChange={e => setActPrice(e.target.value)} placeholder="Ej: 30000" inputMode="numeric" />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, color: 'var(--primary)' }}>Agregá tu primer cliente</h2>
              <p style={{ color: 'var(--ink-soft)', fontSize: 14, marginBottom: 20 }}>Después podés importar todos tus clientes desde un CSV o cargarlos de a uno.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="field">
                  <label>Nombre y apellido *</label>
                  <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Ej: Juan Pérez" autoFocus />
                </div>
                <div className="field">
                  <label>Teléfono (WhatsApp)</label>
                  <input value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="Ej: 1134567890" inputMode="tel" />
                </div>
              </div>
            </div>
          )}

          {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 12 }}>{error}</p>}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 32px 28px', gap: 12 }}>
          <button
            onClick={handleSkip}
            style={{ background: 'none', border: 'none', color: 'var(--ink-soft)', fontSize: 14, cursor: 'pointer', textDecoration: 'underline' }}
          >
            Saltar configuración
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            {step > 0 && (
              <button className="btn btn-secondary" onClick={() => { setError(''); setStep(s => s - 1); }} disabled={saving}>
                ← Atrás
              </button>
            )}
            <button
              className="btn btn-primary"
              onClick={handleNext}
              disabled={saving}
              style={{ minWidth: 120 }}
            >
              {saving ? 'Guardando...' : step === STEPS.length - 1 ? '¡Listo! →' : 'Siguiente →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
