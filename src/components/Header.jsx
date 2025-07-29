import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Home,
  List,
  PlusSquare,
  LogIn,
  UserPlus,
  User,
  X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';
import '../styles/header.css';
import SidebarMenu from './SidebarMenu';

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Stan dla desktopowego menu rozwijanego (dropdown)
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const menuRef = useRef(null);
  const firstItemRef = useRef(null);

  // Stan dla mobilnego menu bocznego (sidebar)
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Funkcja do przełączania desktopowego menu rozwijanego
  const toggleDropdown = () => setDropdownOpen(open => !open);

  // Funkcja do przełączania mobilnego menu bocznego
  const toggleSidebar = () => setSidebarOpen(prev => !prev);

  const handleLogout = async () => {
    try {
      await logout();
      setDropdownOpen(false);
      setSidebarOpen(false);
      navigate('/', { replace: true });
      toast.success('Wylogowano pomyślnie');
    } catch (err) {
      console.error(err);
      toast.error('Wystąpił błąd podczas wylogowywania.');
    }
  };

  // Efekt do obsługi kliknięcia poza desktopowym menu i klawisza ESC
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setDropdownOpen(false);
      }
    }

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      firstItemRef.current?.focus();
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dropdownOpen]);


  // Funkcja do otwierania odpowiedniego menu w zależności od szerokości ekranu
  const handleUserMenuClick = () => {
    if (window.innerWidth < 768) {
      toggleSidebar();
    } else {
      toggleDropdown();
    }
  };


  return (
    <nav role="navigation" aria-label="Główne menu" className="header">
      <div className="header-inner">
        <Link to="/" className="header-logo">
          <span className="header-logo-icon">🎾</span>
          <span className="header-logo-text">Blind Tennis</span>
        </Link>

        <div className="header-nav">
          <Link to="/" className="icon-button" aria-label="Strona główna">
            <Home size={24} color="#fff" />
            <span className="tooltip">Strona główna</span>
          </Link>

          <Link to="/tournaments" className="icon-button" aria-label="Lista turniejów">
            <List size={24} color="#fff" />
            <span className="tooltip">Lista turniejów</span>
          </Link>

          <Link to="/tournaments/new" className="icon-button" aria-label="Dodaj turniej">
            <PlusSquare size={24} color="#fff" />
            <span className="tooltip">Dodaj turniej</span>
          </Link>

          {user ? (
            <div
              ref={menuRef}
              className={`user-menu${dropdownOpen ? ' open' : ''}`}
              aria-haspopup="true"
              aria-expanded={dropdownOpen}
            >
              <button
                type="button"
                className="icon-button"
                aria-label="Menu użytkownika"
                onClick={handleUserMenuClick}
              >
                <User size={24} color="#fff" />
                <span className="tooltip">Twoje konto</span>
              </button>

              {/* Desktopowe menu rozwijane */}
              {/* Ta klasa 'desktop-only' zostanie ukryta na mobilnych przez header.css */}
              <div className="dropdown-content desktop-only">
                <Link to="/profile" ref={firstItemRef} onClick={() => setDropdownOpen(false)}>
                  Informacje o użytkowniku
                </Link>
                <Link
                  to="/tournaments/mine"
                  onClick={() => setDropdownOpen(false)}
                >
                  Moje turnieje
                </Link>
                <Link
                  to="/registrations/mine"
                  onClick={() => setDropdownOpen(false)}
                >
                  Moje zgłoszenia
                </Link>
                <button onClick={handleLogout}>Wyloguj</button>
              </div>
            </div>
          ) : (
            <>
              <Link to="/login" className="icon-button" aria-label="Zaloguj się">
                <LogIn size={24} color="#fff" />
                <span className="tooltip">Zaloguj się</span>
              </Link>

              <Link to="/register" className="icon-button" aria-label="Zarejestruj się">
                <UserPlus size={24} color="#fff" />
                <span className="tooltip">Zarejestruj się</span>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Renderowanie uniwersalnego komponentu SidebarMenu dla mobilnych */}
      {user && (
        <SidebarMenu
          isOpen={sidebarOpen}
          onClose={toggleSidebar} // Przekaż toggleSidebar jako onClose
          title="Twoje Konto"
        >
          {/* Zawartość menu bocznego */}
          <Link to="/profile" onClick={toggleSidebar}>Informacje o użytkowniku</Link>
          <Link to="/tournaments/mine" onClick={toggleSidebar}>Moje turnieje</Link>
          <Link to="/registrations/mine" onClick={toggleSidebar}>Moje zgłoszenia</Link>
          <button onClick={handleLogout} className="logout-btn">Wyloguj</button>
        </SidebarMenu>
      )}
    </nav>
  );
}