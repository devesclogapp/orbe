import fs from 'fs';

let content = fs.readFileSync('src/pages/Colaboradores.tsx', 'utf8');

// 1. Import useAccessControl if not already present
if (!content.includes('useAccessControl')) {
  const targetImport = `import { useOnboardingCallback } from "@/hooks/useOnboardingCallback";`.replace(/\n/g, '\r\n');
  const replaceImport = `import { useOnboardingCallback } from "@/hooks/useOnboardingCallback";
import { useAccessControl } from "@/contexts/AccessControlContext";`.replace(/\n/g, '\r\n');

  if (!content.includes(targetImport)) throw new Error("targetImport not found in Colaboradores.tsx");
  content = content.replace(targetImport, replaceImport);
}

// 2. Component variables
const targetComponent = `  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();`.replace(/\n/g, '\r\n');

const replaceComponent = `  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { role, canAccess } = useAccessControl();

  const canAccessCentralCadastros = role === "admin" || canAccess("central_de_cadastros", "ver");
  const canCreateColaborador = role === "admin" || canAccess("central_de_cadastros", "criar") || role === "rh";
  const canDeleteColaborador = role === "admin" || canAccess("central_de_cadastros", "excluir");`.replace(/\n/g, '\r\n');

if (!content.includes(targetComponent)) throw new Error("targetComponent not found in Colaboradores.tsx");
content = content.replace(targetComponent, replaceComponent);

// 3. Central de Cadastros button
const targetBtn = `            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs font-medium gap-1.5"
                onClick={() => navigate("/cadastros?tab=colaboradores")}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Central de Cadastros
              </Button>`.replace(/\n/g, '\r\n');

const replaceBtn = `            <div className="flex flex-wrap items-center gap-2">
              {canAccessCentralCadastros && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-medium gap-1.5"
                  onClick={() => navigate("/cadastros?tab=colaboradores")}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Central de Cadastros
                </Button>
              )}`.replace(/\n/g, '\r\n');

if (!content.includes(targetBtn)) throw new Error("targetBtn not found in Colaboradores.tsx");
content = content.replace(targetBtn, replaceBtn);

// 4. Novo Colaborador button
const targetCreateBtn = `              <Button
                size="sm"
                className="h-8 text-xs font-medium gap-1.5 font-display font-semibold"
                onClick={handleCreate}
              >
                <Plus className="h-3.5 w-3.5" /> Novo colaborador
              </Button>`.replace(/\n/g, '\r\n');

const replaceCreateBtn = `              {canCreateColaborador && (
                <Button
                  size="sm"
                  className="h-8 text-xs font-medium gap-1.5 font-display font-semibold"
                  onClick={handleCreate}
                >
                  <Plus className="h-3.5 w-3.5" /> Novo colaborador
                </Button>
              )}`.replace(/\n/g, '\r\n');

if (!content.includes(targetCreateBtn)) throw new Error("targetCreateBtn not found in Colaboradores.tsx");
content = content.replace(targetCreateBtn, replaceCreateBtn);

// 5. Delete button in table
const targetDelete = `                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(c.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>`.replace(/\n/g, '\r\n');

const replaceDelete = `                                {canDeleteColaborador && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(c.id)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}`.replace(/\n/g, '\r\n');

if (!content.includes(targetDelete)) throw new Error("targetDelete not found in Colaboradores.tsx");
content = content.replace(targetDelete, replaceDelete);

fs.writeFileSync('src/pages/Colaboradores.tsx', content, 'utf8');
console.log("Successfully updated src/pages/Colaboradores.tsx");
