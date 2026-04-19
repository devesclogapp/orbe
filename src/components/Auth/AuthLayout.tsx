import { Card } from "@/components/ui/card";
import { Logo } from "@/components/ui/Logo";

interface AuthLayoutProps {
    children: React.ReactNode;
    title: string;
    subtitle?: string;
    centerHeader?: boolean;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle, centerHeader }) => {
    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
            <div className="mb-10 flex justify-center">
                <Logo className="w-40" align="center" showSlogan sloganSize="sm" />
            </div>

            <Card className="w-full max-w-md p-8 border border-border shadow-xl bg-card">
                <div className={`mb-6 ${centerHeader ? 'text-center' : ''}`}>
                    <h2 className="text-xl font-bold font-display text-foreground">{title}</h2>
                    {subtitle && (
                        <p className="text-sm font-sans text-muted-foreground mt-1">{subtitle}</p>
                    )}
                </div>
                {children}
            </Card>


            <div className="mt-8 text-center">
                <p className="text-xs text-muted-foreground font-sans">
                    © {new Date().getFullYear()} ESC LOG Portal Operacional. Todos os direitos reservados.
                </p>
            </div>
        </div >
    );
};
