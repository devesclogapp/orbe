# Checklist de Homologação E2E Intermitentes (Checkpoint 01)

Este checklist evidencia e rastreia ponto a ponto todas as confirmações requeridas na triagem de entrada operacionada.

### WORKFLOW A (TIO → Cadastro de Intermitentes → ORBE)
- [x] Autenticação válida
- [x] Busca dos colaboradores executada com sucesso
- [x] Pré-cadastro preenchido automaticamente
- [x] Empresa importada corretamente (sem inconsistências visuais)
- [x] Departamento associado devidamente
- [x] CPF conferido e sanitizado
- [x] Matrícula validada
- [x] Cargo (Intermitente) tipificado adequadamente
- [x] Idempotência comprovada (nenhum CPF criado em duplicidade)
- [x] Atualização de registro contínua operante
- [x] Ausência total de registros/matrículas duplicadas

### WORKFLOW B (TIO → Relatório XLSX → ORBE)
- [x] Autenticação da requisição
- [x] Listagem integral de convocações
- [x] Geração e download do relatório XLSX confirmados
- [x] Leitura e parse dos blocos de dados
- [x] Processamento seguro (nenhum type/cast exception)
- [x] Envio para a Edge Function do ORBE executada sem erro
- [x] Tracking de log executivo validado no Orbe
- [x] Idempotência comprovada

### VALIDAÇÃO DA TELA "INTERMITENTES RECEBIDOS"
- [x] Informação de Empresa / Departamento estão fiéis à folha
- [x] Listagem de Colaboradores e Cargos exatos
- [x] Vínculo correto de Convocações
- [x] Horas Trabalhadas: 76h52 coincidente
- [x] Horas Normais: 76h52 coincidente
- [x] HE 50% zeradas (conforme o teste reportou)
- [x] HE 100% zeradas (conforme o teste reportou)
- [x] Hora Noturna zeradas
- [x] Valor total individual / grupo somado é garantidor: R$ 715,90

### AÇÕES NEGATIVAS CUMPRIDAS RIGOROSAMENTE (NÃO FEITAS)
- [x] Não houve clique em "Fechar Período Intermitente"
- [x] Não houve aprovação de lote no RH
- [x] Não houve aprovação de lote no Financeiro
- [x] Cnab, Conciliação, Retornos intocáveis nesta rodada
