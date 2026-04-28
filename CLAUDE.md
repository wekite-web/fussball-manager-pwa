# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Dev-Server starten (http://localhost:5173, HMR aktiv)
npm run build    # Produktions-Build nach dist/
npm run preview  # Build lokal voransehen
```

Kein Test-Runner, kein Linter konfiguriert.

## Architektur

**React SPA + Supabase + Vite PWA.** Keine Routing-Library — View-Wechsel über `useState('home')` in `App.jsx`. Keine CSS-Frameworks — alle Styles als Inline-Objekt `styles` innerhalb der Komponente, das auf die Farb-Konstanten `GELB / BLAU / GRUEN` referenziert.

### Datei-Übersicht

| Datei | Zweck |
|---|---|
| `src/App.jsx` | Gesamte App: State, Supabase-Calls, Styles, alle Views |
| `src/csvUtils.js` | CSV Import/Export Modul — in App.jsx importiert |
| `src/csv_ui_snippet.jsx` | Nicht verwendetes UI-Snippet (toter Code) |
| `dist/sw.js` | Service Worker (Cache-First-Strategie) |
| `public/manifest.json` | PWA-Manifest (Theme: #10b981, Sprache: de-DE) |

### Views in App.jsx

Jede View ist ein eigener `if (view === '...') return (...)` Block am Ende der Komponente.

| View | Inhalt |
|---|---|
| `home` | Dashboard: Quick Stats (Führende), letztes Spiel, Admin-Aktionen, Team-Generator |
| `spieltag` | Wer ist heute dabei? — Spieler anhaken → Teams mit Balance-% generieren |
| `ergebnisse` | Vollständige Spielliste mit Aufstellung, Torschützen, Tauschspieler-Markierung |
| `stats` | Spieler-Tabelle (Punkte, S/U/N, T/G, Tordifferenz, Anwesenheit, Streaks) |
| `scorers` | Torschützen-Rangliste |
| `statspro` | Mannschafts-Bilanz Kopf-an-Kopf + Spielerbewertungs-Karten (OVR) |
| `players` | Spieler verwalten (hinzufügen, umbenennen, löschen, Positionen setzen) |
| `newgame` | Spiel erfassen / bearbeiten (Edit: alle Felder vorbelegt, vollständiger Überschreib-Save) |
| `csv` | CSV Import/Export UI |

### Navigation

`TopNav` ist ein zweigeteiltes, `position: fixed` Element:
- **Zeile 1 (Header):** `<<` Back-Button + Titel "⚽ Manager" + Admin-Toggle (🔓/🔐), immer sichtbar
- **Zeile 2 (Tab-Nav):** 6 Tabs — Home / Tag / Spiele / Stats / Tore / Pro — Tab-Stil mit grünem Unterstrich
- `container.paddingTop: '108px'` gleicht die Höhe beider Zeilen aus

**Admin-Modus:** PW-geschützt via hardcoded `ADMIN_PASSWORD` in `App.jsx`. Kein User-basiertes Rollen-System — wer das PW kennt, bekommt Admin-Zugriff (`isAdminMode` State). Unabhängig von der `admins`-Tabelle.

### Supabase-Tabellen

Die App liest **nur Rohdaten** — alle Statistiken werden zur Laufzeit via `useMemo` aus diesen Tabellen berechnet:

| Tabelle | Inhalt |
|---|---|
| `players` | Spieler-Register (`id`, `name`) |
| `player_positions` | Positions-Bewertungen (`position_sturm`, `position_mittelfeld`, `position_abwehr`, Skala 1–10) |
| `games` | Spiel-Datensätze (`id` PK numerisch, `game_id` String `game_<timestamp>`, `date`, `team1`, `team2`, `score1`, `score2`) |
| `game_results` | Duplikat des Ergebnisses (für Abfragen mit `winner`-Feld) |
| `game_players` | Spieler pro Spiel (`game_id`, `player_name`, `team`) |
| `goals` | Einzeltore (`game_id`, `player_name`, `team`) |
| `game_swaps` | Tauschspieler pro Spiel (`game_id`, `player_name`) — Spieler die das Team gewechselt haben; bekommen immer 1,5 Punkte |
| `admins` | Spieler die mit 👑 in der Tabelle und Spielerverwaltung angezeigt werden (z.B. Organisatoren) — kein Zusammenhang mit dem Admin-Modus |

**Wichtig:** `game_id` (String) und `id` (numerischer PK) sind unterschiedliche Felder. Beim Löschen braucht `games` den numerischen `id`, alle anderen Tabellen den String `game_id`.

### Stats-Berechnung (live, kein Backend-Aggregat)

Alle Stats werden ausschließlich client-seitig via `useMemo` berechnet — keine denormalisierten Aggregat-Tabellen:

- **`playerStats`** — iteriert `gamePlayers` × `games` × `gameSwaps`. Tauschspieler bekommen immer 1,5 Punkte und zählen separat (`swaps`-Zähler), kein W/U/N.
- **`topScorers`** — zählt Einträge in `goals` pro Spieler.
- **`teamBilanz`** — aggregiert Kopf-an-Kopf-Ergebnisse aus `games`.
- **`extendedStats`** — berechnet Anwesenheit, aktuelle Streak und Max-Streak pro Spieler aus `gamePlayers`.
- `getGoalsPerGame` dividiert Tore durch `games_played - swaps` (Swap-Spiele ausgenommen).
- `getOVR` berechnet Gesamt-Rating: STR (Positions-Ø) 60% + ERF (Win Rate ×10) 25% + EFF (Tore/Spiel ×5) 15%. Fallback auf reinen STR wenn `normalGames < 3`. Wird für Team-Generierung und Balance-Anzeige verwendet.

### Performance-Muster

- `teamBilanz` und `extendedStats` als `useMemo` — Abhängigkeiten: `games`, `playerStats`, `gamePlayers`
- `gamePlayers` wird einmalig als State geladen (`loadGamePlayers()`), nicht per Render von Supabase abgefragt
- `getPlayerPositions` und `getGoalsPerGame` als `useCallback` mit Abhängigkeiten

### Spielpunkt-Logik

Punkte: Sieg=3, Unentschieden=1, Niederlage=0. Tauschspieler: immer 1,5, unabhängig vom Ergebnis. Bei Spielbearbeitung werden alle Felder vorbelegt (Spieler, Tore, Swaps aus State). Beim Speichern werden `game_players`, `goals` und `game_swaps` gelöscht und neu geschrieben (delete + insert).

### CSV-Modul (`csvUtils.js`)

Eigene Supabase-Instanz, schreibt identisch zu `handleNewGame()`. CSV-Format:
```
datum,gelb_spieler,gelb_tore,blau_spieler,blau_tore,torschuetzen,tausch_spieler
2026-01-15,Max|Anna|Tom,3,Ben|Lisa|Kai,2,Max|Anna,Tom
```
Spieler-Trennzeichen: `|`. Datum: `YYYY-MM-DD`. `tausch_spieler` ist optional (Rückwärtskompatibilität). Unterstützt `,` und `;` als CSV-Delimiter (Excel-DE kompatibel). BOM-Prefix beim Export für korrekte Umlaut-Darstellung in Excel.
