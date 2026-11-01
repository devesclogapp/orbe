import sys
content = open('src/pages/Rh/AprovacoesRh.tsx', 'r', encoding='utf-8').read()
content = content.replace('export default function AprovacoesRh() {', 'export default function AprovacoesRh({ flowType, lockedFlow }: { flowType?: string; lockedFlow?: boolean } = {}) {')
content = content.replace('const [filterType, setFilterType] = useState<string>(\"all\");', 'const [filterType, setFilterType] = useState<string>(flowType || \"all\");')
content = content.replace('{/* FILTROS TIPO (Pills horizontais) */}\\n                <div className=\"flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide\">', '{/* FILTROS TIPO (Pills horizontais) */}\\n                {!lockedFlow && (\\n                <div className=\"flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide\">')
content = content.replace('                        );\r\\n                    })}\r\\n                </div>\r\\n\r\\n                {/* KPI Grid */}', '                        );\r\\n                    })}\r\\n                </div>\r\\n                )}\r\\n\r\\n                {/* KPI Grid */}')
content = content.replace('                        );\n                    })}\n                </div>\n\n                {/* KPI Grid */}', '                        );\n                    })}\n                </div>\n                )}\n\n                {/* KPI Grid */}')
open('src/pages/Rh/AprovacoesRh.tsx', 'w', encoding='utf-8').write(content)
print('Done!')
