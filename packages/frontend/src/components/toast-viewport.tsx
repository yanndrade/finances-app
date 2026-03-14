type ToastTone = "success" | "error";

export type AppToast = {
  id: number;
  tone: ToastTone;
  message: string;
} | null;

type ToastViewportProps = {
  toast: AppToast;
  onDismiss: () => void;
};

export function ToastViewport({ toast, onDismiss }: ToastViewportProps) {
  if (toast === null) {
    return null;
  }

  const role = toast.tone === "error" ? "alert" : "status";

  return (
    <div className="toast-viewport" role="presentation">
      <div
        aria-atomic="true"
        aria-label={toast.message}
        aria-live={toast.tone === "error" ? "assertive" : "polite"}
        className={`app-toast app-toast--${toast.tone}`}
        role={role}
      >
        <span className="app-toast__message">{toast.message}</span>
        <button
          aria-label="Fechar notificação"
          className="app-toast__dismiss"
          onClick={onDismiss}
          type="button"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
