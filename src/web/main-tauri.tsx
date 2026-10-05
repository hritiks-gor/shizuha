import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { DesktopBoot } from './components/DesktopBoot';
import { backendApiUrl } from './lib/backend';
import './globals.css';

// The page origin is the Tauri asset host. Dashboard calls are relative
// `/v1/...` and must go to the local core.
const nativeFetch = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  if (typeof input === 'string' && (input.startsWith('/v1/') || input === '/health' || input === '/ready' || input === '/metrics')) {
    return nativeFetch(backendApiUrl(input), init);
  }
  return nativeFetch(input, init);
};

function TauriApp() {
  const [ready, setReady] = useState(false);
  if (!ready) return <DesktopBoot onReady={() => setReady(true)} />;
  return <App />;
}

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <TauriApp />
    </React.StrictMode>,
  );
}
