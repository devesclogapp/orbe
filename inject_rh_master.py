# -*- coding: utf-8 -*-
import sys
import os

path = r'y:\2026\ERP ESC LOG\Orbe\src\pages\BancoHoras\ProcessamentoRH.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Envolver processarPontos
action_target_1 = """  const processarPontos = async () => {
    if (!tenantId) {
      toast.error("Tenant não identificado");
      return;
    }

    setIsProcessing(true);
    setProcessingResult(null);

    try {"""

action_replacement_1 = """  const processarPontos = async (forcedJustificativa?: string) => {
    if (!tenantId) {
      toast.error("Tenant não identificado");
      return;
    }

    if (isPeriodoFechado && !forcedJustificativa) {
        return requiresAdminJustification(
            async (j) => processarPontos(j),
            "Processar Pendentes (Período Fechado)",
            "processamento_periodo"
        );
    }

    setIsProcessing(true);
    setProcessingResult(null);

    try {"""

content = content.replace(action_target_1, action_replacement_1)

# 2. Envolver reprocessarPontos
action_target_2 = """  const reprocessarPontos = async () => {
    if (!tenantId) {
      toast.error("Tenant não identificado");
      return;
    }

    setIsProcessing(true);
    setProcessingResult(null);

    try {"""

action_replacement_2 = """  const reprocessarPontos = async (forcedJustificativa?: string) => {
    if (!tenantId) {
      toast.error("Tenant não identificado");
      return;
    }

    if (isPeriodoFechado && !forcedJustificativa) {
        return requiresAdminJustification(
            async (j) => reprocessarPontos(j),
            "Reprocessar Período Completo (ATENÇÃO)",
            "reprocessamento_periodo"
        );
    }

    setIsProcessing(true);
    setProcessingResult(null);

    try {"""

content = content.replace(action_target_2, action_replacement_2)


with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Admin Justification logic injected into master processes")
