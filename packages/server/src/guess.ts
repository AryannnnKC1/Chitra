export const normalize = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ');

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n];
}

export type GuessResult = 'correct' | 'close' | 'wrong';

export function judgeGuess(guess: string, word: string): GuessResult {
  const g = normalize(guess);
  const w = normalize(word);
  if (g === w) return 'correct';
  if (w.length >= 4 && levenshtein(g, w) === 1) return 'close';
  return 'wrong';
}
