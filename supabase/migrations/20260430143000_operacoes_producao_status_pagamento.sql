ALTER TABLE public.operacoes_producao
  ADD COLUMN IF NOT EXISTS status_pagamento TEXT
    CHECK (status_pagamento IN ('PENDENTE', 'ATRASADO', 'RECEBIDO')),
  ADD COLUMN IF NOT EXISTS data_pagamento DATE;

COMMENT ON COLUMN public.operacoes_producao.status_pagamento IS 'Status financeiro real do pagamento operacional.';
COMMENT ON COLUMN public.operacoes_producao.data_pagamento IS 'Data em que o pagamento operacional foi confirmado como recebido.';
