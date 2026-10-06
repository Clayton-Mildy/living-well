// Small building blocks shared by the profile tabs and the reviews screen.
import { Fragment, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { actorName, type ChangeRequest } from '@cp/shared';
import { tabForSection, type ProfileTab } from '@cp/shared/rules/members';
import { Button, FONT_BODY, FONT_SMALL, Icon, SectionLabel } from '../../../components/ui';
import type { TFn } from '../../../lib/i18n';
import { describeCr, type Described, type DiffRow } from '../reviewDiff';
import { whenText, type FlagChip } from '../lib';
import type { P } from './types';

export const Chips32 = ({ chips }: { chips: FlagChip[] }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
    {chips.map((f, i) => (
      <span key={i} style={{ minHeight: 32, maxWidth: '100%', padding: '4px 12px', borderRadius: 999, background: f.bg, color: '#282828', fontSize: FONT_BODY, display: 'inline-flex', alignItems: 'center', gap: 6, lineHeight: 1.3 }}>
        <Icon name={f.icon} size={18} color={f.ic} />
        <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{f.label}</span>
      </span>
    ))}
  </div>
);

/** Label / value row of a facts list (design Plan tab facts). */
export const Fact = ({ k, children, first }: { k: ReactNode; children: ReactNode; first?: boolean }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '10px 0', borderTop: first ? 'none' : '1px solid #EFECEA', fontSize: 16, lineHeight: '22px' }}>
    <span style={{ color: '#6A6967', flex: 'none' }}>{k}</span>
    <span style={{ textAlign: 'right', minWidth: 0, overflowWrap: 'anywhere' }}>{children}</span>
  </div>
);

export const Tag28 = ({ icon, label, bg, fg = '#282828' }: { icon: string; label: ReactNode; bg: string; fg?: string }) => (
  <span style={{ minHeight: 28, maxWidth: '100%', padding: '3px 10px', borderRadius: 999, background: bg, color: fg, fontSize: FONT_SMALL, display: 'inline-flex', alignItems: 'center', gap: 4, lineHeight: 1.3 }}>
    <Icon name={icon} size={16} />
    <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{label}</span>
  </span>
);

/** A heading row for a list card: label on the left, a meta line (or action) on the right. */
export const ListHead = ({ title, meta, right }: { title: ReactNode; meta?: ReactNode; right?: ReactNode }) => (
  <div style={{ padding: '16px 20px 10px', display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
    <SectionLabel>{title}</SectionLabel>
    {meta ? <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{meta}</span> : null}
    {right}
  </div>
);

/** Old → new rows (proposed or applied). */
export function DiffList({ d, t, proposed = true }: { d: Described; t: TFn; proposed?: boolean }) {
  const rows: DiffRow[] = [...d.summary, ...d.rows];
  if (!rows.length) return null;
  const pic = (url: string | undefined, text: string | undefined) => (url ? <img src={url} alt={text || ''} style={{ width: 56, height: 56, borderRadius: 999, objectFit: 'cover', verticalAlign: 'middle' }} /> : text);
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {rows.map((r, i) => {
        const changed = r.from !== undefined && r.to !== undefined && r.from !== r.to;
        return (
          <div key={i} style={{ padding: '10px 0', borderTop: i ? '1px solid rgba(40,40,40,0.08)' : 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: FONT_SMALL, letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 500, color: '#6A6967', lineHeight: '18px' }}>{r.label}</span>
            {changed ? (
              <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '2px 8px', fontSize: 16, lineHeight: '22px', whiteSpace: 'pre-line' }}>
                <span style={{ color: '#6A6967', textDecoration: r.fromImg ? 'none' : 'line-through', opacity: r.fromImg ? 0.6 : 1 }}><span className="sr-only">{t('reviews.was')}: </span>{pic(r.fromImg, r.from)}</span>
                <Icon name="arrow_forward" size={18} color="#75624B" style={{ alignSelf: 'center' }} />
                <strong style={{ fontWeight: 600 }}><span className="sr-only">{proposed ? t('reviews.proposed') : t('reviews.now')}: </span>{pic(r.toImg, r.to)}</strong>
              </span>
            ) : (
              <span style={{ fontSize: 16, lineHeight: '22px', whiteSpace: 'pre-line' }}>{r.toImg || r.fromImg ? pic(r.toImg ?? r.fromImg, r.to ?? r.from) : r.to ?? r.from}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** "Pending review" request(s) for a tab: the chip, who sent it, the proposed values and Withdraw (own requests). */
export function PendingBanner({ p, tab }: { p: P; tab: ProfileTab }) {
  const { t, s, fmt, today } = p;
  const navigate = useNavigate();
  const [busy, setBusy] = useState('');
  const list = (p.family ? p.mine : p.pending).filter((c) => tabForSection(c.section) === tab && c.status === 'pending');
  if (!list.length) return null;
  const myActor = p.me.kind === 'staff' ? `staff:${p.me.id}` : `family:${p.me.id}`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {list.map((cr) => {
        const d = describeCr(cr, s, t, fmt);
        const mineReq = cr.submittedBy === myActor;
        const flagged = cr.kind === 'postReview';
        return (
          <div key={cr.id} role="group" aria-label={t('common.pendingReview')} style={{ background: flagged ? '#F4F0EE' : '#F6ECD6', borderRadius: 20, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ height: 30, padding: '0 12px 0 8px', borderRadius: 999, background: flagged ? '#E8E1D8' : '#FFFFFF', color: '#7A5510', fontSize: FONT_BODY, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                <Icon name={flagged ? 'fact_check' : 'hourglass_top'} size={18} fill={1} />
                {flagged ? t('profile.appliedReview') : t('common.pendingReview')}
              </span>
              <span style={{ fontSize: 16, fontWeight: 500, flex: 1, minWidth: 120 }}>{d.title}</span>
              {mineReq && !flagged ? (
                <Button variant="secondary" size={44} icon="undo" disabled={busy === cr.id} onClick={async () => { setBusy(cr.id); await p.act('review.withdraw', { crId: cr.id }, { ok: t('profile.withdrawn') }); setBusy(''); }}>{t('profile.withdraw')}</Button>
              ) : null}
              {p.mgmt && !p.family ? <Button variant="secondary" size={44} icon="fact_check" onClick={() => navigate('/reviews')}>{t('profile.reviewIt')}</Button> : null}
            </div>
            <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>
              {t('profile.sentBy', { n: actorName(s, cr.submittedBy), w: whenText(fmt.fds, today, cr.createdAt, t) })}
              {flagged ? ' · ' + t('profile.appliedNote') : !p.family ? ' · ' + t('profile.stillInForce') : ''}
            </span>
            <DiffList d={d} t={t} proposed={!flagged} />
          </div>
        );
      })}
    </div>
  );
}

/** A tile that behaves as a button when `onClick` is given. */
export const Tile = ({ children, style, onClick, label }: { children: ReactNode; style?: CSSProperties; onClick?: () => void; label?: string }) =>
  onClick ? <button type="button" onClick={onClick} aria-label={label} style={{ ...style, cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter', color: '#282828' }}>{children}</button> : <div style={style}>{children}</div>;

export const KeyedFragment = Fragment;
export type { ChangeRequest };
