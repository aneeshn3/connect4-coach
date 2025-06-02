import React, { useState, useEffect } from 'react';
import Board from './components/Board';
import Auth from './components/Auth';
import Leaderboard from './components/Leaderboard';
import WinProbability from './components/WinProbability';
import { supabase } from './lib/supabase';
import { calculateEloRating } from './utils/elo';
import './App.css';

const NUM_ROWS = 6;
const NUM_COLS = 7;
const EMPTY = null;
const PLAYER = 'yellow';
const AI = 'red';
const AI_RATING = 1200; // Base AI rating

// Convert evaluation score to probability
const calculateWinProbability = (evaluation) => {
  // Use sigmoid function to convert score to probability
  const k = 0.001; // Scaling factor to smooth out the probability curve
  return 1 / (1 + Math.exp(-k * evaluation));
};

function App() {
  console.log('App component rendering');

  const [board, setBoard] = useState(
    Array(NUM_COLS).fill(EMPTY).map(() => Array(NUM_ROWS).fill(EMPTY))
  );
  const [currentPlayer, setCurrentPlayer] = useState(AI);
  const [winner, setWinner] = useState(null);
  const [gameMode, setGameMode] = useState(null); // null, '1-player', or '2-player'
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    console.log('Checking for existing user session');
    const savedUser = localStorage.getItem('connect4_user');
    if (savedUser) {
      console.log('Found saved user:', savedUser);
      setUser(JSON.parse(savedUser));
    } else {
      console.log('No saved user found');
    }
  }, []);

  // Evaluate board state for minimax
  const evaluateBoard = (board, depth) => {
    // Check for wins
    const aiWin = checkWin(board, -1, -1, AI);
    const playerWin = checkWin(board, -1, -1, PLAYER);

    if (aiWin) return 100000 - depth;
    if (playerWin) return -100000 + depth;

    // Evaluate board position
    let score = 0;
    
    // Prefer center column (weighted by height)
    for (let r = 0; r < NUM_ROWS; r++) {
      if (board[3][r] === AI) score += 3 * (r + 1);
      else if (board[3][r] === PLAYER) score -= 3 * (r + 1);
    }

    // Count potential winning positions
    for (let c = 0; c < NUM_COLS - 3; c++) {
      for (let r = 0; r < NUM_ROWS; r++) {
        let sequence = [board[c][r], board[c+1][r], board[c+2][r], board[c+3][r]];
        score += evaluateSequence(sequence, r);
      }
    }

    // Vertical sequences
    for (let c = 0; c < NUM_COLS; c++) {
      for (let r = 0; r < NUM_ROWS - 3; r++) {
        let sequence = [board[c][r], board[c][r+1], board[c][r+2], board[c][r+3]];
        score += evaluateSequence(sequence, r) * 1.2; // Vertical threats are more immediate
      }
    }

    // Diagonal sequences
    for (let c = 0; c < NUM_COLS - 3; c++) {
      for (let r = 0; r < NUM_ROWS - 3; r++) {
        let sequence1 = [board[c][r], board[c+1][r+1], board[c+2][r+2], board[c+3][r+3]];
        let sequence2 = [board[c][r+3], board[c+1][r+2], board[c+2][r+1], board[c+3][r]];
        score += evaluateSequence(sequence1, r);
        score += evaluateSequence(sequence2, r + 3);
      }
    }

    return score;
  };

  // Helper function to evaluate a sequence of 4 positions
  const evaluateSequence = (sequence, row) => {
    const aiCount = sequence.filter(cell => cell === AI).length;
    const playerCount = sequence.filter(cell => cell === PLAYER).length;
    const emptyCount = sequence.filter(cell => cell === EMPTY).length;

    // If both players have pieces in the sequence, it's not winnable
    if (aiCount > 0 && playerCount > 0) return 0;

    // Weight scores based on vertical position (higher rows are worth more)
    const positionMultiplier = (row + 1) / NUM_ROWS;

    if (aiCount === 3 && emptyCount === 1) return 100 * positionMultiplier;
    if (playerCount === 3 && emptyCount === 1) return -120 * positionMultiplier; // Prioritize blocking opponent's wins
    if (aiCount === 2 && emptyCount === 2) return 20 * positionMultiplier;
    if (playerCount === 2 && emptyCount === 2) return -25 * positionMultiplier;
    if (aiCount === 1 && emptyCount === 3) return 5 * positionMultiplier;
    if (playerCount === 1 && emptyCount === 3) return -5 * positionMultiplier;

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
    const depth = 7; // Increased depth for better lookahead
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

  const checkDraw = (board) => {
    // Check if all columns are full
    return board.every(column => column.every(cell => cell !== EMPTY));
  };

  const handleGameEnd = async (winner) => {
    setWinner(winner);
    
    if (gameMode === '1-player' && user && winner === PLAYER) {
      try {
        // Calculate new rating
        const newRating = calculateEloRating(user.elo_rating, AI_RATING, true);
        
        // Update user stats in Supabase
        const { data, error } = await supabase
          .from('players')
          .update({
            elo_rating: newRating,
            games_played: user.games_played + 1,
            games_won: user.games_won + 1
          })
          .eq('username', user.username)
          .select()
          .single();

        if (error) throw error;

        // Update local user data
        const updatedUser = { ...user, ...data };
        localStorage.setItem('connect4_user', JSON.stringify(updatedUser));
        setUser(updatedUser);
      } catch (error) {
        console.error('Error updating player stats:', error);
      }
    } else if (gameMode === '1-player' && user && winner !== 'draw') {
      // Update games played even on loss
      try {
        const { data, error } = await supabase
          .from('players')
          .update({
            games_played: user.games_played + 1
          })
          .eq('username', user.username)
          .select()
          .single();

        if (error) throw error;

        // Update local user data
        const updatedUser = { ...user, ...data };
        localStorage.setItem('connect4_user', JSON.stringify(updatedUser));
        setUser(updatedUser);
      } catch (error) {
        console.error('Error updating player stats:', error);
      }
    } else if (gameMode === '1-player' && user && winner === 'draw') {
      // Update games played on draw
      try {
        const { data, error } = await supabase
          .from('players')
          .update({
            games_played: user.games_played + 1
          })
          .eq('username', user.username)
          .select()
          .single();

        if (error) throw error;

        // Update local user data
        const updatedUser = { ...user, ...data };
        localStorage.setItem('connect4_user', JSON.stringify(updatedUser));
        setUser(updatedUser);
      } catch (error) {
        console.error('Error updating player stats:', error);
      }
    }
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
      handleGameEnd(currentPlayer);
    } else if (checkDraw(newBoard)) {
      handleGameEnd('draw');
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

  const handleSignOut = () => {
    localStorage.removeItem('connect4_user');
    setUser(null);
    setGameMode(null);
    resetGame();
  };

  console.log('Current state:', { user, gameMode, winner, currentPlayer });

  if (!user) {
    console.log('Rendering Auth component');
    return <Auth onSignIn={setUser} />;
  }

  if (!gameMode) {
    console.log('Rendering game mode selection');
    return (
      <div className="App">
        <div className="user-info">
          <span>Welcome, {user.username}!</span>
          <button
            onClick={handleSignOut}
          >
            Sign Out
          </button>
        </div>
        <h1 className="text-4xl font-bold mb-8 text-white text-center">
          Connect 4 Coach
        </h1>
        <Leaderboard />
        <div className="mode-selection">
          <button
            onClick={() => startGame('1-player')}
          >
            Play vs AI
          </button>
          <button
            onClick={() => startGame('2-player')}
          >
            2 Players
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <div className="user-info">
        <span>Playing as: {user.username}</span>
        <button
          onClick={() => setGameMode(null)}
        >
          Back to Menu
        </button>
      </div>
      <div className="game-container">
        <div className="game-status">
          {winner ? (
            <div className="winner-message">
              {winner === 'draw' ? (
                <span className="draw">It's a Draw!</span>
              ) : (
                <span className={winner}>
                  {winner === AI ? 'AI' : 'Player'} wins!
                </span>
              )}
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
        <div className="game-board-container">
          <Board board={board} onColumnClick={handleColumnClick} />
          {gameMode === '1-player' && !winner && (
            <WinProbability probability={calculateWinProbability(evaluateBoard(board, 0))} />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
