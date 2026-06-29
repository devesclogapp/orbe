export interface FornecedorFormValues {
  nome: string;
  documento: string;
  telefone: string;
  email: string;
  endereco: string;
  empresa_id: string;
  ativo: boolean;
  produto_id?: string;
}

export type FornecedorValidationErrors = Partial<Record<keyof FornecedorFormValues, string>>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateFornecedorPayload(payload: FornecedorFormValues): FornecedorValidationErrors {
  const errors: FornecedorValidationErrors = {};

  if (!payload.nome?.trim()) {
    errors.nome = "Informe o nome do fornecedor.";
  }

  if (!payload.documento?.trim()) {
    errors.documento = "Informe o CNPJ ou CPF.";
  } else {
    const digits = payload.documento.replace(/\D/g, "");
    if (!(digits.length === 11 || digits.length === 14)) {
      errors.documento = "Informe um CPF ou CNPJ válido.";
    }
  }

  if (!payload.email?.trim()) {
    errors.email = "Informe o e-mail do fornecedor.";
  } else if (!EMAIL_REGEX.test(payload.email.trim())) {
    errors.email = "Informe um e-mail válido.";
  }

  if (!payload.telefone?.trim()) {
    errors.telefone = "Informe o telefone do fornecedor.";
  } else {
    const digits = payload.telefone.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 11) {
      errors.telefone = "Informe um telefone válido.";
    }
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
    produto_id: payload.produto_id?.trim() || undefined,
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
