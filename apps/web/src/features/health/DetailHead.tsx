// The top of a person's detail in the station: who they are and whether they are in the club, links to their record and trends,
// the four-week systolic chart, and what the nurse must know before touching them (allergies, mobility, diet, lunchtime medicines).
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { memberAge, planOn, type ClubState } from '@cp/shared';
import { arrivalSystolic, careFlagsOf, headSpark, type CareFlag, type StationRow } from '@cp/shared/rules/healthStation';
import { Button, Eyebrow, Icon } from '../../components/ui';
import type { TFn } from '../../lib/i18n';
import { Av } from './parts';
import type { Who } from './who';

const MOB_ICON = { walkingStick: 'elderly', walker: 'assist_walker', wheelchair: 'accessible' } as const;

/** One care fact: an allergy is a red dot and text (safety-critical); the rest are a quiet icon and text. */
function flagVm(f: CareFlag, t: TFn): { icon: string; label: string; dot?: string; fg: string } {
  const rust = (label: string) => ({ icon: '', label, dot: '#A2452B', fg: '#A2452B' });
  const plain = (icon: string, label: string) => ({ icon, label, fg: '#24201C' });
  switch (f.kind) {
    case 'food': return rust(t('health.food.' + f.key));
    case 'foodOther': return rust(f.text);
    case 'drug': return rust(t('health.drugAllergy', { d: f.key.startsWith('other:') ? f.key.slice(6) : t('health.drug.' + f.key) }));
    case 'mobility': return plain(MOB_ICON[f.key], t('health.mob.' + f.key));
    case 'diet': return plain('restaurant', t('health.diet.' + f.key));
    case 'lunchMed': return plain('medication', t('health.lunchMed', { n: f.name, d: f.dose }));
    default: return { icon: '', label: t('health.allergyUnknown'), dot: '#7A5510', fg: '#7A5510' };
  }
}

export function DetailHead({ who, row, s, today, t, isPhone }: { who: Who; row: StationRow; s: ClubState; today: string; t: TFn; isPhone: boolean }) {
  const navigate = useNavigate();
  const eyebrow = row.presence === 'in' ? t('health.presIn', { t: row.since ?? '' }) : row.presence === 'gone' ? t('health.presGone', { t: row.left ?? '' }) : t('health.presNo');
  const sub = who.member
    ? (row.presence === 'in'
      ? t('health.ageSub', { a: memberAge(who.member, today) ?? '', p: planOn(who.member, today).plan === 'flex' ? 'Flex' : 'Gold', t: row.since ?? '' })
      : t('health.ageSubPlain', { a: memberAge(who.member, today) ?? '', p: planOn(who.member, today).plan === 'flex' ? 'Flex' : 'Gold' }))
    : t('health.guestSub', { k: who.guest?.kind === 'trial' ? t('health.guestTrial') : t('health.guestVisit'), t: row.since ?? '' });
  const tr = useMemo(() => (who.kind === 'member' ? headSpark(arrivalSystolic(s, who.id, today)) : null), [s, who.kind, who.id, today]);
  const flags = careFlagsOf((who.member || who.guest)!).map((f) => flagVm(f, t));
  const internal = who.member?.care.instructions?.trim();
  const links = (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Button variant="secondary" size={44} icon="folder_shared" style={isPhone ? { flex: '1 1 0', minWidth: 0, padding: '0 10px' } : undefined} onClick={() => navigate(`/members/${who.id}/health`)}>{t('health.healthRecord')}</Button>
      <Button variant="secondary" size={44} icon="monitoring" style={isPhone ? { flex: '1 1 0', minWidth: 0, padding: '0 10px' } : undefined} onClick={() => navigate(`/readings?member=${who.id}`)}>{t('health.trends')}</Button>
    </div>
  );
  const pad = isPhone ? '14px 16px' : '16px clamp(18px, 2.4vw, 28px)';
  return (
    <>
      <div style={{ padding: pad, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: isPhone ? 12 : 16, borderBottom: '1px solid #F0EAE1' }}>
        <Av name={who.name} tone={who.tone} src={who.photo} size={isPhone ? 52 : 56} font={isPhone ? 18 : 20} />
        <div style={{ flex: '1 1 180px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 style={{ margin: 0, fontSize: isPhone ? 22 : 'clamp(22px, 2vw, 26px)', lineHeight: 1.2, fontWeight: 500, letterSpacing: '-0.3px', color: '#24201C' }}>{who.name}</h2>
          <div style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
        </div>
        {who.kind === 'member' ? <div style={isPhone ? { flex: '1 1 100%' } : undefined}>{links}</div> : null}
      </div>
      {flags.length || internal || tr ? <div style={{ padding: isPhone ? '12px 16px' : '12px clamp(18px, 2.4vw, 28px)', display: 'flex', flexWrap: 'wrap', gap: '10px 20px', alignItems: 'center', background: '#FBFAF8', borderBottom: '1px solid #F0EAE1' }}>
        <div style={{ flex: '1 1 260px', minWidth: 0, display: 'flex', flexWrap: 'wrap', gap: '6px 16px', alignItems: 'center' }}>
          {flags.map((f, i) => (
            <span key={i} data-testid="care-flag" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: f.dot ? 500 : 400, lineHeight: 1.4, color: f.fg, maxWidth: '100%' }}>
              {f.dot ? <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 999, background: f.dot, flex: 'none' }} /> : <Icon name={f.icon} size={17} weight={300} color="#6B6259" />}
              {f.label}
            </span>
          ))}
          {internal ? (
            <span style={{ flexBasis: '100%', display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 14, lineHeight: '20px', color: '#24201C' }}>
              <Icon name="lock" size={17} weight={300} color="#6B6259" style={{ paddingTop: 1 }} />
              <span><strong style={{ fontWeight: 600 }}>{t('common.staffOnly')}:</strong> {internal}</span>
            </span>
          ) : null}
        </div>
        {tr ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: isPhone ? 'stretch' : 'flex-end', gap: 2, flex: isPhone ? '1 1 100%' : 'none', minWidth: 0 }}>
            <svg width={isPhone ? '100%' : 160} height={36} viewBox="0 0 200 48" preserveAspectRatio="none" aria-hidden="true">
              <rect x="0" y={tr.bandY} width="200" height={tr.bandH} style={{ fill: '#E3EFE6' }} />
              <path d={tr.line} style={{ fill: 'none', stroke: '#75624B', strokeWidth: 1.5 }} />
              <path d={tr.dots} style={{ fill: '#75624B' }} />
              <path d={tr.hot} style={{ fill: '#9A3D24' }} />
            </svg>
            <span style={{ fontSize: 13, color: '#6B6259', lineHeight: 1.4 }}>{t('health.last4w')}</span>
          </div>
        ) : null}
      </div> : null}
    </>
  );
}
