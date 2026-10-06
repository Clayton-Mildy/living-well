// The daily log's fields (mood, lunch, joined in, communicative, content, the note for the family and the staff-only note),
// shared by the Daily log screen and the member's Care log tab.
import { NORMAL_LOG, type LogFields as Fields } from '@cp/shared/rules/activity';
import { StaffOnlyTag, chipStyle, FONT_BODY } from '../../components/ui';
import { useT } from '../../lib/i18n';

export type LogEntry = Fields & { note: string; staffNote: string };
export type LogField = keyof Fields;
export const LOG_ROWS: { k: LogField; opts: string[] }[] = [
  { k: 'mood', opts: ['cheerful', 'calm', 'quiet', 'agitated'] },
  { k: 'lunch', opts: ['all', 'most', 'half', 'little'] },
  { k: 'joined', opts: ['yes', 'satOut'] },
  { k: 'communicative', opts: ['normal', 'withdrawn'] },
  { k: 'content', opts: ['normal', 'low'] },
];
export const sameLog = (a: LogEntry, b: LogEntry) => LOG_ROWS.every((r) => a[r.k] === b[r.k]) && a.note.trim() === b.note.trim() && a.staffNote.trim() === b.staffNote.trim();
/** The `log.save` input for an entry. */
export const logInput = (memberId: string, date: string, e: LogEntry) => ({ memberId, date, mood: e.mood, lunch: e.lunch, joined: e.joined, communicative: e.communicative, content: e.content, note: e.note, staffNote: e.staffNote });

const NORMAL_CHIP = { bg: '#E6EFE8', fg: '#3D6B4F', bd: '1px solid #3D6B4F' };
const inputStyle = { height: 52, border: '1px solid #8A755B', borderRadius: 16, background: '#FFFFFF', padding: '0 14px', fontSize: 16, fontFamily: 'Inter', color: '#282828', outline: 'none', width: '100%', minWidth: 0 } as const;

export function LogFieldsForm({ e, onChange }: { e: LogEntry; onChange: (patch: Partial<LogEntry>) => void }) {
  const t = useT();
  return (
    <>
      {LOG_ROWS.map((r) => (
        <div key={r.k} role="group" aria-label={t('activity.row.' + r.k)} style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 8 }}>
          <span style={{ fontSize: FONT_BODY, fontWeight: 500, lineHeight: 1.4 }}>{t('activity.row.' + r.k)}</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {r.opts.map((v) => {
              const sel = e[r.k] === v;
              const c = v === NORMAL_LOG[r.k] && sel ? NORMAL_CHIP : chipStyle(sel, false);
              return <button key={v} type="button" aria-pressed={sel} className="cp-chip" onClick={() => onChange({ [r.k]: v } as Partial<LogEntry>)} style={{ height: 44, padding: '0 16px', borderRadius: 999, border: c.bd, background: c.bg, color: c.fg, fontSize: 16, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>{t(`activity.opt.${r.k}.${v}`)}</button>;
            })}
          </div>
        </div>
      ))}
      <input value={e.note} onChange={(ev) => onChange({ note: ev.target.value })} placeholder={t('activity.notePh')} aria-label={t('common.note')} maxLength={600} style={inputStyle} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: FONT_BODY, fontWeight: 500, lineHeight: 1.4 }}>{t('activity.staffNote')}<StaffOnlyTag /></span>
        <input value={e.staffNote} onChange={(ev) => onChange({ staffNote: ev.target.value })} placeholder={t('activity.staffNotePh')} aria-label={t('activity.staffNote')} maxLength={600} style={inputStyle} />
      </div>
    </>
  );
}
