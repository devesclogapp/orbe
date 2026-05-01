Perfeito — isso é essencial pra deixar o sistema escalável e não engessado 👇

Adicione este bloco ao seu prompt no Antigravity:

````md
# 17. REGRAS OPERACIONAIS — CÁLCULO DE DIARISTAS

## Objetivo

Centralizar e padronizar as regras de cálculo de diaristas para que o sistema não dependa de lógica fixa no código.

As marcações como `P` e `MP` devem ser interpretadas com base em regras configuráveis.

---

# 17.1 Estrutura de Regras

Criar uma entidade/tabela:

```txt
operational_rules
````

## Campos:

```txt
id
empresa_id
tipo_regra = diarista
codigo = P | MP | OUTROS
descricao
multiplicador
ativo (boolean)
created_at
updated_at
```

---

# 17.2 Regras padrão (seed inicial)

Cadastrar automaticamente:

```txt
Código: P
Descrição: Diária completa
Multiplicador: 1.0

Código: MP
Descrição: Meia diária
Multiplicador: 0.5
```

---

# 17.3 Regra de cálculo

O cálculo NÃO deve ser fixo.

Deve seguir a lógica:

```txt
valor_calculado = valor_diaria_base * multiplicador_regra
```

Exemplo:

```txt
Valor base: R$ 120,00

P  → 120 * 1.0 = R$ 120,00
MP → 120 * 0.5 = R$ 60,00
```

---

# 17.4 Integração com tela do Carlos

Na tela `/producao/diaristas`:

* Os botões (P, MP, etc.) devem ser carregados dinamicamente da tabela `operational_rules`
* Apenas regras ativas devem aparecer
* O sistema não deve depender de valores hardcoded

---

# 17.5 Flexibilidade futura

Permitir que o RH/Admin possa criar novas regras, como:

```txt
Código: HE
Descrição: Hora extra 100%
Multiplicador: 1.5

Código: HE50
Descrição: Hora extra 50%
Multiplicador: 1.25
```

---

# 17.6 Tela de gestão de regras

Criar tela:

```txt
/rh/regras-operacionais
```

Funcionalidades:

```txt
Criar regra
Editar regra
Ativar/Inativar regra
Definir multiplicador
Definir descrição
```

---

# 17.7 Segurança

* Apenas RH e Admin podem alterar regras
* Carlos apenas consome as regras (não pode editar)

---

# 17.8 Resultado esperado

```txt
As marcações P, MP e futuras variações não ficam fixas no sistema.
O cálculo é dinâmico e controlado por regras operacionais.
O ERP se torna flexível para mudanças sem necessidade de código.
```

```

Isso resolve um problema crítico: você não fica preso em “P = 1 e MP = 0.5” para sempre.

Se quiser, no próximo passo eu posso te montar **a modelagem completa do banco (SQL + relacionamentos)** já pronta pra Supabase com tudo isso integrado.
```
