// client/src/contexts/AuthContext.jsx
import { createContext, useState, useEffect, useContext } from 'react';
import * as authService from '../services/authService';
import { toast } from 'react-toastify';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const profile = await authService.fetchProfile();
        setUser(profile);
      } catch (err) {
        if (err.status === 401) {
          setUser(null);
        } else {
          console.error("Błąd podczas ładowania profilu:", err);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async creds => {
    try {
      const u = await authService.login(creds);
      setUser(u);
      return u;
    } catch (err) {
      setUser(null);
      throw err;
    }
  };

  const register = async creds => {
    try {
      await authService.register(creds);
    } catch (err) {
      console.error("Błąd podczas rejestracji:", err);
      throw err;
    }
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
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