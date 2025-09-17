import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import * as matchService from '../services/matchService';
import '../styles/tournamentBracket.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// mapowanie kolejnosci kolumn KO od wczesnej do finału
const ROUND_COLUMNS = [
    '1/64 finału',
    '1/32 finału',
    '1/16 finału',
    '1/8 finału',
    'Ćwierćfinał',
    'Półfinał',
    'Finał',
];

// parse klucza rundy
function roundKey(roundLabel = '') {
    const r = (roundLabel || '').toLowerCase();
    if (r.includes('1/64')) return 'R128';
    if (r.includes('1/32')) return 'R64';
    if (r.includes('1/16')) return 'R32';
    if (r.includes('1/8')) return 'R16';
    if (r.includes('ćwierćfina')) return 'QF';
    if (r.includes('półfina')) return 'SF';
    if (r.includes('finał')) return 'F';
    return null;
}

function roundTitleByKey(k) {
    if (k === 'R128') return '1/64 finału';
    if (k === 'R64') return '1/32 finału';
    if (k === 'R32') return '1/16 finału';
    if (k === 'R16') return '1/8 finału';
    if (k === 'QF') return 'Ćwierćfinał';
    if (k === 'SF') return 'Półfinał';
    if (k === 'F') return 'Finał';
    return 'KO';
}

function matchIndex(label = '') {
    // wyciąga ostatni numer po słowie "Mecz"
    const m = /mecz\D*([0-9]+)\s*$/i.exec(label || '');
    return m ? Number(m[1]) : null;
}

function isKO(label = '') {
    return /(1\/(8|16|32|64)\s*finału|ćwierćfinał|półfinał|finał)/i.test(label || '');
}

