const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

// 100 to 500 points depending on time left, minus 50 for every earlier guesser (never below 50)
export function guesserScore(timeLeftFraction: number, orderIndex: number): number {
  const base = 100 + Math.round(400 * clamp01(timeLeftFraction));
  return Math.max(50, base - 50 * orderIndex);
}

// Average guesser score, scaled by the share of players who guessed
export function drawerScore(guesserPoints: number[], totalGuessers: number): number {
  if (guesserPoints.length === 0 || totalGuessers <= 0) return 0;
  const avg = guesserPoints.reduce((a, b) => a + b, 0) / guesserPoints.length;
  return Math.round((avg * guesserPoints.length) / totalGuessers);
}
