import { useEffect, useState } from "react";

type ToastTone = "success" | "error";

export type AppToast = {
  id: number;
  tone: ToastTone;
  message: string;
  diagnostic?: string;
  durationMs?: number;
} | null;

type ToastViewportProps = {
  toast: AppToast;
  onDismiss: () => void;
};

export function ToastViewport({ toast, onDismiss }: ToastViewportProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

  useEffect(() => {
    setCopyState("idle");
  }, [toast?.id]);

  if (toast === null) {
    return null;
  }

  const role = toast.tone === "error" ? "alert" : "status";
  const hasDiagnostic =
    typeof toast.diagnostic === "string" && toast.diagnostic.length > 0;
  const diagnostic = hasDiagnostic ? toast.diagnostic : null;

  async function handleCopyDiagnostic() {
    if (!diagnostic) {
      return;
    }
    const copied = await copyTextToClipboard(diagnostic);
    setCopyState(copied ? "copied" : "failed");
  }

  return (
    <div className="toast-viewport" role="presentation">
      <div
        aria-atomic="true"
        aria-label={toast.message}
        aria-live={toast.tone === "error" ? "assertive" : "polite"}
        className={`app-toast app-toast--${toast.tone}`}
        role={role}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="app-toast__message">{toast.message}</span>
          {hasDiagnostic ? (
            <span className="text-xs text-muted-foreground">
              Use "Copiar diagnostico" e me envie no chat.
            </span>
          ) : null}
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {hasDiagnostic ? (
            <button
              aria-label="Copiar diagnostico tecnico"
              className="inline-flex h-8 items-center rounded-md border border-border px-2 text-xs font-semibold text-foreground transition hover:bg-accent/70"
              onClick={() => {
                void handleCopyDiagnostic();
              }}
              type="button"
            >
              {copyState === "copied"
                ? "Copiado"
                : copyState === "failed"
                  ? "Falhou"
                  : "Copiar diagnostico"}
            </button>
          ) : null}
          <button
            aria-label="Fechar notificacao"
            className="app-toast__dismiss"
            onClick={onDismiss}
            type="button"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (
    typeof globalThis.navigator !== "undefined" &&
    globalThis.navigator.clipboard &&
    typeof globalThis.navigator.clipboard.writeText === "function"
  ) {
    try {
      await globalThis.navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fallback to execCommand below
    }
  }

  if (typeof globalThis.document === "undefined") {
    return false;
  }

  const textarea = globalThis.document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  textarea.style.left = "-9999px";
  globalThis.document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  let copied = false;
  try {
    copied = globalThis.document.execCommand("copy");
  } catch {
    copied = false;
  }

  globalThis.document.body.removeChild(textarea);
  return copied;
}