export default function TournamentBracket() {
    const { id } = useParams(); // tournamentId
    const navigate = useNavigate();
    const { user } = useAuth();

    const canUseScorePanel = useCallback((m) => {
        if (!user) return false;
        if (m.status !== 'scheduled' && m.status !== 'in_progress') return false;
        return m?.referee?.id === user?.id; // tylko sędzia przypisany do meczu
    }, [user]);

    const [allMatches, setAllMatches] = useState([]);
    const [loading, setLoading] = useState(true);

    const socketRef = useRef(null);
    const joinedRoomsRef = useRef(new Set());

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            // bez statusu → pobierze wszystkie; posortowane round asc + id asc
            const data = await matchService.getMatchesByTournamentId(id);
            // zostaw tylko KO
            setAllMatches(data.filter(m => isKO(m.round)));
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // socket lifecycle
    useEffect(() => {
        const s = io(API_URL, { withCredentials: true });
        socketRef.current = s;
        const tid = parseInt(id, 10);
        s.emit('join-tournament', tid);

        // jeżeli status meczu się zmienił → refetch (drabinka to przekrój wszystkich statusów)
        const onStatus = () => fetchAll();

        // pojedynczy mecz zaktualizowany
        const onUpdated = (updated) => {
            setAllMatches(prev => {
                const idx = prev.findIndex(x => x.id === updated.id);
                // widok tylko KO
                if (!isKO(updated.round)) {
                    // jeśli wypadł z KO (nie powinno), usuń
                    if (idx !== -1) {
                        const copy = [...prev]; copy.splice(idx, 1); return copy;
                    }
                    return prev;
                }
                if (idx !== -1) { const copy = [...prev]; copy[idx] = updated; return copy; }
                return [...prev, updated];
            });
        };

        const onInvalidate = () => fetchAll();

        const onLive = ({ matchId, sets }) => {
            setAllMatches(prev =>
                prev.map(m =>
                    m.id === matchId
                        ? {
                            ...m,
                            matchSets: Array.isArray(sets)
                                ? sets.map((s, i) => ({
                                    setNumber: i + 1,
                                    player1Score: Number(s.player1Score ?? s.player1 ?? s.p1 ?? 0),
                                    player2Score: Number(s.player2Score ?? s.player2 ?? s.p2 ?? 0),
                                }))
                                : [],
                        }
                        : m
                )
            );
        };

        s.on('match-status-changed', onStatus);
        s.on('match-updated', onUpdated);
        s.on('matches-invalidate', onInvalidate);
        s.on('real-time-score-update', onLive);

        return () => {
            s.emit('leave-tournament', tid);
            for (const mid of joinedRoomsRef.current) s.emit('leave-match', mid);
            joinedRoomsRef.current.clear();

            s.off('match-status-changed', onStatus);
            s.off('match-updated', onUpdated);
            s.off('matches-invalidate', onInvalidate);
            s.off('real-time-score-update', onLive);

            s.disconnect();
        };
    }, [id, fetchAll]);

    // podłączanie do pokoi match-* dla tego co widać
    useEffect(() => {
        const s = socketRef.current;
        if (!s) return;
        const currentIds = new Set(allMatches.map(m => m.id));
        const joined = joinedRoomsRef.current;
        for (const mid of currentIds) {
            if (!joined.has(mid)) { s.emit('join-match', mid); joined.add(mid); }
        }
        for (const mid of Array.from(joined)) {
            if (!currentIds.has(mid)) { s.emit('leave-match', mid); joined.delete(mid); }
        }
    }, [allMatches]);

    // ułóż dane do kolumn KO
    const columns = useMemo(() => {
        const buckets = new Map(); // title -> [matches]
        for (const m of allMatches) {
            const k = roundKey(m.round);
            const title = roundTitleByKey(k);
            if (!buckets.has(title)) buckets.set(title, []);
            buckets.get(title).push(m);
        }
        // posortuj mecze w kolumnie po indeksie meczu (jeśli jest) inaczej po id
        for (const [t, arr] of buckets) {
            arr.sort((a, b) => {
                const ai = matchIndex(a.round);
                const bi = matchIndex(b.round);
                if (ai != null && bi != null) return ai - bi;  // NUMERYCZNIE
                if (ai != null) return -1;
                if (bi != null) return 1;
                return a.id - b.id; // fallback stabilny
            });
        }
        // posortuj kolumny wg ROUND_COLUMNS i wyfiltruj tylko te, które mają mecze
        return ROUND_COLUMNS
            .map(title => [title, buckets.get(title) || []])
            .filter(([, arr]) => arr.length > 0);
    }, [allMatches]);

    const renderPlayer = (p, isWinner) => (
        <div className={`br-player ${isWinner ? 'winner' : ''}`}>
            {p ? `${p.name} ${p.surname}` : 'TBD'}
        </div>
    );

    const renderScore = (m) => {
        if (!m.matchSets || m.matchSets.length === 0) return null;
        return (
            <div className="br-score">
                {m.matchSets.map(s => `${s.player1Score}-${s.player2Score}`).join(', ')}
            </div>
        );
    };

    const goToScorePanel = (m) => {
        // organizacja ról po Twojej stronie — tu tylko nawigacja
        navigate(`/match-score-panel/${m.id}`);
    };

    return (
        <section className="br-section">
            <div className="br-header">
                <h2>Drabinka pucharowa</h2>
                <div className="br-legend">
                    <span className="pill pill-scheduled">Zaplanowany</span>
                    <span className="pill pill-live">W trakcie</span>
                    <span className="pill pill-done">Zakończony</span>
                </div>
            </div>

            {loading ? (
                <p>Ładowanie…</p>
            ) : columns.length === 0 ? (
                <p>Brak meczów fazy pucharowej.</p>
            ) : (
                <div
                    className="br-grid"
                    style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(240px, 1fr))` }}
                >
                    {columns.map(([title, list]) => (
                        <div key={title} className="br-col">
                            <div className="br-col-title">{title}</div>
                            <div className="br-col-matches">
                                {list.map(m => {
                                    const live = m.status === 'in_progress';
                                    const finished = m.status === 'finished';
                                    const wId = m.winner?.id;
                                    return (
                                        <div key={m.id} className={`br-match ${live ? 'live' : ''} ${finished ? 'finished' : ''}`}>
                                            <div className="br-round">{m.round}</div>
                                            <div className="br-players">
                                                {renderPlayer(m.player1, wId && m.player1 && wId === m.player1.id)}
                                                {renderPlayer(m.player2, wId && m.player2 && wId === m.player2.id)}
                                            </div>
                                            {renderScore(m)}
                                            <div className="br-footer">
                                                {live && <span className="live-dot" aria-label="live" />}
                                                {finished && wId && (
                                                    <span className="winner-badge">
                                                        {m.winner.name} {m.winner.surname}
                                                    </span>
                                                )}
                                                {canUseScorePanel(m) && (
                                                    <button className="br-btn" onClick={() => goToScorePanel(m)}>
                                                        Panel wyniku
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
