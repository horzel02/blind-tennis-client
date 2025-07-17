// client/src/components/Layout.jsx
import Header from './Header';
import Footer from './Footer';

export default function Layout({ children }) {
  return (
    <div className="app-shell">
      <header role="banner">
        <Header />
      </header>

      <main role="main" className="container" style={{ paddingTop: '80px', paddingBottom: '2rem' }}>
        {children}
      </main>

      <footer role="contentinfo">
        <Footer />
      </footer>
    </div>
  );
}
