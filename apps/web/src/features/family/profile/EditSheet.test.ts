// Round 14: a family edit of the carer keeps the club's picture and note only for the same person.
import { describe, expect, it } from 'vitest';
import { buildSeed, type Member } from '@cp/shared';
import { changesOf } from './EditSheet';

const base = () => {
  const m = buildSeed().citra.members.m1;
  m.nanny = { name: 'Mbak Sari', phone: '+6281211112222', photoMediaId: 'md_nannyphoto0001', note: 'Agency: Kasih Ibu, Mon–Wed' };
  return m as Member;
};
const draft = (m: Member, over: Record<string, unknown>) => ({
  address: m.address || '', rtRw: '', city: '', postcode: '', phone: '', mobile: '', email: '', nanny: true, nannyName: 'Mbak Sari', nannyPhone: '0812 1111 2222', usual: m.usualArrival || '', ...over,
}) as Parameters<typeof changesOf>[1];

describe('changesOf: the carer', () => {
  it('the same name (any case, spaces) keeps the picture and note when the phone changes', () => {
    const m = base();
    const p = changesOf(m, draft(m, { nannyName: '  mbak sari ', nannyPhone: '0812 9999 0000' }));
    expect(p.nanny).toMatchObject({ name: 'mbak sari', photoMediaId: 'md_nannyphoto0001', note: 'Agency: Kasih Ibu, Mon–Wed' });
  });
  it('a different name drops the old carer\'s picture and note', () => {
    const m = base();
    const p = changesOf(m, draft(m, { nannyName: 'Mbak Dewi' }));
    expect(p.nanny).toEqual({ name: 'Mbak Dewi', phone: '+6281211112222' });
  });
  it('round 15: a new or removed picture is sent with the carer; unchanged sends no carer', () => {
    const m = base();
    expect(changesOf(m, draft(m, { nannyPhoto: 'md_nannyphoto0001' })).nanny).toBeUndefined();
    expect(changesOf(m, draft(m, { nannyPhoto: 'md_newphoto00001' })).nanny).toMatchObject({ name: 'Mbak Sari', photoMediaId: 'md_newphoto00001', note: 'Agency: Kasih Ibu, Mon–Wed' });
    expect(changesOf(m, draft(m, { nannyPhoto: '' })).nanny).toEqual({ name: 'Mbak Sari', phone: '+6281211112222', note: 'Agency: Kasih Ibu, Mon–Wed' });
    const different = changesOf(m, draft(m, { nannyName: 'Mbak Dewi', nannyPhoto: 'md_newphoto00001' }));
    expect(different.nanny).toEqual({ name: 'Mbak Dewi', phone: '+6281211112222', photoMediaId: 'md_newphoto00001' });
  });
});
