// Reset a form in the render where it opens (or switches to another record), before paint.
// An effect would run after paint and could wipe what the user (or a fast test) types first.
import { useState } from 'react';

/** Calls `reset` when `key` changes to a non-null value, e.g. `useResetOn(open ? 'open' : null, ...)` or `useResetOn(open ? photo.id : null, ...)`. */
export function useResetOn(key: string | null, reset: () => void) {
  const [last, setLast] = useState<string | null>(key);
  if (key !== last) {
    setLast(key);
    if (key !== null) reset();
  }
}
