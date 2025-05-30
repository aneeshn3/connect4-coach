import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const Leaderboard = () => {
  const [topPlayers, setTopPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTopPlayers();
  }, []);

  const fetchTopPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('username, elo_rating, games_won, games_played')
        .order('elo_rating', { ascending: false })
        .limit(5);

      if (error) throw error;
      setTopPlayers(data);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="leaderboard">
      <h2>Top Players</h2>
      <div className="text-center text-white/70">Loading leaderboard...</div>
    </div>;
  }

  return (
    <div className="leaderboard">
      <h2>Top Players</h2>
      <div>
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              <th>Rating</th>
              <th>W/L</th>
            </tr>
          </thead>
          <tbody>
            {topPlayers.map((player, index) => (
              <tr key={player.username}>
                <td>{index + 1}</td>
                <td>{player.username}</td>
                <td>{player.elo_rating}</td>
                <td>{player.games_won}/{player.games_played}</td>
              </tr>
            ))}
            {topPlayers.length === 0 && (
              <tr>
                <td colSpan={4}>No players yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Leaderboard; 