# Varredura de opções consolidadas e não aptas à personalização

Data: 2026-05-06  
Escopo: frontend + backend  
Objetivo: identificar pontos hoje fixos em código ou acoplados a estrutura rígida, dificultando updates e personalização por usuário, tenant ou perfil.

## Resumo executivo

O projeto já possui alguns blocos que caminham para personalização real via banco, especialmente em regras operacionais dinâmicas e layouts de exportação. Mesmo assim, ainda existem áreas estratégicas onde a aplicação depende de listas, papéis, fluxos, menus e parâmetros consolidados no frontend e/ou no schema do backend.

Os principais gargalos encontrados estão em:

- governança de perfis, convites e permissões;
- navegação e estrutura do produto;
- preferências do usuário persistidas apenas em `localStorage`;
- parâmetros financeiros/bancários com layout fixo;
- onboarding e fluxos orientados por etapas rígidas;
- regras operacionais parcialmente dinâmicas, mas ainda com escolhas-base fixadas em código.

## Critérios de classificação

- `Crítico`: trava evolução do produto, multiplica custo de manutenção ou exige deploy/migration para mudanças frequentes de negócio.
- `Médio`: já funciona, mas dificulta expansão, white-label, segmentação por tenant ou governança fina.
- `Regular`: impacto menor, porém ainda representa rigidez desnecessária para updates futuros.

## Pontos críticos

### 1. Perfis, módulos e ações de permissão estão fixos no frontend

Impacto: qualquer novo módulo, ação ou combinação de acesso exige alteração manual de código, além de criar risco de divergência entre UI e backend.

Evidências:

- `src/pages/Governanca/Perfis.tsx:78` define `modules` como lista estática.
- `src/pages/Governanca/Perfis.tsx:90` define `actions` como lista estática.
- `src/pages/Governanca/Perfis.tsx:104` e `:131` tratam `admin` como papel especial hardcoded.

Problema estrutural:

- o cadastro de perfis existe no backend, mas a malha de permissões exibida na UI continua codificada;
- não há catálogo dinâmico de módulos/ações vindo do banco;
- o lock do perfil `admin` está decidido em frontend.

Necessidade para update:

- `backend`: tabela de catálogo de permissões por módulo/ação + vínculo com perfis;
- `frontend`: tela de perfis lendo catálogo e regras do backend em vez de arrays locais.

### 2. Papéis de convite e expiração estão rígidos em frontend e backend

Impacto: expansão de papéis, criação de papéis por tenant ou alteração do SLA do convite depende de código e migration.

Evidências:

- `src/pages/Governanca/Usuarios.tsx:135-139` mapeia papéis fixos.
- `src/pages/Governanca/Usuarios.tsx:563-567` fixa as opções de perfil no select.
- `src/pages/Governanca/Usuarios.tsx:576` e `:609` comunicam expiração fixa de `7 dias`.
- `supabase/migrations/20260505020000_tenant_invitations.sql:6` limita `role` a `admin`, `rh`, `financeiro`, `encarregado`, `user`.
- `supabase/migrations/20260505020000_tenant_invitations.sql:10` fixa `expires_at` com `INTERVAL '7 days'`.

Problema estrutural:

- o frontend e o banco repetem a mesma enumeração;
- qualquer papel novo precisa ser alterado em dois lados;
- o prazo do convite não é configurável por tenant, ambiente ou política interna.

Necessidade para update:

- `backend`: catálogo de papéis e política de expiração parametrizável;
- `frontend`: popular o seletor a partir do backend e ler metadados do convite.

### 3. Navegação principal, seções e metadados de rota estão codificados

Impacto: menu, agrupamentos, breadcrumbs e nome comercial das áreas não podem ser customizados por tenant, perfil, rollout ou edição operacional sem deploy.

Evidências:

- `src/components/layout/Sidebar.tsx:8-46` define todas as seções do menu via arrays fixos.
- `src/components/layout/Sidebar.tsx:147` fixa a assinatura `v4.1 — Navegação por Objetivos`.
- `src/components/layout/navigationMeta.ts:11-56` mantém o catálogo de rotas, labels, seções e pais em lista estática.

