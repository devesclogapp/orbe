import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

interface AppShellProps {
  title: string;
  subtitle?: string;
  backPath?: string;
  rightPanel?: ReactNode;
  children: ReactNode;
}


export const AppShell = ({ title, subtitle, backPath, rightPanel, children }: AppShellProps) => {
  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title={title} subtitle={subtitle} backPath={backPath} />
        <div className="flex flex-1 min-h-0">

          <main className="flex-1 p-6 overflow-y-auto min-w-0">{children}</main>
          {rightPanel}
        </div>
      </div>
    </div>
  );
};
