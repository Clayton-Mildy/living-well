#!/usr/bin/env node
// One-off converter: design/CitraPremier App.dc.html (Claude Design "dc" template) -> reference JSX.
// Output goes to design/generated/: one file per screen / overlay region, plus pseudo.css for
// style-hover / style-active rules. Generated files are a faithful starting point (exact styles);
// feature code copies from them. Run: pnpm convert
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Parser } from 'htmlparser2';
import { DomHandler } from 'domhandler';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const inName = process.argv[2] || 'CitraPremier App.dc.html';
const src = readFileSync(join(root, 'design', inName), 'utf8');
const outDir = join(root, 'design', process.argv[3] || 'generated');
mkdirSync(outDir, { recursive: true });

const open = src.indexOf('<x-dc>') + '<x-dc>'.length;
const close = src.lastIndexOf('</x-dc>');
let tpl = src.slice(open, close);
// drop <helmet>…</helmet> (global CSS is ported by hand)
const hs = tpl.indexOf('<helmet>'), he = tpl.indexOf('</helmet>');
let base = open;
if (hs >= 0 && he > hs) { base = open + he + '</helmet>'.length; tpl = tpl.slice(he + '</helmet>'.length); }
const lineOf = (offset) => src.slice(0, base + offset).split('\n').length;

const handler = new DomHandler(undefined, { withStartIndices: true, withEndIndices: true });
new Parser(handler, { decodeEntities: true, lowerCaseAttributeNames: true, recognizeSelfClosing: true }).end(tpl);
const dom = handler.dom;

// ---------- helpers ----------
const kebabToCamel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const cssProp = (p) => (p.startsWith('--') ? p : p.startsWith('-webkit-') ? 'Webkit' + kebabToCamel(p.slice(8)).replace(/^./, (c) => c.toUpperCase()) : kebabToCamel(p));
const BIND = /\{\{([\s\S]+?)\}\}/g;
const EVENT = { 'on-click': 'onClick', 'on-change': 'onChange', 'on-key-down': 'onKeyDown', 'on-drag-start': 'onDragStart', 'on-drag-over': 'onDragOver', 'on-drag-end': 'onDragEnd', 'on-drop': 'onDrop', 'on-input': 'onInput', 'on-blur': 'onBlur', 'on-focus': 'onFocus' };
const NUMERIC = new Set(['maxLength', 'tabIndex']);
const VOID = new Set(['input', 'img', 'br', 'hr', 'meta', 'link', 'source', 'path', 'circle', 'rect', 'ellipse', 'line', 'polyline', 'polygon', 'stop', 'col']);
const SVG_TAGS = new Set(['svg', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'g', 'text', 'defs', 'lineargradient', 'stop']);

