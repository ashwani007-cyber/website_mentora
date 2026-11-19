import React, { StrictMode, Component, ErrorInfo, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { DomainsProvider } from './context/DomainsContext'
import ServiceStatusBanner from './components/ServiceStatusBanner'
import { installWriteInvalidation } from './lib/requestCache'

// Clear cached reads automatically after any successful save to our /api server,
// so users always see the data they just saved (see src/lib/requestCache.ts).
installWriteInvalidation()

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class RootErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    (window as any).__last_react_error = {
      message: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack
    };
    console.error("RootErrorBoundary caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#0F172A',
          color: '#F8FAFC',
          padding: '40px',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            maxWidth: '800px',
            margin: '0 auto',
            backgroundColor: '#1E293B',
            borderRadius: '16px',
            padding: '32px',
            border: '1px solid #EF4444'
          }}>
            <h1 style={{ color: '#EF4444', fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>
              ⚠️ Page Rendering Error
            </h1>
            <p style={{ color: '#94A3B8', fontSize: '14px', marginBottom: '20px' }}>
              An error occurred while rendering this page:
            </p>
            <pre style={{
              backgroundColor: '#0A0F1D',
              color: '#FCA5A5',
              padding: '16px',
              borderRadius: '8px',
              overflowX: 'auto',
              fontSize: '13px'
            }}>
              {this.state.error?.toString()}
              {'\n'}
              {this.state.error?.stack}
            </pre>
            <button
              onClick={() => {
                localStorage.clear();
                window.location.href = '/';
              }}
              style={{
                marginTop: '20px',
                padding: '10px 20px',
                backgroundColor: '#F59E0B',
                color: '#05080E',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Reset Session & Return Home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

window.addEventListener('error', (event) => {
  (window as any).__last_window_error = {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error ? { message: event.error.message, stack: event.error.stack } : null
  };
  console.error("Window Error Caught:", event.message, event.error);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <DomainsProvider>
        <App />
        {/* Friendly notice when Supabase is restricted (402) or paused, instead of a broken page */}
        <ServiceStatusBanner />
      </DomainsProvider>
    </RootErrorBoundary>
  </StrictMode>,
)

