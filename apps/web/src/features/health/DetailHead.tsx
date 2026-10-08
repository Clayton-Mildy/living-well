// The top of a person's detail in the station: who they are and whether they are in the club, links to their record and trends,
// the four-week systolic chart, and what the nurse must know before touching them (allergies, mobility, diet, lunchtime medicines).
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDays, limitsFor, memberAge, ownLimitKeys, planOn, type ClubState } from '@cp/shared';
import { NORMAL_BANDS, arrivalSystolic, careFlagsOf, type CareFlag, type StationRow } from '@cp/shared/rules/healthStation';
import { Button, Eyebrow, Group, Icon, TrendChart } from '../../components/ui';
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
  // KC round 7: the four-week systolic chart is a small TrendChart: tap or hover it to read a day's value
  const tr = useMemo(() => (who.kind === 'member' ? arrivalSystolic(s, who.id, today, 28, who.member ? limitsFor(s, who.member) : undefined) : []), [s, who.kind, who.id, who.member, today]);
  const spark = tr.length ? (
    <TrendChart compact height={44} series={[{ key: 'sys', label: t('health.bp'), points: tr }]} band={{ from: NORMAL_BANDS.bp[0], to: NORMAL_BANDS.bp[1] }} unit="mmHg" format={(v) => String(Math.round(v))}
      from={addDays(today, -28)} to={today} ariaLabel={t('health.last4w')} caption={t('health.last4w')} />
  ) : null;
  const flags = careFlagsOf((who.member || who.guest)!).map((f) => flagVm(f, t));
  const internal = who.member?.care.instructions?.trim();
  // KC round 7: a member with limits of their own is graded with them; a small note says so (the lines are in the tooltip)
  const ownKeys = ownLimitKeys(who.kind === 'member' ? s.members[who.id] ?? who.member : null);
  const ownNote = ownKeys.length ? (
    <span data-testid="own-limits" title={t('health.ownLimitsTip', { n: who.short, k: ownKeys.map((k) => t('health.lim.' + k)).join(', ') })}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, alignSelf: 'center', padding: '2px 10px 2px 7px', borderRadius: 999, background: '#F3EEE8', color: '#75624B', fontSize: 13, fontWeight: 500, lineHeight: '20px', whiteSpace: 'nowrap' }}>
      <Icon name="tune" size={15} weight={300} color="#75624B" />{t('health.ownLimits')}
    </span>
  ) : null;
  const links = (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Button variant="secondary" size={44} icon="folder_shared" style={isPhone ? { flex: '1 1 0', minWidth: 0, padding: '0 10px' } : undefined} onClick={() => navigate(`/members/${who.id}/health`)}>{t('health.healthRecord')}</Button>
      <Button variant="secondary" size={44} icon="monitoring" style={isPhone ? { flex: '1 1 0', minWidth: 0, padding: '0 10px' } : undefined} onClick={() => navigate(`/readings?member=${who.id}`)}>{t('health.trends')}</Button>
    </div>
  );
  // round 6, phone: a centred header, the two links as an iOS list, the care facts in one grouped section (sections sit in the sheet's 22px column)
  if (isPhone) {
    const linkRow = (icon: string, text: string, to: string, first?: boolean) => (
      <button type="button" className="cp-tap-self" onClick={() => navigate(to)}
        style={{ height: 50, padding: '0 10px 0 16px', border: 'none', borderTop: first ? 'none' : '1px solid #EFEAE3', background: '#FFFFFF', color: '#24201C', fontSize: 16, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontFamily: 'Inter', textAlign: 'left' }}>
        <Icon name={icon} size={21} color="#75624B" />
        <span style={{ flex: 1 }}>{text}</span>
        <Icon name="chevron_right" size={22} color="#A89C8E" />
      </button>
    );
    return (
      <>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 4, minWidth: 0 }}>
          <Av name={who.name} tone={who.tone} src={who.photo} size={72} font={26} />
          <Eyebrow style={{ marginTop: 6 }}>{eyebrow}</Eyebrow>
          <h2 style={{ margin: 0, fontSize: 26, lineHeight: 1.15, fontWeight: 400, letterSpacing: '-0.6px', color: '#2B231C' }}>{who.name}</h2>
          <div style={{ fontSize: 14, color: '#6B6259', lineHeight: '20px', maxWidth: '100%' }}>{sub}</div>
          {ownNote}
        </div>
        {who.kind === 'member' ? (
          <Group pad={0} gap={0}>
            {linkRow('folder_shared', t('health.healthRecord'), `/members/${who.id}/health`, true)}
            {linkRow('monitoring', t('health.trends'), `/readings?member=${who.id}`)}
          </Group>
        ) : null}
        {flags.length || internal || spark ? (
          <Group title={t('lobby.care')} gap={12}>
            {flags.length ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', alignItems: 'center' }}>
                {flags.map((f, i) => (
                  <span key={i} data-testid="care-flag" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: f.dot ? 500 : 400, lineHeight: 1.4, color: f.fg, maxWidth: '100%' }}>
                    {f.dot ? <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: f.dot, flex: 'none' }} /> : <Icon name={f.icon} size={18} weight={300} color="#6B6259" />}
                    {f.label}
                  </span>
                ))}
              </div>
            ) : null}
            {internal ? (
              <span style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 15, lineHeight: '21px', color: '#24201C' }}>
                <Icon name="lock" size={18} weight={300} color="#6B6259" style={{ paddingTop: 1 }} />
                <span><strong style={{ fontWeight: 600 }}>{t('common.staffOnly')}:</strong> {internal}</span>
              </span>
            ) : null}
            {spark}
          </Group>
        ) : null}
      </>
    );
  }
  const pad = isPhone ? '14px 16px' : '16px clamp(18px, 2.4vw, 28px)';
  return (
    <>
      <div style={{ padding: pad, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: isPhone ? 12 : 16, borderBottom: '1px solid #F0EAE1' }}>
        <Av name={who.name} tone={who.tone} src={who.photo} size={isPhone ? 52 : 56} font={isPhone ? 18 : 20} />
        <div style={{ flex: '1 1 180px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 style={{ margin: 0, fontSize: isPhone ? 22 : 'clamp(22px, 2vw, 26px)', lineHeight: 1.2, fontWeight: 500, letterSpacing: '-0.3px', color: '#24201C' }}>{who.name}</h2>
          <div style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
          {ownNote ? <div style={{ marginTop: 4, display: 'flex' }}>{ownNote}</div> : null}
        </div>
        {who.kind === 'member' ? <div style={isPhone ? { flex: '1 1 100%' } : undefined}>{links}</div> : null}
      </div>
      {flags.length || internal || spark ? <div style={{ padding: isPhone ? '12px 16px' : '12px clamp(18px, 2.4vw, 28px)', display: 'flex', flexWrap: 'wrap', gap: '10px 20px', alignItems: 'center', background: '#FBFAF8', borderBottom: '1px solid #F0EAE1' }}>
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
        {spark ? <div style={{ width: isPhone ? undefined : 220, flex: isPhone ? '1 1 100%' : 'none', minWidth: 0 }}>{spark}</div> : null}
      </div> : null}
    </>
  );
}
