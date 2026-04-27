/**
 * csvUtils.js — Fußball-Manager PWA v15
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
 * Verwendet dieselbe Logik wie handleNewGame() in App.jsx.
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
        // Welches Team hat welchen Torschützen? — anhand der Spielerlisten ermitteln
        const gelbSet = new Set(row.gelbSpieler.map((p) => p.toLowerCase()));
        const goals = row.torschuetzen.map((p) => ({
          game_id: gameId,
          player_name: p,
          team: gelbSet.has(p.toLowerCase()) ? 'Gelb' : 'Blau',
        }));
        await supabase.from('goals').insert(goals);

        // top_scorers aktualisieren
        for (const goal of goals) {
          const { data: existing } = await supabase
            .from('top_scorers')
            .select('*')
            .eq('player_name', goal.player_name);
          if (existing && existing.length > 0) {
            await supabase
              .from('top_scorers')
              .update({ total_goals: existing[0].total_goals + 1 })
              .eq('player_name', goal.player_name);
          } else {
            await supabase
              .from('top_scorers')
              .insert([{ player_name: goal.player_name, total_goals: 1 }]);
          }
        }
      }

      // 5. Punkte berechnen + player_stats aktualisieren
      await _applyPoints(gameId, row.gelbSpieler, 'Gelb', winner === 'team1', score1, score2, winner);
      await _applyPoints(gameId, row.blauSpieler, 'Blau', winner === 'team2', score2, score1, winner);

      imported++;
    } catch (err) {
      errors.push(`Zeile ${row._lineNum} (${row.datum}): ${err.message}`);
    }
  }

  return { imported, errors };
}

// Interne Hilfsfunktion — Punkte vergeben (identisch zu App.jsx Logik)
async function _applyPoints(gameId, players, teamName, isWinner, goalsFor, goalsAgainst, winnerStr) {
  const pointsEarned = winnerStr === 'draw' ? 1 : isWinner ? 3 : 0;

  for (const playerName of players) {
    const { data: existing } = await supabase
      .from('player_stats')
      .select('*')
      .eq('player_name', playerName);

    if (existing && existing.length > 0) {
      const s = existing[0];
      await supabase.from('player_stats').update({
        games_played: s.games_played + 1,
        wins: s.wins + (pointsEarned === 3 ? 1 : 0),
        draws: s.draws + (pointsEarned === 1 ? 1 : 0),
        losses: s.losses + (pointsEarned === 0 ? 1 : 0),
        goals_for: s.goals_for + goalsFor,
        goals_against: s.goals_against + goalsAgainst,
        points: s.points + pointsEarned,
        updated_at: new Date().toISOString(),
      }).eq('player_name', playerName);
    }

    await supabase.from('team_points').insert([{
      game_id: gameId,
      player_name: playerName,
      team: teamName,
      points_earned: pointsEarned,
    }]);
  }
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

  // game_players + goals für alle Spiele laden
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
 * Löst automatisch einen Download aus.
 *
 * @returns {Promise<void>}
 */
export async function exportStatsCSV() {
  const { data: stats } = await supabase
    .from('player_stats')
    .select('*')
    .order('points', { ascending: false });

  const { data: scorers } = await supabase
    .from('top_scorers')
    .select('*');

  if (!stats || stats.length === 0) {
    throw new Error('Keine Statistiken zum Exportieren vorhanden.');
  }

  const scorerMap = {};
  (scorers || []).forEach((s) => { scorerMap[s.player_name] = s.total_goals; });

  const headers = [
    'spieler', 'punkte', 'spiele', 'siege', 'unentschieden',
    'niederlagen', 'tore_geschossen', 'tore_kassiert', 'torschuetzen_tore',
    'siegquote_pct', 'punkte_pro_spiel',
  ];

  const rows = [headers.join(',')];

  stats.forEach((s) => {
    const winPct = s.games_played > 0
      ? ((s.wins / s.games_played) * 100).toFixed(1)
      : '0.0';
    const ppg = s.games_played > 0
      ? (s.points / s.games_played).toFixed(2)
      : '0.00';

    rows.push([
      s.player_name,
      s.points,
      s.games_played,
      s.wins,
      s.draws,
      s.losses,
      s.goals_for,
      s.goals_against,
      scorerMap[s.player_name] || 0,
      winPct,
      ppg,
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
  const bom = '\uFEFF';
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
