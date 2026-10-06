import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Changing this value (e.g. the URL) clears a previous error so navigation recovers. */
  resetKey?: string;
}
interface State {
  error: Error | null;
}

/**
 * Catches render errors so the user sees what went wrong and a way out
 * instead of a blank white page.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div role="alert" className="mx-auto my-16 max-w-lg rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm">
        <AlertTriangle className="mx-auto text-rose-500" size={28} />
        <h2 className="mt-3 text-lg font-semibold text-ink-900">화면을 표시하는 중 문제가 생겼어요</h2>
        <p className="mt-1 text-sm text-slate-500">입력한 내용은 브라우저에 저장되어 있어요. 다시 시도하거나 처음 화면으로 돌아가 주세요.</p>
        <pre className="mt-4 max-h-28 overflow-auto rounded-lg bg-ink-50 px-3 py-2 text-left text-[11px] text-slate-600">{error.message}</pre>
        <div className="mt-5 flex justify-center gap-2">
          <button type="button" onClick={() => this.setState({ error: null })} className="flex items-center gap-1.5 rounded-xl border border-ink-100 px-4 py-2 text-sm text-ink-800 hover:bg-ink-50">
            <RotateCcw size={14} /> 다시 시도
          </button>
          <a href="/" className="flex items-center gap-1.5 rounded-xl bg-ink-900 px-4 py-2 text-sm text-white hover:bg-ink-800">
            <Home size={14} /> 처음 화면으로
          </a>
        </div>
      </div>
    );
  }
}
