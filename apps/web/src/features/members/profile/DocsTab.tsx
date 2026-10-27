// Documents tab: one row per document (on file / missing / requested / pending review) with Upload or Replace (a photo or a file, uploaded to /api/media)
// and View (an image in a viewer, a PDF in a new tab), the date and who added it, request-from-family, plus the consent record (who and when).
// Registration is on paper, so the signed registration form is a photo or scan of the paper; seed members show "Paper copy on file".
// Next to it, "Print application form" prints the brochure's four-page form with the member's answers already filled in, ready to sign.
// Round 14 (D): the membership form row also carries its signing status and timeline, and for the front desk Send for signing / Resend (the e-Meterai
// route: the billing contact signs in the family app), Physical meterai (print, sign over a paper meterai, scan: signing.physical) and View signed form.
// While the form is Sent or later, Upload/Replace and Remind are gone from its row (the older document actions would refuse: R-F1).
import { useState } from 'react';
import { actorName, fmtPhone, primaryContact, type DocType } from '@cp/shared';
import { consentOf, docOf, documentTypes } from '@cp/shared/rules/members';
import { applicationDataOf } from '@cp/shared/rules/applicationForm';
import { signerChanged, signingOf } from '@cp/shared/rules/signing';
import { Icon, IconButton, StatusBadge } from '../../../components/ui';
import { useT } from '../../../lib/i18n';
import { HAIR, pillBtn } from '../lib';
import { DocView, useDocPicker, type PaperFile } from '../PaperForm';
import { useApplicationForm } from '../ApplicationForm';
import { ListCard, PendingBanner } from './parts';
import { SigningTrail } from './SigningTrail';
import type { P } from './types';

const PHOTO_NAME: Record<DocType, string> = { ktp: 'ktp', nannyKtp: 'ktp-nanny', guarantorKtp: 'ktp-family', membershipForm: 'registration-form', healthInfo: 'health-info', other: 'document' };
const THUMB: Record<DocType, string> = { ktp: 'profile.thumb.ktp', nannyKtp: 'profile.thumb.ktp', guarantorKtp: 'profile.thumb.ktp', membershipForm: 'profile.thumb.form', healthInfo: 'profile.thumb.photo', other: 'profile.thumb.file' };

