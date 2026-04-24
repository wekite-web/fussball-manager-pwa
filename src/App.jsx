/**
 * ⚽ FUSSBALL-MANAGER PWA
 * Progressive Web App für schnelle Spiel-Eingabe & Statistiken
 * Offline-fähig, installierbar, superschnell
 */

import React, { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function FussballManagerPWA() {
  const [view, setView] = useState('home'); // home, newgame, goals, stats
  const [games, setGames] = useState([]);
  const [players, setPlayers] = useState({});
  const [currentGame, setCurrentGame] = useState(null);
  const [formData, setFormData] = useState({
    team1: '',
    team2: '',
    score1: 0,
    score2: 0
  });

  // IndexedDB für Offline-Speicherung
  useEffect(() => {
    initDB();
    loadGames();
    // Service Worker registrieren
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW Error:', err));
    }
  }, []);

  // IndexedDB initialisieren
  const initDB = async () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('FussballDB', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('games')) {
          db.createObjectStore('games', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('players')) {
          db.createObjectStore('players', { keyPath: 'name' });
        }
      };
    });
  };

  // Daten speichern
  const saveToIndexDB = async (storeName, data) => {
    const db = await initDB();
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    store.add(data);
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  };

  // Daten laden
  const loadGames = async () => {
    const db = await initDB();
    const transaction = db.transaction('games', 'readonly');
    const store = transaction.objectStore('games');
    const request = store.getAll();
    
    return new Promise((resolve) => {
      request.onsuccess = () => {
        setGames(request.result.sort((a, b) => new Date(b.date) - new Date(a.date)));
        resolve(request.result);
      };
    });
  };

  // Neues Spiel speichern
  const handleNewGame = async (e) => {
    e.preventDefault();
    
    const newGame = {
      id: Date.now(),
      date: new Date().toISOString(),
      team1: formData.team1,
      team2: formData.team2,
      score1: parseInt(formData.score1),
      score2: parseInt(formData.score2),
      goals: []
    };

    await saveToIndexDB('games', newGame);
    await loadGames();
    
    setFormData({ team1: '', team2: '', score1: 0, score2: 0 });
    setView('home');
    
    // Toast/Notification
    showNotification(`✅ ${newGame.team1} ${newGame.score1}:${newGame.score2} ${newGame.team2}`);
  };

  const showNotification = (message) => {
    // Browser Notification (wenn erlaubt)
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Fußball-Manager', { body: message });
    }
  };

  const handleAddGoal = async (gameId, playerName, team) => {
    const game = games.find(g => g.id === gameId);
    if (!game) return;

    game.goals = game.goals || [];
    game.goals.push({ player: playerName, team, time: new Date().toLocaleTimeString() });

    // Update IndexDB
    const db = await initDB();
    const transaction = db.transaction('games', 'readwrite');
    const store = transaction.objectStore('games');
    store.put(game);

    await loadGames();
    showNotification(`⚽ ${playerName} (${team})`);
  };

  // Statistiken berechnen
  const calculateStats = () => {
    let topScorers = {};
    games.forEach(game => {
      (game.goals || []).forEach(goal => {
        topScorers[goal.player] = (topScorers[goal.player] || 0) + 1;
      });
    });

    return Object.entries(topScorers)
      .map(([name, goals]) => ({ name, goals }))
      .sort((a, b) => b.goals - a.goals);
  };

  const stats = calculateStats();

  // ============= STYLES =============
  const styles = {
    container: {
      minHeight: '100vh',
      backgroundColor: '#0f172a',
      color: '#fff',
      fontFamily: '"Segoe UI", Tahoma, Geneva, sans-serif',
      paddingBottom: '80px',
      backgroundImage: 'linear-gradient(135deg, #0f172a 0%, #1a2332 100%)'
    },
    header: {
      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      padding: '1.5rem 1rem',
      textAlign: 'center',
      boxShadow: '0 8px 16px rgba(16, 185, 129, 0.2)',
      marginBottom: '1.5rem'
    },
    title: {
      fontSize: '2rem',
      margin: 0,
      fontWeight: 'bold',
      textShadow: '0 2px 4px rgba(0,0,0,0.2)'
    },
    subtitle: {
      fontSize: '0.85rem',
      opacity: 0.9,
      margin: '0.25rem 0 0 0'
    },
    content: {
      maxWidth: '500px',
      margin: '0 auto',
      padding: '0 1rem'
    },
    section: {
      marginBottom: '1.5rem'
    },
    sectionTitle: {
      fontSize: '1.1rem',
      fontWeight: '600',
      marginBottom: '1rem',
      paddingBottom: '0.75rem',
      borderBottom: '2px solid #10b981',
      display: 'inline-block'
    },
    card: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid rgba(16, 185, 129, 0.2)',
      borderRadius: '12px',
      padding: '1.25rem',
      marginBottom: '1rem',
      backdropFilter: 'blur(10px)',
      transition: 'all 0.3s ease',
      cursor: 'pointer',
      '&:hover': {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderColor: '#10b981'
      }
    },
    button: {
      padding: '0.75rem 1.5rem',
      border: 'none',
      borderRadius: '8px',
      fontSize: '0.95rem',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      width: '100%',
      marginBottom: '0.75rem'
    },
    buttonPrimary: {
      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      color: 'white',
      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
    },
    buttonSecondary: {
      background: 'rgba(255, 255, 255, 0.1)',
      color: '#fff',
      border: '1px solid rgba(16, 185, 129, 0.3)'
    },
    input: {
      width: '100%',
      padding: '0.75rem',
      marginBottom: '1rem',
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      border: '1px solid rgba(16, 185, 129, 0.2)',
      borderRadius: '8px',
      color: '#fff',
      fontSize: '1rem',
      boxSizing: 'border-box',
      transition: 'all 0.2s ease'
    },
    form: {
      marginBottom: '1rem'
    },
    gameCard: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '1rem',
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid rgba(16, 185, 129, 0.2)',
      borderRadius: '8px',
      marginBottom: '0.75rem'
    },
    score: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem'
    },
    scoreValue: {
      fontSize: '1.5rem',
      fontWeight: 'bold',
      color: '#10b981',
      minWidth: '50px',
      textAlign: 'center'
    },
    topScorerItem: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0.75rem',
      backgroundColor: 'rgba(255, 255, 255, 0.02)',
      borderRadius: '6px',
      marginBottom: '0.5rem',
      borderLeft: '3px solid #10b981'
    },
    badge: {
      display: 'inline-block',
      backgroundColor: '#10b981',
      color: '#0f172a',
      padding: '0.25rem 0.75rem',
      borderRadius: '20px',
      fontSize: '0.85rem',
      fontWeight: '600'
    },
    bottomNav: {
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: '0.5rem',
      padding: '0.5rem',
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      borderTop: '1px solid rgba(16, 185, 129, 0.2)',
      backdropFilter: 'blur(10px)',
      maxWidth: '500px',
      margin: '0 auto',
      left: 0,
      right: 0
    },
    navButton: {
      padding: '0.5rem',
      border: 'none',
      backgroundColor: 'transparent',
      color: '#6b7280',
      cursor: 'pointer',
      textAlign: 'center',
      fontSize: '0.75rem',
      fontWeight: '500',
      transition: 'all 0.2s ease'
    },
    navButtonActive: {
      color: '#10b981'
    }
  };

  // ============= VIEWS =============

  // HOME VIEW
  if (view === 'home') {
    return (
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.title}>⚽ Manager</h1>
          <p style={styles.subtitle}>Spiele & Statistiken</p>
        </header>

        <div style={styles.content}>
          {/* Schnell-Actions */}
          <div style={styles.section}>
            <button style={{...styles.button, ...styles.buttonPrimary}} onClick={() => setView('newgame')}>
              ➕ Neues Spiel
            </button>
            <button style={{...styles.button, ...styles.buttonSecondary}} onClick={() => setView('goals')}>
              ⚽ Tore hinzufügen
            </button>
          </div>

          {/* Top Scorers */}
          {stats.length > 0 && (
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>🏆 Top Scorer</h2>
              <div style={{...styles.card}}>
                {stats.slice(0, 5).map((player, idx) => (
                  <div key={idx} style={styles.topScorerItem}>
                    <div>
                      <span style={{color: '#10b981', fontWeight: '600', marginRight: '0.5rem'}}>#{idx + 1}</span>
                      {player.name}
                    </div>
                    <span style={styles.badge}>{player.goals} ⚽</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Letzte Spiele */}
          {games.length > 0 && (
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>📅 Letzte Spiele</h2>
              {games.slice(0, 5).map((game) => {
                const date = new Date(game.date);
                const dayAgo = Math.floor((Date.now() - date) / (1000 * 60 * 60 * 24));
                const timeStr = dayAgo === 0 ? 'Heute' : dayAgo === 1 ? 'Gestern' : `vor ${dayAgo} Tagen`;
                
                return (
                  <div key={game.id} style={styles.gameCard}>
                    <div>
                      <div style={{fontSize: '0.8rem', color: '#6b7280'}}>{timeStr}</div>
                      <div style={{marginTop: '0.25rem', fontSize: '0.9rem'}}>
                        {game.team1} vs {game.team2}
                      </div>
                    </div>
                    <div style={styles.score}>
                      <span style={styles.scoreValue}>{game.score1}:{game.score2}</span>
                      <span style={{fontSize: '0.8rem', color: '#6b7280'}}>({game.goals?.length || 0})</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {games.length === 0 && (
            <div style={{...styles.card, textAlign: 'center', color: '#6b7280', padding: '2rem'}}>
              <p>📭 Noch keine Spiele erfasst</p>
              <p style={{fontSize: '0.85rem'}}>Starten Sie mit "Neues Spiel"</p>
            </div>
          )}
        </div>

        {/* Bottom Navigation */}
        <nav style={styles.bottomNav}>
          <button style={{...styles.navButton, ...styles.navButtonActive}} onClick={() => setView('home')}>
            🏠 Home
          </button>
          <button style={{...styles.navButton}} onClick={() => setView('newgame')}>
            ➕ Spiel
          </button>
          <button style={{...styles.navButton}} onClick={() => setView('goals')}>
            ⚽ Tore
          </button>
          <button style={{...styles.navButton}} onClick={() => setView('stats')}>
            📊 Stats
          </button>
        </nav>
      </div>
    );
  }

  // NEW GAME VIEW
  if (view === 'newgame') {
    return (
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.title}>⚽ Neues Spiel</h1>
        </header>

        <div style={styles.content}>
          <form onSubmit={handleNewGame} style={styles.form}>
            <div style={styles.section}>
              <label style={{display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color: '#10b981'}}>
                Team 1 Name
              </label>
              <input
                type="text"
                placeholder="z.B. Team A"
                value={formData.team1}
                onChange={(e) => setFormData({...formData, team1: e.target.value})}
                style={styles.input}
                required
              />
            </div>

            <div style={styles.section}>
              <label style={{display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color: '#10b981'}}>
                Team 1 Tore
              </label>
              <input
                type="number"
                min="0"
                value={formData.score1}
                onChange={(e) => setFormData({...formData, score1: e.target.value})}
                style={styles.input}
              />
            </div>

            <div style={{textAlign: 'center', padding: '1rem', fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981'}}>
              {formData.score1} : {formData.score2}
            </div>

            <div style={styles.section}>
              <label style={{display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color: '#10b981'}}>
                Team 2 Tore
              </label>
              <input
                type="number"
                min="0"
                value={formData.score2}
                onChange={(e) => setFormData({...formData, score2: e.target.value})}
                style={styles.input}
              />
            </div>

            <div style={styles.section}>
              <label style={{display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color: '#10b981'}}>
                Team 2 Name
              </label>
              <input
                type="text"
                placeholder="z.B. Team B"
                value={formData.team2}
                onChange={(e) => setFormData({...formData, team2: e.target.value})}
                style={styles.input}
                required
              />
            </div>

            <button type="submit" style={{...styles.button, ...styles.buttonPrimary}}>
              ✅ Spiel speichern
            </button>
            <button type="button" style={{...styles.button, ...styles.buttonSecondary}} onClick={() => setView('home')}>
              Abbrechen
            </button>
          </form>
        </div>
      </div>
    );
  }

  // GOALS VIEW
  if (view === 'goals') {
    const lastGame = games[0];
    
    return (
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.title}>⚽ Tore</h1>
        </header>

        <div style={styles.content}>
          {lastGame ? (
            <>
              <div style={{...styles.card, marginBottom: '1.5rem'}}>
                <div style={{textAlign: 'center'}}>
                  <div style={{fontSize: '0.9rem', color: '#6b7280', marginBottom: '0.5rem'}}>Aktuelles Spiel</div>
                  <div style={{fontSize: '1.25rem', fontWeight: 'bold'}}>
                    {lastGame.team1} <span style={{color: '#10b981'}}>{lastGame.score1}</span> : 
                    <span style={{color: '#10b981'}}>{lastGame.score2}</span> {lastGame.team2}
                  </div>
                </div>
              </div>

              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>{lastGame.team1}</h3>
                <button style={{...styles.button, ...styles.buttonPrimary}} onClick={() => {
                  const player = prompt('Spieler-Name:');
                  if (player) handleAddGoal(lastGame.id, player, lastGame.team1);
                }}>
                  ➕ Tor für {lastGame.team1}
                </button>
              </div>

              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>{lastGame.team2}</h3>
                <button style={{...styles.button, ...styles.buttonPrimary}} onClick={() => {
                  const player = prompt('Spieler-Name:');
                  if (player) handleAddGoal(lastGame.id, player, lastGame.team2);
                }}>
                  ➕ Tor für {lastGame.team2}
                </button>
              </div>

              {lastGame.goals && lastGame.goals.length > 0 && (
                <div style={styles.section}>
                  <h3 style={styles.sectionTitle}>📋 Torschützen</h3>
                  {lastGame.goals.map((goal, idx) => (
                    <div key={idx} style={styles.topScorerItem}>
                      <div>{goal.player}</div>
                      <span style={styles.badge}>{goal.team}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{...styles.card, textAlign: 'center', color: '#6b7280', padding: '2rem'}}>
              <p>❌ Kein Spiel verfügbar</p>
              <button style={{...styles.button, ...styles.buttonPrimary}} onClick={() => setView('newgame')}>
                Neues Spiel erstellen
              </button>
            </div>
          )}

          <button style={{...styles.button, ...styles.buttonSecondary}} onClick={() => setView('home')}>
            Zurück
          </button>
        </div>
      </div>
    );
  }

  // STATS VIEW
  if (view === 'stats') {
    return (
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.title}>📊 Statistiken</h1>
        </header>

        <div style={styles.content}>
          <div style={styles.section}>
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem'}}>
              <div style={{...styles.card, textAlign: 'center'}}>
                <div style={{fontSize: '2rem', color: '#10b981', fontWeight: 'bold'}}>{games.length}</div>
                <div style={{fontSize: '0.85rem', color: '#6b7280'}}>Spiele</div>
              </div>
              <div style={{...styles.card, textAlign: 'center'}}>
                <div style={{fontSize: '2rem', color: '#10b981', fontWeight: 'bold'}}>
                  {games.reduce((sum, g) => sum + (g.goals?.length || 0), 0)}
                </div>
                <div style={{fontSize: '0.85rem', color: '#6b7280'}}>Tore</div>
              </div>
            </div>
          </div>

          {stats.length > 0 && (
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>🏆 Top Scorer</h2>
              <div style={styles.card}>
                {stats.map((player, idx) => (
                  <div key={idx} style={styles.topScorerItem}>
                    <div>
                      <span style={{color: '#10b981', fontWeight: '600', marginRight: '0.5rem'}}>#{idx + 1}</span>
                      {player.name}
                    </div>
                    <span style={styles.badge}>{player.goals}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button style={{...styles.button, ...styles.buttonSecondary}} onClick={() => setView('home')}>
            Zurück
          </button>
        </div>
      </div>
    );
  }
}
