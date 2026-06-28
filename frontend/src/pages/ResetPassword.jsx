import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../api/client';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return; }
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return; }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cambiar la contraseña.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 style={{ textAlign: 'center', color: 'var(--primary)', fontSize: 24, margin: '0 0 4px' }}>Gestumio</h1>
        <p className="page-subtitle" style={{ textAlign: 'center', marginBottom: 20 }}>Nueva contraseña</p>
        {error && <div className="error-banner">{error}</div>}
        {!token ? (
          <p style={{ textAlign: 'center' }}>Enlace inválido. <Link to="/recuperar">Pedí uno nuevo</Link>.</p>
        ) : done ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 15, marginBottom: 12 }}>✅ ¡Contraseña actualizada! Te llevamos al login…</p>
            <Link to="/login" className="btn btn-primary" style={{ width: '100%' }}>Ir al login</Link>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="field">
              <label htmlFor="pw">Nueva contraseña</label>
              <input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="pw2">Repetir contraseña</label>
              <input id="pw2" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
