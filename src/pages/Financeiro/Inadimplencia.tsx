import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Mail, MessageSquare, AlertCircle, Calendar, DollarSign, Clock, FileText } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { Link } from 'react-router-dom';
import { InadimplenciaService, InadimplenciaConsolidada } from '@/services/inadimplencia.service';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AppShell } from '@/components/layout/AppShell';

export default function Inadimplencia() {
    const { data, isLoading, error } = useQuery<InadimplenciaConsolidada>({
        queryKey: ['inadimplencia_dashboard'],
        queryFn: () => InadimplenciaService.getAgingList(),
    });

    const [expandedCliente, setExpandedCliente] = useState<string | null>(null);

    const formatMoney = (val: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

    if (isLoading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="h-10 bg-gray-200 rounded w-1/3"></div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="h-24 bg-gray-200 rounded"></div>
                    <div className="h-24 bg-gray-200 rounded"></div>
                    <div className="h-24 bg-gray-200 rounded"></div>
                    <div className="h-24 bg-gray-200 rounded"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 p-6 rounded-lg border border-red-200 flex items-center gap-3">
                <AlertCircle className="w-6 h-6 text-red-600" />
                <p className="text-red-700 font-medium">Erro ao carregar inadimplência. Tente novamente.</p>
            </div>
        );
    }

    const totais = data?.totais || { dias_1_30: 0, dias_31_60: 0, dias_61_90: 0, dias_mais_90: 0, total_inadimplente: 0 };
    const clientes = data?.clientes || [];

    return (
        <AppShell title="Inadimplência" subtitle="Gestão de Recebíveis em Atraso (Aging List)">
            <div className="space-y-6">
                <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center">
                            <Clock className="w-6 h-6 text-red-500 mr-2" />
                            Inadimplência
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">Gestão de Recebíveis em Atraso (Aging List)</p>
                    </div>
                    <Link to="/financeiro/receitas">
                        <Button variant="outline" className="gap-2">
                            <ArrowLeft className="w-4 h-4" />
                            Voltar para Receitas
                        </Button>
                    </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {[
                        { label: 'Total Inadimplente', value: totais.total_inadimplente, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
                        { label: '1 a 30 dias', value: totais.dias_1_30, color: 'text-yellow-600', bg: 'bg-white', border: 'border-yellow-200' },
                        { label: '31 a 60 dias', value: totais.dias_31_60, color: 'text-orange-600', bg: 'bg-white', border: 'border-orange-200' },
                        { label: '61 a 90 dias', value: totais.dias_61_90, color: 'text-red-500', bg: 'bg-white', border: 'border-red-300' },
                        { label: '+90 dias (Crítico)', value: totais.dias_mais_90, color: 'text-red-700', bg: 'bg-white', border: 'border-red-400' },
                    ].map((card, i) => (
                        <Card key={i} className={`p-5 ${card.bg} border ${card.border}`}>
                            <h3 className="text-xs font-semibold text-gray-500 uppercase">{card.label}</h3>
                            <p className={`text-2xl font-bold mt-2 ${card.color}`}>{formatMoney(card.value)}</p>
                        </Card>
                    ))}
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                        <h2 className="text-sm font-bold text-gray-700 uppercase">Posição por Cliente</h2>
                        <span className="text-xs font-medium bg-gray-200 text-gray-600 py-1 px-3 rounded-full">{clientes.length} Clientes em Atraso</span>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {clientes.length === 0 ? (
                            <div className="p-12 text-center text-gray-400 flex flex-col items-center">
                                <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
                                    <DollarSign className="w-8 h-8 text-green-500" />
                                </div>
                                <p className="text-lg font-medium text-gray-900">Nenhum título em atraso!</p>
                                <p className="mt-1">Excelente notícia. Não há inadimplência registrada.</p>
                            </div>
                        ) : (
                            clientes.map((cliente) => (
                                <div key={cliente.empresa_id} className="group">
                                    <div
                                        className="px-6 py-4 hover:bg-gray-50 cursor-pointer flex items-center gap-4 transition-colors"
                                        onClick={() => setExpandedCliente(expandedCliente === cliente.empresa_id ? null : cliente.empresa_id)}
                                    >
                                        <div className="flex-1">
                                            <p className="font-bold text-gray-900">{cliente.empresa_nome}</p>
                                            <div className="flex gap-4 mt-2 text-xs font-medium text-gray-500">
                                                <span className={cliente.dias_1_30 > 0 ? "text-yellow-600 font-bold" : ""}>30d: {formatMoney(cliente.dias_1_30)}</span>
                                                <span className={cliente.dias_31_60 > 0 ? "text-orange-600 font-bold" : ""}>60d: {formatMoney(cliente.dias_31_60)}</span>
                                                <span className={cliente.dias_61_90 > 0 ? "text-red-500 font-bold" : ""}>90d: {formatMoney(cliente.dias_61_90)}</span>
                                                <span className={cliente.dias_mais_90 > 0 ? "text-red-700 font-bold" : ""}>+90d: {formatMoney(cliente.dias_mais_90)}</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="block text-xl font-bold text-red-600">{formatMoney(cliente.total_inadimplente)}</span>
                                            <span className="text-xs text-gray-500">{cliente.titulos.length} títulos pendentes</span>
                                        </div>
                                    </div>

                                    {expandedCliente === cliente.empresa_id && (
                                        <div className="px-6 pb-6 pt-2 bg-gray-50 border-t border-gray-100">
                                            <div className="space-y-3">
                                                {cliente.titulos.map(titulo => {
                                                    const diasAtraso = differenceInDays(new Date(), new Date(titulo.vencimento + 'T12:00:00'));
                                                    return (
                                                        <div key={titulo.id} className="bg-white border border-gray-200 rounded-lg p-4 flex justify-between items-center shadow-sm">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-10 h-10 bg-red-100 text-red-600 font-bold rounded-lg flex flex-col items-center justify-center leading-none">
                                                                    <span className="text-[10px]">Atraso</span>
                                                                    <span className="text-sm">{diasAtraso}d</span>
                                                                </div>
                                                                <div>
                                                                    <p className="font-semibold text-gray-800 text-sm">{titulo.modalidade}</p>
                                                                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                                                        <Calendar className="w-3 h-3" /> Venceu em: {new Date(titulo.vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="font-bold text-gray-900">{formatMoney(Number(titulo.valor_total))}</p>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-8 gap-2 text-blue-600 hover:text-blue-700 border-blue-200 hover:bg-blue-50"
                                                                    onClick={() => window.open(`mailto:financeiro@cliente.com?subject=Aviso de Vencimento - ${cliente.empresa_nome}&body=Prezados, identificamos uma pendência no valor de ${formatMoney(Number(titulo.valor_total))} referente ao vencimento ${new Date(titulo.vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}.`, '_blank')}
                                                                >
                                                                    <Mail className="w-3.5 h-3.5" /> E-mail
                                                                </Button>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-8 gap-2 text-green-600 hover:text-green-700 border-green-200 hover:bg-green-50"
                                                                    onClick={() => window.open(`https://wa.me/?text=Olá, somos o financeiro da ORBE. Verificamos uma pendência no valor de ${formatMoney(Number(titulo.valor_total))}...`, '_blank')}
                                                                >
                                                                    <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
