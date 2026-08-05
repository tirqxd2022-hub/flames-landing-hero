import React from "react";

type Props = { children: React.ReactNode; label?: string };
type State = { error: Error | null };

/**
 * Minimal error boundary — prevents an in-render throw from unmounting the
 * whole tree (which otherwise leaves the screen fully black on our dark
 * theme). Shows the error and a Reload button so staff aren't stranded.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", this.props.label || "", error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="max-w-lg w-full rounded-xl border border-white/10 bg-[color:var(--card)] p-6 text-center">
            <div className="text-lg font-semibold text-white mb-1">Something went wrong</div>
            <div className="text-sm text-muted-foreground mb-4 break-words">
              {this.state.error.message || "Unexpected error"}
            </div>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => this.setState({ error: null })}
                className="px-4 py-2 text-sm rounded-md border border-white/10 bg-white/[0.04] text-white"
              >
                Try again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 text-sm rounded-md bg-[color:var(--flame)] text-white font-semibold"
              >
                Reload page
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
