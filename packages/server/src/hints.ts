const isLetter = (ch: string): boolean => /[\p{L}\p{N}]/u.test(ch);

// 'apple' with {0} revealed becomes 'a _ _ _ _'. Spaces and hyphens stay visible.
export function maskWord(word: string, revealed: Set<number> = new Set()): string {
  return [...word]
    .map((ch, i) => (isLetter(ch) ? (revealed.has(i) ? ch : '_') : ch))
    .join(' ');
}

// Picks a hidden letter to reveal. Returns null once half the letters are shown.
export function pickHintIndex(
  word: string,
  revealed: Set<number>,
  rand: () => number = Math.random,
): number | null {
  const letters = [...word].map((ch, i) => (isLetter(ch) ? i : -1)).filter((i) => i >= 0);
  if (revealed.size >= Math.floor(letters.length / 2)) return null;
  const hidden = letters.filter((i) => !revealed.has(i));
  if (hidden.length === 0) return null;
  return hidden[Math.floor(rand() * hidden.length)];
}
