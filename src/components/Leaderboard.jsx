import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const Leaderboard = ({ refreshKey }) => {
  const [topDiagnosticPlayers, setTopDiagnosticPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('Leaderboard refreshKey changed:', refreshKey);
    fetchLeaderboard();
  }, [refreshKey]); // Re-fetch when refreshKey changes

  const fetchLeaderboard = async () => {
    try {
      console.log('Fetching leaderboard data...');
      // Fetch players with best diagnostic scores
      const { data: diagnosticData, error: diagnosticError } = await supabase
        .from('players')
        .select('username, best_diagnostic_score')
        .not('best_diagnostic_score', 'is', null) // Only get players who have played diagnostic games
        .order('best_diagnostic_score', { ascending: false })
        .limit(10);

      if (diagnosticError) {
        console.error('Error fetching diagnostic data:', diagnosticError);
        throw diagnosticError;
      }

      console.log('Received leaderboard data:', diagnosticData);

      const mappedData = diagnosticData.map(player => ({
        username: player.username,
        score: player.best_diagnostic_score
      }));

      console.log('Mapped leaderboard data:', mappedData);
      setTopDiagnosticPlayers(mappedData);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="leaderboard">
      <h2>Leaderboard</h2>
      <div className="text-center text-white/70">Loading leaderboard...</div>
    </div>;
  }

  return (
    <div className="leaderboard">
      <h2>Diagnostic Leaderboard</h2>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Player</th>
            <th>Best Score</th>
          </tr>
        </thead>
        <tbody>
          {topDiagnosticPlayers.map((player, index) => (
            <tr key={player.username}>
              <td>{index + 1}</td>
              <td>{player.username}</td>
              <td>{player.score}</td>
            </tr>
          ))}
          {topDiagnosticPlayers.length === 0 && (
            <tr>
              <td colSpan={3}>No diagnostic scores yet</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Leaderboard; 