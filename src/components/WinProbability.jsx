import React from 'react';
import './WinProbability.css';

function WinProbability({ probability }) {
  // Convert probability to percentage
  const percentage = Math.round(probability * 100);
  
  return (
    <div className="win-probability">
      <h3>AI Win Probability</h3>
      <div className="probability-meter">
        <div 
          className="probability-fill"
          style={{ height: `${percentage}%` }}
        />
      </div>
      <div className="probability-value">{percentage}%</div>
    </div>
  );
}

export default WinProbability; 