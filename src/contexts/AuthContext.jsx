// client/src/contexts/AuthContext.jsx
import { createContext, useState, useEffect, useContext, useRef } from 'react';
import * as authService from '../services/authService';
import { toast } from 'react-toastify';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef(null);

  // 1) Ładowanie profilu na starcie
  useEffect(() => {
    (async () => {
      try {
        const profile = await authService.fetchProfile();
        setUser(profile);
      } catch (err) {
        if (err.status === 401) setUser(null);
        else console.error('Błąd podczas ładowania profilu:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 2) Socket – startujemy tylko, gdy user istnieje
  useEffect(() => {
    if (!user?.id) {
      // brak usera -> posprzątaj socket
      if (socketRef.current) {
        try { socketRef.current.disconnect(); } catch {}
        socketRef.current = null;
      }
      return;
    }

    const s = io(API_URL, { withCredentials: true });
    socketRef.current = s;

    // serwer już sam dołącza do `user-<id>` (patrz index.js), więc tylko nasłuch:
    const onForceLogout = (payload) => {
      try { s.disconnect(); } catch {}
      toast.error('Twoje konto zostało wylogowane przez administratora.');
      setUser(null);
      // twardy redirect, żeby ubić stan appki
      window.location.replace('/login');
    };

    s.on('force-logout', onForceLogout);

    return () => {
      s.off('force-logout', onForceLogout);
      try { s.disconnect(); } catch {}
      socketRef.current = null;
    };
  }, [user?.id]);

  const login = async (creds) => {
    const u = await authService.login(creds);
    setUser(u);           // to wywoła efekt i podniesie socket
    return u;
  };

  const register = async (creds) => {
    await authService.register(creds);
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    try { socketRef.current?.disconnect(); } catch {}
    socketRef.current = null;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
