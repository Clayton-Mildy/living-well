// Kitchen menu of the day (design ScrKmenu): lunch photo, covers, today's menu, dietary needs, plus the allergy conflicts
// panel and the weekly plan editor. Closed days and weekends show a closed state instead of crashing.
import { useState } from 'react';
import { Card, EmptyState, Icon, PageHead, Pager, Pin, usePaged, FONT_BODY } from '../../components/ui';
import type { DietRow } from '@cp/shared/rules/kitchenOps';
import { useDevice, padFor } from '../../hooks/useDevice';
import { useT, useFmt } from '../../lib/i18n';
import { AllergiesOnFile } from './AllergiesOnFile';
import { ConflictsPanel } from './ConflictsPanel';
import { DishesCard } from './DishesCard';
import { OverrideSheet } from './OverrideSheet';
import { LunchPhotos } from './LunchPhotos';
import { OutlineButton, cardLabel } from './parts';
import { PublishDialog, WeeklyPlan, usePlanEditor } from './WeeklyPlan';
import { useMenuVals } from './vals';

export function KitchenMenu() {
  const t = useT();
  const { fdl } = useFmt();
  const { device, isPhone } = useDevice();
  const v = useMenuVals();
  const diet = usePaged(v.diet, 8);
  const editor = usePlanEditor();
  const [publishing, setPublishing] = useState(false);
  const [override, setOverride] = useState(false);
  const names = (list: { name: string }[]) => list.map((d) => d.name).join(', ') || t('kitchen.menu.none');
  // "3 in the club + 1 guest": members who are in, members who already left (they still had lunch), booked guests
  const { inClub, gone } = v.members;
  const coversSplit = [inClub ? t('kitchen.inClub', { n: inClub }) : '', gone ? t('kitchen.goneHome', { n: gone }) : '', v.covers.guests ? t(v.covers.guests === 1 ? 'kitchen.guest1' : 'kitchen.guestsN', { n: v.covers.guests }) : ''].filter(Boolean).join(' + ') || t('kitchen.inClub', { n: 0 });

  return (
    <>
      <div style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 12 : 20, maxWidth: 1100 }}>
        <PageHead eyebrow={fdl(v.today)} title={t('kitchen.menuTitle')} />

        {v.closed ? (
          <Card>
            <EmptyState icon="event_busy" title={t('common.clubClosed')} sub={t(v.closedReason === 'weekend' ? 'common.weekendSub' : 'common.clubClosedSub', { date: fdl(v.nextOpen) })} />
          </Card>
        ) : v.menu ? (
          <>
            <ConflictsPanel vals={v} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,320px),1fr))', gap: 16, alignItems: 'start' }}>
              <Card shadow>
                <LunchPhotos date={v.today} />
                <div className="cp-card-pad" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={cardLabel} data-testid="covers">{t(v.covers.total === 1 ? 'kitchen.cover1' : 'kitchen.covers', { n: v.covers.total })}</div>
                  <div style={{ fontSize: FONT_BODY, color: '#282828', lineHeight: 1.4 }} data-testid="covers-split">{coversSplit}</div>
                  <div className="cp-hide-phone" style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{t('kitchen.coversLive')}</div>
                  <div style={{ fontSize: 24, lineHeight: '32px', letterSpacing: '-0.5px', color: '#9A836C' }}>{names(v.menu.lunch)}</div>
                  <div style={{ fontSize: 16, lineHeight: '22px' }}>{t('kitchen.softLine', { dishes: names(v.menu.soft) })}</div>
                  <div style={{ fontSize: 16, lineHeight: '22px' }}>{t('kitchen.teaLine', { dishes: names(v.menu.tea) })}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                    <OutlineButton onClick={() => setOverride(true)} icon="edit_calendar">{t('kitchen.menu.changeToday')}</OutlineButton>
                  </div>
                  {v.overridden ? <span style={{ fontSize: FONT_BODY, color: '#7A5510', lineHeight: 1.4 }}>{t('kitchen.menu.overridden')}</span> : null}
                </div>
              </Card>

              <Card>
                <div style={{ padding: '16px 20px 10px', display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <span style={cardLabel}>{t('kitchen.diet.title')}</span>
                  <span className="cp-hide-phone" style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{t('kitchen.diet.foodOnly')}</span>
                </div>
                {diet.rows.map((r) => (
                  <div key={r.key} data-testid="diet-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderTop: '1px solid #EFECEA', minHeight: 60 }}>
                    <Icon name={r.icon} size={20} color="#75624B" style={{ width: 40, height: 40, borderRadius: 999, background: '#F4F0EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{dietTitle(t, r)}</span>
                      <span style={{ fontSize: FONT_BODY, lineHeight: '20px', color: '#6A6967' }}>{r.names.join(', ')}</span>
                    </div>
                    <span style={{ fontSize: 16, fontVariantNumeric: 'tabular-nums', flex: 'none', lineHeight: 1.4 }}>{r.n}</span>
                  </div>
                ))}
                {!v.diet.length ? <div style={{ padding: '12px 20px 20px', borderTop: '1px solid #EFECEA', fontSize: 16, color: '#6A6967', lineHeight: '22px' }}>{t('kitchen.diet.none')}</div> : null}
                <div style={{ padding: diet.pages > 1 ? '8px 20px 12px' : 0 }}><Pager page={diet.page} pages={diet.pages} onPage={diet.setPage} label={t('kitchen.diet.title')} /></div>
              </Card>
            </div>
          </>
        ) : null}

        <AllergiesOnFile />
        <WeeklyPlan editor={editor} onPublish={() => setPublishing(true)} isPhone={isPhone} />
        <DishesCard />
      </div>
      {isPhone && editor.changes.length ? <Pin icon="publish" label={t('kitchen.plan.publish')} onClick={() => setPublishing(true)} /> : null}
      <PublishDialog open={publishing} onClose={() => setPublishing(false)} editor={editor} />
      <OverrideSheet open={override} onClose={() => setOverride(false)} initialDate={v.today} />
    </>
  );
}

function dietTitle(t: (k: string, p?: Record<string, string | number>) => string, r: DietRow) {
  if (r.kind === 'allergy') return t('kitchen.diet.allergy', { what: t('kitchen.food.' + r.value) });
  if (r.kind === 'other') return t('kitchen.diet.other');
  if (r.kind === 'unknown') return t('kitchen.diet.unknown');
  if (r.kind === 'diabetic') return t('kitchen.diet.diabetic');
  return t('kitchen.dietKey.' + r.value);
}
