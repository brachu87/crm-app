import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo enviar. Probá de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 style={{ textAlign: 'center', color: 'var(--primary)', fontSize: 24, margin: '0 0 4px' }}>Gestumio</h1>
        <p className="page-subtitle" style={{ textAlign: 'center', marginBottom: 20 }}>Recuperar contraseña</p>
        {error && <div className="error-banner">{error}</div>}
        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 15, lineHeight: 1.6, marginBottom: 18 }}>📧 Si el email está registrado, te enviamos un enlace para crear una nueva contraseña. Revisá tu bandeja de entrada (y la carpeta de spam).</p>
            <Link to="/login" className="btn btn-primary" style={{ width: '100%' }}>Volver al login</Link>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 16 }}>Ingresá tu email y te enviamos un enlace para crear una nueva contraseña.</p>
            <form onSubmit={submit}>
              <div className="field">
                <label htmlFor="email">Email</label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                {loading ? 'Enviando...' : 'Enviar enlace'}
              </button>
            </form>
            <div className="auth-switch"><Link to="/login">Volver al login</Link></div>
          </>
        )}
      </div>
    </div>
  );
}
