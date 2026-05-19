# -*- coding: utf-8 -*-
import sys
import os

path = r'y:\2026\ERP ESC LOG\Orbe\src\services\rhProcessing.service.ts'
if not os.path.exists(path):
    print(f"File not found: {path}")
    sys.exit(1)

with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

found = False
for i in range(len(lines)):
    if 'toUpperCase() === \\DIARISTA\\)' in lines[i]:
        lines[i] = '  if (String(colaborador.tipo_colaborador ?? "").trim().toUpperCase() === "DIARISTA") {\n'
        if i + 1 < len(lines) and 'motivos.push(\\Diaristas nao participam' in lines[i+1]:
            lines[i+1] = '    motivos.push("Diaristas não participam do Banco de Horas CLT");\n'
        if i + 2 < len(lines) and lines[i+2].strip() == '}':
            # Skip closing brace if it's already there or fix it
            pass
        found = True
        print(f"Fixed line {i+1}")

if found:
    with open(path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("File saved successfully")
else:
    print("Broken lines not found. Checking exact content...")
    # Try a more broad search
    for i, line in enumerate(lines):
        if 'tipo_colaborador' in line and (r'\\' in line or r'\"' in line):
             print(f"Potential match at line {i+1}: {repr(line)}")
