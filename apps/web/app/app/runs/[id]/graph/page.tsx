import RunWorkspace from '../../../../../components/run-workspace';
export default async function RunGraph({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RunWorkspace runId={id} section="graph" />;
}
