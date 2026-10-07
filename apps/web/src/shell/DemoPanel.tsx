// Floating "Demo" pill (design: real-phone mode "Demo" button) -> guided demo, switch account, reset.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Dialog, Drawer, Icon, Pager, Sheet, SectionLabel, Avatar, usePaged, FONT_BODY } from '../components/ui';
import { useT, useFmt } from '../lib/i18n';
import { useNow } from '../lib/clock';
import { useClub } from '../store/replica';
import { useSession, signInDemo } from '../store/session';
import { api } from '../lib/api';
import { say } from '../store/ui';
import { DEMO_STEPS } from '../features/demo/steps';

/** The guided demo ("Oma Lina's day") is hidden for now (KC); switch account and reset stay. */
const SHOW_GUIDED = false;
import { useDemoAccounts } from './demoAccounts';

export function DemoPill({ phone }: { phone: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={t('demo.pill')} title={t('demo.pill')}
        style={phone
          ? { position: 'fixed', left: 12, bottom: 102, zIndex: 45, width: 40, height: 40, padding: 0, borderRadius: 999, border: 'none', background: 'rgba(36,32,28,0.9)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.25)' }
          : { position: 'fixed', right: 24, bottom: 24, zIndex: 45, height: 42, padding: '0 16px 0 12px', borderRadius: 12, border: 'none', background: '#24201C', color: '#FFFFFF', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,0,0,0.25)', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>
        <Icon name="tune" size={phone ? 20 : 18} color="#FFFFFF" />{phone ? null : t('demo.pill')}
      </button>
      <DemoPanel open={open} onClose={() => setOpen(false)} phone={phone} />
    </>
  );
}

export function useSignInAs() {
  return async (userId: string) => { await signInDemo(userId); };
}

function DemoPanel({ open, onClose, phone }: { open: boolean; onClose: () => void; phone: boolean }) {
  const t = useT();
  const navigate = useNavigate();
  const s = useClub();
  const { now, today } = useNow();
  const { fd } = useFmt();
  const accounts = useDemoAccounts();
  const pagedAccounts = usePaged(accounts, 6);
  const signInAs = useSignInAs();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const me = useSession((x) => x.user?.id);
  const runStep = async (id: string, fn: () => Promise<void>) => {
    setBusy(id);
    onClose();
    try { await fn(); } catch { say(t('err.network'), { tone: 'error', icon: 'error' }); } finally { setBusy(null); }
  };
  const done = DEMO_STEPS.filter((st) => s && st.done(s)).length;
  const body = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: FONT_BODY, color: '#5E5852' }}><Icon name="schedule" size={18} />{t('demo.clock')}: <strong style={{ color: '#24201C', fontVariantNumeric: 'tabular-nums' }}>{now}</strong> · {fd(today, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).replace(/,/g, '')}</div>
      {SHOW_GUIDED && DEMO_STEPS.length ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <SectionLabel>{t('demo.guided')} · {t('demo.progress', { n: done, total: DEMO_STEPS.length })}</SectionLabel>
            <span style={{ fontSize: 22, lineHeight: '30px', letterSpacing: '-0.3px', color: '#2B231C' }}>{t('demo.guidedTitle')}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {DEMO_STEPS.map((st, i) => {
              const isDone = !!s && st.done(s);
              const next = !isDone && DEMO_STEPS.findIndex((x) => !(s && x.done(s))) === i;
              return (
                <div key={st.id} style={{ borderRadius: 14, border: next ? '2px solid #24201C' : '1px solid #EFE7DC', background: isDone ? '#F3EEE8' : '#FFFFFF', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ width: 28, height: 28, borderRadius: 999, background: isDone ? '#3D6B4F' : next ? '#24201C' : '#F3EEE8', color: isDone || next ? '#FFFFFF' : '#24201C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, flex: 'none' }}>{isDone ? <Icon name="check" size={18} /> : i + 1}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <span style={{ fontSize: FONT_BODY, color: '#5E5852', fontVariantNumeric: 'tabular-nums' }}>{st.time}</span>
                      <span style={{ fontSize: 16, fontWeight: 500, lineHeight: '21px' }}>{t(st.titleKey)}</span>
                    </div>
                  </div>
                  <span style={{ fontSize: FONT_BODY, lineHeight: '20px' }}>{t(st.subKey)}</span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Button size={44} variant={next ? 'primary' : 'secondary'} disabled={!!busy} onClick={() => void runStep(st.id, st.run)}>{t(st.runLabelKey)}</Button>
                    {st.alt ? <Button size={44} variant="secondary" disabled={!!busy} onClick={() => void runStep(st.id + '-alt', st.alt!.run)}>{t(st.alt.labelKey)}</Button> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : null}
      <SectionLabel>{t('demo.switchAccount')}</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {pagedAccounts.rows.map((a) => (
          <button key={a.id} type="button" onClick={async () => { await signInAs(a.id); onClose(); navigate('/today'); }} className="h-border" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', minHeight: 56, borderRadius: 12, border: a.id === me ? '2px solid #75624B' : '1px solid #E4DACD', background: '#FFFFFF', textAlign: 'left', cursor: 'pointer', fontFamily: 'Inter', color: '#24201C' }}>
            <Avatar name={a.name} size={38} />
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: 16, fontWeight: 500 }}>{a.name}</span><span style={{ fontSize: FONT_BODY, color: '#5E5852' }}>{a.role}</span></span>
          </button>
        ))}
        <Pager page={pagedAccounts.page} pages={pagedAccounts.pages} onPage={pagedAccounts.setPage} label={t('demo.switchAccount')} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Button variant="danger" icon="restart_alt" onClick={() => setConfirm(true)}>{t('demo.reset')}</Button>
      </div>
      <Dialog open={confirm} onClose={() => setConfirm(false)} title={t('demo.reset')} maxWidth={480} footer={<><Button variant="secondary" onClick={() => setConfirm(false)}>{t('common.cancel')}</Button><Button variant="danger" onClick={async () => { await api('/api/demo/reset', { body: {} }); setConfirm(false); onClose(); say(t('demo.resetDone')); }}>{t('demo.reset')}</Button></>}>
        <div style={{ fontSize: 16, lineHeight: '24px' }}>{t('demo.resetConfirm')}</div>
      </Dialog>
    </div>
  );
  return phone ? <Sheet open={open} onClose={onClose} title={t('demo.title')}>{body}</Sheet> : (
    <Drawer open={open} onClose={onClose} label={t('demo.title')} width={440}>
      <h2 style={{ margin: 0, fontSize: 26, lineHeight: '32px', fontWeight: 400, letterSpacing: '-0.5px', color: '#2B231C' }}>{t('demo.title')}</h2>
      {body}
    </Drawer>
  );
}
