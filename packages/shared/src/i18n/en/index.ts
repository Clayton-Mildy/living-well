// EN dictionary: every namespace, prefixed ('lobby.checkIn').
import { ns } from '../ns';
import { common, status, nav, roles, login, shell, notif, feed, err, review, demo, inv } from './core';
import { lobby } from './lobby';
import { health } from './health';
import { family } from './family';
import { members } from './members';
import { profile } from './profile';
import { activity } from './activity';
import { kitchen } from './kitchen';
import { finance } from './finance';
import { mgmt } from './mgmt';
import { enq } from './enq';
import { form } from './form';
import { cal } from './cal';
import { requests } from './requests';
import { reviews } from './reviews';
import { approvals } from './approvals';
import { people } from './people';
import { ds } from './ds';
import { renewals } from './renewals';
import { tasks } from './tasks';
import { guests } from './guests';
import { insights } from './insights';
import { report } from './report';
import { drafts } from './drafts';
import { mood } from './mood';
import { checkOn } from './checkOn';
import { reg } from './reg';
import { celeb } from './celeb';
import { occasions } from './occasions';
import { occ } from './occ';
import { fam } from './fam';
import { ftoday } from './ftoday';
import { fphotos } from './fphotos';
import { fcal } from './fcal';
import { fhealth } from './fhealth';
import { fme } from './fme';
import { month } from './month';
import { unpaid } from './unpaid';
import { care } from './care';
import { purchasing } from './purchasing';
import { search } from './search';
import { sign } from './sign';

export const en = {
  ...ns('common', common),
  ...ns('status', status),
  ...ns('nav', nav),
  ...ns('roles', roles),
  ...ns('login', login),
  ...ns('shell', shell),
  ...ns('notif', notif),
  ...ns('feed', feed),
  ...ns('err', err),
  ...ns('review', review),
  ...ns('demo', demo),
  ...ns('inv', inv),
  ...ns('lobby', lobby),
  ...ns('health', health),
  ...ns('family', family),
  ...ns('members', members),
  ...ns('profile', profile),
  ...ns('activity', activity),
  ...ns('kitchen', kitchen),
  ...ns('finance', finance),
  ...ns('mgmt', mgmt),
  ...ns('enq', enq),
  ...ns('form', form),
  ...ns('cal', cal),
  ...ns('requests', requests),
  ...ns('reviews', reviews),
  ...ns('approvals', approvals),
  ...ns('people', people),
  ...ns('ds', ds),
  ...ns('renewals', renewals),
  ...ns('tasks', tasks),
  ...ns('guests', guests),
  ...ns('insights', insights),
  ...ns('report', report),
  ...ns('drafts', drafts),
  ...ns('mood', mood),
  ...ns('checkOn', checkOn),
  ...ns('reg', reg),
  ...ns('celeb', celeb),
  ...ns('occasions', occasions),
  ...ns('occ', occ),
  ...ns('fam', fam),
  ...ns('ftoday', ftoday),
  ...ns('fphotos', fphotos),
  ...ns('fcal', fcal),
  ...ns('fhealth', fhealth),
  ...ns('fme', fme),
  ...ns('month', month),
  ...ns('unpaid', unpaid),
  ...ns('care', care),
  ...ns('purchasing', purchasing),
  ...ns('search', search),
  ...ns('sign', sign),
};
export const EN_NS = { common, status, nav, roles, login, shell, notif, feed, err, review, demo, inv, lobby, health, family, members, profile, activity, kitchen, finance, mgmt, enq, form, cal, requests, reviews, approvals, people, ds, renewals, tasks, guests, insights, report, drafts, mood, checkOn, reg, celeb, occasions, occ, fam, ftoday, fphotos, fcal, fhealth, fme, month, unpaid, care, purchasing, search, sign };
