#!/usr/bin/env node
// One-off (KC round 5: "reduce all the border radius a bit, is too circle"): tighter corners everywhere.
// Numeric radii step down; pill-shaped controls (radius 999 with a height and horizontal padding) become rounded rectangles.
// Avatars, dots, counters and switches (999 without horizontal padding) stay round.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const STEP = { 32: 22, 28: 20, 26: 18, 24: 16, 22: 16, 20: 14, 18: 14, 16: 12, 14: 10, 13: 10, 12: 8, 10: 8 };
const step = (n) => STEP[n] ?? n;
let files = 0, hits = 0;
function fixObj(obj) {
  // obj = the text of one style object literal
  let o = obj.replace(/borderRadius: (\d+)(?=[,\s}])/g, (m, n) => { const v = step(+n); if (v !== +n) hits++; return `borderRadius: ${v}`; });
  o = o.replace(/borderRadius: '([^']+)'/g, (m, v) => { const r = v.replace(/(\d+)px/g, (x, n) => `${step(+n)}px`); if (r !== v) hits++; return `borderRadius: '${r}'`; });
  if (/borderRadius: 999\b/.test(o)) {
    const h = o.match(/\bheight: (\d+)/);
    const pad = /padding: '(\d+px )?\d+px \d+px|padding: '0 \d+px|padding: '\d+px \d+px'/.test(o) && !/padding: '\d+px'/.test(o.match(/padding: '[^']*'/)?.[0] || '');
    const square = (() => { const w = o.match(/\bwidth: (\d+)/); return w && h && w[1] === h[1]; })();
    if (pad && !square) { const v = h && +h[1] < 34 ? 8 : 12; o = o.replace(/borderRadius: 999\b/, `borderRadius: ${v}`); hits++; }
  }
  return o;
}
function fix(p) {
  const s = readFileSync(p, 'utf8');
  // style objects: {{ ... }} and plain object literals on one line containing borderRadius
  const o = s.replace(/\{[^{}\n]*borderRadius[^{}\n]*\}/g, fixObj);
  if (o !== s) { writeFileSync(p, o); files++; }
}
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(f) && !/\.test\./.test(f)) fix(p); } };
for (const a of process.argv.slice(2)) (statSync(a).isDirectory() ? walk(a) : fix(a));
console.log(`${hits} radius changes in ${files} files`);
