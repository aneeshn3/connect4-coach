import React from 'react';
import './Board.css';

const NUM_ROWS = 6;
const NUM_COLS = 7;

function Board({ board, onColumnClick }) {
  return (
    <div className="board">
      {board.map((col, colIndex) => (
        <div key={colIndex} className="column" onClick={() => onColumnClick(colIndex)}>
          {col.map((cell, rowIndex) => (
            <div key={rowIndex} className={`cell ${cell}`}></div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default Board;
