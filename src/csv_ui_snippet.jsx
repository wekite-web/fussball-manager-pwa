/**
 * CSV IMPORT / EXPORT — UI-Snippet für App.jsx (v15)
 *
 * 1. Import oben hinzufügen:
 *    import { parseCSV, validateCSV, importGames, exportGamesCSV, exportStatsCSV } from './csvUtils';
 *
 * 2. State hinzufügen (in FussballManagerPWA):
 *    const [csvState, setCsvState] = useState({ status: 'idle', valid: [], warnings: [], errors: [], progress: 0, total: 0 });
 *
 * 3. Diese Funktionen in die Komponente einfügen:
 */

// ─── CSV HANDLER FUNCTIONS ─────────────────────────────────────────────────────
// (In FussballManagerPWA Komponente einfügen, nach den bestehenden Handler-Funktionen)

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

// ─── CSV VIEW JSX ──────────────────────────────────────────────────────────────
// (Als neuer view === 'csv' Block, analog zu den anderen Views)

/*
if (view === 'csv') {
  return (
    <div style={styles.container}>
      <TopNav />
      <div style={styles.content}>

        // EXPORT SECTION
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

        // IMPORT SECTION
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>📥 Import</h2>
          <div style={styles.card}>

            // Vorlage herunterladen
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

            // File Upload
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

            // Vorschau & Validierung
            {csvState.status === 'preview' && (
              <div>
                <div style={{ color: '#10b981', fontWeight: '600', marginBottom: '0.75rem' }}>
                  ✅ {csvState.valid.length} Spiele bereit zum Import
                </div>

                // Vorschau-Tabelle
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

            // Import läuft
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

            // Fehler anzeigen
            {csvState.errors.length > 0 && (
              <div style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '0.75rem', marginTop: '0.75rem' }}>
                <div style={{ color: '#ef4444', fontWeight: '600', marginBottom: '0.5rem', fontSize: '0.85rem' }}>❌ Fehler</div>
                {csvState.errors.map((e, i) => <div key={i} style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '0.25rem' }}>{e}</div>)}
              </div>
            )}

            // Import abgeschlossen
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
*/
