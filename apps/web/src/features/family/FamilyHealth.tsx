// Family Health: the member switcher above the member's health profile (family audience). The member is passed explicitly,
// so switching to Opa Budi shows Opa Budi. A deep link /health?member=<id> selects that member.
import { memberShort } from '@cp/shared';
import { healthMemberOf } from '@cp/shared/rules/family';
import { useDevice } from '../../hooks/useDevice';
import { MemberProfile } from '../members/MemberProfile';
import { FamSwitch } from './parts';
import { famPad, useFamilyCtx, useFamilySel } from './useFamily';

export function FamilyHealth() {
  const { s, t, user } = useFamilyCtx();
  const { isPhone } = useDevice();
  const { choices, sel, setSel, multi } = useFamilySel();
  const memberId = healthMemberOf(sel, choices);
  if (!user || !memberId) return null;
  return (
    <div data-testid="family-health" data-member-id={memberId}>
      {multi ? (
        <div style={{ padding: famPad(isPhone), paddingBottom: 0, maxWidth: 680, margin: '0 auto', width: '100%' }}>
          <FamSwitch segmented={isPhone} label={t('family.switcher')} value={memberId} onChange={setSel} items={choices.map((id) => ({ key: id, label: memberShort(s.members[id]) }))} />
        </div>
      ) : null}
      <MemberProfile key={memberId} memberId={memberId} audience="family" />
    </div>
  );
}
