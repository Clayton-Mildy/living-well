// Guided demo "Oma Lina's day" (design demoVals 3225–3245), rebuilt on real actions. Steps are safe to re-run.
import { live, type ClubState } from '@cp/shared';
import { demo } from './runner';
import { clockNow, useReplica } from '../../store/replica';

export interface DemoStep { id: string; time: string; titleKey: string; subKey: string; runLabelKey: string; done: (s: ClubState) => boolean; run: () => Promise<void>; alt?: { labelKey: string; run: () => Promise<void> } }
/** the demo day (today, from the shared clock) */
const today = () => clockNow(useReplica.getState().clock).today;
const T = (_s: ClubState) => today();
const att = (s: ClubState) => s.attendance[`${T(s)}:m1`];
const logToday = (s: ClubState) => live(s.dailyLogs).find((l) => l.memberId === 'm1' && l.date === T(s) && l.status === 'saved');
const seen = (k: string) => { try { return localStorage.getItem('cp.demo.' + k) === '1'; } catch { return false; } };
const markSeen = (k: string) => { try { localStorage.setItem('cp.demo.' + k, '1'); } catch { /* ignore */ } };
async function ensureCheckedIn() {
  const s = demo.state();
  if (s && !att(s)?.checkIn) {
    await demo.signInAs('s1');
    await demo.act('attendance.checkIn', { memberId: 'm1', method: 'face' });
  }
}

