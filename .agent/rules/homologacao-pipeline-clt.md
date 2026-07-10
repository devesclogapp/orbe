---
trigger: always_on
---

# FASE 06 — HOMOLOGAÇÃO E2E DO WORKFLOW B (PROCESSAMENTO CLT)

## Contexto

Concluímos com sucesso a estabilização do **Workflow A**, responsável pelo pré-cadastro automático de empresas e colaboradores CLT provenientes do RHID.

Hoje o comportamento está homologado:

- cria automaticamente novas empresas quando necessário;
- cria automaticamente novos colaboradores;
- evita duplicidades;
- mantém sincronização incremental;
- deixa o RH responsável apenas pelo complemento cadastral;
- alimenta corretamente a Base Oficial de Homologação.

Também concluímos a criação da **Base Oficial de Homologação**, composta por cinco colaboradores fictícios totalmente completos, isolados dos dados reais da ESC Log.

Essa base será utilizada permanentemente em todas as homologações futuras do ORBE.

Ela contém os seguintes cenários:

- CLT-HML-001 — Jornada Normal
- CLT-HML-002 — Hora Extra
- CLT-HML-003 — Atraso
- CLT-HML-004 — Batidas Incompletas
- CLT-HML-005 — Jornada Especial

Portanto, não precisamos mais depender dos colaboradores reais para validar o sistema.

---

# Objetivo desta fase

Agora iniciaremos a homologação completa do **Workflow B**.

Este workflow é responsável por:

RHID
↓

Gerar relatório

↓

Aguardar processamento

↓

Baixar CSV

↓

Processar CSV

↓

Relacionar colaborador

↓

Relacionar empresa

↓

Enviar registros para o ORBE

↓

Popular registros_ponto

↓

Disponibilizar dados ao Motor RH

Esta fase NÃO irá validar ainda o cálculo do Motor RH.

O objetivo agora é garantir que toda a importação seja íntegra antes do processamento.

---

# Escopo da homologação

Auditar integralmente o Workflow B.

Precisamos validar:

## 1. Geração do relatório

Verificar:

- autenticação;
- geração correta;
- polling;
- tratamento de timeout;
- tratamento de falhas.

---

## 2. Download do CSV

Validar:

- arquivo correto;
- competência correta;
- encoding;
- delimitadores;
- datas;
- horas.

---

## 3. Parser

Conferir:

- leitura linha a linha;
- campos vazios;
- horários;
- CPF;
- matrícula;
- departamento;
- empresa.

Nenhuma informação poderá ser descartada silenciosamente.

---

## 4. Relacionamento dos colaboradores

Validar:

- busca por matrícula;
- fallback por CPF;
- fallback por RHID Person ID;
- inexistência de duplicidades.

---

## 5. Relacionamento das empresas

Conferir:

- empresa correta;
- empresa homologação;
- empresa real;
- relacionamento por departamento;
- fallback implementado no Workflow A.

---

## 6. Payload enviado ao ORBE

Auditar todos os campos enviados.

Validar:

- nomes;
- tipos;
- formatos;
- datas;
- horários;
- competência;
- tenant;
- empresa;
- colaborador;
- lote;
- origem;
- processamento.

Comparar integralmente com o schema da tabela registros_ponto.

---

## 7. Importação

Validar:

- inserts;
- updates;
- idempotência;
- reimportação;
- registros duplicados;
- registros órfãos;
- tratamento de erros.

---

## 8. Consistência da tabela registros_ponto

Após a importação conferir:

- quantidade importada;
- quantidade processada;
- colaboradores encontrados;
- empresas encontradas;
- datas;
- horários;
- competências.

Todos os registros deverão existir exatamente uma vez.

---

## 9. Idempotência

Executar novamente o Workflow.

Resultado esperado:

- nenhum registro duplicado;
- nenhum colaborador duplicado;
- nenhuma empresa duplicada;
- atualização apenas quando necessário.

---

## 10. Robustez

Verificar:

- tratamento de exceções;
- logs;
- mensagens;
- retries;
- falhas de rede;
- falhas de autenticação;
- campos ausentes;
- CSV incompleto.

---

# Auditoria Arquitetural

Além da homologação funcional, realizar uma inspeção técnica completa.

Identificar:

- gargalos;
- redundâncias;
- código morto;
- duplicidade de lógica;
- queries desnecessárias;
- chamadas repetidas;
- oportunidades de simplificação;
- possíveis problemas futuros.

Sempre justificar tecnicamente qualquer sugestão.

---

# Importante

Nesta fase NÃO alterar:

- Motor RH;
- Banco de Horas;
- Aprovação RH;
- Financeiro;
- CNAB;
- Dashboard;
- DRE.

O foco exclusivo é garantir que o Workflow B entregue uma base perfeita para o Motor RH.

---

# Resultado esperado

Ao final desta fase desejo receber:

1. Relatório Executivo E2E do Workflow B.

2. Lista completa de problemas encontrados.

3. Classificação:

- 🔴 Crítico
- 🟡 Médio
- 🟢 Baixo

4. Evidências técnicas.

5. Fluxograma atualizado do pipeline.

6. Plano de correção priorizado.

7. Somente após todas as correções e revalidação completa, declarar o Workflow B como HOMOLOGADO.

Somente então avançaremos para a próxima fase:

**FASE 07 — Homologação do Motor RH (Banco de Horas, Tolerâncias, Horas Extras, Faltas, Adicionais, Saldo e Reprocessamento).**