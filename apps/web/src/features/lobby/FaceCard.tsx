// The face check-in camera card (Prototype v3 secondary card, sits in the Arrivals side rail): idle / scanning / matched.
// MatchedPanel (name, visit line, care flags, extra-day note, confirm) is shared with the bottom sheet that confirms a manual check-in on narrow screens.
import type { ReactNode } from 'react';
import { memberName, type Member } from '@cp/shared';
import { Eyebrow, GROUP_HEAD, Icon } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import type { TFn } from '../../lib/i18n';
import { FlagChip, MemberAvatar, type Flag } from './parts';

export type Scan = { state: 'idle' } | { state: 'scanning'; id: string } | { state: 'matched'; id: string; manual: boolean };
export const SCAN_MS = 1400;

const pulse = (size: number, color: string) => (
  <span aria-hidden="true" style={{ width: size, height: size, borderRadius: 999, background: color, display: 'inline-block', animation: 'cpPulse 1.6s ease-in-out infinite', flex: 'none' }} />
);
const corner = (pos: Record<string, number | string>, borders: Record<string, string>, radius: Record<string, number>) => (
  <div style={{ position: 'absolute', width: 28, height: 28, ...pos, ...borders, ...radius }} />
);

/** Name, visit line (Flex visit n of 10 / Gold), care flags, a note when the visit is an extra day, and the confirm / "not this person" buttons. */
export function MatchedPanel({ t, m, plan, flags, onConfirm, onReject, busy, children, rejectLabel }: {
  t: TFn; m: Member; plan: string; flags: Flag[]; onConfirm: () => void; onReject: () => void; busy?: boolean; children?: ReactNode; /** a face match says "Not this person"; a manual pick just cancels */ rejectLabel?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'cpUp .25s ease-out', flex: 'none' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 22, lineHeight: '28px', fontWeight: 500, letterSpacing: '-0.3px', color: '#2B231C' }}>{memberName(m)}</div>
        <div style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{plan}</div>
      </div>
      {flags.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{flags.map((f, i) => <FlagChip key={i} f={f} />)}</div> : null}
      {children}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className={busy ? undefined : 'h-bronze'} onClick={busy ? undefined : onConfirm} aria-disabled={busy || undefined}
          style={{ flex: '1 1 160px', height: 52, borderRadius: 999, border: 'none', background: busy ? '#EDE5DA' : '#24201C', color: busy ? '#8A8078' : '#FFFFFF', fontSize: 16, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'Inter' }}>
          <Icon name="how_to_reg" size={20} weight={300} />
          {t('lobby.confirmCheckin')}
        </button>
        <button type="button" className="h-cream" onClick={onReject} style={{ flex: '1 1 auto', height: 52, padding: '0 20px', borderRadius: 12, border: '1px solid #DCD3C8', background: '#FFFFFF', color: '#24201C', fontSize: 15, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter' }}>
          {rejectLabel ?? t('lobby.notThem')}
        </button>
      </div>
    </div>
  );
}

export function FaceCard({ t, scan, member, onSimulate, matched }: { t: TFn; scan: Scan; member?: Member; onSimulate: () => void; matched: ReactNode }) {
  const idle = scan.state === 'idle';
  const scanning = scan.state === 'scanning';
  const manual = scan.state === 'matched' && scan.manual;
  const pill = scanning ? { text: t('lobby.recognising'), icon: 'center_focus_strong', bg: '#FFFFFF', fg: '#24201C' } : manual ? { text: t('lobby.manual'), icon: 'touch_app', bg: '#E3EFE6', fg: '#3D6B4F' } : { text: t('lobby.match', { n: 98 }), icon: 'verified', bg: '#E3EFE6', fg: '#3D6B4F' };
  const line = '2px solid #CAB8A2';
  // round 6, phone: an iOS grouped section, the title and the Live pill sit over the group, not inside it
  const { isPhone } = useDevice();
  return (
    <section aria-label={t('lobby.faceCard')} style={isPhone ? { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 } : { background: '#FFFFFF', border: '1px solid #EFE7DC', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--card-shadow)', minWidth: 0 }}>
      <div style={{ padding: isPhone ? '0 4px 0 16px' : '16px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          {isPhone ? <h2 style={GROUP_HEAD}>{t('lobby.faceCheckin')}</h2> : <Eyebrow>{t('lobby.faceCheckin')}</Eyebrow>}
        </div>
        <span style={{ height: 28, padding: '0 11px', borderRadius: 8, background: '#F3EEE8', fontSize: 13, fontWeight: 500, color: '#24201C', display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', flex: 'none' }}>{pulse(7, '#3D6B4F')}{t('lobby.live')}</span>
      </div>
      <div style={isPhone ? { background: '#FFFFFF', borderRadius: 14, overflow: 'hidden', paddingTop: 16 } : { display: 'contents' }}>
      <div style={{ position: 'relative', margin: '0 16px', height: idle ? 176 : 214, borderRadius: 14, background: '#2E2924', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {corner({ top: 16, left: 16 }, { borderTop: line, borderLeft: line }, { borderTopLeftRadius: 10 })}
        {corner({ top: 16, right: 16 }, { borderTop: line, borderRight: line }, { borderTopRightRadius: 10 })}
        {corner({ bottom: 16, left: 16 }, { borderBottom: line, borderLeft: line }, { borderBottomLeftRadius: 10 })}
        {corner({ bottom: 16, right: 16 }, { borderBottom: line, borderRight: line }, { borderBottomRightRadius: 10 })}
        {idle ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center', padding: '0 36px', color: '#F3EEE8' }}>
            <Icon name="face" size={40} color="#CAB8A2" weight={300} />
            <div style={{ fontSize: 17, fontWeight: 500 }}>{t('lobby.standingBy')}</div>
          </div>
        ) : member ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <MemberAvatar m={member} size={104} font={34} ring={scanning ? '#CAB8A2' : '#E3EFE6'} />
              <span style={{ height: 28, padding: '0 12px', borderRadius: 8, background: pill.bg, color: pill.fg, fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                <Icon name={pill.icon} size={16} fill={1} />
                {pill.text}
              </span>
            </div>
            {scanning ? <div style={{ position: 'absolute', left: '12%', right: '12%', height: 2, borderRadius: 2, background: '#CAB8A2', boxShadow: '0 0 14px #CAB8A2', animation: 'cpScan 1.6s ease-in-out infinite' }} /> : null}
          </>
        ) : null}
      </div>
      <div style={{ padding: isPhone ? '14px 16px 16px' : '14px 20px 20px' }}>
        {idle ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button type="button" className="h-cream" onClick={onSimulate} style={{ height: 44, borderRadius: 999, border: '1px solid #DCD3C8', background: '#FFFFFF', color: '#24201C', fontSize: 15, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', fontFamily: 'Inter' }}>
              <Icon name="play_circle" size={20} weight={300} />
              {t('lobby.simulate')}
            </button>
          </div>
        ) : null}
        {scanning ? <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 44, fontSize: 16 }}>{pulse(12, '#75624B')}{t('lobby.recognising')}</div> : null}
        {scan.state === 'matched' ? matched : null}
      </div>
      </div>
    </section>
  );
}
