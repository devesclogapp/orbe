# SKILL: Code Safety Guard
## Objetivo
Evitar quebras, regressões e edições desnecessárias em código existente.

## ANTES de qualquer implementação, OBRIGATÓRIO:

### 1. Reconhecimento
- Liste os arquivos que serão MODIFICADOS
- Liste os arquivos que serão CRIADOS
- Liste os arquivos que NÃO serão tocados
- Aguarde confirmação antes de prosseguir

### 2. Diagnóstico antes de codar
- Nunca assuma o conteúdo de um arquivo — leia-o primeiro
- Nunca assuma o schema de uma tabela — consulte antes
- Nunca assuma quais valores são aceitos em enums/constraints — verifique
- Se não tiver acesso ao arquivo, pergunte antes de inventar

### 3. Regras de edição
- Edite APENAS o trecho necessário — nunca reescreva o arquivo inteiro
- Nunca remova código existente sem confirmação explícita
- Nunca renomeie variáveis, funções ou tipos existentes
- Nunca altere interfaces/types que outros arquivos já importam
- Nunca mude lógica que não está no escopo da tarefa

### 4. Escopo proibido (NÃO TOCAR sem solicitação explícita)
- Fluxo de autenticação
- Configuração do cliente Supabase
- RLS e políticas do banco
- Fluxo de diaristas, CNAB, financeiro, governança
- Providers e contextos globais (AuthContext, TenantContext)
- Arquivos de roteamento

### 5. Implementação em passos
- Implemente UM passo por vez
- Após cada passo, mostre o diff exato do que mudou
- Aguarde confirmação antes do próximo passo
- Se encontrar algo inesperado, PARE e reporte antes de continuar

### 6. Validação antes do INSERT/UPDATE no banco
- Sempre verificar constraints (CHECK, FK, NOT NULL) antes de montar o payload
- Nunca usar valores hardcoded de tipo/status sem confirmar os aceitos no banco
- Sempre filtrar por tenant_id e empresa_id em queries multiempresa

### 7. Se encontrar um bug fora do escopo
- Reporte o bug encontrado
- NÃO corrija automaticamente
- Aguarde instrução

## 8. Encoding e acentuação (CRÍTICO)

### Regras obrigatórias
- Todos os arquivos devem ser salvos em **UTF-8 sem BOM**
- Nunca usar entidades HTML para acentos (`&atilde;`, `&eacute;`) — usar o caractere direto
- Nunca escapar caracteres acentuados (`\u00e3`, `\u00e9`) — usar o caractere direto
- Nunca converter strings acentuadas para ASCII

### Em strings de código
- Mensagens de UI: manter acentos exatamente como estão no restante do projeto
- Nunca "corrigir" acentuação existente — se está assim no projeto, está certo
- Copiar padrão de acentuação dos arquivos existentes antes de criar strings novas

### Em queries SQL e payloads
- Valores de enum e status: verificar no banco se são com ou sem acento
  - Exemplos do projeto: `'pendente_complemento'`, `'ponto_importado'` — sem acento
- Nunca assumir — consultar o valor exato aceito antes de usar

### Ao ler arquivos existentes
- Se encontrar caractere estranho (ex: `ç`, `ã`, `é`), PARE
- Reportar: "Arquivo com problema de encoding detectado em [arquivo]"
- Não editar o arquivo até o encoding ser corrigido manualmente

### Checklist antes de salvar qualquer arquivo
- [ ] Encoding: UTF-8 sem BOM
- [ ] Acentos: caracteres diretos, não escapados
- [ ] Strings novas seguem o padrão dos arquivos existentes
- [ ] Nenhum acento foi removido ou alterado

## Formato de resposta esperado
Antes de codar:
> "Vou modificar: [arquivos]
> Vou criar: [arquivos]
> Não vou tocar: [arquivos]
> Confirma?"

Após implementar:
> "O que mudou: [diff resumido]
> O que não foi alterado: [confirmação]
> Próximo passo: [descrição]"