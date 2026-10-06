// Documents tab: one card per document (on file / missing / requested / pending review) with Upload or Replace (simulated file pick),
// the date and who added it, request-from-family and "Send form link", plus the consent record (who and when).
import { useRef, type ReactNode } from 'react';
import { actorName, fmtPhone, primaryContact, type DocType } from '@cp/shared';
import { consentOf, docOf, documentTypes } from '@cp/shared/rules/members';
import { FONT_BODY, FONT_SMALL, Icon, StatusBadge } from '../../../components/ui';
import { say } from '../../../store/ui';
import { listCardStyle, pillBtn } from '../lib';
import { ListHead, PendingBanner } from './parts';
import type { P } from './types';

const THUMB: Record<DocType, string> = { ktp: 'profile.thumb.ktp', nannyKtp: 'profile.thumb.ktp', membershipForm: 'profile.thumb.form', healthInfo: 'profile.thumb.photo', other: 'profile.thumb.file' };

function PickButton({ children, onPick, icon }: { children: ReactNode; onPick: (name: string) => void; icon?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className="h-cream" onClick={() => ref.current?.click()} style={pillBtn}>
        {icon ? <Icon name={icon} size={18} /> : null}
        {children}
      </button>
      <input ref={ref} type="file" accept="image/*,application/pdf" hidden data-testid="doc-file" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f.name); e.target.value = ''; }} />
    </>
  );
}

