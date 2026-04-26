/**
 * FUSSBALL-MANAGER PWA v14.1 - TOP NAVIGATION FIX
 * Navigation oben mit Buttons + Back-Button << + Design optimiert
 */

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://sdtgwkvmqprbwvtkswxd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_iCVXxm3VuPQIHEvWkkqqPw_1jCVn0QO';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const ADMIN_PASSWORD = '1qay2wsx!Admin';

export default function FussballManagerPWA() {
  const [view, setView] = useState('home');
  const [games, setGames] = useState([]);
  const [players, setPlayers] = useState([]);
  const [playerStats, setPlayerStats] = useState([]);
  const [playerPositions, setPlayerPositions] = useState([]);
  const [topScorers, setTopScorers] = useState([]);
  const [teamBilanz, setTeamBilanz] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [newPlayer, setNewPlayer] = useState('');
  const [renamingPlayer, setRenamingPlayer] = useState(null);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [editingPositions, setEditingPositions] = useState({});
  const [editingGame, setEditingGame] = useState(null);
  const [generatedTeams, setGeneratedTeams] = useState(null);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    team1: 'Gelb',
    team2: 'Blau',
    score1: 0,
    score2: 0,
    players1: [],
    players2: [],
    goals: [],
  });

  useEffect(() => {
    loadAdmins();
    loadPlayers();
    loadGames();
    loadPlayerStats();
    loadPlayerPositions();
    loadTopScorers();
    calculateTeamBilanz();
  }, [games]);

  const loadAdmins = async () => {
    try {
      const { data, error } = await supabase.from('admins').select('*');
      if (error) throw error;
      setAdmins(data || []);
    } catch (err) {
      console.error('Fehler:', err);
    }
  };

  const loadPlayerPositions = async () => {
    try {
      const { data, error } = await supabase.from('player_positions').select('*');
      if (error) throw error;
      setPlayerPositions(data || []);
    } catch (err) {
      console.error('Fehler:', err);
    }
  };

  const loadPlayers = async () => {
    try {
      const { data, error } = await supabase.from('players').select('*').order('name');
      if (error) throw error;
      setPlayers(data || []);
    } catch (err) {
      console.error('Fehler:', err);
    }
  };

  const loadGames = async () => {
    try {
      const { data, error } = await supabase.from('games').select('*').order('date', { ascending: false });
      if (error) throw error;
      setGames(data || []);
    } catch (err) {
      console.error('Fehler:', err);
    }
  };

  const loadPlayerStats = async () => {
    try {
      const { data, error } = await supabase.from('player_stats').select('*').order('points', { ascending: false });
      if (error) throw error;
      setPlayerStats(data || []);
    } catch (err) {
      console.error('Fehler:', err);
    }
  };

  const loadTopScorers = async () => {
    try {
      const { data, error } = await supabase.from('top_scorers').select('*').order('total_goals', { ascending: false });
      if (error) throw error;
      setTopScorers(data || []);
    } catch (err) {
      console.error('Fehler:', err);
    }
  };

  const savePlayerPosition = async (playerName, sturm, mittelfeld, abwehr) => {
    try {
      const { data: existing } = await supabase
        .from('player_positions')
        .select('*')
        .eq('player_name', playerName);

      if (existing && existing.length > 0) {
        await supabase
          .from('player_positions')
          .update({
            position_sturm: sturm,
            position_mittelfeld: mittelfeld,
            position_abwehr: abwehr,
            updated_at: new Date().toISOString(),
          })
          .eq('player_name', playerName);
      } else {
        await supabase
          .from('player_positions')
          .insert([{
            player_name: playerName,
            position_sturm: sturm,
            position_mittelfeld: mittelfeld,
            position_abwehr: abwehr,
          }]);
      }

      await loadPlayerPositions();
      showNotification(`✅ ${playerName} Positionen aktualisiert`);
    } catch (err) {
      console.error('Fehler:', err);
      alert('Fehler beim Speichern');
    }
  };

  const getPlayerPositions = (playerName) => {
    const pos = playerPositions.find((p) => p.player_name === playerName);
    return pos
      ? {
          sturm: pos.position_sturm || 5,
          mittelfeld: pos.position_mittelfeld || 5,
          abwehr: pos.position_abwehr || 5,
        }
      : { sturm: 5, mittelfeld: 5, abwehr: 5 };
  };

  const calculatePlayerStats = (playerName) => {
    const playerGames = games.filter((g) => {
      const { data: gamePlayers } = supabase
        .from('game_players')
        .select('*')
        .eq('player_name', playerName)
        .eq('game_id', g.game_id);
      return gamePlayers && gamePlayers.length > 0;
    });

    const totalGames = games.length;
    const playedGames = playerGames.length;
    const missedGames = totalGames - playedGames;
    const attendance = totalGames > 0 ? ((playedGames / totalGames) * 100).toFixed(1) : '0.0';

    let streak = 0;
    const recentGames = games.slice(0, 5);
    for (const g of recentGames) {
      const isInGame = playerGames.some((pg) => pg.game_id === g.game_id);
      if (isInGame) streak += 1;
      else break;
    }

    let maxStreak = 0;
    let currentStreak = 0;
    const sortedGames = [...games].reverse();
    for (const g of sortedGames) {
      const isInGame = playerGames.some((pg) => pg.game_id === g.game_id);
      if (isInGame) {
        currentStreak += 1;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    return {
      playedGames,
      missedGames,
      attendance,
      currentStreak: streak,
      maxStreak,
    };
  };

  const getGoalsPerGame = (playerName) => {
    const stat = playerStats.find((s) => s.player_name === playerName);
    if (!stat || stat.games_played === 0) return '0.00';
    return (stat.goals_for / stat.games_played).toFixed(2);
  };

  const generateBalancedTeams = () => {
    if (players.length < 2) {
      alert('Mindestens 2 Spieler erforderlich!');
      return;
    }

    const playerScores = players.map((p) => {
      const pos = getPlayerPositions(p.name);
      const avg = (pos.sturm + pos.mittelfeld + pos.abwehr) / 3;
      return { name: p.name, score: avg, positions: pos };
    });

    playerScores.sort((a, b) => b.score - a.score);

    const team1 = [];
    const team2 = [];
    playerScores.forEach((p, idx) => {
      if (idx % 2 === 0) team1.push(p);
      else team2.push(p);
    });

    const team1Avg = (team1.reduce((sum, p) => sum + p.score, 0) / team1.length).toFixed(2);
    const team2Avg = (team2.reduce((sum, p) => sum + p.score, 0) / team2.length).toFixed(2);

    setGeneratedTeams({
      team1: { players: team1, avg: team1Avg },
      team2: { players: team2, avg: team2Avg },
      difference: Math.abs(team1Avg - team2Avg).toFixed(2),
    });

    showNotification('✅ Teams generiert!');
  };

  const calculateTeamBilanz = () => {
    const pairingMap = {};

    games.forEach((game) => {
      const { team1, team2, score1, score2 } = game;
      const pairingKey = [team1, team2].sort().join(' vs ');

      if (!pairingMap[pairingKey]) {
        pairingMap[pairingKey] = {
          team1,
          team2,
          games: 0,
          team1Wins: 0,
          team2Wins: 0,
          draws: 0,
          team1Goals: 0,
          team2Goals: 0,
        };
      }

      pairingMap[pairingKey].games += 1;
      pairingMap[pairingKey].team1Goals += score1;
      pairingMap[pairingKey].team2Goals += score2;

      if (score1 > score2) pairingMap[pairingKey].team1Wins += 1;
      else if (score2 > score1) pairingMap[pairingKey].team2Wins += 1;
      else pairingMap[pairingKey].draws += 1;
    });

    const bilanzArray = Object.values(pairingMap).sort((a, b) => b.games - a.games);
    setTeamBilanz(bilanzArray);
  };

  const handleAdminLogin = (password) => {
    if (password === ADMIN_PASSWORD) {
      setIsAdminMode(true);
      setAdminPassword('');
      setShowAdminLogin(false);
      showNotification('✅ Admin-Mode aktiviert');
    } else {
      alert('❌ Falsches Passwort!');
      setAdminPassword('');
    }
  };

  const handleAddPlayer = async (e) => {
    e.preventDefault();
    if (!isAdminMode) {
      alert('Nur Admins können Spieler hinzufügen!');
      return;
    }
    if (!newPlayer.trim()) return;

    try {
      await supabase.from('players').insert([{ name: newPlayer }]);
      await supabase.from('player_stats').insert([{ player_name: newPlayer }]);
      await supabase.from('player_positions').insert([{
        player_name: newPlayer,
        position_sturm: 5,
        position_mittelfeld: 5,
        position_abwehr: 5,
      }]);
      setNewPlayer('');
      await loadPlayers();
      await loadPlayerPositions();
      showNotification(`✅ ${newPlayer} hinzugefügt`);
    } catch (err) {
      console.error('Fehler:', err);
      alert('Spieler existiert bereits oder Fehler beim Speichern');
    }
  };

  const handleRenamePlayer = async (oldName) => {
    if (!isAdminMode) {
      alert('Nur Admins können Spieler umbenennen!');
      return;
    }
    if (!newPlayerName.trim() || newPlayerName === oldName) {
      setRenamingPlayer(null);
      setNewPlayerName('');
      return;
    }

    try {
      await supabase.from('players').update({ name: newPlayerName }).eq('name', oldName);
      await supabase.from('player_stats').update({ player_name: newPlayerName }).eq('player_name', oldName);
      await supabase.from('player_positions').update({ player_name: newPlayerName }).eq('player_name', oldName);
      await supabase.from('top_scorers').update({ player_name: newPlayerName }).eq('player_name', oldName);
      await supabase.from('game_players').update({ player_name: newPlayerName }).eq('player_name', oldName);
      await supabase.from('goals').update({ player_name: newPlayerName }).eq('player_name', oldName);
      await supabase.from('team_points').update({ player_name: newPlayerName }).eq('player_name', oldName);

      setRenamingPlayer(null);
      setNewPlayerName('');
      await loadPlayers();
      await loadPlayerStats();
      await loadPlayerPositions();
      await loadTopScorers();
      showNotification(`✅ ${oldName} → ${newPlayerName}`);
    } catch (err) {
      console.error('Fehler:', err);
      alert('Fehler beim Umbenennen');
    }
  };

  const deletePlayer = async (playerName) => {
    if (!isAdminMode) {
      alert('Nur Admins können Spieler löschen!');
      return;
    }
    if (!confirm(`${playerName} wirklich löschen?`)) return;

    try {
      await supabase.from('players').delete().eq('name', playerName);
      await supabase.from('player_stats').delete().eq('player_name', playerName);
      await supabase.from('player_positions').delete().eq('player_name', playerName);
      await loadPlayers();
      await loadPlayerStats();
      await loadPlayerPositions();
      showNotification(`✅ ${playerName} gelöscht`);
    } catch (err) {
      console.error('Fehler:', err);
      alert('Fehler beim Löschen');
    }
  };

  const deleteGame = async (gameId, gameIdStr) => {
    if (!isAdminMode) {
      alert('Nur Admins können Spiele löschen!');
      return;
    }
    if (!confirm('Spiel wirklich löschen?')) return;

    try {
      await supabase.from('games').delete().eq('id', gameId);
      await supabase.from('goals').delete().eq('game_id', gameIdStr);
      await supabase.from('game_players').delete().eq('game_id', gameIdStr);
      await supabase.from('game_results').delete().eq('game_id', gameIdStr);
      await supabase.from('team_points').delete().eq('game_id', gameIdStr);
      await loadGames();
      showNotification('✅ Spiel gelöscht');
    } catch (err) {
      console.error('Fehler:', err);
      alert('Fehler beim Löschen');
    }
  };

  const togglePlayer = (playerName, team) => {
    if (team === 1) {
      setFormData({
        ...formData,
        players1: formData.players1.includes(playerName)
          ? formData.players1.filter((p) => p !== playerName)
          : [...formData.players1, playerName],
      });
    } else {
      setFormData({
        ...formData,
        players2: formData.players2.includes(playerName)
          ? formData.players2.filter((p) => p !== playerName)
          : [...formData.players2, playerName],
      });
    }
  };

  const addGoal = (playerName, team) => {
    setFormData({
      ...formData,
      goals: [...formData.goals, { player: playerName, team }],
    });
  };

  const removeGoal = (index) => {
    setFormData({
      ...formData,
      goals: formData.goals.filter((_, i) => i !== index),
    });
  };

  const rollbackGamePoints = async (gameId) => {
    try {
      const { data: pointsData, error: fetchError } = await supabase
        .from('team_points')
        .select('*')
        .eq('game_id', gameId);

      if (fetchError) throw fetchError;

      if (pointsData && pointsData.length > 0) {
        for (const point of pointsData) {
          const { data: playerData } = await supabase
            .from('player_stats')
            .select('*')
            .eq('player_name', point.player_name);

          if (playerData && playerData.length > 0) {
            const stats = playerData[0];
            let newWins = stats.wins;
            let newDraws = stats.draws;
            let newLosses = stats.losses;

            if (point.points_earned === 3) newWins = Math.max(0, newWins - 1);
            else if (point.points_earned === 1) newDraws = Math.max(0, newDraws - 1);
            else if (point.points_earned === 0) newLosses = Math.max(0, newLosses - 1);

            await supabase
              .from('player_stats')
              .update({
                games_played: Math.max(0, stats.games_played - 1),
                wins: newWins,
                draws: newDraws,
                losses: newLosses,
                points: Math.max(0, stats.points - point.points_earned),
                updated_at: new Date().toISOString(),
              })
              .eq('player_name', point.player_name);
          }
        }
      }

      await supabase.from('team_points').delete().eq('game_id', gameId);
    } catch (err) {
      console.error('Fehler:', err);
      throw err;
    }
  };

  const handleNewGame = async (e) => {
    e.preventDefault();
    if (!isAdminMode) {
      alert('Nur Admins können Spiele erfassen!');
      return;
    }

    try {
      const gameId = editingGame?.game_id || `game_${Date.now()}`;
      const score1 = parseInt(formData.score1);
      const score2 = parseInt(formData.score2);
      let winner = 'draw';
      if (score1 > score2) winner = 'team1';
      if (score2 > score1) winner = 'team2';

      if (editingGame) {
        await rollbackGamePoints(gameId);
        await supabase
          .from('games')
          .update({ date: formData.date, score1, score2 })
          .eq('id', editingGame.id);
        await supabase
          .from('game_results')
          .update({ score1, score2, winner })
          .eq('game_id', gameId);
      } else {
        await supabase.from('games').insert([{
          game_id: gameId,
          date: formData.date,
          team1: formData.team1,
          team2: formData.team2,
          score1,
          score2,
        }]);
        await supabase.from('game_results').insert([{
          game_id: gameId,
          team1: formData.team1,
          team2: formData.team2,
          score1,
          score2,
          winner,
        }]);

        const gamePlayers = [
          ...formData.players1.map((p) => ({ game_id: gameId, player_name: p, team: formData.team1 })),
          ...formData.players2.map((p) => ({ game_id: gameId, player_name: p, team: formData.team2 })),
        ];
        if (gamePlayers.length > 0) {
          await supabase.from('game_players').insert(gamePlayers);
        }

        const goals = formData.goals.map((g) => ({
          game_id: gameId,
          player_name: g.player,
          team: g.team,
        }));
        if (goals.length > 0) {
          await supabase.from('goals').insert(goals);
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
      }

      const pointsForWinner = 3;
      const pointsForDraw = 1;
      const pointsForLoser = 0;

      for (const playerName of formData.players1) {
        let pointsEarned = pointsForLoser;
        let wins = 0;
        let draws = 0;
        let losses = 0;

        if (winner === 'team1') { pointsEarned = pointsForWinner; wins = 1; }
        else if (winner === 'draw') { pointsEarned = pointsForDraw; draws = 1; }
        else losses = 1;

        const { data: existing } = await supabase
          .from('player_stats')
          .select('*')
          .eq('player_name', playerName);
        if (existing && existing.length > 0) {
          const stats = existing[0];
          await supabase.from('player_stats').update({
            games_played: stats.games_played + 1,
            wins: stats.wins + wins,
            draws: stats.draws + draws,
            losses: stats.losses + losses,
            goals_for: stats.goals_for + score1,
            goals_against: stats.goals_against + score2,
            points: stats.points + pointsEarned,
            updated_at: new Date().toISOString(),
          }).eq('player_name', playerName);
        }

        await supabase.from('team_points').insert([{
          game_id: gameId,
          player_name: playerName,
          team: formData.team1,
          points_earned: pointsEarned,
        }]);
      }

      for (const playerName of formData.players2) {
        let pointsEarned = pointsForLoser;
        let wins = 0;
        let draws = 0;
        let losses = 0;

        if (winner === 'team2') { pointsEarned = pointsForWinner; wins = 1; }
        else if (winner === 'draw') { pointsEarned = pointsForDraw; draws = 1; }
        else losses = 1;

        const { data: existing } = await supabase
          .from('player_stats')
          .select('*')
          .eq('player_name', playerName);
        if (existing && existing.length > 0) {
          const stats = existing[0];
          await supabase.from('player_stats').update({
            games_played: stats.games_played + 1,
            wins: stats.wins + wins,
            draws: stats.draws + draws,
            losses: stats.losses + losses,
            goals_for: stats.goals_for + score2,
            goals_against: stats.goals_against + score1,
            points: stats.points + pointsEarned,
            updated_at: new Date().toISOString(),
          }).eq('player_name', playerName);
        }

        await supabase.from('team_points').insert([{
          game_id: gameId,
          player_name: playerName,
          team: formData.team2,
          points_earned: pointsEarned,
        }]);
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
        goals: [],
      });
      setEditingGame(null);
      setView('home');
      showNotification(
        editingGame
          ? '✅ Spiel aktualisiert'
          : `✅ ${formData.team1} ${score1}:${score2} ${formData.team2}`
      );
    } catch (err) {
      console.error('Fehler:', err);
      alert('Fehler beim Speichern des Spiels');
    }
  };

  const startEditGame = (game) => {
    if (!isAdminMode) {
      alert('Nur Admins können Spiele bearbeiten!');
      return;
    }
    setEditingGame(game);
    setFormData({
      date: game.date.split('T')[0],
      team1: game.team1,
      team2: game.team2,
      score1: game.score1,
      score2: game.score2,
      players1: [],
      players2: [],
      goals: [],
    });
    setView('newgame');
  };

  const showNotification = (message) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Fußball-Manager', { body: message });
    }
  };

  const GELB = '#fbbf24';
  const BLAU = '#3b82f6';
  const GRUEN = '#10b981';

  const styles = {
    container: {
      minHeight: '100vh',
      backgroundColor: '#0f172a',
      color: '#fff',
      fontFamily: '"Segoe UI", Tahoma, Geneva, sans-serif',
      paddingTop: '140px',
      paddingBottom: '20px',
      backgroundImage: 'linear-gradient(135deg, #0f172a 0%, #1a2332 100%)',
    },
    topNav: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      background: `linear-gradient(135deg, ${GRUEN} 0%, #059669 100%)`,
      padding: '0.75rem 1rem',
      boxShadow: `0 8px 16px rgba(16, 185, 129, 0.2)`,
      zIndex: 100,
      maxWidth: '500px',
      margin: '0 auto',
      width: '100%',
      boxSizing: 'border-box',
    },
    topNavInner: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '0.5rem',
    },
    backButton: {
      background: 'rgba(255, 255, 255, 0.2)',
      border: 'none',
      color: '#fff',
      padding: '0.5rem 0.75rem',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '1.3rem',
      fontWeight: 'bold',
      minWidth: '45px',
      textAlign: 'center',
    },
    navButtons: {
      display: 'flex',
      gap: '0.5rem',
      flex: 1,
      overflowX: 'auto',
    },
    navButton: {
      background: 'rgba(255, 255, 255, 0.2)',
      border: 'none',
      color: '#fff',
      padding: '0.5rem 0.75rem',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '0.75rem',
      fontWeight: '600',
      whiteSpace: 'nowrap',
      flex: '0 0 auto',
    },
    navButtonActive: {
      background: 'rgba(255, 255, 255, 0.4)',
      color: '#fff',
    },
    adminButton: {
      background: 'rgba(255, 255, 255, 0.2)',
      border: 'none',
      color: '#fff',
      padding: '0.5rem 0.6rem',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '1rem',
      fontWeight: 'bold',
    },
    content: {
      maxWidth: '500px',
      margin: '0 auto',
      padding: '0 1rem',
    },
    section: {
      marginBottom: '1.5rem',
    },
    sectionTitle: {
      fontSize: '1.1rem',
      fontWeight: '600',
      marginBottom: '1rem',
      paddingBottom: '0.75rem',
      borderBottom: `2px solid ${GRUEN}`,
      display: 'inline-block',
    },
    card: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      border: `1px solid rgba(16, 185, 129, 0.2)`,
      borderRadius: '12px',
      padding: '1.25rem',
      marginBottom: '1rem',
      backdropFilter: 'blur(10px)',
    },
    button: {
      padding: '0.75rem 1.5rem',
      border: 'none',
      borderRadius: '8px',
      fontSize: '0.95rem',
      fontWeight: '600',
      cursor: 'pointer',
      width: '100%',
      marginBottom: '0.75rem',
    },
    buttonPrimary: {
      background: `linear-gradient(135deg, ${GRUEN} 0%, #059669 100%)`,
      color: 'white',
    },
    buttonSecondary: {
      background: 'rgba(255, 255, 255, 0.1)',
      color: '#fff',
      border: `1px solid rgba(16, 185, 129, 0.3)`,
    },
    buttonDanger: {
      background: '#ef4444',
      color: 'white',
    },
    input: {
      width: '100%',
      padding: '0.75rem',
      marginBottom: '1rem',
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      border: `1px solid rgba(16, 185, 129, 0.2)`,
      borderRadius: '8px',
      color: '#fff',
      fontSize: '1rem',
      boxSizing: 'border-box',
    },
    select: {
      width: '100%',
      padding: '0.75rem',
      marginBottom: '1rem',
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      border: `1px solid rgba(16, 185, 129, 0.2)`,
      borderRadius: '8px',
      color: '#fff',
      fontSize: '1rem',
      boxSizing: 'border-box',
    },
    checkbox: {
      display: 'flex',
      alignItems: 'center',
      padding: '0.75rem',
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      border: `1px solid rgba(16, 185, 129, 0.2)`,
      borderRadius: '8px',
      marginBottom: '0.5rem',
      cursor: 'pointer',
    },
    checkboxChecked: {
      backgroundColor: GRUEN,
      borderColor: GRUEN,
    },
    statRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0.75rem',
      borderBottom: '1px solid rgba(16, 185, 129, 0.1)',
      fontSize: '0.9rem',
    },
    statValue: {
      fontWeight: '600',
      color: GRUEN,
    },
  };

  const AdminLoginModal = () => (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    }}>
      <div style={{ ...styles.card, maxWidth: '300px' }}>
        <h3 style={{ textAlign: 'center', marginTop: 0 }}>🔐 Admin-Login</h3>
        <input
          type="password"
          placeholder="Passwort"
          value={adminPassword}
          onChange={(e) => setAdminPassword(e.target.value)}
          style={styles.input}
          onKeyPress={(e) => { if (e.key === 'Enter') handleAdminLogin(adminPassword); }}
        />
        <button
          onClick={() => handleAdminLogin(adminPassword)}
          style={{ ...styles.button, ...styles.buttonPrimary, marginBottom: '0.5rem' }}
        >
          ✅ Anmelden
        </button>
        <button
          onClick={() => setShowAdminLogin(false)}
          style={{ ...styles.button, ...styles.buttonSecondary }}
        >
          Abbrechen
        </button>
      </div>
    </div>
  );

  const TopNav = () => (
    <div style={styles.topNav}>
      <div style={styles.topNavInner}>
        {view !== 'home' ? (
          <button
            style={styles.backButton}
            onClick={() => {
              setView('home');
              setEditingGame(null);
            }}
            title="Zurück"
          >
            &lt;&lt;
          </button>
        ) : (
          <div style={{ minWidth: '45px' }} />
        )}
        
        <div style={styles.navButtons}>
          <button
            style={{
              ...styles.navButton,
              ...(view === 'home' ? styles.navButtonActive : {}),
            }}
            onClick={() => { setView('home'); setEditingGame(null); }}
          >
            🏠 Home
          </button>
          <button
            style={{
              ...styles.navButton,
              ...(view === 'stats' ? styles.navButtonActive : {}),
            }}
            onClick={() => setView('stats')}
          >
            📊 Tabelle
          </button>
          <button
            style={{
              ...styles.navButton,
              ...(view === 'scorers' ? styles.navButtonActive : {}),
            }}
            onClick={() => setView('scorers')}
          >
            ⚽ Tore
          </button>
          <button
            style={{
              ...styles.navButton,
              ...(view === 'statspro' ? styles.navButtonActive : {}),
            }}
            onClick={() => setView('statspro')}
          >
            ⭐ Pro
          </button>
        </div>

        {view === 'home' && (
          <button
            style={styles.adminButton}
            onClick={() => {
              if (isAdminMode) {
                setIsAdminMode(false);
                showNotification('❌ Admin-Mode deaktiviert');
              } else {
                setShowAdminLogin(true);
              }
            }}
            title={isAdminMode ? 'Admin-Mode AUS' : 'Admin-Mode AN'}
          >
            {isAdminMode ? '🔐' : '🔓'}
          </button>
        )}
      </div>
    </div>
  );

  if (view === 'home') {
    return (
      <div style={styles.container}>
        {showAdminLogin && <AdminLoginModal />}
        <TopNav />

        <div style={styles.content}>
          {isAdminMode && (
            <div style={styles.section}>
              <button
                style={{ ...styles.button, ...styles.buttonPrimary }}
                onClick={() => setView('newgame')}
              >
                ➕ Neues Spiel
              </button>
              <button
                style={{ ...styles.button, ...styles.buttonSecondary }}
                onClick={() => setView('players')}
              >
                👥 Spieler verwalten
              </button>
              <button
                style={{ ...styles.button, ...styles.buttonSecondary }}
                onClick={generateBalancedTeams}
              >
                🎯 Teams generieren
              </button>
            </div>
          )}

          {generatedTeams && (
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>🎯 Generierte Teams</h2>
              <div style={styles.card}>
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ color: GELB, fontWeight: '600', marginBottom: '0.5rem' }}>
                    Team 1 (Ø {generatedTeams.team1.avg})
                  </div>
                  {generatedTeams.team1.players.map((p) => (
                    <div key={p.name} style={{ fontSize: '0.85rem', padding: '0.25rem' }}>
                      {p.name}
                    </div>
                  ))}
                </div>
                <div style={{ borderTop: `1px solid rgba(16, 185, 129, 0.2)`, paddingTop: '1rem', marginBottom: '1rem' }}>
                  <div style={{ color: BLAU, fontWeight: '600', marginBottom: '0.5rem' }}>
                    Team 2 (Ø {generatedTeams.team2.avg})
                  </div>
                  {generatedTeams.team2.players.map((p) => (
                    <div key={p.name} style={{ fontSize: '0.85rem', padding: '0.25rem' }}>
                      {p.name}
                    </div>
                  ))}
                </div>
                <div style={{ textAlign: 'center', color: GRUEN, fontSize: '0.85rem', fontWeight: '600' }}>
                  Differenz: {generatedTeams.difference}
                </div>
              </div>
            </div>
          )}

          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>📊 Quick Stats</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ ...styles.card, marginBottom: 0, padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: GRUEN }}>
                  {playerStats.length}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Spieler</div>
              </div>
              <div style={{ ...styles.card, marginBottom: 0, padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: GRUEN }}>
                  {games.length}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Spiele</div>
              </div>
            </div>
          </div>

          {games.length > 0 && (
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>📅 Letzte Spiele</h2>
              {games.slice(0, 3).map((game) => {
                const date = new Date(game.date);
                const dateStr = date.toLocaleDateString('de-DE');
                return (
                  <div key={game.id} style={{ ...styles.card, padding: '1rem', marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                      {dateStr}
                      {isAdminMode && (
                        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={() => startEditGame(game)}
                            style={{
                              ...styles.button,
                              ...styles.buttonSecondary,
                              padding: '0.25rem 0.75rem',
                              fontSize: '0.8rem',
                              marginBottom: 0,
                              width: 'auto',
                            }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => deleteGame(game.id, game.game_id)}
                            style={{
                              ...styles.button,
                              ...styles.buttonDanger,
                              padding: '0.25rem 0.75rem',
                              fontSize: '0.8rem',
                              marginBottom: 0,
                              width: 'auto',
                            }}
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: GELB, fontSize: '0.9rem' }}>{game.team1}</span>
                      <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: GRUEN }}>
                        {game.score1}:{game.score2}
                      </span>
                      <span style={{ color: BLAU, fontSize: '0.9rem' }}>{game.team2}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === 'stats') {
    return (
      <div style={styles.container}>
        <TopNav />
        <div style={styles.content}>
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>🏆 Anwesenheit & Form</h2>
            <div style={styles.card}>
              {playerStats.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${GRUEN}` }}>
                        <th style={{ textAlign: 'left', padding: '0.4rem', fontWeight: '600' }}>Spieler</th>
                        <th style={{ textAlign: 'center', padding: '0.4rem', fontWeight: '600' }}>Spiele</th>
                        <th style={{ textAlign: 'center', padding: '0.4rem', fontWeight: '600' }}>%</th>
                        <th style={{ textAlign: 'center', padding: '0.4rem', fontWeight: '600' }}>🔥</th>
                        <th style={{ textAlign: 'center', padding: '0.4rem', fontWeight: '600' }}>⭐</th>
                      </tr>
                    </thead>
                    <tbody>
                      {playerStats.map((stat, idx) => {
                        const extStats = calculatePlayerStats(stat.player_name);
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(16, 185, 129, 0.1)' }}>
                            <td style={{ textAlign: 'left', padding: '0.4rem' }}>{stat.player_name.substring(0, 10)}</td>
                            <td style={{ textAlign: 'center', padding: '0.4rem' }}>
                              {extStats.playedGames}/{extStats.playedGames + extStats.missedGames}
                            </td>
                            <td style={{ textAlign: 'center', padding: '0.4rem', color: GRUEN, fontWeight: '600' }}>
                              {extStats.attendance}
                            </td>
                            <td style={{ textAlign: 'center', padding: '0.4rem' }}>{extStats.currentStreak}</td>
                            <td style={{ textAlign: 'center', padding: '0.4rem' }}>{extStats.maxStreak}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ color: '#6b7280', textAlign: 'center', padding: '1rem' }}>
                  Keine Daten
                </div>
              )}
            </div>
          </div>

          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>⚽ Tore & Effizienz</h2>
            <div style={styles.card}>
              {playerStats.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${GRUEN}` }}>
                        <th style={{ textAlign: 'left', padding: '0.4rem', fontWeight: '600' }}>Spieler</th>
                        <th style={{ textAlign: 'center', padding: '0.4rem', fontWeight: '600' }}>Tore</th>
                        <th style={{ textAlign: 'center', padding: '0.4rem', fontWeight: '600' }}>Ø/Spiel</th>
                        <th style={{ textAlign: 'center', padding: '0.4rem', fontWeight: '600' }}>T:G</th>
                      </tr>
                    </thead>
                    <tbody>
                      {playerStats.map((stat, idx) => {
                        const goalsPerGame = getGoalsPerGame(stat.player_name);
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(16, 185, 129, 0.1)' }}>
                            <td style={{ textAlign: 'left', padding: '0.4rem' }}>{stat.player_name.substring(0, 10)}</td>
                            <td style={{ textAlign: 'center', padding: '0.4rem', color: GRUEN, fontWeight: '600' }}>
                              {stat.goals_for}
                            </td>
                            <td style={{ textAlign: 'center', padding: '0.4rem' }}>{goalsPerGame}</td>
                            <td style={{ textAlign: 'center', padding: '0.4rem' }}>
                              {stat.goals_for}:{stat.goals_against}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ color: '#6b7280', textAlign: 'center', padding: '1rem' }}>
                  Keine Daten
                </div>
              )}
            </div>
          </div>

          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>🏅 Punkte & Erfolg</h2>
            <div style={styles.card}>
              {playerStats.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${GRUEN}` }}>
                        <th style={{ textAlign: 'left', padding: '0.4rem', fontWeight: '600' }}>Spieler</th>
                        <th style={{ textAlign: 'center', padding: '0.4rem', fontWeight: '600' }}>Pkte</th>
                        <th style={{ textAlign: 'center', padding: '0.4rem', fontWeight: '600' }}>Ø</th>
                        <th style={{ textAlign: 'center', padding: '0.4rem', fontWeight: '600' }}>W%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {playerStats.map((stat, idx) => {
                        const avgPoints = stat.games_played > 0
                          ? (stat.points / stat.games_played).toFixed(2)
                          : '0.00';
                        const winPercentage = stat.games_played > 0
                          ? ((stat.wins / stat.games_played) * 100).toFixed(0)
                          : '0';
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(16, 185, 129, 0.1)' }}>
                            <td style={{ textAlign: 'left', padding: '0.4rem' }}>
                              {stat.player_name.substring(0, 10)}
                              {admins.some((a) => a.player_name === stat.player_name) && '👑'}
                            </td>
                            <td style={{ textAlign: 'center', padding: '0.4rem', color: GRUEN, fontWeight: '600' }}>
                              {stat.points}
                            </td>
                            <td style={{ textAlign: 'center', padding: '0.4rem' }}>{avgPoints}</td>
                            <td style={{ textAlign: 'center', padding: '0.4rem' }}>{winPercentage}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ color: '#6b7280', textAlign: 'center', padding: '1rem' }}>
                  Keine Daten
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'scorers') {
    return (
      <div style={styles.container}>
        <TopNav />
        <div style={styles.content}>
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>🔥 Top Torschützen</h2>
            <div style={styles.card}>
              {topScorers.length > 0 ? (
                topScorers.map((scorer, idx) => (
                  <div key={idx} style={styles.statRow}>
                    <div>
                      <span style={{ marginRight: '0.75rem' }}>
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`}
                      </span>
                      {scorer.player_name}
                    </div>
                    <span style={styles.statValue}>{scorer.total_goals} ⚽</span>
                  </div>
                ))
              ) : (
                <div style={{ color: '#6b7280', textAlign: 'center', padding: '1rem' }}>
                  Keine Tore erfasst
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'statspro') {
    return (
      <div style={styles.container}>
        <TopNav />
        <div style={styles.content}>
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>👥 Team-Bilanz</h2>
            <div style={styles.card}>
              {teamBilanz.length > 0 ? (
                teamBilanz.map((pairing, idx) => {
                  const totalGames = pairing.games;
                  const team1WinRate = totalGames > 0
                    ? ((pairing.team1Wins / totalGames) * 100).toFixed(0)
                    : '0';
                  const team2WinRate = totalGames > 0
                    ? ((pairing.team2Wins / totalGames) * 100).toFixed(0)
                    : '0';
                  return (
                    <div
                      key={idx}
                      style={{
                        ...styles.card,
                        marginBottom: '1rem',
                        padding: '1rem',
                        backgroundColor: 'rgba(16, 185, 129, 0.05)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <div style={{ textAlign: 'center', flex: 1 }}>
                          <div style={{ fontSize: '1rem', fontWeight: '600', color: GELB }}>{pairing.team1}</div>
                          <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                            {pairing.team1Wins}W ({team1WinRate}%)
                          </div>
                        </div>
                        <div style={{
                          textAlign: 'center',
                          padding: '0 0.75rem',
                          borderLeft: `1px solid rgba(16, 185, 129, 0.2)`,
                          borderRight: `1px solid rgba(16, 185, 129, 0.2)`,
                        }}>
                          <div style={{ fontSize: '1rem', fontWeight: 'bold', color: GRUEN }}>{pairing.games}x</div>
                          <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>Spiele</div>
                        </div>
                        <div style={{ textAlign: 'center', flex: 1 }}>
                          <div style={{ fontSize: '1rem', fontWeight: '600', color: BLAU }}>{pairing.team2}</div>
                          <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                            {pairing.team2Wins}W ({team2WinRate}%)
                          </div>
                        </div>
                      </div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-around',
                        alignItems: 'center',
                        fontSize: '0.8rem',
                        color: '#9ca3af',
                        paddingTop: '0.75rem',
                        borderTop: `1px solid rgba(16, 185, 129, 0.1)`,
                      }}>
                        <div>T: {pairing.team1Goals}</div>
                        <div>U: {pairing.draws}</div>
                        <div>T: {pairing.team2Goals}</div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ color: '#6b7280', textAlign: 'center', padding: '1rem' }}>
                  Keine Daten vorhanden
                </div>
              )}
            </div>
          </div>

          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>🎯 Position-Analyse</h2>
            <div style={styles.card}>
              <div style={{ fontSize: '0.9rem', color: '#9ca3af', textAlign: 'center', padding: '1rem' }}>
                📍 Positionen für Team-Analyse
              </div>
              <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '1rem', borderRadius: '8px', fontSize: '0.85rem' }}>
                <div style={{ marginBottom: '0.5rem' }}>🏃 Sturm: {players.length} Spieler</div>
                <div style={{ marginBottom: '0.5rem' }}>🎯 Mittelfeld: {players.length} Spieler</div>
                <div>🛡️ Abwehr: {players.length} Spieler</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'players') {
    return (
      <div style={styles.container}>
        <TopNav />
        <div style={styles.content}>
          <form onSubmit={handleAddPlayer} style={{ marginBottom: '1.5rem' }}>
            <div style={styles.section}>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color: GRUEN }}>
                Neuen Spieler hinzufügen
              </label>
              <input
                type="text"
                placeholder="Spieler-Name"
                value={newPlayer}
                onChange={(e) => setNewPlayer(e.target.value)}
                style={styles.input}
              />
              <button type="submit" style={{ ...styles.button, ...styles.buttonPrimary }}>
                ➕ Hinzufügen
              </button>
            </div>
          </form>

          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>📋 Alle Spieler ({players.length})</h2>
            <div style={styles.card}>
              {players.map((player) => {
                const pos = getPlayerPositions(player.name);
                const isEditing = editingPositions[player.id];

                return (
                  <div
                    key={player.id}
                    style={{ padding: '1rem', borderBottom: '1px solid rgba(16, 185, 129, 0.1)', fontSize: '0.9rem' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <span style={{ fontWeight: '600' }}>
                        {player.name}
                        {admins.some((a) => a.player_name === player.name) && '👑'}
                      </span>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => { setRenamingPlayer(player.id); setNewPlayerName(player.name); }}
                          style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '1rem' }}
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => deletePlayer(player.name)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem' }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {renamingPlayer === player.id && (
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <input
                          type="text"
                          value={newPlayerName}
                          onChange={(e) => setNewPlayerName(e.target.value)}
                          style={{ ...styles.input, marginBottom: 0, flex: 1 }}
                          autoFocus
                        />
                        <button
                          onClick={() => handleRenamePlayer(player.name)}
                          style={{ ...styles.button, ...styles.buttonPrimary, width: 'auto', padding: '0.75rem', marginBottom: 0 }}
                        >
                          ✅
                        </button>
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <div>
                        <label style={{ fontSize: '0.7rem', color: '#9ca3af', display: 'block', marginBottom: '0.25rem' }}>
                          🏃 Sturm
                        </label>
                        {isEditing ? (
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={editingPositions[player.id]?.sturm || pos.sturm}
                            onChange={(e) => {
                              setEditingPositions({
                                ...editingPositions,
                                [player.id]: { ...(editingPositions[player.id] || {}), sturm: parseInt(e.target.value) },
                              });
                            }}
                            style={{ ...styles.input, marginBottom: 0, fontSize: '0.85rem', padding: '0.5rem' }}
                          />
                        ) : (
                          <div style={{ padding: '0.4rem', backgroundColor: 'rgba(251, 191, 36, 0.2)', borderRadius: '6px', fontSize: '0.85rem', textAlign: 'center', fontWeight: '600' }}>
                            {pos.sturm}
                          </div>
                        )}
                      </div>

                      <div>
                        <label style={{ fontSize: '0.7rem', color: '#9ca3af', display: 'block', marginBottom: '0.25rem' }}>
                          🎯 MF
                        </label>
                        {isEditing ? (
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={editingPositions[player.id]?.mittelfeld || pos.mittelfeld}
                            onChange={(e) => {
                              setEditingPositions({
                                ...editingPositions,
                                [player.id]: { ...(editingPositions[player.id] || {}), mittelfeld: parseInt(e.target.value) },
                              });
                            }}
                            style={{ ...styles.input, marginBottom: 0, fontSize: '0.85rem', padding: '0.5rem' }}
                          />
                        ) : (
                          <div style={{ padding: '0.4rem', backgroundColor: 'rgba(59, 130, 246, 0.2)', borderRadius: '6px', fontSize: '0.85rem', textAlign: 'center', fontWeight: '600' }}>
                            {pos.mittelfeld}
                          </div>
                        )}
                      </div>

                      <div>
                        <label style={{ fontSize: '0.7rem', color: '#9ca3af', display: 'block', marginBottom: '0.25rem' }}>
                          🛡️ AW
                        </label>
                        {isEditing ? (
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={editingPositions[player.id]?.abwehr || pos.abwehr}
                            onChange={(e) => {
                              setEditingPositions({
                                ...editingPositions,
                                [player.id]: { ...(editingPositions[player.id] || {}), abwehr: parseInt(e.target.value) },
                              });
                            }}
                            style={{ ...styles.input, marginBottom: 0, fontSize: '0.85rem', padding: '0.5rem' }}
                          />
                        ) : (
                          <div style={{ padding: '0.4rem', backgroundColor: 'rgba(16, 185, 129, 0.2)', borderRadius: '6px', fontSize: '0.85rem', textAlign: 'center', fontWeight: '600' }}>
                            {pos.abwehr}
                          </div>
                        )}
                      </div>
                    </div>

                    {isEditing ? (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => {
                            savePlayerPosition(
                              player.name,
                              editingPositions[player.id].sturm,
                              editingPositions[player.id].mittelfeld,
                              editingPositions[player.id].abwehr
                            );
                            setEditingPositions({ ...editingPositions, [player.id]: false });
                          }}
                          style={{ ...styles.button, ...styles.buttonPrimary, marginBottom: 0, flex: 1, padding: '0.5rem', fontSize: '0.85rem' }}
                        >
                          ✅ Speichern
                        </button>
                        <button
                          onClick={() => setEditingPositions({ ...editingPositions, [player.id]: false })}
                          style={{ ...styles.button, ...styles.buttonSecondary, marginBottom: 0, flex: 1, padding: '0.5rem', fontSize: '0.85rem' }}
                        >
                          ✕ Abbrechen
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingPositions({
                            ...editingPositions,
                            [player.id]: { sturm: pos.sturm, mittelfeld: pos.mittelfeld, abwehr: pos.abwehr },
                          });
                        }}
                        style={{ ...styles.button, ...styles.buttonSecondary, marginBottom: 0, padding: '0.5rem', fontSize: '0.85rem' }}
                      >
                        ✏️ Bearbeiten
                      </button>
                    )}
                  </div>
                );
              })}

              {players.length === 0 && (
                <div style={{ color: '#6b7280', textAlign: 'center', padding: '1rem' }}>
                  Keine Spieler vorhanden
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'newgame') {
    return (
      <div style={styles.container}>
        <TopNav />
        <div style={styles.content}>
          <form onSubmit={handleNewGame} style={{ marginBottom: '1rem' }}>

            <div style={styles.section}>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color: GRUEN }}>
                📅 Datum
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                style={styles.input}
                required
              />
            </div>

            <div style={styles.section}>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color: GELB }}>
                👥 GELB ({formData.players1.length})
              </label>
              <div style={{ ...styles.card, padding: '0.75rem' }}>
                {players.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      ...styles.checkbox,
                      ...(formData.players1.includes(p.name) ? styles.checkboxChecked : {}),
                    }}
                    onClick={() => togglePlayer(p.name, 1)}
                  >
                    <input
                      type="checkbox"
                      checked={formData.players1.includes(p.name)}
                      onChange={() => {}}
                      style={{ marginRight: '0.75rem', width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span>{p.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color: GELB }}>
                  Tore
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.score1}
                  onChange={(e) => setFormData({ ...formData, score1: e.target.value })}
                  style={styles.input}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color: BLAU }}>
                  Tore
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.score2}
                  onChange={(e) => setFormData({ ...formData, score2: e.target.value })}
                  style={styles.input}
                />
              </div>
            </div>

            <div style={styles.section}>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color: BLAU }}>
                👥 BLAU ({formData.players2.length})
              </label>
              <div style={{ ...styles.card, padding: '0.75rem' }}>
                {players.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      ...styles.checkbox,
                      ...(formData.players2.includes(p.name) ? styles.checkboxChecked : {}),
                    }}
                    onClick={() => togglePlayer(p.name, 2)}
                  >
                    <input
                      type="checkbox"
                      checked={formData.players2.includes(p.name)}
                      onChange={() => {}}
                      style={{ marginRight: '0.75rem', width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span>{p.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={styles.section}>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color: GRUEN }}>
                ⚽ Torschützen ({formData.goals.length})
              </label>

              {formData.players1.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.85rem', color: GELB, marginBottom: '0.5rem', fontWeight: '600' }}>
                    GELB:
                  </div>
                  <div style={{ ...styles.card, padding: '0.75rem' }}>
                    {formData.players1.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => addGoal(p, 'Gelb')}
                        style={{ ...styles.button, ...styles.buttonSecondary, marginBottom: '0.5rem', fontSize: '0.9rem', padding: '0.5rem' }}
                      >
                        ➕ {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {formData.players2.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.85rem', color: BLAU, marginBottom: '0.5rem', fontWeight: '600' }}>
                    BLAU:
                  </div>
                  <div style={{ ...styles.card, padding: '0.75rem' }}>
                    {formData.players2.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => addGoal(p, 'Blau')}
                        style={{ ...styles.button, ...styles.buttonSecondary, marginBottom: '0.5rem', fontSize: '0.9rem', padding: '0.5rem' }}
                      >
                        ➕ {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {formData.goals.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ fontSize: '0.85rem', color: GRUEN, marginBottom: '0.5rem', fontWeight: '600' }}>
                    Erfasste Tore:
                  </div>
                  {formData.goals.map((goal, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '0.5rem',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderRadius: '6px',
                        marginBottom: '0.5rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>{goal.player} ({goal.team})</span>
                      <button
                        type="button"
                        onClick={() => removeGoal(idx)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button type="submit" style={{ ...styles.button, ...styles.buttonPrimary }}>
              ✅ {editingGame ? 'Aktualisieren' : 'Speichern'}
            </button>
            <button
              type="button"
              style={{ ...styles.button, ...styles.buttonSecondary }}
              onClick={() => { setView('home'); setEditingGame(null); }}
            >
              Abbrechen
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1>Loading...</h1>
    </div>
  );
}