function expr(path, scope) {
  const p = path.trim();
  if (p === 'true' || p === 'false') return p;
  const head = p.split('.')[0];
  return scope.includes(head) ? p : 'v.' + p;
}
// value with bindings -> JS expression (template literal when mixed)
function valueExpr(raw, scope) {
  const whole = raw.match(/^\s*\{\{([\s\S]+?)\}\}\s*$/);
  if (whole) return expr(whole[1], scope);
  if (!raw.includes('{{')) return JSON.stringify(raw);
  const parts = raw.split(BIND);
  return '`' + parts.map((s, i) => (i & 1 ? '${' + expr(s, scope) + '}' : s.replace(/[`\\]/g, '\\$&').replace(/\$\{/g, '\\${'))).join('') + '`';
}
function splitDecls(css) {
  const out = []; let depth = 0, q = null, cur = '';
  for (const ch of css) {
    if (q) { if (ch === q) q = null; cur += ch; continue; }
    if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
    if (ch === '(') depth++; if (ch === ')') depth--;
    if (ch === ';' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map((d) => d.trim()).filter(Boolean);
}
function styleObj(css, scope) {
  const decls = splitDecls(css).map((d) => {
    // bindings may contain ':' only inside {{ }} – split on first ':' outside braces
    let i = -1, depth = 0;
    for (let k = 0; k < d.length; k++) { if (d[k] === '{') depth++; else if (d[k] === '}') depth--; else if (d[k] === ':' && depth === 0) { i = k; break; } }
    if (i < 0) return null;
    const prop = d.slice(0, i).trim(), val = d.slice(i + 1).trim();
    return `${JSON.stringify(cssProp(prop)).replace(/^"([A-Za-z]+)"$/, '$1')}: ${valueExpr(val, scope)}`;
  }).filter(Boolean);
  return '{ ' + decls.join(', ') + ' }';
}

const pseudo = []; // CSS rules for style-hover / style-active
function pseudoClass(kind, css) {
  const name = `d${kind === 'hover' ? 'h' : 'a'}${pseudo.length + 1}`;
  const body = splitDecls(css).map((d) => d.replace(/\s*$/, '') + ' !important').join('; ');
  pseudo.push(`.${name}:${kind}{${body}}`);
  return name;
}

function attrs(node, scope) {
  const out = []; const classes = [];
  const isSvg = SVG_TAGS.has(node.name);
  for (const [rawName, rawVal] of Object.entries(node.attribs || {})) {
    let name = rawName; const val = rawVal ?? '';
    if (name.startsWith('hint-') || name === 'sc-name' || name === 'data-dc-tpl') continue;
    if (name === 'style') { out.push(`style={${styleObj(val, scope)}}`); continue; }
    if (name === 'style-hover') { classes.push(pseudoClass('hover', val)); continue; }
    if (name === 'style-active') { classes.push(pseudoClass('active', val)); continue; }
    if (name === 'class') { classes.push(val); continue; }
    if (name.startsWith('sc-camel-')) {
      const k = name.slice(9);
      name = EVENT[k] || kebabToCamel(k);
    } else if (name === 'for') name = 'htmlFor';
    else if (name === 'readonly') name = 'readOnly';
    else if (name === 'autofocus') name = 'autoFocus';
    else if (name === 'maxlength') name = 'maxLength';
    else if (name === 'tabindex') name = 'tabIndex';
    else if (isSvg && name.includes('-') && !name.startsWith('aria-') && !name.startsWith('data-')) name = kebabToCamel(name);
    if ((name === 'disabled' || name === 'readOnly' || name === 'autoFocus') && !val.includes('{{')) { out.push(name); continue; }
    if (val.includes('{{')) out.push(`${name}={${valueExpr(val, scope)}}`);
    else if (NUMERIC.has(name) && /^\d+$/.test(val)) out.push(`${name}={${val}}`);
    else out.push(`${name}=${JSON.stringify(val)}`);
  }
  if (classes.length) out.unshift(`className=${JSON.stringify(classes.join(' '))}`);
  return out;
}

function textJsx(raw, scope) {
  if (!raw.trim()) return /\n/.test(raw) ? '' : "{' '}";
  const collapsed = raw.replace(/\s+/g, ' ');
  const parts = collapsed.split(BIND);
  let out = '';
  parts.forEach((s, i) => {
    if (i & 1) { out += '{' + expr(s, scope) + '}'; return; }
    if (!s) return;
    if (/^[^{}<>&]*$/.test(s) && s === s.trim()) out += s;
    else out += '{' + JSON.stringify(s) + '}';
  });
  return out;
}

const regions = []; // { name, value, start, end, jsx }
let registering = true;
const REGION_RE = /^(scr|ov)\.[A-Za-z]+$|^(showLogin|showForm|showApp|demo\.open|barShown|loading|hasToast|pin\.has|showStatus|isReal)$/;
const compName = (v) => v.replace(/(^|\.)([a-z])/g, (_, __, c) => c.toUpperCase()).replace(/\./g, '');

function render(nodes, scope, ind) {
  const pad = '  '.repeat(ind);
  let out = '';
  for (const n of nodes) {
    if (n.type === 'text') { const t = textJsx(n.data, scope); if (t) out += pad + t + '\n'; continue; }
    if (n.type === 'comment' || n.type === 'directive') continue;
    if (n.type !== 'tag' && n.type !== 'script' && n.type !== 'style') continue;
    if (n.name === 'sc-if') {
      const m = (n.attribs.value || '').match(/^\s*\{\{([\s\S]+?)\}\}\s*$/);
      const cond = m ? expr(m[1], scope) : 'false';
      const inner = render(n.children, scope, ind + 2);
      const block = `${pad}{${cond} ? (\n${pad}  <>\n${inner}${pad}  </>\n${pad}) : null}\n`;
      out += block;
      const val = m ? m[1].trim() : '';
      if (registering && REGION_RE.test(val)) {
        registering = false;
        const jsx = `<>\n${render(n.children, scope, 2)}    </>`;
        registering = true;
        regions.push({ name: compName(val), value: val, start: lineOf(n.startIndex), end: lineOf(n.endIndex), jsx });
      }
      continue;
    }
    if (n.name === 'sc-for') {
      const m = (n.attribs.list || '').match(/^\s*\{\{([\s\S]+?)\}\}\s*$/);
      const list = m ? expr(m[1], scope) : '[]';
      const as = n.attribs.as || 'item';
      const idx = `${as}_i`;
      const inner = render(n.children, scope.concat([as, idx]), ind + 2);
      out += `${pad}{(${list} || []).map((${as}: any, ${idx}: number) => (\n${pad}  <Fragment key={${idx}}>\n${inner}${pad}  </Fragment>\n${pad}))}\n`;
      continue;
    }
    const tag = n.name === 'lineargradient' ? 'linearGradient' : n.name;
    const a = attrs(n, scope);
    const head = `<${tag}${a.length ? ' ' + a.join(' ') : ''}`;
    const kids = (n.children || []).filter((c) => !(c.type === 'text' && !c.data.trim() && /\n/.test(c.data)));
    if (VOID.has(tag) || !kids.length) { out += `${pad}${head} />\n`; continue; }
    const onlyText = kids.length === 1 && kids[0].type === 'text';
    if (onlyText) { out += `${pad}${head}>${textJsx(kids[0].data, scope)}</${tag}>\n`; continue; }
    out += `${pad}${head}>\n${render(kids, scope, ind + 1)}${pad}</${tag}>\n`;
  }
  return out;
}

const fullJsx = render(dom, [], 2);
const header = (what) => `// AUTO-GENERATED by scripts/dc2jsx.mjs from design/CitraPremier App.dc.html (${what}).\n// Reference markup with the design's exact styles. \`v\` is the prototype's renderVals() object.\n/* eslint-disable */\n// @ts-nocheck\nimport { Fragment } from 'react';\n\n`;
writeFileSync(join(outDir, 'App.tsx'), header('whole template') + `export function AppTpl({ v }: { v: any }) {\n  return (\n    <>\n${fullJsx}    </>\n  );\n}\n`);
const seen = {};
for (const r of regions) {
  seen[r.name] = (seen[r.name] || 0) + 1;
  const file = r.name + (seen[r.name] > 1 ? seen[r.name] : '') + '.tsx';
  writeFileSync(join(outDir, file), header(`lines ${r.start}–${r.end}, <sc-if value="{{ ${r.value} }}">`) + `export function ${r.name}Tpl({ v }: { v: any }) {\n  return (\n    ${r.jsx}\n  );\n}\n`);
}
writeFileSync(join(outDir, 'pseudo.css'), '/* AUTO-GENERATED: style-hover / style-active rules from the design */\n' + pseudo.join('\n') + '\n');
writeFileSync(join(outDir, 'INDEX.md'), '# Generated regions\n\n| File | Template lines | Condition |\n|---|---|---|\n' + regions.map((r) => `| ${r.name}.tsx | ${r.start}–${r.end} | \`${r.value}\` |`).join('\n') + '\n');
console.log(`Converted: ${regions.length} regions, ${pseudo.length} pseudo-class rules -> design/generated/`);
