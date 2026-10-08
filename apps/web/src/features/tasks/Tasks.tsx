// Tasks (KC round 7): a tracker of each role's general duties (a picture of each session, the lunch photo, the checks…), so nobody forgets them, plus additional tasks.
// Everyone sees their own day (Mine): the duties, which tick themselves from the data, then management's recurring checklist. Management also has Team (how each role is
// doing, for any day, week or month) and Manage (switch duties off, set their times, and the additional tasks). /tasks?view=team|manage opens a view.
import { useSearchParams } from 'react-router-dom';
import type { StaffRole } from '@cp/shared';
import { PageHead, Segmented } from '../../components/ui';
import { padFor, useDevice } from '../../hooks/useDevice';
import { useNow } from '../../lib/clock';
import { useFmt, useT } from '../../lib/i18n';
import { useMe } from '../../lib/me';
import { useClub } from '../../store/replica';
import { ManageView } from './ManageView';
import { MineView } from './MineView';
import { TeamView } from './TeamView';

type View = 'mine' | 'team' | 'manage';

export function Tasks() {
  const t = useT();
  const fmt = useFmt();
  const s = useClub();
  const { role } = useMe();
  const { today, nowMin, now } = useNow();
  const { device, isPhone } = useDevice();
  const [sp, setSp] = useSearchParams();
  const mgmt = role === 'mgmt';
  const q = sp.get('view');
  const view: View = mgmt && (q === 'team' || q === 'manage') ? q : 'mine';
  if (!s || !role || role === 'family') return null;
  return (
    <div className={isPhone ? 'cp-native' : undefined} style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: isPhone ? 14 : 22 }}>
      <PageHead size={40} eyebrow={isPhone ? <><span>{fmt.fds(today)}</span> · <span style={{ fontVariantNumeric: 'tabular-nums' }}>{now}</span></> : fmt.fdl(today)} title={t('tasks.title')} />
      {mgmt ? (
        <Segmented<View> label={t('tasks.title')} value={view} onChange={(v) => setSp(v === 'mine' ? {} : { view: v }, { replace: true })}
          items={[{ value: 'mine', label: t('tasks.mine') }, { value: 'team', label: t('tasks.team') }, { value: 'manage', label: t('tasks.manage') }]} />
      ) : null}
      {view === 'mine' ? <MineView s={s} role={role as StaffRole} today={today} nowMin={nowMin} />
        : view === 'team' ? <TeamView s={s} today={today} nowMin={nowMin} />
        : <ManageView />}
    </div>
  );
}
