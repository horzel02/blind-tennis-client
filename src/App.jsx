// client/src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Layout from './components/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import TournamentListPage from './pages/TournamentListPage';
import TournamentFormPage from './pages/TournamentFormPage';
import TournamentDetailsPage from './pages/TournamentDetailsPage';
import TournamentRegistrationsAdmin from './pages/TournamentRegistrationsAdmin';
import MyRegistrationsPage from './pages/MyRegistrationsPage';
import MyTournamentsPage from './pages/MyTournamentsPage';
import PrivateRoute from './components/PrivateRoute';
import RoleRoute from './components/RoleRoute';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar
          newestOnTop
          closeOnClick
          pauseOnHover
          theme="colored"
          containerProps={{ 'aria-live': 'assertive' }}
        />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Publiczna lista turniejów */}
          <Route path="/tournaments" element={<TournamentListPage />} />

          {/* Tylko zalogowani (tworzenie) */}
          <Route
            path="/tournaments/new"
            element={
              <PrivateRoute>
                <TournamentFormPage />
              </PrivateRoute>
            }
          />

          <Route
            path="/tournaments/:id/edit"
            element={
              <PrivateRoute>
                <TournamentFormPage />
              </PrivateRoute>
            }
          />

          {/* Szczegóły – publiczne, ale wewnątrz mogą być warunki */}
          <Route path="/tournaments/:id/details" element={<TournamentDetailsPage />} />

          {/* „Moje turnieje” tylko dla zalogowanych */}
          <Route
            path="/tournaments/mine"
            element={
              <PrivateRoute>
                <MyTournamentsPage />
              </PrivateRoute>
            }
          />

          {/* Panel zgłoszeń – tylko organizer */}
          <Route
            path="/tournaments/:id/manage/registrations"
            element={
              <PrivateRoute>
                <TournamentRegistrationsAdmin />
              </PrivateRoute>
            }
          />

          <Route
            path="/registrations/mine"
            element={
              <PrivateRoute>
                <MyRegistrationsPage />
              </PrivateRoute>
            }
          />

          <Route path="*" element={<div>404 – nie znaleziono</div>} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
