import { AppShell } from "@/components/layout/AppShell";
import { ReactNode } from "react";

interface PlaceholderProps {
  title: string;
  subtitle?: string;
  description: string;
  children?: ReactNode;
}

export const PlaceholderPage = ({ title, subtitle, description, children }: PlaceholderProps) => {
  return (
    <AppShell title={title} subtitle={subtitle}>
      <section className="esc-card p-8">
        <h2 className="font-display font-semibold text-lg text-foreground mb-2">{title}</h2>
        <p className="text-sm text-muted-foreground max-w-2xl">{description}</p>
        {children && <div className="mt-6">{children}</div>}
      </section>
    </AppShell>
  );
};
