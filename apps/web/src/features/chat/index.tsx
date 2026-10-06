// Messages feature: staff conversations by topic (lobby, nurse, activity, kitchen, finance, management) and the family's own threads.
import { useMe } from '../../lib/me';
import { Chat } from './Chat';

export function Messages() {
  const { user } = useMe();
  if (!user) return null;
  return <Chat audience={user.kind === 'family' ? 'family' : 'staff'} />;
}
