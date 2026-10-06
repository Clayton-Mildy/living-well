// Prefix a namespace object's keys: ns('lobby', { a: 'x' }) -> { 'lobby.a': 'x' } (typed).
export type Prefixed<P extends string, T> = { [K in keyof T as `${P}.${K & string}`]: T[K] };
export function ns<P extends string, T extends Record<string, string>>(p: P, o: T): Prefixed<P, T> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(o)) out[`${p}.${k}`] = o[k];
  return out as Prefixed<P, T>;
}
/** ID files are typed against the EN namespace so missing/extra keys fail the typecheck. */
export type Same<T> = { [K in keyof T]: string };
