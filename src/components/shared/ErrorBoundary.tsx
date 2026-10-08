import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-white rounded-3xl border border-rose-200 shadow-sm my-4 text-center">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-stone-900 font-display">
            {this.props.fallbackTitle || 'Unable to display this section'}
          </h3>
          <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto">
            A temporary component error occurred. The rest of Syntuc Explorer remains fully operational.
          </p>
          {this.state.error && (
            <div className="mt-3 p-2 bg-stone-50 rounded-xl text-[11px] font-mono text-stone-600 max-w-lg mx-auto overflow-x-auto text-left">
              {this.state.error.message}
            </div>
          )}
          <button
            onClick={this.handleReset}
            className="mt-4 px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold inline-flex items-center space-x-1.5 transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            <span>Try Again</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
