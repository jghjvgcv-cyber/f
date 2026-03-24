import * as React from 'react';
import { AlertTriangle } from 'lucide-react';

export class ErrorBoundary extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, errorInfo: null };
  }

  static getDerivedStateFromError(error: any) {
    try {
      const info = JSON.parse(error.message);
      return { hasError: true, errorInfo: info };
    } catch {
      return { hasError: true, errorInfo: { error: error.message || 'Ocorreu um erro inesperado.' } };
    }
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-[2.5rem] p-10 shadow-2xl border border-zinc-100 text-center space-y-6">
            <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-zinc-900 uppercase tracking-tight italic">Ops! Algo deu errado</h2>
              <p className="text-zinc-500 text-sm font-medium leading-relaxed">
                {this.state.errorInfo?.error || 'Não foi possível completar a operação no momento.'}
              </p>
            </div>
            {this.state.errorInfo?.operationType && (
              <div className="bg-zinc-50 rounded-2xl p-4 text-left">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Detalhes Técnicos</p>
                <p className="text-[10px] font-mono text-zinc-600 break-all">
                  Operação: {this.state.errorInfo.operationType}<br />
                  Caminho: {this.state.errorInfo.path}
                </p>
              </div>
            )}
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-zinc-800 transition-all"
            >
              Recarregar Aplicativo
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
