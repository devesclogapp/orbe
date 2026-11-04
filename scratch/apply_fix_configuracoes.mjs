import fs from 'fs';

let content = fs.readFileSync('src/pages/Configuracoes.tsx', 'utf8');

const targetImport = `import { useAuth } from "@/contexts/AuthContext";`.replace(/\n/g, '\r\n');
const replaceImport = `import { useAuth } from "@/contexts/AuthContext";
import { useAccessControl } from "@/contexts/AccessControlContext";
import { getAccessDeniedFallbackRoute } from "@/lib/access-control";`.replace(/\n/g, '\r\n');

if (!content.includes(targetImport)) throw new Error("targetImport not found in Configuracoes.tsx");
content = content.replace(targetImport, replaceImport);

const targetComponent = `const Configuracoes = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryTab = searchParams.get("tab");
  const queryClient = useQueryClient();
  const { theme, setTheme, defaultTab, setDefaultTab } = usePreferences();
  const { user, updateProfile } = useAuth();`.replace(/\n/g, '\r\n');

const replaceComponent = `const Configuracoes = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryTab = searchParams.get("tab");
  const queryClient = useQueryClient();
  const { theme, setTheme, defaultTab, setDefaultTab } = usePreferences();
  const { user, updateProfile } = useAuth();
  const { role, canAccess } = useAccessControl();

  // Proteção de segurança estrita em nível de página (Fail-Closed)
  useEffect(() => {
    if (role && role !== "admin" && !canAccess("governanca", "ver")) {
      navigate(getAccessDeniedFallbackRoute(role), { replace: true });
    }
  }, [role, canAccess, navigate]);

  if (role && role !== "admin" && !canAccess("governanca", "ver")) {
    return null;
  }`.replace(/\n/g, '\r\n');

if (!content.includes(targetComponent)) throw new Error("targetComponent not found in Configuracoes.tsx");
content = content.replace(targetComponent, replaceComponent);

fs.writeFileSync('src/pages/Configuracoes.tsx', content, 'utf8');
console.log("Successfully updated src/pages/Configuracoes.tsx");

