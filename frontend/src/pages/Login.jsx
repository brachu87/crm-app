import { useState } from 'react';
import PasswordInput from '../components/PasswordInput';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';

function GestumioLogo({ size = 52 }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 20 }}>
      <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="gGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#46C658"/>
            <stop offset="1" stopColor="#0F8A3A"/>
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="33" fill="none" stroke="url(#gGrad)" strokeWidth="12" strokeLinecap="round"/>
        <rect x="45" y="38" width="36" height="11.5" rx="5.75" fill="#1E2A38"/>
        <rect x="45" y="53" width="30" height="11.5" rx="5.75" fill="#1E2A38"/>
        <circle cx="50" cy="72" r="6" fill="url(#gGrad)"/>
      </svg>
      <div style={{ marginTop: 10, fontSize: 30, fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1 }}>
        <span style={{ color: '#1BA84C' }}>G</span><span style={{ color: 'var(--ink)' }}>estumio</span>
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
        <GestumioLogo />
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
            <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? <><div className="spinner" style={{width:16,height:16,borderWidth:'2px',borderTopColor:'rgba(255,255,255,0.8)',borderColor:'rgba(255,255,255,0.3)'}}></div>Ingresando...</> : 'Ingresar'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Link to="/recuperar" style={{ fontSize: 13, color: 'var(--primary)' }}>¿Olvidaste tu contraseña?</Link>
        </div>

        <div className="auth-switch">
          ¿No tenés cuenta? <Link to="/registro">Crear cuenta</Link>
        </div>
      </div>
    </div>
  );
}
