import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';

function ZentricLogo({ size = 52 }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 20 }}>
      <svg width={size} height={size} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
        <rect width="48" height="48" rx="11" fill="#3D5A4C"/>
        <line x1="11" y1="14" x2="37" y2="14" stroke="white" strokeWidth="5" strokeLinecap="round"/>
        <line x1="37" y1="14" x2="11" y2="34" stroke="#E8674A" strokeWidth="5" strokeLinecap="round"/>
        <line x1="11" y1="34" x2="37" y2="34" stroke="white" strokeWidth="5" strokeLinecap="round"/>
      </svg>
      <div style={{ marginTop: 10, fontSize: 30, fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1 }}>
        <span style={{ color: '#3D5A4C' }}>z</span><span style={{ color: 'var(--ink)' }}>entric</span>
      </div>
    </div>
  );
}

export default function Register() {
  const location = useLocation();
  const googleState = location.state || {};

  const [googleCred, setGoogleCred] = useState(googleState.googleCredential || null);
  const [form, setForm] = useState({
    businessName: '',
    category: '',
    name: googleState.name || '',
    email: googleState.email || '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register, googleRegister } = useAuth();
  const navigate = useNavigate();

  const isGoogleFlow = !!googleCred;

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isGoogleFlow) {
        await googleRegister({ credential: googleCred, businessName: form.businessName, category: form.category });
      } else {
        await register(form);
      }
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear la cuenta');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle(credentialResponse) {
    setError('');
    try {
      const cred = credentialResponse.credential;
      const payload = JSON.parse(atob(cred.split('.')[1]));
      setGoogleCred(cred);
      setForm(f => ({ ...f, name: payload.name || f.name, email: payload.email || f.email }));
    } catch {
      setError('Error al procesar cuenta de Google');
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <ZentricLogo />
        <p className="page-subtitle" style={{ textAlign: 'center', marginTop: -8, marginBottom: 24 }}>Empezá a gestionar tu negocio en minutos</p>

        {error && <div className="error-banner">{error}</div>}

        {!isGoogleFlow && (
          <>
            <div className="google-btn-wrap">
              <GoogleLogin
                onSuccess={handleGoogle}
                onError={() => setError('Error al continuar con Google')}
                text="signup_with"
                shape="rectangular"
                logo_alignment="left"
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0', color: 'var(--ink-soft)', fontSize: 13 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              o registrate con email
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
          </>
        )}

        {isGoogleFlow && (
          <div style={{ background: '#d1fae5', color: '#065f46', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
            ✓ Cuenta de Google vinculada ({form.email}). Solo completá los datos de tu negocio.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="businessName">Nombre del negocio</label>
            <input id="businessName" value={form.businessName} onChange={(e) => update('businessName', e.target.value)} placeholder="Ej: Estudio Contable López" required />
          </div>
          <div className="field">
            <label htmlFor="category">¿A qué se dedica tu negocio?</label>
            <input id="category" value={form.category} onChange={(e) => update('category', e.target.value)} placeholder="Ej: Peluquería, Plomero, Gimnasio, Veterinaria..." required />
          </div>

          {!isGoogleFlow && (
            <>
              <div className="field">
                <label htmlFor="name">Tu nombre</label>
                <input id="name" value={form.name} onChange={(e) => update('name', e.target.value)} required />
              </div>
              <div className="field">
                <label htmlFor="email">Email</label>
                <input id="email" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required />
              </div>
              <div className="field">
                <label htmlFor="password">Contraseña</label>
                <input id="password" type="password" value={form.password} onChange={(e) => update('password', e.target.value)} required minLength={6} />
              </div>
            </>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <div className="auth-switch">
          ¿Ya tenés cuenta? <Link to="/login">Iniciar sesión</Link>
        </div>
      </div>
    </div>
  );
}
