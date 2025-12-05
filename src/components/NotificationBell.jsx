// client/src/components/NotificationBell.jsx
import React, { useEffect, useState, useRef } from 'react';
import { Bell } from 'lucide-react';
import { listNotifications, markRead, markAllRead } from '../services/notificationService';
import * as registrationService from '../services/registrationService';
import * as roleService from '../services/tournamentUserRoleService';
import { guardianApi } from '../services/guardianService';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';
import { Link, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import '../styles/notifications.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);
  const socketRef = useRef(null);
  const navigate = useNavigate();

  const removeFromList = (id) => setItems(prev => prev.filter(x => x.id !== id));
  const upsert = (n) => setItems(prev => prev.some(x => x.id === n.id) ? prev : [n, ...prev]);

  const refresh = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const rows = await listNotifications();
      setItems((rows || []).filter(r => !r.readAt));
    } catch (e) {
      console.error('notif refresh failed', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    const s = io(API_URL, { withCredentials: true });
    socketRef.current = s;

    s.emit('notif:join', user.id);

    const onNew = (n) => upsert(n);
    const onRead = ({ id }) => removeFromList(id);
    const onReadAll = () => setItems([]);

    s.on('notif:new', onNew);
    s.on('notif:read', onRead);
    s.on('notif:read-all', onReadAll);

    return () => {
      s.off('notif:new', onNew);
      s.off('notif:read', onRead);
      s.off('notif:read-all', onReadAll);
      s.emit('notif:leave', user.id);
      s.disconnect();
    };
  }, [user?.id]);

  useEffect(() => { refresh(); }, [user]);

  useEffect(() => {
    const onClick = (e) => { if (open && ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [open]);

  const unread = items.length;

  const openLink = async (n) => {
    if (n.link) navigate(n.link);
  };

  const acceptPlayerInvite = async (n) => {
    try {
      const tid = n?.meta?.tournamentId;
      if (!tid) return openLink(n);
      const reg = await registrationService.getMyRegistration(tid);
      if (!reg) return openLink(n);
      await registrationService.updateRegistrationStatus(reg.id, { status: 'accepted' });
      await markRead(n.id);
      removeFromList(n.id);
      toast.success('Dołączono do turnieju');
    } catch (e) {
      toast.error(e?.message || 'Nie udało się zaakceptować');
    }
  };

  const declinePlayerInvite = async (n) => {
    try {
      const tid = n?.meta?.tournamentId;
      if (!tid) return openLink(n);
      const reg = await registrationService.getMyRegistration(tid);
      if (!reg) return openLink(n);
      await registrationService.deleteRegistration(reg.id);
      await markRead(n.id);
      removeFromList(n.id);
      toast.info('Odrzucono zaproszenie');
    } catch (e) {
      toast.error(e?.message || 'Nie udało się odrzucić');
    }
  };

  const acceptGuardianInvite = async (n) => {
    try {
      const gid = n?.meta?.guardianId;
      if (gid) {
        await guardianApi.accept(gid);
      } else {
        const all = await guardianApi.list({});
        const row = (all || []).find(r =>
          r.status === 'invited' &&
          r.guardianUserId === user.id &&
          r.tournamentId === n?.meta?.tournamentId &&
          r.playerId === n?.meta?.playerId
        );
        if (row) await guardianApi.accept(row.id);
      }
      await markRead(n.id);
      removeFromList(n.id);
      toast.success('Przyjęto rolę opiekuna');
    } catch (e) {
      toast.error(e?.message || 'Nie udało się zaakceptować');
    }
  };

  const declineGuardianInvite = async (n) => {
    try {
      const gid = n?.meta?.guardianId;
      if (gid) {
        await guardianApi.decline(gid);
      } else {
        const all = await guardianApi.list({});
        const row = (all || []).find(r =>
          r.status === 'invited' &&
          r.guardianUserId === user.id &&
          r.tournamentId === n?.meta?.tournamentId &&
          r.playerId === n?.meta?.playerId
        );
        if (row) await guardianApi.decline(row.id);
      }
      await markRead(n.id);
      removeFromList(n.id);
      toast.info('Odrzucono zaproszenie opiekuna');
    } catch (e) {
      toast.error(e?.message || 'Nie udało się odrzucić');
    }
  };

  const acceptRefereeInvite = async (n) => {
    try {
      const tid = n?.meta?.tournamentId;
      if (!tid) return openLink(n);
      await roleService.acceptRefereeInvite(tid);
      await markRead(n.id);
      removeFromList(n.id);
      toast.success('Dołączyłeś jako sędzia');
    } catch (e) {
      toast.error(e?.message || 'Nie udało się zaakceptować');
    }
  };

  const declineRefereeInvite = async (n) => {
    try {
      const tid = n?.meta?.tournamentId;
      if (!tid) return openLink(n);
      await roleService.declineRefereeInvite(tid);
      await markRead(n.id);
      removeFromList(n.id);
      toast.info('Odrzucono zaproszenie');
    } catch (e) {
      toast.error(e?.message || 'Nie udało się odrzucić');
    }
  };

  const markOne = async (n) => {
    await markRead(n.id);
    removeFromList(n.id);
  };

  const markAll = async () => {
    try {
      await markAllRead();
      setItems([]);
    } catch (e) {
      toast.error('Nie udało się oznaczyć wszystkich');
    }
  };

  const InfoRow = ({ n, children }) => (
    <div key={n.id} className={`notif-item ${n.readAt ? 'read' : 'unread'}`}>
      <div className="notif-title">{n.title}</div>
      <div className="notif-body">{n.body}</div>
      <div className="notif-actions">
        {children}
        <button className="btn-secondary" onClick={() => markOne(n)}>Oznacz jako przeczytane</button>
        {n.link && <button className="btn-link" onClick={() => openLink(n)}>Szczegóły</button>}
      </div>
    </div>
  );

  return (
    <div className="notif-bell" ref={ref}>
      <button
        className="icon-button"
        onClick={async () => {
          const willOpen = !open;
          setOpen(willOpen);
          if (willOpen) await refresh();
        }}
        aria-label="Powiadomienia"
      >
        <Bell size={24} />
        {unread > 0 && <span className="badge">{unread}</span>}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-head">Powiadomienia</div>
          {loading ? (
            <div className="muted">Ładowanie…</div>
          ) : items.length === 0 ? (
            <div className="muted">Brak nowych</div>
          ) : (
            items.map(n => {
              if (n.type === 'player_invite') {
                return (
                  <InfoRow key={n.id} n={n}>
                    <button className="btn-primary" onClick={() => acceptPlayerInvite(n)}>Akceptuj</button>
                    <button className="btn-secondary" onClick={() => declinePlayerInvite(n)}>Odrzuć</button>
                  </InfoRow>
                );
              }
              if (n.type === 'guardian_invite') {
                return (
                  <InfoRow key={n.id} n={n}>
                    <button className="btn-primary" onClick={() => acceptGuardianInvite(n)}>Akceptuj</button>
                    <button className="btn-secondary" onClick={() => declineGuardianInvite(n)}>Odrzuć</button>
                  </InfoRow>
                );
              }
              if (n.type === 'referee_invite') {
                return (
                  <InfoRow key={n.id} n={n}>
                    <button className="btn-primary" onClick={() => acceptRefereeInvite(n)}>Akceptuj</button>
                    <button className="btn-secondary" onClick={() => declineRefereeInvite(n)}>Odrzuć</button>
                  </InfoRow>
                );
              }
              return <InfoRow key={n.id} n={n} />;
            })
          )}
          <div className="notif-foot">
            <button className="btn-link" onClick={markAll}>Oznacz wszystkie</button>
            <Link to="/notifications">Wszystkie</Link>
          </div>
        </div>
      )}
    </div>
  );
}
