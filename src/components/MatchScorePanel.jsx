// client/src/components/MatchScorePanel.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getMatchById, updateMatchScore } from '../services/matchService';
import { useAuth } from '../contexts/AuthContext';
import io from 'socket.io-client';
import '../styles/matchScorePanel.css';
import Breadcrumbs from '../components/Breadcrumbs'; // <- dodane

export default function MatchScorePanel() {
    const { matchId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [match, setMatch] = useState(null);
    const [sets, setSets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState('');
    const socketRef = useRef(null);

    // EFEKT 1: Pobieranie danych meczu
    useEffect(() => {
        const fetchMatch = async () => {
            setLoading(true);
            try {
                const data = await getMatchById(matchId);
                setMatch(data);
                if (Array.isArray(data.matchSets) && data.matchSets.length > 0) {
                    setSets(
                        data.matchSets.map(s => ({
                            player1Score: s.player1Score,
                            player2Score: s.player2Score,
                        }))
                    );
                } else {
                    setSets([{ player1Score: 0, player2Score: 0 }]);
                }
                setError(null);
            } catch (err) {
                setError('Błąd podczas ładowania danych meczu. Upewnij się, że jesteś zalogowany.');
                setMatch(null);
            } finally {
                setLoading(false);
            }
        };
        fetchMatch();
    }, [matchId]);

    // EFEKT 2: Socket.io + pokoje meczu
    useEffect(() => {
        socketRef.current = io('http://localhost:5000', {
            withCredentials: true,
        });

        const socket = socketRef.current;
        socket.emit('join-match', parseInt(matchId, 10)); // join room
        // console.log('🔌 Socket.io połączony!');

        socket.on('match-updated', updatedMatch => {
            if (updatedMatch.id === parseInt(matchId, 10)) {
                setMatch(updatedMatch);
                if (Array.isArray(updatedMatch.matchSets)) {
                    setSets(
                        updatedMatch.matchSets.map(s => ({
                            player1Score: s.player1Score,
                            player2Score: s.player2Score,
                        }))
                    );
                }
            }
        });

        socket.on('real-time-score-update', data => {
            if (data.matchId === parseInt(matchId, 10)) {
                setSets(data.sets);
            }
        });

        return () => {
            socket.emit('leave-match', parseInt(matchId, 10)); // leave room
            socket.disconnect();
        };
    }, [matchId]);

    // Live emit
    const handleRealTimeUpdate = newSets => {
        if (socketRef.current) {
            socketRef.current.emit('real-time-score-update', {
                matchId: parseInt(matchId, 10),
                sets: newSets,
            });
        }
    };

    const handleScoreChange = (index, player, value) => {
        const newSets = [...sets];
        newSets[index] = {
            ...newSets[index],
            [player === 1 ? 'player1Score' : 'player2Score']: parseInt(value) || 0,
        };
        setSets(newSets);
        handleRealTimeUpdate(newSets);
    };

    const handleAddSet = () => {
        if (sets.length < 5) {
            const newSets = [...sets, { player1Score: 0, player2Score: 0 }];
            setSets(newSets);
            handleRealTimeUpdate(newSets);
        }
    };

    const handleRemoveSet = index => {
        const newSets = sets.filter((_, i) => i !== index);
        setSets(newSets);
        handleRealTimeUpdate(newSets);
    };

    const calculateWinner = () => {
        let p1 = 0;
        let p2 = 0;
        const setsToWin = match?.tournament?.setsToWin ? Math.ceil(match.tournament.setsToWin / 2) : 2;

        for (const set of sets) {
            if (set.player1Score > set.player2Score) p1++;
            else if (set.player2Score > set.player1Score) p2++;
        }
        if (p1 >= setsToWin) return match.player1.id;
        if (p2 >= setsToWin) return match.player2.id;
        return null;
    };

    const handleSubmit = async e => {
        e.preventDefault();
        setMessage('');
        setError('');

        if (!user) {
            setError('Musisz być zalogowany, aby wprowadzić wynik.');
            return;
        }

        const winnerId = calculateWinner();
        if (!winnerId) {
            setError('Nie można ustalić zwycięzcy. Upewnij się, że jeden z graczy wygrał wymaganą liczbę setów.');
            return;
        }

        const formattedSets = sets.map(set => ({
            player1Score: set.player1Score,
            player2Score: set.player2Score,
        }));

        const updateData = {
            status: 'finished',
            winnerId,
            matchSets: formattedSets,
        };

        try {
            await updateMatchScore(matchId, updateData);
            setMessage('Wynik został pomyślnie zaktualizowany!');
            // wróć na stronę turnieju (jak chciałeś)
            navigate(`/tournaments/${match.tournamentId}/details`, { replace: true });
        } catch (err) {
            setError(err.message || 'Błąd podczas aktualizacji wyniku.');
        }
    };

    if (loading) {
        return <p>Ładowanie panelu sędziowskiego...</p>;
    }
    if (error) {
        return <p className="error">{error}</p>;
    }
    if (!match) {
        return <p className="error">Mecz o podanym ID nie istnieje.</p>;
    }
    if (user?.id !== match?.referee?.id) {
        return (
            <div className="error">
                403 – Brak uprawnień (tylko sędzia może wprowadzać wynik tego meczu).
            </div>
        );
    }


    // BREADCRUMBS – budujemy dynamicznie po załadowaniu meczu
    const breadcrumbItems = [
        { label: 'Home', href: '/' },
        {
            label:
                match?.tournament?.name
                    ? `Turniej: ${match.tournament.name}`
                    : `Turniej #${match?.tournamentId ?? ''}`,
            href: `/tournaments/${match?.tournamentId ?? ''}/details`,
        },
        {
            label: 'Panel sędziowski',
        },
    ];

    return (
        <div className="score-page-wrapper">{/* wrapper dla Breadcrumbs + panelu */}
            <Breadcrumbs items={breadcrumbItems} />

            <div className="score-panel-container">
                <h2 className="score-panel-title">Panel sędziowski</h2>

                <div className="match-details">
                    <div className="player-name">
                        {match.player1?.name} {match.player1?.surname}
                    </div>
                    <div className="vs-label">vs</div>
                    <div className="player-name">
                        {match.player2?.name} {match.player2?.surname}
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="score-input-form">
                    <div className="sets-header">
                        <span>Set</span>
                        <span>{match.player1?.name}</span>
                        <span>{match.player2?.name}</span>
                        <span></span>
                    </div>

                    {sets.map((set, index) => (
                        <div key={index} className="set-row">
                            <span>Set {index + 1}</span>
                            <input
                                type="number"
                                min="0"
                                value={set.player1Score}
                                onChange={e => handleScoreChange(index, 1, e.target.value)}
                                required
                                className="score-input"
                            />
                            <input
                                type="number"
                                min="0"
                                value={set.player2Score}
                                onChange={e => handleScoreChange(index, 2, e.target.value)}
                                required
                                className="score-input"
                            />
                            {sets.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => handleRemoveSet(index)}
                                    className="remove-set-btn"
                                >
                                    &times;
                                </button>
                            )}
                        </div>
                    ))}

                    <div className="form-actions">
                        <button type="button" onClick={handleAddSet} className="add-set-btn">
                            Dodaj set
                        </button>
                        <button type="submit" className="submit-score-btn">
                            Zapisz wynik
                        </button>
                    </div>
                </form>

                {message && <p className="success-message">{message}</p>}
                {error && <p className="error-message">{error}</p>}
            </div>
        </div>
    );
}
