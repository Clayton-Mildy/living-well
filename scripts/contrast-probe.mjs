// Round 8c (temporary): the contrast probe shared by contrast-audit.mjs and contrast-overlays.mjs (runs inside the page).
export const probe = () => {
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map((x) => parseFloat(x)); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const hex = (c) => '#' + [c.r, c.g, c.b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('').toUpperCase();
  const diff = (a, b) => Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b));
  const solid = (el) => { const cs = getComputedStyle(el); if (cs.backgroundImage && cs.backgroundImage !== 'none') return 'img'; const c = parse(cs.backgroundColor); return c && c.a > 0.5 ? c : null; };
  const behind = (el) => { let p = el.parentElement; while (p) { const c = solid(p); if (c === 'img') return null; if (c) return { c, el: p }; p = p.parentElement; } return { c: { r: 255, g: 255, b: 255, a: 1 }, el: document.body }; };
  const edged = (cs, c) => {
    const sides = ['Top', 'Right', 'Bottom', 'Left'];
    const border = sides.some((s) => parseFloat(cs['border' + s + 'Width']) > 0 && cs['border' + s + 'Style'] !== 'none' && (() => { const bc = parse(cs['border' + s + 'Color']); return bc && bc.a > 0.2 && diff(bc, c) > 10; })());
    const shadow = cs.boxShadow && cs.boxShadow !== 'none';
    const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
    return border || shadow || outline;
  };
  const isControl = (el) => {
    const tag = el.tagName;
    if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(tag)) return true;
    const role = el.getAttribute('role');
    return !!role && ['button', 'radio', 'tab', 'switch', 'checkbox', 'combobox', 'textbox', 'option', 'link'].includes(role);
  };
  const label = (el) => {
    const id = el.getAttribute('data-testid') || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '';
    const txt = (el.innerText || el.value || '').trim().replace(/\s+/g, ' ').slice(0, 50);
    return `${el.tagName.toLowerCase()}${id ? '[' + id.slice(0, 40) + ']' : ''} "${txt}"`;
  };
  const main = document.querySelector('#main') || document.body;
  const scope = [main, ...document.querySelectorAll('[role="dialog"], nav')];
  const hits = [];
  const seen = new Set();
  for (const root of scope) for (const el of root.querySelectorAll('*')) {
    if (seen.has(el)) continue; seen.add(el);
    const r = el.getBoundingClientRect();
    if (r.width < 16 || r.height < 16) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.3) continue;
    const c = solid(el);
    if (!c || c === 'img') continue;
    const b = behind(el);
    if (!b) continue;
    const d = diff(c, b.c);
    if (d > 7) continue; // clearly different: fine
    if (edged(cs, c)) continue;
    const radius = parseFloat(cs.borderTopLeftRadius) || 0;
    const control = isControl(el);
    const surface = radius >= 8 && (r.width < b.el.getBoundingClientRect().width - 6 || r.height < b.el.getBoundingClientRect().height - 6);
    if (!control && !surface) continue;
    // a control whose own fill equals what's behind it is invisible as a shape (fine for text buttons: they have no fill of their own → skipped above)
    hits.push({ kind: d === 0 ? 'same' : 'faint', what: label(el), fill: hex(c), behind: hex(b.c), control, w: Math.round(r.width), h: Math.round(r.height) });
    el.setAttribute('data-audit-hit', d === 0 ? 'same' : 'faint');
  }
  // two same-coloured blocks (not the page colour) stacked with no gap read as one: flag the second
  for (const root of scope) for (const el of root.querySelectorAll('*')) {
    const c = solid(el); if (!c || c === 'img') continue;
    const b = behind(el); if (!b || diff(c, b.c) <= 7) continue; // only blocks that stand out from what's behind them
    const sib = el.nextElementSibling; if (!sib) continue;
    const c2 = solid(sib); if (!c2 || c2 === 'img' || diff(c, c2) > 3) continue;
    const r1 = el.getBoundingClientRect(), r2 = sib.getBoundingClientRect();
    if (r1.height < 16 || r2.height < 16) continue;
    const gapY = r2.top - r1.bottom, gapX = r2.left - r1.right;
    const touching = (gapY >= -1 && gapY < 3 && Math.abs(r1.left - r2.left) < 40) || (gapX >= -1 && gapX < 3 && Math.abs(r1.top - r2.top) < 40);
    if (!touching) continue;
    const cs2 = getComputedStyle(sib);
    if (edged(cs2, c2) || edged(getComputedStyle(el), c)) continue;
    if (cs2.borderTopStyle !== 'none' && parseFloat(cs2.borderTopWidth) > 0) continue; // a hairline divides them
    hits.push({ kind: 'touch', what: label(sib), fill: hex(c2), behind: hex(c), control: false, w: Math.round(r2.width), h: Math.round(r2.height) });
    sib.setAttribute('data-audit-hit', 'same');
  }
  const st = document.createElement('style');
  st.textContent = '[data-audit-hit="same"]{outline:3px solid #E5484D !important; outline-offset:-1px} [data-audit-hit="faint"]{outline:3px dashed #F59E0B !important; outline-offset:-1px}';
  document.head.appendChild(st);
  return hits;
};

