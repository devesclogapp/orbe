export interface FornecedorFormValues {
  nome: string;
  documento: string;
  telefone: string;
  email: string;
  endereco: string;
  empresa_id: string;
  ativo: boolean;
}

export type FornecedorValidationErrors = Partial<Record<keyof FornecedorFormValues, string>>;

export function validateFornecedorPayload(payload: FornecedorFormValues): FornecedorValidationErrors {
  const errors: FornecedorValidationErrors = {};

  if (!payload.nome?.trim()) {
    errors.nome = "Informe o nome do fornecedor.";
  }

  return errors;
}

export function normalizeFornecedorPayload(payload: FornecedorFormValues): FornecedorFormValues {
  return {
    ...payload,
    nome: payload.nome?.trim() ?? "",
    documento: payload.documento?.trim().replace(/[^\d.-/]/g, "") ?? "", // Simple doc normalize initially
    telefone: payload.telefone?.trim() ?? "",
    email: payload.email?.trim() ?? "",
    endereco: payload.endereco?.trim() ?? "",
  };
}

export function getFornecedorErrorMessage(error: any): string {
  const msg = error?.message || "";
  
  if (msg.includes("já existe um fornecedor") || msg.includes("duplicate key value") || error?.code === '23505') {
    return "Já existe um fornecedor com este nome neste tenant.";
  }
  
  return msg || "Erro ao processar fornecedor.";
}

export function formatCpfCnpj(value: string): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  } else {
    return digits
      .replace(/(\d{2})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1/$2")
      .replace(/(\d{4})(\d{1,2})$/, "$1-$2")
      .slice(0, 18);
  }
}

export function formatPhone(value: string): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  } else {
    return digits
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d{1,4})$/, "$1-$2")
      .slice(0, 15);
  }
}
