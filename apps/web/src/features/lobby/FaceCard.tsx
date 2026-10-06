// The face check-in camera card (design ScrLobby template): idle / scanning / matched.
// MatchedPanel (name, visit line, care flags, extra-day note, confirm) is shared with the bottom sheet that confirms a manual check-in on narrow screens.
import type { ReactNode } from 'react';
import { memberName, type Member } from '@cp/shared';
import { FONT_BODY, FONT_SMALL, Icon } from '../../components/ui';
import type { TFn } from '../../lib/i18n';
import { FlagChip, MemberAvatar, type Flag } from './parts';

export type Scan = { state: 'idle' } | { state: 'scanning'; id: string } | { state: 'matched'; id: string; manual: boolean };
export const SCAN_MS = 1400;

const pulse = (size: number, color: string) => (
  <span aria-hidden="true" style={{ width: size, height: size, borderRadius: 999, background: color, display: 'inline-block', animation: 'cpPulse 1.6s ease-in-out infinite', flex: 'none' }} />
);
const corner = (pos: Record<string, number | string>, borders: Record<string, string>, radius: Record<string, number>) => (
  <div style={{ position: 'absolute', width: 36, height: 36, ...pos, ...borders, ...radius }} />
);

/** Name, visit line (Flex visit n of 10 / Gold), care flags, a note when the visit is an extra day, and the confirm / "not this person" buttons. */
export function MatchedPanel({ t, m, plan, flags, onConfirm, onReject, busy, children }: {
  t: TFn; m: Member; plan: string; flags: Flag[]; onConfirm: () => void; onReject: () => void; busy?: boolean; children?: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'cpUp .25s ease-out', flex: 'none' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 26, lineHeight: '32px', letterSpacing: '-0.5px' }}>{memberName(m)}</div>
        <div style={{ fontSize: 16, color: '#6A6967', lineHeight: 1.4 }}>{plan}</div>
      </div>
      {flags.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{flags.map((f, i) => <FlagChip key={i} f={f} />)}</div> : null}
      {children}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className={busy ? undefined : 'dh17'} onClick={busy ? undefined : onConfirm} aria-disabled={busy || undefined}
          style={{ flex: '1 1 200px', height: 56, borderRadius: 999, border: 'none', background: busy ? '#E8E1D8' : '#75624B', color: busy ? '#6A6967' : '#FFFFFF', fontSize: 17, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'Inter' }}>
          <Icon name="how_to_reg" size={22} />
          {t('lobby.confirmCheckin')}
        </button>
        <button type="button" onClick={onReject} style={{ flex: '0 1 auto', height: 56, padding: '0 20px', borderRadius: 999, border: '1px solid #75624B', background: '#FFFFFF', color: '#75624B', fontSize: 16, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter' }}>
          {t('lobby.notThem')}
        </button>
      </div>
    </div>
  );
}

export function FaceCard({ t, scan, member, onSimulate, matched }: { t: TFn; scan: Scan; member?: Member; onSimulate: () => void; matched: ReactNode }) {
  const idle = scan.state === 'idle';
  const scanning = scan.state === 'scanning';
  const manual = scan.state === 'matched' && scan.manual;
  const pill = scanning ? { text: t('lobby.recognising'), icon: 'center_focus_strong', bg: '#FFFFFF', fg: '#282828' } : manual ? { text: t('lobby.manual'), icon: 'touch_app', bg: '#E6EFE8', fg: '#3D6B4F' } : { text: t('lobby.match', { n: 98 }), icon: 'verified', bg: '#E6EFE8', fg: '#3D6B4F' };
  const line = '2px solid #CAB8A2';
  return (
    <section aria-label={t('lobby.faceCard')} style={{ background: '#FFFFFF', border: '1px solid #DBD7D6', borderRadius: 24, overflow: 'hidden', boxShadow: '0 8px 24px rgba(117,98,75,0.06)' }}>
      <div style={{ padding: '18px 22px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: FONT_SMALL, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 500, color: '#282828', lineHeight: '18px' }}>{t('lobby.faceCheckin')}</div>
          <div style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{t('lobby.frontDoor')}</div>
        </div>
        <span style={{ height: 30, padding: '0 12px', borderRadius: 999, background: '#F4F0EE', fontSize: FONT_SMALL, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>{pulse(8, '#3D6B4F')}{t('lobby.live')}</span>
      </div>
      <div style={{ position: 'relative', margin: '0 14px', height: 270, borderRadius: 18, background: '#2E2924', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {corner({ top: 22, left: 22 }, { borderTop: line, borderLeft: line }, { borderTopLeftRadius: 10 })}
        {corner({ top: 22, right: 22 }, { borderTop: line, borderRight: line }, { borderTopRightRadius: 10 })}
        {corner({ bottom: 22, left: 22 }, { borderBottom: line, borderLeft: line }, { borderBottomLeftRadius: 10 })}
        {corner({ bottom: 22, right: 22 }, { borderBottom: line, borderRight: line }, { borderBottomRightRadius: 10 })}
        {idle ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center', padding: '0 48px', color: '#F4F0EE' }}>
            <Icon name="face" size={52} color="#CAB8A2" />
            <div style={{ fontSize: 20 }}>{t('lobby.standingBy')}</div>
            <div style={{ fontSize: 16, lineHeight: '22px', color: '#E8E1D8' }}>{t('lobby.standingBySub')}</div>
          </div>
        ) : member ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <MemberAvatar m={member} size={136} font={44} ring={scanning ? '#CAB8A2' : '#E6EFE8'} />
              <span style={{ height: 30, padding: '0 12px', borderRadius: 999, background: pill.bg, color: pill.fg, fontSize: FONT_BODY, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                <Icon name={pill.icon} size={18} fill={1} />
                {pill.text}
              </span>
            </div>
            {scanning ? <div style={{ position: 'absolute', left: '12%', right: '12%', height: 2, borderRadius: 2, background: '#CAB8A2', boxShadow: '0 0 14px #CAB8A2', animation: 'cpScan 1.6s ease-in-out infinite' }} /> : null}
          </>
        ) : null}
      </div>
      <div style={{ padding: '16px 22px 22px' }}>
        {idle ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button type="button" className="dh16" onClick={onSimulate} style={{ height: 52, borderRadius: 999, border: '1px solid #75624B', background: '#FFFFFF', color: '#75624B', fontSize: 16, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', fontFamily: 'Inter' }}>
              <Icon name="play_circle" size={22} />
              {t('lobby.simulate')}
            </button>
            <div style={{ fontSize: FONT_BODY, color: '#6A6967', textAlign: 'center', lineHeight: 1.4 }}>{t('lobby.demoOnly')}</div>
          </div>
        ) : null}
        {scanning ? <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 52, fontSize: 17 }}>{pulse(12, '#75624B')}{t('lobby.recognising')}</div> : null}
        {scan.state === 'matched' ? matched : null}
      </div>
    </section>
  );
}
