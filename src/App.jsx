/**
 * ⚽ FUSSBALL-MANAGER PWA v3 - MIT PUNKTE-SYSTEM
 * Spieler-Datenbank + Datum + Torschützen + Punkte + Statistiken
 */

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://sdtgwkvmqprbwvtkswxd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_iCVXxm3VuPQIHEvWkkqqPw_1jCVn0QO';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default function FussballManagerPWA() {
  const [view, setView] = useState('home');
  const [games, setGames] = useState([]);
  const [players, setPlayers] = useState([]);
  const [playerStats, setPlayerStats] = useState([]);
  const [topScorers, setTopScorers] = useState([]);
  const [newPlayer, setNewPlayer] = useState('');
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    team1: 'Gelb',
    team2: 'Blau',
    score1: 0,
    score2: 0,
    players1: [],
    players2: [],
    goals: []
  });

  // Daten laden beim Start
  useEffect(() => {
    loadPlayers();
    loadGames();
    loadPlayerStats();
    loadTopScorers();
  }, []);

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

  const loadPlayerStats = async () => {
    try {
      const { data, error } = await supabase
        .from('player_stats')
        .select('*')
        .order('points', { ascending: false });
      if (error) throw error;
      setPlayerStats(data || []);
    } catch (err) {
      console.error('Fehler beim Laden der Statistiken:', err);
    }
  };

  const loadTopScorers = async () => {
    try {
      const { data, error } = await supabase
        .from('top_scorers')
        .select('*')
        .order('total_goals', { ascending: false });
      if (error) throw error;
      setTopScorers(data || []);
    } catch (err) {
      console.error('Fehler beim Laden der Torschützen:', err);
    }
  };

  const handleAddPlayer = async (e) => {
    e.preventDefault();
    if (!newPlayer.trim()) return;

    try {
      const { error } = await supabase
        .from('players')
        .insert([{ name: newPlayer }]);
      if (error) throw error;

      // Auch in player_stats hinzufügen
      await supabase
        .from('player_stats')
        .insert([{ player_name: newPlayer }]);

      setNewPlayer('');
      await loadPlayers();
      showNotification(`✅ ${newPlayer} hinzugefügt`);
    } catch (err) {
      console.error('Fehler:', err);
      alert('Spieler existiert bereits oder Fehler beim Speichern');
    }
  };

  const togglePlayer = (playerName, team) => {
    if (team === 1) {
      setFormData({
        ...formData,
        players1: formData.players1.includes(playerName)
          ? formData.players1.filter(p => p !== playerName)
          : [...formData.players1, playerName]
      });
    } else {
      setFormData({
        ...formData,
        players2: formData.players2.includes(playerName)
          ? formData.players2.filter(p => p !== playerName)
          : [...formData.players2, playerName]
      });
    }
  };

  const addGoal = (playerName, team) => {
    setFormData({
      ...formData,
      goals: [...formData.goals, { player: playerName, team }]
    });
  };

  const removeGoal = (index) => {
    setFormData({
      ...formData,
      goals: formData.goals.filter((_, i) => i !== index)
    });
  };

  const handleNewGame = async (e) => {
    e.preventDefault();

    try {
      const gameId = `game_${Date.now()}`;
      const score1 = parseInt(formData.score1);
      const score2 = parseInt(formData.score2);

      // Bestimme Gewinner
      let winner = 'draw';
      if (score1 > score2) winner = 'team1';
      if (score2 > score1) winner = 'team2';

      // Spiel speichern
      const { error: gameError } = await supabase
        .from('games')
        .insert([{
          game_id: gameId,
          date: formData.date,
          team1: formData.team1,
          team2: formData.team2,
          score1: score1,
          score2: score2
        }]);

      if (gameError) throw gameError;

      // Game Result speichern
      await supabase
        .from('game_results')
        .insert([{
          game_id: gameId,
          team1: formData.team1,
          team2: formData.team2,
          score1: score1,
          score2: score2,
          winner: winner
        }]);

      // Spieler zum Spiel hinzufügen
      const gamePlayers = [
        ...formData.players1.map(p => ({ game_id: gameId, player_name: p, team: formData.team1 })),
        ...formData.players2.map(p => ({ game_id: gameId, player_name: p, team: formData.team2 }))
      ];

      if (gamePlayers.length > 0) {
        await supabase
          .from('game_players')
          .insert(gamePlayers);
      }

      // Tore speichern und Torschützen aktualisieren
      const goals = formData.goals.map(g => ({
        game_id: gameId,
        player_name: g.player,
        team: g.team
      }));

      if (goals.length > 0) {
        await supabase.from('goals').insert(goals);

        // Top Scorers aktualisieren
        for (const goal of formData.goals) {
          const { data: existing } = await supabase
            .from('top_scorers')
            .select('*')
            .eq('player_name', goal.player);

          if (existing && existing.length > 0) {
            await supabase
              .from('top_scorers')
              .update({ total_goals: existing[0].total_goals + 1 })
              .eq('player_name', goal.player);
          } else {
            await supabase
              .from('top_scorers')
              .insert([{ player_name: goal.player, total_goals: 1 }]);
          }
        }
      }

      // Punkte berechnen und speichern
      const pointsToAward = winner === 'draw' ? 1 : winner === 'team1' ? 3 : 0;
      const team = winner === 'team1' ? formData.team1 : formData.team2;
      const playersToAward = winner === 'team1' ? formData.players1 : 
                            winner === 'team2' ? formData.players2 : 
                            [...formData.players1, ...formData.players2];

      for (const playerName of playersToAward) {
        const pointsForThisPlayer = (winner === 'draw' || 
                                    (winner === 'team1' && formData.team1 === team) ||
                                    (winner === 'team2' && formData.team2 === team)) ? pointsToAward : 0;

        // Team Points speichern
        await supabase
          .from('team_points')
          .insert([{
            game_id: gameId,
            player_name: playerName,
            team: winner === 'team1' ? formData.team1 : winner === 'team2' ? formData.team2 : (formData.players1.includes(playerName) ? formData.team1 : formData.team2),
            points_earned: pointsForThisPlayer
          }]);

        // Player Stats aktualisieren
        const { data: playerData } = await supabase
          .from('player_stats')
          .select('*')
          .eq('player_name', playerName);

        if (playerData && playerData.length > 0) {
          const stats = playerData[0];
          const isInTeam1 = formData.players1.includes(playerName);
          const teamWon = isInTeam1 ? (winner === 'team1') : (winner === 'team2');
          const teamLost = isInTeam1 ? (winner === 'team2') : (winner === 'team1');

          const newStats = {
            games_played: stats.games_played + 1,
            wins: stats.wins + (teamWon ? 1 : 0),
            draws: stats.draws + (winner === 'draw' ? 1 : 0),
            losses: stats.losses + (teamLost ? 1 : 0),
            goals_for: stats.goals_for + (isInTeam1 ? score1 : score2),
            goals_against: stats.goals_against + (isInTeam1 ? score2 : score1),
            points: stats.points + pointsForThisPlayer,
            updated_at: new Date().toISOString()
          };

          await supabase
            .from('player_stats')
            .update(newStats)
            .eq('player_name', playerName);
        }
      }

      await loadGames();
      await loadPlayerStats();
      await loadTopScorers();
      
      setFormData({
        date: new Date().toISOString().split('T')[0],
        team1: 'Gelb',
        team2: 'Blau',
        score1: 0,
        score2: 0,
        players1: [],
        players2: [],
        goals: []
      });
      setView('home');
      showNotification(`✅ ${formData.team1} ${score1}:${score2} ${formData.team2}`);
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
    checkbox: {
      display: 'flex',
      alignItems: 'center',
      padding: '0.75rem',
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid rgba(16, 185, 129, 0.2)',
      borderRadius: '8px',
      marginBottom: '0.5rem',
      cursor: 'pointer',
      transition: 'all 0.2s ease'
    },
    checkboxChecked: {
      backgroundColor: '#10b981',
      borderColor: '#10b981'
    },
    statRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0.75rem',
      borderBottom: '1px solid rgba(16, 185, 129, 0.1)',
      fontSize: '0.9rem'
    },
    statValue: {
      fontWeight: '600',
      color: '#10b981'
    },
    badgeGold: {
      display: 'inline-block',
      backgroundColor: '#fbbf24',
      color: '#000',
      padding: '0.25rem 0.75rem',
      borderRadius: '20px',
      fontSize: '0.8rem',
      fontWeight: '600'
    },
    badgeSilver: {
      display: 'inline-block',
      backgroundColor: '#d1d5db',
      color: '#000',
      padding: '0.25rem 0.75rem',
      borderRadius: '20px',
      fontSize: '0.8rem',
      fontWeight: '600'
    },
    badgeBronze: {
      display: 'inline-block',
      backgroundColor: '#d97706',
      color: '#fff',
      padding: '0.25rem 0.75rem',
      borderRadius: '20px',
      fontSize: '0.8rem',
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

  // ============= HOME VIEW =============
  if (view === 'home') {
    return (
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.title}>⚽ Manager</h1>
          <p style={styles.subtitle}>Spiele & Statistiken</p>
        </header>

        <div style={styles.content}>
          <div style={styles.section}>
            <button style={{...styles.button, ...styles.buttonPrimary}} onClick={() => setView('newgame')}>
              ➕ Neues Spiel
            </button>
            <button style={{...styles.button, ...styles.buttonSecondary}} onClick={() => setView('players')}>
              👥 Spieler verwalten
            </button>
          </div>

          {playerStats.length > 0 && (
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>🏆 Top 5 Spieler</h2>
              <div style={styles.card}>
                {playerStats.slice(0, 5).map((stat, idx) => (
                  <div key={idx} style={{...styles.statRow, paddingTop: idx === 0 ? '0.75rem' : '0.75rem'}}>
                    <div>
                      <span style={{marginRight: '0.5rem'}}>
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`}
                      </span>
                      {stat.player_name}
                    </div>
                    <span style={styles.statValue}>{stat.points} Pts</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {games.length > 0 && (
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>📅 Letzte Spiele</h2>
              {games.slice(0, 3).map((game) => {
                const date = new Date(game.date);
                const dateStr = date.toLocaleDateString('de-DE');

                return (
                  <div key={game.id} style={{...styles.card, padding: '1rem', marginBottom: '0.75rem'}}>
                    <div style={{fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.5rem'}}>{dateStr}</div>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <span>{game.team1}</span>
                      <span style={{fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981'}}>
                        {game.score1}:{game.score2}
                      </span>
                      <span>{game.team2}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <nav style={styles.bottomNav}>
          <button style={{...styles.navButton, ...styles.navButtonActive}} onClick={() => setView('home')}>
            🏠 Home
          </button>
          <button style={{...styles.navButton}} onClick={() => setView('newgame')}>
            ➕ Spiel
          </button>
          <button style={{...styles.navButton}} onClick={() => setView('stats')}>
            📊 Tabelle
          </button>
          <button style={{...styles.navButton}} onClick={() => setView('scorers')}>
            ⚽ Tore
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
            <div style={styles.section}>
              <label style={{display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color: '#10b981'}}>
                📅 Datum
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
                style={styles.input}
                required
              />
            </div>

            {/* Team 1 - GELB */}
            <div style={styles.section}>
              <label style={{display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color: '#fbbf24'}}>
                👥 GELB ({formData.players1.length})
              </label>
              <div style={{...styles.card, padding: '0.75rem'}}>
                {players.map(p => (
                  <div
                    key={p.id}
                    style={{
                      ...styles.checkbox,
                      ...(formData.players1.includes(p.name) ? styles.checkboxChecked : {})
                    }}
                    onClick={() => togglePlayer(p.name, 1)}
                  >
                    <input
                      type="checkbox"
                      checked={formData.players1.includes(p.name)}
                      onChange={() => {}}
                      style={{marginRight: '0.75rem', width: '18px', height: '18px', cursor: 'pointer'}}
                    />
                    <span>{p.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Score */}
            <div style={{display: 'flex', gap: '1rem', marginBottom: '1rem'}}>
              <div style={{flex: 1}}>
                <label style={{display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color: '#fbbf24'}}>
                  Tore
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
                <label style={{display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color: '#3b82f6'}}>
                  Tore
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

            {/* Team 2 - BLAU */}
            <div style={styles.section}>
              <label style={{display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color: '#3b82f6'}}>
                👥 BLAU ({formData.players2.length})
              </label>
              <div style={{...styles.card, padding: '0.75rem'}}>
                {players.map(p => (
                  <div
                    key={p.id}
                    style={{
                      ...styles.checkbox,
                      ...(formData.players2.includes(p.name) ? styles.checkboxChecked : {})
                    }}
                    onClick={() => togglePlayer(p.name, 2)}
                  >
                    <input
                      type="checkbox"
                      checked={formData.players2.includes(p.name)}
                      onChange={() => {}}
                      style={{marginRight: '0.75rem', width: '18px', height: '18px', cursor: 'pointer'}}
                    />
                    <span>{p.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Torschützen */}
            <div style={styles.section}>
              <label style={{display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color: '#10b981'}}>
                ⚽ Torschützen ({formData.goals.length})
              </label>

              {formData.players1.length > 0 && (
                <div style={{marginBottom: '1rem'}}>
                  <div style={{fontSize: '0.85rem', color: '#fbbf24', marginBottom: '0.5rem', fontWeight: '600'}}>
                    GELB:
                  </div>
                  <div style={{...styles.card, padding: '0.75rem'}}>
                    {formData.players1.map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => addGoal(p, 'Gelb')}
                        style={{
                          ...styles.button,
                          ...styles.buttonSecondary,
                          marginBottom: '0.5rem',
                          fontSize: '0.9rem',
                          padding: '0.5rem'
                        }}
                      >
                        ➕ {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {formData.players2.length > 0 && (
                <div style={{marginBottom: '1rem'}}>
                  <div style={{fontSize: '0.85rem', color: '#3b82f6', marginBottom: '0.5rem', fontWeight: '600'}}>
                    BLAU:
                  </div>
                  <div style={{...styles.card, padding: '0.75rem'}}>
                    {formData.players2.map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => addGoal(p, 'Blau')}
                        style={{
                          ...styles.button,
                          ...styles.buttonSecondary,
                          marginBottom: '0.5rem',
                          fontSize: '0.9rem',
                          padding: '0.5rem'
                        }}
                      >
                        ➕ {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {formData.goals.length > 0 && (
                <div style={{marginTop: '1rem'}}>
                  <div style={{fontSize: '0.85rem', color: '#10b981', marginBottom: '0.5rem', fontWeight: '600'}}>
                    Erfasste Tore:
                  </div>
                  {formData.goals.map((goal, idx) => (
                    <div key={idx} style={{padding: '0.5rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '6px', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between'}}>
                      <span>{goal.player} ({goal.team})</span>
                      <button type="button" onClick={() => removeGoal(idx)} style={{background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer'}}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
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

  // ============= STATS VIEW =============
  if (view === 'stats') {
    return (
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.title}>📊 Tabelle</h1>
        </header>

        <div style={styles.content}>
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Spieler-Statistik</h2>
            <div style={styles.card}>
              {playerStats.length > 0 ? (
                <>
                  <div style={{...styles.statRow, fontWeight: '600', backgroundColor: 'rgba(16, 185, 129, 0.1)'}}>
                    <div>Spieler</div>
                    <div>Pkte</div>
                    <div>S-U-N</div>
                    <div>T:G</div>
                  </div>
                  {playerStats.map((stat, idx) => (
                    <div key={idx} style={styles.statRow}>
                      <div>{stat.player_name}</div>
                      <div style={styles.statValue}>{stat.points}</div>
                      <div style={{fontSize: '0.8rem', color: '#9ca3af'}}>
                        {stat.wins}-{stat.draws}-{stat.losses}
                      </div>
                      <div style={{fontSize: '0.8rem', color: '#9ca3af'}}>
                        {stat.goals_for}:{stat.goals_against}
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div style={{color: '#6b7280', textAlign: 'center', padding: '1rem'}}>
                  Keine Daten vorhanden
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

  // ============= TOP SCORERS VIEW =============
  if (view === 'scorers') {
    return (
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.title}>⚽ Torschützen</h1>
        </header>

        <div style={styles.content}>
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Top Torschützen</h2>
            <div style={styles.card}>
              {topScorers.length > 0 ? (
                topScorers.map((scorer, idx) => (
                  <div key={idx} style={{...styles.statRow, paddingTop: idx === 0 ? '0.75rem' : '0.75rem'}}>
                    <div>
                      <span style={{marginRight: '0.5rem', marginRight: '0.75rem'}}>
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`}
                      </span>
                      {scorer.player_name}
                    </div>
                    <span style={styles.statValue}>{scorer.total_goals} ⚽</span>
                  </div>
                ))
              ) : (
                <div style={{color: '#6b7280', textAlign: 'center', padding: '1rem'}}>
                  Keine Tore erfasst
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
                <div key={player.id} style={{padding: '0.75rem', borderBottom: '1px solid rgba(16, 185, 129, 0.1)'}}>
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
}