export const DEMO_STEPS: DemoStep[] = [
  { id: 'arrive', time: '10:00', titleKey: 'demo.s1.title', subKey: 'demo.s1.sub', runLabelKey: 'demo.s1.run', done: (s) => !!att(s)?.checkIn,
    async run() {
      await demo.setClock('10:00'); await demo.signInAs('s1'); demo.go('/today?demo=arrival');
      // the Arrivals screen plays the door-camera recognition and confirms; fall back to a direct check-in if it didn't
      for (let i = 0; i < 50; i++) { const s = demo.state(); if (s && att(s)?.checkIn) return; await demo.sleep(100); }
      const s = demo.state();
      if (s && !att(s)?.checkIn) await demo.act('attendance.checkIn', { memberId: 'm1', method: 'face' });
    } },
  { id: 'bp', time: '10:08', titleKey: 'demo.s2.title', subKey: 'demo.s2.sub', runLabelKey: 'demo.s2.run', done: (s) => live(s.readings).some((r) => r.memberId === 'm1' && r.date === T(s) && r.kind === 'arrival' && !r.voided),
    async run() { await ensureCheckedIn(); await demo.setClock('10:08'); await demo.signInAs('s8'); demo.go('/today?member=m1&demo=high'); } },
  // Dinar's photos wait for management's approval; Ega approves them and the families are told
  { id: 'photos', time: '10:50', titleKey: 'demo.s3.title', subKey: 'demo.s3.sub', runLabelKey: 'demo.s3.run', done: (s) => live(s.photos).some((p) => p.date === T(s) && p.memberIds.includes('m1') && (p.kind === 'solo' || p.kind === 'group') && p.visibility === 'visible'),
    async run() {
      await ensureCheckedIn(); await demo.setClock('10:50'); await demo.signInAs('s5'); demo.go('/camera');
      const a = await demo.act('photo.take', { kind: 'solo', memberIds: ['m1'], activity: 'Keroncong sing-along', media: 'photo' });
      const b = await demo.act('photo.take', { kind: 'group', memberIds: ['m1', 'm46', 'm2'], activity: 'Keroncong sing-along', media: 'photo' });
      const ids = [a?.photoId, b?.photoId].filter((x): x is string => typeof x === 'string');
      await demo.sleep(900);
      await demo.signInAs('s9'); demo.go('/reviews?tab=photos');
      await demo.sleep(900);
      if (ids.length) await demo.act('photo.approve', { photoIds: ids, notify: true });
    } },
  { id: 'lunch', time: '12:02', titleKey: 'demo.s4.title', subKey: 'demo.s4.sub', runLabelKey: 'demo.s4.run', done: (s) => (s.dayMenus[T(s)]?.photoIds || []).some((id) => s.photos[id]?.visibility === 'visible'),
    async run() {
      await demo.setClock('12:02'); await demo.signInAs('s3'); demo.go('/today');
      const r = await demo.act('menu.postLunchPhoto', { date: today() });
      const id = (r?.photoId as string | undefined) || [...(demo.state()?.dayMenus[today()]?.photoIds || [])].pop();
      if (id && demo.state()?.photos[id]?.visibility === 'pending') { await demo.signInAs('s9'); await demo.act('photo.approve', { photoIds: [id], notify: true }); }
    } },
  { id: 'log', time: '13:15', titleKey: 'demo.s5.title', subKey: 'demo.s5.sub', runLabelKey: 'demo.s5.run', done: (s) => !!logToday(s),
    async run() {
      await ensureCheckedIn(); await demo.setClock('13:15'); await demo.signInAs('s5'); demo.go('/log');
      await demo.act('log.save', { memberId: 'm1', date: today(), mood: 'cheerful', lunch: 'half', joined: 'yes', communicative: 'normal', content: 'normal', note: 'Oma Lina sang Bengawan Solo again at keroncong and asked for an extra cup of teh melati. She ate about half of her lunch.' });
    } },
  { id: 'home', time: '15:45', titleKey: 'demo.s6.title', subKey: 'demo.s6.sub', runLabelKey: 'demo.s6.run', done: (s) => !!att(s)?.checkOut,
    async run() {
      await ensureCheckedIn(); await demo.setClock('15:45');
      const s = demo.state();
      if (s && !live(s.readings).some((r) => r.memberId === 'm1' && r.date === T(s) && r.kind === 'departure' && !r.voided)) {
        await demo.signInAs('s8');
        await demo.act('reading.save', { memberId: 'm1', kind: 'departure', sys: 134, dia: 84, pulse: 76, noteKeys: [], shared: true, tellFamily: false, recheck: false, deferMonthly: false, source: 'device' });
      }
      await demo.signInAs('s1');
      await demo.act('attendance.checkOut', { memberId: 'm1' });
      demo.go('/today');
    } },
  { id: 'maria', time: '17:10', titleKey: 'demo.s7.title', subKey: 'demo.s7.sub', runLabelKey: 'demo.s7.run', done: (s) => live(s.messages).some((m) => m.from === 'family:f1' && m.at.startsWith(T(s))),
    async run() {
      await demo.setClock('17:10'); await demo.signInAs('f1'); demo.go('/today');
      await demo.sleep(900);
      const s = demo.state();
      const log = s && logToday(s);
      if (log) await demo.act('message.send', { memberId: 'm1', topic: 'care', text: 'Thank you Dinar, Mama is still humming Bengawan Solo at home!', ref: { type: 'dailyLog', id: log.id } });
      await demo.act('message.send', { memberId: 'm1', topic: 'lobby', text: 'Mama left her reading glasses on the lunch table. Could you keep them at the lobby?' });
    } },
  // Flex is 10 visits a month: today's visit is Oma Lina's 11th in October, so it is an extra day on November's invoice
  { id: 'extra', time: '17:15', titleKey: 'demo.s8.title', subKey: 'demo.s8.sub', runLabelKey: 'demo.s8.run', done: (s) => seen('extra') && !!att(s)?.checkIn,
    async run() { await ensureCheckedIn(); markSeen('extra'); await demo.signInAs('f1'); demo.go('/today?member=m1'); } },
  { id: 'invoice', time: '15 Nov', titleKey: 'demo.s9.title', subKey: 'demo.s9.sub', runLabelKey: 'demo.s9.run',
    done: (s) => live(s.invoices).some((i) => i.memberId === 'm1' && i.period === '2026-11' && live(s.payments).some((p) => p.allocations.some((a) => a.invoiceId === i.id))),
    async run() {
      await demo.signInAs('s10');
      let s = demo.state();
      if (s && !live(s.invoices).some((i) => i.memberId === 'm1' && i.period === '2026-11')) await demo.act('run.issue', { period: '2026-11', early: true });
      await demo.signInAs('f1'); demo.go('/billing');
      await demo.sleep(700);
      s = demo.state();
      const inv = s && live(s.invoices).find((i) => i.memberId === 'm1' && i.period === '2026-11');
      if (inv) await demo.act('payment.simulateVa', { invoiceIds: [inv.id], bank: 'BCA' });
    },
    alt: { labelKey: 'demo.s9.alt', async run() { await demo.signInAs('s10'); demo.go('/payments'); } } },
  { id: 'overview', time: 'Live', titleKey: 'demo.s10.title', subKey: 'demo.s10.sub', runLabelKey: 'demo.s10.run', done: () => seen('overview'),
    async run() { markSeen('overview'); await demo.signInAs('s9'); demo.go('/today'); } },
  { id: 'price', time: 'Live', titleKey: 'demo.s11.title', subKey: 'demo.s11.sub', runLabelKey: 'demo.s11.run', done: (s) => live(s.prices).some((p) => !p.sample.flex),
    async run() { await demo.signInAs('s9'); demo.go('/plans'); } },
];
