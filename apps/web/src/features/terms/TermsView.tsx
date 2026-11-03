// Round 17 (KC): the terms and conditions text, laid out: "# " lines are headings, "- " lines bullets, any other line a paragraph. Plain text in, no HTML.
// Used by the family's gate and Me sheet and by the staff Settings page; colours and the typeface come from the page it sits in.
import { termsBlocks } from '@cp/shared/rules/terms';

export function TermsView({ text, testId }: { text: string; testId?: string }) {
  const blocks = termsBlocks(text);
  return (
    <div data-testid={testId} style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 15, lineHeight: 1.55, overflowWrap: 'anywhere' }}>
      {blocks.map((b, i) => {
        if (b.kind === 'h') return <h3 key={i} style={{ margin: i ? '12px 0 0' : 0, fontSize: 17, lineHeight: 1.35, fontWeight: 600 }}>{b.text}</h3>;
        if (b.kind === 'li') {
          return (
            <div key={i} style={{ display: 'flex', gap: 10, paddingLeft: 4 }}>
              <span aria-hidden="true" style={{ flex: 'none', width: 5, height: 5, borderRadius: 999, background: 'currentColor', opacity: 0.55, marginTop: 10 }} />
              <span style={{ flex: 1, minWidth: 0 }}>{b.text}</span>
            </div>
          );
        }
        return <p key={i} style={{ margin: 0 }}>{b.text}</p>;
      })}
    </div>
  );
}
