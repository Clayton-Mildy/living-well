// Design System page (port of "Design System.dc.html"), rendering the app's real primitives so it stays truthful.
import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Button, Card, Chip, EmptyState, Icon, InfoChip, Logo, SkeletonRows, StatusBadge, TextField, Toggle } from '../../components/ui';

const label: CSSProperties = { fontSize: 13, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 500, color: '#5E5852' };
const h2: CSSProperties = { margin: 0, fontSize: 36, lineHeight: '44px', fontWeight: 400, letterSpacing: '-0.5px', color: '#2B231C' };
const note: CSSProperties = { fontSize: 14, color: '#5E5852', lineHeight: '20px' };
function Section({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><div style={label}>{n}</div><h2 style={h2}>{title}</h2></div>
      {children}
    </section>
  );
}
const SWATCHES: [string, string, string, ReactNode?][] = [
  ['Page', '#F5F5F3', 'app background (white grey)'], ['Cream', '#F3EEE8', 'side nav, inset panels'], ['Linen', '#E8E1D8', 'selected, chips. Ink text only'], ['Sand', '#CAB8A2', 'decoration, booked days'],
  ['Border', '#E4DACD', 'card edges, dividers'], ['Bronze heading', '#2B231C', 'headings 24px and up only (3.6:1)', <span key="a" style={{ color: '#FFFFFF', fontSize: 28, letterSpacing: '-0.5px' }}>Aa 24+</span>],
  ['Bronze accent', '#8A755B', 'icons, input borders, rules'], ['Bronze-700', '#75624B', 'primary buttons, links, focus', <span key="b" style={{ color: '#FFFFFF', fontSize: 16 }}>White on bronze-700 · 5.8:1</span>],
  ['Ink', '#24201C', 'body text, names, values', <span key="c" style={{ color: '#FFFFFF', fontSize: 16 }}>14.9:1 on white</span>], ['Slate', '#5E5852', 'secondary text. Not on linen', <span key="d" style={{ color: '#FFFFFF', fontSize: 16 }}>5.5:1 on white</span>],
  ['Rust', '#9A3D24', 'Alert and Overdue only', <span key="e" style={{ color: '#FFFFFF', fontSize: 16 }}>White on rust · 5.4:1</span>],
];
const TYPE: [string, CSSProperties, string][] = [
  ['Display · 56/64', { fontSize: 56, lineHeight: '64px', letterSpacing: '-0.5px', color: '#2B231C' }, 'Good morning'],
  ['H1 · 40/48', { fontSize: 40, lineHeight: '48px', letterSpacing: '-0.5px', color: '#2B231C' }, 'Arrivals'],
  ['H2 · 28/36', { fontSize: 28, lineHeight: '36px', letterSpacing: '-0.5px', color: '#2B231C' }, 'Today at the club'],
  ['H3 · 20/28 ink', { fontSize: 20, lineHeight: '28px', letterSpacing: '-0.3px', color: '#24201C' }, 'Oma Lina Wijaya'],
  ['Body · 16/24', { fontSize: 16, lineHeight: '24px' }, 'Oma Lina sang Bengawan Solo for the group and the whole room joined in.'],
  ['Small · 14/20 slate', { fontSize: 14, lineHeight: '20px', color: '#5E5852' }, 'Arrived 09:52 · checked in by Caca'],
  ['Label · 13 caps +1.5', { fontSize: 13, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 500, color: '#5E5852' }, 'Wednesday 21 October'],
  ['Reading · 40 light, tabular', { fontSize: 40, lineHeight: '48px', fontWeight: 300, fontVariantNumeric: 'tabular-nums', letterSpacing: '-1px' }, '128/80'],
];

