export type TransportadoraFormValues = {
  nome: string;
  documento: string;
  telefone: string;
  email: string;
  endereco: string;
  empresa_id: string;
  ativo: boolean;
};

export type TransportadoraValidationErrors = Partial<Record<keyof TransportadoraFormValues, string>>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function trimToEmpty(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeTransportadoraPayload(values: TransportadoraFormValues) {
  const nome = trimToEmpty(values.nome);
  const documento = trimToEmpty(values.documento);
  const telefone = trimToEmpty(values.telefone);
  const email = trimToEmpty(values.email).toLowerCase();
  const endereco = trimToEmpty(values.endereco);
  const empresaId = trimToEmpty(values.empresa_id);

  return {
    nome,
    documento: documento || null,
    telefone: telefone || null,
    email: email || null,
    endereco: endereco || null,
    empresa_id: empresaId || null,
    ativo: values.ativo,
  };
}

export function validateTransportadoraPayload(
  payload: ReturnType<typeof normalizeTransportadoraPayload>,
): TransportadoraValidationErrors {
  const errors: TransportadoraValidationErrors = {};

  if (!payload.nome) {
    errors.nome = "Informe o nome da transportadora.";
  }

  if (payload.documento) {
    const digits = payload.documento.replace(/\D/g, "");
    if (!(digits.length === 11 || digits.length === 14)) {
      errors.documento = "Informe um CPF ou CNPJ válido.";
    }
  }

  if (payload.email && !EMAIL_REGEX.test(payload.email)) {
    errors.email = "Informe um e-mail válido.";
  }

  if (payload.telefone) {
    const digits = payload.telefone.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 11) {
      errors.telefone = "Informe um telefone válido.";
    }
  }

  return errors;
}

export function getTransportadoraDuplicateMessage() {
  return "Já existe uma transportadora com este nome neste tenant.";
}

export function getTransportadoraErrorMessage(error: unknown) {
  const err = error as { code?: string; message?: string; details?: string; hint?: string } | null;
  const rawMessage = `${err?.message ?? ""} ${err?.details ?? ""} ${err?.hint ?? ""}`.toLowerCase();

  if (
    err?.code === "23505" ||
    rawMessage.includes("transportadoras_clientes_nome_tenant_unique") ||
    (rawMessage.includes("duplicate key") && rawMessage.includes("transportadoras_clientes"))
  ) {
    return getTransportadoraDuplicateMessage();
  }

  return err?.message || "Erro ao salvar transportadora.";
}
