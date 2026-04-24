/**
 * ⚽ FUSSBALL-MANAGER PWA - MIT SUPABASE
 * Spieler-Datenbank + Datum + Cloud-Sync
 */

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Supabase Client
const SUPABASE_URL = 'https://sdtgwkvmqprbwvtkswxd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_iCVXxm3VuPQIHEvWkkqqPw_1jCVn0QO';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default function FussballManagerPWA() {
  const [view, setView] = useState('home');
  const [games, setGames] = useState([]);
  const [players, setPlayers] = useState([]);
  const [newPlayer, setNewPlayer] = useState('');
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    team1: '',
    team2: '',
    score1: 0,
    score2: 0,
    players1: [],
    players2: []
  });

  // Daten laden beim Start
  useEffect(() => {
    loadPlayers();
    loadGames();
  }, []);

  // Spieler laden
  const loadPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .order('name');
      if (error) throw error;
      setPlayers(data || []);
    } catch (err) {
      console.error('Fehler beim Laden der Spieler:', err);
    }
  };

  // Spiele laden
  const loadGames = async () => {
    try {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .order('date', { ascending: false });
      if (error) throw error;
      setGames(data || []);
    } catch (err) {
      console.error('Fehler beim Laden der Spiele:', err);
    }
  };

  // Neuen Spieler hinzufügen
  const handleAddPlayer = async (e) => {
    e.preventDefault();
    if (!newPlayer.trim()) return;

    try {
      const { error } = await supabase
        .from('players')
        .insert([{ name: newPlayer }]);
      if (error) throw error;

      setNewPlayer('');
      await loadPlayers();
      showNotification(`✅ ${newPlayer} hinzugefügt`);
    } catch (err) {
      console.error('Fehler beim Hinzufügen:', err);
      alert('Spieler existiert bereits oder Fehler beim Speichern');
    }
  };

  // Neues Spiel speichern
  const handleNewGame = async (e) => {
    e.preventDefault();

    if (!formData.team1 || !formData.team2) {
      alert('Bitte beide Team-Namen eingeben!');
      return;
    }

    try {
      const gameId = `game_${Date.now()}`;

      // Spiel speichern
      const { error: gameError } = await supabase
        .from('games')
        .insert([{
          game_id: gameId,
          date: formData.date,
          team1: formData.team1,
          team2: formData.team2,
          score1: parseInt(formData.score1),
          score2: parseInt(formData.score2)
        }]);

      if (gameError) throw gameError;

      // Spieler zum Spiel hinzufügen
      const gamePlayers = [
        ...formData.players1.map(p => ({ game_id: gameId, player_name: p, team: formData.team1 })),
        ...formData.players2.map(p => ({ game_id: gameId, player_name: p, team: formData.team2 }))
      ];

      if (gamePlayers.length > 0) {
        const { error: playersError } = await supabase
          .from('game_players')
          .insert(gamePlayers);
        if (playersError) throw playersError;
      }

      await loadGames();
      setFormData({
        date: new Date().toISOString().split('T')[0],
        team1: '',
        team2: '',
        score1: 0,
        score2: 0,
        players1: [],
        players2: []
      });
      setView('home');
      showNotification(`✅ ${formData.team1} ${formData.score1}:${formData.score2} ${formData.team2}`);
    } catch (err) {
      console.error('Fehler beim Speichern:', err);
      alert('Fehler beim Speichern des Spiels');
    }
  };

  const showNotification = (message) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Fußball-Manager', { body: message });
    }
  };

  // Styles
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
      backdropFilter: 'blur(10px)'
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
      boxSizing: 'border-box'
    },
    select: {
      width: '100%',
      padding: '0.75rem',
      marginBottom: '1rem',
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      border: '1px solid rgba(16, 185, 129, 0.2)',
      borderRadius: '8px',
      color: '#fff',
      fontSize: '1rem',
      boxSizing: 'border-box'
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
    scoreValue: {
      fontSize: '1.5rem',
      fontWeight: 'bold',
      color: '#10b981',
      minWidth: '50px',
      textAlign: 'center'
    },
    badge: {
      display: 'inline-block',
      backgroundColor: '#10b981',
      color: '#0f172a',
      padding: '0.25rem 0.75rem',
      borderRadius: '20px',
      fontSize: '0.85rem',
      fontWeight: '600',
      marginRight: '0.5rem'
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
    },
    playerList: {
      maxHeight: '200px',
      overflowY: 'auto',
      marginBottom: '1rem'
    },
    playerItem: {
      padding: '0.5rem',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      borderRadius: '6px',
      marginBottom: '0.5rem',
      cursor: 'pointer',
      border: '1px solid rgba(16, 185, 129, 0.2)',
      fontSize: '0.9rem'
    },
    playerItemSelected: {
      backgroundColor: '#10b981',
      color: '#0f172a'
    }
  };

  // ============= HOME VIEW =============
  if (view === 'home') {
    return (
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.title}>⚽ Manager</h1>
          <p style={styles.subtitle}>Spiele & Statistiken</p>
        </header>

        <div style={styles.content}>
          {/* Quick Actions */}
          <div style={styles.section}>
            <button style={{...styles.button, ...styles.buttonPrimary}} onClick={() => setView('newgame')}>
              ➕ Neues Spiel
            </button>
            <button style={{...styles.button, ...styles.buttonSecondary}} onClick={() => setView('players')}>
              👥 Spieler verwalten
            </button>
          </div>

          {/* Letzte Spiele */}
          {games.length > 0 && (
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>📅 Letzte Spiele</h2>
              {games.slice(0, 5).map((game) => {
                const date = new Date(game.date);
                const dateStr = date.toLocaleDateString('de-DE');

                return (
                  <div key={game.id} style={styles.gameCard}>
                    <div>
                      <div style={{fontSize: '0.8rem', color: '#6b7280'}}>{dateStr}</div>
                      <div style={{marginTop: '0.25rem', fontSize: '0.9rem'}}>
                        {game.team1} vs {game.team2}
                      </div>
                    </div>
                    <div>
                      <span style={styles.scoreValue}>{game.score1}:{game.score2}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {games.length === 0 && (
            <div style={{...styles.card, textAlign: 'center', color: '#6b7280', padding: '2rem'}}>
              <p>📭 Noch keine Spiele erfasst</p>
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
          <button style={{...styles.navButton}} onClick={() => setView('players')}>
            👥 Spieler
          </button>
          <button style={{...styles.navButton}} onClick={() => setView('stats')}>
            📊 Stats
          </button>
        </nav>
      </div>
    );
  }

  // ============= NEW GAME VIEW =============
  if (view === 'newgame') {
    return (
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.title}>⚽ Neues Spiel</h1>
        </header>

        <div style={styles.content}>
          <form onSubmit={handleNewGame} style={{marginBottom: '1rem'}}>
            {/* Datum */}
            <div style={styles.section}>
              <label style={{display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color: '#10b981'}}>
                Datum
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
                style={styles.input}
                required
              />
            </div>

            {/* Team 1 */}
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

            {/* Team 1 Spieler */}
            <div style={styles.section}>
              <label style={{display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color: '#10b981'}}>
                Spieler {formData.team1 || 'Team 1'}
              </label>
              <select
                multiple
                value={formData.players1}
                onChange={(e) => setFormData({
                  ...formData,
                  players1: Array.from(e.target.selectedOptions, option => option.value)
                })}
                style={{...styles.select, height: '120px'}}
              >
                {players.map(p => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
              </select>
              <small style={{color: '#6b7280'}}>Ctrl+Click zum Mehrfachauswählen</small>
            </div>

            {/* Score */}
            <div style={{display: 'flex', gap: '1rem', marginBottom: '1rem'}}>
              <div style={{flex: 1}}>
                <label style={{display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color: '#10b981'}}>
                  Tore Team 1
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.score1}
                  onChange={(e) => setFormData({...formData, score1: e.target.value})}
                  style={styles.input}
                />
              </div>
              <div style={{flex: 1}}>
                <label style={{display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color: '#10b981'}}>
                  Tore Team 2
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.score2}
                  onChange={(e) => setFormData({...formData, score2: e.target.value})}
                  style={styles.input}
                />
              </div>
            </div>

            {/* Team 2 */}
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

            {/* Team 2 Spieler */}
            <div style={styles.section}>
              <label style={{display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color: '#10b981'}}>
                Spieler {formData.team2 || 'Team 2'}
              </label>
              <select
                multiple
                value={formData.players2}
                onChange={(e) => setFormData({
                  ...formData,
                  players2: Array.from(e.target.selectedOptions, option => option.value)
                })}
                style={{...styles.select, height: '120px'}}
              >
                {players.map(p => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
              </select>
              <small style={{color: '#6b7280'}}>Ctrl+Click zum Mehrfachauswählen</small>
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

  // ============= PLAYERS VIEW =============
  if (view === 'players') {
    return (
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.title}>👥 Spieler</h1>
        </header>

        <div style={styles.content}>
          <form onSubmit={handleAddPlayer} style={{marginBottom: '1.5rem'}}>
            <div style={styles.section}>
              <label style={{display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color: '#10b981'}}>
                Neuen Spieler hinzufügen
              </label>
              <input
                type="text"
                placeholder="Spieler-Name"
                value={newPlayer}
                onChange={(e) => setNewPlayer(e.target.value)}
                style={styles.input}
              />
              <button type="submit" style={{...styles.button, ...styles.buttonPrimary}}>
                ➕ Hinzufügen
              </button>
            </div>
          </form>

          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>📋 Alle Spieler ({players.length})</h2>
            <div style={styles.card}>
              {players.map((player) => (
                <div key={player.id} style={{...styles.playerItem, marginBottom: '0.5rem'}}>
                  {player.name}
                </div>
              ))}
              {players.length === 0 && (
                <div style={{color: '#6b7280', textAlign: 'center', padding: '1rem'}}>
                  Keine Spieler vorhanden
                </div>
              )}
            </div>
          </div>

          <button style={{...styles.button, ...styles.buttonSecondary}} onClick={() => setView('home')}>
            Zurück
          </button>
        </div>
      </div>
    );
  }

  // ============= STATS VIEW =============
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
                <div style={{fontSize: '2rem', color: '#10b981', fontWeight: 'bold'}}>{players.length}</div>
                <div style={{fontSize: '0.85rem', color: '#6b7280'}}>Spieler</div>
              </div>
            </div>
          </div>

          <button style={{...styles.button, ...styles.buttonSecondary}} onClick={() => setView('home')}>
            Zurück
          </button>
        </div>
      </div>
    );
  }
}
