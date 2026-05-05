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

  // Filter remaining matches (not finalized)
  const allMatches = Object.values(data.matches);
  const remainingMatches = allMatches.filter(m => !m.finalized).sort((a, b) => {
      if(a.startDate && b.startDate) return new Date(a.startDate) - new Date(b.startDate);
      const aNum = parseInt(a.id.replace(/\D/g, '')) || 0;
      const bNum = parseInt(b.id.replace(/\D/g, '')) || 0;
      return aNum - bNum;
  });

  const top4 = computedPointsTable.slice(0, 4);

  return (
    <div className="app-container">
      <header>
        <h1>IPL 2026 Simulator</h1>
        <p>Predict remaining fixtures and see live playoff scenarios</p>
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
              <div className="bracket-node">
                <div className="bracket-title">Qualifier 1</div>
                <div className="bracket-teams">
                  <div className="bracket-team">{top4[0].team} (1st)</div>
                  <div className="bracket-team">{top4[1].team} (2nd)</div>
                </div>
              </div>
              <div className="bracket-node">
                <div className="bracket-title">Eliminator</div>
                <div className="bracket-teams">
                  <div className="bracket-team">{top4[2].team} (3rd)</div>
                  <div className="bracket-team">{top4[3].team} (4th)</div>
                </div>
              </div>
              <div className="bracket-node">
                <div className="bracket-title">Qualifier 2</div>
                <div className="bracket-teams">
                  <div className="bracket-team">Loser Q1</div>
                  <div className="bracket-team">Winner Elim</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="sidebar">
        <div className="glass-panel">
          <h2 className="section-title">Remaining Fixtures</h2>
          <div className="fixtures-list">
            {remainingMatches.length === 0 && (
              <p style={{color: 'var(--text-secondary)'}}>No remaining fixtures!</p>
            )}
            {remainingMatches.map(match => (
              <div className="match-card" key={match.id}>
                <div className="match-header">
                  <span>{match.matchDesc || match.id}</span>
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
                  <span className="vs">VS</span>
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