Problema estrutural:

- arquitetura de navegação não é data-driven;
- labels e agrupamentos não acompanham perfis, tenants ou feature flags;
- o sistema de menu e breadcrumbs depende de duplicação manual.

Necessidade para update:

- `backend`: catálogo de navegação/feature flags por perfil ou tenant;
- `frontend`: renderização por configuração remota, não por arrays locais.

### 4. Geração CNAB usa layout e semântica bancária consolidados em código

Impacto: alto risco de retrabalho por banco, convênio, layout, carteira ou finalidade. É um ponto sensível para operação real.

Evidências:

- `src/utils/cnab240.ts:98-100` fixa `BANCO_CODIGO_HEADER`, `VERSAO_LAYOUT_ARQUIVO` e `VERSAO_LAYOUT_LOTE`.
- `src/utils/cnab240.ts:169` fixa `SICREDI PAGAMENTOS`.
- `src/utils/cnab240.ts:215` fixa `PAGAMENTO DIARISTAS`.
- `src/utils/cnab240.ts:261-262` fixa moeda `BRL`.
- `src/utils/cnab240.ts:281` fixa finalidade `00045`.
- `src/utils/cnab240.ts:80` limita `tipo_conta` a `corrente` e `poupanca`.

Problema estrutural:

- a base aceita exportação bancária, mas o motor não foi desenhado para múltiplos layouts;
- faltam parâmetros por tenant/conta pagadora/banco;
- updates regulatórios ou comerciais exigem editar função utilitária.

Necessidade para update:

- `backend`: tabela de layouts bancários, finalidade, convênio, banco padrão e regras de geração;
- `frontend`: gestão dessas configurações por tenant;
- `serviço`: gerador orientado por configuração.

## Pontos médios

### 5. Preferências do usuário são locais e limitadas a opções fechadas

Impacto: personalização não acompanha login, dispositivo, tenant ou governança central.

Evidências:

- `src/contexts/PreferencesContext.tsx:4` limita `DefaultTab` a `ponto | operacoes`.
- `src/contexts/PreferencesContext.tsx:16-17` usa chaves fixas de `localStorage`.
- `src/contexts/PreferencesContext.tsx:22-37` persiste preferências somente no navegador.
- `src/pages/Configuracoes.tsx:280-290` oferece apenas duas abas padrão.

Problema estrutural:

- preferências não ficam no backend;
- não existe catálogo expansível de landing page por perfil;
- perda de configuração ao trocar máquina/navegador.

Necessidade para update:

- `backend`: persistência de preferências por usuário;
- `frontend`: opções carregadas do backend, com fallback local.

### 6. Parâmetros gerais da tela de configurações têm listas fixas

Impacto: moeda, fuso, arredondamento e roadmap de segurança não são adaptáveis sem alteração de tela.

Evidências:

- `src/pages/Configuracoes.tsx:410-420` fixa moedas e fusos disponíveis.
- `src/pages/Configuracoes.tsx:445-448` fixa opções de arredondamento financeiro.
- `src/pages/Configuracoes.tsx:552` mostra 2FA apenas como placeholder, sem estrutura parametrizável.

Problema estrutural:

- parte do formulário salva em backend, mas as opções-base continuam fixas no frontend;
- a tabela/configuração não parece governar o catálogo dessas escolhas.

Necessidade para update:

- `backend`: catálogo para moeda, timezone, políticas operacionais e segurança;
- `frontend`: inputs dirigidos por configuração.

### 7. Onboarding é rígido em etapas e semântica de negócio

Impacto: difícil adaptar onboarding por segmento, plano, tenant ou maturidade operacional.

Evidências:

- `src/contexts/OnboardingContext.tsx:27-94` define etapas fixas em `ONBOARDING_STEPS`.
- `src/contexts/OnboardingContext.tsx:159` amarra cliente a `transportadora`.
- `src/contexts/OnboardingContext.tsx:183` mantém compatibilidade tratando `transportadora` como `cliente`.
- `src/contexts/OnboardingContext.tsx:277-316` decide avanço por lógica fixa em código.

Problema estrutural:

