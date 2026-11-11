// "Install app": a settings-style row (for the demo/account panel) and a quiet link (login page). iOS opens two steps instead of the browser prompt.
import { useState } from 'react';
import { Icon, Sheet } from '../components/ui';
import { useT } from '../lib/i18n';
import { useInstall } from '../lib/install';

function IosSteps({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  return (
    <Sheet open={open} onClose={onClose} title={t('pwa.iosTitle')}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {([['ios_share', 'pwa.step1'], ['add_box', 'pwa.step2']] as const).map(([icon, key], i) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 52, padding: '8px 14px', borderRadius: 12, background: 'var(--fill, #F4F4F5)', fontFamily: 'Inter', fontSize: 16, color: '#24201C' }}>
            <span style={{ fontWeight: 600, color: '#5E5852' }}>{i + 1}.</span>
            <span style={{ flex: 1 }}>{t(key)}</span>
            <Icon name={icon} size={24} color="var(--accent, #75624B)" />
          </div>
        ))}
      </div>
    </Sheet>
  );
}

function useInstallAction(onDone?: () => void) {
  const { show, ios, install } = useInstall();
  const [steps, setSteps] = useState(false);
  const go = () => {
    if (ios) { setSteps(true); return; }
    void install().then(() => onDone?.());
  };
  return { show, go, steps, closeSteps: () => { setSteps(false); onDone?.(); } };
}

export function InstallAppRow({ onDone }: { onDone?: () => void }) {
  const t = useT();
  const { show, go, steps, closeSteps } = useInstallAction(onDone);
  if (!show) return null;
  return (
    <>
      <button type="button" onClick={go} className="h-fill" style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', boxSizing: 'border-box', padding: '8px 12px', minHeight: 48, borderRadius: 12, border: 'none', background: 'var(--fill, #F4F4F5)', textAlign: 'left', cursor: 'pointer', fontFamily: 'Inter', fontSize: 16, color: '#24201C' }}>
        <Icon name="download" size={22} />
        <span style={{ flex: 1, minWidth: 0 }}>{t('pwa.install')}</span>
        <Icon name="chevron_right" size={22} color="#5E5852" />
      </button>
      <IosSteps open={steps} onClose={closeSteps} />
    </>
  );
}

export function InstallAppLink() {
  const t = useT();
  const { show, go, steps, closeSteps } = useInstallAction();
  if (!show) return null;
  return (
    <>
      <button type="button" onClick={go} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 40, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'Inter', fontSize: 14, color: 'var(--accent, #75624B)' }}>
        <Icon name="download" size={18} />{t('pwa.install')}
      </button>
      <IosSteps open={steps} onClose={closeSteps} />
    </>
  );
}
