import sys
import re

def update_file(filename, fallback):
    content = open(filename, 'r', encoding='utf-8').read()
    if 'useContextualReturn' not in content:
        content = content.replace('import { useNavigate } from "react-router-dom";', 'import { useNavigate } from "react-router-dom";\nimport { useContextualReturn } from "@/hooks/useContextualReturn";')
        content = re.sub(r'const navigate = useNavigate\(\);', f'const navigate = useNavigate();\n  const {{ goBackUrl }} = useContextualReturn("{fallback}");', content, count=1)
    
    # Replace all navigate("/producao") with goBackUrl()
    content = content.replace('navigate("/producao")', 'goBackUrl()')
    open(filename, 'w', encoding='utf-8').write(content)

update_file('src/pages/Producao/DiaristasLancamento.tsx', '/operacional/diaristas')
update_file('src/pages/Producao/CustosExtrasLancamento.tsx', '/operacional/custos-extras')
update_file('src/pages/Producao/ServicosExtrasLancamento.tsx', '/operacional/servicos-extras')
update_file('src/pages/Producao/ServicosEspecificosLancamento.tsx', '/producao')
print('Done!')
