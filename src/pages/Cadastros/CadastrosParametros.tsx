import { useQuery } from "@tanstack/react-query";
import { Settings2, Plus, Pencil, Trash2, Boxes, Wrench, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    ConfigTipoOperacaoService,
    ConfigProdutoService,
    ConfigTipoDiaService
} from "@/services/base.service";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";

export function CadastrosParametros() {
    const { data: tiposOperacao = [], isLoading: loadingOps } = useQuery({
        queryKey: ["config_tipos_operacao"],
        queryFn: () => ConfigTipoOperacaoService.getAll(),
    });

    const { data: produtos = [], isLoading: loadingProdutos } = useQuery({
        queryKey: ["config_produtos"],
        queryFn: () => ConfigProdutoService.getAll(),
    });

    const { data: tiposDia = [], isLoading: loadingDias } = useQuery({
        queryKey: ["config_tipos_dia"],
        queryFn: () => ConfigTipoDiaService.getAll(),
    });

    const isLoading = loadingOps || loadingProdutos || loadingDias;

    return (
        <section className="esc-card overflow-hidden min-h-[400px]">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
                <div>
                    <h2 className="font-display font-semibold text-foreground">Parâmetros do Motor</h2>
                    <p className="text-sm text-muted-foreground">
                        Configurações globais que regem o comportamento operacional e financeiro.
                    </p>
                </div>
            </div>

            <div className="p-5">
                <Tabs defaultValue="operacoes" className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="operacoes" className="gap-2">
                            <Wrench className="h-4 w-4" /> Operações
                        </TabsTrigger>
                        <TabsTrigger value="produtos" className="gap-2">
                            <Boxes className="h-4 w-4" /> Produtos
                        </TabsTrigger>
                        <TabsTrigger value="dias" className="gap-2">
                            <Clock className="h-4 w-4" /> Tipos de Dia
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="operacoes" className="space-y-4">
                        <div className="border rounded-xl overflow-hidden bg-white">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50/50">
                                        <TableHead>Operação</TableHead>
                                        <TableHead>Código</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loadingOps ? (
                                        <TableRow><TableCell colSpan={4} className="text-center py-5">Carregando...</TableCell></TableRow>
                                    ) : tiposOperacao.map((op: any) => (
                                        <TableRow key={op.id}>
                                            <TableCell className="font-medium">{op.nome}</TableCell>
                                            <TableCell className="font-mono text-xs">{op.codigo}</TableCell>
                                            <TableCell><Badge variant="success">Ativa</Badge></TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>

                    <TabsContent value="produtos" className="space-y-4">
                        <div className="border rounded-xl overflow-hidden bg-white">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50/50">
                                        <TableHead>Categoria / Produto</TableHead>
                                        <TableHead>ICMS %</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loadingProdutos ? (
                                        <TableRow><TableCell colSpan={4} className="text-center py-5">Carregando...</TableCell></TableRow>
                                    ) : produtos.map((prod: any) => (
                                        <TableRow key={prod.id}>
                                            <TableCell className="font-medium">{prod.categoria}</TableCell>
                                            <TableCell>{prod.icms}%</TableCell>
                                            <TableCell><Badge variant="success">Ativa</Badge></TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>

                    <TabsContent value="dias" className="space-y-4">
                        <div className="border rounded-xl overflow-hidden bg-white">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50/50">
                                        <TableHead>Tipo de Dia</TableHead>
                                        <TableHead>Fator</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loadingDias ? (
                                        <TableRow><TableCell colSpan={4} className="text-center py-5">Carregando...</TableCell></TableRow>
                                    ) : tiposDia.map((dia: any) => (
                                        <TableRow key={dia.id}>
                                            <TableCell className="font-medium">{dia.nome}</TableCell>
                                            <TableCell>{dia.fator}x</TableCell>
                                            <TableCell><Badge variant="success">Ativa</Badge></TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </section>
    );
}
