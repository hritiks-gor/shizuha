import { useState, useEffect } from 'react';
import { getAgentMethod } from '../lib/types';
import type { Agent } from '../lib/types';
import { randomDesktopAgentIdentity } from '../lib/agent-name';

/** Shows relative time since last activity, auto-updates every 10s */
function LastActive({ timestamp }: { timestamp: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);
  const secs = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (secs < 10) return <span className="text-[9px] text-emerald-400">active now</span>;
  if (secs < 60) return <span className="text-[9px] text-emerald-500">{secs}s ago</span>;
  if (secs < 3600) return <span className="text-[9px] text-zinc-500">{Math.floor(secs / 60)}m ago</span>;
  return <span className="text-[9px] text-zinc-600">{Math.floor(secs / 3600)}h ago</span>;
}

interface AgentSidebarProps {
  isOpen: boolean;
  selectedAgentId: string | null;
  agents: Agent[];
  onSelectAgent: (agent: Agent) => void;
  onClose: () => void;
  onAgentCreated?: (agent: Agent) => void;
  onAgentDeleted?: (agentId: string) => void;
}

const ROLE_COLORS: Record<string, string> = {
  'Engineer': 'text-blue-400',
  'Architect': 'text-purple-400',
  'QA Engineer': 'text-yellow-400',
  'Security Engineer': 'text-red-400',
  'Technical Writer': 'text-emerald-400',
  'Data Analyst': 'text-cyan-400',
  'General Assistant': 'text-shizuha-400',
};

const STATUS_COLORS: Record<string, { dot: string; bg: string }> = {
  running: { dot: 'bg-green-400', bg: 'bg-green-400/20' },
  starting: { dot: 'bg-yellow-400 animate-pulse', bg: 'bg-yellow-400/20' },
  error: { dot: 'bg-red-400', bg: 'bg-red-400/20' },
  stopped: { dot: 'bg-zinc-500', bg: 'bg-zinc-500/20' },
  unknown: { dot: 'bg-zinc-600', bg: 'bg-zinc-600/20' },
};

function getInitials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    'bg-blue-600', 'bg-purple-600', 'bg-emerald-600', 'bg-rose-600',
    'bg-amber-600', 'bg-cyan-600', 'bg-indigo-600', 'bg-teal-600',
    'bg-pink-600', 'bg-violet-600', 'bg-orange-600', 'bg-lime-600',
  ];
  return colors[Math.abs(hash) % colors.length]!;
}

