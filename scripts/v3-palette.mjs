#!/usr/bin/env node
// One-off: swap the old palette for Prototype v3's warmer, deeper one (round 4 restyle).
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const MAP = {
  '#F6F5F5': '#F6F1EA', '#282828': '#24201C', '#6A6967': '#5E5852', '#DBD7D6': '#E4DACD', '#EFECEA': '#F0EAE1',
  '#F4F0EE': '#F3EEE8', '#AF4B2F': '#9A3D24', '#F7E4DD': '#F9E3DB', '#E6EFE8': '#E3EFE6', '#FBFAF9': '#FBF8F4',
  '#9A836C': '#2B231C', '#F7F5F3': '#F7F3EE',
};
const re = new RegExp(Object.keys(MAP).join('|'), 'gi');
const roots = process.argv.slice(2);
let files = 0, hits = 0;
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (f !== 'node_modules') walk(p); } else if (/\.(tsx?|css)$/.test(f)) fix(p); } };
function fix(p) {
  const s = readFileSync(p, 'utf8');
  let n = 0;
  let o = s.replace(re, (m) => { n++; return MAP[m.toUpperCase()]; });
  // primary fills go from bronze to ink; bronze stays for links/accents
  o = o.replace(/background: '#75624B'/g, () => { n++; return "background: '#24201C'"; });
  if (n) { writeFileSync(p, o); files++; hits += n; }
}
roots.forEach(walk);
console.log(`${hits} swaps in ${files} files`);
