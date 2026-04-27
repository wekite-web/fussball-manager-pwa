/**
 * FUSSBALL-MANAGER PWA v14.1 - PERFORMANCE OPTIMIERT
 *
 * Fixes gegenüber v14.1 original:
 * 1. useEffect aufgeteilt: Initial-Load nur 1x, games-abhängig nur was nötig
 * 2. calculatePlayerStats() aus Render entfernt → eigener State mit einmaligem Load
 * 3. calculateTeamBilanz() als reiner State-Berechnung ohne Supabase
 * 4. game_players werden einmalig geladen (kein Query pro Render)
 * 5. useMemo für teure Berechnungen (TeamBilanz, Streak)
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { parseCSV, validateCSV, importGames, exportGamesCSV, exportStatsCSV } from './csvUtils';

const SUPABASE_URL = 'https://sdtgwkvmqprbwvtkswxd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_iCVXxm3VuPQIHEvWkkqqPw_1jCVn0QO';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const ADMIN_PASSWORD = '1qay2wsx!Admin';
const GELB = '#fbbf24';
const BLAU = '#3b82f6';
const GRUEN = '#10b981';

export default function FussballManagerPWA() {
  const [view, setView] = useState('home');
  const [games, setGames] = useState([]);
  const [players, setPlayers] = useState([]);
  const [playerStats, setPlayerStats] = useState([]);
  const [playerPositions, setPlayerPositions] = useState([]);
  const [topScorers, setTopScorers] = useState([]);
  const [admins, setAdmins] = useState([]);
  // NEU: game_players als State → kein Query pro Render
  const [gamePlayers, setGamePlayers] = useState([]);
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
  const [csvState, setCsvState] = useState({
  status: 'idle', valid: [], warnings: [], errors: [], progress: 0, total: 0
});

  // ─── INITIAL LOAD: nur 1x beim Mount ───────────────────────────────────────
  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    await Promise.all([
      loadAdmins(),
      loadPlayers(),
      loadGames(),
      loadPlayerStats(),
      loadPlayerPositions(),
      loadTopScorers(),
      loadGamePlayers(),
    ]);
  };

  // ─── DATEN LADEN ───────────────────────────────────────────────────────────
  const loadAdmins = async () => {
    const { data } = await supabase.from('admins').select('*');
    setAdmins(data || []);
  };

  const loadPlayerPositions = async () => {
    const { data } = await supabase.from('player_positions').select('*');
    setPlayerPositions(data || []);
  };

  const loadPlayers = async () => {
    const { data } = await supabase.from('players').select('*').order('name');
    setPlayers(data || []);
  };

  const loadGames = async () => {
    const { data } = await supabase.from('games').select('*').order('date', { ascending: false });
    setGames(data || []);
  };

  const loadPlayerStats = async () => {
    const { data } = await supabase.from('player_stats').select('*').order('points', { ascending: false });
    setPlayerStats(data || []);
  };

  const loadTopScorers = async () => {
    const { data } = await supabase.from('top_scorers').select('*').order('total_goals', { ascending: false });
    setTopScorers(data || []);
  };

  // NEU: game_players einmalig laden statt pro Render abfragen
  const loadGamePlayers = async () => {
    const { data } = await supabase.from('game_players').select('*');
    setGamePlayers(data || []);
  };

  // ─── TEAM-BILANZ: useMemo statt useEffect → nur neu berechnen wenn games sich ändert
  const teamBilanz = useMemo(() => {
    const pairingMap = {};
    games.forEach((game) => {
      const { team1, team2, score1, score2 } = game;
      const key = [team1, team2].sort().join(' vs ');
      if (!pairingMap[key]) {
        pairingMap[key] = { team1, team2, games: 0, team1Wins: 0, team2Wins: 0, draws: 0, team1Goals: 0, team2Goals: 0 };
      }
      pairingMap[key].games += 1;
      pairingMap[key].team1Goals += score1;
      pairingMap[key].team2Goals += score2;
      if (score1 > score2) pairingMap[key].team1Wins += 1;
      else if (score2 > score1) pairingMap[key].team2Wins += 1;
      else pairingMap[key].draws += 1;
    });
    return Object.values(pairingMap).sort((a, b) => b.games - a.games);
  }, [games]);

  // ─── PLAYER STATS: useMemo statt per-render Berechnung ─────────────────────
  // Berechnet für alle Spieler auf einmal, nicht in jedem Render pro Spieler
  const extendedStats = useMemo(() => {
    const totalGames = games.length;
    const result = {};

    playerStats.forEach((stat) => {
      const playerName = stat.player_name;
      // Spiele dieses Spielers aus dem State (kein Supabase-Query!)
      const playerGameIds = new Set(
        gamePlayers
          .filter((gp) => gp.player_name === playerName)
          .map((gp) => gp.game_id)
      );

      const playedGames = playerGameIds.size;
      const missedGames = totalGames - playedGames;
      const attendance = totalGames > 0 ? ((playedGames / totalGames) * 100).toFixed(1) : '0.0';

      // Aktueller Streak (letzte 5 Spiele)
      let currentStreak = 0;
      for (const g of games.slice(0, 5)) {
        if (playerGameIds.has(g.game_id)) currentStreak += 1;
        else break;
      }

      // Max Streak
      let maxStreak = 0;
      let streak = 0;
      for (const g of [...games].reverse()) {
        if (playerGameIds.has(g.game_id)) {
          streak += 1;
          maxStreak = Math.max(maxStreak, streak);
        } else {
          streak = 0;
        }
      }

      result[playerName] = { playedGames, missedGames, attendance, currentStreak, maxStreak };
    });

    return result;
  }, [games, playerStats, gamePlayers]);

  // ─── HILFSFUNKTIONEN ───────────────────────────────────────────────────────
  const getPlayerPositions = useCallback(
    (playerName) => {
      const pos = playerPositions.find((p) => p.player_name === playerName);
      return pos
        ? { sturm: pos.position_sturm || 5, mittelfeld: pos.position_mittelfeld || 5, abwehr: pos.position_abwehr || 5 }
        : { sturm: 5, mittelfeld: 5, abwehr: 5 };
    },
    [playerPositions]
  );

  const getGoalsPerGame = useCallback(
    (playerName) => {
      const stat = playerStats.find((s) => s.player_name === playerName);
      if (!stat || stat.games_played === 0) return '0.00';
      return (stat.goals_for / stat.games_played).toFixed(2);
    },
    [playerStats]
  );

  const savePlayerPosition = async (playerName, sturm, mittelfeld, abwehr) => {
    try {
      const { data: existing } = await supabase.from('player_positions').select('*').eq('player_name', playerName);
      if (existing && existing.length > 0) {
        await supabase.from('player_positions').update({ position_sturm: sturm, position_mittelfeld: mittelfeld, position_abwehr: abwehr, updated_at: new Date().toISOString() }).eq('player_name', playerName);
      } else {
        await supabase.from('player_positions').insert([{ player_name: playerName, position_sturm: sturm, position_mittelfeld: mittelfeld, position_abwehr: abwehr }]);
      }
      await loadPlayerPositions();
      showNotification(`✅ ${playerName} Positionen aktualisiert`);
    } catch (err) {
      console.error('Fehler:', err);
      alert('Fehler beim Speichern');
    }
  };

  const generateBalancedTeams = () => {
    if (players.length < 2) { alert('Mindestens 2 Spieler erforderlich!'); return; }
    const playerScores = players.map((p) => {
      const pos = getPlayerPositions(p.name);
      return { name: p.name, score: (pos.sturm + pos.mittelfeld + pos.abwehr) / 3 };
    });
    playerScores.sort((a, b) => b.score - a.score);
    const team1 = [], team2 = [];
    playerScores.forEach((p, idx) => (idx % 2 === 0 ? team1 : team2).push(p));
    const avg = (arr) => (arr.reduce((s, p) => s + p.score, 0) / arr.length).toFixed(2);
    setGeneratedTeams({ team1: { players: team1, avg: avg(team1) }, team2: { players: team2, avg: avg(team2) }, difference: Math.abs(avg(team1) - avg(team2)).toFixed(2) });
    showNotification('✅ Teams generiert!');
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
    if (!isAdminMode) { alert('Nur Admins!'); return; }
    if (!newPlayer.trim()) return;
    try {
      await supabase.from('players').insert([{ name: newPlayer }]);
      await supabase.from('player_stats').insert([{ player_name: newPlayer }]);
      await supabase.from('player_positions').insert([{ player_name: newPlayer, position_sturm: 5, position_mittelfeld: 5, position_abwehr: 5 }]);
      setNewPlayer('');
      await Promise.all([loadPlayers(), loadPlayerPositions()]);
      showNotification(`✅ ${newPlayer} hinzugefügt`);
    } catch (err) {
      console.error('Fehler:', err);
      alert('Spieler existiert bereits oder Fehler');
    }
  };

  const handleRenamePlayer = async (oldName) => {
    if (!isAdminMode) { alert('Nur Admins!'); return; }
    if (!newPlayerName.trim() || newPlayerName === oldName) { setRenamingPlayer(null); setNewPlayerName(''); return; }
    try {
      await Promise.all([
        supabase.from('players').update({ name: newPlayerName }).eq('name', oldName),
        supabase.from('player_stats').update({ player_name: newPlayerName }).eq('player_name', oldName),
        supabase.from('player_positions').update({ player_name: newPlayerName }).eq('player_name', oldName),
        supabase.from('top_scorers').update({ player_name: newPlayerName }).eq('player_name', oldName),
        supabase.from('game_players').update({ player_name: newPlayerName }).eq('player_name', oldName),
        supabase.from('goals').update({ player_name: newPlayerName }).eq('player_name', oldName),
        supabase.from('team_points').update({ player_name: newPlayerName }).eq('player_name', oldName),
      ]);
      setRenamingPlayer(null);
      setNewPlayerName('');
      await Promise.all([loadPlayers(), loadPlayerStats(), loadPlayerPositions(), loadTopScorers(), loadGamePlayers()]);
      showNotification(`✅ ${oldName} → ${newPlayerName}`);
    } catch (err) {
      console.error('Fehler:', err);
      alert('Fehler beim Umbenennen');
    }
  };

  const deletePlayer = async (playerName) => {
    if (!isAdminMode) { alert('Nur Admins!'); return; }
    if (!confirm(`${playerName} wirklich löschen?`)) return;
    try {
      await Promise.all([
        supabase.from('players').delete().eq('name', playerName),
        supabase.from('player_stats').delete().eq('player_name', playerName),
        supabase.from('player_positions').delete().eq('player_name', playerName),
      ]);
      await Promise.all([loadPlayers(), loadPlayerStats(), loadPlayerPositions()]);
      showNotification(`✅ ${playerName} gelöscht`);
    } catch (err) {
      console.error('Fehler:', err);
      alert('Fehler beim Löschen');
    }
  };

  const deleteGame = async (gameId, gameIdStr) => {
    if (!isAdminMode) { alert('Nur Admins!'); return; }
    if (!confirm('Spiel wirklich löschen?')) return;
    try {
      // FIX: team_points VOR games löschen → verhindert 409 Conflict!
      await supabase.from('team_points').delete().eq('game_id', gameIdStr);
      await supabase.from('goals').delete().eq('game_id', gameIdStr);
      await supabase.from('game_players').delete().eq('game_id', gameIdStr);
      await supabase.from('game_results').delete().eq('game_id', gameIdStr);
      await supabase.from('games').delete().eq('id', gameId);
      await Promise.all([loadGames(), loadGamePlayers()]);
      showNotification('✅ Spiel gelöscht');
    } catch (err) {
      console.error('Fehler:', err);
      alert('Fehler beim Löschen');
    }
  };

  const togglePlayer = (playerName, team) => {
    if (team === 1) {
      setFormData((fd) => ({ ...fd, players1: fd.players1.includes(playerName) ? fd.players1.filter((p) => p !== playerName) : [...fd.players1, playerName] }));
    } else {
      setFormData((fd) => ({ ...fd, players2: fd.players2.includes(playerName) ? fd.players2.filter((p) => p !== playerName) : [...fd.players2, playerName] }));
    }
  };

  const addGoal = (playerName, team) => {
    setFormData((fd) => ({ ...fd, goals: [...fd.goals, { player: playerName, team }] }));
  };

  const removeGoal = (index) => {
    setFormData((fd) => ({ ...fd, goals: fd.goals.filter((_, i) => i !== index) }));
  };

  const rollbackGamePoints = async (gameId) => {
    const { data: pointsData } = await supabase.from('team_points').select('*').eq('game_id', gameId);
    if (!pointsData || pointsData.length === 0) return;
    for (const point of pointsData) {
      const { data: playerData } = await supabase.from('player_stats').select('*').eq('player_name', point.player_name);
      if (playerData && playerData.length > 0) {
        const stats = playerData[0];
        await supabase.from('player_stats').update({
          games_played: Math.max(0, stats.games_played - 1),
          wins: point.points_earned === 3 ? Math.max(0, stats.wins - 1) : stats.wins,
          draws: point.points_earned === 1 ? Math.max(0, stats.draws - 1) : stats.draws,
          losses: point.points_earned === 0 ? Math.max(0, stats.losses - 1) : stats.losses,
          points: Math.max(0, stats.points - point.points_earned),
          updated_at: new Date().toISOString(),
        }).eq('player_name', point.player_name);
      }
    }
    await supabase.from('team_points').delete().eq('game_id', gameId);
  };

  const handleNewGame = async (e) => {
    e.preventDefault();
    if (!isAdminMode) { alert('Nur Admins!'); return; }
    try {
      const gameId = editingGame?.game_id || `game_${Date.now()}`;
      const score1 = parseInt(formData.score1);
      const score2 = parseInt(formData.score2);
      let winner = score1 > score2 ? 'team1' : score2 > score1 ? 'team2' : 'draw';

      if (editingGame) {
        await rollbackGamePoints(gameId);
        await supabase.from('games').update({ date: formData.date, score1, score2 }).eq('id', editingGame.id);
        await supabase.from('game_results').update({ score1, score2, winner }).eq('game_id', gameId);
      } else {
        await supabase.from('games').insert([{ game_id: gameId, date: formData.date, team1: formData.team1, team2: formData.team2, score1, score2 }]);
        await supabase.from('game_results').insert([{ game_id: gameId, team1: formData.team1, team2: formData.team2, score1, score2, winner }]);

        const gpInsert = [
          ...formData.players1.map((p) => ({ game_id: gameId, player_name: p, team: formData.team1 })),
          ...formData.players2.map((p) => ({ game_id: gameId, player_name: p, team: formData.team2 })),
        ];
        if (gpInsert.length > 0) await supabase.from('game_players').insert(gpInsert);

        if (formData.goals.length > 0) {
          await supabase.from('goals').insert(formData.goals.map((g) => ({ game_id: gameId, player_name: g.player, team: g.team })));
          for (const goal of formData.goals) {
            const { data: existing } = await supabase.from('top_scorers').select('*').eq('player_name', goal.player);
            if (existing && existing.length > 0) {
              await supabase.from('top_scorers').update({ total_goals: existing[0].total_goals + 1 }).eq('player_name', goal.player);
            } else {
              await supabase.from('top_scorers').insert([{ player_name: goal.player, total_goals: 1 }]);
            }
          }
        }
      }

      // Punkte vergeben
      const processTeam = async (teamPlayers, teamName, isWinner) => {
        const pointsEarned = winner === 'draw' ? 1 : isWinner ? 3 : 0;
        const isGelb = teamName === formData.team1;
        const goalsFor = isGelb ? score1 : score2;
        const goalsAgainst = isGelb ? score2 : score1;

        for (const playerName of teamPlayers) {
          const { data: existing } = await supabase.from('player_stats').select('*').eq('player_name', playerName);
          if (existing && existing.length > 0) {
            const stats = existing[0];
            await supabase.from('player_stats').update({
              games_played: stats.games_played + 1,
              wins: stats.wins + (pointsEarned === 3 ? 1 : 0),
              draws: stats.draws + (pointsEarned === 1 ? 1 : 0),
              losses: stats.losses + (pointsEarned === 0 ? 1 : 0),
              goals_for: stats.goals_for + goalsFor,
              goals_against: stats.goals_against + goalsAgainst,
              points: stats.points + pointsEarned,
              updated_at: new Date().toISOString(),
            }).eq('player_name', playerName);
          }
          await supabase.from('team_points').insert([{ game_id: gameId, player_name: playerName, team: teamName, points_earned: pointsEarned }]);
        }
      };

      await processTeam(formData.players1, formData.team1, winner === 'team1');
      await processTeam(formData.players2, formData.team2, winner === 'team2');

      await Promise.all([loadGames(), loadPlayerStats(), loadTopScorers(), loadGamePlayers()]);

      setFormData({ date: new Date().toISOString().split('T')[0], team1: 'Gelb', team2: 'Blau', score1: 0, score2: 0, players1: [], players2: [], goals: [] });
      setEditingGame(null);
      setView('home');
      showNotification(editingGame ? '✅ Spiel aktualisiert' : `✅ ${formData.team1} ${score1}:${score2} ${formData.team2}`);
    } catch (err) {
      console.error('Fehler:', err);
      alert('Fehler beim Speichern');
    }
  };

  const startEditGame = (game) => {
    if (!isAdminMode) { alert('Nur Admins!'); return; }
    setEditingGame(game);
    setFormData({ date: game.date.split('T')[0], team1: game.team1, team2: game.team2, score1: game.score1, score2: game.score2, players1: [], players2: [], goals: [] });
    setView('newgame');
  };

  const showNotification = (message) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Fußball-Manager', { body: message });
    }
  };
const handleCSVFile = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const text = await file.text();
  const { rows, errors: parseErrors } = parseCSV(text);

  if (parseErrors.length > 0) {
    setCsvState({ status: 'error', valid: [], warnings: [], errors: parseErrors, progress: 0, total: 0 });
    return;
  }

  // Bestehende Spieldaten für Duplikat-Check
  const existingDates = games.map((g) => g.date.split('T')[0]);
  const knownPlayers = players.map((p) => p.name);

  const { valid, warnings, errors } = validateCSV(rows, knownPlayers, existingDates);

  setCsvState({
    status: errors.length > 0 ? 'error' : 'preview',
    valid,
    warnings,
    errors,
    progress: 0,
    total: valid.length,
  });

  // File-Input zurücksetzen damit man dieselbe Datei nochmal laden kann
  e.target.value = '';
};

const handleCSVImport = async () => {
  if (csvState.valid.length === 0) return;
  setCsvState((s) => ({ ...s, status: 'importing', progress: 0 }));

  const { imported, errors } = await importGames(
    csvState.valid,
    (current, total) => setCsvState((s) => ({ ...s, progress: current, total }))
  );

  await Promise.all([loadGames(), loadPlayerStats(), loadTopScorers(), loadGamePlayers()]);

  setCsvState((s) => ({
    ...s,
    status: errors.length > 0 ? 'done_with_errors' : 'done',
    errors: [...s.errors, ...errors],
    progress: imported,
  }));
};

const handleExportGames = async () => {
  try {
    await exportGamesCSV();
    showNotification('✅ Spiele exportiert');
  } catch (err) {
    alert(err.message);
  }
};

const handleExportStats = async () => {
  try {
    await exportStatsCSV();
    showNotification('✅ Statistiken exportiert');
  } catch (err) {
    alert(err.message);
  }
};

  // ─── STYLES ────────────────────────────────────────────────────────────────
  const styles = {
    container: {
      minHeight: '100vh',
      backgroundColor: '#0f172a',
      color: '#fff',
      fontFamily: '"Segoe UI", Tahoma, Geneva, sans-serif',
      paddingTop: '108px',
      paddingBottom: '20px',
      backgroundImage: 'linear-gradient(135deg, #0f172a 0%, #1a2332 100%)',
    },
    topNav: { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100 },
    header: {
      background: `linear-gradient(135deg, ${GRUEN} 0%, #059669 100%)`,
      padding: '0.6rem 1rem',
      boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '0.5rem',
    },
    headerTitle: { fontSize: '1.1rem', fontWeight: 'bold', color: '#fff', flex: 1, textAlign: 'center', letterSpacing: '0.02em' },
    backButton: { background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '0.45rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold', minWidth: '44px', textAlign: 'center' },
    adminButton: { background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '0.45rem 0.6rem', borderRadius: '6px', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold', minWidth: '44px', textAlign: 'center' },
    navBar: { background: 'rgba(15,23,42,0.97)', borderBottom: `2px solid rgba(16,185,129,0.25)`, display: 'flex' },
    navButton: { flex: 1, background: 'transparent', border: 'none', borderBottom: '2px solid transparent', color: '#6b7280', padding: '0.55rem 0.25rem', cursor: 'pointer', fontSize: '0.72rem', fontWeight: '600', textAlign: 'center', marginBottom: '-2px' },
    navButtonActive: { color: GRUEN, borderBottomColor: GRUEN },
    content: { maxWidth: '500px', margin: '0 auto', padding: '0 1rem' },
    section: { marginBottom: '1.5rem' },
    sectionTitle: { fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: `2px solid ${GRUEN}`, display: 'inline-block' },
    card: { backgroundColor: 'rgba(255,255,255,0.05)', border: `1px solid rgba(16,185,129,0.2)`, borderRadius: '12px', padding: '1.25rem', marginBottom: '1rem', backdropFilter: 'blur(10px)' },
    button: { padding: '0.75rem 1.5rem', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: '600', cursor: 'pointer', width: '100%', marginBottom: '0.75rem' },
    buttonPrimary: { background: `linear-gradient(135deg, ${GRUEN} 0%, #059669 100%)`, color: 'white' },
    buttonSecondary: { background: 'rgba(255,255,255,0.1)', color: '#fff', border: `1px solid rgba(16,185,129,0.3)` },
    buttonDanger: { background: '#ef4444', color: 'white' },
    input: { width: '100%', padding: '0.75rem', marginBottom: '1rem', backgroundColor: 'rgba(255,255,255,0.08)', border: `1px solid rgba(16,185,129,0.2)`, borderRadius: '8px', color: '#fff', fontSize: '1rem', boxSizing: 'border-box' },
    checkbox: { display: 'flex', alignItems: 'center', padding: '0.75rem', backgroundColor: 'rgba(255,255,255,0.05)', border: `1px solid rgba(16,185,129,0.2)`, borderRadius: '8px', marginBottom: '0.5rem', cursor: 'pointer' },
    checkboxChecked: { backgroundColor: GRUEN, borderColor: GRUEN },
    statRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', borderBottom: '1px solid rgba(16,185,129,0.1)', fontSize: '0.9rem' },
    statValue: { fontWeight: '600', color: GRUEN },
  };

  // ─── KOMPONENTEN ───────────────────────────────────────────────────────────
  const AdminLoginModal = () => (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
      <div style={{ ...styles.card, maxWidth: '300px' }}>
        <h3 style={{ textAlign: 'center', marginTop: 0 }}>🔐 Admin-Login</h3>
        <input type="password" placeholder="Passwort" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} style={styles.input} onKeyPress={(e) => { if (e.key === 'Enter') handleAdminLogin(adminPassword); }} />
        <button onClick={() => handleAdminLogin(adminPassword)} style={{ ...styles.button, ...styles.buttonPrimary, marginBottom: '0.5rem' }}>✅ Anmelden</button>
        <button onClick={() => setShowAdminLogin(false)} style={{ ...styles.button, ...styles.buttonSecondary }}>Abbrechen</button>
      </div>
    </div>
  );

  const TopNav = () => (
    <div style={styles.topNav}>
      <div style={styles.header}>
        {view !== 'home' ? (
          <button style={styles.backButton} onClick={() => { setView('home'); setEditingGame(null); }} title="Zurück">&lt;&lt;</button>
        ) : (
          <div style={{ minWidth: '44px' }} />
        )}
        <span style={styles.headerTitle}>⚽ Manager</span>
        <button style={styles.adminButton} onClick={() => { if (isAdminMode) { setIsAdminMode(false); } else { setShowAdminLogin(true); } }} title={isAdminMode ? 'Admin-Mode AUS' : 'Admin-Mode AN'}>
          {isAdminMode ? '🔐' : '🔓'}
        </button>
      </div>
      <div style={styles.navBar}>
        {[
          { key: 'home', label: '🏠 Home' },
          { key: 'stats', label: '📊 Tabelle' },
          { key: 'scorers', label: '⚽ Tore' },
          { key: 'statspro', label: '⭐ Pro' },
        ].map(({ key, label }) => (
          <button key={key} style={{ ...styles.navButton, ...(view === key ? styles.navButtonActive : {}) }} onClick={() => { setView(key); if (key === 'home') setEditingGame(null); }}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );

  // ─── VIEWS ─────────────────────────────────────────────────────────────────
  if (view === 'home') {
    return (
      <div style={styles.container}>
        {showAdminLogin && <AdminLoginModal />}
        <TopNav />
        <div style={styles.content}>
          {isAdminMode && (
  <div style={styles.section}>
    <button style={{ ...styles.button, ...styles.buttonPrimary }} onClick={() => setView('newgame')}>
      ➕ Neues Spiel
    </button>
    <button style={{ ...styles.button, ...styles.buttonSecondary }} onClick={() => setView('players')}>
      👥 Spieler verwalten
    </button>
    <button style={{ ...styles.button, ...styles.buttonSecondary }} onClick={() => setView('csv')}>
      📁 CSV Import/Export
    </button>
    <button style={{ ...styles.button, ...styles.buttonSecondary }} onClick={generateBalancedTeams}>
      🎯 Teams generieren
    </button>
  </div>
)}

          {generatedTeams && (
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>🎯 Generierte Teams</h2>
              <div style={styles.card}>
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ color: GELB, fontWeight: '600', marginBottom: '0.5rem' }}>Team 1 (Ø {generatedTeams.team1.avg})</div>
                  {generatedTeams.team1.players.map((p) => <div key={p.name} style={{ fontSize: '0.85rem', padding: '0.25rem' }}>{p.name}</div>)}
                </div>
                <div style={{ borderTop: `1px solid rgba(16,185,129,0.2)`, paddingTop: '1rem', marginBottom: '1rem' }}>
                  <div style={{ color: BLAU, fontWeight: '600', marginBottom: '0.5rem' }}>Team 2 (Ø {generatedTeams.team2.avg})</div>
                  {generatedTeams.team2.players.map((p) => <div key={p.name} style={{ fontSize: '0.85rem', padding: '0.25rem' }}>{p.name}</div>)}
                </div>
                <div style={{ textAlign: 'center', color: GRUEN, fontSize: '0.85rem', fontWeight: '600' }}>Differenz: {generatedTeams.difference}</div>
              </div>
            </div>
          )}

          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>📊 Quick Stats</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ ...styles.card, marginBottom: 0, padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: GRUEN }}>{playerStats.length}</div>
                <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Spieler</div>
              </div>
              <div style={{ ...styles.card, marginBottom: 0, padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: GRUEN }}>{games.length}</div>
                <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Spiele</div>
              </div>
            </div>
          </div>

          {games.length > 0 && (
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>📅 Letzte Spiele</h2>
              {games.slice(0, 3).map((game) => (
                <div key={game.id} style={{ ...styles.card, padding: '1rem', marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                    {new Date(game.date).toLocaleDateString('de-DE')}
                    {isAdminMode && (
                      <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => startEditGame(game)} style={{ ...styles.button, ...styles.buttonSecondary, padding: '0.25rem 0.75rem', fontSize: '0.8rem', marginBottom: 0, width: 'auto' }}>✏️ Edit</button>
                        <button onClick={() => deleteGame(game.id, game.game_id)} style={{ ...styles.button, ...styles.buttonDanger, padding: '0.25rem 0.75rem', fontSize: '0.8rem', marginBottom: 0, width: 'auto' }}>🗑️</button>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: GELB, fontSize: '0.9rem' }}>{game.team1}</span>
                    <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: GRUEN }}>{game.score1}:{game.score2}</span>
                    <span style={{ color: BLAU, fontSize: '0.9rem' }}>{game.team2}</span>
                  </div>
                </div>
              ))}
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
                        const ext = extendedStats[stat.player_name] || {};
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(16,185,129,0.1)' }}>
                            <td style={{ textAlign: 'left', padding: '0.4rem' }}>{stat.player_name.substring(0, 10)}</td>
                            <td style={{ textAlign: 'center', padding: '0.4rem' }}>{ext.playedGames}/{(ext.playedGames || 0) + (ext.missedGames || 0)}</td>
                            <td style={{ textAlign: 'center', padding: '0.4rem', color: GRUEN, fontWeight: '600' }}>{ext.attendance}</td>
                            <td style={{ textAlign: 'center', padding: '0.4rem' }}>{ext.currentStreak}</td>
                            <td style={{ textAlign: 'center', padding: '0.4rem' }}>{ext.maxStreak}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : <div style={{ color: '#6b7280', textAlign: 'center', padding: '1rem' }}>Keine Daten</div>}
            </div>
          </div>

          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>⚽ Tore & Effizienz</h2>
            <div style={styles.card}>
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
                    {playerStats.map((stat, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(16,185,129,0.1)' }}>
                        <td style={{ textAlign: 'left', padding: '0.4rem' }}>{stat.player_name.substring(0, 10)}</td>
                        <td style={{ textAlign: 'center', padding: '0.4rem', color: GRUEN, fontWeight: '600' }}>{stat.goals_for}</td>
                        <td style={{ textAlign: 'center', padding: '0.4rem' }}>{getGoalsPerGame(stat.player_name)}</td>
                        <td style={{ textAlign: 'center', padding: '0.4rem' }}>{stat.goals_for}:{stat.goals_against}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>🏅 Punkte & Erfolg</h2>
            <div style={styles.card}>
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
                    {playerStats.map((stat, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(16,185,129,0.1)' }}>
                        <td style={{ textAlign: 'left', padding: '0.4rem' }}>
                          {stat.player_name.substring(0, 10)}
                          {admins.some((a) => a.player_name === stat.player_name) && '👑'}
                        </td>
                        <td style={{ textAlign: 'center', padding: '0.4rem', color: GRUEN, fontWeight: '600' }}>{stat.points}</td>
                        <td style={{ textAlign: 'center', padding: '0.4rem' }}>{stat.games_played > 0 ? (stat.points / stat.games_played).toFixed(2) : '0.00'}</td>
                        <td style={{ textAlign: 'center', padding: '0.4rem' }}>{stat.games_played > 0 ? ((stat.wins / stat.games_played) * 100).toFixed(0) : '0'}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
              {topScorers.length > 0 ? topScorers.map((scorer, idx) => (
                <div key={idx} style={styles.statRow}>
                  <div><span style={{ marginRight: '0.75rem' }}>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`}</span>{scorer.player_name}</div>
                  <span style={styles.statValue}>{scorer.total_goals} ⚽</span>
                </div>
              )) : <div style={{ color: '#6b7280', textAlign: 'center', padding: '1rem' }}>Keine Tore erfasst</div>}
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
              {teamBilanz.length > 0 ? teamBilanz.map((pairing, idx) => {
                const t1WR = pairing.games > 0 ? ((pairing.team1Wins / pairing.games) * 100).toFixed(0) : '0';
                const t2WR = pairing.games > 0 ? ((pairing.team2Wins / pairing.games) * 100).toFixed(0) : '0';
                return (
                  <div key={idx} style={{ ...styles.card, marginBottom: '1rem', padding: '1rem', backgroundColor: 'rgba(16,185,129,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <div style={{ textAlign: 'center', flex: 1 }}>
                        <div style={{ fontSize: '1rem', fontWeight: '600', color: GELB }}>{pairing.team1}</div>
                        <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.25rem' }}>{pairing.team1Wins}W ({t1WR}%)</div>
                      </div>
                      <div style={{ textAlign: 'center', padding: '0 0.75rem', borderLeft: `1px solid rgba(16,185,129,0.2)`, borderRight: `1px solid rgba(16,185,129,0.2)` }}>
                        <div style={{ fontSize: '1rem', fontWeight: 'bold', color: GRUEN }}>{pairing.games}x</div>
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>Spiele</div>
                      </div>
                      <div style={{ textAlign: 'center', flex: 1 }}>
                        <div style={{ fontSize: '1rem', fontWeight: '600', color: BLAU }}>{pairing.team2}</div>
                        <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.25rem' }}>{pairing.team2Wins}W ({t2WR}%)</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '0.8rem', color: '#9ca3af', paddingTop: '0.75rem', borderTop: `1px solid rgba(16,185,129,0.1)` }}>
                      <div>T: {pairing.team1Goals}</div>
                      <div>U: {pairing.draws}</div>
                      <div>T: {pairing.team2Goals}</div>
                    </div>
                  </div>
                );
              }) : <div style={{ color: '#6b7280', textAlign: 'center', padding: '1rem' }}>Keine Daten vorhanden</div>}
            </div>
          </div>

          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>🎯 Position-Analyse</h2>
            <div style={styles.card}>
              <div style={{ backgroundColor: 'rgba(16,185,129,0.1)', padding: '1rem', borderRadius: '8px', fontSize: '0.85rem' }}>
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
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color: GRUEN }}>Neuen Spieler hinzufügen</label>
              <input type="text" placeholder="Spieler-Name" value={newPlayer} onChange={(e) => setNewPlayer(e.target.value)} style={styles.input} />
              <button type="submit" style={{ ...styles.button, ...styles.buttonPrimary }}>➕ Hinzufügen</button>
            </div>
          </form>

          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>📋 Alle Spieler ({players.length})</h2>
            <div style={styles.card}>
              {players.map((player) => {
                const pos = getPlayerPositions(player.name);
                const isEditing = editingPositions[player.id];
                return (
                  <div key={player.id} style={{ padding: '1rem', borderBottom: '1px solid rgba(16,185,129,0.1)', fontSize: '0.9rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <span style={{ fontWeight: '600' }}>{player.name}{admins.some((a) => a.player_name === player.name) && '👑'}</span>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => { setRenamingPlayer(player.id); setNewPlayerName(player.name); }} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '1rem' }}>✏️</button>
                        <button onClick={() => deletePlayer(player.name)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem' }}>🗑️</button>
                      </div>
                    </div>

                    {renamingPlayer === player.id && (
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <input type="text" value={newPlayerName} onChange={(e) => setNewPlayerName(e.target.value)} style={{ ...styles.input, marginBottom: 0, flex: 1 }} autoFocus />
                        <button onClick={() => handleRenamePlayer(player.name)} style={{ ...styles.button, ...styles.buttonPrimary, width: 'auto', padding: '0.75rem', marginBottom: 0 }}>✅</button>
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      {[
                        { key: 'sturm', label: '🏃 Sturm', color: 'rgba(251,191,36,0.2)' },
                        { key: 'mittelfeld', label: '🎯 MF', color: 'rgba(59,130,246,0.2)' },
                        { key: 'abwehr', label: '🛡️ AW', color: 'rgba(16,185,129,0.2)' },
                      ].map(({ key, label, color }) => (
                        <div key={key}>
                          <label style={{ fontSize: '0.7rem', color: '#9ca3af', display: 'block', marginBottom: '0.25rem' }}>{label}</label>
                          {isEditing ? (
                            <input type="number" min="1" max="10" value={editingPositions[player.id]?.[key] || pos[key]}
                              onChange={(e) => setEditingPositions({ ...editingPositions, [player.id]: { ...(editingPositions[player.id] || {}), [key]: parseInt(e.target.value) } })}
                              style={{ ...styles.input, marginBottom: 0, fontSize: '0.85rem', padding: '0.5rem' }} />
                          ) : (
                            <div style={{ padding: '0.4rem', backgroundColor: color, borderRadius: '6px', fontSize: '0.85rem', textAlign: 'center', fontWeight: '600' }}>{pos[key]}</div>
                          )}
                        </div>
                      ))}
                    </div>

                    {isEditing ? (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => { savePlayerPosition(player.name, editingPositions[player.id].sturm, editingPositions[player.id].mittelfeld, editingPositions[player.id].abwehr); setEditingPositions({ ...editingPositions, [player.id]: false }); }}
                          style={{ ...styles.button, ...styles.buttonPrimary, marginBottom: 0, flex: 1, padding: '0.5rem', fontSize: '0.85rem' }}>✅ Speichern</button>
                        <button onClick={() => setEditingPositions({ ...editingPositions, [player.id]: false })}
                          style={{ ...styles.button, ...styles.buttonSecondary, marginBottom: 0, flex: 1, padding: '0.5rem', fontSize: '0.85rem' }}>✕ Abbrechen</button>
                      </div>
                    ) : (
                      <button onClick={() => setEditingPositions({ ...editingPositions, [player.id]: { sturm: pos.sturm, mittelfeld: pos.mittelfeld, abwehr: pos.abwehr } })}
                        style={{ ...styles.button, ...styles.buttonSecondary, marginBottom: 0, padding: '0.5rem', fontSize: '0.85rem' }}>✏️ Bearbeiten</button>
                    )}
                  </div>
                );
              })}
              {players.length === 0 && <div style={{ color: '#6b7280', textAlign: 'center', padding: '1rem' }}>Keine Spieler vorhanden</div>}
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
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color: GRUEN }}>📅 Datum</label>
              <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} style={styles.input} required />
            </div>

            <div style={styles.section}>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color: GELB }}>👥 GELB ({formData.players1.length})</label>
              <div style={{ ...styles.card, padding: '0.75rem' }}>
                {players.map((p) => (
                  <div key={p.id} style={{ ...styles.checkbox, ...(formData.players1.includes(p.name) ? styles.checkboxChecked : {}) }} onClick={() => togglePlayer(p.name, 1)}>
                    <input type="checkbox" checked={formData.players1.includes(p.name)} onChange={() => {}} style={{ marginRight: '0.75rem', width: '18px', height: '18px', cursor: 'pointer' }} />
                    <span>{p.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              {[{ team: 'score1', color: GELB }, { team: 'score2', color: BLAU }].map(({ team, color }) => (
                <div key={team} style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color }}>Tore</label>
                  <input type="number" min="0" value={formData[team]} onChange={(e) => setFormData({ ...formData, [team]: e.target.value })} style={styles.input} />
                </div>
              ))}
            </div>

            <div style={styles.section}>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color: BLAU }}>👥 BLAU ({formData.players2.length})</label>
              <div style={{ ...styles.card, padding: '0.75rem' }}>
                {players.map((p) => (
                  <div key={p.id} style={{ ...styles.checkbox, ...(formData.players2.includes(p.name) ? styles.checkboxChecked : {}) }} onClick={() => togglePlayer(p.name, 2)}>
                    <input type="checkbox" checked={formData.players2.includes(p.name)} onChange={() => {}} style={{ marginRight: '0.75rem', width: '18px', height: '18px', cursor: 'pointer' }} />
                    <span>{p.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={styles.section}>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color: GRUEN }}>⚽ Torschützen ({formData.goals.length})</label>
              {formData.players1.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.85rem', color: GELB, marginBottom: '0.5rem', fontWeight: '600' }}>GELB:</div>
                  <div style={{ ...styles.card, padding: '0.75rem' }}>
                    {formData.players1.map((p) => <button key={p} type="button" onClick={() => addGoal(p, 'Gelb')} style={{ ...styles.button, ...styles.buttonSecondary, marginBottom: '0.5rem', fontSize: '0.9rem', padding: '0.5rem' }}>➕ {p}</button>)}
                  </div>
                </div>
              )}
              {formData.players2.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.85rem', color: BLAU, marginBottom: '0.5rem', fontWeight: '600' }}>BLAU:</div>
                  <div style={{ ...styles.card, padding: '0.75rem' }}>
                    {formData.players2.map((p) => <button key={p} type="button" onClick={() => addGoal(p, 'Blau')} style={{ ...styles.button, ...styles.buttonSecondary, marginBottom: '0.5rem', fontSize: '0.9rem', padding: '0.5rem' }}>➕ {p}</button>)}
                  </div>
                </div>
              )}
              {formData.goals.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ fontSize: '0.85rem', color: GRUEN, marginBottom: '0.5rem', fontWeight: '600' }}>Erfasste Tore:</div>
                  {formData.goals.map((goal, idx) => (
                    <div key={idx} style={{ padding: '0.5rem', backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: '6px', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{goal.player} ({goal.team})</span>
                      <button type="button" onClick={() => removeGoal(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button type="submit" style={{ ...styles.button, ...styles.buttonPrimary }}>✅ {editingGame ? 'Aktualisieren' : 'Speichern'}</button>
            <button type="button" style={{ ...styles.button, ...styles.buttonSecondary }} onClick={() => { setView('home'); setEditingGame(null); }}>Abbrechen</button>
          </form>
        </div>
      </div>
    );
  }
if (view === 'csv') {
  return (
    <div style={styles.container}>
      <TopNav />
      <div style={styles.content}>

        
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>📤 Export</h2>
          <div style={styles.card}>
            <button
              style={{ ...styles.button, ...styles.buttonSecondary }}
              onClick={handleExportGames}
            >
              📋 Spiele exportieren (CSV)
            </button>
            <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '1rem' }}>
              Alle Spiele inkl. Spieler & Torschützen — Round-Trip-kompatibel
            </div>
            <button
              style={{ ...styles.button, ...styles.buttonSecondary }}
              onClick={handleExportStats}
            >
              📊 Statistiken exportieren (CSV)
            </button>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
              Punkte, Tore, Siegquote — für Excel
            </div>
          </div>
        </div>

        
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>📥 Import</h2>
          <div style={styles.card}>

            
            <button
              style={{ ...styles.button, ...styles.buttonSecondary }}
              onClick={() => {
                const template = 'datum,gelb_spieler,gelb_tore,blau_spieler,blau_tore,torschuetzen\n2026-03-15,Max|Alex|Tom,3,Ben|Stefan|Luca,1,Max|Max|Tom\n';
                const blob = new Blob(['\uFEFF' + template], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url; link.download = 'vorlage_spiele.csv'; link.click();
                URL.revokeObjectURL(url);
              }}
            >
              📄 Vorlage herunterladen
            </button>

            
            {csvState.status === 'idle' || csvState.status === 'done' || csvState.status === 'done_with_errors' ? (
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', color: '#10b981', marginBottom: '0.5rem' }}>
                  CSV-Datei auswählen
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCSVFile}
                  style={{ ...styles.input, cursor: 'pointer' }}
                />
              </div>
            ) : null}

            
            {csvState.status === 'preview' && (
              <div>
                <div style={{ color: '#10b981', fontWeight: '600', marginBottom: '0.75rem' }}>
                  ✅ {csvState.valid.length} Spiele bereit zum Import
                </div>

                
                <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #10b981' }}>
                        <th style={{ textAlign: 'left', padding: '0.4rem' }}>Datum</th>
                        <th style={{ textAlign: 'center', padding: '0.4rem' }}>Gelb</th>
                        <th style={{ textAlign: 'center', padding: '0.4rem' }}>Score</th>
                        <th style={{ textAlign: 'center', padding: '0.4rem' }}>Blau</th>
                        <th style={{ textAlign: 'center', padding: '0.4rem' }}>Tore</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvState.valid.map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(16,185,129,0.1)' }}>
                          <td style={{ padding: '0.4rem' }}>{row.datum}</td>
                          <td style={{ padding: '0.4rem', textAlign: 'center', fontSize: '0.7rem' }}>{row.gelbSpieler.join(', ')}</td>
                          <td style={{ padding: '0.4rem', textAlign: 'center', fontWeight: '600', color: '#10b981' }}>{row.score1}:{row.score2}</td>
                          <td style={{ padding: '0.4rem', textAlign: 'center', fontSize: '0.7rem' }}>{row.blauSpieler.join(', ')}</td>
                          <td style={{ padding: '0.4rem', textAlign: 'center' }}>{row.torschuetzen.length}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {csvState.warnings.length > 0 && (
                  <div style={{ backgroundColor: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '8px', padding: '0.75rem', marginBottom: '0.75rem' }}>
                    <div style={{ color: '#fbbf24', fontWeight: '600', marginBottom: '0.5rem', fontSize: '0.85rem' }}>⚠️ Warnungen (übersprungen)</div>
                    {csvState.warnings.map((w, i) => <div key={i} style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{w}</div>)}
                  </div>
                )}

                <button style={{ ...styles.button, ...styles.buttonPrimary }} onClick={handleCSVImport}>
                  ✅ {csvState.valid.length} Spiele importieren
                </button>
                <button
                  style={{ ...styles.button, ...styles.buttonSecondary }}
                  onClick={() => setCsvState({ status: 'idle', valid: [], warnings: [], errors: [], progress: 0, total: 0 })}
                >
                  Abbrechen
                </button>
              </div>
            )}

            
            {csvState.status === 'importing' && (
              <div style={{ textAlign: 'center', padding: '1rem' }}>
                <div style={{ color: '#10b981', fontWeight: '600', marginBottom: '0.5rem' }}>
                  ⏳ Importiere {csvState.progress} / {csvState.total}
                </div>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', height: '8px', overflow: 'hidden' }}>
                  <div style={{
                    backgroundColor: '#10b981',
                    height: '100%',
                    width: `${csvState.total > 0 ? (csvState.progress / csvState.total) * 100 : 0}%`,
                    transition: 'width 0.3s ease',
                    borderRadius: '8px',
                  }} />
                </div>
              </div>
            )}

            
            {csvState.errors.length > 0 && (
              <div style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '0.75rem', marginTop: '0.75rem' }}>
                <div style={{ color: '#ef4444', fontWeight: '600', marginBottom: '0.5rem', fontSize: '0.85rem' }}>❌ Fehler</div>
                {csvState.errors.map((e, i) => <div key={i} style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '0.25rem' }}>{e}</div>)}
              </div>
            )}

            
            {(csvState.status === 'done' || csvState.status === 'done_with_errors') && (
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ color: '#10b981', fontWeight: '600', marginBottom: '0.75rem' }}>
                  ✅ {csvState.progress} Spiele erfolgreich importiert
                </div>
                <button
                  style={{ ...styles.button, ...styles.buttonSecondary }}
                  onClick={() => setCsvState({ status: 'idle', valid: [], warnings: [], errors: [], progress: 0, total: 0 })}
                >
                  Weiteren Import starten
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
  return <div style={styles.container}><h1>Loading...</h1></div>;
}