- fluxo depende de uma visão única de implantação;
- semântica de “cliente” não é realmente configurável;
- tenants com processos diferentes não conseguem adaptar a jornada.

Necessidade para update:

- `backend`: definição de etapas, regras de conclusão e labels por tenant/plano;
- `frontend`: interpretação da jornada a partir de configuração.

### 8. Regras operacionais evoluíram, mas ainda têm eixos-base hardcoded

Impacto: o motor é parcialmente dinâmico, porém o modelo mental ainda é fixado no frontend.

Evidências:

- `src/pages/RegrasOperacionais.tsx:123` fixa `TIPOS_CALCULO`.
- `src/pages/RegrasOperacionais.tsx:130` fixa `STATUS_OPTIONS`.
- `src/pages/RegrasOperacionais.tsx:2148-2154` fixa modos de vínculo.
- `src/pages/RegrasOperacionais.tsx:2226` renderiza cálculos a partir de constante local.
- `src/pages/RegrasOperacionais.tsx:2364` renderiza status a partir de constante local.

Leitura importante:

- há avanço real no backend com `regras_modulos`, `regras_campos` e `regras_dados` em `src/services/base.service.ts`;
- mesmo assim, o núcleo operacional principal ainda preserva listas-base estáticas que limitam personalização total.

Necessidade para update:

- `backend`: catálogo de tipos de cálculo, status operacionais e modos de vínculo;
- `frontend`: consumir esses catálogos em vez de constantes.

## Pontos regulares

### 9. Editor de layout de exportação ainda restringe formato e status

Impacto: já existe cadastro de layout, mas a personalização é parcial.

Evidências:

- `src/components/modals/LayoutEditorModal.tsx` inicia layout com `tipo: 'csv'` e `status: 'ativo'`.
- o modal limita formato a `csv` e `excel`.

Problema estrutural:

- o conceito de layout é customizável;
- porém o catálogo de formatos, status e possivelmente destinos ainda não é administrável.

Necessidade para update:

- `backend`: catálogo de formatos/status/destinos;
- `frontend`: trocar `select` fixo por opções vindas do banco.

### 10. Labels e mensagens de produto estão consolidados na interface

Impacto: reduz capacidade de white-label, regionalização e ajustes finos de comunicação.

Evidências:

- `src/components/layout/Sidebar.tsx:147` fixa versão/assinatura de navegação.
- `src/pages/Governanca/Perfis.tsx:186` e `:244` usam textos específicos de governança.
- `src/pages/Governanca/Usuarios.tsx` incorpora mensagens operacionais e texto de WhatsApp fixos.

Necessidade para update:

- camada de conteúdo/configuração institucional;
- eventual tabela de textos por tenant ou arquivo de i18n parametrizado.

## Áreas que já mostram boa base para personalização

- regras dinâmicas via `regras_modulos`, `regras_campos` e `regras_dados`;
- cadastros operacionais em tabelas de configuração;
- layouts de exportação persistidos em `relatorios_layouts_exportacao`.

Essas áreas são bons candidatos para servir de padrão arquitetural para as demais.

## Priorização recomendada de update

### Onda 1

- catálogo de papéis + permissões dinâmicas;
- convites com papel e expiração parametrizáveis;
- navegação e catálogo de módulos orientados por configuração.

### Onda 2

- preferências persistidas no backend;
- parâmetros gerais com catálogos reais;
- onboarding parametrizável.

### Onda 3

- motor CNAB multi-layout por tenant/banco;
- normalização dos catálogos operacionais ainda fixos;
- abertura total de formatos/status em layouts de exportação.

## Conclusão

Hoje o sistema já tem sinais de arquitetura configurável, mas ainda convive com um bloco relevante de decisões consolidadas em código, principalmente em governança, navegação, onboarding e financeiro bancário.

Se o objetivo é preparar o produto para updates mais rápidos, customização por tenant e menor dependência de deploy, os pontos críticos acima devem entrar primeiro no backlog estrutural.

## Observações da varredura

- análise feita por leitura de código e migrations, sem validação runtime end-to-end;
- o repositório não permitiu leitura de `git status` por `dubious ownership`, então o diagnóstico foi baseado diretamente no conteúdo dos arquivos.
