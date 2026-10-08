// Photo library (new): every photo by day and activity, with filters (member, activity, date range, hidden, waiting for approval) and the staff viewer for moderation and review.
// The management "Photos" screen, and the "Library" tab inside the teacher's Camera.
// Round 6 (phone, native look): the filters are one flat group (the visibility tabs a segmented control), each day is a group with its date outside.
import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { allowedKeys } from '../../app/nav';
import { useMe } from '../../lib/me';
import { addDays, isPendingRow, live, memberShort } from '@cp/shared';
import { libraryPhotos, photoActivities, photoDays, type PhotoFilter } from '@cp/shared/rules/activity';
import { Button, Card, DateField, EmptyState, Eyebrow, FilterChips, Group, PageHead, Pager, Select, usePaged } from '../../components/ui';
import { useDevice, padFor } from '../../hooks/useDevice';
import { useT, useFmt, useLang } from '../../lib/i18n';
import { useNow } from '../../lib/clock';
import { useClub } from '../../store/replica';
import { NumTabs, PhotoTile, activityLabel, plural } from './lib';
import { PhotoViewer } from './PhotoViewer';

const DAYS_PER_PAGE = 5;

export function PhotoLibrary() {
  const t = useT();
  const { device, isPhone } = useDevice();
  const navigate = useNavigate();
  const { role } = useMe();
  return (
    <div className={isPhone ? 'cp-native' : undefined} style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 14 : 'clamp(16px, 2.4vw, 28px)' }}>
      <PhotoLibraryBody title={<PageHead title={t('activity.libraryTitle')} size={36} right={role && allowedKeys(role).has('camera') ? <Button size={44} icon="photo_camera" onClick={() => navigate('/camera')}>{t('activity.openCamera')}</Button> : null} />} />
    </div>
  );
}

