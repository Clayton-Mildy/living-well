// ID dictionary: same keys as EN (enforced by the Same<> types in each file).
import { ns } from '../ns';
import { common, status, nav, roles, login, shell, notif, feed, err, review, demo, inv } from './core';
import { lobby } from './lobby';
import { health } from './health';
import { family } from './family';
import { members } from './members';
import { profile } from './profile';
import { activity } from './activity';
import { kitchen } from './kitchen';
import { chat } from './chat';
import { finance } from './finance';
import { mgmt } from './mgmt';
import { enq } from './enq';
import { form } from './form';
import { cal } from './cal';
import { requests } from './requests';
import { reviews } from './reviews';
import { people } from './people';
import { ds } from './ds';

export const id = {
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
  ...ns('chat', chat),
  ...ns('finance', finance),
  ...ns('mgmt', mgmt),
  ...ns('enq', enq),
  ...ns('form', form),
  ...ns('cal', cal),
  ...ns('requests', requests),
  ...ns('reviews', reviews),
  ...ns('people', people),
  ...ns('ds', ds),
};
