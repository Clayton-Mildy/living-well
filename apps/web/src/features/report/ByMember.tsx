// The By member view of the daily report: one row per member who came. On a phone (and on a narrow screen) a grouped list with the facts on two or three
// compact lines; on a wide container a clean table-like grid: in–out, lunch, activities (sat out marked), mood and the arrival blood pressure with its status colour.
// Tapping a member opens the profile.
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { memberName } from '@cp/shared';
import { activityName } from '@cp/shared/rules/activity';
import type { DayReport, ReportMember } from '@cp/shared/rules/dailyReport';
import { EmptyState, Group, Icon } from '../../components/ui';
import { PendingMark } from '../../components/PendingMark';
import { useFmt, useT, type TFn } from '../../lib/i18n';
import { rowLine } from '../activity/lib';
import { MemberAvatar } from '../lobby/parts';
import { HEALTH_DOT, Line, MUTED, OCHRE, RUST, visitTime } from './parts';

const sub: CSSProperties = { fontSize: 14, lineHeight: '20px', color: MUTED };
const GRID = 'minmax(200px, 1.5fr) 124px 100px minmax(190px, 2fr) 96px 116px';

/** What a member did in each session that has started: joined (plain), sat out (rust), and one "N not marked" (ochre) for the rest. Sessions that have not started yet are left out. */
function useSessionBits(r: DayReport): (x: ReportMember) => { text: string; tone: 'ok' | 'out' | 'unmarked' }[] {
  const t = useT();
  const { lang } = useFmt();
  return (x) => {
    const out: { text: string; tone: 'ok' | 'out' | 'unmarked' }[] = [];
    let unmarked = 0;
    x.sessions.forEach((s, i) => {
      const sess = r.sessions[i];
      if (!sess || sess.state === 'later') return;
      const name = activityName(sess.activity, lang);
      if (s.mark === 'joined') out.push({ text: name, tone: 'ok' });
      else if (s.mark === 'satOut') out.push({ text: t('report.satOutTag', { name }), tone: 'out' });
      else unmarked++;
    });
    if (unmarked) out.push({ text: t('report.notMarked', { n: unmarked }), tone: 'unmarked' });
    return out;
  };
}
const TONE: Record<'ok' | 'out' | 'unmarked', string> = { ok: '#4A4038', out: RUST, unmarked: OCHRE };
/** The session bits as one flowing line: "Batik painting · Memory games (sat out) · 1 not marked". */
function Bits({ bits, quiet }: { bits: { text: string; tone: 'ok' | 'out' | 'unmarked' }[]; quiet?: boolean }) {
  return <span>{bits.map((b, k) => <span key={k} style={{ color: b.tone === 'ok' && quiet ? MUTED : TONE[b.tone] }}>{k ? ' · ' : ''}{b.text}</span>)}</span>;
}
const lunchText = (t: TFn, x: ReportMember) => (x.lunch ? t('activity.opt.lunch.' + x.lunch) : '');
const moodText = (t: TFn, x: ReportMember) => (x.mood ? t('activity.opt.mood.' + x.mood) : '');
const bpOf = (x: ReportMember) => (x.arrival && x.arrival.sys != null && x.arrival.dia != null ? `${x.arrival.sys}/${x.arrival.dia}` : '');

function Bp({ x }: { x: ReportMember }) {
  const t = useT();
  const bp = bpOf(x);
  if (!x.arrival || !bp) return <span style={{ color: '#A89C8E' }}>—</span>;
  const pending = x.arrival.approval?.status === 'pending';
  return (
    <span title={pending ? t('approvals.pending') : undefined} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: x.arrival.status === 'normal' ? '#24201C' : HEALTH_DOT[x.arrival.status] }}>
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, background: HEALTH_DOT[x.arrival.status], flex: 'none' }} />
      {bp}
      {pending ? <Icon name="schedule" size={14} color={OCHRE} /> : null}
    </span>
  );
}

export function ByMember({ r, wide }: { r: DayReport; wide: boolean }) {
  const t = useT();
  const go = useNavigate();
  const bits = useSessionBits(r);
  if (!r.members.length) return <EmptyState icon="groups" title={t('report.noMembers')} />;

  if (wide) {
    const head: CSSProperties = { fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 500, color: '#6E5A43', lineHeight: '16px' };
    return (
      <Group pad={0} gap={0} label={t('report.tabMembers')}>
        <div aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: GRID, gap: 14, padding: '12px 16px 10px', backgroundColor: '#FFFFFF' }}>
          {(['colMember', 'colTime', 'colLunch', 'colActivities', 'colMood', 'colArrival'] as const).map((k) => <span key={k} style={head}>{t('report.' + k)}</span>)}
        </div>
        {r.members.map((x) => (
          <button key={x.m.id} type="button" onClick={() => go(`/members/${x.m.id}`)} data-member={x.m.id} className="h-row cp-tap-self"
            style={{ width: '100%', display: 'grid', gridTemplateColumns: GRID, gap: 14, alignItems: 'center', padding: '10px 16px', minHeight: 56, border: 'none', backgroundColor: '#FFFFFF', textAlign: 'left', color: '#24201C', fontFamily: 'Inter', cursor: 'pointer', ...rowLine(false) }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <MemberAvatar m={x.m} size={36} font={13} />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{memberName(x.m)}</span>
                {x.pendingLog ? <PendingMark row={x.log} /> : null}
              </span>
            </span>
            <span style={{ fontSize: 14, fontVariantNumeric: 'tabular-nums', color: '#4A4038' }}>{visitTime(t, x)}</span>
            <span style={{ fontSize: 14, color: x.lunch === 'little' || x.lunch === 'none' ? RUST : '#4A4038' }}>{lunchText(t, x) || <span style={{ color: '#A89C8E' }}>—</span>}</span>
            <span style={{ fontSize: 14, lineHeight: '20px' }}>
              {bits(x).length ? <Bits bits={bits(x)} /> : <span style={{ color: '#A89C8E' }}>—</span>}
            </span>
            <span style={{ fontSize: 14, color: '#4A4038' }}>{moodText(t, x) || <span style={{ color: '#A89C8E' }}>—</span>}</span>
            <Bp x={x} />
          </button>
        ))}
      </Group>
    );
  }

  return (
    <Group pad={0} gap={0} label={t('report.tabMembers')}>
      {r.members.map((x, i) => {
        const line2 = [visitTime(t, x), lunchText(t, x), moodText(t, x)].filter(Boolean);
        const sessionBits = bits(x);
        return (
          <Line key={x.m.id} first={i === 0} inset={66} onClick={() => go(`/members/${x.m.id}`)} style={{ alignItems: 'flex-start' }}>
            <MemberAvatar m={x.m} size={38} font={14} />
            <span data-member={x.m.id} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{memberName(x.m)}</span>
              <span style={{ ...sub, fontVariantNumeric: 'tabular-nums' }}>
                {line2.map((p, k) => <span key={k} style={{ color: p === lunchText(t, x) && (x.lunch === 'little' || x.lunch === 'none') ? RUST : undefined }}>{k ? ' · ' : ''}{p}</span>)}
              </span>
              {sessionBits.length ? <span style={sub}><Bits bits={sessionBits} quiet /></span> : null}
              {x.pendingLog ? <PendingMark row={x.log} /> : null}
            </span>
            <span style={{ flex: 'none', paddingTop: 2 }}><Bp x={x} /></span>
          </Line>
        );
      })}
    </Group>
  );
}
