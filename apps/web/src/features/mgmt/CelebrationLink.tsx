// The birthday reminder's link (round 14): /celebrations?new={memberId}&date={date} opens the celebration request form pre-filled over a quiet page, and closing it
// returns to where the person works (the Venue's Celebrations tab for the front desk and management, Today for the activity team).
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Page } from './common';
import { CelebrationSheet } from './CelebrationSheet';
import { useMe } from '../../lib/me';
import { useClub } from '../../store/replica';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function CelebrationLink() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const { role } = useMe();
  const s = useClub();
  const memberId = sp.get('new') ?? '';
  const date = sp.get('date') ?? '';
  const prefill = s.members[memberId] && ISO.test(date) ? { memberId, kind: 'birthday' as const, date } : undefined;
  const back = () => navigate(role === 'activity' ? '/today' : '/venue?tab=celebrations', { replace: true });
  return (
    <Page>
      <CelebrationSheet open onClose={back} prefill={prefill} />
    </Page>
  );
}
