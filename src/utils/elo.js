// K-factor determines how much ratings can change in a single game
const K_FACTOR = 32;

export const calculateEloRating = (playerRating, aiRating, playerWon) => {
  // Calculate expected scores
  const expectedScorePlayer = 1 / (1 + Math.pow(10, (aiRating - playerRating) / 400));
  const actualScore = playerWon ? 1 : 0;

  // Calculate new rating
  const newRating = Math.round(playerRating + K_FACTOR * (actualScore - expectedScorePlayer));

  return Math.max(newRating, 100); // Ensure rating doesn't go below 100
}; 