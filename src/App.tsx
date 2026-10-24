import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { clearAppData, DEFAULT_SETTINGS, loadSettings, saveSettings, sessionStore } from './storage';
import { OpenAICompatibleProvider } from './provider';
import type { ChatMessage, ChatSession, ChatSettings } from './types';

const provider = new OpenAICompatibleProvider();
const SYSTEM_PROMPT =
  'You are a careful coding assistant. Analyze the current code and issue, then produce a corrected solution. Preserve intended features when possible. When the issue description is incomplete, infer the most likely safe fix. Return a brief diagnosis, corrected code, and key changes.';

function makeId(): string {
  return crypto.randomUUID();
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(timestamp);
}

function titleFrom(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  return cleaned.length > 32 ? `${cleaned.slice(0, 32)}…` : cleaned || '새 대화';
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function downloadText(content: string, title: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${title.replace(/[\\/:*?"<>|]/g, '_') || 'lmpilot-response'}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildPrompt(message: string, importContext: string, currentCode: string, issue: string): string {
  const context = [
    ['IMPORT_LAYER', importContext],
    ['CURRENT_CODE', currentCode],
    ['ISSUE', issue],
  ]
    .filter(([, value]) => value.trim())
    .map(([label, value]) => `[${label}]\n${value.trim()}`)
    .join('\n\n');
  return context ? `${context}\n\n[REQUEST]\n${message.trim()}` : message.trim();
}

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [settings, setSettings] = useState<ChatSettings>(() => loadSettings());
  const [apiKey, setApiKey] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [importContext, setImportContext] = useState('');
  const [currentCode, setCurrentCode] = useState('');
  const [issue, setIssue] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [testing, setTesting] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{ text: string; error?: boolean } | null>(null);
  const [ready, setReady] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const draftRef = useRef<HTMLTextAreaElement | null>(null);
  const endOfMessagesRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileTargetRef = useRef<'import' | 'code' | 'issue'>('import');

  useEffect(() => {
    let mounted = true;
    sessionStore.list()
      .then((saved) => {
        if (!mounted) return;
        setSessions(saved);
        setActiveId(saved[0]?.id ?? null);
        setReady(true);
      })
      .catch(() => {
        if (!mounted) return;
        setNotice({ text: '로컬 세션을 불러오지 못했습니다. 브라우저 저장 공간을 확인해 주세요.', error: true });
        setReady(true);
      });
    return () => {
      mounted = false;
      controllerRef.current?.abort();
    };
  }, []);

  const activeSession = sessions.find((session) => session.id === activeId) ?? null;

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [activeSession?.messages, busy]);

  function persistSession(session: ChatSession) {
    setSessions((previous) => [session, ...previous.filter((item) => item.id !== session.id)]
      .sort((a, b) => b.updatedAt - a.updatedAt));
    void sessionStore.save(session).catch(() => {
      setNotice({ text: '세션을 브라우저 저장 공간에 저장하지 못했습니다.', error: true });
    });
  }

  function createSession() {
    const now = Date.now();
    const session: ChatSession = {
      id: makeId(),
      title: '새 대화',
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    setSessions((previous) => [session, ...previous]);
    setActiveId(session.id);
    setSidebarOpen(false);
    void sessionStore.save(session);
    window.setTimeout(() => draftRef.current?.focus(), 0);
  }

  async function deleteSession(sessionId: string) {
    if (busy && activeId === sessionId) stopGeneration();
    const remaining = sessions.filter((session) => session.id !== sessionId);
    setSessions(remaining);
    if (activeId === sessionId) setActiveId(remaining[0]?.id ?? null);
    await sessionStore.delete(sessionId);
  }

  async function handleSend(event?: FormEvent) {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || busy || !ready) return;
    if (!settings.modelName.trim()) {
      setNotice({ text: '설정에서 모델명을 입력해 주세요.', error: true });
      setSettingsOpen(true);
      return;
    }
    if (!apiKey.trim()) {
      setNotice({ text: '설정에서 API-key를 입력해 주세요. 키는 저장되지 않습니다.', error: true });
      setSettingsOpen(true);
      return;
    }

    const now = Date.now();
    const existing = sessions.find((session) => session.id === activeId);
    const base: ChatSession = existing ?? {
      id: makeId(), title: titleFrom(text), createdAt: now, updatedAt: now, messages: [],
    };
    const userMessage: ChatMessage = {
      id: makeId(), role: 'user', content: buildPrompt(text, importContext, currentCode, issue), createdAt: now,
    };
    const assistantMessage: ChatMessage = {
      id: makeId(), role: 'assistant', content: '', createdAt: now,
    };
    let working: ChatSession = {
      ...base,
      title: base.messages.length ? base.title : titleFrom(text),
      updatedAt: now,
      messages: [...base.messages, userMessage, assistantMessage],
    };

    setActiveId(working.id);
    persistSession(working);
    setDraft('');
    setImportContext('');
    setCurrentCode('');
    setIssue('');
    setNotice(null);
    setBusy(true);
    const controller = new AbortController();
    controllerRef.current = controller;

    let assistantText = '';
    try {
      await provider.streamChat(
        {
          model: settings.modelName.trim(),
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...working.messages
              .filter((message) => message.id !== assistantMessage.id)
              .map(({ role, content }) => ({ role, content })),
          ],
          temperature: 0.2,
          max_tokens: 4096,
          stream: true,
        },
        { baseUrl: settings.baseUrl, apiKey: apiKey.trim(), signal: controller.signal },
        (delta) => {
          assistantText += delta;
          working = {
            ...working,
            updatedAt: Date.now(),
            messages: working.messages.map((message) =>
              message.id === assistantMessage.id ? { ...message, content: assistantText } : message,
            ),
          };
          persistSession(working);
        },
      );
      if (!assistantText) {
        working = {
          ...working,
          messages: working.messages.map((message) => message.id === assistantMessage.id
            ? { ...message, content: '모델이 빈 응답을 반환했습니다.' }
            : message),
        };
        persistSession(working);
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
        setNotice({ text: message, error: true });
        if (!assistantText) {
          working = {
            ...working,
            messages: working.messages.filter((item) => item.id !== assistantMessage.id),
          };
          persistSession(working);
        }
      }
    } finally {
      controllerRef.current = null;
      setBusy(false);
      draftRef.current?.focus();
    }
  }

  function stopGeneration() {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setBusy(false);
  }

  function handleSaveSettings(next: ChatSettings, nextApiKey: string) {
    const cleanSettings = { baseUrl: next.baseUrl.trim(), modelName: next.modelName.trim() };
    try {
      saveSettings(cleanSettings);
      setSettings(cleanSettings);
      setApiKey(nextApiKey.trim());
      setSettingsOpen(false);
      setNotice({ text: '설정을 저장했습니다. API-key는 이 탭의 메모리에만 있습니다.' });
    } catch {
      setConnectionResult({ text: '설정을 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.', error: true });
    }
  }

  async function handleTestConnection(baseUrl: string, key: string) {
    if (!baseUrl.trim()) {
      setConnectionResult({ text: 'Base URL을 입력해 주세요.', error: true });
      return;
    }
    setTesting(true);
    setConnectionResult(null);
    try {
      const message = await provider.testConnection(baseUrl, key.trim());
      setConnectionResult({ text: message });
    } catch (error) {
      setConnectionResult({ text: error instanceof Error ? error.message : '연결에 실패했습니다.', error: true });
    } finally {
      setTesting(false);
    }
  }

  function chooseFile(target: 'import' | 'code' | 'issue') {
    fileTargetRef.current = target;
    fileInputRef.current?.click();
  }

  async function loadContextFile(file?: File) {
    if (!file) return;
    try {
      const text = await file.text();
      if (fileTargetRef.current === 'import') setImportContext(text);
      if (fileTargetRef.current === 'code') setCurrentCode(text);
      if (fileTargetRef.current === 'issue') setIssue(text);
      setNotice({ text: `${file.name} 파일을 불러왔습니다.` });
    } catch {
      setNotice({ text: '파일을 읽지 못했습니다.', error: true });
    }
  }

  async function handleClearData() {
    const confirmed = window.confirm('저장된 모든 대화 세션과 설정을 삭제할까요? 이 작업은 되돌릴 수 없습니다.');
    if (!confirmed) return;
    stopGeneration();
    try {
      await clearAppData();
      setSessions([]);
      setActiveId(null);
      setSettings(DEFAULT_SETTINGS);
      setApiKey('');
      setDraft('');
      setSettingsOpen(false);
      setNotice({ text: '이 앱에 저장된 모든 세션과 설정을 삭제했습니다.' });
    } catch {
      setNotice({ text: '로컬 데이터를 모두 삭제하지 못했습니다.', error: true });
    }
  }

  function onComposerKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  }

  return (
    <div className="app-shell">
      {sidebarOpen && <button className="mobile-scrim" aria-label="메뉴 닫기" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-top">
          <a className="brand" href="#" onClick={(event) => event.preventDefault()}>
            <span className="brand-mark">L</span><span>LMPilot</span>
          </a>
          <button className="icon-button new-chat-button" onClick={createSession} title="새 대화" aria-label="새 대화">＋</button>
        </div>
        <button className="new-chat-row" onClick={createSession}><span>＋</span> 새 대화</button>
        <div className="session-heading">최근 대화</div>
        <nav className="session-list" aria-label="대화 세션">
          {!sessions.length && <p className="empty-sessions">저장된 대화가 없습니다.</p>}
          {sessions.map((session) => (
            <div className={`session-row ${session.id === activeId ? 'session-active' : ''}`} key={session.id}>
              <button className="session-select" onClick={() => { setActiveId(session.id); setSidebarOpen(false); }}>
                <span className="session-title">{session.title}</span>
                <span className="session-date">{formatTime(session.updatedAt)}</span>
              </button>
              <button className="session-delete" title="대화 삭제" aria-label={`${session.title} 삭제`} onClick={() => void deleteSession(session.id)}>×</button>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="profile-row" onClick={() => setSettingsOpen(true)}>
            <span className="avatar">AI</span>
            <span className="profile-copy"><strong>모델 설정</strong><small>{settings.modelName || '모델을 설정하세요'}</small></span>
            <span className="chevron">⌘</span>
          </button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <button className="icon-button mobile-menu-button" onClick={() => setSidebarOpen(true)} aria-label="대화 목록 열기">☰</button>
          <div className="topbar-model"><span>{settings.modelName || '모델 선택'}</span><span className="model-caret">⌄</span></div>
          <div className="topbar-actions">
            <span className="connection-indicator"><i /> 로컬 세션</span>
            <button className="icon-button settings-button" onClick={() => setSettingsOpen(true)} aria-label="설정 열기" title="설정">⚙</button>
          </div>
        </header>

        <section className={`conversation ${activeSession?.messages.length ? 'conversation-has-messages' : ''}`}>
          {!activeSession?.messages.length ? (
            <div className="welcome">
              <div className="welcome-icon">✳</div>
              <h1>무엇을 도와드릴까요?</h1>
              <p>코드와 문제를 함께 입력하면 수정 방향을 제안합니다.</p>
              <div className="suggestion-grid">
                <button onClick={() => setDraft('이 코드에서 발생하는 오류를 분석하고 수정해 주세요.')}><b>코드 오류 해결</b><span>오류 원인과 수정 코드를 함께 검토합니다.</span></button>
                <button onClick={() => setDraft('이 코드의 구조를 설명하고 개선점을 알려주세요.')}><b>코드 이해하기</b><span>구성 요소와 개선 방향을 정리합니다.</span></button>
              </div>
            </div>
          ) : (
            <div className="message-list">
              {activeSession.messages.map((message) => (
                <article className={`message message-${message.role}`} key={message.id}>
                  {message.role === 'assistant' && <div className="message-avatar">✳</div>}
                  <div className="message-body">
                    {message.role === 'user'
                      ? <div className="user-bubble"><ReactMarkdown rehypePlugins={[rehypeSanitize]}>{message.content}</ReactMarkdown></div>
                      : message.content
                        ? <><div className="assistant-markdown"><ReactMarkdown rehypePlugins={[rehypeSanitize]}>{message.content}</ReactMarkdown></div><div className="response-actions"><button className="copy-response" onClick={() => void copyText(message.content).then((ok) => setNotice({ text: ok ? '응답을 복사했습니다.' : '클립보드에 복사하지 못했습니다.', error: !ok }))} title="응답 복사">복사</button><button className="copy-response" onClick={() => downloadText(message.content, activeSession.title)} title="응답 저장">저장</button></div></>
                        : busy && message.id === activeSession.messages.at(-1)?.id
                          ? <div className="typing-indicator"><i /><i /><i /></div>
                          : null}
                  </div>
                </article>
              ))}
              <div className="conversation-end" ref={endOfMessagesRef} />
            </div>
          )}
        </section>

        <div className="composer-area">
          {notice && <div className={`notice ${notice.error ? 'notice-error' : ''}`} role="status">{notice.text}<button onClick={() => setNotice(null)} aria-label="알림 닫기">×</button></div>}
          <form className="composer" onSubmit={(event) => void handleSend(event)}>
            <details className="context-panel">
              <summary><span>＋</span> 코드와 참고 자료 추가 <small>선택 사항</small></summary>
              <div className="context-fields">
                <label>현재 코드<button type="button" className="file-load-button" onClick={() => chooseFile('code')}>파일 불러오기</button><textarea value={currentCode} onChange={(event) => setCurrentCode(event.target.value)} placeholder="검토할 코드" rows={5} /></label>
                <label>문제 / 오류<button type="button" className="file-load-button" onClick={() => chooseFile('issue')}>파일 불러오기</button><textarea value={issue} onChange={(event) => setIssue(event.target.value)} placeholder="기대 동작, 오류 메시지 또는 수정할 문제" rows={3} /></label>
                <label>Import Layer<button type="button" className="file-load-button" onClick={() => chooseFile('import')}>파일 불러오기</button><textarea value={importContext} onChange={(event) => setImportContext(event.target.value)} placeholder="프로젝트 맥락, 참고사항, 관련 파일 요약" rows={3} /></label>
              </div>
            </details>
            {(draft.trim() || currentCode.trim() || issue.trim() || importContext.trim()) && (
              <details className="request-preview">
                <summary>전송 내용 미리보기</summary>
                <pre>{buildPrompt(draft, importContext, currentCode, issue)}</pre>
              </details>
            )}
            <input ref={fileInputRef} className="visually-hidden" type="file" accept=".txt,.md,.py,.js,.jsx,.ts,.tsx,.json,.yaml,.yml,.log,.csv,.html,.css" onChange={(event) => { void loadContextFile(event.target.files?.[0]); event.target.value = ''; }} />
            <textarea
              ref={draftRef}
              className="composer-input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onComposerKeyDown}
              placeholder="메시지를 입력하세요"
              rows={1}
              aria-label="메시지 입력"
            />
            <div className="composer-footer">
              <span className="privacy-hint">입력한 내용은 선택한 모델 제공자에게 전송됩니다.</span>
              {busy
                ? <button type="button" className="send-button stop-button" onClick={stopGeneration} aria-label="응답 중단">■</button>
                : <button type="submit" className="send-button" disabled={!draft.trim() || !ready} aria-label="메시지 보내기">↑</button>}
            </div>
          </form>
          <p className="disclaimer">AI 응답은 부정확할 수 있습니다. 중요한 코드는 실행 전에 검토하세요.</p>
        </div>
      </main>

      {settingsOpen && (
        <SettingsDialog
          settings={settings}
          apiKey={apiKey}
          testing={testing}
          connectionResult={connectionResult}
          onClose={() => setSettingsOpen(false)}
          onSave={handleSaveSettings}
          onTest={(baseUrl, key) => void handleTestConnection(baseUrl, key)}
          onClear={() => void handleClearData()}
        />
      )}
    </div>
  );
}

interface SettingsDialogProps {
  settings: ChatSettings;
  apiKey: string;
  testing: boolean;
  connectionResult: { text: string; error?: boolean } | null;
  onClose: () => void;
  onSave: (settings: ChatSettings, apiKey: string) => void;
  onTest: (baseUrl: string, apiKey: string) => void;
  onClear: () => void;
}

function SettingsDialog({ settings, apiKey, testing, connectionResult, onClose, onSave, onTest, onClear }: SettingsDialogProps) {
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [modelName, setModelName] = useState(settings.modelName);
  const [key, setKey] = useState(apiKey);

  useEffect(() => {
    function onEscape(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="modal-header">
          <div><h2 id="settings-title">연결 설정</h2><p>모델 API 연결 정보를 입력하세요.</p></div>
          <button className="icon-button" onClick={onClose} aria-label="설정 닫기">×</button>
        </header>
        <div className="modal-content">
          <label className="field-label">Base URL
            <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://integrate.api.nvidia.com/v1" autoComplete="url" />
          </label>
          <label className="field-label">모델명
            <input value={modelName} onChange={(event) => setModelName(event.target.value)} placeholder="예: nvidia/nemotron 모델 ID" autoComplete="off" />
          </label>
          <label className="field-label">API-key
            <input value={key} onChange={(event) => setKey(event.target.value)} placeholder="키를 입력하세요" type="password" autoComplete="new-password" />
          </label>
          <div className="key-notice"><span>ⓘ</span><p>API-key는 저장되지 않습니다. 이 탭이 열려 있는 동안에만 메모리에서 사용되며, 새로고침하면 다시 입력해야 합니다.</p></div>
          <div className="data-notice">코드와 대화 내용은 응답 생성을 위해 설정한 API 제공자로 전송됩니다.</div>
          {connectionResult && <div className={`connection-result ${connectionResult.error ? 'connection-result-error' : ''}`} role="status">{connectionResult.text}</div>}
        </div>
        <footer className="modal-footer">
          <button className="text-button danger-text" onClick={onClear}>모든 로컬 데이터 지우기</button>
          <div className="modal-actions">
            <button className="secondary-button" onClick={() => onTest(baseUrl, key)} disabled={testing}>{testing ? '확인 중…' : '연결 테스트'}</button>
            <button className="primary-button" onClick={() => onSave({ baseUrl, modelName }, key)}>저장</button>
          </div>
        </footer>
        <p className="modal-footnote">저장 버튼은 Base URL과 모델명만 브라우저에 저장합니다.</p>
      </section>
    </div>
  );
}
