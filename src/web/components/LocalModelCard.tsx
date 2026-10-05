import { useEffect, useState } from 'react';
import { useShortWindow } from '../lib/short-window';

/**
 * Empty-chat setup. A local OpenAI-compatible URL needs no account.
 * Shizuha ID is optional and only stores a Cortex login. The model list
 * is the whole Cortex catalog; this card does not pick one.
 */
export function LocalModelCard({ onSaved }: { onSaved: (modelId: string) => void; agentId?: string }) {
  const [url, setUrl] = useState('http://127.0.0.1:11434/v1');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState<string | null>(null);
  const [idUser, setIdUser] = useState('');
  const [idPassword, setIdPassword] = useState('');
  const [idBusy, setIdBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const short = useShortWindow();
  const field = short ? 'sd-field px-3 py-1 text-sm' : 'sd-field px-3 py-2 text-sm';
  const button = short ? 'h-8' : 'h-10';

  useEffect(() => {
    let cancelled = false;
    void fetch('/v1/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { identity?: { loggedIn?: boolean } } | null) => {
        if (!cancelled && data?.identity?.loggedIn) setSignedIn(true);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const submitLocal = async () => {
    setBusy(true);
    setError(null);
    try {
      const body: { baseUrl: string; defaultModel?: string; apiKey?: string } = { baseUrl: url.trim() };
      if (model.trim()) body.defaultModel = model.trim();
      if (apiKey.trim()) body.apiKey = apiKey.trim();
      const res = await fetch('/v1/providers/openai', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not save the endpoint');
        return;
      }
      onSaved(`openai:${model.trim() || 'default'}`);
      setLocalStatus('Saved');
    } catch {
      setError('The local core did not accept the endpoint');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`text-left ${short ? 'space-y-2' : 'mt-4 space-y-4'}`}>
      <form
        className={short ? 'space-y-1.5' : 'space-y-3'}
        onSubmit={(e) => { e.preventDefault(); void submitLocal(); }}
      >
        <p className="sd-kicker">Local model</p>
        {!short && <p className="text-xs text-zinc-400">Ollama, LM Studio, llama.cpp, or any OpenAI-compatible server.</p>}
        <input className={field} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://127.0.0.1:11434/v1" aria-label="Base URL" />
        <div className={short ? 'grid grid-cols-2 gap-1.5' : 'grid gap-3'}>
          <input className={field} value={model} onChange={(e) => setModel(e.target.value)} placeholder="Model name" aria-label="Model name" />
          <input className={field} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="API key" aria-label="API key" type="password" />
        </div>
        {localStatus && <p className="text-sm text-cyan-200">{localStatus}</p>}
        <button type="submit" disabled={busy || !url.trim()} className={`w-full ${button} rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-medium cursor-pointer`}>
          {busy ? 'Saving…' : 'Use this model'}
        </button>
      </form>

      {!signedIn && (
        <form
          className={short ? 'space-y-1.5 border-t border-white/10 pt-2' : 'space-y-3 border-t border-white/10 pt-5'}
          onSubmit={async (event) => {
            event.preventDefault();
            setIdBusy(true);
            setError(null);
            try {
              const res = await fetch('/v1/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: idUser.trim(), password: idPassword }),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                setError(typeof data.error === 'string' ? data.error : 'Sign-in failed');
                return;
              }
              setSignedIn(true);
              setIdPassword('');
            } catch {
              setError('The local core did not accept the sign-in');
            } finally {
              setIdBusy(false);
            }
          }}
        >
          <p className="sd-kicker">Shizuha ID</p>
          <div className={short ? 'grid grid-cols-2 gap-1.5' : 'grid gap-3'}>
            <input className={field} value={idUser} onChange={(e) => setIdUser(e.target.value)} placeholder="Username" aria-label="Shizuha ID username" autoComplete="username" />
            <input className={field} value={idPassword} onChange={(e) => setIdPassword(e.target.value)} placeholder="Password" aria-label="Shizuha ID password" type="password" autoComplete="current-password" />
          </div>
          {error && <p className="text-sm text-red-300" role="alert">{error}</p>}
          <button type="submit" data-testid="desktop-sign-in" disabled={idBusy || !idUser.trim() || !idPassword} className={`w-full ${button} rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-50 text-white text-sm font-medium cursor-pointer`}>
            {idBusy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      )}
      {signedIn && error && <p className="text-sm text-red-300" role="alert">{error}</p>}
    </div>
  );
}
