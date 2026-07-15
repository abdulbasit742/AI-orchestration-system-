import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, AlertCircle, Brain, CheckCircle, Download, Eraser, Loader,
  Network, Send, Settings, ShieldCheck, Square, Wifi, WifiOff, Zap,
} from 'lucide-react';
import { AGENTS } from '../lib/orchestration/router.mjs';

const QUICK_COMMANDS = [
  'Create a 30-day social media campaign for a student entrepreneurship event.',
  'Review this software launch plan and identify the top delivery risks.',
  'Build a simple monthly cash-flow checklist for a small online store.',
  'Draft a customer-support response for a delayed order without promising a refund.',
];

function newMessage(role, content, metadata = {}) {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, role, content, ...metadata };
}

export default function MasterOrchestratorOptimized() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [online, setOnline] = useState(true);
  const [status, setStatus] = useState({ state: 'loading', providers: [] });
  const [preferredProvider, setPreferredProvider] = useState('auto');
  const [lastRoute, setLastRoute] = useState(null);
  const [error, setError] = useState('');
  const abortRef = useRef(null);

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    updateOnline();
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetch('/api/status', { headers: { Accept: 'application/json' } })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error?.message || 'Status check failed.');
        if (active) setStatus({ state: data.status, providers: data.providers || [] });
      })
      .catch(() => active && setStatus({ state: 'unavailable', providers: [] }));
    return () => { active = false; };
  }, []);

  const configuredProviders = useMemo(
    () => status.providers.filter((provider) => provider.configured),
    [status.providers],
  );

  const routeCounts = useMemo(() => {
    const counts = Object.fromEntries(AGENTS.map((agent) => [agent.id, 0]));
    for (const message of messages) {
      for (const agent of message.route?.agents || []) counts[agent] = (counts[agent] || 0) + 1;
    }
    return counts;
  }, [messages]);

  async function sendMessage(override) {
    const messageText = String(override ?? input).trim();
    if (!messageText || loading || !online) return;
    setError('');
    setInput('');
    setLoading(true);
    setMessages((current) => [...current, newMessage('user', messageText)]);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch('/api/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ message: messageText, preferredProvider }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || 'The orchestration request failed.');
      setLastRoute(data.route);
      setMessages((current) => [...current, newMessage('assistant', data.response, {
        provider: data.provider,
        durationMs: data.durationMs,
        route: data.route,
      })]);
    } catch (requestError) {
      const message = requestError?.name === 'AbortError'
        ? 'The request was cancelled.'
        : requestError?.message || 'The orchestration request failed.';
      setError(message);
      setMessages((current) => [...current, newMessage('system', message)]);
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  }

  function cancelRequest() {
    abortRef.current?.abort();
  }

  function exportConversation() {
    const payload = {
      exportedAt: new Date().toISOString(),
      messages: messages.map(({ role, content, provider, durationMs, route }) => ({ role, content, provider, durationMs, route })),
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `orchestrator-conversation-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const ready = configuredProviders.length > 0;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <header className="mb-5 rounded-2xl border border-purple-500/30 bg-gradient-to-r from-purple-950 to-slate-900 p-5 shadow-2xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 p-3"><Brain aria-hidden="true" /></div>
              <div>
                <h1 className="text-2xl font-bold">PES Master Orchestrator</h1>
                <p className="text-sm text-purple-200">Server-side credentials • deterministic routing • bounded fallback</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 ${online ? 'bg-emerald-500/20 text-emerald-200' : 'bg-red-500/20 text-red-200'}`}>
                {online ? <Wifi size={14} /> : <WifiOff size={14} />}{online ? 'Online' : 'Offline'}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 ${ready ? 'bg-blue-500/20 text-blue-200' : 'bg-amber-500/20 text-amber-200'}`}>
                {ready ? <ShieldCheck size={14} /> : <AlertCircle size={14} />}{ready ? `${configuredProviders.length} provider(s) ready` : 'Provider setup required'}
              </span>
            </div>
          </div>
        </header>

        {!ready && status.state !== 'loading' && (
          <section className="mb-5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100" role="status">
            No model provider is configured. Add server-side values in <code>.env.local</code>, or explicitly enable <code>ORCHESTRATOR_DEMO_MODE=true</code> for a clearly labelled non-AI demo response.
          </section>
        )}

        <section className="mb-5 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6" aria-label="Agent routing activity">
          {AGENTS.map((agent) => (
            <div key={agent.id} className={`rounded-lg border p-3 ${lastRoute?.agents?.includes(agent.id) ? 'border-purple-400 bg-purple-500/20' : 'border-white/10 bg-white/5'}`}>
              <div className="truncate text-xs font-semibold">{agent.name}</div>
              <div className="mt-1 text-xs text-slate-400">{routeCounts[agent.id]} routed</div>
            </div>
          ))}
        </section>

        <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
          <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <div className="h-[520px] space-y-3 overflow-y-auto p-4" aria-live="polite">
              {messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="mb-4 rounded-full bg-purple-500/20 p-5"><Network className="text-purple-300" size={36} /></div>
                  <h2 className="text-xl font-semibold">Controlled orchestration is ready</h2>
                  <p className="mt-2 max-w-lg text-sm text-slate-400">Routing is deterministic and validated before one bounded provider request is attempted. This app drafts guidance only and performs no external business actions.</p>
                </div>
              )}
              {messages.map((message) => (
                <article key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[90%] rounded-xl p-3 text-sm ${message.role === 'user' ? 'bg-purple-600' : message.role === 'system' ? 'border border-red-500/40 bg-red-500/10' : 'border border-white/10 bg-slate-900'}`}>
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    {message.role === 'assistant' && (
                      <div className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-2 text-[11px] text-slate-400">
                        <span>{message.provider}</span><span>{message.durationMs} ms</span><span>{message.route?.agents?.join(' → ')}</span>
                      </div>
                    )}
                  </div>
                </article>
              ))}
              {loading && <div className="flex items-center gap-2 text-sm text-purple-200"><Loader className="animate-spin" size={16} />Processing through a bounded provider gateway…</div>}
            </div>

            <div className="border-t border-white/10 p-3">
              {error && <p className="mb-2 text-sm text-red-300" role="alert">{error}</p>}
              <div className="flex gap-2">
                <label className="sr-only" htmlFor="orchestrator-input">Business request</label>
                <textarea
                  id="orchestrator-input"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); }
                  }}
                  maxLength={4000}
                  rows={2}
                  placeholder="Describe the task…"
                  className="min-h-12 flex-1 resize-none rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                  disabled={loading || !online}
                />
                {loading ? (
                  <button type="button" onClick={cancelRequest} className="rounded-lg bg-red-600 p-3" aria-label="Cancel request"><Square size={18} /></button>
                ) : (
                  <button type="button" onClick={() => sendMessage()} disabled={!input.trim() || !online} className="rounded-lg bg-purple-600 p-3 disabled:opacity-40" aria-label="Send request"><Send size={18} /></button>
                )}
              </div>
              <div className="mt-1 text-right text-[11px] text-slate-500">{input.length}/4000</div>
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-xl border border-white/10 bg-white/5 p-4">
              <h2 className="mb-3 flex items-center gap-2 font-semibold"><Settings size={16} />Provider preference</h2>
              <label className="sr-only" htmlFor="provider">Preferred provider</label>
              <select id="provider" value={preferredProvider} onChange={(event) => setPreferredProvider(event.target.value)} className="w-full rounded-lg border border-white/15 bg-slate-900 p-2 text-sm">
                <option value="auto">Automatic fallback order</option>
                {configuredProviders.map((provider) => <option key={provider.id} value={provider.id}>{provider.label}</option>)}
              </select>
              <p className="mt-2 text-xs text-slate-400">Keys never enter the browser. Provider selection is only a preference; the server enforces configured fallback limits.</p>
            </section>

            <section className="rounded-xl border border-white/10 bg-white/5 p-4">
              <h2 className="mb-3 flex items-center gap-2 font-semibold"><Zap size={16} />Quick tasks</h2>
              <div className="space-y-2">
                {QUICK_COMMANDS.map((command) => <button key={command} type="button" onClick={() => sendMessage(command)} disabled={loading || !online} className="w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-left text-xs hover:border-purple-400 disabled:opacity-40">{command}</button>)}
              </div>
            </section>

            <section className="rounded-xl border border-white/10 bg-white/5 p-4">
              <h2 className="mb-3 flex items-center gap-2 font-semibold"><Activity size={16} />Session controls</h2>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => { setMessages([]); setLastRoute(null); setError(''); }} className="flex items-center justify-center gap-1 rounded-lg bg-slate-800 p-2 text-xs"><Eraser size={14} />Clear</button>
                <button type="button" onClick={exportConversation} disabled={!messages.length} className="flex items-center justify-center gap-1 rounded-lg bg-slate-800 p-2 text-xs disabled:opacity-40"><Download size={14} />Export</button>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-emerald-300"><CheckCircle size={14} />No autonomous side effects</div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
