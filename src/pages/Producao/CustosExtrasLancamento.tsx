import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft,
  History,
  Package,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { OperationalShell } from "@/components/layout/OperationalShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CustoExtraOperacionalService } from "@/services/base.service";
import { CustosExtrasForm } from "@/components/forms/CustosExtrasForm";

const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const formatCurrency = (value: number) => currencyFormatter.format(Number.isFinite(value) ? value : 0);

const CustosExtrasLancamento = () => {
  const navigate = useNavigate();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: historicoHoje = [], isLoading: isLoadingHistorico } = useQuery({
    queryKey: ["custos-extras-hoje", today],
    queryFn: () => CustoExtraOperacionalService.getByDate(today),
  });

  return (
    <OperationalShell title="Lançamento de Custo Extra">
      <div className="max-w-4xl mx-auto space-y-8 pb-20 pt-4 px-4">
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => navigate("/producao")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Menu de Produção
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-800">
              <Package className="h-5 w-5 text-primary" /> Novo Lançamento
            </h2>
            <CustosExtrasForm />
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 px-2">
              <History className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-bold text-slate-800">Lançamentos de Hoje</h2>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-50">
              {isLoadingHistorico ? (
                <div className="p-8 text-center text-muted-foreground animate-pulse">Carregando...</div>
              ) : historicoHoje.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm italic">
                  Nenhum custo registrado hoje.
                </div>
              ) : (
                (historicoHoje as any[]).map((item) => (
                  <div key={item.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-xs font-bold text-slate-900">{item.empresas?.nome || "Empresa"}</p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Package className="h-2.5 w-2.5" />
                          {item.descricao || "Custo"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-destructive">{formatCurrency(item.total)}</p>
                        <Badge variant="outline" className="text-[8px] h-4 px-1 uppercase opacity-70">
                          {item.categoria_custo}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </OperationalShell>
  );
};

export default CustosExtrasLancamento;
