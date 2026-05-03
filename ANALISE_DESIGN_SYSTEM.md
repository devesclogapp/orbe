# 📋 ANÁLISE DE DESIGN SYSTEM — ORBE ERP

## 1. PANORAMA ATUAL

### Login Operacional (`/login/operacional`)
- **Status atual:** Funcional mas básico
- **Problemas identificados:**
  - Fundo com textura (cubos) não segue o design system
  - Cores não estão na paleta ESC LOG
  - Labels muito pequenos (10-11px)
  - Falta feedback visual de foco
  - Sem indicador de segurança claro
  - Botão sem state de hover/active

### Telas Internas (Dashboard, Operações, Pontos)
- **Sidebar:** 240px ✓ (ok)
- **Cores:** precisam de padronização
- **Tipografia:** misturada (falta hierarquia)
- **Cards KPI:** sem padrão ESC LOG
- **Tabelas:** precisam de ajustes
- **Inputs:** necessitam de estados corretos

## 2. AÇÕES DE MELHORIA

### 2.1 Login Operacional
- [ ] Remover textura de fundo
- [ ] Aplicar fundo `#F7F7F7`
- [ ] Centralizar melhor o formulário
- [ ] Labels com padrão (12px, Inter 500)
- [ ] Inputs com estados corretos (foco, erro)
- [ ] Botão com hover/active
- [ ] Indicador discreto de segurança

### 2.2 Sidebar ( interna)
- [ ] Cores conforme Design System
- [ ] Estados corretos
- [ ] Remover cores não autorizadas

### 2.3 Cards KPI
- [ ] Aplicar border-radius 12px
- [ ] Padding 20px
- [ ] Sombra correta
- [ ] Label uppercase 12px
- [ ] Valor Manrope 700 30px

### 2.4 Tabelas
- [ ] Header fundo `#EBEBEB`
- [ ] Hover `#F7F7F7`
- [ ] Linha com erro `#FFF5F3`

### 2.5 Campos de Formulário
- [ ] Altura 40px
- [ ] Border-radius 8px
- [ ] Estado de foco com azul
- [ ] Estado de erro com vermelho

## 3. PRIORIDADES

| Prioridade | Item | Impacto |
|-----------|------|---------|
| Alta | Login operacional | Primeira impressão |
| Alta | Cards KPI | Clareza de dados |
| Média | Tabelas | Principal ferramenta |
| Média | Inputs formulários | Fluilidade |
| Baixa | Sidebar | Já está próximo |

## 4. ARQUIVOS-AÇÃO

- `src/pages/Auth/LoginOperacional.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/ui/*` (inputs, buttons, cards)
- `src/pages/Dashboard.tsx`
- `src/pages/Operacoes.tsx`
- `src/pages/Pontos.tsx`