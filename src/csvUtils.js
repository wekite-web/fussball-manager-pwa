/**
 * csvUtils.js — Fußball-Manager PWA v16
 * CSV Import & Export Modul
 *
 * Usage in App.jsx:
 *   import { parseCSV, validateCSV, importGames, exportGamesCSV, exportStatsCSV } from './csvUtils';
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://sdtgwkvmqprbwvtkswxd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_iCVXxm3VuPQIHEvWkkqqPw_1jCVn0QO';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── KONSTANTEN ────────────────────────────────────────────────────────────────

const CSV_HEADERS = ['datum', 'gelb_spieler', 'gelb_tore', 'blau_spieler', 'blau_tore', 'torschuetzen'];
const PLAYER_SEP = '|';

// ─── PARSE ─────────────────────────────────────────────────────────────────────

/**
 * Liest CSV-Text und gibt ein Array von Roh-Objekten zurück.
 * Unterstützt sowohl , als auch ; als Trennzeichen (Excel-DE).
 *
 * @param {string} text - Roher CSV-Inhalt
 * @returns {{ rows: object[], errors: string[] }}
 */
export function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const errors = [];

  if (lines.length < 2) {
    return { rows: [], errors: ['CSV ist leer oder hat keine Datenzeilen.'] };
  }

  // Trennzeichen automatisch erkennen (, oder ;)
  const sep = lines[0].includes(';') ? ';' : ',';

  const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase());
  const missingHeaders = CSV_HEADERS.filter((h) => !headers.includes(h));
  if (missingHeaders.length > 0) {
    return {
      rows: [],
      errors: [`Fehlende Spalten: ${missingHeaders.join(', ')}`],
    };
  }

  const rows = [];

  lines.slice(1).forEach((line, idx) => {
    const lineNum = idx + 2;
    if (!line.trim()) return; // Leerzeilen überspringen

    const values = line.split(sep).map((v) => v.trim());
    if (values.length < CSV_HEADERS.length) {
      errors.push(`Zeile ${lineNum}: Zu wenige Spalten (${values.length} von ${CSV_HEADERS.length})`);
      return;
    }

    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] || ''; });
    row._lineNum = lineNum;
    rows.push(row);
  });

  return { rows, errors };
}

// ─── VALIDIERUNG ───────────────────────────────────────────────────────────────

/**
 * Validiert alle geparsten Zeilen gegen bekannte Spieler und bestehende Spiele.
 *
 * @param {object[]} rows - Output von parseCSV()
 * @param {string[]} knownPlayers - Alle Spielernamen aus der DB
 * @param {string[]} existingDates - Bereits vorhandene Spieldaten (ISO-Format)
 * @returns {{ valid: object[], warnings: string[], errors: string[] }}
 */
export function validateCSV(rows, knownPlayers, existingDates = []) {
  const valid = [];
  const warnings = [];
  const errors = [];

  const knownSet = new Set(knownPlayers.map((p) => p.toLowerCase()));
  const existingSet = new Set(existingDates);

  rows.forEach((row) => {
    const lineErrors = [];
    const lineWarnings = [];

    // Datum validieren
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(row.datum)) {
      lineErrors.push(`Ungültiges Datum "${row.datum}" (erwartet: YYYY-MM-DD)`);
    } else if (existingSet.has(row.datum)) {
      lineWarnings.push(`Datum ${row.datum} bereits in der DB — wird übersprungen`);
    }

    // Spieler parsen
    const gelbSpieler = row.gelb_spieler.split(PLAYER_SEP).map((p) => p.trim()).filter(Boolean);
    const blauSpieler = row.blau_spieler.split(PLAYER_SEP).map((p) => p.trim()).filter(Boolean);

    if (gelbSpieler.length === 0) lineErrors.push('Keine Gelb-Spieler angegeben');
    if (blauSpieler.length === 0) lineErrors.push('Keine Blau-Spieler angegeben');

    // Unbekannte Spieler prüfen
    const allPlayers = [...gelbSpieler, ...blauSpieler];
    const unknown = allPlayers.filter((p) => !knownSet.has(p.toLowerCase()));
    if (unknown.length > 0) {
      lineErrors.push(`Unbekannte Spieler: ${unknown.join(', ')} — zuerst in der App anlegen`);
    }

    // Score validieren
    const score1 = parseInt(row.gelb_tore);
    const score2 = parseInt(row.blau_tore);
    if (isNaN(score1) || score1 < 0) lineErrors.push(`Ungültige Gelb-Tore: "${row.gelb_tore}"`);
    if (isNaN(score2) || score2 < 0) lineErrors.push(`Ungültige Blau-Tore: "${row.blau_tore}"`);

    // Torschützen validieren (optional)
    const torschuetzen = row.torschuetzen
      ? row.torschuetzen.split(PLAYER_SEP).map((p) => p.trim()).filter(Boolean)
      : [];
    const unknownScorers = torschuetzen.filter(
      (p) => p && !knownSet.has(p.toLowerCase())
    );
    if (unknownScorers.length > 0) {
      lineErrors.push(`Unbekannte Torschützen: ${unknownScorers.join(', ')}`);
    }

    if (lineErrors.length > 0) {
      lineErrors.forEach((e) => errors.push(`Zeile ${row._lineNum}: ${e}`));
    } else if (lineWarnings.length > 0) {
      lineWarnings.forEach((w) => warnings.push(`Zeile ${row._lineNum}: ${w}`));
      // Zeilen mit Datum-Duplikat nicht in valid aufnehmen
    } else {
      valid.push({
        datum: row.datum,
        gelbSpieler,
        blauSpieler,
        score1,
        score2,
        torschuetzen,
        _lineNum: row._lineNum,
      });
    }
  });

  return { valid, warnings, errors };
}

