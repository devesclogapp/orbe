import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
    children?: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
    errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught rendering error caught in ErrorBoundary:", error, errorInfo);
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: undefined, errorInfo: undefined });
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="flex min-h-screen w-full flex-col items-center justify-center bg-muted/20 p-4 font-sans">
                    <div className="w-full max-w-md text-center bg-card p-8 rounded-2xl border border-destructive/10 shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-destructive" />
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 mb-6 relative">
                            <AlertCircle className="h-7 w-7 text-destructive absolute" />
                        </div>
                        <h2 className="text-xl font-extrabold tracking-tight text-foreground mb-3">
                            Ops! Algo deu errado.
                        </h2>
                        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                            Encontramos instabilidade ao tentar exibir essa seção do sistema. Tentar recarregar a visualização pode resolver temporariamente.
                            {this.state.error && (
                                <span className="block mt-4 text-[11px] font-mono bg-destructive/5 text-destructive-strong p-3 rounded-md text-left overflow-x-auto whitespace-pre-wrap border border-destructive/10">
                                    {this.state.error.message}
                                </span>
                            )}
                        </p>
                        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                            <Button onClick={this.handleReset} className="gap-2 font-bold w-full sm:w-auto" size="default">
                                <RefreshCw className="h-4 w-4" />
                                Recarregar tela
                            </Button>
                            <Button variant="outline" onClick={() => window.location.href = "/"} className="gap-2 font-bold w-full sm:w-auto" size="default">
                                <Home className="h-4 w-4" />
                                Ir para o Início
                            </Button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
