import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import {
    FileText,
    CheckCircle2,
    AlertCircle,
    Download,
    Settings,
    Banknote
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { EmpresaService } from "@/services/base.service";
import { CNABService, ContaBancariaService } from "@/services/financial.service";
import { toast } from "sonner";

const RemessaCNAB = () => {
    const [competencia, setCompetencia] = useState("2024-04");
    const [empresaId, setEmpresaId] = useState<string>("");
    const [contaId, setContaId] = useState<string>("");
    const [validation, setValidation] = useState<any>(null);

    const { data: empresas } = useQuery({
        queryKey: ["empresas"],
        queryFn: () => EmpresaService.getAll()
    });

    const { data: contas } = useQuery({
        queryKey: ["contas", empresaId],
        queryFn: () => empresaId ? ContaBancariaService.getByEmpresa(empresaId) : Promise.resolve([]),
        enabled: !!empresaId
    });

    const handleValidate = async () => {
        if (!empresaId) return toast.error("Selecione uma empresa");
        try {
            const res = await CNABService.validateRemessa(competencia, empresaId);
            setValidation(res);
            if (res.isValid) {
                toast.success("Remessa validada com sucesso!");
            } else {
                toast.warning("Inconsistências encontradas na remessa.");
            }
        } catch (error) {
            toast.error("Erro ao validar remessa");
        }
    };

    const handleGenerate = async () => {
        if (!contaId) return toast.error("Selecione a conta bancária");
        try {
            const res = await CNABService.generateRemessa({ competencia, empresaId, contaId });
            toast.success(`CNAB Gerado: ${res.fileName}`);
            // Simula download
            const element = document.createElement("a");
            const file = new Blob([res.content], { type: 'text/plain' });
            element.href = URL.createObjectURL(file);
            element.download = res.fileName;
            document.body.appendChild(element);
            element.click();
        } catch (error) {
            toast.error("Erro ao gerar arquivo");
        }
    };

    return (
        <AppShell title="Geração de Remessa CNAB">
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="p-6 space-y-4">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase flex items-center gap-2">
                            <Settings className="w-4 h-4" /> Configurações do Lote
                        </h3>

                        <div className="space-y-2">
                            <label className="text-xs font-medium text-gray-700">Competência</label>
                            <Select value={competencia} onValueChange={setCompetencia}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione o mês" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="2024-03">Março 2024</SelectItem>
                                    <SelectItem value="2024-04">Abril 2024</SelectItem>
                                    <SelectItem value="2024-05">Maio 2024</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-medium text-gray-700">Empresa (Cliente)</label>
                            <Select value={empresaId} onValueChange={setEmpresaId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione o cliente" />
                                </SelectTrigger>
                                <SelectContent>
                                    {empresas?.map(emp => (
                                        <SelectItem key={emp.id} value={emp.id}>{emp.nome}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-medium text-gray-700">Conta Bancária Origem</label>
                            <Select value={contaId} onValueChange={setContaId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione a conta" />
                                </SelectTrigger>
                                <SelectContent>
                                    {contas?.map(cta => (
                                        <SelectItem key={cta.id} value={cta.id}>
                                            {cta.banco} - Ag: {cta.agencia} Cc: {cta.conta}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <Button className="w-full bg-brand hover:bg-brand/90 mt-4" onClick={handleValidate}>
                            Validar Remessa
                        </Button>
                    </Card>

                    <Card className={`p-6 md:col-span-2 border-l-4 ${validation?.isValid ? 'border-l-success' : validation === null ? 'border-l-gray-300' : 'border-l-error'}`}>
                        <h3 className="text-sm font-semibold text-gray-500 uppercase flex items-center gap-2 mb-4">
                            <FileText className="w-4 h-4" /> Resumo e Validação
                        </h3>

                        {!validation ? (
                            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                                <FileText className="w-12 h-12 mb-2 opacity-20" />
                                <p>Selecione os parâmetros e valide a remessa para ver os detalhes.</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-gray-50 p-4 rounded-lg">
                                        <span className="text-xs text-gray-500 block uppercase">Quantidade de Títulos</span>
                                        <span className="text-2xl font-bold">{validation.summary.totalItems}</span>
                                    </div>
                                    <div className="bg-gray-50 p-4 rounded-lg">
                                        <span className="text-xs text-gray-500 block uppercase">Valor Total</span>
                                        <span className="text-2xl font-bold text-brand">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(validation.summary.totalValue)}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h4 className="text-xs font-bold text-gray-700 uppercase">Status da Verificação</h4>
                                    {validation.isValid ? (
                                        <div className="flex items-center gap-3 bg-green-50 text-green-700 p-3 rounded-md border border-green-200">
                                            <CheckCircle2 className="w-5 h-5" />
                                            <span className="text-sm">Todos os dados estão completos e o faturamento foi aprovado.</span>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {validation.errors.map((err: string, i: number) => (
                                                <div key={i} className="flex items-center gap-3 bg-red-50 text-red-700 p-3 rounded-md border border-red-200">
                                                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                                    <span className="text-sm">{err}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {validation.isValid && (
                                    <div className="pt-4 border-t border-gray-100 flex justify-end">
                                        <Button className="bg-brand gap-2" onClick={handleGenerate}>
                                            <Download className="w-4 h-4" /> Gerar Arquivo CNAB
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </AppShell>
    );
};

export default RemessaCNAB;
