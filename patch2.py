import sys
content = open('src/pages/Inconsistencias.tsx', 'r', encoding='utf-8').read()
content = content.replace('const Inconsistencias = () => {', 'const Inconsistencias = ({ flowType, lockedFlow }: { flowType?: string; lockedFlow?: boolean } = {}) => {')
open('src/pages/Inconsistencias.tsx', 'w', encoding='utf-8').write(content)
print('Done!')
