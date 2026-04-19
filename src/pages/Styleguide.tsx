import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Sun, Moon, Palette, Type, Square, Layers, MousePointer2, Plus } from "lucide-react";
import { useEffect, useState } from "react";

const Styleguide = () => {
    const [theme, setTheme] = useState<"light" | "dark">("light");

    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove("light", "dark");
        root.classList.add(theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(theme === "light" ? "dark" : "light");
    };

    const colors = [
        { name: "Brand", token: "var(--primary)", hex: "#FD4C00", description: "CTA principal, ações primárias, destaques de marca" },
        { name: "Foreground", token: "var(--foreground)", hex: "#171717", description: "Texto principal, títulos, headings" },
        { name: "Secondary Text", token: "var(--gray-600)", hex: "#4D4D4D", description: "Texto secundário, labels, descrições" },
        { name: "Border", token: "var(--border)", hex: "#DEDEDE", description: "Bordas, divisores, separadores" },
        { name: "Surface", token: "var(--card)", hex: "#FFFFFF", description: "Cards, modais, superfícies elevadas" },
        { name: "Background", token: "var(--background)", hex: "#F7F7F7", description: "Fundo geral da aplicação" },
    ];

    const grays = [
        { name: "Gray 100", token: "var(--gray-100)", hex: "#EBEBEB" },
        { name: "Gray 200", token: "var(--gray-200)", hex: "#DEDEDE" },
        { name: "Gray 300", token: "var(--gray-300)", hex: "#C4C4C4" },
        { name: "Gray 400", token: "var(--gray-400)", hex: "#A3A3A3" },
        { name: "Gray 500", token: "var(--gray-500)", hex: "#737373" },
        { name: "Gray 600", token: "var(--gray-600)", hex: "#4D4D4D" },
        { name: "Gray 900", token: "var(--gray-900)", hex: "#171717" },
    ];

    const states = [
        { name: "Success", token: "var(--success)", hex: "#22C55E" },
        { name: "Error", token: "var(--error)", hex: "#EF4444" },
        { name: "Warning", token: "var(--warning)", hex: "#F59E0B" },
        { name: "Info", token: "var(--info)", hex: "#2563EB" },
    ];

    const typography = [
        { label: "H1 - Page Title", class: "text-2xl font-bold font-display", info: "Manrope 700 / 24px" },
        { label: "H2 - Section Title", class: "text-lg font-semibold font-display", info: "Manrope 600 / 18px" },
        { label: "H3 - Subtitle / Card Label", class: "text-sm font-medium font-display", info: "Manrope 500 / 14px" },
        { label: "Body Primary", class: "text-sm font-normal font-sans", info: "Inter 400 / 14px" },
        { label: "Body Secondary", class: "text-[13px] font-normal text-muted-foreground font-sans", info: "Inter 400 / 13px" },
        { label: "Input / Column Label", class: "text-xs font-medium text-muted-foreground font-sans", info: "Inter 500 / 12px" },
        { label: "Caption / Metadata", class: "text-xs font-normal text-gray-500 font-sans", info: "Inter 400 / 12px" },
        { label: "Metric Value", class: "text-[28px] font-bold font-display", info: "Manrope 700 / 28px" },
    ];

    const spacings = [
        { name: "Space 1", value: "4px", class: "w-1 h-1" },
        { name: "Space 2", value: "8px", class: "w-2 h-2" },
        { name: "Space 3", value: "12px", class: "w-3 h-3" },
        { name: "Space 4", value: "16px", class: "w-4 h-4" },
        { name: "Space 5", value: "20px", class: "w-5 h-5" },
        { name: "Space 6", value: "24px", class: "w-6 h-6" },
        { name: "Space 8", value: "32px", class: "w-8 h-8" },
    ];

    return (
        <div className="min-h-screen bg-background text-foreground pb-20">
            {/* Header */}
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex h-16 items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded bg-primary flex items-center justify-center font-bold text-white">O</div>
                        <h1 className="text-lg font-bold font-display uppercase tracking-tight">ORBE Design System</h1>
                    </div>
                    <Button variant="outline" size="icon" onClick={toggleTheme}>
                        {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                    </Button>
                </div>
            </header>

            <main className="container pt-8 space-y-12">
                {/* Intro */}
                <section className="space-y-4">
                    <h2 className="text-3xl font-bold font-display tracking-tight">ESC LOG ERP — Styleguide</h2>
                    <p className="text-muted-foreground max-w-3xl">
                        Este styleguide apresenta os tokens visuais e componentes fundamentais do sistema Orbe.
                        Todos os componentes devem seguir rigorosamente estes padrões para garantir consistência e clareza operacional.
                    </p>
                </section>

                {/* Colors */}
                <section className="space-y-6">
                    <div className="flex items-center gap-2">
                        <Palette className="w-6 h-6 text-primary" />
                        <h3 className="text-xl font-bold font-display">Cores</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {colors.map((color) => (
                            <Card key={color.name}>
                                <CardHeader className="p-4 pb-2">
                                    <div
                                        className="w-full h-24 rounded-lg mb-3 border shadow-sm transition-transform hover:scale-[1.02]"
                                        style={{ backgroundColor: `hsl(${color.token})` }}
                                    />
                                    <CardTitle className="text-sm font-bold font-display">{color.name}</CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 pt-0">
                                    <code className="text-xs bg-muted px-1 rounded">{color.token}</code>
                                    <p className="text-xs text-muted-foreground mt-2">{color.description}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                        {grays.map((gray) => (
                            <div key={gray.name} className="flex flex-col gap-2">
                                <div
                                    className="w-full aspect-square rounded-md border"
                                    style={{ backgroundColor: `hsl(${gray.token})` }}
                                />
                                <span className="text-[10px] font-medium font-sans text-center">{gray.name}</span>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {states.map((state) => (
                            <div key={state.name} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                                <div
                                    className="w-10 h-10 rounded shadow-sm"
                                    style={{ backgroundColor: `hsl(${state.token})` }}
                                />
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold font-display">{state.name}</span>
                                    <code className="text-[10px] text-muted-foreground">{state.token}</code>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Typography */}
                <section className="space-y-6">
                    <div className="flex items-center gap-2">
                        <Type className="w-6 h-6 text-primary" />
                        <h3 className="text-xl font-bold font-display">Tipografia</h3>
                    </div>

                    <div className="bg-card border rounded-xl overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="w-[300px]">Exemplo</TableHead>
                                    <TableHead>Elemento / Significado</TableHead>
                                    <TableHead className="text-right">Especificação</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {typography.map((type) => (
                                    <TableRow key={type.label}>
                                        <TableCell className="py-6">
                                            <span className={type.class}>{type.label}</span>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-xs">{type.label}</TableCell>
                                        <TableCell className="text-right">
                                            <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{type.info}</code>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </section>

                {/* Spacing & Borders */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-6">
                        <div className="flex items-center gap-2">
                            <Square className="w-6 h-6 text-primary" />
                            <h3 className="text-xl font-bold font-display">Espaçamentos (4px base)</h3>
                        </div>
                        <div className="bg-card border rounded-xl p-6 space-y-4">
                            {spacings.map((space) => (
                                <div key={space.name} className="flex items-center gap-4">
                                    <div className="w-16 text-xs text-muted-foreground font-medium">{space.name}</div>
                                    <div className={`bg-primary opacity-20 rounded ${space.class}`} />
                                    <div className="text-xs font-mono">{space.value}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center gap-2">
                            <Layers className="w-6 h-6 text-primary" />
                            <h3 className="text-xl font-bold font-display">Bordas e Sombras</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-8 bg-card border border-border rounded-lg flex flex-col items-center gap-2">
                                <div className="text-[10px] font-bold uppercase text-muted-foreground">Standard Border</div>
                                <code className="text-xs">1px solid #DEDEDE</code>
                            </div>
                            <div className="p-8 bg-card border border-border rounded-lg shadow-sm flex flex-col items-center gap-2">
                                <div className="text-[10px] font-bold uppercase text-muted-foreground">Shadow Small</div>
                                <code className="text-xs">0 1px 3px rgba(0,0,0,0.06)</code>
                            </div>
                            <div className="p-8 bg-card border border-border rounded-2xl shadow-lg flex flex-col items-center gap-2">
                                <div className="text-[10px] font-bold uppercase text-muted-foreground">Radius Extra Large</div>
                                <code className="text-xs">border-radius: 16px</code>
                            </div>
                            <div className="p-8 bg-card border-2 border-primary rounded-lg flex flex-col items-center gap-2">
                                <div className="text-[10px] font-bold uppercase text-muted-foreground">Focus Ring</div>
                                <code className="text-xs">2px solid #2563EB</code>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Components */}
                <section className="space-y-8">
                    <div className="flex items-center gap-2">
                        <MousePointer2 className="w-6 h-6 text-primary" />
                        <h3 className="text-xl font-bold font-display">Componentes e Estados</h3>
                    </div>

                    {/* Buttons */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="font-display">Botões</CardTitle>
                            <CardDescription>Variações e estados dos botões principais.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-wrap gap-4">
                            <Button>Primário</Button>
                            <Button className="hover:bg-primary/90">Hover</Button>
                            <Button variant="secondary">Secundário</Button>
                            <Button variant="ghost">Ghost</Button>
                            <Button variant="outline">Outline</Button>
                            <Button variant="destructive">Destrutivo</Button>
                            <Button disabled>Desativado</Button>
                            <Button>
                                <div className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Carregando
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Inputs */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="font-display">Inputs e Formulários</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <Label>Padrão</Label>
                                <Input placeholder="Digite algo..." />
                            </div>
                            <div className="space-y-2">
                                <Label>Foco</Label>
                                <Input className="ring-2 ring-primary border-primary ring-offset-2" placeholder="Estado de foco" />
                            </div>
                            <div className="space-y-2">
                                <Label>Erro</Label>
                                <Input className="border-destructive focus-visible:ring-destructive" placeholder="Valor inválido" />
                                <span className="text-[10px] text-destructive font-medium">Este campo é obrigatório</span>
                            </div>
                            <div className="space-y-2">
                                <Label>Desativado</Label>
                                <Input disabled placeholder="Não editável" />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Badges */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="font-display">Status Chips (Badges)</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-wrap gap-3">
                            <Badge variant="success">OK</Badge>
                            <Badge variant="error">INCONSISTÊNCIA</Badge>
                            <Badge variant="info">AJUSTADO</Badge>
                            <Badge variant="warning">PENDENTE</Badge>
                        </CardContent>
                    </Card>

                    {/* Tables */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="font-display">Tabelas (Core)</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 border-t">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-100 hover:bg-gray-100">
                                        <TableHead className="uppercase text-[10px] font-bold tracking-wider">Colaborador</TableHead>
                                        <TableHead className="uppercase text-[10px] font-bold tracking-wider text-center">Data</TableHead>
                                        <TableHead className="uppercase text-[10px] font-bold tracking-wider text-center">Status</TableHead>
                                        <TableHead className="uppercase text-[10px] font-bold tracking-wider text-right">Ação</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow>
                                        <TableCell className="font-medium text-sm">João Silva</TableCell>
                                        <TableCell className="text-center text-xs text-muted-foreground">18/04/2026</TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="success">OK</Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" className="h-7 text-xs">Editar</Button>
                                        </TableCell>
                                    </TableRow>
                                    <TableRow className="bg-row-alert border-l-2 border-l-primary">
                                        <TableCell className="font-medium text-sm">Maria Santos</TableCell>
                                        <TableCell className="text-center text-xs text-muted-foreground">18/04/2026</TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="error">INCONSISTÊNCIA</Badge>
                                        </TableCell>
                                        <TableCell className="text-right text-destructive text-xs font-semibold px-4 cursor-pointer hover:underline">
                                            Corrigir
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                    {/* Padrões de Configuração */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="font-display">Padrões de Configuração</CardTitle>
                            <CardDescription>Componentes para navegação de preferências e gestão de tabelas auxiliares.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl border border-primary bg-primary-soft ring-1 ring-primary">
                                    <div className="mb-3 h-10 w-10 rounded-lg bg-primary text-white flex items-center justify-center">
                                        <Palette className="h-5 w-5" />
                                    </div>
                                    <div className="font-display font-bold text-sm">Opção Ativa</div>
                                    <div className="text-[11px] text-muted-foreground mt-1">Utilizado em seletores de preferência e temas.</div>
                                </div>
                                <div className="p-4 rounded-xl border border-border bg-card">
                                    <div className="mb-3 h-10 w-10 rounded-lg bg-muted text-muted-foreground flex items-center justify-center">
                                        <Palette className="h-5 w-5" />
                                    </div>
                                    <div className="font-display font-bold text-sm">Opção Inativa</div>
                                    <div className="text-[11px] text-muted-foreground mt-1">Estado padrão para escolhas não selecionadas.</div>
                                </div>
                            </div>

                            <div className="p-4 rounded-xl border bg-muted/20">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold uppercase tracking-tight text-muted-foreground">ConfigTable Action Bar</span>
                                    <Button size="sm" className="h-8 text-xs font-bold"><Plus className="h-3 w-3 mr-1" /> Novo</Button>
                                </div>
                                <div className="h-10 bg-card border rounded-md border-dashed flex items-center justify-center text-xs text-muted-foreground">
                                    Área de Tabela Auxiliar (CRUD)
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Portal do Cliente */}

                    <Card className="bg-slate-900 text-white overflow-hidden">
                        <CardHeader>
                            <CardTitle className="font-display">Portal do Cliente (Ambiente Externo)</CardTitle>
                            <CardDescription className="text-slate-400">Layout focado em leitura, aprovação e transparência para o cliente final.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="p-6 bg-slate-800 rounded-xl border border-slate-700">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-6 h-6 bg-[#FD4C00] rounded flex items-center justify-center text-[10px] font-bold">O</div>
                                        <span className="font-bold text-sm">Identidade Premium</span>
                                    </div>
                                    <p className="text-xs text-slate-400">Uso de tons mais escuros (Slate 900) e azul/branco para transmitir seriedade e contraste com o operacional.</p>
                                </div>
                                <div className="p-6 bg-white text-slate-900 rounded-xl">
                                    <div className="flex justify-between items-center mb-4 text-xs font-bold uppercase text-slate-400">
                                        <span>Ação Crítica</span>
                                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none">Workflow</Badge>
                                    </div>
                                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl h-12">
                                        Aprovar Faturamento
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </section>
            </main>
        </div>
    );
};

export default Styleguide;
