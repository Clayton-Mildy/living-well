// Dishes and allergens: every dish with its allergen tags and whether they have been checked; add, edit, delete.
import { useMemo, useState } from 'react';
import { live } from '@cp/shared';
import { COURSES, dishesByCourse, type Course } from '@cp/shared/rules/kitchenOps';
import { Button, Card, CardHead, Group, Icon, Pager, Segmented, TextField, usePaged, FONT_BODY } from '../../components/ui';
import { useDevice } from '../../hooks/useDevice';
import { useT } from '../../lib/i18n';
import { useClub } from '../../store/replica';
import { DishDialog, ReachChip, allergenText, useReach } from './dish';
import { PhoneSearch, PhoneSeg, StatusDot } from './parts';

export function DishesCard() {
  const t = useT();
  const { isPhone } = useDevice();
  const s = useClub();
  const reachOf = useReach();
  const [course, setCourse] = useState<Course>('lunch');
  const [open, setOpen] = useState<string | 'new' | null>(null);
  const [q, setQ] = useState('');
  const all = useMemo(() => live(s.dishes), [s.dishes]);
  const needle = q.trim().toLocaleLowerCase();
  const inCourse = useMemo(() => dishesByCourse(s, course), [s.dishes, course]); // eslint-disable-line react-hooks/exhaustive-deps
  const dishes = useMemo(() => inCourse.filter((d) => !needle || d.name.toLocaleLowerCase().includes(needle)), [inCourse, needle]);
  const paged = usePaged(dishes, 10, `${course}|${needle}`); // another course or a new search starts again on page 1
  const toCheck = all.filter((d) => !d.reviewedAt).length;
  // round 6, phone: a grouped list under an iOS segmented control and a grey search bar; "Add a dish" is the last row of the group
  if (isPhone) {
    return (
      <>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <PhoneSeg<Course> label={t('kitchen.dishes.title')} value={course} onChange={setCourse} items={COURSES.map((c) => ({ value: c, label: t('kitchen.course.' + c), count: all.filter((d) => d.course === c).length }))} />
          <PhoneSearch value={q} onChange={setQ} label={t('kitchen.dishes.search')} />
        </div>
        <Group title={t('kitchen.dishes.title')} meta={toCheck ? t('kitchen.dishes.toCheck', { n: toCheck }) : t('kitchen.dishes.allChecked')} pad={0} gap={0}>
          {paged.rows.map((d, i) => (
            <button key={d.id} type="button" onClick={() => setOpen(d.id)} className="cp-tap-self" data-testid="dish-row"
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px 10px 16px', minHeight: 58, border: 'none', backgroundColor: '#FFFFFF', backgroundImage: i === 0 ? 'none' : 'linear-gradient(#EFEAE3, #EFEAE3)', backgroundSize: 'calc(100% - 16px) 1px', backgroundPosition: 'right top', backgroundRepeat: 'no-repeat', textAlign: 'left', cursor: 'pointer', color: '#24201C', fontFamily: 'Inter' }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{d.name}</span>
                <span style={{ fontSize: FONT_BODY, color: '#6B6259', lineHeight: 1.4 }}>{allergenText(t, d)}</span>
                {(() => { const r = reachOf(d); return r ? <ReachChip reach={r} /> : null; })()}
              </div>
              {d.reviewedAt ? <Icon name="verified" size={22} fill={1} color="#3D6B4F" /> : <StatusDot color="#7A5510">{t('kitchen.notChecked')}</StatusDot>}
              <Icon name="chevron_right" size={22} color="#A89C8E" />
            </button>
          ))}
          {!dishes.length ? <div style={{ padding: '16px', fontSize: 16, color: '#6B6259' }}>{t(needle ? 'common.noResults' : 'kitchen.dishes.none')}</div> : null}
          {paged.pages > 1 ? <div style={{ borderTop: '1px solid #EFEAE3' }}><Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('kitchen.dishes.title')} /></div> : null}
          <button type="button" onClick={() => setOpen('new')} className="cp-tap-self" style={{ width: '100%', height: 52, padding: '0 16px', border: 'none', borderTop: dishes.length ? '1px solid #EFEAE3' : 'none', backgroundColor: '#FFFFFF', color: '#75624B', fontSize: 16, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'Inter', textAlign: 'left' }}>
            <Icon name="add" size={22} />
            {t('kitchen.dishes.add')}
          </button>
        </Group>
        <DishDialog open={open !== null} dishId={open && open !== 'new' ? open : undefined} preset={{ course }} onClose={() => setOpen(null)} />
      </>
    );
  }
  return (
    <Card>
      <CardHead title={t('kitchen.dishes.title')} meta={toCheck ? t('kitchen.dishes.toCheck', { n: toCheck }) : t('kitchen.dishes.allChecked')} />
      <div style={{ padding: '0 22px 12px' }}>
        <Segmented<Course> label={t('kitchen.dishes.title')} value={course} onChange={setCourse} items={COURSES.map((c) => ({ value: c, label: t('kitchen.course.' + c), count: all.filter((d) => d.course === c).length }))} />
      </div>
      <div style={{ padding: '0 22px 12px' }}>
        <TextField label={t('kitchen.dishes.search')} value={q} onChange={setQ} inputMode="search" />
      </div>
      {paged.rows.map((d) => (
        <button key={d.id} type="button" onClick={() => setOpen(d.id)} className="h-row" data-testid="dish-row"
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 22px', minHeight: 60, border: 'none', borderTop: '1px solid #F0EAE1', background: '#FFFFFF', textAlign: 'left', cursor: 'pointer', color: '#24201C', fontFamily: 'Inter' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{d.name}</span>
            <span style={{ fontSize: FONT_BODY, color: '#6B6259', lineHeight: 1.4 }}>{allergenText(t, d)}</span>
                {(() => { const r = reachOf(d); return r ? <ReachChip reach={r} /> : null; })()}
          </div>
          {d.reviewedAt ? <Icon name="verified" size={22} fill={1} color="#3D6B4F" /> : <StatusDot color="#7A5510">{t('kitchen.notChecked')}</StatusDot>}
          <Icon name="chevron_right" size={22} color="#5E5852" />
        </button>
      ))}
      {!dishes.length ? <div style={{ padding: '16px 22px', borderTop: '1px solid #F0EAE1', fontSize: 16, color: '#6B6259' }}>{t(needle ? 'common.noResults' : 'kitchen.dishes.none')}</div> : null}
      <div style={{ padding: paged.pages > 1 ? '8px 22px' : 0, borderTop: paged.pages > 1 ? '1px solid #F0EAE1' : 'none' }}><Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('kitchen.dishes.title')} /></div>
      <div style={{ padding: '16px 22px 20px', borderTop: '1px solid #F0EAE1' }}>
        <Button variant="secondary" size={44} icon="add" onClick={() => setOpen('new')}>{t('kitchen.dishes.add')}</Button>
      </div>
      <DishDialog open={open !== null} dishId={open && open !== 'new' ? open : undefined} preset={{ course }} onClose={() => setOpen(null)} />
    </Card>
  );
}
