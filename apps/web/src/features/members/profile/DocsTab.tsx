// Documents tab: one row per document (on file / missing / requested / pending review) with Upload or Replace (a photo or a file, uploaded to /api/media)
// and View (an image in a viewer, a PDF in a new tab), the date and who added it, request-from-family, plus the consent record (who and when).
// Registration is on paper, so the signed registration form is a photo or scan of the paper; seed members show "Paper copy on file".
import { actorName, fmtPhone, primaryContact, type DocType } from '@cp/shared';
import { consentOf, docOf, documentTypes } from '@cp/shared/rules/members';
import { Icon, IconButton, StatusBadge } from '../../../components/ui';
import { useT } from '../../../lib/i18n';
import { HAIR, listCardStyle, pillBtn } from '../lib';
import { DocView, useDocPicker, type PaperFile } from '../PaperForm';
import { ListHead, PendingBanner } from './parts';
import type { P } from './types';

const PHOTO_NAME: Record<DocType, string> = { ktp: 'ktp', nannyKtp: 'ktp-nanny', membershipForm: 'registration-form', healthInfo: 'health-info', other: 'document' };
const THUMB: Record<DocType, string> = { ktp: 'profile.thumb.ktp', nannyKtp: 'profile.thumb.ktp', membershipForm: 'profile.thumb.form', healthInfo: 'profile.thumb.photo', other: 'profile.thumb.file' };

/** Upload / Replace (any photo or file; on a phone the file chooser offers the camera) and a camera button. */
function UploadControls({ label, name, onFile }: { label: string; name: string; onFile: (f: PaperFile) => void | Promise<unknown> }) {
  const t = useT();
  const pick = useDocPicker(onFile, name);
  return (
    <>
      <button type="button" className="h-cream" disabled={pick.busy} onClick={pick.chooseFile} style={pillBtn}>
        <Icon name="upload_file" size={18} />
        {label}
      </button>
      <IconButton icon="photo_camera" label={t('profile.paperPhoto')} size={40} onClick={pick.takePhoto} />
      {pick.node}
    </>
  );
}

