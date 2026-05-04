import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";
import { ErrorState } from "@dictation/ui";

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info);
  }

  render() {
    if (this.state.error) return <ErrorState description={this.state.error.message} />;
    return this.props.children;
  }
}