// ─── IMPORT ────────────────────────────────────────────────────────────────────

/**
 * Importiert validierte Spiele in Supabase.
 * Schreibt nur in games, game_results, game_players, goals —
 * player_stats und top_scorers werden nicht mehr benötigt (useMemo in App.jsx).
 *
 * @param {object[]} validRows - Output von validateCSV().valid
 * @param {function} onProgress - Callback(current, total) für Fortschrittsanzeige
 * @returns {{ imported: number, errors: string[] }}
 */
export async function importGames(validRows, onProgress = () => {}) {
  const errors = [];
  let imported = 0;

  for (let i = 0; i < validRows.length; i++) {
    const row = validRows[i];
    onProgress(i + 1, validRows.length);

    try {
      const gameId = `game_${row.datum}_${Date.now()}`;
      const { score1, score2 } = row;
      const winner = score1 > score2 ? 'team1' : score2 > score1 ? 'team2' : 'draw';

      // 1. Spiel anlegen
      await supabase.from('games').insert([{
        game_id: gameId,
        date: row.datum,
        team1: 'Gelb',
        team2: 'Blau',
        score1,
        score2,
      }]);

      // 2. game_result
      await supabase.from('game_results').insert([{
        game_id: gameId,
        team1: 'Gelb',
        team2: 'Blau',
        score1,
        score2,
        winner,
      }]);

      // 3. game_players
      const gamePlayers = [
        ...row.gelbSpieler.map((p) => ({ game_id: gameId, player_name: p, team: 'Gelb' })),
        ...row.blauSpieler.map((p) => ({ game_id: gameId, player_name: p, team: 'Blau' })),
      ];
      if (gamePlayers.length > 0) {
        await supabase.from('game_players').insert(gamePlayers);
      }

      // 4. Torschützen
      if (row.torschuetzen.length > 0) {
        const gelbSet = new Set(row.gelbSpieler.map((p) => p.toLowerCase()));
        const goals = row.torschuetzen.map((p) => ({
          game_id: gameId,
          player_name: p,
          team: gelbSet.has(p.toLowerCase()) ? 'Gelb' : 'Blau',
        }));
        await supabase.from('goals').insert(goals);
      }

      imported++;
    } catch (err) {
      errors.push(`Zeile ${row._lineNum} (${row.datum}): ${err.message}`);
    }
  }

  return { imported, errors };
}

// ─── EXPORT ────────────────────────────────────────────────────────────────────

/**
 * Exportiert alle Spiele als CSV (Round-Trip-kompatibel mit parseCSV).
 * Löst automatisch einen Download aus.
 *
 * @returns {Promise<void>}
 */