/** Upload / Replace (any photo or file; on a phone the file chooser offers the camera) and a camera button. */
function UploadControls({ label, name, onFile }: { label: string; name: string; onFile: (f: PaperFile) => void | Promise<unknown> }) {
  const t = useT();
  const pick = useDocPicker(onFile, name);
  return (
    <>
      <button type="button" className="h-fill cp-fill" disabled={pick.busy} onClick={pick.chooseFile} style={pillBtn}>
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
  const pendingFor = (type: DocType) => (p.family ? p.mine : p.pending).some((c) => c.status === 'pending' && c.section === 'docsConsent' && (c.action === 'document.upload' ? (c.input as { type?: string })?.type === type
    : c.action === 'signing.physical' ? type === 'membershipForm' : (c.input as { docs?: { type: string }[] })?.docs?.some((d) => d.type === type)));
  const contact = primaryContact(s, m.id);
  const upload = async (type: DocType, f: PaperFile) => {
    if (p.family) await p.act('document.upload', { memberId: m.id, type, fileName: f.fileName, mediaId: f.mediaId }, { reviewText: t('profile.uploadSent') });
    else await p.act('members.setDocuments', { memberId: m.id, docs: [{ type, fileName: f.fileName, mediaId: f.mediaId }] }, { ok: t('profile.docSaved'), reviewText: t('profile.sentForReview') });
  };
  const send = async () => { await p.act('signing.send', { memberId: m.id }, { ok: t('sign.sentToast', { name: contact?.name || t('profile.theFamily') }) }); };
  const [scanning, setScanning] = useState(false); // Physical meterai: the form is printed, now its signed scan is expected
  const physical = async (f: PaperFile) => {
    const r = await p.act('signing.physical', { memberId: m.id, mediaId: f.mediaId, fileName: f.fileName }, { ok: t('profile.docSaved'), reviewText: t('profile.sentForReview') });
    if (r.ok) setScanning(false);
  };
  const ask = async (type: DocType) => { await p.act('members.requestDocument', { memberId: m.id, type }, { ok: t('profile.docAsked', { n: contact?.firstName || t('profile.theFamily') }) }); };
  const types = documentTypes(m);
  const sub = (type: DocType) => (type === 'nannyKtp' && !m.nanny ? t('profile.docMeta.noNanny') : ''); // a missing document says so in its badge
  const title = (type: DocType) => (type === 'ktp' ? t('profile.docTitle.ktp', { n: m.firstName }) : type === 'nannyKtp' ? t('profile.docTitle.nannyKtp') : t('profile.docTitle.' + type));
  const consents = (['data', 'face'] as const).map((k) => ({ k, c: consentOf(m, k) }));
  const DOC_ICON: Record<DocType, string> = { ktp: 'badge', nannyKtp: 'badge', guarantorKtp: 'badge', membershipForm: 'description', healthInfo: 'medical_information', other: 'draft' };
  const ph = p.isPhone; // round 6, phone (staff and family): each list card is an iOS grouped section
  const printer = useApplicationForm();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: ph ? 14 : 'clamp(18px, 2.8vw, 28px)', maxWidth: 900 }}>
      <PendingBanner p={p} tab="docs" />
      <ListCard phone={ph} title={t('profile.tab.docs')}>
        {types.map((type, idx) => {
          const doc = docOf(m, type);
          const has = doc?.status === 'onFile';
          const requested = doc?.status === 'requested';
          const waiting = pendingFor(type);
          const who = doc?.by ? actorName(s, doc.by) : '';
          const sig = type === 'membershipForm' ? signingOf(m) : undefined;
          const past = !!sig && sig.status !== 'draft' && sig.status !== 'sent'; // signed or later: the front desk can no longer send it
          const eSigned = sig?.meterai === 'e' && !!sig.signatureMediaId; // its record is the signed form, not a paper scan an older upload left on the document
          const eDone = has && sig?.meterai === 'e' && sig.status === 'stamped'; // on file because it was signed online: never "paper copy", never an old scan's name
          const locked = !!sig && sig.status !== 'draft'; // Sent or later: no Upload/Replace, no Remind
          const via = doc?.via ? t('profile.via_' + doc.via) : '';
          const meta = has ? t('profile.uploadedMeta', { d: fmt.fds(doc!.on || today), w: who, v: via }) : requested ? t('profile.requestedMeta', { d: fmt.fds(doc!.on || today) }) : sub(type);
          return (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '10px 14px', flexWrap: 'wrap', padding: '16px 0', borderTop: idx ? HAIR : 'none' }}>
              <span aria-hidden="true" title={t(THUMB[type])} className={has ? 'cp-fill' : undefined} style={{ width: 46, height: 46, borderRadius: 10, background: has ? 'var(--fill, #F4F4F5)' : 'transparent', border: has ? 'none' : '1px dashed var(--outline, #D4D4D8)', color: 'var(--accent, #75624B)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name={DOC_ICON[type]} size={22} /></span>
              <div style={{ flex: '1 1 220px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>{title(type)}</div>
                {meta ? <div style={{ fontSize: 14, lineHeight: '20px', color: '#6B6259' }}>{meta}</div> : null}
                {eDone ? <div style={{ fontSize: 13, color: '#6B6259' }}>{t('sign.online')}</div> : null}
                {has && !eDone && doc?.mediaId && doc.fileName ? <div style={{ fontSize: 13, color: '#6B6259', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.fileName}</div> : null}
                {has && !eDone && !doc?.mediaId ? <div style={{ fontSize: 13, color: '#6B6259' }}>{t('profile.paperCopyOnFile')}</div> : null}
                {sig ? <SigningTrail sig={sig} family={p.family} /> : null}
                {frontDesk && sig && signerChanged(s, m.id) ? <div data-testid="sign-resend-hint" style={{ fontSize: 13, lineHeight: 1.4, color: '#7A5510' }}>{t('sign.resendHint')}</div> : null}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {has ? <StatusBadge kind="paid" label={t('profile.docOnFile')} small /> : requested ? <StatusBadge kind="outstanding" label={t('profile.docRequested')} small /> : <StatusBadge kind="pending" label={t('profile.docMissing')} small />}
                  {waiting ? <span style={{ height: 24, padding: '0 10px 0 6px', borderRadius: 8, background: '#F6ECD6', color: '#7A5510', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="hourglass_top" size={16} fill={1} />{t('common.pendingReview')}</span> : null}
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {type === 'membershipForm' && !p.family ? <button type="button" className="h-fill cp-fill" onClick={() => printer.open(applicationDataOf(s, m.id, today))} style={pillBtn}><Icon name="print" size={18} />{t('form.printAction')}</button> : null}
                {frontDesk && type === 'membershipForm' && !past ? <button type="button" className="h-fill cp-fill" onClick={send} style={pillBtn}><Icon name="send" size={18} />{sig?.status === 'sent' ? t('sign.resend') : t('sign.send')}</button> : null}
                {frontDesk && type === 'membershipForm' && !past ? <button type="button" className="h-fill cp-fill" onClick={() => { printer.open(applicationDataOf(s, m.id, today)); setScanning(true); }} style={pillBtn}><Icon name="approval" size={18} />{t('sign.physical')}</button> : null}
                {frontDesk && scanning && type === 'membershipForm' && !past ? <span data-testid="physical-scan" style={{ display: 'inline-flex', gap: 8 }}><UploadControls label={t('sign.scan')} name="registration-form" onFile={physical} /></span> : null}
                {sig && eSigned ? <button type="button" className="h-fill cp-fill" onClick={() => printer.open(applicationDataOf(s, m.id, today), sig)} style={pillBtn}><Icon name="draw" size={18} />{t('sign.viewSigned')}</button> : null}
                {has && doc?.mediaId && !eSigned ? <DocView doc={doc} title={title(type)}>{(open) => <button type="button" className="h-fill cp-fill" onClick={open} style={pillBtn}>{t('profile.view')}</button>}</DocView> : null}
                {canUpload && !locked && !(type === 'nannyKtp' && !m.nanny) ? <UploadControls label={has ? t('profile.replace') : t('profile.upload')} name={PHOTO_NAME[type]} onFile={(f) => upload(type, f)} /> : null}
                {frontDesk && !has && !locked && !(type === 'nannyKtp' && !m.nanny) ? <button type="button" className="h-fill cp-fill" onClick={() => ask(type)} style={pillBtn}>{requested ? t('profile.remind') : t('profile.requestFamily')}</button> : null}
              </div>
            </div>
          );
        })}
      </ListCard>
      <ListCard phone={ph} title={t('profile.consentTitle')}>
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
        {m.nanny ? <div style={{ padding: ph ? '14px 0' : '14px 0 18px', borderTop: HAIR, fontSize: 13, color: '#6B6259', lineHeight: 1.4 }}>{t('profile.nannyNote', { n: m.nanny.name, p: m.nanny.phone ? fmtPhone(m.nanny.phone) : t('common.notSet') })}</div> : null}
      </ListCard>
      {printer.node}
    </div>
  );
}
