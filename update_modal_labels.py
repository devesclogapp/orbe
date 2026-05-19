# -*- coding: utf-8 -*-
import sys
import os

path = r'y:\2026\ERP ESC LOG\Orbe\src\components\layout\OperationalPipelineModal.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Update PipelineStepRow logic
content = content.replace('const isPending = step.status === "pending" || step.status === "blocked";', 
                          'const isPending = step.status === "pending";\n    const isBlocked = step.status === "blocked";\n    const isDevolved = step.status === "devolved";\n    const isCanceled = step.status === "canceled";')

# Update Labels/Badges in PipelineStepRow
old_badges = """                        {isPending && (
                            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-border">
                                Pendente
                            </span>
                        )}"""

new_badges = """                        {isPending && (
                            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-border">
                                Pendente
                            </span>
                        )}
                        {isBlocked && (
                            <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 border border-red-200">
                                Bloqueado
                            </span>
                        )}
                        {isDevolved && (
                            <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700 border border-orange-200">
                                Devolvido
                            </span>
                        )}
                        {isCanceled && (
                            <span className="inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-700 border border-gray-300">
                                Cancelado
                            </span>
                        )}"""

content = content.replace(old_badges, new_badges)

# Update Text colors as well
content = content.replace('isPending && "text-muted-foreground",', 
                          'isPending && "text-muted-foreground",\n                                isBlocked && "text-red-600",\n                                isDevolved && "text-orange-600",\n                                isCanceled && "text-gray-500",')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("PipelineStepRow labels updated successfully")
