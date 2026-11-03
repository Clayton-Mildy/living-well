// Admin › Settings › Terms and conditions (round 17, KC): the current text (EN / ID), the version line, who has not agreed yet, and Edit (TermsEditor.tsx).
// Phone: a pushed full screen over Settings; tablet and desktop: the page replaces the Settings groups, with a way back.
import { useState } from 'react';
import { actorName, displayName, dtDate, type Lang } from '@cp/shared';
import { currentTerms, termsAgreement, termsText } from '@cp/shared/rules/terms';
import { Button, Group, HAIRLINE, PageHead, PhoneScreen, Segmented, FONT_SMALL } from '../../components/ui';
import { TermsView } from '../terms/TermsView';
import { useDevice } from '../../hooks/useDevice';
import { useFmt, useT } from '../../lib/i18n';
import { useClub } from '../../store/replica';
import { Page, linkBtn } from './common';
import { TermsEditor } from './TermsEditor';

export function TermsPage({ onBack }: { onBack: () => void }) {
  const t = useT();
  const fmt = useFmt();
  const { isPhone } = useDevice();
  const s = useClub();
  const [lang, setLang] = useState<Lang>(fmt.lang);
  const [editing, setEditing] = useState(false);
  const cur = currentTerms(s);
  const a = termsAgreement(s);
  const text = termsText(s, lang);

  const who = (contactId: string, memberIds: string[]) => {
    const names = memberIds.map((id) => s.members[id]).filter(Boolean).map(displayName).join(', ');
    return { name: s.familyContacts[contactId]?.name ?? contactId, sub: names ? t('terms.familyOf', { names }) : '' };
  };

  const body = (
    <>
      {cur ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <span style={{ fontSize: FONT_SMALL, color: '#6B6259', lineHeight: 1.4, minWidth: 0 }}>{t('terms.version', { v: cur.version, d: fmt.fd(dtDate(cur.publishedAt), { day: 'numeric', month: 'short' }), name: actorName(s, cur.publishedBy) })}</span>
          <Button variant="secondary" size={48} onClick={() => setEditing(true)}>{t('terms.edit')}</Button>
        </div>
      ) : (
        <Group pad="20px 16px" gap={14}>
          <span style={{ fontSize: 15, color: '#24201C', lineHeight: 1.4 }}>{t('terms.noText')}</span>
          <div><Button size={48} onClick={() => setEditing(true)}>{t('terms.write')}</Button></div>
        </Group>
      )}

      {cur ? (
        <>
          <Segmented<Lang> label={t('terms.textLang')} value={lang} onChange={setLang} items={[{ value: 'en', label: t('terms.tabEn') }, { value: 'id', label: t('terms.tabId') }]} />
          <div data-terms-text className="cp-grey" style={{ background: 'var(--fill, #F4F4F5)', borderRadius: 16, padding: '16px 16px 18px', color: '#24201C' }}>
            <TermsView text={text} />
            {lang === 'id' && !cur.id.trim() ? <div style={{ marginTop: 12, paddingTop: 10, borderTop: HAIRLINE, fontSize: FONT_SMALL, color: '#6B6259', lineHeight: 1.4 }}>{t('terms.idHint')}</div> : null}
          </div>

          <Group title={t('terms.notYet')} label={t('terms.notYet')} meta={t('terms.notYetCount', { a: a.agreed, n: a.total })} pad={0} gap={0}>
            {a.notYet.length === 0 ? (
              <div style={{ padding: '14px 16px', fontSize: 15, color: '#6B6259' }}>{t('terms.allAgreed')}</div>
            ) : a.notYet.map((r, i) => {
              const w = who(r.contactId, r.memberIds);
              return (
                <div key={r.contactId} data-not-agreed={r.contactId} style={{ display: 'flex', flexDirection: 'column', gap: 1, minHeight: 52, justifyContent: 'center', padding: '8px 16px', borderTop: i ? HAIRLINE : 'none' }}>
                  <span style={{ fontSize: 15, fontWeight: 500, color: '#24201C', lineHeight: 1.35 }}>{w.name}</span>
                  {w.sub ? <span style={{ fontSize: FONT_SMALL, color: '#6B6259', lineHeight: 1.35 }}>{w.sub}</span> : null}
                </div>
              );
            })}
          </Group>
        </>
      ) : null}

      {editing ? <TermsEditor onClose={() => setEditing(false)} /> : null}
    </>
  );

  if (isPhone) {
    return (
      <PhoneScreen open onClose={onBack} label={t('terms.title')} back={t('mgmt.settings.title')}>
        <h2 className="cp-serif" style={{ margin: 0, fontSize: 28, lineHeight: '34px', fontWeight: 500, color: '#24201C' }}>{t('terms.title')}</h2>
        {body}
      </PhoneScreen>
    );
  }
  return (
    <Page>
      <button type="button" className="cp-press" onClick={onBack} style={{ ...linkBtn, alignSelf: 'flex-start', minHeight: 44, textDecoration: 'none' }}>‹ {t('mgmt.settings.title')}</button>
      <PageHead title={t('terms.title')} size={32} />
      <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 18 }}>{body}</div>
    </Page>
  );
}
