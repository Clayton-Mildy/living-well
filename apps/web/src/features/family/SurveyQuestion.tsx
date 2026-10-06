// One of a survey's own questions in the family sheet, built for a phone: big stars, two big Yes / No buttons, one option out of several
// (full-width rows; a dropdown when there are many), or a text box. Management writes the text; families see it as written.
import type { CSSProperties, ReactNode } from 'react';
import type { SurveyAnswer, SurveyCustomQuestion } from '@cp/shared';
import { Icon, Select, TextField, chipStyle, FONT_SMALL } from '../../components/ui';
import { useT } from '../../lib/i18n';
import { Stars } from './parts';

/** Up to this many options are shown as rows; more go in a dropdown, so a long list does not push the rest of the sheet away. */
const ROWS_MAX = 5;

const tagStyle = (required: boolean): CSSProperties => ({
  height: 24, padding: '0 10px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', fontSize: FONT_SMALL, fontWeight: 600, whiteSpace: 'nowrap',
  background: required ? '#F7E4DD' : '#F4F0EE', color: required ? '#AF4B2F' : '#6A6967',
});

export function SurveyQuestion({ q, value, onChange }: { q: SurveyCustomQuestion; value: SurveyAnswer | undefined; onChange: (v: SurveyAnswer | undefined) => void }) {
  const t = useT();
  const head: ReactNode = (
    <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 10px' }}>
      <span style={{ fontSize: 16, lineHeight: '22px', fontWeight: 500, overflowWrap: 'anywhere' }}>{q.text}</span>
      <span style={tagStyle(q.required)}>{q.required ? t('common.required') : t('common.optional')}</span>
    </span>
  );
  const options = q.options ?? [];
  return (
    <div data-q={q.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {q.kind === 'text' ? (
        <TextField label={head} value={typeof value === 'string' ? value : ''} onChange={(v) => onChange(v || undefined)} multiline rows={3} maxLength={1000} placeholder={q.required ? undefined : t('common.optional')} />
      ) : (
        <>
          {head}
          {q.kind === 'rating' ? <Stars value={typeof value === 'number' ? value : 0} onChange={onChange} size="big" group={q.text} /> : null}
          {q.kind === 'yesno' ? (
            <div role="radiogroup" aria-label={q.text} style={{ display: 'flex', gap: 8 }}>
              {([[true, t('common.yes')], [false, t('common.no')]] as [boolean, string][]).map(([v, label]) => {
                const c = chipStyle(value === v, false);
                return <button key={String(v)} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)} style={{ flex: 1, height: 48, borderRadius: 999, border: c.bd, background: c.bg, color: c.fg, fontSize: 16, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter' }}>{label}</button>;
              })}
            </div>
          ) : null}
          {q.kind === 'choice' && options.length <= ROWS_MAX ? (
            <div role="radiogroup" aria-label={q.text} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {options.map((o) => {
                const on = value === o;
                return (
                  <button key={o} type="button" role="radio" aria-checked={on} onClick={() => onChange(o)}
                    style={{ minHeight: 48, display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', borderRadius: 16, border: on ? '1px solid #75624B' : '1px solid #CAB8A2', background: on ? '#F4F0EE' : '#FFFFFF', color: '#282828', fontSize: 16, lineHeight: '22px', fontWeight: on ? 600 : 400, textAlign: 'left', cursor: 'pointer', fontFamily: 'Inter' }}>
                    <Icon name={on ? 'radio_button_checked' : 'radio_button_unchecked'} size={24} color={on ? '#75624B' : '#6A6967'} fill={on ? 1 : 0} />
                    <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{o}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
          {q.kind === 'choice' && options.length > ROWS_MAX ? (
            <Select ariaLabel={q.text} value={typeof value === 'string' ? value : ''} onChange={onChange} placeholder={t('family.surveyPick')} options={options.map((o) => ({ value: o, label: o }))} />
          ) : null}
        </>
      )}
    </div>
  );
}