export function DocsTab({ p }: { p: P }) {
  const { s, m, t, fmt, today } = p;
  const frontDesk = !p.family && (p.role === 'lobby' || p.role === 'mgmt');
  const canUpload = p.family || frontDesk;
  const pendingFor = (type: DocType) => (p.family ? p.mine : p.pending).some((c) => c.status === 'pending' && c.section === 'docsConsent' && (c.action === 'document.upload' ? (c.input as { type?: string })?.type === type : (c.input as { docs?: { type: string }[] })?.docs?.some((d) => d.type === type)));
  const contact = primaryContact(s, m.id);
  const upload = async (type: DocType, f: PaperFile) => {
    if (p.family) await p.act('document.upload', { memberId: m.id, type, fileName: f.fileName, mediaId: f.mediaId }, { reviewText: t('profile.uploadSent') });
    else await p.act('members.setDocuments', { memberId: m.id, docs: [{ type, fileName: f.fileName, mediaId: f.mediaId }] }, { ok: t('profile.docSaved'), reviewText: t('profile.sentForReview') });
  };
  const ask = async (type: DocType) => { await p.act('members.requestDocument', { memberId: m.id, type }, { ok: t('profile.docAsked', { n: contact?.firstName || t('profile.theFamily') }) }); };
  const types = documentTypes(m);
  const sub = (type: DocType) => (type === 'nannyKtp' && !m.nanny ? t('profile.docMeta.noNanny') : ''); // a missing document says so in its badge
  const title = (type: DocType) => (type === 'ktp' ? t('profile.docTitle.ktp', { n: m.firstName }) : type === 'nannyKtp' ? t('profile.docTitle.nannyKtp') : t('profile.docTitle.' + type));
  const consents = (['data', 'face'] as const).map((k) => ({ k, c: consentOf(m, k) }));
  const DOC_ICON: Record<DocType, string> = { ktp: 'badge', nannyKtp: 'badge', membershipForm: 'description', healthInfo: 'medical_information', other: 'draft' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(18px, 2.8vw, 28px)', maxWidth: 900 }}>
      <PendingBanner p={p} tab="docs" />
      <div style={listCardStyle}>
        <ListHead title={t('profile.tab.docs')} />
        {types.map((type, idx) => {
          const doc = docOf(m, type);
          const has = doc?.status === 'onFile';
          const requested = doc?.status === 'requested';
          const waiting = pendingFor(type);
          const who = doc?.by ? actorName(s, doc.by) : '';
          const via = doc?.via ? t('profile.via_' + doc.via) : '';
          const meta = has ? t('profile.uploadedMeta', { d: fmt.fds(doc!.on || today), w: who, v: via }) : requested ? t('profile.requestedMeta', { d: fmt.fds(doc!.on || today) }) : sub(type);
          return (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '10px 14px', flexWrap: 'wrap', padding: '16px 0', borderTop: idx ? HAIR : 'none' }}>
              <span aria-hidden="true" title={t(THUMB[type])} style={{ width: 46, height: 46, borderRadius: 10, background: has ? '#F3EEE8' : 'transparent', border: has ? 'none' : '1px dashed #CAB8A2', color: '#75624B', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name={DOC_ICON[type]} size={22} /></span>
              <div style={{ flex: '1 1 220px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{title(type)}</div>
                {meta ? <div style={{ fontSize: 14, lineHeight: '20px', color: '#6B6259' }}>{meta}</div> : null}
                {has && doc?.mediaId && doc.fileName ? <div style={{ fontSize: 13, color: '#6B6259', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.fileName}</div> : null}
                {has && !doc?.mediaId ? <div style={{ fontSize: 13, color: '#6B6259' }}>{t('profile.paperCopyOnFile')}</div> : null}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {has ? <StatusBadge kind="paid" label={t('profile.docOnFile')} small /> : requested ? <StatusBadge kind="outstanding" label={t('profile.docRequested')} small /> : <StatusBadge kind="pending" label={t('profile.docMissing')} small />}
                  {waiting ? <span style={{ height: 24, padding: '0 10px 0 6px', borderRadius: 8, background: '#F6ECD6', color: '#7A5510', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="hourglass_top" size={16} fill={1} />{t('common.pendingReview')}</span> : null}
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {has && doc?.mediaId ? <DocView doc={doc} title={title(type)}>{(open) => <button type="button" className="h-cream" onClick={open} style={pillBtn}>{t('profile.view')}</button>}</DocView> : null}
                {canUpload && !(type === 'nannyKtp' && !m.nanny) ? <UploadControls label={has ? t('profile.replace') : t('profile.upload')} name={PHOTO_NAME[type]} onFile={(f) => upload(type, f)} /> : null}
                {frontDesk && !has && !(type === 'nannyKtp' && !m.nanny) ? <button type="button" className="h-cream" onClick={() => ask(type)} style={pillBtn}>{requested ? t('profile.remind') : t('profile.requestFamily')}</button> : null}
              </div>
            </div>
          );
        })}
      </div>
      <div style={listCardStyle}>
        <ListHead title={t('profile.consentTitle')} />
        {consents.map(({ k, c }, idx) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 0', borderTop: idx ? HAIR : 'none', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 240px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{t('profile.consent.' + k)}</span>
              <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{t('profile.consentSub.' + k)}</span>
              {c ? <span style={{ fontSize: 14, color: '#6B6259', lineHeight: 1.4 }}>{t('profile.consentBy', { n: c.byName, d: fmt.fdy(c.at.slice(0, 10)), v: t('profile.cvia_' + c.via) })}</span> : <span style={{ fontSize: 14, color: '#6B6259' }}>{t('profile.consentNone')}</span>}
            </div>
            {c ? (c.granted ? <StatusBadge kind="paid" label={t('profile.consentGranted')} small /> : <StatusBadge kind="void" label={t('profile.consentOptOut')} small />) : <StatusBadge kind="pending" label={t('profile.docMissing')} small />}
          </div>
        ))}
        {m.nanny ? <div style={{ padding: '14px 0 18px', borderTop: HAIR, fontSize: 13, color: '#6B6259', lineHeight: 1.4 }}>{t('profile.nannyNote', { n: m.nanny.name, p: m.nanny.phone ? fmtPhone(m.nanny.phone) : t('common.notSet') })}</div> : null}
      </div>
    </div>
  );
}
