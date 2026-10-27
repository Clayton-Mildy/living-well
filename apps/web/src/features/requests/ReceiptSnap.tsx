// Snap a receipt (design Receipts "snap panel"): the section staff's way in. Round 14 p2: the same capture as Finance > Receipts
// (real camera, upload, the reader fills the supplier, lines and total), starting on the section this role most likely spends from.
import { useT } from '../../lib/i18n';
import { useMe } from '../../lib/me';
import { useClub } from '../../store/replica';
import { useDevice } from '../../hooks/useDevice';
import { ReceiptCapture } from '../finance/ReceiptCapture';
import { PGroup } from '../finance/parts';
import { defaultSectionId } from './finance';

export function ReceiptSnap({ onDone }: { onDone: () => void }) {
  const t = useT();
  const s = useClub();
  const { role } = useMe();
  const { isPhone } = useDevice();
  const capture = <ReceiptCapture defaultSectionId={defaultSectionId(s, role)} onDone={onDone} onCancel={onDone} sentText={(section) => t('requests.snap.sent', { section })} />;
  // round 6, phone: a flat group; elsewhere a grey card
  if (isPhone) return <PGroup gap={12}>{capture}</PGroup>;
  return <div className="cp-grey" style={{ background: 'var(--fill, #F4F4F5)', borderRadius: 20, padding: '22px clamp(18px, 3vw, 32px)', animation: 'cpUp .2s ease-out' }}>{capture}</div>;
}
