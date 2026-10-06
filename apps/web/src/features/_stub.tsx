// Temporary placeholder used only while a feature is being built (never shipped).
import { PageHead, Card, EmptyState } from '../components/ui';
import { useDevice, padFor } from '../hooks/useDevice';

export function BuildStub({ name }: { name: string }) {
  const { device } = useDevice();
  return (
    <div style={{ padding: padFor(device), display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHead eyebrow="Build in progress" title={name} />
      <Card><EmptyState icon="construction" title={name} sub="This screen is being built." /></Card>
    </div>
  );
}
