// Screen registry: nav screen id -> lazily loaded feature component.
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { ScreenId } from './nav';

const L = <M extends Record<string, ComponentType>>(load: () => Promise<M>, name: keyof M): LazyExoticComponent<ComponentType> =>
  lazy(() => load().then((m) => ({ default: m[name] as ComponentType })));

const lobby = () => import('../features/lobby');
const health = () => import('../features/health');
const members = () => import('../features/members');
const activity = () => import('../features/activity');
const calendar = () => import('../features/calendar');
const kitchen = () => import('../features/kitchen');
const chat = () => import('../features/chat');
const requests = () => import('../features/requests');
const finance = () => import('../features/finance');
const mgmt = () => import('../features/mgmt');
const enquiries = () => import('../features/enquiries');
const family = () => import('../features/family');

export const SCREENS: Record<ScreenId, LazyExoticComponent<ComponentType>> = {
  arrivals: L(lobby, 'Arrivals'),
  health: L(health, 'HealthStation'),
  readings: L(health, 'Readings'),
  members: L(members, 'MembersList'),
  reviews: L(members, 'Reviews'),
  activityToday: L(activity, 'ActivityToday'),
  camera: L(activity, 'Camera'),
  photoLib: L(activity, 'PhotoLibrary'),
  dlog: L(activity, 'DailyLog'),
  cal: L(calendar, 'Calendar'),
  kmenu: L(kitchen, 'KitchenMenu'),
  kfeed: L(kitchen, 'KitchenFeedback'),
  kstock: L(kitchen, 'Stock'),
  chat: L(chat, 'Messages'),
  requests: L(requests, 'Requests'),
  fin: L(finance, 'Billing'),
  pay: L(finance, 'Payments'),
  budget: L(finance, 'Budget'),
  rcpt: L(finance, 'Receipts'),
  dir: L(finance, 'Directory'),
  overview: L(mgmt, 'Overview'),
  bc: L(mgmt, 'Broadcast'),
  venue: L(mgmt, 'Venue'),
  hr: L(mgmt, 'People'),
  surveys: L(mgmt, 'Surveys'),
  plans: L(mgmt, 'Plans'),
  enq: L(enquiries, 'Enquiries'),
  familyToday: L(family, 'FamilyToday'),
  fphotos: L(family, 'FamilyPhotos'),
  familyHealth: L(family, 'FamilyHealth'),
  fbill: L(family, 'FamilyBilling'),
};
export const MemberProfileScreen = L(members, 'MemberProfile');
export const DesignSystemScreen = lazy(() => import('../features/demo/DesignSystem').then((m) => ({ default: m.DesignSystem })));
