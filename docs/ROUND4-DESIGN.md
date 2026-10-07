# Round 4: premium restyle to Prototype v3

**Why.** KC says the current UI "feels like a notebook where everything is put on the page". CitraPremier is a premium clubhouse, so the app has to look premium. Every core feature stays.

**Reference**
- `design/CitraPremier App v3.dc.html` is the prototype template.
- `design/generated-v3/Scr*.tsx` holds each prototype screen as JSX with exact styles.
- `design/generated-v3/logic.js` holds the prototype's data and colour logic: tabs, chips, selection states.

## Decisions (KC, 2026-10-06)
1. **Full fidelity.** Re-lay each screen like its prototype screen, not just recolour it. Screens the prototype lacks get the same language.
2. **Our features win.** The prototype is a visual reference only. Where it conflicts with the app's behaviour, keep the app. Examples: its health station has a queue, "Still needed" and "Skip for now"; its trial shows a 10:30 time; its staff names are old. Never remove an action, flow, field, dialog, permission or data point. Move it, restyle it or tuck it away instead.
3. **Quiet list rows.** A list row shows only the name, one sub line and one action. A safety-critical allergy may also show, as a red dot plus text: `#A2452B`, a 6px dot, 14px/500. Any other tags (walking stick, diet, lunch, health check, etc.) come off list rows. They must still be visible in the member drawer or profile; check that before you remove them.
4. **Primary buttons are ink `#24201C`.** Bronze `#75624B` is for links and small accents only.
5. **Phone first.** About 90% of users are on phones.
   - Keep phone screens dense.
   - No page descriptions on phone (`cp-desc`).
   - Long filter rows become one dropdown (`FilterChips` already does this).
   - Cards show the key number only.
   - Check the 390px view above the fold.

## Done for you (do not redo or edit)
- **Palette swapped app-wide.**
  - Page `#F5F5F3` (white grey, KC round 5), ink `#24201C`, deep ink for titles `#2B231C`.
  - Secondary text `#5E5852`, with `#6B6259` for row sub lines. Eyebrow labels `#6E5A43`.
  - Borders `#E4DACD`, card border `#EFE7DC`, row hairline `#F0EAE1`, field border `#DDD1C2`, chip border `#DCD3C8`.
  - Cream fill `#F3EEE8`. Rust `#9A3D24` on `#F9E3DB`. Sage `#3D6B4F`/`#2F5A40` on `#E3EFE6`/`#EAF1EC`. Ochre `#7A5510` on `#F6ECD6`.
- **Primitives in `components/ui` are restyled:**
  - `Card` (soft shadow by default) and `CardHead`.
  - `Button` (52/44/40 tall, ink primary, `secondary` = white with a `#DCD3C8` border, `quiet` = cream fill).
  - `Chip`, `InfoChip`, `StatusBadge`, `Row`, `RowText`, `Segmented` (track `#EDE5DA`), `TextField`, `Select`/`DateField`.
  - `PageHead`: light display title, eyebrow `12px / 2px tracking / #6E5A43`.
  - `EmptyState`, `Pin`, `Note`, `Sheet`, `Dialog` and `Drawer`.
- **Shell:** floating white sidebar card on tablet and laptop, cream phone header, and a floating pill bottom nav.
- **CSS variables** in `styles/global.css`: `--card-shadow`, `--card-bd`, `--row-line`, `--eyebrow`, `--field-bd`.

**Do not edit** `components/ui/*`, `shell/*`, `styles/*`, `app/*` or `packages/shared/*`. Another agent works there. If you need a primitive change, say so in your report. Feature-local copies of styles are fine.

## The v3 language (copy these patterns)
- **Page header.**
  - Eyebrow first: `12px, letter-spacing 2px, uppercase, 500, #6E5A43` (date or context).
  - Then the title: `font-weight 400, letter-spacing -1.2px, line-height 1.05, #2B231C`, `clamp(32px, 3.6vw, 48px)` on wide screens. `PageHead` does this.
  - An optional status line: a 7px dot plus 14px `#6B6259` text, e.g. "● Club open until 16:30".
  - A big clock or count on the right on laptop: `48px / 300 / -1.5px`.
