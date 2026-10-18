import WorkspaceShell from '../../components/workspace-shell';
import WorkspaceTransition from '../../components/workspace-transition';

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <WorkspaceShell><WorkspaceTransition>{children}</WorkspaceTransition></WorkspaceShell>;
}