export function DesignSystem() {
  return (
    <div style={{ position: 'fixed', inset: 0, overflowY: 'auto', background: '#F5F5F3', color: '#24201C' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 24px 96px', display: 'flex', flexDirection: 'column', gap: 72 }}>
        <header style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <Logo height={72} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 760 }}>
            <div style={label}>CitraPremier | Premium Seniors Club · Operations app</div>
            <h1 style={{ margin: 0, fontSize: 56, lineHeight: '64px', fontWeight: 400, letterSpacing: '-0.5px', color: '#2B231C' }}>Design system</h1>
            <p style={{ margin: 0, fontSize: 18, lineHeight: '28px', textWrap: 'pretty' } as CSSProperties}>
              More hospitality, less hospital. The website&apos;s warm palette, adjusted so every piece of text passes WCAG AA, every target is at least 44px, and health and payment status always carry an icon and a label.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', paddingTop: 8 }}>
              <Link to="/today" style={{ height: 48, padding: '0 24px', borderRadius: 12, background: '#24201C', color: '#FFFFFF', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 500 }}>Open the app<Icon name="arrow_forward" size={20} /></Link>
            </div>
          </div>
          <div style={note}>Brand: the CitraPremier logo (logo-cp.jpg) replaces the text wordmark everywhere it appeared. It is blended with multiply so its white background disappears on cream. Swap in a vector logo when the brand files provide one.</div>
        </header>

        <Section n="01" title="Colour roles">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 16 }}>
            {SWATCHES.map(([name, hex, use, sample]) => (
              <Card key={name} style={{ borderRadius: 14 }}>
                <div style={{ height: 88, background: hex, borderBottom: '1px solid #E4DACD', display: 'flex', alignItems: 'flex-end', padding: '12px 16px' }}>{sample}</div>
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 4 }}><div style={{ fontSize: 16, fontWeight: 500 }}>{name}</div><div style={{ fontSize: 14, color: '#5E5852' }}>{hex} · {use}</div></div>
              </Card>
            ))}
            <Card style={{ borderRadius: 14 }}>
              <div style={{ height: 88, display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                <div style={{ background: '#E3EFE6', display: 'flex', alignItems: 'flex-end', padding: 12, color: '#3D6B4F', fontSize: 14, fontWeight: 500 }}>Normal</div>
                <div style={{ background: '#F6ECD6', display: 'flex', alignItems: 'flex-end', padding: 12, color: '#7A5510', fontSize: 14, fontWeight: 500 }}>Watch</div>
              </div>
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 4 }}><div style={{ fontSize: 16, fontWeight: 500 }}>Status support</div><div style={{ fontSize: 14, color: '#5E5852' }}>Sage #3D6B4F / #E3EFE6 · ochre #7A5510 / #F6ECD6</div></div>
            </Card>
          </div>
        </Section>

        <Section n="02" title="Type scale · Inter">
          <Card style={{ padding: '8px 28px' }}>
            {TYPE.map(([k, st, sample], i) => (
              <div key={k} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px,180px) minmax(0,1fr)', gap: 24, alignItems: 'baseline', padding: '20px 0', borderBottom: i < TYPE.length - 1 ? '1px solid #F0EAE1' : 'none' }}>
                <div style={{ fontSize: 14, color: '#5E5852' }}>{k}</div>
                <div style={st}>{sample}</div>
              </div>
            ))}
          </Card>
          <div style={note}>Headings are regular weight with −0.5px tracking. Bronze is reserved for 24px and larger; anything smaller is ink.</div>
        </Section>

        <Section n="03" title="Buttons">
          <Card style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <Button size={56} icon="how_to_reg">Confirm check-in</Button>
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Tell family now</Button>
              <Button disabled>Disabled</Button>
              <button type="button" aria-label="Close" style={{ height: 44, width: 44, borderRadius: 999, border: '1px solid #E4DACD', background: '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="close" /></button>
            </div>
            <div style={note}>Sizes: 56px for kiosk and tablet primary actions, 48px default, 44px minimum. Focus: 2px bronze-700 ring with 2px offset. Pressed: one shade darker (#5E4E3B).</div>
          </Card>
        </Section>

        <Section n="04" title="Inputs and chips">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16 }}>
            <Card style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <TextField label="Mobile number" value="812 1090 4471" onChange={() => {}} prefix="+62" inputMode="tel" />
              <TextField label="Error" value="0812 0000" onChange={() => {}} error="We don't recognise this number. Ask the club to add you." />
              <Toggle on label="Face recognition at the door" sub="If off, the lobby checks in by name instead." onClick={() => {}} />
            </Card>
            <Card style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ ...label, color: '#24201C' }}>Filter chips</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}><Chip selected>Family event</Chip><Chip>Feeling unwell</Chip><Chip>Doctor&apos;s appointment</Chip><Chip off>Closed</Chip></div>
              <div style={{ ...label, color: '#24201C' }}>Info chips</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <InfoChip tone="rust" icon="no_food" label="Shellfish allergy" />
                <InfoChip icon="elderly" label="Walking stick" />
                <InfoChip icon="medication" label="Calcium + Vit D with lunch" />
                <InfoChip tone="cream" label="Flex · 10 days" />
                <InfoChip tone="ink" label="Gold · unlimited" />
              </div>
            </Card>
          </div>
        </Section>

        <Section n="05" title="Status badges">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16 }}>
            <Card style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ ...label, color: '#24201C' }}>Health</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}><StatusBadge kind="normal" /><StatusBadge kind="watch" /><StatusBadge kind="alert" /></div>
              <div style={note}>BP: Watch at 140/90, Alert at 160/100 or under 90. SpO₂: Watch under 95%, Alert under 92%. Glucose: Watch over 180, Alert over 250 or under 70. Temperature: Watch from 37.5, Alert from 38 or under 35.5. Pulse: Watch outside 60–100, Alert under 50 or over 120. Weight: Watch on a 3 kg change.</div>
            </Card>
            <Card style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ ...label, color: '#24201C' }}>Payment</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}><StatusBadge kind="paid" /><StatusBadge kind="outstanding" /><StatusBadge kind="partial" /><StatusBadge kind="overdue" /></div>
              <div style={note}>Every status is an icon plus a word, so it reads the same in greyscale and to a screen reader.</div>
            </Card>
          </div>
        </Section>

        <Section n="06" title="Cards and member avatar">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16, alignItems: 'start' }}>
            <Card shadow style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <Avatar name="Oma Lina Wijaya" tone={0} size={72} ring />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}><div style={{ fontSize: 20, lineHeight: '28px', letterSpacing: '-0.3px' }}>Oma Lina Wijaya</div><div style={{ fontSize: 14, color: '#5E5852' }}>81 · Flex plan · member since March 2025</div></div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}><InfoChip tone="rust" icon="no_food" label="Shellfish" /><InfoChip icon="elderly" label="Walking stick" /></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, background: '#E3EFE6', color: '#3D6B4F' }}>
                <Icon name="check_circle" size={24} fill={1} />
                <div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 16, fontWeight: 600 }}>At the club since 10:04</span><span style={{ fontSize: 14, color: '#24201C' }}>Brought by Maria · checked in by Caca</span></div>
              </div>
            </Card>
            <Card>
              <div style={{ padding: '16px 20px', ...label, color: '#24201C' }}>Member row</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderTop: '1px solid #F0EAE1' }}>
                <Avatar name="Opa Hendra Gunawan" tone={1} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}><div style={{ fontSize: 17, fontWeight: 500 }}>Opa Hendra Gunawan</div><div style={{ fontSize: 14, color: '#5E5852' }}>Arrived 09:40 · Pak Joko</div></div>
                <StatusBadge kind="watch" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderTop: '1px solid #F0EAE1' }}>
                <Avatar name="Oma Lina Wijaya" tone={0} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}><div style={{ fontSize: 17, fontWeight: 500 }}>Oma Lina Wijaya</div><div style={{ fontSize: 14, color: '#5E5852' }}>Usually around 10:05 · Maria</div></div>
                <Button variant="secondary" size={44}>Check in</Button>
              </div>
              <div style={{ padding: '14px 20px', borderTop: '1px solid #F0EAE1', ...note }}>Avatars show the member&apos;s face photo; initials on warm tones until a photo is on file.</div>
            </Card>
          </div>
        </Section>

        <Section n="07" title="Empty and loading states">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16, alignItems: 'start' }}>
            <Card><EmptyState icon="done_all" title="Everyone in the club has been checked" sub="New arrivals join this queue automatically when the lobby checks them in." /></Card>
            <Card><div style={{ padding: '16px 20px', ...label, color: '#24201C' }}>Loading · skeleton rows</div><SkeletonRows n={3} label="Loading members" /></Card>
          </div>
        </Section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 28, borderRadius: 16, background: '#F3EEE8' }}>
          <h2 style={{ margin: 0, fontSize: 28, lineHeight: '36px', fontWeight: 400, letterSpacing: '-0.5px', color: '#75624B' }}>Rules for every screen</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: '16px 32px', fontSize: 16, lineHeight: '24px' }}>
            <div>Staff never type something the app already knows. Pick from what&apos;s on file; devices fill readings.</div>
            <div>Members by name, with Oma / Opa / Ibu / Bapak. Never &quot;patient&quot;.</div>
            <div>Touch targets at least 44px; 56px for the kiosk and tablet primary action.</div>
            <div>Body text ink or slate only. Bronze #2B231C only at 24px and above.</div>
            <div>Status is always icon + label. Rust means Alert or Overdue, nothing else.</div>
            <div>Staff-only information carries a lock and the words &quot;Staff only&quot;.</div>
            <div>Customer changes by non-management staff go to management for review; health edits apply at once and are reviewed afterwards.</div>
            <div>Every screen works in English and Bahasa Indonesia, phone first.</div>
          </div>
        </section>
      </div>
    </div>
  );
}
