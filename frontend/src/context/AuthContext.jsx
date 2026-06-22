import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutos sin actividad → logout

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [business, setBusiness] = useState(() => {
    const stored = localStorage.getItem('business');
    return stored ? JSON.parse(stored) : null;
  });

  const inactivityTimer = useRef(null);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('business');
    setUser(null);
    setBusiness(null);
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
  }, []);

  // Reinicia el timer de inactividad
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      logout();
    }, INACTIVITY_TIMEOUT_MS);
  }, [logout]);

  // Escuchar eventos de actividad del usuario
  useEffect(() => {
    if (!user) return;
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    const handler = () => resetInactivityTimer();
    events.forEach(e => window.addEventListener(e, handler, { passive: true }));
    resetInactivityTimer(); // Arrancar el timer al loguearse
    return () => {
      events.forEach(e => window.removeEventListener(e, handler));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [user, resetInactivityTimer]);

  // Interceptor 401: si el token expiró → logout automático
  useEffect(() => {
    const interceptorId = api.interceptors.response.use(
      res => res,
      err => {
        if (err.response?.status === 401) {
          logout();
        }
        return Promise.reject(err);
      }
    );
    return () => api.interceptors.response.eject(interceptorId);
  }, [logout]);

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
