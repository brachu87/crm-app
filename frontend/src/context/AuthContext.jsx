import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [business, setBusiness] = useState(() => {
    const stored = localStorage.getItem('business');
    return stored ? JSON.parse(stored) : null;
  });

  function saveSession(data) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('business', JSON.stringify(data.business));
    setUser(data.user);
    setBusiness(data.business);
  }

  // Refresca permisos del usuario al cargar la app
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    api.get('/auth/me').then(res => {
      const fresh = res.data;
      localStorage.setItem('user', JSON.stringify(fresh.user));
      localStorage.setItem('business', JSON.stringify(fresh.business));
      setUser(fresh.user);
      setBusiness(fresh.business);
    }).catch(() => {});
  }, []);

  async function login(email, password) {
    const res = await api.post('/auth/login', { email, password });
    saveSession(res.data);
  }

  async function register(payload) {
    const res = await api.post('/auth/register', payload);
    saveSession(res.data);
  }

  // Verifica token de Google. Devuelve { needsRegister, email, name } si es usuario nuevo.
  async function googleLogin(credential) {
    const res = await api.post('/auth/google', { credential });
    if (res.data.needsRegister) return res.data;
    saveSession(res.data);
    return null;
  }

  async function googleRegister({ credential, businessName, category, businessPhone }) {
    const res = await api.post('/auth/google-register', { credential, businessName, category, businessPhone });
    saveSession(res.data);
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('business');
    setUser(null);
    setBusiness(null);
  }

  function updateBusiness(data) {
    const updated = { ...business, ...data };
    localStorage.setItem('business', JSON.stringify(updated));
    setBusiness(updated);
  }

  function updateUser(data) {
    const updated = { ...user, ...data };
    localStorage.setItem('user', JSON.stringify(updated));
    setUser(updated);
  }

  return (
    <AuthContext.Provider value={{ user, business, login, register, googleLogin, googleRegister, logout, updateBusiness, updateUser, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
