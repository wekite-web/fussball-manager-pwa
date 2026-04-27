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
| `src/csvUtils.js` | Eigenständiges CSV-Import/Export-Modul (noch nicht in App.jsx integriert) |
| `src/csv_ui_snippet.jsx` | UI-Snippet für CSV-Funktionalität (für spätere Integration) |
| `dist/sw.js` | Service Worker (Cache-First-Strategie) |
| `public/manifest.json` | PWA-Manifest (Theme: #10b981, Sprache: de-DE) |

### Views in App.jsx

Jede View ist ein eigener `if (view === '...') return (...)` Block am Ende der Komponente.

| View | Inhalt |
|---|---|
| `home` | Dashboard: Spielverlauf, Admin-Aktionen, Team-Generator |
| `stats` | Spieler-Tabelle (Punkte, S/U/N, Tordifferenz) |
| `scorers` | Torschützen-Rangliste |
| `statspro` | Mannschafts-Bilanz Kopf-an-Kopf + Position-Analyse |
| `players` | Spieler verwalten (hinzufügen, umbenennen, löschen, Positionen setzen) |
| `newgame` | Spiel erfassen / bearbeiten |

### Navigation

`TopNav` ist ein zweigeteiltes, `position: fixed` Element:
- **Zeile 1 (Header):** `<<` Back-Button + Titel "⚽ Manager" + Admin-Toggle (🔓/🔐), immer sichtbar
- **Zeile 2 (Tab-Nav):** Home / Tabelle / Tore / Pro — Tab-Stil mit grünem Unterstrich
- `container.paddingTop: '108px'` gleicht die Höhe beider Zeilen aus

**Admin-Modus:** PW-geschützt via hardcoded `ADMIN_PASSWORD` in `App.jsx`. Kein User-basiertes Rollen-System — wer das PW kennt, bekommt Admin-Zugriff (`isAdminMode` State). Unabhängig von der `admins`-Tabelle.

### Supabase-Tabellen

Die App pflegt **denormalisierte Aggregat-Tabellen** — `player_stats` und `top_scorers` werden bei jedem Spiel manuell inkrementiert, nicht zur Laufzeit berechnet.

| Tabelle | Inhalt |
|---|---|
| `players` | Spieler-Register (`id`, `name`) |
| `player_stats` | Aggregat-Stats (`points`, `wins`, `draws`, `losses`, `goals_for`, `goals_against`, `games_played`) |
| `player_positions` | Positions-Bewertungen (`position_sturm`, `position_mittelfeld`, `position_abwehr`, Skala 1–10) |
| `games` | Spiel-Datensätze (`id` PK numerisch, `game_id` String `game_<timestamp>`, `date`, `team1`, `team2`, `score1`, `score2`) |
| `game_results` | Duplikat des Ergebnisses (für Abfragen mit `winner`-Feld) |
| `game_players` | Spieler pro Spiel (`game_id`, `player_name`, `team`) |
| `goals` | Einzeltore (`game_id`, `player_name`, `team`) |
| `top_scorers` | Aggregierter Torschützen-Zähler |
| `team_points` | Punkte pro Spieler pro Spiel — wird für `rollbackGamePoints()` bei Spielbearbeitung benötigt |
| `game_swaps` | Tauschspieler pro Spiel (`game_id`, `player_name`) — Spieler die das Team gewechselt haben; bekommen immer 1,5 Punkte |
| `admins` | Spieler die mit 👑 in der Tabelle und Spielerverwaltung angezeigt werden (z.B. Organisatoren) — kein Zusammenhang mit dem Admin-Modus |

**Wichtig:** `game_id` (String) und `id` (numerischer PK) sind unterschiedliche Felder. Beim Löschen braucht `games` den numerischen `id`, alle anderen Tabellen den String `game_id`.

### Performance-Muster

- `teamBilanz` und `extendedStats` (Anwesenheit, Streaks) als `useMemo` — werden nur neu berechnet wenn `games`, `playerStats` oder `gamePlayers` sich ändern
- `gamePlayers` wird einmalig als State geladen (`loadGamePlayers()`), nicht pro Render von Supabase abgefragt
- `getPlayerPositions` und `getGoalsPerGame` als `useCallback` mit Abhängigkeiten

### Spielpunkt-Logik

Punkte: Sieg=3, Unentschieden=1, Niederlage=0. Bei Bearbeitung eines Spiels wird `rollbackGamePoints()` ausgeführt, das alle `player_stats`-Einträge rückgängig macht und anschließend neu berechnet. Die `team_points`-Tabelle ist das Journal für diesen Rollback.

### CSV-Modul (`csvUtils.js`)

Eigenständig — eigene Supabase-Instanz, identische Schreib-Logik wie `handleNewGame()`. CSV-Format:
```
datum,gelb_spieler,gelb_tore,blau_spieler,blau_tore,torschuetzen
2026-01-15,Max|Anna|Tom,3,Ben|Lisa|Kai,2,Max|Anna
```
Spieler-Trennzeichen: `|`. Datum: `YYYY-MM-DD`. Unterstützt `,` und `;` als CSV-Delimiter (Excel-DE kompatibel). BOM-Prefix beim Export für korrekte Umlaut-Darstellung in Excel.
