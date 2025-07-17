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
          // nie jesteś zalogowany
          setUser(null);
        } else {
          console.error(err);
        }
      } finally {
        // koniec ładowania, pozwalamy PrivateRoute na dalszą pracę
        setLoading(false);
      }
    })();
  }, []);

  const login = async creds => {
    const u = await authService.login(creds);
    setUser(u);
    return u;
  };

  const register = async creds => {
    await authService.register(creds);
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
