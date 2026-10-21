// "Add a member" (design OvPe, mode add). KC round 12: the stepped registration (Person, Family, Health, Plan, Form, Review) shared with Join; the
// details are typed in from the paper registration form, which is printed filled in, signed, and attached before the member is created. Non-management
// staff send it for review; the family contact can sign in once management approves. A new member can also start from an open lead (then it is a Join).
import { useNavigate } from 'react-router-dom';
import { RegistrationFlow } from '../register/RegistrationFlow';

export function AddMemberDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  if (!open) return null;
  return <RegistrationFlow mode={{ kind: 'new' }} onDone={(memberId) => { onClose(); if (memberId) navigate(`/members/${memberId}`); }} />;
}
