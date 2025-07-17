import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/auth-split.css';
import { toast } from 'react-toastify';
import illustration from '../assets/tennis-illustration.svg';

export default function AuthSplit({ mode = 'login' }) {
  const isLogin = mode === 'login';
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(
    isLogin
      ? { email: '', password: '' }
      : { name: '', surname: '', email: '', password: '' }
  );

  const handleChange = e =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      if (isLogin) {
        await login(form);
        toast.success('Zalogowano pomyślnie');
        navigate('/');
      } else {
        await register(form);
        toast.success('Rejestracja zakończona sukcesem');
        navigate('/login');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="auth-split-container">
      <div className="panel panel--form">
        <h2 className="auth-title">{isLogin ? 'Logowanie' : 'Rejestracja'}</h2>
        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <>
              <div className="form-group">
                <label htmlFor="name">Imię</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  required
                  className="auth-input"
                />
              </div>
              <div className="form-group">
                <label htmlFor="surname">Nazwisko</label>
                <input
                  id="surname"
                  name="surname"
                  type="text"
                  value={form.surname}
                  onChange={handleChange}
                  required
                  className="auth-input"
                />
              </div>
            </>
          )}
          <div className="form-group">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              required
              className="auth-input"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Hasło</label>
            <input
              id="password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              required
              className="auth-input"
            />
          </div>
          <button type="submit" className="auth-button btn-primary">
            {isLogin ? 'Zaloguj się' : 'Zarejestruj się'}
          </button>
        </form>
      </div>

      <div className="panel panel--aside">
        <div className="aside-illustration-wrapper">
          <img
            src={illustration}
            alt=""
            aria-hidden="true"
            className="aside-illustration"
          />
        </div>
        <div className="aside-text">
          <h3>{isLogin ? 'Witaj ponownie!' : 'Dołącz do nas!'}</h3>
          <p>
            {isLogin
              ? 'Zaloguj się lub przejdź do rejestracji jeśli nie masz jescze konta.'
              : 'Zarejestruj konto lub przejdź do logowania jeśli już je masz'}
          </p>
          <Link
            to={isLogin ? '/register' : '/login'}
            className="aside-button">
            {isLogin ? 'Zarejestruj się' : 'Zaloguj się'}
          </Link>
        </div>
      </div>
    </div>
  );
}
