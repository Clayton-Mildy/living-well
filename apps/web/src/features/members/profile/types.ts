// What every profile tab receives: the member, the club state, who is looking, and the actions it can start.
import type { ChangeRequest, ClubState, Lang, Member, Role, User } from '@cp/shared';
import type { MemberStatus, ProfileTab } from '@cp/shared/rules/members';
import type { TFn, useFmt } from '../../../lib/i18n';
import type { useAct } from '../../../lib/act';

export type DialogKind = 'details' | 'health' | 'care' | 'plan' | 'consent' | 'contact' | 'end' | 'reactivate';
export interface P {
  s: ClubState;
  m: Member;
  today: string;
  nowMin: number;
  t: TFn;
  fmt: ReturnType<typeof useFmt>;
  lang: Lang;
  audience: 'staff' | 'family';
  family: boolean;
  role: Role;
  me: User;
  mgmt: boolean;
  isPhone: boolean;
  st: MemberStatus;
  /** pending review requests for this member (staff) */
  pending: ChangeRequest[];
  /** review requests the family itself submitted for this member */
  mine: ChangeRequest[];
  act: ReturnType<typeof useAct>;
  go: (tab: ProfileTab) => void;
  open: (d: DialogKind, extra?: { familyId?: string }) => void;
  /** may the signed-in staff member edit what this tab shows */
  canEdit: boolean;
}
