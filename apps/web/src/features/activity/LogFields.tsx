// The daily log is filled in rounds (KC round 7). This file holds the pieces the rounds share:
//   - RoundChips: the one-tap choices on a lunch / activity row (All Most Half Little None, Joined Sat out), tap the chosen one again to clear it;
//   - LogFieldsForm: the Mood & notes round (mood, communicative, content, the note for the family and the staff-only note),
//     used by the Daily log screen and by the member's Care log tab.
import { NORMAL_LOG } from '@cp/shared/rules/activity';
import type { DailyLog } from '@cp/shared';
import { StaffOnlyTag, chipStyle, FONT_BODY } from '../../components/ui';
import { useT } from '../../lib/i18n';

export type LogEntry = { mood: NonNullable<DailyLog['mood']>; communicative: NonNullable<DailyLog['communicative']>; content: NonNullable<DailyLog['content']>; note: string; staffNote: string };
export type LogField = 'mood' | 'communicative' | 'content';
export const LOG_ROWS: { k: LogField; opts: string[] }[] = [
  { k: 'mood', opts: ['cheerful', 'calm', 'quiet', 'agitated'] },
  { k: 'communicative', opts: ['normal', 'withdrawn'] },
  { k: 'content', opts: ['normal', 'low'] },
];
/** What the Mood & notes form starts from: the saved round, or everyone normal. */
export const baseEntry = (l: Pick<DailyLog, 'mood' | 'communicative' | 'content' | 'note' | 'staffNote'> | undefined): LogEntry => ({
  mood: l?.mood ?? NORMAL_LOG.mood, communicative: l?.communicative ?? NORMAL_LOG.communicative, content: l?.content ?? NORMAL_LOG.content, note: l?.note ?? '', staffNote: l?.staffNote ?? '',
});
export const sameLog = (a: LogEntry, b: LogEntry) => LOG_ROWS.every((r) => a[r.k] === b[r.k]) && a.note.trim() === b.note.trim() && a.staffNote.trim() === b.staffNote.trim();
/** The `log.save` input for an entry. */
export const logInput = (memberId: string, date: string, e: LogEntry) => ({ memberId, date, mood: e.mood, communicative: e.communicative, content: e.content, note: e.note, staffNote: e.staffNote });

const NORMAL_CHIP = { bg: '#E3EFE6', fg: '#3D6B4F', bd: '1px solid #3D6B4F' };
const ALERT_CHIP = { bg: '#F9E3DB', fg: '#9A3D24', bd: '1px solid #9A3D24' };
const inputStyle = { height: 52, border: '1px solid #DDD1C2', borderRadius: 12, background: '#FFFFFF', padding: '0 14px', fontSize: 16, fontFamily: 'Inter', color: '#24201C', outline: 'none', width: '100%', minWidth: 0 } as const;

export interface RoundChoice { value: string; label: string; /** normal = sage when chosen, alert = rust when chosen, other = ink */ tone: 'normal' | 'other' | 'alert' }
/** One-tap choices of a round row. Small chips that wrap rather than clip; the chosen one is filled, tapping it again clears the mark. */
export function RoundChips({ choices, value, onPick, label }: { choices: RoundChoice[]; value: string | undefined; onPick: (v: string | null) => void; label: string }) {
  return (
    <div role="group" aria-label={label} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minWidth: 0 }}>
      {choices.map((c) => {
        const sel = value === c.value;
        const st = sel ? (c.tone === 'normal' ? NORMAL_CHIP : c.tone === 'alert' ? ALERT_CHIP : chipStyle(true, false)) : chipStyle(false, false);
        return (
          <button key={c.value} type="button" aria-pressed={sel} className="cp-press" onClick={() => onPick(sel ? null : c.value)}
            style={{ height: 36, padding: '0 11px', borderRadius: 10, border: st.bd, background: st.bg, color: st.fg, fontSize: 14, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter', flex: 'none' }}>
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

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
              return <button key={v} type="button" aria-pressed={sel} className="cp-chip" onClick={() => onChange({ [r.k]: v } as Partial<LogEntry>)} style={{ height: 44, padding: '0 16px', borderRadius: 12, border: c.bd, background: c.bg, color: c.fg, fontSize: 16, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter' }}>{t(`activity.opt.${r.k}.${v}`)}</button>;
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
