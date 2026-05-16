import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, 'src/pages/Colaboradores.tsx');
let c = fs.readFileSync(filePath, 'utf8');

// 1. Initial Data
c = c.replace(/empresa_id: defaultEmpresaId,\s+tipo_contrato: "Hora" as "Hora" \| "Operação",\s+tipo_colaborador: "CLT",/m,
    `empresa_id: defaultEmpresaId,
  regime_trabalho: "CLT",
  modelo_calculo: "Mensal",
  tipo_contrato: "Hora" as "Hora" | "Operação" | "Mensal",
  tipo_colaborador: "CLT",`);

// 2. handleEdit
c = c.replace(/empresa_id: c\.empresa_id \|\| "",\s*tipo_contrato: c\.tipo_contrato \|\| "Hora",\s*tipo_colaborador: c\.tipo_colaborador \|\| "CLT",/m,
    `empresa_id: c.empresa_id || "",
      regime_trabalho: c.regime_trabalho || "CLT",
      modelo_calculo: c.modelo_calculo || "Mensal",
      tipo_contrato: c.tipo_contrato || "Hora",
      tipo_colaborador: c.tipo_colaborador || "CLT",`);

// We should replace validation entirely using regex or substring
const validRegex = /const validateStep2 \= \(\) \=\> \{[\s\S]*?return true;\s*\};/m;
c = c.replace(validRegex, `const validateStep2 = () => {
    if (!form.regime_trabalho) {
      toast.error("Regime de trabalho é obrigatório.", { icon: null });
      return false;
    }
    if (!form.modelo_calculo) {
      toast.error("Modelo de cálculo é obrigatório.", { icon: null });
      return false;
    }
    if (!form.status) {
      toast.error("Status é obrigatório.", { icon: null });
      return false;
    }

    if (form.modelo_calculo === "Diária") {
      if (!form.valor_base || Number(form.valor_base) <= 0) {
        toast.error("Valor da diária é obrigatório.", { icon: null });
        return false;
      }
    } else {
      if (!form.cargo.trim()) {
        toast.error("Cargo/Função é obrigatório.", { icon: null });
        return false;
      }
      if (!form.matricula.trim() && form.regime_trabalho === "CLT") {
        toast.error("Matrícula é obrigatória para CLT.", { icon: null });
        return false;
      }
      if (!form.valor_base || Number(form.valor_base) <= 0) {
        toast.error("Valor base é obrigatório.", { icon: null });
        return false;
      }
    }
    return true;
  };`);

// 4. Submit
const submitRegex = /const submit \= \(\) \=\> \{[\s\S]*?createMutation\.mutate\(\{[\s\S]*?\}\);\s*\};/m;
let submitFuncMatch = c.match(submitRegex);
if (submitFuncMatch) {
    let submitFunc = submitFuncMatch[0];
    submitFunc = submitFunc.replace(/if \(form\.tipo_colaborador !== "DIARISTA"\) \{/g, `if (form.modelo_calculo !== "Diária") {`);
    submitFunc = submitFunc.replace(/empresa_id: form\.empresa_id \|\| empresaOptions\[0\]\?\.id,[\s\S]*?status: form\.status,/m,
        `empresa_id: form.empresa_id || empresaOptions[0]?.id,
      regime_trabalho: form.regime_trabalho,
      modelo_calculo: form.modelo_calculo,
      tipo_contrato: null,
      tipo_colaborador: form.regime_trabalho === "CLT" ? "CLT" : form.regime_trabalho === "Diarista" ? "DIARISTA" : "TERCEIRIZADO",
      valor_base: Number(form.valor_base) || 0,
      flag_faturamento: form.modelo_calculo !== "Diária" ? form.flag_faturamento : false,
      permitir_lancamento_operacional: ["Diária", "Produção", "Horista"].includes(form.modelo_calculo) ? true : form.permitir_lancamento_operacional,
      status: form.status,`
    );
    c = c.replace(submitRegex, submitFunc);
}

// 5. JSX Selectors
// Before: <Select value={form.tipo_colaborador} onValueChange={(v) => setForm({ ...form, tipo_colaborador: v, permitir_lancamento_operacional: v === "DIARISTA" ? true : form.permitir_lancamento_operacional })}>...
const jsxTipoColaborador = /<div className="space-y-1\.5">\s*<Label>Tipo de colaborador[\s\S]*?<\/SelectContent>\s*<\/Select>\s*<\/div>/g;

const newJsxBlocks = `<div className="space-y-1.5">
                      <Label>Regime de trabalho <span className="text-destructive">*</span></Label>
                      <Select value={form.regime_trabalho} onValueChange={(v) => setForm({ ...form, regime_trabalho: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CLT">CLT</SelectItem>
                          <SelectItem value="Intermitente">Intermitente</SelectItem>
                          <SelectItem value="Diarista">Diarista</SelectItem>
                          <SelectItem value="Terceirizado">Terceirizado</SelectItem>
                          <SelectItem value="Freelancer">Freelancer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Modelo de cálculo <span className="text-destructive">*</span></Label>
                      <Select value={form.modelo_calculo} onValueChange={(v) => setForm({ ...form, modelo_calculo: v, permitir_lancamento_operacional: ["Diária", "Produção", "Horista"].includes(v) ? true : form.permitir_lancamento_operacional })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Mensal">Mensal</SelectItem>
                          <SelectItem value="Horista">Horista</SelectItem>
                          <SelectItem value="Diária">Diária</SelectItem>
                          <SelectItem value="Produção">Produção</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>`;

c = c.replace(jsxTipoColaborador, newJsxBlocks);

// Replace `{form.tipo_colaborador === "DIARISTA" ? (` logic with `{form.modelo_calculo === "Diária" ? (`
c = c.replace(/form\.tipo_colaborador === "DIARISTA"/g, `form.modelo_calculo === "Diária"`);

fs.writeFileSync(filePath, c);
