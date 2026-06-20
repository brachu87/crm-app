import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle(credentialResponse) {
    setError('');
    try {
      const result = await googleLogin(credentialResponse.credential);
      if (result?.needsRegister) {
        // Usuario nuevo — llevar a registro con datos de Google
        navigate('/registro', { state: { googleCredential: credentialResponse.credential, email: result.email, name: result.name } });
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al ingresar con Google');
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <ZentricLogo />
        <p className="page-subtitle" style={{ textAlign: 'center', marginTop: -8, marginBottom: 24 }}>Ingresá para gestionar tu negocio</p>

        {error && <div className="error-banner">{error}</div>}

        <div className="google-btn-wrap">
          <GoogleLogin
            onSuccess={handleGoogle}
            onError={() => setError('Error al ingresar con Google')}
            text="signin_with"
            shape="rectangular"
            logo_alignment="left"
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0', color: 'var(--ink-soft)', fontSize: 13 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          o ingresá con email
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <div className="auth-switch">
          ¿No tenés cuenta? <Link to="/registro">Crear cuenta</Link>
        </div>
      </div>
    </div>
  );
}
