import type { LiveCallError, LiveCallState } from '../hooks/useGrokVoiceS2S';
import { WaveformIcon } from './WaveformIcon';

interface LiveHudProps {
  callState: LiveCallState;
  callError: LiveCallError | null;
  muted: boolean;
  lastHeard: string;
  lastReply: string;
  agentLabel?: string;
  onMute: () => void;
  onEnd: () => void;
  onRetry: () => void;
}

function stateLabel(callState: LiveCallState, muted: boolean): string {
  if (muted && callState !== 'error' && callState !== 'idle') return 'Muted';
  if (callState === 'connecting') return 'Connecting';
  if (callState === 'listening') return 'Listening';
  if (callState === 'thinking') return 'Thinking';
  if (callState === 'speaking') return 'Speaking';
  if (callState === 'error') return 'Unavailable';
  return 'Live';
}

/**
 * Compact voice chip, same shape as the shizuha.com home Live overlay:
 * orb, state, caption, mute, retry, end. It does not cover the chat.
 */
export function LiveHud({
  callState,
  callError,
  muted,
  lastHeard,
  lastReply,
  agentLabel = 'Shizuha',
  onMute,
  onEnd,
  onRetry,
}: LiveHudProps) {
  if (callState === 'idle') return null;
  const label = stateLabel(callState, muted);
  const orbTone =
    callState === 'speaking' ? 'from-violet-400 via-fuchsia-400 to-amber-300'
      : callState === 'thinking' ? 'from-indigo-400 via-cyan-400 to-sky-300'
        : callState === 'error' ? 'from-amber-400 via-orange-400 to-rose-300'
          : 'from-sky-300 via-cyan-400 to-violet-400';
  const orbScale =
    callState === 'speaking' ? 'scale-110'
      : callState === 'listening' && !muted ? 'scale-105'
        : 'scale-100';
  const caption = callError?.message
    || (callState === 'speaking' ? (lastReply || lastHeard) : (lastHeard || lastReply))
    || 'Talk, and the answer comes back as voice.';
  const waveOn = !muted && callState !== 'error' && callState !== 'connecting';

  return (
    <div
      className="pointer-events-none relative z-30 flex w-full shrink-0 justify-end px-3 pt-2 sm:px-4"
      data-live-hud="s2s"
      data-transport="s2s"
      data-call-state={callState}
    >
      <div
        role="region"
        aria-label="Live voice"
        aria-live="polite"
        className="pointer-events-auto flex w-full max-w-[24rem] items-center gap-3 rounded-2xl border border-white/10 bg-zinc-950/90 px-3 py-2 text-white shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-md"
      >
        <div className={`relative shrink-0 transition-transform duration-500 ${orbScale}`}>
          <div className={`absolute -inset-2 rounded-full bg-gradient-to-br ${orbTone} opacity-50 blur-md`} />
          <div className={`relative h-11 w-11 rounded-full bg-gradient-to-br ${orbTone} shadow-[0_0_24px_rgba(34,211,238,0.35)]`}>
            <div className="absolute inset-[18%] rounded-full bg-zinc-950/70 backdrop-blur-sm" />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              Voice
            </span>
            <span data-testid="live-voice-state" className="truncate text-sm font-medium tracking-tight">
              {label}
            </span>
            <span className="hidden truncate text-xs text-white/55 sm:inline">{agentLabel}</span>
          </div>
          <p data-testid="live-hud-caption" className="mt-0.5 truncate text-xs text-white/70" title={caption}>{caption}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-white/35">
            <WaveformIcon className="h-3 w-3" active={waveOn} />
            Live with {agentLabel}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            data-testid="hud-mute-button"
            onClick={onMute}
            className={`flex h-10 w-10 items-center justify-center rounded-full transition cursor-pointer ${
              muted ? 'bg-white text-neutral-900' : 'bg-white/15 text-white hover:bg-white/25'
            }`}
            aria-label={muted ? 'Unmute' : 'Mute'}
            title={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 5.25v13.5m-7.5-9.75H4.5v6h3.75L12 19.5V4.5L8.25 9zM19.5 9l-4.5 6" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
            )}
          </button>
          {callState === 'error' && (
            <button
              type="button"
              onClick={onRetry}
              className="flex h-10 items-center justify-center rounded-full bg-amber-400 px-3 text-xs font-semibold text-neutral-900 cursor-pointer"
            >
              Retry
            </button>
          )}
          <button
            type="button"
            onClick={onEnd}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-neutral-900 hover:bg-white/90 cursor-pointer"
            aria-label="End Live"
            title="End Live"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
