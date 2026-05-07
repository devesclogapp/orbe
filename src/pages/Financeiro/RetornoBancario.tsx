import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Banknote } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

const RetornoBancario = () => {
  const [banco, setBanco] = useState("001");

  return (
    <AppShell title="Retorno Bancário">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 md:col-span-1 space-y-6">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase flex items-center gap-2">
                <Banknote className="w-4 h-4" /> Configuração
              </h3>

              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600">Banco do Arquivo</label>
                <Select value={banco} onValueChange={setBanco}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o banco" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="001">001 - Banco do Brasil</SelectItem>
                    <SelectItem value="237">237 - Bradesco</SelectItem>
                    <SelectItem value="033">033 - Santander</SelectItem>
                    <SelectItem value="341">341 - Itaú</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-4">
                <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded border border-dashed border-border/50">
                  O contrato técnico do `CNAB240BBReader` já foi preparado, mas a leitura de retorno, baixa financeira e automações seguem reservadas para a Fase 8.2.
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-10 md:col-span-2 border-2 border-dashed border-border/50 flex flex-col items-center justify-center text-center space-y-4 relative overflow-hidden">
            <div className="w-16 h-16 bg-muted/50 text-muted-foreground rounded-full flex items-center justify-center">
              <Upload className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Upload de retorno indisponível nesta fase</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Esta tela foi mantida apenas como preparação arquitetural. O processamento real do arquivo será habilitado junto com o parser na Fase 8.2.
              </p>
            </div>
            <Button disabled>Disponível na Fase 8.2</Button>
          </Card>
        </div>
      </div>
    </AppShell>
  );
};

export default RetornoBancario;
