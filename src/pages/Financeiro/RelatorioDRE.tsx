import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/contexts/TenantContext';
import { DashboardConsolidadoService } from '@/services/dashboard.service';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, TrendingUp, TrendingDown, DollarSign, Activity, FileText, CheckCircle2 } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

export default function RelatorioDRE() {
    const { tenant } = useTenant();

    const [year, setYear] = useState<string>(new Date().getFullYear().toString());
    const [month, setMonth] = useState<string>('all');

    const { data: dreData, isLoading, error } = useQuery({
        queryKey: ['dre_kpis', year, month],
        queryFn: () => DashboardConsolidadoService.getKpisAggregate(year, month),
        enabled: !!tenant?.id,
    });

    const formatBRL = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    // Calculate dynamic profit margin percentage
    const margemPercentual = useMemo(() => {
        if (!dreData || dreData.faturamentoTotal === 0) return 0;
        return (dreData.lucroReal / dreData.faturamentoTotal) * 100;
    }, [dreData]);

    const renderCard = (title: string, value: number, icon: React.ReactNode, subtitle?: string, highlightColor?: string) => (
        <Card className={`p-6 shadow-sm border-l-4 ${highlightColor || 'border-l-indigo-500'}`}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">{title}</h3>
                <div className={`p-2 rounded-full ${highlightColor ? highlightColor.replace('border-l', 'bg').replace('500', '100') : 'bg-indigo-100'} text-indigo-700 opacity-80`}>
                    {icon}
                </div>
            </div>
            {isLoading ? (
                <Skeleton className="h-8 w-24 mb-2" />
            ) : (
                <p className="font-display text-3xl font-bold text-gray-900">{formatBRL(value)}</p>
            )}
            {subtitle && <p className="text-xs text-muted-foreground mt-2">{subtitle}</p>}
        </Card>
    );

    return (
        <AppShell title="Resultado Operacional (DRE)">
            <div className="mx-auto max-w-[1700px] w-full px-4 sm:px-6 md:px-8 space-y-6 pb-20 animate-in fade-in-50 duration-500">
                {/* Header Controls */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-5 rounded-2xl border border-border/60 shadow-sm gap-4">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-emerald-600" />
                            Demonstração do Resultado do Exercício
                        </h2>
                        <p className="text-sm text-gray-500">Visão executiva de Lucratividade, Faturamento e Despesas.</p>
                    </div>

                    <div className="flex bg-gray-50 p-1.5 rounded-xl border border-gray-100 gap-2">
                        <Select value={year} onValueChange={setYear}>
                            <SelectTrigger className="w-[120px] bg-white border-gray-200">
                                <SelectValue placeholder="Ano" />
                            </SelectTrigger>
                            <SelectContent>
                                {[2024, 2025, 2026, 2027].map(y => (
                                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={month} onValueChange={setMonth}>
                            <SelectTrigger className="w-[160px] bg-white border-gray-200">
                                <SelectValue placeholder="Mês" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Ano Inteiro / Todos</SelectItem>
                                <SelectItem value="01">Janeiro</SelectItem>
                                <SelectItem value="02">Fevereiro</SelectItem>
                                <SelectItem value="03">Março</SelectItem>
                                <SelectItem value="04">Abril</SelectItem>
                                <SelectItem value="05">Maio</SelectItem>
                                <SelectItem value="06">Junho</SelectItem>
                                <SelectItem value="07">Julho</SelectItem>
                                <SelectItem value="08">Agosto</SelectItem>
                                <SelectItem value="09">Setembro</SelectItem>
                                <SelectItem value="10">Outubro</SelectItem>
                                <SelectItem value="11">Novembro</SelectItem>
                                <SelectItem value="12">Dezembro</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {error ? (
                    <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 mt-0.5" />
                        <div>
                            <h3 className="font-semibold">Erro ao processar DRE</h3>
                            <p className="text-sm">{error instanceof Error ? error.message : 'Falha na comunicação.'}</p>
                        </div>
                    </div>
                ) : null}

                {/* KPI Cards Layer */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {renderCard(
                        "Receita Bruta",
                        dreData?.faturamentoTotal || 0,
                        <DollarSign className="h-5 w-5" />,
                        "Total Faturado no período",
                        "border-l-indigo-500"
                    )}
                    {renderCard(
                        "Despesas / Custos",
                        (dreData?.finValorAprovado || 0) + (dreData?.custosGerais || 0),
                        <Activity className="h-5 w-5 text-amber-600" />,
                        "Mão de obra e Extras consolidados",
                        "border-l-amber-500"
                    )}
                    {renderCard(
                        "Lucro Operacional",
                        dreData?.lucroReal || 0,
                        dreData && dreData.lucroReal < 0 ? <TrendingDown className="h-5 w-5 text-red-600" /> : <TrendingUp className="h-5 w-5 text-emerald-600" />,
                        "EBITDA Estimado",
                        dreData && dreData.lucroReal < 0 ? "border-l-red-500" : "border-l-emerald-500"
                    )}
                    <Card className="p-6 shadow-sm border-l-4 border-l-blue-500">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">Margem (L. Op.)</h3>
                            <div className="p-2 rounded-full bg-blue-100 text-blue-700 opacity-80">
                                <FileText className="h-5 w-5" />
                            </div>
                        </div>
                        {isLoading ? (
                            <Skeleton className="h-8 w-16 mb-2" />
                        ) : (
                            <p className="font-display text-3xl font-bold text-gray-900">{margemPercentual.toFixed(1)}%</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">Rentabilidade Financeira Operacional</p>
                    </Card>
                </div>

                {/* DRE Waterfall Ledger */}
                <Card className="border border-border/60 shadow-sm rounded-2xl overflow-hidden mt-8">
                    <div className="bg-gray-50 border-b border-border/60 px-6 py-4 flex items-center justify-between">
                        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                            <FileText className="h-5 w-5 text-gray-500" />
                            Balanço Operacional em Cascata
                        </h3>
                        {dreData?.auditoriaCompetencia?.status === 'ok' && (
                            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">
                                <CheckCircle2 className="h-3.5 w-3.5" /> DADOS AUDITADOS
                            </span>
                        )}
                    </div>

                    <div className="p-0">
                        {isLoading ? (
                            <div className="space-y-4 p-6">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        ) : (
                            <table className="w-full text-sm">
                                <tbody>
                                    {/* RECEITAS */}
                                    <tr className="border-b border-gray-100 bg-white hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 font-semibold text-gray-800">[+] RECEITA OPERACIONAL BRUTA</td>
                                        <td className="px-6 py-4 text-right font-display text-base font-bold text-emerald-700">
                                            {formatBRL(dreData?.faturamentoTotal || 0)}
                                        </td>
                                    </tr>
                                    <tr className="border-b border-gray-100 bg-gray-50/50">
                                        <td className="px-6 py-2 pl-12 text-gray-600">
                                            └─ Faturamentos / Acordos por Volume Validado
                                        </td>
                                        <td className="px-6 py-2 text-right text-gray-700">
                                            {formatBRL(dreData?.faturamentoTotal || 0)}
                                        </td>
                                    </tr>

                                    {/* DEDUCOES */}
                                    <tr className="border-b border-gray-100 bg-white hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 font-semibold text-gray-800">[-] CUSTOS E DESPESAS OPERACIONAIS</td>
                                        <td className="px-6 py-4 text-right font-display text-base font-bold text-rose-700">
                                            {formatBRL(((dreData?.finValorAprovado || 0) + (dreData?.custosGerais || 0)) * -1)}
                                        </td>
                                    </tr>
                                    <tr className="border-b border-gray-50 bg-gray-50/50">
                                        <td className="px-6 py-2 pl-12 text-gray-600 flex items-center justify-between border-t border-gray-100/50">
                                            <span>└─ Mão de Obra e Rateios (Folha + Diaristas)</span>
                                            {dreData?.auditoriaCompetencia?.pendencias?.length ? (
                                                <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                                                    Há pendências no controle RH
                                                </span>
                                            ) : null}
                                        </td>
                                        <td className="px-6 py-2 text-right text-gray-700">
                                            {formatBRL((dreData?.finValorAprovado || 0) * -1)}
                                        </td>
                                    </tr>
                                    <tr className="border-b border-gray-100 bg-gray-50/50">
                                        <td className="px-6 py-2 pl-12 text-gray-600">
                                            └─ Gastos Extras / Logística Eventuais
                                        </td>
                                        <td className="px-6 py-2 text-right text-gray-700">
                                            {formatBRL((dreData?.custosGerais || 0) * -1)}
                                        </td>
                                    </tr>

                                    {/* RESULTADO (LUCRO BRUTO) */}
                                    <tr className="bg-gray-100/80">
                                        <td className="px-6 py-6 font-bold text-gray-900 text-base">[=] RESULTADO OPERACIONAL (LUCRO BRUTO)</td>
                                        <td className={`px-6 py-6 text-right font-display text-xl font-black ${(dreData?.lucroReal || 0) < 0 ? 'text-rose-700' : 'text-blue-700'}`}>
                                            {formatBRL(dreData?.lucroReal || 0)}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        )}
                    </div>
                </Card>
            </div>
        </AppShell>
    );
}