/** The library itself: summary line, filters, day cards. `title` is rendered above the summary (omitted when embedded in Camera). */
export function PhotoLibraryBody({ title }: { title?: ReactNode }) {
  const t = useT();
  const lang = useLang();
  const { fdl } = useFmt();
  const { isPhone } = useDevice();
  const s = useClub();
  const { today } = useNow();
  const [f, setF] = useState<PhotoFilter>({ visibility: 'all' });
  const [viewer, setViewer] = useState<string | null>(null);

  const all = useMemo(() => libraryPhotos(s), [s]);
  const photos = useMemo(() => libraryPhotos(s, f), [s, f]);
  const days = useMemo(() => photoDays(photos), [photos]);
  const flat = useMemo(() => days.flatMap((d) => d.groups.flatMap((g) => g.photos)), [days]);
  const hiddenN = all.filter((p) => p.visibility === 'hidden').length;
  const pendingN = all.filter((p) => p.visibility === 'pending').length;
  const members = useMemo(() => live(s.members).filter((m) => !isPendingRow(m)).sort((a, b) => a.firstName.localeCompare(b.firstName)), [s.members]);
  const acts = useMemo(() => photoActivities(s), [s]);
  const active = !!(f.memberId || f.activity || f.kind || f.from || f.to || (f.visibility && f.visibility !== 'all'));
  const patch = (x: Partial<PhotoFilter>) => setF((c) => ({ ...c, ...x }));
  const paged = usePaged(days, DAYS_PER_PAGE, JSON.stringify(f));
  const range = (from?: string, to?: string) => patch({ from, to });
  const isRange = (from?: string) => f.from === from && (!f.to || f.to === today);
  const rangeKey = f.from === today && f.to === today ? 'today' : isRange(addDays(today, -6)) ? 'last7' : isRange(addDays(today, -29)) ? 'last30' : !f.from && !f.to ? 'all' : 'custom';
  const summary = [plural(t, 'activity.photosCount', all.length), hiddenN ? plural(t, 'activity.hiddenCount', hiddenN) : '', pendingN ? plural(t, 'activity.pendingCount', pendingN) : ''].filter(Boolean).join(' · ');

  const chip = (label: string, on: boolean, onClick: () => void) => {
    const sel = on;
    return <button key={label} type="button" className="cp-chip" aria-pressed={sel} onClick={onClick} style={{ height: 44, padding: '0 16px', borderRadius: 12, border: sel ? '1px solid #24201C' : '1px solid #DCD3C8', background: sel ? '#24201C' : '#FFFFFF', color: sel ? '#FFFFFF' : '#24201C', fontSize: 16, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>{label}</button>;
  };
  // KC round 7: filter to the activity pictures (pictures of a session, no member tags)
  const typeSelect = (
    <Select label={t('activity.fType')} value={f.kind || ''} onChange={(v) => patch({ kind: v === 'activity' ? 'activity' : undefined })}
      options={[{ value: '', label: t('activity.allPics') }, { value: 'activity', label: t('activity.onlyActivity') }]} />
  );
  const filterBody = (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: isPhone ? 'repeat(2,minmax(0,1fr))' : 'repeat(auto-fit,minmax(200px,1fr))', gap: isPhone ? 8 : 12 }}>
        <Select label={t('activity.fMember')} value={f.memberId || ''} onChange={(v) => patch({ memberId: v || undefined })} searchable
          options={[{ value: '', label: t('activity.allMembers') }, ...members.map((m) => ({ value: m.id, label: memberShort(m) }))]} />
        <Select label={t('activity.fActivity')} value={f.activity || ''} onChange={(v) => patch({ activity: v || undefined })}
          options={[{ value: '', label: t('activity.allActivities') }, ...acts.map((a) => ({ value: a, label: activityLabel(s, a, t, lang) }))]} />
        {isPhone ? null : typeSelect}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: isPhone ? 8 : 12 }}>
        <DateField label={t('activity.fFrom')} value={f.from || ''} max={f.to || undefined} onChange={(v) => patch({ from: v || undefined })} clearable placeholder={t('activity.allTime')} />
        <DateField label={t('activity.fTo')} value={f.to || ''} min={f.from || undefined} onChange={(v) => patch({ to: v || undefined })} clearable placeholder={t('activity.allTime')} />
      </div>
      {isPhone ? (
        // phone: the quick ranges are one dropdown, next to the type filter
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8, alignItems: 'end' }}>
        {typeSelect}
        <FilterChips label={t('activity.fRange')} value={rangeKey} onChange={(k) => { if (k === 'today') range(today, today); else if (k === 'last7') range(addDays(today, -6), undefined); else if (k === 'last30') range(addDays(today, -29), undefined); else if (k === 'all') range(undefined, undefined); }}
          options={[{ value: 'today', label: t('common.today') }, { value: 'last7', label: t('activity.last7') }, { value: 'last30', label: t('activity.last30') }, { value: 'all', label: t('activity.allTime') }, ...(rangeKey === 'custom' ? [{ value: 'custom', label: t('activity.fRange') }] : [])]} />
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="group" aria-label={t('activity.fRange')}>
          {chip(t('common.today'), f.from === today && f.to === today, () => range(today, today))}
          {chip(t('activity.last7'), isRange(addDays(today, -6)), () => range(addDays(today, -6), undefined))}
          {chip(t('activity.last30'), isRange(addDays(today, -29)), () => range(addDays(today, -29), undefined))}
          {chip(t('activity.allTime'), !f.from && !f.to, () => range(undefined, undefined))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <NumTabs label={t('activity.fVisibility')} value={f.visibility || 'all'} onChange={(v) => patch({ visibility: v })} maxWidth={560}
          items={[{ value: 'all', label: t('common.all'), n: all.length }, { value: 'visible', label: t('activity.visible'), n: all.length - hiddenN - pendingN }, { value: 'hidden', label: t('activity.hidden'), n: hiddenN }, { value: 'pending', label: t('activity.pendingFilter'), n: pendingN }]} />
        {active ? <Button variant="ghost" size={44} onClick={() => setF({ visibility: 'all' })}>{t('activity.clearFilters')}</Button> : null}
      </div>
    </>
  );
  const dayGroups = (d: (typeof days)[number]) => (
    <>
      {d.groups.map((g) => (
        <div key={g.activity} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: '#6E5A43', lineHeight: 1.4 }}>{activityLabel(s, g.activity, t, lang)}</span>
          <div style={{ display: 'grid', gridTemplateColumns: isPhone ? 'repeat(3,minmax(0,1fr))' : 'repeat(auto-fill,minmax(120px,1fr))', gap: 8 }}>
            {g.photos.map((p) => {
              const who = p.memberIds.map((id) => (s.members[id] ? memberShort(s.members[id]) : '')).filter(Boolean).join(', ');
              const aria = [activityLabel(s, g.activity, t, lang), p.time, who, p.media === 'video' ? t('activity.video') : '', p.kind === 'activity' ? t('activity.picKind') : '', p.visibility === 'hidden' ? t('activity.hidden') : p.visibility === 'pending' ? t('activity.pendingTag') : ''].filter(Boolean).join(', ');
              return <PhotoTile key={p.id} p={p} aria={aria} hiddenLabel={t('activity.hidden')} pendingLabel={t('activity.pendingTag')} onClick={() => setViewer(p.id)} />;
            })}
          </div>
        </div>
      ))}
    </>
  );
  return (
    <>
      {title}
      <Eyebrow>{summary}</Eyebrow>
      {isPhone ? (
        // round 6, phone: the filters are one flat group (no header)
        <Group pad="14px 16px" gap={12}>{filterBody}</Group>
      ) : (
        <Card pad={22} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{filterBody}</Card>
      )}

      {paged.rows.map((d) => (isPhone ? (
        // round 6, phone: a day is a group, its date and photo count as the header outside
        <Group key={d.date} title={d.date === today ? t('common.today') : fdl(d.date)} meta={plural(t, 'activity.photosCount', d.count)} pad="12px 16px 14px" gap={14}>{dayGroups(d)}</Group>
      ) : (
        <Card key={d.date} pad={22} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 20, lineHeight: '28px', fontWeight: 400, letterSpacing: '-0.3px', color: '#2B231C' }}>{d.date === today ? t('common.today') : fdl(d.date)}</span>
            <span style={{ fontSize: 14, color: '#6B6259', whiteSpace: 'nowrap', lineHeight: 1.4 }}>{plural(t, 'activity.photosCount', d.count)}</span>
          </div>
          {dayGroups(d)}
        </Card>
      )))}
      <Pager page={paged.page} pages={paged.pages} onPage={paged.setPage} label={t('activity.libPager')} />
      {!days.length ? (isPhone ? (
        <Group pad={0} gap={0}>
          <EmptyState icon="photo_library" title={all.length ? t('activity.noMatch') : t('activity.noPhotos')}
            action={active ? <Button variant="secondary" onClick={() => setF({ visibility: 'all' })}>{t('activity.clearFilters')}</Button> : undefined} />
        </Group>
      ) : (
        <Card>
          <EmptyState icon="photo_library" title={all.length ? t('activity.noMatch') : t('activity.noPhotos')}
            action={active ? <Button variant="secondary" onClick={() => setF({ visibility: 'all' })}>{t('activity.clearFilters')}</Button> : undefined} />
        </Card>
      )) : null}
      {viewer ? <PhotoViewer photos={flat} startId={viewer} onClose={() => setViewer(null)} audience="staff" /> : null}
    </>
  );
}
