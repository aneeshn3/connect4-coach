import React, { useState, useEffect } from 'react';
import Board from './components/Board';
import './App.css';

const NUM_ROWS = 6;
const NUM_COLS = 7;
const EMPTY = null;
const PLAYER = 'yellow';
const AI = 'red';

function App() {
  const [board, setBoard] = useState(
    Array(NUM_COLS).fill(EMPTY).map(() => Array(NUM_ROWS).fill(EMPTY))
  );
  const [currentPlayer, setCurrentPlayer] = useState(AI);
  const [winner, setWinner] = useState(null);
  const [gameMode, setGameMode] = useState(null); // null, '1-player', or '2-player'
  const [isAiThinking, setIsAiThinking] = useState(false);

  // Evaluate board state for minimax
  const evaluateBoard = (board, depth) => {
    // Check for wins
    const aiWin = checkWin(board, -1, -1, AI);
    const playerWin = checkWin(board, -1, -1, PLAYER);

    if (aiWin) return 100000 - depth;
    if (playerWin) return -100000 + depth;

    // Evaluate board position
    let score = 0;
    
    // Prefer center column
    for (let r = 0; r < NUM_ROWS; r++) {
      if (board[3][r] === AI) score += 3;
      else if (board[3][r] === PLAYER) score -= 3;
    }

    // Count potential winning positions
    for (let c = 0; c < NUM_COLS - 3; c++) {
      for (let r = 0; r < NUM_ROWS; r++) {
        let sequence = [board[c][r], board[c+1][r], board[c+2][r], board[c+3][r]];
        score += evaluateSequence(sequence);
      }
    }

    // Vertical sequences
    for (let c = 0; c < NUM_COLS; c++) {
      for (let r = 0; r < NUM_ROWS - 3; r++) {
        let sequence = [board[c][r], board[c][r+1], board[c][r+2], board[c][r+3]];
        score += evaluateSequence(sequence);
      }
    }

    // Diagonal sequences
    for (let c = 0; c < NUM_COLS - 3; c++) {
      for (let r = 0; r < NUM_ROWS - 3; r++) {
        let sequence1 = [board[c][r], board[c+1][r+1], board[c+2][r+2], board[c+3][r+3]];
        let sequence2 = [board[c][r+3], board[c+1][r+2], board[c+2][r+1], board[c+3][r]];
        score += evaluateSequence(sequence1);
        score += evaluateSequence(sequence2);
      }
    }

    return score;
  };

  // Helper function to evaluate a sequence of 4 positions
  const evaluateSequence = (sequence) => {
    const aiCount = sequence.filter(cell => cell === AI).length;
    const playerCount = sequence.filter(cell => cell === PLAYER).length;
    const emptyCount = sequence.filter(cell => cell === EMPTY).length;

    if (aiCount === 3 && emptyCount === 1) return 50;
    if (playerCount === 3 && emptyCount === 1) return -50;
    if (aiCount === 2 && emptyCount === 2) return 10;
    if (playerCount === 2 && emptyCount === 2) return -10;

    return 0;
  };

  // Get valid moves
  const getValidMoves = (board) => {
    const moves = [];
    for (let col = 0; col < NUM_COLS; col++) {
      if (board[col].includes(EMPTY)) {
        moves.push(col);
      }
    }
    return moves;
  };

  // Make a move on a board copy
  const makeMove = (board, col, player) => {
    const newBoard = board.map(column => [...column]);
    const row = newBoard[col].findIndex(cell => cell === EMPTY);
    if (row !== -1) {
      newBoard[col][row] = player;
    }
    return newBoard;
  };

  // Minimax algorithm with alpha-beta pruning
  const minimax = (board, depth, alpha, beta, maximizingPlayer) => {
    const validMoves = getValidMoves(board);
    
    if (depth === 0 || validMoves.length === 0 || checkWin(board, -1, -1, AI) || checkWin(board, -1, -1, PLAYER)) {
      return { score: evaluateBoard(board, depth), column: null };
    }

    if (maximizingPlayer) {
      let maxEval = -Infinity;
      let bestMove = validMoves[0];

      for (const col of validMoves) {
        const newBoard = makeMove(board, col, AI);
        const evalResult = minimax(newBoard, depth - 1, alpha, beta, false);
        
        if (evalResult.score > maxEval) {
          maxEval = evalResult.score;
          bestMove = col;
        }
        alpha = Math.max(alpha, evalResult.score);
        if (beta <= alpha) break;
      }

      return { score: maxEval, column: bestMove };
    } else {
      let minEval = Infinity;
      let bestMove = validMoves[0];

      for (const col of validMoves) {
        const newBoard = makeMove(board, col, PLAYER);
        const evalResult = minimax(newBoard, depth - 1, alpha, beta, true);
        
        if (evalResult.score < minEval) {
          minEval = evalResult.score;
          bestMove = col;
        }
        beta = Math.min(beta, evalResult.score);
        if (beta <= alpha) break;
      }

      return { score: minEval, column: bestMove };
    }
  };

  // AI move
  const makeAiMove = () => {
    const depth = 5; // Slightly reduced depth for faster response
    const result = minimax(board, depth, -Infinity, Infinity, true);
    
    if (result.column !== null) {
      const column = board[result.column];
      const rowIndex = column.findIndex(cell => cell === EMPTY);
      
      if (rowIndex !== -1) {
        const newBoard = board.map((col, i) => (i === result.column ? [...col] : col));
        newBoard[result.column][rowIndex] = AI;
        
        setBoard(newBoard);
        
        if (checkWin(newBoard, result.column, rowIndex, AI)) {
          setWinner(AI);
        } else {
          setCurrentPlayer(PLAYER);
        }
      }
    }
    setIsAiThinking(false);
  };

  useEffect(() => {
    if (gameMode === '1-player' && currentPlayer === AI && !winner) {
      setIsAiThinking(true);
      // Add a small delay to allow the thinking indicator to render
      const timeoutId = setTimeout(makeAiMove, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [gameMode, currentPlayer, winner]);

  const checkWin = (board, lastCol, lastRow, player) => {
    // Check horizontal
    for (let c = 0; c <= NUM_COLS - 4; c++) {
      for (let r = 0; r < NUM_ROWS; r++) {
        if (board[c][r] === player && 
            board[c+1][r] === player && 
            board[c+2][r] === player && 
            board[c+3][r] === player) {
          return true;
        }
      }
    }

    // Check vertical
    for (let c = 0; c < NUM_COLS; c++) {
      for (let r = 0; r <= NUM_ROWS - 4; r++) {
        if (board[c][r] === player && 
            board[c][r+1] === player && 
            board[c][r+2] === player && 
            board[c][r+3] === player) {
          return true;
        }
      }
    }

    // Check diagonal (positive slope)
    for (let c = 0; c <= NUM_COLS - 4; c++) {
      for (let r = 0; r <= NUM_ROWS - 4; r++) {
        if (board[c][r] === player && 
            board[c+1][r+1] === player && 
            board[c+2][r+2] === player && 
            board[c+3][r+3] === player) {
          return true;
        }
      }
    }

    // Check diagonal (negative slope)
    for (let c = 0; c <= NUM_COLS - 4; c++) {
      for (let r = 3; r < NUM_ROWS; r++) {
        if (board[c][r] === player && 
            board[c+1][r-1] === player && 
            board[c+2][r-2] === player && 
            board[c+3][r-3] === player) {
          return true;
        }
      }
    }

    return false;
  };

  const handleColumnClick = (colIndex) => {
    if (winner || isAiThinking) return;
    if (gameMode === '1-player' && currentPlayer === AI) return;

    const column = board[colIndex];
    const rowIndex = column.findIndex(cell => cell === EMPTY);
    if (rowIndex === -1) return;

    const newBoard = board.map((col, i) => (i === colIndex ? [...col] : col));
    newBoard[colIndex][rowIndex] = currentPlayer;

    setBoard(newBoard);

    if (checkWin(newBoard, colIndex, rowIndex, currentPlayer)) {
      setWinner(currentPlayer);
    } else {
      setCurrentPlayer(currentPlayer === AI ? PLAYER : AI);
    }
  };

  const resetGame = () => {
    setBoard(Array(NUM_COLS).fill(EMPTY).map(() => Array(NUM_ROWS).fill(EMPTY)));
    setCurrentPlayer(AI);
    setWinner(null);
    setIsAiThinking(false);
  };

  const startGame = (mode) => {
    setGameMode(mode);
    resetGame();
  };

  if (!gameMode) {
    return (
      <div className="App">
        <h1>Connect 4 Coach</h1>
        <div className="mode-selection">
          <button onClick={() => startGame('1-player')}>Play vs AI</button>
          <button onClick={() => startGame('2-player')}>2 Players</button>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <h1>Connect 4 Coach</h1>
      <div className="game-status">
        {winner ? (
          <div className="winner-message">
            <span className={winner}>
              {winner === AI ? 'AI' : 'Player'} {winner} wins!
            </span>
            <button onClick={resetGame}>Play Again</button>
          </div>
        ) : (
          <div className="turn-indicator">
            {isAiThinking ? (
              <div className="ai-thinking">
                AI is thinking...
              </div>
            ) : (
              <span className={currentPlayer}>
                {gameMode === '1-player' && currentPlayer === AI ? 
                  'AI\'s turn' : 
                  `Player ${currentPlayer}'s turn`}
              </span>
            )}
          </div>
        )}
      </div>
      <Board board={board} onColumnClick={handleColumnClick} />
      <button className="change-mode" onClick={() => setGameMode(null)}>
        Change Game Mode
      </button>
    </div>
  );
}

export default App;