export function DocsTab({ p }: { p: P }) {
  const { s, m, t, fmt, today } = p;
  const frontDesk = !p.family && (p.role === 'lobby' || p.role === 'mgmt');
  const canUpload = p.family || frontDesk;
  const pendingFor = (type: DocType) => (p.family ? p.mine : p.pending).some((c) => c.status === 'pending' && c.section === 'docsConsent' && (c.action === 'document.upload' ? (c.input as { type?: string })?.type === type : (c.input as { docs?: { type: string }[] })?.docs?.some((d) => d.type === type)));
  const contact = primaryContact(s, m.id);
  const upload = async (type: DocType, fileName: string) => {
    if (p.family) await p.act('document.upload', { memberId: m.id, type, fileName }, { reviewText: t('profile.uploadSent') });
    else await p.act('members.setDocuments', { memberId: m.id, docs: [{ type, fileName }] }, { ok: t('profile.docSaved'), reviewText: t('profile.sentForReview') });
  };
  const ask = async (type: DocType) => { await p.act('members.requestDocument', { memberId: m.id, type }, { ok: t('profile.docAsked', { n: contact?.firstName || t('profile.theFamily') }) }); };
  const sendForm = async () => {
    const r = await p.act('form.send', { target: { type: 'member', id: m.id } }, { silent: true });
    if (!r.ok) return;
    const link = String(r.result.link || '');
    const url = link.startsWith('http') ? link : link ? `${window.location.origin}${link.startsWith('/') ? '' : '/'}${link}` : '';
    say(t('profile.formSent', { n: contact?.firstName || t('profile.theFamily') }), { icon: 'send', ...(url ? { action: { label: t('common.copy'), run: () => { void navigator.clipboard?.writeText(url).then(() => say(t('profile.linkCopied')), () => undefined); } } } : {}) });
  };
  const types = documentTypes(m);
  const sub = (type: DocType) => ({ ktp: t('profile.docMeta.ktp'), nannyKtp: m.nanny ? t('profile.docMeta.nannyKtp', { n: m.nanny.name }) : t('profile.docMeta.noNanny'), membershipForm: t('profile.docMeta.form'), healthInfo: t('profile.docMeta.health'), other: '' })[type];
  const title = (type: DocType) => (type === 'ktp' ? t('profile.docTitle.ktp', { n: m.firstName }) : type === 'nannyKtp' ? t('profile.docTitle.nannyKtp') : t('profile.docTitle.' + type));
  const consents = (['data', 'face'] as const).map((k) => ({ k, c: consentOf(m, k) }));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PendingBanner p={p} tab="docs" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,240px),1fr))', gap: 16 }}>
        {types.map((type) => {
          const doc = docOf(m, type);
          const has = doc?.status === 'onFile';
          const requested = doc?.status === 'requested';
          const waiting = pendingFor(type);
          const who = doc?.by ? actorName(s, doc.by) : '';
          const via = doc?.via ? t('profile.via_' + doc.via) : '';
          const meta = has ? t('profile.uploadedMeta', { d: fmt.fds(doc!.on || today), w: who, v: via }) : requested ? t('profile.requestedMeta', { d: fmt.fds(doc!.on || today) }) : sub(type);
          return (
            <div key={type} style={{ background: '#FFFFFF', border: '1px solid #DBD7D6', borderRadius: 24, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ aspectRatio: '3/2', background: has ? 'linear-gradient(135deg, #FBF8F4 0%, #EADFD3 60%, #DCCFC0 100%)' : '#F6F5F5', borderBottom: has ? '1px solid #DBD7D6' : '1px dashed #CAB8A2', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: 12, gap: 8 }}>
                <span style={{ height: 26, padding: '0 10px', borderRadius: 999, background: '#FFFFFF', fontSize: FONT_SMALL, fontWeight: 500, display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>{t(THUMB[type])}</span>
                {has && doc?.fileName ? <span style={{ fontSize: FONT_SMALL, color: '#6A6967', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{doc.fileName}</span> : null}
              </div>
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{title(type)}</div>
                <div style={{ fontSize: FONT_BODY, lineHeight: '20px', color: '#6A6967' }}>{meta}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {has ? <StatusBadge kind="paid" label={t('profile.docOnFile')} small /> : requested ? <StatusBadge kind="outstanding" label={t('profile.docRequested')} small /> : <StatusBadge kind="pending" label={t('profile.docMissing')} small />}
                  {waiting ? <span style={{ height: 28, padding: '0 10px 0 6px', borderRadius: 999, background: '#F6ECD6', color: '#7A5510', fontSize: FONT_SMALL, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="hourglass_top" size={18} fill={1} />{t('common.pendingReview')}</span> : null}
                </div>
                <div style={{ marginTop: 'auto', display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 4 }}>
                  {has ? <button type="button" className="h-cream" onClick={() => say(t('profile.docOpened', { d: title(type) }))} style={pillBtn}>{t('profile.view')}</button> : null}
                  {canUpload && !(type === 'nannyKtp' && !m.nanny) ? <PickButton icon="upload_file" onPick={(n) => upload(type, n)}>{has ? t('profile.replace') : t('profile.upload')}</PickButton> : null}
                  {frontDesk && !has && !(type === 'nannyKtp' && !m.nanny) ? <button type="button" className="h-cream" onClick={() => ask(type)} style={pillBtn}>{requested ? t('profile.remind') : t('profile.requestFamily')}</button> : null}
                  {frontDesk && type === 'membershipForm' ? <button type="button" className="h-cream" onClick={sendForm} style={pillBtn}><Icon name="send" size={18} />{t('profile.sendFormLink')}</button> : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {canUpload ? <div style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}><Icon name="info" size={16} style={{ verticalAlign: 'text-bottom', marginRight: 4 }} />{t('profile.uploadDemo')}</div> : null}
      <div style={{ ...listCardStyle, maxWidth: 860 }}>
        <ListHead title={t('profile.consentTitle')} meta={t('profile.consentMeta')} />
        {consents.map(({ k, c }) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderTop: '1px solid #EFECEA', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 240px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{t('profile.consent.' + k)}</span>
              <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{t('profile.consentSub.' + k)}</span>
              {c ? <span style={{ fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{t('profile.consentBy', { n: c.byName, d: fmt.fdy(c.at.slice(0, 10)), v: t('profile.cvia_' + c.via) })}</span> : <span style={{ fontSize: FONT_BODY, color: '#6A6967' }}>{t('profile.consentNone')}</span>}
            </div>
            {c ? (c.granted ? <StatusBadge kind="paid" label={t('profile.consentGranted')} small /> : <StatusBadge kind="void" label={t('profile.consentOptOut')} small />) : <StatusBadge kind="pending" label={t('profile.docMissing')} small />}
          </div>
        ))}
        {m.nanny ? <div style={{ padding: '12px 20px 16px', borderTop: '1px solid #EFECEA', fontSize: FONT_BODY, color: '#6A6967', lineHeight: 1.4 }}>{t('profile.nannyNote', { n: m.nanny.name, p: m.nanny.phone ? fmtPhone(m.nanny.phone) : t('common.notSet') })}</div> : null}
      </div>
    </div>
  );
}
