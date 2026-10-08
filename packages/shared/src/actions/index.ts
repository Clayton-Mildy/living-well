// Action registry. Each feature area exports its actions; all are registered here (client and server).
import { registerActions } from './framework';
import { reviewActions } from './review';
import { approvalActions } from './approvals';
import { sessionActions } from './session';
import { attendanceActions } from './attendance';
import { healthActions } from './health';
import { membersActions } from './members';
import { familyActions } from './family';
import { careActions } from './care';
import { photoActions } from './photos';
import { kitchenActions } from './kitchen';
import { requestsActions } from './requests';
import { financeActions } from './finance';
import { enquiriesActions } from './enquiries';
import { clubActions } from './club';
import { demoActions } from './demo';
import { jobsActions } from './jobs';
import { scheduleActions } from './schedule';
import { directoryActions } from './directory';
import { peopleActions } from './people';
import { planRequestActions } from './planRequests';
import { membershipActions } from './membership';
import { accountActions } from './accounts';
import { renewalActions } from './renewals';
import { guestActions } from './guests';
import { taskActions } from './tasks';

registerActions([
  ...reviewActions, ...approvalActions, ...sessionActions, ...attendanceActions, ...healthActions, ...membersActions, ...familyActions,
  ...careActions, ...photoActions, ...kitchenActions, ...requestsActions, ...financeActions, ...enquiriesActions, ...clubActions, ...demoActions, ...jobsActions, ...scheduleActions, ...directoryActions, ...peopleActions, ...planRequestActions, ...membershipActions, ...accountActions,
  ...renewalActions, ...guestActions, ...taskActions,
] as never);

export * from './framework';
export { registerJob } from './jobs';
export { accountRows, findAccount, accessState, accountsNeedingUsername, usernameBase, USERNAME_RE, DEFAULT_PASSWORD, MIN_PASSWORD, MAX_PASSWORD, type AccountRef } from './accounts';
export { ensureAttendance, familyUserIds, shortOf, requireMember } from './helpers';
