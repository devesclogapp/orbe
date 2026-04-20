import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { AIService } from "@/services/base.service";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const seed: Msg[] = [
  {
    role: "assistant",
    content:
      "Olá! Sou seu assistente operacional. Posso ajudar a identificar inconsistências, sugerir vínculos de ponto/operação e responder dúvidas sobre o processamento do dia.",
  },
];

export const AIChat = () => {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>(seed);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, typing]);

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    setMsgs((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setTyping(true);

    try {
      // In a real scenario, we would use a more sophisticated AI agent here.
      // For now, we use the processDay RPC as a placeholder for AI operations processing.
      const response = await AIService.processDay(new Date().toISOString().split('T')[0], "");

      setMsgs((m) => [...m, {
        role: "assistant",
        content: `Processamento do dia concluído com base na sua solicitação. Resumo: ${response?.message || 'Sistema operando com dados reais do Supabase.'}`
      }]);
    } catch (error) {
      setMsgs((m) => [...m, { role: "assistant", content: "Desculpe, tive um problema ao acessar os dados reais agora. Por favor, tente novamente em instantes." }]);
    } finally {
      setTyping(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Abrir assistente IA"
        className={cn(
          "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center transition-transform hover:scale-105",
          open && "scale-95"
        )}
        style={{ boxShadow: "0 10px 30px hsl(var(--primary) / 0.35)" }}
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-8rem)] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          <header className="px-4 py-3 border-b border-border flex items-center gap-2 bg-card">
            <div className="h-8 w-8 rounded-full bg-primary-soft flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="leading-tight flex-1">
              <div className="font-display font-semibold text-sm text-foreground">Assistente IA</div>
              <div className="text-[11px] text-muted-foreground">ESC LOG · Operacional</div>
            </div>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {msgs.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                  m.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
                )}
              >
                {m.content}
              </div>
            ))}
            {typing && (
              <div className="bg-muted text-muted-foreground max-w-[60%] rounded-2xl rounded-bl-sm px-3 py-2 text-sm">
                <span className="inline-flex gap-1">
                  <Dot /> <Dot delay="0.15s" /> <Dot delay="0.3s" />
                </span>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-border flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Pergunte sobre o dia..."
              className="flex-1 h-9 px-3 rounded-md bg-background border border-input text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button size="sm" onClick={send} className="h-9 w-9 p-0">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

const Dot = ({ delay = "0s" }: { delay?: string }) => (
  <span
    className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce"
    style={{ animationDelay: delay }}
  />
);
