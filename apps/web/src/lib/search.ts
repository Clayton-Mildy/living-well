// Super search: pure text normalising and ranking. The index (what can be found) is built elsewhere.
export type SearchGroup = 'screens' | 'actions' | 'people' | 'records';
export const SEARCH_GROUPS: SearchGroup[] = ['screens', 'actions', 'people', 'records'];

export interface SearchItem { id: string; group: SearchGroup; label: string; sub?: string; icon: string; to: string; terms: string[] }
export interface SearchHit extends SearchItem { score: number }

/** Lower-case, accents removed, every run of non-letters/digits one space, trimmed. */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/** True when a and b are within one edit (insert, delete or change a letter). Stops early above 1. */
function withinOne(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let min = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      if (v < min) min = v;
    }
    if (min > 1) return false;
    prev = cur;
  }
  return prev[b.length]! <= 1;
}

/** Each query word takes a different term word it is a prefix of. */
function eachOnDifferentWord(qWords: string[], tWords: string[], i = 0, used = new Set<number>()): boolean {
  if (i === qWords.length) return true;
  for (let j = 0; j < tWords.length; j++) {
    if (used.has(j) || !tWords[j]!.startsWith(qWords[i]!)) continue;
    used.add(j);
    if (eachOnDifferentWord(qWords, tWords, i + 1, used)) return true;
    used.delete(j);
  }
  return false;
}

/** q and term are already normalised. 100 exact, 80 prefix, 60 word prefix, 40 several words, 20 typo, 0 none. */
export function scoreTerm(q: string, term: string): number {
  if (!q || !term) return 0;
  if (term === q) return 100;
  if (term.startsWith(q)) return 80;
  const tWords = term.split(' ');
  const qWords = q.split(' ');
  if (tWords.some((w) => w.startsWith(q))) return 60;
  if (qWords.length > 1 && eachOnDifferentWord(qWords, tWords)) return 40;
  const near = (qw: string) =>
    tWords.some((w) => w.startsWith(qw)) ||
    (qw.length >= 4 && tWords.some((w) => withinOne(qw, w) || withinOne(qw, w.slice(0, qw.length))));
  return qWords.every(near) ? 20 : 0;
}

/** The best score over the label, the sub line and the keywords. */
export function scoreItem(q: string, item: SearchItem): number {
  let best = 0;
  for (const t of [item.label, item.sub ?? '', ...item.terms]) best = Math.max(best, scoreTerm(q, normalize(t)));
  return best;
}

export function rank(items: SearchItem[], query: string, perGroup = 6): { group: SearchGroup; hits: SearchHit[] }[] {
  const q = normalize(query);
  if (!q) return [];
  const hits = items.map((i): SearchHit => ({ ...i, score: scoreItem(q, i) })).filter((h) => h.score > 0);
  return SEARCH_GROUPS.map((group) => ({
    group,
    hits: hits
      .filter((h) => h.group === group)
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
      .slice(0, perGroup),
  })).filter((g) => g.hits.length > 0);
}
