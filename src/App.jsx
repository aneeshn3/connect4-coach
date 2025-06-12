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
  const [gameMode, setGameMode] = useState(null); // null, '1-player', '2-player', or 'diagnostic'
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [user, setUser] = useState(null);
  const [leaderboardRefreshKey, setLeaderboardRefreshKey] = useState(0);
  
  // New state variables for diagnostic scoring
  const [diagnosticMode, setDiagnosticMode] = useState(false);
  const [blunders, setBlunders] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [winningOpportunities, setWinningOpportunities] = useState(0);
  const [diagnosticScore, setDiagnosticScore] = useState(null);

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

  useEffect(() => {
    console.log('Winner state changed:', {
      winner,
      gameMode,
      currentPlayer,
      diagnosticScore
    });
  }, [winner]);

  useEffect(() => {
    console.log('Game mode changed:', {
      gameMode,
      winner,
      currentPlayer,
      diagnosticScore
    });
  }, [gameMode]);

  useEffect(() => {
    console.log('Diagnostic score changed:', {
      diagnosticScore,
      gameMode,
      winner,
      currentPlayer
    });
  }, [diagnosticScore]);

  // Helper function to evaluate a sequence of 4 positions
  const evaluateSequence = (sequence, row) => {
    const aiCount = sequence.filter(cell => cell === AI).length;
    const playerCount = sequence.filter(cell => cell === PLAYER).length;
    const emptyCount = sequence.filter(cell => cell === EMPTY).length;

    // If both players have pieces in the sequence, it's not winnable
    if (aiCount > 0 && playerCount > 0) return 0;

    // Weight scores based on vertical position (higher rows are worth more)
    const positionMultiplier = (row + 1) / NUM_ROWS;

    // Increase the values to make evaluation differences more pronounced
    if (aiCount === 3 && emptyCount === 1) return 500 * positionMultiplier; // Immediate win threat
    if (playerCount === 3 && emptyCount === 1) return -600 * positionMultiplier; // Must block
    if (aiCount === 2 && emptyCount === 2) return 100 * positionMultiplier;
    if (playerCount === 2 && emptyCount === 2) return -120 * positionMultiplier;
    if (aiCount === 1 && emptyCount === 3) return 20 * positionMultiplier;
    if (playerCount === 1 && emptyCount === 3) return -20 * positionMultiplier;

    return 0;
  };

  // Evaluate board state for minimax
  const evaluateBoard = (board, depth) => {
    // Quick win/loss check
    const aiWin = checkWin(board, -1, -1, AI);
    const playerWin = checkWin(board, -1, -1, PLAYER);

    if (aiWin) return 10000 - depth;
    if (playerWin) return -10000 + depth;

    let score = 0;
    
    // Quick center control evaluation (most important factor)
    const centerCol = board[3];
    const aiCenter = centerCol.filter(cell => cell === AI).length;
    const playerCenter = centerCol.filter(cell => cell === PLAYER).length;
    score += (aiCenter - playerCenter) * 30;

    // Count potential winning positions with increased weights
    for (let c = 0; c < NUM_COLS - 3; c++) {
      for (let r = 0; r < NUM_ROWS; r++) {
        let sequence = [board[c][r], board[c+1][r], board[c+2][r], board[c+3][r]];
        score += evaluateSequence(sequence, r);
      }
    }

    // Vertical sequences (weighted more as they're easier to complete)
    for (let c = 0; c < NUM_COLS; c++) {
      for (let r = 0; r < NUM_ROWS - 3; r++) {
        let sequence = [board[c][r], board[c][r+1], board[c][r+2], board[c][r+3]];
        score += evaluateSequence(sequence, r) * 1.5;
      }
    }

    // Diagonal sequences
    for (let c = 0; c < NUM_COLS - 3; c++) {
      for (let r = 0; r < NUM_ROWS - 3; r++) {
        let sequence1 = [board[c][r], board[c+1][r+1], board[c+2][r+2], board[c+3][r+3]];
        let sequence2 = [board[c][r+3], board[c+1][r+2], board[c+2][r+1], board[c+3][r]];
        score += evaluateSequence(sequence1, r) * 1.2;
        score += evaluateSequence(sequence2, r + 3) * 1.2;
      }
    }

    return score;
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
    // Optimize depth based on game phase and position
    const emptyCells = board.flat().filter(cell => cell === EMPTY).length;
    
    // Check for immediate winning moves or blocks with a quick 1-depth search
    const quickResult = minimax(board, 1, -Infinity, Infinity, true);
    if (quickResult.score > 9000 || quickResult.score < -9000) {
      // Found an immediate win or block needed - use this move
      const column = board[quickResult.column];
      const rowIndex = column.findIndex(cell => cell === EMPTY);
      
      if (rowIndex !== -1) {
        const newBoard = board.map((col, i) => (i === quickResult.column ? [...col] : col));
        newBoard[quickResult.column][rowIndex] = AI;
        
        setBoard(newBoard);
        
        if (checkWin(newBoard, quickResult.column, rowIndex, AI)) {
          setWinner(AI);
        } else {
          setCurrentPlayer(PLAYER);
        }
      }
      setIsAiThinking(false);
      return;
    }

    // If no immediate win/block, use dynamic depth based on game phase
    const depth = emptyCells > 25 ? 3 : (emptyCells > 15 ? 4 : 5);
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
    if ((gameMode === '1-player' || gameMode === 'diagnostic') && currentPlayer === AI && !winner) {
      setIsAiThinking(true);
      // Add minimal delay to allow the thinking indicator to render
      const timeoutId = setTimeout(makeAiMove, 100);
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
    return board.every(column => column.every(cell => cell !== EMPTY));
  };

  const handleGameEnd = async (winner) => {
    // Store the current game mode before any state changes
    const currentGameMode = gameMode;
    
    setWinner(winner);
    
    console.log('currentGameMode', currentGameMode);
    if (currentGameMode === 'diagnostic' && user && diagnosticScore !== null) {
      try {
        console.log('Attempting diagnostic score update:', { 
          username: user.username, 
          score: diagnosticScore, 
          gameMode: currentGameMode 
        });
        
        // Get current user data to compare with new score
        const { data: currentUser, error: fetchError } = await supabase
          .from('players')
          .select('best_diagnostic_score')
          .eq('username', user.username)
          .single();

        if (fetchError) throw fetchError;

        // Update user's best diagnostic score if it's better than their previous best
        if (!currentUser?.best_diagnostic_score || diagnosticScore > currentUser.best_diagnostic_score) {
          const { data: updatedUser, error: updateError } = await supabase
            .from('players')
            .update({
              best_diagnostic_score: diagnosticScore
            })
            .eq('username', user.username)
            .select()
            .single();

          if (updateError) throw updateError;

          // Update local user data
          const updatedUserData = { ...user, ...updatedUser };
          localStorage.setItem('connect4_user', JSON.stringify(updatedUserData));
          setUser(updatedUserData);

          // Trigger leaderboard refresh after successful update
          setLeaderboardRefreshKey(prev => prev + 1);
        }
      } catch (error) {
        console.error('Error updating diagnostic score:', error);
      }
    } else if (currentGameMode === '1-player' && user) {
      try {
        if (winner === PLAYER) {
          // Calculate new rating
          const newRating = calculateEloRating(user.elo_rating, AI_RATING, true);
          
          // Update user stats in Supabase
          const { data: updatedUser, error: updateError } = await supabase
            .from('players')
            .update({
              elo_rating: newRating,
              games_played: user.games_played + 1,
              games_won: user.games_won + 1
            })
            .eq('username', user.username)
            .select()
            .single();

          if (updateError) throw updateError;

          // Update local user data
          const updatedUserData = { ...user, ...updatedUser };
          localStorage.setItem('connect4_user', JSON.stringify(updatedUserData));
          setUser(updatedUserData);
        } else if (winner !== 'draw') {
          // Update games played even on loss
          const { data: updatedUser, error: updateError } = await supabase
            .from('players')
            .update({
              games_played: user.games_played + 1
            })
            .eq('username', user.username)
            .select()
            .single();

          if (updateError) throw updateError;

          // Update local user data
          const updatedUserData = { ...user, ...updatedUser };
          localStorage.setItem('connect4_user', JSON.stringify(updatedUserData));
          setUser(updatedUserData);
        }
      } catch (error) {
        console.error('Error updating player stats:', error);
      }
    }
  };

  const handleColumnClick = (colIndex) => {
    if (winner || isAiThinking) return;
    if ((gameMode === '1-player' || gameMode === 'diagnostic') && currentPlayer === AI) return;

    const column = board[colIndex];
    const rowIndex = column.findIndex(cell => cell === EMPTY);
    if (rowIndex === -1) return;

    // Make the player's move immediately
    const newBoard = board.map((col, i) => (i === colIndex ? [...col] : col));
    newBoard[colIndex][rowIndex] = currentPlayer;

    // Set the board state immediately to show the player's move
    setBoard(newBoard);

    // If in diagnostic mode, analyze the move after showing it
    if (gameMode === 'diagnostic' && currentPlayer === PLAYER) {
      // Run analysis in the next tick to allow the UI to update first
      setTimeout(() => {
        // Get the best move according to AI with deeper search
        const bestMove = minimax(newBoard, 8, -Infinity, Infinity, false);
        
        // Evaluate the player's move
        const playerMoveEval = evaluateBoard(newBoard, 0);
        
        // Make the best move on a temporary board to compare
        let bestMoveEval;
        if (bestMove.column !== null) {
          const bestTempBoard = newBoard.map(col => [...col]);
          const emptyRow = bestTempBoard[bestMove.column].findIndex(cell => cell === EMPTY);
          if (emptyRow !== -1) {
            bestTempBoard[bestMove.column][emptyRow] = PLAYER;
            bestMoveEval = evaluateBoard(bestTempBoard, 0);
          } else {
            bestMoveEval = playerMoveEval; // If no valid move, use player's move eval
          }
        } else {
          bestMoveEval = playerMoveEval; // If no best move found, use player's move eval
        }
        
        // Compare the evaluations with more context
        const evalDiff = Math.abs(playerMoveEval - bestMoveEval);

        // Check if the move creates a winning opportunity
        const winningOpportunityCreated = (() => {
          // Check if this move creates a potential winning sequence
          for (let c = 0; c < NUM_COLS; c++) {
            if (!newBoard[c].includes(EMPTY)) continue;
            const r = newBoard[c].findIndex(cell => cell === EMPTY);
            const testBoard = newBoard.map(c => [...c]);
            testBoard[c][r] = PLAYER;
            if (checkWin(testBoard, c, r, PLAYER)) return true;
          }
          return false;
        })();

        if (winningOpportunityCreated) {
          setWinningOpportunities(prev => prev + 1);
        }
        
        // Check if the move allows an immediate win for AI
        const aiWinPossible = (() => {
          for (let col = 0; col < NUM_COLS; col++) {
            if (!newBoard[col].includes(EMPTY)) continue;
            const row = newBoard[col].findIndex(cell => cell === EMPTY);
            const testBoard = newBoard.map(c => [...c]);
            testBoard[col][row] = AI;
            if (checkWin(testBoard, col, row, AI)) return true;
          }
          return false;
        })();

        if (aiWinPossible || evalDiff > 150) {
          setBlunders(prev => prev + 1);
        } else if (evalDiff > 50) {
          setMistakes(prev => prev + 1);
        }
      }, 0);
    }

    // Check game state after the move
    const hasWon = checkWin(newBoard, colIndex, rowIndex, currentPlayer);
    const isDraw = !hasWon && checkDraw(newBoard);

    // Handle game end conditions
    if (hasWon || isDraw) {
      if (gameMode === 'diagnostic') {
        // Calculate diagnostic score when game ends
        const calculateAndUpdateScore = async () => {
          const baseScore = 1000;
          const blunderPenalty = blunders * 200;
          const mistakePenalty = mistakes * 50;
          const winningBonus = winningOpportunities * 100;
          const gameEndBonus = hasWon && currentPlayer === PLAYER ? 200 : 0;
          
          const finalScore = Math.max(0, baseScore - blunderPenalty - mistakePenalty + winningBonus + gameEndBonus);
        
          setDiagnosticScore(finalScore);

          // Now that we have set the score, call handleGameEnd
          if (hasWon) {
            await handleGameEnd(currentPlayer);
          } else {
            await handleGameEnd('draw');
          }
        };

        calculateAndUpdateScore().catch(error => {
          console.error('Error in calculateAndUpdateScore:', error);
        });
      } else {
        // For non-diagnostic modes, call handleGameEnd directly
        if (hasWon) {
          handleGameEnd(currentPlayer);
        } else {
          handleGameEnd('draw');
        }
      }
    } else {
      setCurrentPlayer(currentPlayer === AI ? PLAYER : AI);
    }
  };

  const resetGame = () => {
    setBoard(Array(NUM_COLS).fill(EMPTY).map(() => Array(NUM_ROWS).fill(EMPTY)));
    setCurrentPlayer(AI);
    setWinner(null);
    setIsAiThinking(false);
    
    // Only reset diagnostic-specific states if we're in diagnostic mode
    if (gameMode === 'diagnostic') {
      setBlunders(0);
      setMistakes(0);
      setWinningOpportunities(0);
      setDiagnosticScore(null);
    }
  };

  const startGame = (mode) => {
    setGameMode(mode);
    if (mode === 'diagnostic') {
      setBlunders(0);
      setMistakes(0);
      setWinningOpportunities(0);
      setDiagnosticScore(null);
      setDiagnosticMode(true);
    } else {
      setDiagnosticMode(false);
    }
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
        <Leaderboard refreshKey={leaderboardRefreshKey} />
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
          <button
            onClick={() => startGame('diagnostic')}
            className="diagnostic-btn"
          >
            Diagnostic
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
          onClick={() => {
            if (!gameMode === 'diagnostic' || winner) {
              setGameMode(null);
            }
          }}
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
              {/* Always show diagnostic score in diagnostic mode */}
              {gameMode === 'diagnostic' && (
                <div className="diagnostic-score">
                  {console.log('Diagnostic Score Details:', {
                    rawScore: diagnosticScore,
                    calculatedScore: Math.max(0, 1000 - (blunders * 200) - (mistakes * 50) + (winningOpportunities * 100)),
                    blunders,
                    mistakes,
                    winningOpportunities
                  })}
                  <h3>Diagnostic Score: {diagnosticScore}</h3>
                  <p>Blunders: {blunders}</p>
                  <p>Mistakes: {mistakes}</p>
                  <p>Winning Opportunities: {winningOpportunities}</p>
                  <p>Base Score: 1000</p>
                  <p>Blunder Penalty: -{blunders * 200}</p>
                  <p>Mistake Penalty: -{mistakes * 50}</p>
                  <p style={{ borderTop: '1px solid rgba(255, 255, 255, 0.2)', marginTop: '10px', paddingTop: '10px' }}>
                    Final Score: {Math.max(0, 1000 - (blunders * 200) - (mistakes * 50) + (winningOpportunities * 100))}
                  </p>
                </div>
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
                  {(gameMode === '1-player' || gameMode === 'diagnostic') && currentPlayer === AI ? 
                    'AI\'s turn' : 
                    `Player ${currentPlayer}'s turn`}
                </span>
              )}
              {/* Add live diagnostic stats during gameplay */}
              {gameMode === 'diagnostic' && !winner && (
                <div className="diagnostic-score live-stats">
                  <p>Current Stats:</p>
                  <p>Blunders: {blunders}</p>
                  <p>Mistakes: {mistakes}</p>
                  <p>Winning Opportunities: {winningOpportunities}</p>
                  <p>Projected Score: {Math.max(0, 1000 - (blunders * 200) - (mistakes * 50) + (winningOpportunities * 100))}</p>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="game-board-container">
          <Board board={board} onColumnClick={handleColumnClick} />
          {(gameMode === '1-player' || gameMode === 'diagnostic') && !winner && (
            <WinProbability probability={calculateWinProbability(evaluateBoard(board, 0))} />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;