// The top of a person's detail in the station: who they are and whether they are in the club, links to their record and trends,
// the four-week systolic chart, and what the nurse must know before touching them (allergies, mobility, diet, lunchtime medicines).
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { memberAge, planOn, type ClubState } from '@cp/shared';
import { arrivalSystolic, careFlagsOf, headSpark, type CareFlag, type StationRow } from '@cp/shared/rules/healthStation';
import { Button, Eyebrow, Icon, FONT_BODY } from '../../components/ui';
import type { TFn } from '../../lib/i18n';
import { Av } from './parts';
import type { Who } from './who';

const MOB_ICON = { walkingStick: 'elderly', walker: 'assist_walker', wheelchair: 'accessible' } as const;

function flagVm(f: CareFlag, t: TFn): { icon: string; label: string; bg: string; ic: string } {
  const rust = (icon: string, label: string) => ({ icon, label, bg: '#F7E4DD', ic: '#AF4B2F' });
  const plain = (icon: string, label: string) => ({ icon, label, bg: '#E8E1D8', ic: '#282828' });
  switch (f.kind) {
    case 'food': return rust('no_food', t('health.food.' + f.key));
    case 'foodOther': return rust('no_food', f.text);
    case 'drug': return rust('medication', t('health.drugAllergy', { d: f.key.startsWith('other:') ? f.key.slice(6) : t('health.drug.' + f.key) }));
    case 'mobility': return plain(MOB_ICON[f.key], t('health.mob.' + f.key));
    case 'diet': return plain('restaurant', t('health.diet.' + f.key));
    case 'lunchMed': return plain('medication', t('health.lunchMed', { n: f.name, d: f.dose }));
    default: return { icon: 'help', label: t('health.allergyUnknown'), bg: '#F6ECD6', ic: '#7A5510' };
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
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: isPhone ? 0 : 8 }}>
      <Button variant="secondary" size={44} icon="folder_shared" style={isPhone ? { flex: '1 1 0', minWidth: 0, padding: '0 10px' } : undefined} onClick={() => navigate(`/members/${who.id}/health`)}>{t('health.healthRecord')}</Button>
      <Button variant="secondary" size={44} icon="monitoring" style={isPhone ? { flex: '1 1 0', minWidth: 0, padding: '0 10px' } : undefined} onClick={() => navigate(`/readings?member=${who.id}`)}>{t('health.trends')}</Button>
    </div>
  );
  return (
    <>
      <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 16, borderBottom: '1px solid #EFECEA' }}>
        <Av name={who.name} tone={who.tone} src={who.photo} size={64} font={22} />
        <div style={{ flex: '1 1 180px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 style={{ margin: 0, fontSize: 28, lineHeight: '36px', fontWeight: 400, letterSpacing: '-0.5px', color: '#9A836C' }}>{who.name}</h2>
          <div style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
          {who.kind === 'member' && !isPhone ? links : null}
        </div>
        {who.kind === 'member' && isPhone ? <div style={{ flex: '1 1 100%' }}>{links}</div> : null}
        {tr ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: isPhone ? 'stretch' : 'flex-end', gap: 4, flex: isPhone ? '1 1 100%' : 'none', minWidth: 0 }}>
            <svg width={isPhone ? '100%' : 200} height={48} viewBox="0 0 200 48" preserveAspectRatio="none" aria-hidden="true">
              <rect x="0" y={tr.bandY} width="200" height={tr.bandH} style={{ fill: '#E6EFE8' }} />
              <path d={tr.line} style={{ fill: 'none', stroke: '#75624B', strokeWidth: 1.5 }} />
              <path d={tr.dots} style={{ fill: '#75624B' }} />
              <path d={tr.hot} style={{ fill: '#AF4B2F' }} />
            </svg>
            <span style={{ fontSize: 'max(13px, var(--cp-body, 0px))', color: '#6A6967', lineHeight: 1.4 }}>{t('health.last4w')}</span>
          </div>
        ) : null}
      </div>
      <div style={{ padding: '14px 24px', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', background: '#FBFAF9', borderBottom: '1px solid #EFECEA' }}>
        {flags.map((f, i) => (
          <span key={i} data-testid="care-flag" style={{ minHeight: 32, padding: '4px 12px', borderRadius: 999, background: f.bg, color: '#282828', fontSize: FONT_BODY, lineHeight: 1.3, display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%' }}>
            <Icon name={f.icon} size={18} color={f.ic} />
            {f.label}
          </span>
        ))}
        {internal ? (
          <span style={{ flexBasis: '100%', display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: FONT_BODY, lineHeight: '20px', color: '#282828' }}>
            <Icon name="lock" size={18} color="#75624B" style={{ paddingTop: 1 }} />
            <span><strong style={{ fontWeight: 600 }}>{t('common.staffOnly')}:</strong> {internal}</span>
          </span>
        ) : null}
      </div>
    </>
  );
}