export function AgentSidebar({
  isOpen,
  selectedAgentId,
  agents,
  onSelectAgent,
  onClose,
  onAgentCreated,
  onAgentDeleted,
}: AgentSidebarProps) {
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; agent: Agent } | null>(null);
  useEffect(() => {
    if (!menu) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const createAgent = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const identity = randomDesktopAgentIdentity();
        const res = await fetch('/v1/agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: identity.name,
            username: identity.username,
            role: 'agent',
            executionMethod: 'shizuha',
            runtimeEnvironment: 'bare_metal',
          }),
        });
        if (res.status === 409) continue;
        const text = await res.text();
        if (!res.ok) {
          let message = `Could not create an agent (${res.status})`;
          try {
            const err = JSON.parse(text) as { error?: string };
            if (err.error) message = err.error;
          } catch { /* keep status */ }
          setCreateError(message);
          return;
        }
        const data = JSON.parse(text) as { agent?: Agent };
        const agent = data.agent;
        if (!agent) {
          setCreateError('The core created an agent but did not return it');
          return;
        }
        if (agent.runtimeEnvironment && agent.runtimeEnvironment !== 'bare_metal') {
          await fetch(`/v1/agents/${agent.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ runtimeEnvironment: 'bare_metal' }),
          });
        }
        onAgentCreated?.(agent);
        return;
      }
      setCreateError('Could not find a free name. Try again.');
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setCreating(false);
    }
  };

  const deleteAgent = async (agent: Agent) => {
    setMenu(null);
    setDeletingId(agent.id);
    setCreateError(null);
    try {
      const res = await fetch(`/v1/agents/${agent.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const text = await res.text();
        let message = `Could not delete ${agent.name} (${res.status})`;
        try {
          const err = JSON.parse(text) as { error?: string };
          if (err.error) message = err.error;
        } catch { /* keep status */ }
        setCreateError(message);
        return;
      }
      onAgentDeleted?.(agent.id);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = search
    ? agents.filter((a) =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.username.toLowerCase().includes(search.toLowerCase()) ||
        (a.role ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : agents;

  if (!isOpen) return null;

  return (
    <div className="sd-sidebar w-[85vw] max-w-[300px] flex-shrink-0 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Agents</h2>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            {agents.filter((a) => a.status === 'running').length}/{agents.length} online
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void createAgent()}
            disabled={creating}
            className="w-6 h-6 flex items-center justify-center text-cyan-200 hover:bg-white/10 rounded transition-colors cursor-pointer disabled:opacity-50"
            title="New agent"
          >
            {creating ? '…' : '+'}
          </button>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors cursor-pointer lg:hidden"
            title="Close sidebar"
          >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          </button>
        </div>
      </div>
      {createError && (
        <p className="px-4 py-2 text-[11px] text-red-300" role="alert">{createError}</p>
      )}

      {/* Search */}
      {agents.length > 5 && (
        <div className="px-3 py-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents..."
            className="w-full px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600"
          />
        </div>
      )}

      {/* Agent list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {agents.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-zinc-500">
              {search ? 'No agents match your search' : 'No agents available'}
            </p>
          </div>
        )}

        {filtered.map((agent) => {
          const isSelected = agent.id === selectedAgentId;
          const statusStyle = STATUS_COLORS[agent.status] ?? STATUS_COLORS['unknown']!;
          const roleColor = ROLE_COLORS[agent.role ?? ''] ?? 'text-zinc-500';

          return (
            <button
              key={agent.id}
              onClick={() => onSelectAgent(agent)}
              onContextMenu={(event) => {
                event.preventDefault();
                const width = 180;
                const height = 44;
                const x = Math.max(8, Math.min(event.clientX, window.innerWidth - width - 8));
                const y = Math.max(8, Math.min(event.clientY, window.innerHeight - height - 8));
                setMenu({ x, y, agent });
              }}
              className={[
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer mt-0.5',
                isSelected
                  ? 'bg-zinc-800 border-l-2 border-l-shizuha-500'
                  : 'hover:bg-zinc-800/60',
              ].join(' ')}
            >
              {/* Avatar with status dot */}
              <div className="relative flex-shrink-0">
                <div className={`w-10 h-10 rounded-full ${hashColor(agent.name)} flex items-center justify-center`}>
                  <span className="text-sm font-semibold text-white">{getInitials(agent.name)}</span>
                </div>
                {/* Status dot */}
                <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ${statusStyle.dot} border-2 border-zinc-900`} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-1.5">
                  <span className={`text-sm font-medium truncate ${isSelected ? 'text-zinc-100' : 'text-zinc-300'}`}>
                    {agent.name}
                  </span>
                  <span className="text-[10px] text-zinc-600 font-mono">@{agent.username}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-[11px] ${roleColor}`}>{agent.role ?? 'Agent'}</span>
                  <span className="text-zinc-700">·</span>
                  <span className="text-[10px] text-zinc-600 font-mono truncate">{getAgentMethod(agent)}</span>
                  {agent.runtimeEnvironment === 'bare_metal' ? (
                    <span className="text-[8px] px-1 rounded bg-white/10 text-zinc-300" title="Runs on this Mac">host</span>
                  ) : agent.runtimeEnvironment === 'container' ? (
                    <span className="text-[8px] px-1 rounded bg-emerald-500/15 text-emerald-500" title="Running in isolated container">⬡</span>
                  ) : null}
                  {agent.status === 'running' && agent.lastActiveAt && (
                    <>
                      <span className="text-zinc-700">·</span>
                      <LastActive timestamp={agent.lastActiveAt} />
                    </>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {menu && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close menu"
            onClick={() => setMenu(null)}
            onContextMenu={(event) => { event.preventDefault(); setMenu(null); }}
          />
          <div
            role="menu"
            className="fixed z-50 min-w-[11rem] rounded-lg border border-white/10 bg-zinc-900/95 py-1 text-sm shadow-2xl backdrop-blur"
            style={{ left: menu.x, top: menu.y }}
          >
            <button
              type="button"
              role="menuitem"
              disabled={deletingId === menu.agent.id}
              onClick={() => void deleteAgent(menu.agent)}
              className="w-full px-3 py-1.5 text-left text-red-300 hover:bg-white/10 cursor-pointer disabled:opacity-50"
            >
              {deletingId === menu.agent.id ? 'Deleting…' : `Delete ${menu.agent.name}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
