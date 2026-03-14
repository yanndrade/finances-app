import { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ErrorBoundary]", error.message, info.componentStack);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    const { children, fallback } = this.props;

    if (error !== null) {
      if (fallback) return fallback(error, this.reset);
      return (
        <div
          role="alert"
          className="flex flex-col items-center justify-center gap-3 p-12 text-center"
        >
          <p className="text-sm font-semibold text-foreground">
            Algo deu errado nesta seção.
          </p>
          <p className="text-xs text-muted-foreground max-w-xs break-words">
            {error.message || "Erro inesperado."}
          </p>
          <button
            type="button"
            onClick={this.reset}
            className="mt-1 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            Tentar novamente
          </button>
        </div>
      );
    }

    return children;
  }
}
