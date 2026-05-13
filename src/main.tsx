import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

console.log("[Main] Iniciando renderização...");

try {
  createRoot(document.getElementById("root")!).render(<App />);
  console.log("[Main] Renderização disparada.");
} catch (e) {
  console.error("[Main] Erro fatal no render:", e);
  document.body.innerHTML = `<div style="padding: 20px; color: red;">Erro fatal: ${e}</div>`;
}

