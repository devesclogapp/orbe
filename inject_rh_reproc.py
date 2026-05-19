# -*- coding: utf-8 -*-
import sys
import os

path = r'y:\2026\ERP ESC LOG\Orbe\src\pages\BancoHoras\ProcessamentoRH.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Envolver handleReprocessarColaborador
action_target = """  const handleReprocessarColaborador = async () => {
    if (!tenantId || !selectedColaborador?.colaborador_id) return;

    setIsReprocessingIndividual(true);
    try {"""

action_replacement = """  const handleReprocessarColaborador = async (forcedJustificativa?: string) => {
    if (!tenantId || !selectedColaborador?.colaborador_id) return;

    if (isPeriodoFechado && !forcedJustificativa) {
        return requiresAdminJustification(
            async (j) => handleReprocessarColaborador(j),
            "Reprocessar Lançamentos (Período Fechado)",
            "reprocessamento_colaborador"
        );
    }

    setIsReprocessingIndividual(true);
    try {"""

content = content.replace(action_target, action_replacement)

# Update log tracking 
log_target = """        executionType: "manual",
      });

      await invalidateRhQueries();"""

log_replacement = """        executionType: forcedJustificativa ? "override_admin" as any : "manual",
      });

      await invalidateRhQueries();"""

content = content.replace(log_target, log_replacement)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Admin Justification logic injected into reproc")
