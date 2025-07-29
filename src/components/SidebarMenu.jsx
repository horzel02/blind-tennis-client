// SidebarMenu.jsx
import React, { useRef, useEffect } from 'react';
import '../styles/sidebarMenu.css';

const CloseIcon = ({ size = 24, color = "currentColor" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);


const SidebarMenu = ({ isOpen, onClose, title, children }) => {
  const menuRef = useRef();

  // Obsługa kliknięcia poza menu, aby je zamknąć
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target) && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  return (
    <div className={`sidebar-menu-overlay${isOpen ? ' open' : ''}`}>
      <div className="sidebar-menu-panel" ref={menuRef}>
        <div className="sidebar-menu-header">
          <h3>{title || "Menu"}</h3>
          <button className="sidebar-menu-close-btn" onClick={onClose} aria-label="Zamknij menu">
            <CloseIcon />
          </button>
        </div>
        <div className="sidebar-menu-content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default SidebarMenu;