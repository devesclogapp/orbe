# Validação Final — Tabela de Responsabilidades (Edge Functions)

Após a análise rígida das quatro rotinas responsáveis pela ingestão de dados, ficou claríssimo o choque estrutural entre os domínios `CLT (RHID/Manual)` e `Intermitentes (Tio Digital)`. 

Existe uma assimetria no conceito de **Responsabilidade de Pré-cadastro**.

## Tabela Definitiva de Edge Functions

| Função | Domínio / Fase | Origem Payload | Cria Empresa Provisória? | Cria Colab. Provisório? | Pode atrelar `empresa_id = null`? |
|---|---|---|:---:|:---:|:---:|
| `importar-colaboradores-tio` | **INTERMITENTES**<br/>Pré-cadastro (Tio A) | Tio Digital (Webhook_A) | **SIM** *(via RPC Supabase e Fallback Insert)* | **SIM** | **SIM** *(Apenas se falhar no fallback e na RPC, segue com null e loga warning)* |
| `importar-intermitentes-tio` | **INTERMITENTES**<br/>Lançamento (Tio B) | Tio Digital (Webhook_B) | **NÃO** *(Apenas pesquisa)* | **NÃO** *(Apenas pesquisa)* | **SIM** *(O pipeline B é 'cego', se Tio A não rodou antes, ele herda null)* |
| `importar-pontos-rhid` | **CLT**<br/>Cad + Ponto (Misto) | RHID (API/Webhook) | **SIM** | **SIM** | **NÃO** *(Cria na hora e força a amarração 1:1)* |
| `importar-pontos-manual` | **CLT**<br/>Cad + Ponto (Misto) | Upload CSV/Excel UI | **SIM** | **SIM** | **NÃO** *(Idêntico ao RHID)* |

---
## Constatações Fundamentais

### 1. Separação (Tio) vs Adoção Tardia (RHID)
* **Tio Digital divide o domínio:** Eles possuem uma Edge Function separada só para cadastrar/amarrar as Pessoas e Empresas (`importar-colaboradores-tio`). Dessa forma, a segunda Edge Function (`importar-intermitentes-tio`) parte da premissa de que a Base de Dados já está pronta. Se o Tio A falhar ou atrasar, o Tio B cria um lançamento órfão (`empresa_id = null`);
* **RHID / Manual são monolíticos:** Nessas integrações, **não existe** "Workflow A" e "Workflow B". A rotina `importar-pontos-` roda o pré-cadastro E o lançamento no mesmo átimo de segundo. Ela para a importação da linha, cria a empresa do zero, cria o colaborador do zero, extrai os IDs de ambos e então desce o lançamento. 

### 2. Fluxo Homologado vs Risco
A rotina monolítica (`importar-pontos-rhid`) está **homologada** e o Cliente/RH validou positivamente o comportamento "Nascer Provisório Automaticamente". 
Isso explica porquê Tio Digital às vezes sofre com lotes sem empresa: se a linha de importação de Ponto (Tio B) subir junto de ou antes da sincronização de Colaboradores (Tio A), o ponto nasce órfão e não aciona nenhum self-healing dentro do Lançamento em si.