- **Number tabs instead of stat tiles.** Wherever the old UI had tiles or a "Check in / Check out" segmented switch with counts, use the v3 number tabs.
  - A grid of up to 3 columns, max-width 640.
  - Each tab is a button: a number at `clamp(32px, 3.8vw, 44px) / 300 / -1px`, a label at `13px`, and a `2px` bottom border, ink when selected and `#E6DDD1` otherwise.
  - Unselected numbers and labels are `#8A8078`.
  - See `ScrArrivals.tsx` and `logic.js` `lb3.tabs`.
- **One hero card per screen.**
  - `background #FFF; border 1px solid #EFE7DC; border-radius 24–28px; box-shadow 0 1px 2px rgba(60,40,20,.04), 0 18px 40px rgba(60,40,20,.07)`.
  - Inner padding `8px clamp(18px,3vw,36px) 12px`.
  - Rows sit inside that padding with `border-top: 1px solid #F0EAE1` and `padding: 18px 0`, so the hairlines are inset rather than edge to edge.
  - Card title: an eyebrow on the left and an underline search on the right (`border-bottom 1px solid #DDD1C2`, search icon, borderless input).
- **List row.** A 46px avatar, then the name at `17px/500` and a sub line at `14px #6B6259` with inline dot-status items. One pill button on the right: `40px`, ink fill for the primary action, or white with a `#DCD3C8` border for secondary.
- **Side rail (aside), with no box.**
  - On laptop, the main card is `flex: 1 1 440px` and the rail `flex: 0 1 300px`, gap `clamp(24px, 4vw, 56px)`. On phone the rail drops below.
  - The rail has an eyebrow, then plain blocks: a 19px/500 title, a 14px sub line and an underlined link, separated by `1px #E6DDD1` lines.
  - Quick links are 14px text with a 19px light icon and an `arrow_forward`.
- **Secondary panels** (detail panes, queues, forms) use the same card at a 24px radius with the `--card-shadow`. Never put a card inside a card for decoration. Inside a card, group with hairlines and whitespace instead of nested borders.
- **Selection in a list:** row bg `#FBF8F4` plus a 3px left bar `#2B231C` (see `logic.js` `bar:`).
- **Segmented tabs:** track `#EDE5DA`. The selected item is white with a `0 1px 3px rgba(40,30,20,.14)` shadow and weight 600.
- **Typography scale.** Body is mostly 14–15px. Row titles are 15–17px/500. Section titles are 19–22px/400–500. Fewer bold weights; prefer 500. Large numbers are weight 300.
- **Fewer boxes and chips.** Replace chip clusters with a dot plus text, or a single quiet line joined by `·`. Badges only for real status (paid, overdue, alert).
- **Whitespace over borders.** Use bigger gaps between sections (`clamp(18px, 2.8vw, 36px)`), not more boxes.

## Rules
- **Keep these exactly** so tests and e2e keep working: every accessible name, role, `aria-*`, `data-*`, the visible button labels and i18n keys. If you change visible copy, add or adjust keys in the `lib/i18n` dictionaries for both EN and ID. Keep those edits small and targeted, because other agents edit the same file. Prefer reusing existing keys.
- **Use i18n.** Strings go through `t()`; never hard-code English.
- **Don't run e2e or start servers, and don't use the browser.** The lead does the visual check and runs the e2e pass.
- **Verify** with `pnpm --filter @cp/web exec tsc --noEmit -p .` and `pnpm vitest run apps/web/src/features/<yours>` from the repo root.
- **Unit tests:** update only where the restyle intentionally changed what renders (e.g. tags removed from rows). Never weaken a behaviour test.
- **Report back:** the files you changed, any feature moved (and where to), any primitive request, and anything you were unsure about.
