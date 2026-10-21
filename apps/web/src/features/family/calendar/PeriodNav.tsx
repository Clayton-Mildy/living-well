// Family Calendar: the row that moves the period, `‹  October 2026  ›`. The label sits in the middle between the two round arrows; the way back
// ("This week" / "This month") hangs off the label's right edge when you are somewhere else, so it never pushes the label off-centre.
import { F } from '../kit';
import { Step } from './bits';

export function PeriodNav({ label, labelTestId, prev, next, back }: {
  label: string; labelTestId?: string;
  prev: { label: string; onClick: () => void; disabled?: boolean; testId?: string };
  next: { label: string; onClick: () => void; disabled?: boolean; testId?: string };
  back?: { label: string; onClick: () => void; testId?: string } | null;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '36px minmax(0, 1fr) 36px', alignItems: 'center', gap: 8 }}>
      <Step dir="prev" label={prev.label} onClick={prev.onClick} disabled={prev.disabled} testId={prev.testId} />
      <span style={{ justifySelf: 'center', position: 'relative', minWidth: 0, maxWidth: '100%' }}>
        <span data-testid={labelTestId} aria-live="polite" style={{ fontSize: 17, fontWeight: 600, color: F.text, whiteSpace: 'nowrap', letterSpacing: '-0.2px' }}>{label}</span>
        {back ? (
          <button type="button" onClick={back.onClick} data-testid={back.testId} className="cp-press"
            style={{ position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: 10, border: 'none', background: 'transparent', color: F.bronze, fontSize: 13, fontWeight: 500, cursor: 'pointer', padding: '6px 0', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
            {back.label}
          </button>
        ) : null}
      </span>
      <Step dir="next" label={next.label} onClick={next.onClick} disabled={next.disabled} testId={next.testId} />
    </div>
  );
}
