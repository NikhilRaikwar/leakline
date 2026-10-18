import RunWorkspace from '../../../../../components/run-workspace';
export default async function RunVerification({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RunWorkspace runId={id} section="verification" />;
}
