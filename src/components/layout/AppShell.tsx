import { CSSProperties, ReactNode } from "react";
import { PipelineTrigger } from "@/contexts/OperationalPipelineContext";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

interface AppShellProps {
  title: string;
  subtitle?: string;
  badge?: string;
  backPath?: string;
  pipelineTrigger?: PipelineTrigger | null;
  rightPanel?: ReactNode;
  children: ReactNode;
}


export const AppShell = ({ title, subtitle, badge, backPath, pipelineTrigger, rightPanel, children }: AppShellProps) => {
  return (
    <div
      className="min-h-screen bg-background flex"
      style={{ "--app-topbar-height": "88px" } as CSSProperties}
    >
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title={title} subtitle={subtitle} badge={badge} backPath={backPath} pipelineTrigger={pipelineTrigger} />
        <div className="flex flex-1 min-h-0">

          <main className="flex-1 p-6 overflow-y-auto min-w-0">{children}</main>
          {rightPanel}
        </div>
      </div>
    </div>
  );
};
