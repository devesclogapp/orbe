# -*- coding: utf-8 -*-
import sys
import os

path = r'y:\2026\ERP ESC LOG\Orbe\src\components\layout\OperationalPipelineModal.tsx'
if not os.path.exists(path):
    print(f"File not found: {path}")
    sys.exit(1)

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Define the new StepNode component
new_step_node = """const StepNode = ({ status }: { status: PipelineStepStatus }) => {
    if (status === "done") {
        return (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 shadow-sm">
                <CheckCircle2 className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
            </div>
        );
    }
    if (status === "current") {
        return (
            <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary shadow-sm ring-2 ring-primary/25 ring-offset-1 ring-offset-background">
                <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
                <Circle className="h-2.5 w-2.5 fill-white text-white" />
            </div>
        );
    }
    if (status === "blocked") {
        return (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500 shadow-sm">
                <X className="h-3.5 w-3.5 text-white" />
            </div>
        );
    }
    if (status === "devolved") {
        return (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-500 shadow-sm">
                <Zap className="h-3.5 w-3.5 text-white" />
            </div>
        );
    }
    if (status === "canceled") {
        return (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-800 shadow-sm">
                <X className="h-3.5 w-3.5 text-white" />
            </div>
        );
    }
    return (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-border bg-muted/40">
            <Circle className="h-2 w-2 fill-muted-foreground/30 text-muted-foreground/30" />
        </div>
    );
};"""

# Use a more robust search for the old StepNode
import re
pattern = re.compile(r'const StepNode = \(\{ status \}: \{ status: PipelineStepStatus \}\) => \{.*?^\};', re.DOTALL | re.MULTILINE)

if pattern.search(content):
    new_content = pattern.sub(new_step_node, content)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("StepNode updated successfully")
else:
    print("StepNode component not found using regex")
    # Debug: print first 500 chars to see what's going on
    # print(content[:500])
