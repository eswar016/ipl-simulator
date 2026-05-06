const { useState, useEffect, useMemo } = React;

const UPSTASH_URL = "https://legal-quail-68667.upstash.io/get/ipl:sync:state:v1";
const UPSTASH_TOKEN = "gQAAAAAAAQw7AAIncDE0OTRkN2Y3ZDE5YWM0YzYxOWQyNWI4YzViMjgzNjRjYnAxNjg2Njc";

const TEAM_COLORS = {
  CSK: "#facc15",
  DC: "#0284c7",
  GT: "#0f172a",
  KKR: "#3b0764",
  LSG: "#06b6d4",
  MI: "#1d4ed8",
  PBKS: "#ef4444",
  RCB: "#b91c1c",
  RR: "#db2777",
  SRH: "#ea580c"
};

function TeamLogo({ team }) {
  const color = TEAM_COLORS[team] || "#555";
  return (
    <div className="team-logo" style={{ backgroundColor: color }}>
      {team}
    </div>
  );
}

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [simulatedWinners, setSimulatedWinners] = useState({});
  const [playoffSimulations, setPlayoffSimulations] = useState({});
  const [filterTeam, setFilterTeam] = useState(null);
  const [flaggedMatches, setFlaggedMatches] = useState({});
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await fetch(UPSTASH_URL, {
        headers: {
          Authorization: `Bearer ${UPSTASH_TOKEN}`
        }
      });
      if (!response.ok) throw new Error("Failed to fetch data");
      
      const result = await response.json();
      const parsedData = JSON.parse(result.result);
      setData(parsedData);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError("Failed to load data from Upstash.");
      setLoading(false);
    }
  };

  const handleSimulateWinner = (matchId, team) => {
    setSimulatedWinners(prev => {
      if (prev[matchId] === team) {
        const next = { ...prev };
        delete next[matchId];
        return next;
      }
      return { ...prev, [matchId]: team };
    });
  };

  const computedPointsTable = useMemo(() => {
    if (!data) return [];
    
    // Deep clone original table
    const table = data.pointsTable.map(row => ({ ...row }));
    const teamStats = {};
    table.forEach(r => { teamStats[r.team] = r; });

    // Apply simulations
    Object.values(data.matches).forEach(match => {
      if (!match.finalized && simulatedWinners[match.id]) {
        const winner = simulatedWinners[match.id];
        
        if (winner === "NR") {
          if (teamStats[match.team1]) {
            teamStats[match.team1].matches += 1;
            teamStats[match.team1].nr += 1;
            teamStats[match.team1].points += 1;
          }
          if (teamStats[match.team2]) {
            teamStats[match.team2].matches += 1;
            teamStats[match.team2].nr += 1;
            teamStats[match.team2].points += 1;
          }
        } else {
          const loser = match.team1 === winner ? match.team2 : match.team1;
          
          if (teamStats[winner]) {
            teamStats[winner].matches += 1;
            teamStats[winner].wins += 1;
            teamStats[winner].points += 2;
          }
          if (teamStats[loser]) {
            teamStats[loser].matches += 1;
            teamStats[loser].losses += 1;
          }
        }
      }
    });

    // Sort: Points DESC, then NRR DESC
    table.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.nrr - a.nrr;
    });

    // Update positions
    table.forEach((row, i) => { row.position = i + 1; });
    
    return table;
  }, [data, simulatedWinners]);

  if (loading) return <div className="loader"></div>;
  if (error) return <div className="app-container" style={{color: '#ef4444'}}>{error}</div>;

  const toggleFlag = (matchId) => {
    setFlaggedMatches(prev => {
      const next = {...prev};
      if (next[matchId]) delete next[matchId];
      else next[matchId] = true;
      return next;
    });
  };

  const allMatches = Object.values(data.matches);
  const remainingMatches = allMatches.filter(m => {
      if(m.finalized) return false;
      if(showFlaggedOnly && !flaggedMatches[m.id]) return false;
      if(filterTeam && m.team1 !== filterTeam && m.team2 !== filterTeam) return false;
      return true;
  }).sort((a, b) => {
      if(a.startDate && b.startDate) return new Date(a.startDate) - new Date(b.startDate);
      const aNum = parseInt(a.id.replace(/\D/g, '')) || 0;
      const bNum = parseInt(b.id.replace(/\D/g, '')) || 0;
      return aNum - bNum;
  });

  const top4 = computedPointsTable.slice(0, 4);
  const isLeagueComplete = remainingMatches.every(m => simulatedWinners[m.id]);

  const q1Team1 = top4[0]?.team;
  const q1Team2 = top4[1]?.team;
  const elimTeam1 = top4[2]?.team;
  const elimTeam2 = top4[3]?.team;

  const q1Winner = playoffSimulations['Q1'];
  const q1Loser = q1Winner ? (q1Winner === q1Team1 ? q1Team2 : q1Team1) : null;
  const elimWinner = playoffSimulations['Elim'];

  const q2Team1 = q1Loser;
  const q2Team2 = elimWinner;
  const q2Winner = playoffSimulations['Q2'];

  const finalTeam1 = q1Winner;
  const finalTeam2 = q2Winner;
  const finalWinner = playoffSimulations['Final'];

  const handlePlayoffSimulate = (match, team) => {
     setPlayoffSimulations(prev => {
        if(prev[match] === team) {
           const next = {...prev};
           delete next[match];
           if(match === 'Q1' || match === 'Elim') { delete next['Q2']; delete next['Final']; }
           if(match === 'Q2') delete next['Final'];
           return next;
        }
        return {...prev, [match]: team};
     });
  };

  const renderPlayoffNode = (title, matchId, team1, team2) => (
    <div className="bracket-node">
      <div className="bracket-title">{title}</div>
      <div className="bracket-teams">
        <button 
           className={`bracket-team-btn ${playoffSimulations[matchId] === team1 ? 'selected' : ''}`}
           onClick={() => team1 && team2 && handlePlayoffSimulate(matchId, team1)}
           disabled={!team1 || !team2 || !isLeagueComplete}
        >
           {team1 || 'TBD'} {matchId === 'Q1' && team1 === q1Team1 ? '(1st)' : matchId === 'Q1' && team1 === q1Team2 ? '(2nd)' : ''} {matchId === 'Elim' && team1 === elimTeam1 ? '(3rd)' : matchId === 'Elim' && team1 === elimTeam2 ? '(4th)' : ''}
        </button>
        <button 
           className={`bracket-team-btn ${playoffSimulations[matchId] === team2 ? 'selected' : ''}`}
           onClick={() => team1 && team2 && handlePlayoffSimulate(matchId, team2)}
           disabled={!team1 || !team2 || !isLeagueComplete}
        >
           {team2 || 'TBD'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="app-container">
      <header>
        <h1>IPL 2026 Simulator</h1>
        <p>Predict remaining fixtures and see live playoff scenarios</p>
        <button className="export-btn" onClick={() => window.print()}>
           ⬇️ Export Predictions as PDF
        </button>
      </header>

      <div className="main-content">
        <div className="glass-panel">
          <h2 className="section-title">Points Table (Live Simulated)</h2>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Team</th>
                  <th>Pld</th>
                  <th>W</th>
                  <th>L</th>
                  <th>NR</th>
                  <th>Pts</th>
                  <th>NRR</th>
                </tr>
              </thead>
              <tbody>
                {computedPointsTable.map((row) => (
                  <tr key={row.team} className={row.position <= 2 ? "top-2" : row.position <= 4 ? "top-4" : ""}>
                    <td>{row.position}</td>
                    <td className="team-cell">
                      <TeamLogo team={row.team} />
                      {row.team}
                    </td>
                    <td>{row.matches}</td>
                    <td>{row.wins}</td>
                    <td>{row.losses}</td>
                    <td>{row.nr}</td>
                    <td><strong>{row.points}</strong></td>
                    <td>{row.nrr > 0 ? `+${row.nrr}` : row.nrr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {top4.length === 4 && (
            <div className="bracket-container">
              {!isLeagueComplete && (
                 <div style={{gridColumn: '1/-1', textAlign: 'center', marginBottom: '1rem', color: 'var(--text-secondary)'}}>
                   Complete all league fixtures to unlock interactive Playoff Simulator
                 </div>
              )}
              {renderPlayoffNode("Qualifier 1", "Q1", q1Team1, q1Team2)}
              {renderPlayoffNode("Eliminator", "Elim", elimTeam1, elimTeam2)}
              {renderPlayoffNode("Qualifier 2", "Q2", q2Team1, q2Team2)}
              {renderPlayoffNode("Final", "Final", finalTeam1, finalTeam2)}
              
              {finalWinner && (
                 <div className="champion-node">
                   <div className="champion-title">IPL 2026 Champions</div>
                   <div className="champion-team">{finalWinner}</div>
                 </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="sidebar">
        <div className="glass-panel">
          <h2 className="section-title">Remaining Fixtures</h2>
          
          <div className="filter-container">
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem'}}>
               <p className="filter-title" style={{margin: 0}}>Filter by Team:</p>
               <button 
                  className={`flag-filter-btn ${showFlaggedOnly ? 'active' : ''}`}
                  onClick={() => setShowFlaggedOnly(!showFlaggedOnly)}
               >
                 🚩 Flagged Only
               </button>
            </div>
            <div className="team-filters">
              {Object.keys(TEAM_COLORS).map(team => (
                <button 
                  key={team}
                  className={`filter-btn ${filterTeam === team ? 'active' : ''}`}
                  onClick={() => setFilterTeam(prev => prev === team ? null : team)}
                  style={{'--btn-color': TEAM_COLORS[team]}}
                  title={`Filter ${team}`}
                >
                  <TeamLogo team={team} />
                </button>
              ))}
            </div>
          </div>

          <div className="fixtures-list">
            {remainingMatches.length === 0 && (
              <p style={{color: 'var(--text-secondary)'}}>No remaining fixtures!</p>
            )}
            {remainingMatches.map(match => (
              <div className="match-card" key={match.id}>
                <div className="match-header">
                  <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                     <button 
                       className={`flag-btn ${flaggedMatches[match.id] ? 'active' : ''}`}
                       onClick={() => toggleFlag(match.id)}
                       title="Flag for later review"
                     >
                       {flaggedMatches[match.id] ? '🚩' : '🏳️'}
                     </button>
                     <span>{match.matchDesc || match.id}</span>
                  </div>
                  <span>{match.startDate ? new Date(match.startDate).toLocaleDateString() : 'TBD'}</span>
                </div>
                <div className="match-teams">
                  <button 
                    className={`team-btn ${simulatedWinners[match.id] === match.team1 ? 'selected' : ''}`}
                    onClick={() => handleSimulateWinner(match.id, match.team1)}
                  >
                    <TeamLogo team={match.team1} />
                    <span>{match.team1}</span>
                  </button>
                  <button 
                    className={`team-btn nr-btn ${simulatedWinners[match.id] === 'NR' ? 'selected' : ''}`}
                    onClick={() => handleSimulateWinner(match.id, 'NR')}
                  >
                    <span>NR</span>
                  </button>
                  <button 
                    className={`team-btn ${simulatedWinners[match.id] === match.team2 ? 'selected' : ''}`}
                    onClick={() => handleSimulateWinner(match.id, match.team2)}
                  >
                    <TeamLogo team={match.team2} />
                    <span>{match.team2}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
