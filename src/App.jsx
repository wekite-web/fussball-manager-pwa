import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { parseCSV, validateCSV, importGames, exportGamesCSV, exportStatsCSV } from './csvUtils';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
);

const GELB = '#fbbf24';
const BLAU = '#3b82f6';
const GRUEN = '#10b981';

export default function FussballManagerPWA() {
  const [view, setView] = useState('home');
  const [games, setGames] = useState([]);
  const [players, setPlayers] = useState([]);
  const [goals, setGoals] = useState([]);
  const [gameSwaps, setGameSwaps] = useState([]);
  const [playerPositions, setPlayerPositions] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [gamePlayers, setGamePlayers] = useState([]);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
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
    swapsEnabled: false,
    swappedPlayers: [],
  });
  const [csvState, setCsvState] = useState({
    status: 'idle', valid: [], warnings: [], errors: [], progress: 0, total: 0
  });
  const [showShareCard, setShowShareCard] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showStatsLegend, setShowStatsLegend] = useState(false);
  const [showBalanceLegend, setShowBalanceLegend] = useState(false);
  const [presentPlayers, setPresentPlayers] = useState([]);
  const [spieltagTeams, setSpieltagTeams] = useState(null);

  // ─── INITIAL LOAD ──────────────────────────────────────────────────────────
  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAdminMode(!!session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAdminMode(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadAll = async () => {
    await Promise.all([
      loadAdmins(),
      loadPlayers(),
      loadGames(),
      loadGoals(),
      loadGameSwaps(),
      loadPlayerPositions(),
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

  const loadGoals = async () => {
    const { data } = await supabase.from('goals').select('*');
    setGoals(data || []);
  };

  const loadGameSwaps = async () => {
    const { data } = await supabase.from('game_swaps').select('*');
    setGameSwaps(data || []);
  };

  const loadGamePlayers = async () => {
    const { data } = await supabase.from('game_players').select('*');
    setGamePlayers(data || []);
  };

  // ─── PLAYER STATS: aus games + game_players + game_swaps berechnet ─────────
  const playerStats = useMemo(() => {
    const statsMap = {};
    players.forEach((p) => {
      statsMap[p.name] = { player_name: p.name, games_played: 0, wins: 0, draws: 0, losses: 0, swaps: 0, goals_for: 0, goals_against: 0, points: 0 };
    });
    const gameMap = {};
    games.forEach((g) => { gameMap[g.game_id] = g; });

    // Tauschspieler-Lookup: "game_id__player_name"
    const swapSet = new Set(gameSwaps.map((s) => `${s.game_id}__${s.player_name}`));

    gamePlayers.forEach((gp) => {
      const game = gameMap[gp.game_id];
      if (!game || !statsMap[gp.player_name]) return;
      const s = statsMap[gp.player_name];
      const isSwapped = swapSet.has(`${gp.game_id}__${gp.player_name}`);
      const isTeam1 = gp.team === game.team1;
      const winner = game.score1 > game.score2 ? 'team1' : game.score2 > game.score1 ? 'team2' : 'draw';
      const isWinner = (winner === 'team1' && isTeam1) || (winner === 'team2' && !isTeam1);
      const isDraw = winner === 'draw';

      s.games_played += 1;

      if (isSwapped) {
        // Tauschspieler: immer 1,5 Punkte, kein W/U/N, eigener T-Zähler
        s.points += 1.5;
        s.swaps += 1;
      } else {
        const goalsFor = isTeam1 ? game.score1 : game.score2;
        const goalsAgainst = isTeam1 ? game.score2 : game.score1;
        s.wins += isWinner ? 1 : 0;
        s.draws += isDraw ? 1 : 0;
        s.losses += (!isWinner && !isDraw) ? 1 : 0;
        s.goals_for += goalsFor;
        s.goals_against += goalsAgainst;
        s.points += isDraw ? 1 : isWinner ? 3 : 0;
      }
    });
    return Object.values(statsMap).sort((a, b) => b.points - a.points || b.wins - a.wins);
  }, [games, gamePlayers, players, gameSwaps]);

  // ─── TOP SCORERS: aus goals berechnet ──────────────────────────────────────
  const topScorers = useMemo(() => {
    const scorerMap = {};
    goals.forEach((g) => {
      if (!scorerMap[g.player_name]) scorerMap[g.player_name] = { player_name: g.player_name, total_goals: 0 };
      scorerMap[g.player_name].total_goals += 1;
    });
    return Object.values(scorerMap).sort((a, b) => b.total_goals - a.total_goals);
  }, [goals]);

  // ─── TEAM-BILANZ ───────────────────────────────────────────────────────────
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

  // ─── EXTENDED STATS: Anwesenheit + Streaks ─────────────────────────────────
  const extendedStats = useMemo(() => {
    const totalGames = games.length;
    const result = {};
    playerStats.forEach((stat) => {
      const playerName = stat.player_name;
      const playerEntries = gamePlayers.filter((gp) => gp.player_name === playerName);
      const playerGameIds = new Set(playerEntries.map((gp) => gp.game_id));
      const playerTeamMap = {};
      playerEntries.forEach((gp) => { playerTeamMap[gp.game_id] = gp.team; });

      const playedGames = playerGameIds.size;
      const missedGames = totalGames - playedGames;
      const attendance = totalGames > 0 ? ((playedGames / totalGames) * 100).toFixed(1) : '0.0';

      // Anwesenheits-Streak (fix: alle Spiele prüfen, nicht nur letzte 5)
      let currentStreak = 0;
      for (const g of games) {
        if (playerGameIds.has(g.game_id)) currentStreak += 1;
        else break;
      }
      let maxStreak = 0, streak = 0;
      for (const g of [...games].reverse()) {
        if (playerGameIds.has(g.game_id)) { streak += 1; maxStreak = Math.max(maxStreak, streak); }
        else streak = 0;
      }

      // Siegesserie (bricht bei Niederlage, Unentschieden oder Abwesenheit)
      let currentWinStreak = 0;
      for (const g of games) {
        const team = playerTeamMap[g.game_id];
        if (!team) break;
        const isTeam1 = team === g.team1;
        const won = isTeam1 ? g.score1 > g.score2 : g.score2 > g.score1;
        if (won) currentWinStreak++;
        else break;
      }
      let maxWinStreak = 0, winStreak = 0;
      for (const g of [...games].reverse()) {
        const team = playerTeamMap[g.game_id];
        if (!team) { winStreak = 0; continue; }
        const isTeam1 = team === g.team1;
        const won = isTeam1 ? g.score1 > g.score2 : g.score2 > g.score1;
        if (won) { winStreak++; maxWinStreak = Math.max(maxWinStreak, winStreak); }
        else winStreak = 0;
      }

      result[playerName] = { playedGames, missedGames, attendance, currentStreak, maxStreak, currentWinStreak, maxWinStreak };
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
      const scorer = topScorers.find((s) => s.player_name === playerName);
      const stat = playerStats.find((s) => s.player_name === playerName);
      const indGoals = scorer ? scorer.total_goals : 0;
      const normalGames = stat ? stat.games_played - stat.swaps : 0;
      if (normalGames === 0) return '—';
      return (indGoals / normalGames).toFixed(2);
    },
    [topScorers, playerStats]
  );

  // OVR = STR 60% + Win Rate 25% + Tore/Spiel 15% — Fallback auf STR wenn < 3 normale Spiele
  const getOVR = useCallback(
    (playerName) => {
      const pos = getPlayerPositions(playerName);
      const str = (pos.sturm + pos.mittelfeld + pos.abwehr) / 3;
      const stat = playerStats.find((s) => s.player_name === playerName);
      const normalGames = stat ? stat.games_played - stat.swaps : 0;
      if (normalGames < 3) return parseFloat(str.toFixed(1));
      const scorer = topScorers.find((s) => s.player_name === playerName);
      const goals = scorer ? scorer.total_goals : 0;
      const erf = Math.min((stat.wins / normalGames) * 10, 10);
      const eff = Math.min((goals / normalGames) * 5, 10);
      return parseFloat((str * 0.6 + erf * 0.25 + eff * 0.15).toFixed(1));
    },
    [getPlayerPositions, playerStats, topScorers]
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

  // Greedy-Zuweisung: minimiert Abweichung in Sturm, MF, AW und OVR separat
  const buildBalancedTeams = (names) => {
    const data = names.map((name) => {
      const pos = getPlayerPositions(name);
      return { name, ovr: getOVR(name), sturm: pos.sturm, mittelfeld: pos.mittelfeld, abwehr: pos.abwehr };
    });
    data.sort((a, b) => b.ovr - a.ovr);
    const team1 = [], team2 = [];
    const tot1 = { ovr: 0, sturm: 0, mittelfeld: 0, abwehr: 0 };
    const tot2 = { ovr: 0, sturm: 0, mittelfeld: 0, abwehr: 0 };
    const maxSize = Math.ceil(data.length / 2);
    const addTo = (team, tot, p) => {
      team.push(p); tot.ovr += p.ovr; tot.sturm += p.sturm; tot.mittelfeld += p.mittelfeld; tot.abwehr += p.abwehr;
    };
    // Gesamtabweichung wenn p zu team1 (true) oder team2 (false) geht
    const imbalanceIf = (toTeam1, p) => {
      const s1 = tot1.sturm + (toTeam1 ? p.sturm : 0);
      const s2 = tot2.sturm + (toTeam1 ? 0 : p.sturm);
      const m1 = tot1.mittelfeld + (toTeam1 ? p.mittelfeld : 0);
      const m2 = tot2.mittelfeld + (toTeam1 ? 0 : p.mittelfeld);
      const a1 = tot1.abwehr + (toTeam1 ? p.abwehr : 0);
      const a2 = tot2.abwehr + (toTeam1 ? 0 : p.abwehr);
      const o1 = tot1.ovr + (toTeam1 ? p.ovr : 0);
      const o2 = tot2.ovr + (toTeam1 ? 0 : p.ovr);
      return Math.abs(s1 - s2) + Math.abs(m1 - m2) + Math.abs(a1 - a2) + Math.abs(o1 - o2);
    };
    data.forEach((p) => {
      if (team1.length >= maxSize) addTo(team2, tot2, p);
      else if (team2.length >= maxSize) addTo(team1, tot1, p);
      else if (imbalanceIf(true, p) <= imbalanceIf(false, p)) addTo(team1, tot1, p);
      else addTo(team2, tot2, p);
    });
    return { team1, team2, avg1: tot1.ovr / team1.length, avg2: tot2.ovr / team2.length };
  };

  const generateSpieltagTeams = () => {
    if (presentPlayers.length < 2) { alert('Mindestens 2 Spieler auswählen!'); return; }
    const { team1, team2, avg1, avg2 } = buildBalancedTeams(presentPlayers);
    setSpieltagTeams({ team1: { players: team1, avg: avg1 }, team2: { players: team2, avg: avg2 } });
  };

  const generateBalancedTeams = () => {
    if (players.length < 2) { alert('Mindestens 2 Spieler erforderlich!'); return; }
    const { team1, team2, avg1, avg2 } = buildBalancedTeams(players.map((p) => p.name));
    setGeneratedTeams({ team1: { players: team1, avg: avg1.toFixed(2) }, team2: { players: team2, avg: avg2.toFixed(2) }, difference: Math.abs(avg1 - avg2).toFixed(2) });
    showNotification('✅ Teams generiert!');
  };

  const handleAdminLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword,
    });
    if (error) {
      alert('❌ Login fehlgeschlagen: ' + error.message);
      setAdminPassword('');
    } else {
      setAdminEmail('');
      setAdminPassword('');
      setShowAdminLogin(false);
      showNotification('✅ Admin-Mode aktiviert');
    }
  };

  const handleAdminLogout = async () => {
    await supabase.auth.signOut();
    showNotification('Admin-Mode deaktiviert');
  };

  const handleAddPlayer = async (e) => {
    e.preventDefault();
    if (!isAdminMode) { alert('Nur Admins!'); return; }
    if (!newPlayer.trim()) return;
    try {
      await supabase.from('players').insert([{ name: newPlayer }]);
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
        supabase.from('player_positions').update({ player_name: newPlayerName }).eq('player_name', oldName),
        supabase.from('game_players').update({ player_name: newPlayerName }).eq('player_name', oldName),
        supabase.from('goals').update({ player_name: newPlayerName }).eq('player_name', oldName),
        supabase.from('game_swaps').update({ player_name: newPlayerName }).eq('player_name', oldName),
      ]);
      setRenamingPlayer(null);
      setNewPlayerName('');
      await Promise.all([loadPlayers(), loadPlayerPositions(), loadGamePlayers(), loadGoals(), loadGameSwaps()]);
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
        supabase.from('player_positions').delete().eq('player_name', playerName),
      ]);
      await Promise.all([loadPlayers(), loadPlayerPositions()]);
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
      await supabase.from('game_swaps').delete().eq('game_id', gameIdStr);
      await supabase.from('goals').delete().eq('game_id', gameIdStr);
      await supabase.from('game_players').delete().eq('game_id', gameIdStr);
      await supabase.from('game_results').delete().eq('game_id', gameIdStr);
      await supabase.from('games').delete().eq('id', gameId);
      await Promise.all([loadGames(), loadGamePlayers(), loadGoals(), loadGameSwaps()]);
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

  const resetFormData = () => setFormData({
    date: new Date().toISOString().split('T')[0],
    team1: 'Gelb', team2: 'Blau', score1: 0, score2: 0,
    players1: [], players2: [], goals: [],
    swapsEnabled: false, swappedPlayers: [],
  });

  const handleNewGame = async (e) => {
    e.preventDefault();
    if (!isAdminMode) { alert('Nur Admins!'); return; }
    try {
      const gameId = editingGame?.game_id || `game_${Date.now()}`;
      const score1 = parseInt(formData.score1);
      const score2 = parseInt(formData.score2);
      const winner = score1 > score2 ? 'team1' : score2 > score1 ? 'team2' : 'draw';

      if (editingGame) {
        await supabase.from('games').update({ date: formData.date, score1, score2 }).eq('id', editingGame.id);
        await supabase.from('game_results').update({ score1, score2, winner }).eq('game_id', gameId);

        await supabase.from('game_players').delete().eq('game_id', gameId);
        const gpInsert = [
          ...formData.players1.map((p) => ({ game_id: gameId, player_name: p, team: formData.team1 })),
          ...formData.players2.map((p) => ({ game_id: gameId, player_name: p, team: formData.team2 })),
        ];
        if (gpInsert.length > 0) await supabase.from('game_players').insert(gpInsert);

        await supabase.from('goals').delete().eq('game_id', gameId);
        if (formData.goals.length > 0) {
          await supabase.from('goals').insert(formData.goals.map((g) => ({ game_id: gameId, player_name: g.player, team: g.team })));
        }

        await supabase.from('game_swaps').delete().eq('game_id', gameId);
        if (formData.swapsEnabled && formData.swappedPlayers.length > 0) {
          await supabase.from('game_swaps').insert(formData.swappedPlayers.map((p) => ({ game_id: gameId, player_name: p })));
        }
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
        }

        if (formData.swapsEnabled && formData.swappedPlayers.length > 0) {
          await supabase.from('game_swaps').insert(
            formData.swappedPlayers.map((p) => ({ game_id: gameId, player_name: p }))
          );
        }
      }

      await Promise.all([loadGames(), loadGamePlayers(), loadGoals(), loadGameSwaps()]);
      resetFormData();
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
    const existingPlayers1 = gamePlayers
      .filter((gp) => gp.game_id === game.game_id && gp.team === game.team1)
      .map((gp) => gp.player_name);
    const existingPlayers2 = gamePlayers
      .filter((gp) => gp.game_id === game.game_id && gp.team === game.team2)
      .map((gp) => gp.player_name);
    const existingGoals = goals
      .filter((g) => g.game_id === game.game_id)
      .map((g) => ({ player: g.player_name, team: g.team }));
    const existingSwaps = gameSwaps
      .filter((s) => s.game_id === game.game_id)
      .map((s) => s.player_name);
    setEditingGame(game);
    setFormData({
      date: game.date.split('T')[0], team1: game.team1, team2: game.team2,
      score1: game.score1, score2: game.score2,
      players1: existingPlayers1,
      players2: existingPlayers2,
      goals: existingGoals,
      swapsEnabled: existingSwaps.length > 0,
      swappedPlayers: existingSwaps,
    });
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
    const existingDates = games.map((g) => g.date.split('T')[0]);
    const knownPlayers = players.map((p) => p.name);
    const { valid, warnings, errors } = validateCSV(rows, knownPlayers, existingDates);
    setCsvState({ status: errors.length > 0 ? 'error' : 'preview', valid, warnings, errors, progress: 0, total: valid.length });
    e.target.value = '';
  };

  const handleCSVImport = async () => {
    if (csvState.valid.length === 0) return;
    setCsvState((s) => ({ ...s, status: 'importing', progress: 0 }));
    const { imported, errors } = await importGames(
      csvState.valid,
      (current, total) => setCsvState((s) => ({ ...s, progress: current, total }))
    );
    await Promise.all([loadGames(), loadGamePlayers(), loadGoals()]);
    setCsvState((s) => ({ ...s, status: errors.length > 0 ? 'done_with_errors' : 'done', errors: [...s.errors, ...errors], progress: imported }));
  };

  const handleExportGames = async () => {
    try { await exportGamesCSV(); showNotification('✅ Spiele exportiert'); }
    catch (err) { alert(err.message); }
  };

  const handleExportStats = async () => {
    try { await exportStatsCSV(); showNotification('✅ Statistiken exportiert'); }
    catch (err) { alert(err.message); }
  };

  const handleExportHTML = () => {
    if (games.length === 0) { showNotification('Keine Spiele vorhanden'); return; }

    const sorted = [...games].sort((a, b) => a.date.localeCompare(b.date));
    const seasonStart = sorted[0].date;
    const seasonEnd = sorted[sorted.length - 1].date;
    const year = seasonEnd.substring(0, 4);
    const totalGoalsCount = goals.length;

    const mvp = playerStats[0];
    const topScorer = topScorers[0];
    const attKing = [...playerStats].sort((a, b) =>
      parseFloat((extendedStats[b.player_name] || {}).attendance || 0) -
      parseFloat((extendedStats[a.player_name] || {}).attendance || 0)
    )[0];
    const effKing = playerStats.filter(s => (s.games_played - s.swaps) >= 3).sort((a, b) =>
      (parseFloat(getGoalsPerGame(b.player_name)) || 0) - (parseFloat(getGoalsPerGame(a.player_name)) || 0)
    )[0];

    const awardsHTML = [
      mvp && `<div class="award"><div class="ai">🥇</div><div class="at">MVP</div><div class="an">${mvp.player_name}</div><div class="av">${mvp.points} Pkte</div></div>`,
      topScorer && `<div class="award"><div class="ai">⚽</div><div class="at">Torschützen-König</div><div class="an">${topScorer.player_name}</div><div class="av">${topScorer.total_goals} Tore</div></div>`,
      attKing && `<div class="award"><div class="ai">📅</div><div class="at">Anwesenheits-König</div><div class="an">${attKing.player_name}</div><div class="av">${(extendedStats[attKing.player_name] || {}).attendance}%</div></div>`,
      effKing && `<div class="award"><div class="ai">⚡</div><div class="at">Effizienz-König</div><div class="an">${effKing.player_name}</div><div class="av">${getGoalsPerGame(effKing.player_name)} ⚽/Spiel</div></div>`,
    ].filter(Boolean).join('');

    const pointsRows = playerStats.map((s, i) => {
      const hasNormal = (s.games_played - s.swaps) > 0;
      const winPct = hasNormal ? ((s.wins / (s.games_played - s.swaps)) * 100).toFixed(0) : '0';
      const medal = i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : (i + 1) + '. ';
      return `<tr><td>${medal}${s.player_name}</td><td class="c bold green">${s.points}</td><td class="c">${s.games_played > 0 ? (s.points / s.games_played).toFixed(2) : '0.00'}</td><td class="c">${winPct}%</td><td class="c">${s.wins}/${s.draws}/${s.losses}</td><td class="c">${hasNormal ? s.goals_for + ':' + s.goals_against : '—'}</td></tr>`;
    }).join('');

    const attRows = [...playerStats]
      .sort((a, b) =>
        parseFloat((extendedStats[b.player_name] || {}).attendance || 0) -
        parseFloat((extendedStats[a.player_name] || {}).attendance || 0)
      )
      .map((s, i) => {
        const ext = extendedStats[s.player_name] || {};
        return `<tr><td>${i + 1}. ${s.player_name}</td><td class="c bold green">${ext.attendance}%</td><td class="c">${ext.playedGames}/${(ext.playedGames || 0) + (ext.missedGames || 0)}</td><td class="c">${ext.currentStreak}</td><td class="c">${ext.maxStreak}</td></tr>`;
      }).join('');

    const scorerRows = topScorers.map((s, i) => {
      const medal = i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : (i + 1) + '. ';
      return `<tr><td>${medal}${s.player_name}</td><td class="c bold green">${s.total_goals} ⚽</td><td class="c">${getGoalsPerGame(s.player_name)}/Spiel</td></tr>`;
    }).join('');

    const gamesHTML = [...games]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(g => {
        const gp1 = gamePlayers.filter(p => p.game_id === g.game_id && p.team === 'Gelb').map(p => p.player_name).join(', ');
        const gp2 = gamePlayers.filter(p => p.game_id === g.game_id && p.team === 'Blau').map(p => p.player_name).join(', ');
        const gameGoals = goals.filter(goal => goal.game_id === g.game_id).map(goal => goal.player_name);
        const isGelbWin = g.score1 > g.score2;
        const isBlauWin = g.score2 > g.score1;
        const goalsLine = gameGoals.length > 0 ? `<div class="ggoals">⚽ ${gameGoals.join(', ')}</div>` : '';
        return `<div class="grow"><span class="dbadge">${g.date}</span><span class="t1${isGelbWin ? ' win-y' : ''}">${gp1}</span><span class="sbadge">${g.score1} : ${g.score2}</span><span class="t2${isBlauWin ? ' win-b' : ''}">${gp2}</span>${goalsLine}</div>`;
      }).join('');

    const numSlides = 6;
    const dotsHTML = Array.from({ length: numSlides }, (_, i) =>
      '<div class="dot' + (i === 0 ? ' active' : '') + '" onclick="go(' + i + ')"></div>'
    ).join('');

    const html = '<!DOCTYPE html>\n' +
`<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Saison ${year} – Fußball Manager</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0f172a;color:#fff;font-family:system-ui,-apple-system,sans-serif;overflow:hidden;height:100vh;width:100vw}
.wrap{position:relative;width:100vw;height:100vh;overflow:hidden}
.slide{position:absolute;top:0;left:0;width:100%;height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:2rem 2rem 5rem;overflow-y:auto;transition:transform .4s cubic-bezier(.4,0,.2,1)}
.nav{position:fixed;bottom:1.25rem;left:0;right:0;display:flex;justify-content:center;align-items:center;gap:1.25rem;z-index:100}
.btn{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2);color:#fff;width:2.5rem;height:2.5rem;border-radius:50%;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;transition:background .2s;font-family:inherit}
.btn:hover{background:rgba(16,185,129,.4);border-color:#10b981}
.dots{display:flex;gap:.4rem;align-items:center}
.dot{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.25);cursor:pointer;transition:all .25s}
.dot.active{background:#10b981;width:20px;border-radius:4px}
.counter{position:fixed;top:1rem;right:1.5rem;color:rgba(255,255,255,.3);font-size:.8rem;z-index:100}
.big{font-size:clamp(2rem,5vw,4rem);font-weight:800;color:#10b981;text-align:center;margin-bottom:.5rem}
.sub{color:rgba(255,255,255,.55);text-align:center;font-size:clamp(.9rem,2.5vw,1.4rem)}
.nums{display:flex;gap:3rem;margin-top:2rem;text-align:center}
.num{font-size:2.5rem;font-weight:800}
.numlbl{color:rgba(255,255,255,.5);font-size:.85rem;margin-top:.25rem}
.stitle{font-size:1.4rem;font-weight:700;color:#10b981;margin-bottom:1.5rem;text-align:center}
.awards{display:grid;grid-template-columns:repeat(2,1fr);gap:1rem;max-width:560px;width:100%}
.award{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:1.25rem;text-align:center}
.ai{font-size:2rem;margin-bottom:.4rem}
.at{font-size:.7rem;color:rgba(255,255,255,.45);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.2rem}
.an{font-size:1.1rem;font-weight:700;margin-bottom:.2rem}
.av{font-size:.9rem;color:#10b981;font-weight:600}
.tw{width:100%;max-width:700px;overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:.82rem}
th{padding:.45rem .6rem;text-align:center;font-weight:600;border-bottom:2px solid #10b981;color:rgba(255,255,255,.65)}
th:first-child{text-align:left}
td{padding:.35rem .6rem;text-align:center;border-bottom:1px solid rgba(16,185,129,.1)}
td:first-child{text-align:left}
tr:hover td{background:rgba(255,255,255,.03)}
.c{text-align:center}
.green{color:#10b981}
.bold{font-weight:700}
.gl{width:100%;max-width:720px;max-height:65vh;overflow-y:auto;padding-right:.25rem}
.grow{background:rgba(255,255,255,.03);border-radius:8px;padding:.55rem .75rem;margin-bottom:.35rem;display:grid;grid-template-columns:72px 1fr 52px 1fr;gap:.25rem .6rem;align-items:center;font-size:.78rem}
.dbadge{color:rgba(255,255,255,.35);font-size:.7rem;white-space:nowrap}
.sbadge{background:rgba(255,255,255,.08);border-radius:6px;padding:.15rem .5rem;font-weight:700;font-size:.88rem;text-align:center;white-space:nowrap}
.t1{color:rgba(255,255,255,.7)}.t2{color:rgba(255,255,255,.7)}
.win-y{color:#f59e0b;font-weight:700}.win-b{color:#3b82f6;font-weight:700}
.ggoals{grid-column:1/-1;color:rgba(255,255,255,.38);font-size:.7rem;padding-top:.1rem}
</style>
</head>
<body>
<div class="wrap">

<div class="slide">
  <div class="big">⚽ Saison ${year}</div>
  <div class="sub">${seasonStart} – ${seasonEnd}</div>
  <div class="nums">
    <div><div class="num" style="color:#10b981">${games.length}</div><div class="numlbl">Spiele</div></div>
    <div><div class="num" style="color:#f59e0b">${playerStats.length}</div><div class="numlbl">Spieler</div></div>
    <div><div class="num" style="color:#3b82f6">${totalGoalsCount}</div><div class="numlbl">Tore</div></div>
  </div>
</div>

<div class="slide">
  <div class="stitle">🏆 Saison-Awards</div>
  <div class="awards">${awardsHTML}</div>
</div>

<div class="slide">
  <div class="stitle">📊 Punkte &amp; Erfolg</div>
  <div class="tw"><table>
    <thead><tr><th>Spieler</th><th>Pkte</th><th>Ø</th><th>W%</th><th>S/U/N</th><th>T:G</th></tr></thead>
    <tbody>${pointsRows}</tbody>
  </table></div>
</div>

<div class="slide">
  <div class="stitle">📅 Anwesenheit &amp; Form</div>
  <div class="tw"><table>
    <thead><tr><th>Spieler</th><th>%</th><th>Spiele</th><th>🔥 Streak</th><th>⭐ Best</th></tr></thead>
    <tbody>${attRows}</tbody>
  </table></div>
</div>

<div class="slide">
  <div class="stitle">⚽ Torschützen</div>
  <div class="tw"><table>
    <thead><tr><th>Spieler</th><th>Tore</th><th>Ø/Spiel</th></tr></thead>
    <tbody>${scorerRows}</tbody>
  </table></div>
</div>

<div class="slide">
  <div class="stitle">📋 Alle Spiele</div>
  <div class="gl">${gamesHTML}</div>
</div>

</div>
<div class="nav">
  <button class="btn" onclick="go(curr-1)">&#9664;</button>
  <div class="dots" id="dots">${dotsHTML}</div>
  <button class="btn" onclick="go(curr+1)">&#9654;</button>
</div>
<div class="counter"><span id="cn">1</span> / ${numSlides}</div>
<script>
var slides=document.querySelectorAll('.slide');
var dots=document.querySelectorAll('.dot');
var cn=document.getElementById('cn');
var curr=0;
function render(){slides.forEach(function(s,i){s.style.transform='translateX('+(i-curr)*100+'%)'});}
function updNav(){dots.forEach(function(d,i){d.classList.toggle('active',i===curr)});cn.textContent=curr+1;}
function go(n){if(n<0||n>=slides.length)return;curr=n;render();updNav();}
document.addEventListener('keydown',function(e){if(e.key==='ArrowRight')go(curr+1);if(e.key==='ArrowLeft')go(curr-1);});
render();
</script>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'saison-' + year + '.html';
    link.click();
    URL.revokeObjectURL(url);
    showNotification('✅ Saison-Export erstellt');
  };

  // ─── STYLES ────────────────────────────────────────────────────────────────
  const styles = {
    container: {
      minHeight: '100vh', backgroundColor: '#0f172a', color: '#fff',
      fontFamily: '"Segoe UI", Tahoma, Geneva, sans-serif',
      paddingTop: '108px', paddingBottom: '20px',
      backgroundImage: 'linear-gradient(135deg, #0f172a 0%, #1a2332 100%)',
    },
    topNav: { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100 },
    header: {
      background: `linear-gradient(135deg, ${GRUEN} 0%, #059669 100%)`,
      padding: '0.6rem 1rem', boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem',
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
  const TopNav = () => (
    <>
    {showAdminLogin && (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
        <div style={{ ...styles.card, maxWidth: '300px' }}>
          <h3 style={{ textAlign: 'center', marginTop: 0 }}>🔐 Admin-Login</h3>
          <input type="email" placeholder="E-Mail" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} style={{ ...styles.input, marginBottom: '0.5rem' }} autoFocus />
          <input type="password" placeholder="Passwort" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} style={styles.input} onKeyPress={(e) => { if (e.key === 'Enter') handleAdminLogin(); }} />
          <button onClick={handleAdminLogin} style={{ ...styles.button, ...styles.buttonPrimary, marginBottom: '0.5rem' }}>✅ Anmelden</button>
          <button onClick={() => setShowAdminLogin(false)} style={{ ...styles.button, ...styles.buttonSecondary }}>Abbrechen</button>
        </div>
      </div>
    )}
    <div style={styles.topNav}>
      <div style={styles.header}>
        {view !== 'home' ? (
          <button style={styles.backButton} onClick={() => { setView('home'); setEditingGame(null); }} title="Zurück">&lt;&lt;</button>
        ) : (
          <div style={{ minWidth: '44px' }} />
        )}
        <span style={styles.headerTitle}>⚽ Manager</span>
        <button style={styles.adminButton} onClick={() => { if (isAdminMode) { handleAdminLogout(); } else { setShowAdminLogin(true); } }} title={isAdminMode ? 'Admin-Mode AUS' : 'Admin-Mode AN'}>
          {isAdminMode ? '🔐' : '🔓'}
        </button>
      </div>
      <div style={styles.navBar}>
        {[
          { key: 'home', label: '🏠 Home' },
          { key: 'ergebnisse', label: '📋 Spiele' },
          { key: 'stats', label: '📊 Stats' },
          { key: 'scorers', label: '⚽ Tore' },
          { key: 'statspro', label: '⭐ Pro' },
          { key: 'spieltag', label: '🗓️ Tag' },
        ].map(({ key, label }) => (
          <button key={key} style={{ ...styles.navButton, ...(view === key ? styles.navButtonActive : {}) }} onClick={() => { setView(key); if (key === 'home') setEditingGame(null); }}>
            {label}
          </button>
        ))}
      </div>
    </div>
    </>
  );

  // ─── VIEWS ─────────────────────────────────────────────────────────────────
  if (view === 'home') {
    const pointsLeader = playerStats[0] || null;
    const topScorer = topScorers[0] || null;
    const attLeader = playerStats.length > 0
      ? playerStats.reduce((best, stat) => {
          const a = parseFloat((extendedStats[stat.player_name] || {}).attendance || 0);
          const b = parseFloat((extendedStats[best.player_name] || {}).attendance || 0);
          return a > b ? stat : best;
        }, playerStats[0])
      : null;
    const effLeader = topScorers.length > 0
      ? topScorers.reduce((best, scorer) => {
          const statA = playerStats.find((s) => s.player_name === scorer.player_name);
          const statB = playerStats.find((s) => s.player_name === best.player_name);
          const normA = statA ? statA.games_played - statA.swaps : 0;
          const normB = statB ? statB.games_played - statB.swaps : 0;
          const ratioA = normA > 0 ? scorer.total_goals / normA : 0;
          const ratioB = normB > 0 ? best.total_goals / normB : 0;
          return ratioA > ratioB ? scorer : best;
        }, topScorers[0])
      : null;
    const effLeaderStat = effLeader ? playerStats.find((s) => s.player_name === effLeader.player_name) : null;
    const effLeaderNorm = effLeaderStat ? effLeaderStat.games_played - effLeaderStat.swaps : 0;
    const effLeaderRatio = effLeader && effLeaderNorm > 0 ? (effLeader.total_goals / effLeaderNorm).toFixed(2) : null;

    return (
      <div style={styles.container}>
          <TopNav />
        <div style={styles.content}>
          {isAdminMode && (
            <div style={styles.section}>
              <button style={{ ...styles.button, ...styles.buttonPrimary }} onClick={() => setView('newgame')}>➕ Neues Spiel</button>
              <button style={{ ...styles.button, ...styles.buttonSecondary }} onClick={() => setView('players')}>👥 Spieler verwalten</button>
              <button style={{ ...styles.button, ...styles.buttonSecondary }} onClick={() => setView('csv')}>📁 CSV Import/Export</button>
              <button style={{ ...styles.button, ...styles.buttonSecondary }} onClick={() => setShowShareCard((v) => !v)}>🔗 App teilen</button>
            </div>
          )}

          {isAdminMode && showShareCard && (() => {
            const appUrl = window.location.origin;
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(appUrl)}&format=png`;
            const handleCopy = () => {
              navigator.clipboard.writeText(appUrl).then(() => {
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 2000);
              });
            };
            return (
              <div style={styles.section}>
                <h2 style={styles.sectionTitle}>🔗 App teilen</h2>
                <div style={{ ...styles.card, textAlign: 'center', padding: '1.5rem' }}>
                  <img src={qrUrl} alt="QR Code" style={{ width: 200, height: 200, borderRadius: '0.5rem', background: 'white', padding: '0.5rem', marginBottom: '1rem' }} />
                  <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '0.5rem' }}>oder Link teilen:</div>
                  <div style={{ fontSize: '0.85rem', color: GRUEN, wordBreak: 'break-all', marginBottom: '1rem', padding: '0.5rem', background: 'rgba(16,185,129,0.1)', borderRadius: '0.5rem' }}>{appUrl}</div>
                  <button onClick={handleCopy} style={{ ...styles.button, ...styles.buttonSecondary, marginBottom: 0 }}>
                    {linkCopied ? '✅ Kopiert!' : '📋 Link kopieren'}
                  </button>
                </div>
              </div>
            );
          })()}


          {/* ── Saison-Überblick ───────────────────────────────────────── */}
          <div style={styles.section}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.5rem', marginBottom: '1.25rem' }}>
              {[
                { value: players.length, label: 'Spieler' },
                { value: games.length, label: 'Spiele' },
                { value: goals.length, label: 'Tore' },
                { value: games.length > 0 ? (goals.length / games.length).toFixed(1) : '—', label: 'Ø T/S' },
              ].map(({ value, label }) => (
                <div key={label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '10px', padding: '0.6rem 0.25rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: GRUEN }}>{value}</div>
                  <div style={{ fontSize: '0.65rem', color: '#9ca3af', marginTop: '0.15rem' }}>{label}</div>
                </div>
              ))}
            </div>

            <h2 style={styles.sectionTitle}>🏆 Saison-Awards</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {[
                { show: !!pointsLeader, medal: '🥇', title: 'MVP', name: pointsLeader?.player_name, value: `${pointsLeader?.points} Pkte`, color: '#f59e0b' },
                { show: !!topScorer, medal: '⚽', title: 'Torschützen-König', name: topScorer?.player_name, value: `${topScorer?.total_goals} Tore`, color: BLAU },
                { show: !!attLeader, medal: '📅', title: 'Anwesenheits-König', name: attLeader?.player_name, value: `${(extendedStats[attLeader?.player_name] || {}).attendance}%`, color: GRUEN },
                { show: !!(effLeader && effLeaderRatio), medal: '⚡', title: 'Effizienz-König', name: effLeader?.player_name, value: `${effLeaderRatio} ⚽/Spiel`, color: GELB },
              ].filter((a) => a.show).map(({ medal, title, name, value, color }) => (
                <div key={title} style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${color}40`, borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.75rem', marginBottom: '0.35rem' }}>{medal}</div>
                  <div style={{ fontSize: '0.65rem', color, fontWeight: '700', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>{title}</div>
                  <div style={{ fontSize: '1rem', fontWeight: '700', color: 'white', marginBottom: '0.25rem' }}>{name?.substring(0, 12)}</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {games.length > 0 && (() => {
            const last = games[0];
            return (
              <div style={styles.section}>
                <h2 style={styles.sectionTitle}>📅 Letztes Spiel</h2>
                <div style={{ ...styles.card, padding: '1rem' }}>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                    {new Date(last.date).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: GELB, fontSize: '0.9rem', fontWeight: last.score1 > last.score2 ? '700' : '400' }}>🟡 GELB</span>
                    <span style={{ fontSize: '1.75rem', fontWeight: 'bold', color: GRUEN }}>{last.score1} : {last.score2}</span>
                    <span style={{ color: BLAU, fontSize: '0.9rem', fontWeight: last.score2 > last.score1 ? '700' : '400' }}>BLAU 🔵</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    );
  }

  if (view === 'spieltag') {
    const avg1 = spieltagTeams ? spieltagTeams.team1.avg : 0;
    const avg2 = spieltagTeams ? spieltagTeams.team2.avg : 0;
    const bal = spieltagTeams ? Math.round((Math.min(avg1, avg2) / Math.max(avg1, avg2)) * 100) : 0;
    const balColor = bal >= 90 ? GRUEN : bal >= 75 ? GELB : '#ef4444';

    return (
      <div style={styles.container}>
        <TopNav />
        <div style={styles.content}>
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>🗓️ Wer ist heute dabei?</h2>
            <div style={{ ...styles.card, padding: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem' }}>
                {players.map((p) => {
                  const isPresent = presentPlayers.includes(p.name);
                  return (
                    <div
                      key={p.id}
                      onClick={() => { setPresentPlayers((prev) => isPresent ? prev.filter((n) => n !== p.name) : [...prev, p.name]); setSpieltagTeams(null); }}
                      style={{ display: 'flex', alignItems: 'center', padding: '0.5rem', borderRadius: '0.4rem', cursor: 'pointer', background: isPresent ? 'rgba(16,185,129,0.15)' : 'transparent', border: `1px solid ${isPresent ? GRUEN : 'transparent'}` }}
                    >
                      <span style={{ fontSize: '1rem', marginRight: '0.5rem' }}>{isPresent ? '✅' : '⬜'}</span>
                      <span style={{ fontSize: '0.9rem', color: isPresent ? 'white' : '#9ca3af', fontWeight: isPresent ? '600' : 'normal' }}>{p.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <button
                onClick={generateSpieltagTeams}
                disabled={presentPlayers.length < 2}
                style={{ ...styles.button, ...styles.buttonPrimary, marginBottom: 0, flex: 1, opacity: presentPlayers.length < 2 ? 0.4 : 1 }}
              >
                🚀 Teams erstellen ({presentPlayers.length} Spieler)
              </button>
              {presentPlayers.length > 0 && (
                <button onClick={() => { setPresentPlayers([]); setSpieltagTeams(null); }} style={{ ...styles.button, ...styles.buttonSecondary, marginBottom: 0, width: 'auto', padding: '0.75rem' }}>✖</button>
              )}
            </div>
          </div>

          {spieltagTeams && (
            <div style={styles.section}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: `2px solid ${GRUEN}` }}>
                <h2 style={{ ...styles.sectionTitle, marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>⚖️ Team Balance</h2>
                <button
                  onClick={() => setShowBalanceLegend((v) => !v)}
                  style={{ background: 'none', border: `1px solid ${showBalanceLegend ? GRUEN : 'rgba(255,255,255,0.2)'}`, borderRadius: '0.5rem', color: showBalanceLegend ? GRUEN : '#9ca3af', padding: '0.3rem 0.75rem', fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  ℹ️ Legende
                </button>
              </div>
              {showBalanceLegend && (
                <div style={{ ...styles.card, marginBottom: '1rem', padding: '1rem', fontSize: '0.8rem', lineHeight: '1.8' }}>
                  <div style={{ fontWeight: '600', color: GRUEN, marginBottom: '0.5rem' }}>⚖️ Ø Stärke = OVR pro Spieler</div>
                  <div style={{ color: '#9ca3af', marginBottom: '0.75rem' }}>Jeder Spieler wird dem Team zugewiesen das die geringste Gesamtabweichung in allen 4 Dimensionen erzeugt: Sturm, Mittelfeld, Abwehr und OVR werden <span style={{ color: 'white' }}>separat</span> ausbalanciert. So landen nicht alle Stürmer im selben Team.</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <span style={{ color: GELB, fontWeight: '600', minWidth: '30px' }}>STR</span>
                      <span style={{ color: '#9ca3af' }}>Technik — Ø Sturm / MF / Abwehr · 60%</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <span style={{ color: GRUEN, fontWeight: '600', minWidth: '30px' }}>ERF</span>
                      <span style={{ color: '#9ca3af' }}>Erfolg — Siegquote × 10 · 25%</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <span style={{ color: BLAU, fontWeight: '600', minWidth: '30px' }}>EFF</span>
                      <span style={{ color: '#9ca3af' }}>Effizienz — Tore/Spiel × 5 · 15%</span>
                    </div>
                  </div>
                  <div style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(16,185,129,0.15)', paddingTop: '0.75rem', color: '#9ca3af' }}>
                    Balance % = kleinerer OVR ÷ größerer OVR × 100
                  </div>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ ...styles.card, padding: '1rem' }}>
                  <div style={{ color: GELB, fontWeight: '700', marginBottom: '0.75rem', fontSize: '1rem' }}>🟡 GELB</div>
                  {spieltagTeams.team1.players.map((p) => (
                    <div key={p.name} style={{ fontSize: '0.9rem', padding: '0.3rem 0', color: 'white', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{p.name}</div>
                  ))}
                  <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.75rem' }}>Ø Stärke: <span style={{ color: GELB, fontWeight: '600' }}>{avg1.toFixed(1)}</span></div>
                </div>
                <div style={{ ...styles.card, padding: '1rem' }}>
                  <div style={{ color: BLAU, fontWeight: '700', marginBottom: '0.75rem', fontSize: '1rem' }}>🔵 BLAU</div>
                  {spieltagTeams.team2.players.map((p) => (
                    <div key={p.name} style={{ fontSize: '0.9rem', padding: '0.3rem 0', color: 'white', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{p.name}</div>
                  ))}
                  <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.75rem' }}>Ø Stärke: <span style={{ color: BLAU, fontWeight: '600' }}>{avg2.toFixed(1)}</span></div>
                </div>
              </div>
              <div style={{ ...styles.card, padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: balColor, marginBottom: '0.5rem' }}>⚖️ {bal}% ausgeglichen</div>
                <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '999px', height: '10px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${bal}%`, background: balColor, borderRadius: '999px' }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === 'ergebnisse') {
    return (
      <div style={styles.container}>
        <TopNav />
        <div style={styles.content}>
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>📋 Spielergebnisse</h2>
            {games.length === 0 ? (
              <div style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>Noch keine Spiele erfasst</div>
            ) : games.map((game) => {
              const gPlayers = gamePlayers.filter((gp) => gp.game_id === game.game_id);
              const gGoals = goals.filter((g) => g.game_id === game.game_id);
              const gSwaps = gameSwaps.filter((s) => s.game_id === game.game_id);
              const swapSet = new Set(gSwaps.map((s) => s.player_name));

              const team1Players = gPlayers.filter((gp) => gp.team === game.team1).map((gp) => gp.player_name);
              const team2Players = gPlayers.filter((gp) => gp.team === game.team2).map((gp) => gp.player_name);

              // Tore aggregieren: { player_name: { team, count } }
              const goalMap = {};
              gGoals.forEach((g) => {
                if (!goalMap[g.player_name]) goalMap[g.player_name] = { team: g.team, count: 0 };
                goalMap[g.player_name].count += 1;
              });
              const scorerList = Object.entries(goalMap).sort((a, b) => b[1].count - a[1].count);

              const isGelbWin = game.score1 > game.score2;
              const isBlauWin = game.score2 > game.score1;

              return (
                <div key={game.id} style={{ ...styles.card, padding: '1rem', marginBottom: '1rem' }}>
                  {/* Datum */}
                  <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '0.75rem' }}>
                    📅 {new Date(game.date).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
                    {isAdminMode && (
                      <span style={{ marginLeft: '0.75rem' }}>
                        <button onClick={() => startEditGame(game)} style={{ background: 'none', border: 'none', color: BLAU, cursor: 'pointer', fontSize: '0.85rem', padding: '0 0.25rem' }}>✏️</button>
                        <button onClick={() => deleteGame(game.id, game.game_id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem', padding: '0 0.25rem' }}>🗑️</button>
                      </span>
                    )}
                  </div>

                  {/* Ergebnis */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <span style={{ color: GELB, fontWeight: isGelbWin ? '700' : '400', fontSize: '0.95rem' }}>🟡 GELB</span>
                    <span style={{ fontSize: '1.75rem', fontWeight: 'bold', color: GRUEN, letterSpacing: '0.05em' }}>{game.score1} : {game.score2}</span>
                    <span style={{ color: BLAU, fontWeight: isBlauWin ? '700' : '400', fontSize: '0.95rem' }}>BLAU 🔵</span>
                  </div>

                  {/* Aufstellung */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: gGoals.length > 0 ? '1rem' : 0 }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: GELB, fontWeight: '600', marginBottom: '0.35rem' }}>Aufstellung</div>
                      {team1Players.map((name) => (
                        <div key={name} style={{ fontSize: '0.8rem', color: swapSet.has(name) ? GELB : '#d1d5db', padding: '0.1rem 0' }}>
                          {swapSet.has(name) ? '🔄 ' : ''}{name}
                        </div>
                      ))}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: BLAU, fontWeight: '600', marginBottom: '0.35rem' }}>Aufstellung</div>
                      {team2Players.map((name) => (
                        <div key={name} style={{ fontSize: '0.8rem', color: swapSet.has(name) ? GELB : '#d1d5db', padding: '0.1rem 0' }}>
                          {swapSet.has(name) ? '🔄 ' : ''}{name}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Torschützen */}
                  {scorerList.length > 0 && (
                    <div style={{ borderTop: '1px solid rgba(16,185,129,0.15)', paddingTop: '0.75rem' }}>
                      <div style={{ fontSize: '0.75rem', color: GRUEN, fontWeight: '600', marginBottom: '0.35rem' }}>⚽ Torschützen</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {scorerList.map(([name, { team, count }]) => (
                          <span key={name} style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem', borderRadius: '999px', background: team === game.team1 ? 'rgba(251,191,36,0.15)' : 'rgba(59,130,246,0.15)', color: team === game.team1 ? GELB : BLAU, border: `1px solid ${team === game.team1 ? 'rgba(251,191,36,0.3)' : 'rgba(59,130,246,0.3)'}` }}>
                            {name}{count > 1 ? ` ×${count}` : ''}{swapSet.has(name) ? ' 🔄' : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'stats') {
    return (
      <div style={styles.container}>
        <TopNav />
        <div style={styles.content}>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
            <button
              onClick={() => setShowStatsLegend((v) => !v)}
              style={{ background: 'none', border: `1px solid ${showStatsLegend ? GRUEN : 'rgba(255,255,255,0.2)'}`, borderRadius: '0.5rem', color: showStatsLegend ? GRUEN : '#9ca3af', padding: '0.3rem 0.75rem', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              ℹ️ Legende
            </button>
          </div>

          {showStatsLegend && (
            <div style={{ ...styles.card, marginBottom: '1rem', padding: '1rem', fontSize: '0.8rem', lineHeight: '1.8' }}>
              <div style={{ fontWeight: '600', color: GRUEN, marginBottom: '0.5rem' }}>🏆 Punkte & Erfolg</div>
              <div><span style={{ color: 'white', fontWeight: '600' }}>Pkte</span> <span style={{ color: '#9ca3af' }}>= Punkte (Sieg=3, Unentschieden=1, Niederlage=0)</span></div>
              <div><span style={{ color: 'white', fontWeight: '600' }}>Ø</span> <span style={{ color: '#9ca3af' }}>= Ø Punkte pro Spiel</span></div>
              <div><span style={{ color: 'white', fontWeight: '600' }}>W%</span> <span style={{ color: '#9ca3af' }}>= Siegquote (nur normale Spiele)</span></div>
              <div><span style={{ color: 'white', fontWeight: '600' }}>T:G</span> <span style={{ color: '#9ca3af' }}>= Team-Tore : Team-Gegentore (wenn dieser Spieler dabei ist)</span></div>
              <div><span style={{ color: GELB, fontWeight: '600' }}>T</span> <span style={{ color: '#9ca3af' }}>= Tauschspieler-Einsätze (immer 1,5 Pkte)</span></div>
              <div style={{ fontWeight: '600', color: GRUEN, marginTop: '0.75rem', marginBottom: '0.5rem' }}>📅 Anwesenheit & Form</div>
              <div><span style={{ color: 'white', fontWeight: '600' }}>Spiele</span> <span style={{ color: '#9ca3af' }}>= gespielte / Gesamtspiele</span></div>
              <div><span style={{ color: 'white', fontWeight: '600' }}>%</span> <span style={{ color: '#9ca3af' }}>= Anwesenheitsquote</span></div>
              <div><span style={{ color: 'white', fontWeight: '600' }}>🔥</span> <span style={{ color: '#9ca3af' }}>= aktuelle Anwesenheits-Streak</span></div>
              <div><span style={{ color: 'white', fontWeight: '600' }}>⭐</span> <span style={{ color: '#9ca3af' }}>= persönliche Beststreak (Anwesenheit)</span></div>
              <div><span style={{ color: 'white', fontWeight: '600' }}>⚡</span> <span style={{ color: '#9ca3af' }}>= aktuelle Siegesserie</span></div>
              <div><span style={{ color: 'white', fontWeight: '600' }}>🏆</span> <span style={{ color: '#9ca3af' }}>= persönliche Beststreak (Siege)</span></div>
              <div style={{ fontWeight: '600', color: GRUEN, marginTop: '0.75rem', marginBottom: '0.5rem' }}>⚽ Tore & Effizienz</div>
              <div><span style={{ color: 'white', fontWeight: '600' }}>Tore</span> <span style={{ color: '#9ca3af' }}>= persönlich geschossene Tore</span></div>
              <div><span style={{ color: 'white', fontWeight: '600' }}>Ø/Spiel</span> <span style={{ color: '#9ca3af' }}>= Ø Tore pro Spiel</span></div>
            </div>
          )}

          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>🏆 Punkte & Erfolg</h2>
            <div style={styles.card}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${GRUEN}` }}>
                      <th style={{ textAlign: 'left', padding: '0.4rem', fontWeight: '600' }}>Spieler</th>
                      <th style={{ textAlign: 'center', padding: '0.4rem', fontWeight: '600' }}>Pkte</th>
                      <th style={{ textAlign: 'center', padding: '0.4rem', fontWeight: '600' }}>Ø</th>
                      <th style={{ textAlign: 'center', padding: '0.4rem', fontWeight: '600' }}>W%</th>
                      <th style={{ textAlign: 'center', padding: '0.4rem', fontWeight: '600' }}>T:G</th>
                      <th style={{ textAlign: 'center', padding: '0.4rem', fontWeight: '600' }}>T</th>
                    </tr>
                  </thead>
                  <tbody>
                    {playerStats.map((stat, idx) => {
                      const hasNormalGames = (stat.games_played - stat.swaps) > 0;
                      return (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(16,185,129,0.1)' }}>
                        <td style={{ textAlign: 'left', padding: '0.4rem' }}>
                          {stat.player_name.substring(0, 10)}
                          {admins.some((a) => a.player_name === stat.player_name) && '👑'}
                        </td>
                        <td style={{ textAlign: 'center', padding: '0.4rem', color: GRUEN, fontWeight: '600' }}>{stat.points}</td>
                        <td style={{ textAlign: 'center', padding: '0.4rem' }}>{stat.games_played > 0 ? (stat.points / stat.games_played).toFixed(2) : '0.00'}</td>
                        <td style={{ textAlign: 'center', padding: '0.4rem' }}>{hasNormalGames ? ((stat.wins / (stat.games_played - stat.swaps)) * 100).toFixed(0) : '0'}%</td>
                        <td style={{ textAlign: 'center', padding: '0.4rem' }}>{hasNormalGames ? `${stat.goals_for}:${stat.goals_against}` : '—'}</td>
                        <td style={{ textAlign: 'center', padding: '0.4rem', color: stat.swaps > 0 ? GELB : '#6b7280' }}>{stat.swaps > 0 ? stat.swaps : '—'}</td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>📅 Anwesenheit & Form</h2>
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
                        <th style={{ textAlign: 'center', padding: '0.4rem', fontWeight: '600' }}>⚡</th>
                        <th style={{ textAlign: 'center', padding: '0.4rem', fontWeight: '600' }}>🏆</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...playerStats].sort((a, b) => parseFloat((extendedStats[b.player_name] || {}).attendance || 0) - parseFloat((extendedStats[a.player_name] || {}).attendance || 0)).map((stat, idx) => {
                        const ext = extendedStats[stat.player_name] || {};
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(16,185,129,0.1)' }}>
                            <td style={{ textAlign: 'left', padding: '0.4rem' }}>{stat.player_name.substring(0, 10)}</td>
                            <td style={{ textAlign: 'center', padding: '0.4rem' }}>{ext.playedGames}/{(ext.playedGames || 0) + (ext.missedGames || 0)}</td>
                            <td style={{ textAlign: 'center', padding: '0.4rem', color: GRUEN, fontWeight: '600' }}>{ext.attendance}</td>
                            <td style={{ textAlign: 'center', padding: '0.4rem' }}>{ext.currentStreak}</td>
                            <td style={{ textAlign: 'center', padding: '0.4rem' }}>{ext.maxStreak}</td>
                            <td style={{ textAlign: 'center', padding: '0.4rem', color: ext.currentWinStreak > 0 ? GRUEN : '#6b7280', fontWeight: ext.currentWinStreak > 0 ? '600' : 'normal' }}>{ext.currentWinStreak > 0 ? ext.currentWinStreak : '—'}</td>
                            <td style={{ textAlign: 'center', padding: '0.4rem', color: ext.maxWinStreak > 0 ? GELB : '#6b7280' }}>{ext.maxWinStreak > 0 ? ext.maxWinStreak : '—'}</td>
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
                    </tr>
                  </thead>
                  <tbody>
                    {[...playerStats].sort((a, b) => {
                      const goalsA = (topScorers.find((s) => s.player_name === a.player_name) || {}).total_goals || 0;
                      const goalsB = (topScorers.find((s) => s.player_name === b.player_name) || {}).total_goals || 0;
                      if (goalsB !== goalsA) return goalsB - goalsA;
                      return (parseFloat(getGoalsPerGame(b.player_name)) || 0) - (parseFloat(getGoalsPerGame(a.player_name)) || 0);
                    }).map((stat, idx) => {
                      const indGoals = (topScorers.find((s) => s.player_name === stat.player_name) || {}).total_goals || 0;
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(16,185,129,0.1)' }}>
                          <td style={{ textAlign: 'left', padding: '0.4rem' }}>{stat.player_name.substring(0, 10)}</td>
                          <td style={{ textAlign: 'center', padding: '0.4rem', color: GRUEN, fontWeight: '600' }}>{indGoals > 0 ? indGoals : '—'}</td>
                          <td style={{ textAlign: 'center', padding: '0.4rem' }}>{getGoalsPerGame(stat.player_name)}</td>
                        </tr>
                      );
                    })}
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
              {topScorers.length > 0 ? topScorers.map((scorer, idx) => {
                const stat = playerStats.find((s) => s.player_name === scorer.player_name);
                const normalGames = stat ? stat.games_played - stat.swaps : 0;
                const avg = normalGames > 0 ? (scorer.total_goals / normalGames).toFixed(2) : '—';
                return (
                  <div key={idx} style={{ ...styles.statRow, alignItems: 'center' }}>
                    <div><span style={{ marginRight: '0.75rem' }}>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`}</span>{scorer.player_name}</div>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{avg}/Spiel</span>
                      <span style={styles.statValue}>{scorer.total_goals} ⚽</span>
                    </div>
                  </div>
                );
              }) : <div style={{ color: '#6b7280', textAlign: 'center', padding: '1rem' }}>Keine Tore erfasst</div>}
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
                      <div>⚽ {pairing.team1Goals}</div>
                      <div>U: {pairing.draws}</div>
                      <div>⚽ {pairing.team2Goals}</div>
                    </div>
                  </div>
                );
              }) : <div style={{ color: '#6b7280', textAlign: 'center', padding: '1rem' }}>Keine Daten vorhanden</div>}
            </div>
          </div>

          <div style={styles.section}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: `2px solid ${GRUEN}` }}>
              <h2 style={{ ...styles.sectionTitle, marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>🎮 Spielerbewertung</h2>
              <button
                onClick={() => setShowStatsLegend((v) => !v)}
                style={{ background: 'none', border: `1px solid ${showStatsLegend ? GRUEN : 'rgba(255,255,255,0.2)'}`, borderRadius: '0.5rem', color: showStatsLegend ? GRUEN : '#9ca3af', padding: '0.3rem 0.75rem', fontSize: '0.85rem', cursor: 'pointer' }}
              >
                ℹ️ Legende
              </button>
            </div>
            {showStatsLegend && (
              <div style={{ ...styles.card, marginBottom: '1rem', padding: '1rem', fontSize: '0.8rem', lineHeight: '1.8' }}>
                <div style={{ fontWeight: '600', color: GRUEN, marginBottom: '0.5rem' }}>🎮 OVR — Gesamt-Rating (0–10)</div>
                <div style={{ color: '#9ca3af', marginBottom: '0.75rem' }}>Gewichteter Schnitt aus den 3 Werten unten. Bei weniger als 3 normalen Spielen zählt nur STR.</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: GELB, fontWeight: '600', minWidth: '30px' }}>STR</span>
                    <span style={{ color: '#9ca3af' }}>Technik — Ø aus Sturm / Mittelfeld / Abwehr (60%)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: GRUEN, fontWeight: '600', minWidth: '30px' }}>ERF</span>
                    <span style={{ color: '#9ca3af' }}>Erfolg — Siegquote (Siege ÷ normale Spiele × 10) (25%)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: BLAU, fontWeight: '600', minWidth: '30px' }}>EFF</span>
                    <span style={{ color: '#9ca3af' }}>Effizienz — Tore pro Spiel (×5, max 10) (15%)</span>
                  </div>
                </div>
                <div style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(16,185,129,0.15)', paddingTop: '0.75rem', color: '#9ca3af' }}>
                  OVR-Farbe: <span style={{ color: GRUEN }}>● ≥8.0</span> stark · <span style={{ color: GELB }}>● ≥6.0</span> mittel · <span style={{ color: '#ef4444' }}>● &lt;6.0</span> schwach
                </div>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {playerStats.map((stat) => {
                const pos = getPlayerPositions(stat.player_name);
                const str = parseFloat(((pos.sturm + pos.mittelfeld + pos.abwehr) / 3).toFixed(1));
                const normalGames = stat.games_played - stat.swaps;
                const scorer = topScorers.find((s) => s.player_name === stat.player_name);
                const goals = scorer ? scorer.total_goals : 0;
                const hasData = normalGames >= 3;
                const erf = hasData ? parseFloat(Math.min((stat.wins / normalGames) * 10, 10).toFixed(1)) : null;
                const eff = hasData ? parseFloat(Math.min((goals / normalGames) * 5, 10).toFixed(1)) : null;
                const ovr = getOVR(stat.player_name);
                const ovrColor = ovr >= 8 ? GRUEN : ovr >= 6 ? GELB : '#ef4444';
                const StatBar = ({ label, value, color }) => (
                  <div style={{ marginBottom: '0.35rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#9ca3af', marginBottom: '0.15rem' }}>
                      <span>{label}</span><span style={{ color, fontWeight: '600' }}>{value !== null ? value.toFixed(1) : '—'}</span>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '999px', height: '5px' }}>
                      <div style={{ height: '100%', width: value !== null ? `${(value / 10) * 100}%` : '0%', background: color, borderRadius: '999px' }} />
                    </div>
                  </div>
                );
                return (
                  <div key={stat.player_name} style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid rgba(16,185,129,0.15)`, borderRadius: '10px', padding: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'white' }}>
                        {stat.player_name.substring(0, 10)}{admins.some((a) => a.player_name === stat.player_name) && '👑'}
                      </span>
                      <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: ovrColor }}>{ovr.toFixed(1)}</span>
                    </div>
                    <StatBar label="STR Technik" value={str} color={GELB} />
                    <StatBar label="ERF Erfolg" value={erf} color={GRUEN} />
                    <StatBar label="EFF Effizienz" value={eff} color={BLAU} />
                    {!hasData && <div style={{ fontSize: '0.6rem', color: '#6b7280', marginTop: '0.35rem' }}>* &lt;3 Spiele — nur STR</div>}
                  </div>
                );
              })}
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
    // Tauschspieler erscheinen in beiden Torschützen-Sektionen
    const gelbScorers = [
      ...formData.players1,
      ...formData.swappedPlayers.filter((p) => formData.players2.includes(p)),
    ];
    const blauScorers = [
      ...formData.players2,
      ...formData.swappedPlayers.filter((p) => formData.players1.includes(p)),
    ];
    const allGamePlayers = [
      ...formData.players1.map((p) => ({ name: p, team: 'Gelb' })),
      ...formData.players2.map((p) => ({ name: p, team: 'Blau' })),
    ];

    const calcTeamStrength = (playerNames) => {
      if (playerNames.length === 0) return null;
      const totals = { sturm: 0, mittelfeld: 0, abwehr: 0 };
      let ovrTotal = 0;
      playerNames.forEach((name) => {
        const pos = getPlayerPositions(name);
        totals.sturm += pos.sturm;
        totals.mittelfeld += pos.mittelfeld;
        totals.abwehr += pos.abwehr;
        ovrTotal += getOVR(name);
      });
      const n = playerNames.length;
      return {
        sturm: totals.sturm / n,
        mittelfeld: totals.mittelfeld / n,
        abwehr: totals.abwehr / n,
        gesamt: ovrTotal / n,
      };
    };
    const stärkeGelb = calcTeamStrength(formData.players1);
    const stärkeBlau = calcTeamStrength(formData.players2);
    const balancePct = stärkeGelb && stärkeBlau
      ? Math.round((Math.min(stärkeGelb.gesamt, stärkeBlau.gesamt) / Math.max(stärkeGelb.gesamt, stärkeBlau.gesamt)) * 100)
      : null;
    const balanceColor = balancePct >= 90 ? GRUEN : balancePct >= 75 ? GELB : '#ef4444';

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

            {/* ─── TEAM BALANCE ──────────────────────────────────────────── */}
            {stärkeGelb && stärkeBlau && (
              <div style={styles.section}>
                <h2 style={styles.sectionTitle}>⚖️ Team Balance</h2>
                <div style={{ ...styles.card, padding: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 1fr', gap: '0.5rem', textAlign: 'center', marginBottom: '0.75rem' }}>
                    <div style={{ color: GELB, fontWeight: '600', fontSize: '0.9rem' }}>GELB ({formData.players1.length})</div>
                    <div />
                    <div style={{ color: BLAU, fontWeight: '600', fontSize: '0.9rem' }}>BLAU ({formData.players2.length})</div>
                  </div>
                  {[
                    { label: '⚡ Sturm', g: stärkeGelb.sturm, b: stärkeBlau.sturm },
                    { label: '🔄 Mittelfeld', g: stärkeGelb.mittelfeld, b: stärkeBlau.mittelfeld },
                    { label: '🛡️ Abwehr', g: stärkeGelb.abwehr, b: stärkeBlau.abwehr },
                  ].map(({ label, g, b }) => (
                    <div key={label} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 1fr', gap: '0.5rem', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <div style={{ textAlign: 'right', fontWeight: '600', color: GELB }}>{g.toFixed(1)}</div>
                      <div style={{ fontSize: '0.72rem', color: '#9ca3af', textAlign: 'center' }}>{label}</div>
                      <div style={{ textAlign: 'left', fontWeight: '600', color: BLAU }}>{b.toFixed(1)}</div>
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid rgba(16,185,129,0.2)', margin: '0.75rem 0' }} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 1fr', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div style={{ textAlign: 'right', fontSize: '1.25rem', fontWeight: 'bold', color: GELB }}>{stärkeGelb.gesamt.toFixed(1)}</div>
                    <div style={{ fontSize: '0.72rem', color: '#9ca3af', textAlign: 'center' }}>Gesamt</div>
                    <div style={{ textAlign: 'left', fontSize: '1.25rem', fontWeight: 'bold', color: BLAU }}>{stärkeBlau.gesamt.toFixed(1)}</div>
                  </div>
                  <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: balanceColor }}>{balancePct}% ausgeglichen</span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '999px', height: '8px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${balancePct}%`, background: balanceColor, borderRadius: '999px' }} />
                  </div>
                </div>
              </div>
            )}

            {/* ─── SPIELERTAUSCH ─────────────────────────────────────────── */}
            <div style={styles.section}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.9rem', color: GRUEN }}>🔄 Spielertausch</label>
                <button
                  type="button"
                  onClick={() => setFormData((fd) => ({ ...fd, swapsEnabled: !fd.swapsEnabled, swappedPlayers: [] }))}
                  style={{
                    padding: '0.4rem 1.1rem', border: 'none', borderRadius: '6px',
                    cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem',
                    background: formData.swapsEnabled ? GRUEN : 'rgba(255,255,255,0.1)',
                    color: '#fff',
                  }}
                >
                  {formData.swapsEnabled ? 'JA' : 'NEIN'}
                </button>
              </div>

              {formData.swapsEnabled && allGamePlayers.length > 0 && (
                <div style={{ ...styles.card, padding: '0.75rem' }}>
                  <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '0.75rem' }}>
                    Spieler auswählen die das Team gewechselt haben:
                  </div>
                  {allGamePlayers.map(({ name, team }) => {
                    const isSwapped = formData.swappedPlayers.includes(name);
                    return (
                      <div
                        key={name}
                        style={{ ...styles.checkbox, ...(isSwapped ? styles.checkboxChecked : {}) }}
                        onClick={() => setFormData((fd) => ({
                          ...fd,
                          swappedPlayers: isSwapped
                            ? fd.swappedPlayers.filter((p) => p !== name)
                            : [...fd.swappedPlayers, name],
                        }))}
                      >
                        <input type="checkbox" checked={isSwapped} onChange={() => {}} style={{ marginRight: '0.75rem', width: '18px', height: '18px', cursor: 'pointer' }} />
                        <span>{name} {team === 'Gelb' ? '🟡' : '🔵'}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ─── TORSCHÜTZEN ───────────────────────────────────────────── */}
            <div style={styles.section}>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color: GRUEN }}>⚽ Torschützen ({formData.goals.length})</label>

              {gelbScorers.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.85rem', color: GELB, marginBottom: '0.5rem', fontWeight: '600' }}>GELB:</div>
                  <div style={{ ...styles.card, padding: '0.75rem' }}>
                    {gelbScorers.map((p) => (
                      <button key={p} type="button" onClick={() => addGoal(p, 'Gelb')}
                        style={{ ...styles.button, ...styles.buttonSecondary, marginBottom: '0.5rem', fontSize: '0.9rem', padding: '0.5rem' }}>
                        ➕ {p}{formData.swappedPlayers.includes(p) ? ' 🔄' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {blauScorers.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.85rem', color: BLAU, marginBottom: '0.5rem', fontWeight: '600' }}>BLAU:</div>
                  <div style={{ ...styles.card, padding: '0.75rem' }}>
                    {blauScorers.map((p) => (
                      <button key={p} type="button" onClick={() => addGoal(p, 'Blau')}
                        style={{ ...styles.button, ...styles.buttonSecondary, marginBottom: '0.5rem', fontSize: '0.9rem', padding: '0.5rem' }}>
                        ➕ {p}{formData.swappedPlayers.includes(p) ? ' 🔄' : ''}
                      </button>
                    ))}
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
              <button style={{ ...styles.button, ...styles.buttonSecondary }} onClick={handleExportGames}>
                📋 Spiele exportieren (CSV)
              </button>
              <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '1rem' }}>
                Alle Spiele inkl. Spieler & Torschützen — Round-Trip-kompatibel
              </div>
              <button style={{ ...styles.button, ...styles.buttonSecondary }} onClick={handleExportStats}>
                📊 Statistiken exportieren (CSV)
              </button>
              <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '1rem' }}>
                Punkte, Tore, Siegquote — für Excel
              </div>
              <button style={{ ...styles.button, ...styles.buttonSecondary }} onClick={handleExportHTML}>
                🖥️ Saison-Präsentation (HTML)
              </button>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                Alle Stats als Slide-Show — standalone, kein Internet nötig
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
                  const blob = new Blob(['﻿' + template], { type: 'text/csv;charset=utf-8;' });
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
                  <label style={{ display: 'block', fontSize: '0.9rem', color: '#10b981', marginBottom: '0.5rem' }}>CSV-Datei auswählen</label>
                  <input type="file" accept=".csv" onChange={handleCSVFile} style={{ ...styles.input, cursor: 'pointer' }} />
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
                  <button style={{ ...styles.button, ...styles.buttonSecondary }} onClick={() => setCsvState({ status: 'idle', valid: [], warnings: [], errors: [], progress: 0, total: 0 })}>
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
                      backgroundColor: '#10b981', height: '100%',
                      width: `${csvState.total > 0 ? (csvState.progress / csvState.total) * 100 : 0}%`,
                      transition: 'width 0.3s ease', borderRadius: '8px',
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
                  <button style={{ ...styles.button, ...styles.buttonSecondary }} onClick={() => setCsvState({ status: 'idle', valid: [], warnings: [], errors: [], progress: 0, total: 0 })}>
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
