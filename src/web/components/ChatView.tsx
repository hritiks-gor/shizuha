import { useRef, useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { MessageBubble } from './MessageBubble';
import { StreamingMessage } from './StreamingMessage';
import { LocalModelCard } from './LocalModelCard';
import { useShortWindow } from '../lib/short-window';
import type { ChatMessage } from '../lib/types';

interface ChatViewProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingContent: string;
  activeTools: string[];
  reasoningSummaries: string[];
  highlightMessageId?: string | null;
  onLocalModel?: (modelId: string) => void;
  agentId?: string;
}

export interface ChatViewHandle {
  scrollToMessage: (messageId: string) => void;
}

export const ChatView = forwardRef<ChatViewHandle, ChatViewProps>(function ChatView({
  messages,
  isStreaming,
  streamingContent,
  activeTools,
  reasoningSummaries,
  highlightMessageId,
  onLocalModel,
  agentId,
}, ref) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAutoScrollRef = useRef(true);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const scrollToMessage = useCallback((messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Brief highlight flash
      el.classList.add('ring-1', 'ring-shizuha-500/50');
      setTimeout(() => el.classList.remove('ring-1', 'ring-shizuha-500/50'), 2000);
    }
  }, []);

  useImperativeHandle(ref, () => ({ scrollToMessage }), [scrollToMessage]);

  // Follow the transcript. An empty welcome is a form: jumping to the
  // bottom hides the title above a short window.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (messages.length === 0 && !isStreaming) {
      el.scrollTop = 0;
      isAutoScrollRef.current = true;
      return;
    }
    if (isAutoScrollRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, streamingContent, activeTools, reasoningSummaries, isStreaming]);

  // Detect manual scroll — show "scroll to bottom" button when scrolled up
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distFromBottom < 60;
    isAutoScrollRef.current = atBottom;
    setShowScrollDown(!atBottom && distFromBottom > 80);
  };

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      isAutoScrollRef.current = true;
      setShowScrollDown(false);
    }
  }, []);

  const isEmpty = messages.length === 0 && !isStreaming;
  const short = useShortWindow();

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={`min-h-0 flex-1 overflow-y-auto px-2 sm:px-4 ${short ? 'py-1' : 'py-4'}`}
      >
        <div className={`mx-auto max-w-4xl ${isEmpty ? 'flex min-h-full flex-col justify-center' : ''}`}>
          {isEmpty && <WelcomeScreen onLocalModel={onLocalModel} agentId={agentId} />}

          {messages.map((msg) => (
            <div key={msg.id} id={`msg-${msg.id}`} className={`rounded-lg transition-all duration-300 ${highlightMessageId === msg.id ? 'ring-1 ring-shizuha-500/50' : ''}`}>
              <MessageBubble message={msg} />
            </div>
          ))}

          {isStreaming && (
            <StreamingMessage
              content={streamingContent}
              activeTools={activeTools}
              reasoningSummaries={reasoningSummaries}
            />
          )}
        </div>
      </div>

      {/* Scroll to bottom — positioned over the scroll area, not inside it */}
      {showScrollDown && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 w-9 h-9 rounded-full bg-zinc-700 hover:bg-zinc-600 border border-zinc-600 shadow-lg flex items-center justify-center transition-all cursor-pointer"
          title="Scroll to bottom"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-zinc-300">
            <path d="M8 3v10M4 9l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}
    </div>
  );
});

function WelcomeScreen({ onLocalModel, agentId }: { onLocalModel?: (modelId: string) => void; agentId?: string }) {
  const short = useShortWindow();
  return (
    <div className={`flex w-full flex-col items-center text-center ${short ? 'px-3 pb-1 pt-1' : 'px-4 pb-8 pt-6'}`}>
      <h1
        data-testid="desktop-hero"
        className={`font-light tracking-tight ${short ? 'text-2xl leading-tight' : 'text-4xl sm:text-5xl'}`}
      >
        <span className="text-indigo-400/70">静葉</span>{' '}
        <span className="font-medium text-zinc-100">Shizuha</span>
      </h1>
      <p className={`text-zinc-400 ${short ? 'mt-0.5 text-xs' : 'mt-3 text-lg'}`}>Talk to your agent</p>
      {onLocalModel && (
        <div className={`w-full max-w-md ${short ? 'mt-2' : 'mt-6'}`}>
          <LocalModelCard onSaved={onLocalModel} agentId={agentId} />
        </div>
      )}
    </div>
  );
}