export async function exportGamesCSV() {
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .order('date', { ascending: true });

  if (!games || games.length === 0) {
    throw new Error('Keine Spiele zum Exportieren vorhanden.');
  }

  const gameIds = games.map((g) => g.game_id);

  const { data: gamePlayers } = await supabase
    .from('game_players')
    .select('*')
    .in('game_id', gameIds);

  const { data: goals } = await supabase
    .from('goals')
    .select('*')
    .in('game_id', gameIds);

  const gpMap = {};
  const goalsMap = {};

  (gamePlayers || []).forEach((gp) => {
    if (!gpMap[gp.game_id]) gpMap[gp.game_id] = { Gelb: [], Blau: [] };
    gpMap[gp.game_id][gp.team]?.push(gp.player_name);
  });

  (goals || []).forEach((g) => {
    if (!goalsMap[g.game_id]) goalsMap[g.game_id] = [];
    goalsMap[g.game_id].push(g.player_name);
  });

  const rows = [CSV_HEADERS.join(',')];

  games.forEach((game) => {
    const gp = gpMap[game.game_id] || { Gelb: [], Blau: [] };
    const scorers = goalsMap[game.game_id] || [];
    const date = game.date.split('T')[0];

    rows.push([
      date,
      gp.Gelb.join(PLAYER_SEP),
      game.score1,
      gp.Blau.join(PLAYER_SEP),
      game.score2,
      scorers.join(PLAYER_SEP),
    ].join(','));
  });

  _downloadCSV(rows.join('\n'), `spiele_export_${_today()}.csv`);
}

/**
 * Exportiert Spieler-Statistiken als CSV für Excel-Auswertung.
 * Berechnet aus games, game_players und goals — keine player_stats-Tabelle nötig.
 * Löst automatisch einen Download aus.
 *
 * @returns {Promise<void>}
 */
export async function exportStatsCSV() {
  const [{ data: games }, { data: gamePlayers }, { data: goals }, { data: players }] = await Promise.all([
    supabase.from('games').select('*'),
    supabase.from('game_players').select('*'),
    supabase.from('goals').select('*'),
    supabase.from('players').select('*'),
  ]);

  if (!players || players.length === 0) {
    throw new Error('Keine Spieler vorhanden.');
  }

  // Stats aus Quelldaten berechnen
  const statsMap = {};
  players.forEach((p) => {
    statsMap[p.name] = { player_name: p.name, games_played: 0, wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0, points: 0 };
  });

  const gameMap = {};
  (games || []).forEach((g) => { gameMap[g.game_id] = g; });

  (gamePlayers || []).forEach((gp) => {
    const game = gameMap[gp.game_id];
    if (!game || !statsMap[gp.player_name]) return;
    const s = statsMap[gp.player_name];
    const isTeam1 = gp.team === game.team1;
    const goalsFor = isTeam1 ? game.score1 : game.score2;
    const goalsAgainst = isTeam1 ? game.score2 : game.score1;
    const winner = game.score1 > game.score2 ? 'team1' : game.score2 > game.score1 ? 'team2' : 'draw';
    const isWinner = (winner === 'team1' && isTeam1) || (winner === 'team2' && !isTeam1);
    const isDraw = winner === 'draw';
    s.games_played += 1;
    s.wins += isWinner ? 1 : 0;
    s.draws += isDraw ? 1 : 0;
    s.losses += (!isWinner && !isDraw) ? 1 : 0;
    s.goals_for += goalsFor;
    s.goals_against += goalsAgainst;
    s.points += isDraw ? 1 : isWinner ? 3 : 0;
  });

  const scorerMap = {};
  (goals || []).forEach((g) => { scorerMap[g.player_name] = (scorerMap[g.player_name] || 0) + 1; });

  const stats = Object.values(statsMap).sort((a, b) => b.points - a.points);

  const headers = [
    'spieler', 'punkte', 'spiele', 'siege', 'unentschieden',
    'niederlagen', 'tore_geschossen', 'tore_kassiert', 'torschuetzen_tore',
    'siegquote_pct', 'punkte_pro_spiel',
  ];

  const rows = [headers.join(',')];

  stats.forEach((s) => {
    const winPct = s.games_played > 0 ? ((s.wins / s.games_played) * 100).toFixed(1) : '0.0';
    const ppg = s.games_played > 0 ? (s.points / s.games_played).toFixed(2) : '0.00';
    rows.push([
      s.player_name, s.points, s.games_played, s.wins, s.draws, s.losses,
      s.goals_for, s.goals_against, scorerMap[s.player_name] || 0, winPct, ppg,
    ].join(','));
  });

  _downloadCSV(rows.join('\n'), `statistiken_export_${_today()}.csv`);
}

// ─── HILFSFUNKTIONEN ───────────────────────────────────────────────────────────

function _today() {
  return new Date().toISOString().split('T')[0];
}

function _downloadCSV(content, filename) {
  // BOM für korrekte Darstellung in Excel (inkl. Umlaute)
  const bom = '﻿';
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
