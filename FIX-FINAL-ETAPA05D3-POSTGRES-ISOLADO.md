# ERP ORBE — FIX-FINAL / ETAPA 05D.3
# Provisionamento e Homologação do PostgreSQL 17.5 Isolado

> **Data de Emissão:** 12/10/2026  
> **Responsável:** Antigravity Pairing Agent  
> **Status:** Cluster Local Inicializado e Validado com Sucesso (Pronto para Receber o Schema da Etapa 05D.4)  
> **Isolamento:** 100% Local (Bind estrito em `127.0.0.1:54322`, Zero exposição externa, Zero conexão com nuvem, Zero credenciais expostas)  

---

## 1. RESUMO EXECUTIVO

Em conformidade com a autorização para utilização do **PostgreSQL 17.5 nativo no Windows**, o cluster de homologação foi criado e iniciado com total independência da pilha WSL/Docker e sem interferir em qualquer serviço existente no sistema:

1. **Auditoria Prévia de Serviços:** Confirmou-se a ausência de instâncias PostgreSQL ativas, serviços pré-existentes ou diretórios de dados prévios em `C:\pgsql` (que continha estritamente os binários limpos da instalação).
2. **Criação do Cluster:** O cluster foi gerado com `initdb.exe` em diretório de dados exclusivo e isolado (`scratch/hml_pg17_data`), com codificação `UTF-8`, locale `C` e criptografia de senha `scram-sha-256`.
3. **Restrição de Rede e Porta:** O arquivo `postgresql.conf` foi configurado com `listen_addresses = '127.0.0.1'` e `port = 54322`. O arquivo `pg_hba.conf` restringe o tráfego a conexões locais de loopback (`127.0.0.1/32`).
4. **Verificação de Saúde (`pg_isready`):** O comando `pg_isready -h 127.0.0.1 -p 54322` retornou `127.0.0.1:54322 - aceitando conexões` (código de saída 0).
5. **Consulta de Leitura:** Executou-se `SELECT version(), current_database(), current_user, now();` com sucesso absoluto, confirmando o funcionamento do motor PostgreSQL 17.5.
6. **Preservação de Escopo:** Nenhuma migration de negócio foi aplicada, nenhum seed foi carregado, nenhum arquivo do repositório foi alterado e nenhuma credencial foi exibida.

---

## 2. EVIDÊNCIAS DE INICIALIZAÇÃO E TESTES DE CONECTIVIDADE

### 2.1 Teste de Disponibilidade (`pg_isready`)
```text
Comando: C:\pgsql\bin\pg_isready.exe -h 127.0.0.1 -p 54322
Código de saída: 0
Saída: 127.0.0.1:54322 - aceitando conexões
```

### 2.2 Consulta SQL de Leitura (`SELECT version()`)
```sql
SELECT version(), current_database(), current_user, now();
```
**Resultado Obtido:**
```text
                                 version                                 | current_database | current_user |              now              
-------------------------------------------------------------------------+------------------+--------------+-------------------------------
 PostgreSQL 17.5 on x86_64-windows, compiled by msvc-19.43.34808, 64-bit | postgres         | postgres     | 2026-10-12 15:23:13.490976-03
(1 linha)
```

### 2.3 Registro de Inicialização do Servidor (`postgres.exe`)
```text
LOG:  starting PostgreSQL 17.5 on x86_64-windows, compiled by msvc-19.43.34808, 64-bit
LOG:  listening on IPv4 address "127.0.0.1", port 54322
LOG:  database system is ready to accept connections
```

---

## 3. PARÂMETROS DO AMBIENTE ISOLADO

| Parâmetro | Configuração Aplicada | Garantia de Governança |
| :--- | :--- | :--- |
| **Engine / Versão** | PostgreSQL 17.5 64-bit (Nativo Windows) | Mesma versão principal do Supabase Oficial (`Postgres 17`) |
| **Porta de Conexão** | `54322` | Porta canônica do Supabase local (100% isolada da porta padrão 5432) |
| **Endereço de Escuta** | `127.0.0.1` | Proibição absoluta de tráfego de interfaces de rede externa |
| **Diretório de Dados** | `scratch/hml_pg17_data` | Pasta efêmera e isolada fora do controle de versão Git |
| **Autenticação Local** | `scram-sha-256` | Criptografia moderna e segura para credenciais locais |
| **Banco Padrão** | `postgres` | Cluster limpo sem objetos residuais de homologações anteriores |
| **Arquivos do Projeto** | `INTACTOS` | `.env.local`, `supabase/config.toml` e migrations legadas inalterados |

---

## 4. RECURSOS ADICIONAIS NECESSÁRIOS PARA A PRÓXIMA ETAPA (05D.4)

Para que a **Migration 05B** e os **14 cenários de homologação** sejam executados na próxima etapa com suporte integral a Auth, RLS e PostgREST:

1. **Schema de Autenticação (`auth`):**
   - Criação dos stubs oficiais do Supabase (`auth.uid()`, `auth.role()`).
2. **Papéis do Banco (Roles de Permissão):**
   - Criação dos papéis `anon`, `authenticated` e `service_role`.
   - Concessão de permissões de execução aos papéis conforme o contrato do Supabase.
3. **Estrutura Base Canônica dos Intermitentes:**
   - Criação das tabelas do domínio (`tenants`, `empresas`, `profiles`, `colaboradores`, `intermitentes_lotes_fechamento`, `lancamentos_intermitentes`, `cnab_remessas_arquivos`, `audit_log`).
   - Funções utilitárias de contexto (`get_user_role()`, `current_tenant_id()`).

---

## 5. CONCLUSÃO E PRÓXIMOS PASSOS

O ambiente PostgreSQL 17.5 está **100% ativo, estável e operacional** na porta `54322`, aguardando autorização do operador para:
- **Etapa 05D.4:** Preparação do Schema Base dos Intermitentes, stubs de autenticação e papéis.
- **Etapa 05D.5:** Aplicação da Migration 05B e carga do Seed Sintético da Etapa 05C.
- **Etapa 05D.6:** Execução da bateria automatizada dos 14 cenários de teste de segurança e integridade.

> **Ação atual:** Cluster ativo em background. Nenhuma alteração foi realizada em arquivos do repositório ou no banco de produção. Aguardando autorização para avançar para a Etapa 05D.4.
