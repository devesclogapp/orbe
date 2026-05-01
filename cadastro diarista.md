# AJUSTE — CADASTRO DE DIARISTAS DENTRO DE COLABORADORES

## Contexto

Já existe a tela:

/cadastros
Central de Cadastros > Colaboradores

O cadastro de diaristas deve ser feito dentro da categoria Colaboradores, usando classificação por tipo/tag.

Não criar uma tela isolada `/rh/diaristas/cadastros`, a menos que seja apenas um atalho/filtro para colaboradores do tipo diarista.

---

# 1. Ajustar cadastro de colaboradores

Na aba **Colaboradores**, criar botão:

Novo colaborador

Campos obrigatórios:

- Nome completo
- CPF
- Telefone
- Empresa vinculada
- Tipo de colaborador
- Função
- Valor base
- Status

---

# 2. Tipo de colaborador

Criar campo:

tipo_colaborador

Opções:

- DIARISTA
- CLT
- INTERMITENTE
- PRODUÇÃO
- TERCEIRIZADO

Esse campo será usado para filtrar quem aparece em cada módulo.

---

# 3. Regra para diaristas

Quando o tipo_colaborador for:

DIARISTA

Exibir campos específicos:

- Valor da diária
- Função operacional
- Permitir lançamento operacional: sim/não
- Status: ativo/inativo

---

# 4. Integração com tela do Carlos

Na tela:

/producao/diaristas

Carregar apenas colaboradores com:

- tipo_colaborador = DIARISTA
- status = ativo
- permitir_lancamento_operacional = true
- mesma empresa_id do usuário logado

---

# 5. Resultado esperado

Depois que o RH/Admin cadastrar um colaborador como DIARISTA, ele deve aparecer automaticamente na tela do Carlos.

Fluxo:

Admin/RH cadastra colaborador
↓
Define tipo_colaborador = DIARISTA
↓
Define valor da diária
↓
Ativa o colaborador
↓
Carlos acessa /producao/diaristas
↓
Diarista aparece na lista para marcação P, MP ou Ausente