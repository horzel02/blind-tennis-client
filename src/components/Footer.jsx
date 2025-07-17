// src/components/Footer.jsx
import '../styles/Footer.css';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        © {new Date().getFullYear()} Blind Tennis
      </div>
    </footer>
  );
}
