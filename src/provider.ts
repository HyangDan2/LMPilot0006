import type { ChatRequest } from './types';

export interface ChatProvider {
  streamChat(
    request: ChatRequest,
    options: { baseUrl: string; apiKey: string; signal: AbortSignal },
    onDelta: (text: string) => void,
  ): Promise<void>;
}

function providerUrl(url: string): string {
  // The Vite dev proxy is intentionally limited to NVIDIA's hosted endpoint.
  // Production builds continue to use the configured URL directly.
  if (import.meta.env.DEV) {
    const parsed = new URL(url);
    if (parsed.origin === 'https://integrate.api.nvidia.com') {
      return `/__nvidia_api_proxy__${parsed.pathname}${parsed.search}`;
    }
  }
  return url;
}

export class OpenAICompatibleProvider implements ChatProvider {
  async streamChat(
    request: ChatRequest,
    options: { baseUrl: string; apiKey: string; signal: AbortSignal },
    onDelta: (text: string) => void,
  ): Promise<void> {
    const baseUrl = options.baseUrl.trim().replace(/\/+$/, '');
    const endpoint = baseUrl.endsWith('/chat/completions')
      ? baseUrl
      : `${baseUrl}/chat/completions`;
    const response = await fetch(providerUrl(endpoint), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}),
      },
      body: JSON.stringify(request),
      signal: options.signal,
    });

    if (!response.ok) {
      throw new Error(`API 요청 실패 (${response.status}). 설정과 제공자 응답을 확인해 주세요.`);
    }
    if (!response.body) throw new Error('이 브라우저에서 스트리밍 응답을 읽을 수 없습니다.');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = '';
    let finished = false;
    while (!finished) {
      const { value, done } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data) continue;
        if (data === '[DONE]') {
          finished = true;
          break;
        }
        try {
          const event = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string | Array<{ text?: string }> } }>;
          };
          const content = event.choices?.[0]?.delta?.content;
          if (typeof content === 'string') onDelta(content);
          else if (Array.isArray(content)) {
            onDelta(content.map((part) => part.text ?? '').join(''));
          }
        } catch {
          // Ignore malformed or provider-specific SSE data frames.
        }
      }
      if (done) finished = true;
    }
    if (pending.startsWith('data:')) {
      const data = pending.slice(5).trim();
      if (data && data !== '[DONE]') {
        try {
          const event = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
          const content = event.choices?.[0]?.delta?.content;
          if (content) onDelta(content);
        } catch {
          // Ignore an incomplete final frame.
        }
      }
    }
  }

  async testConnection(baseUrl: string, apiKey: string): Promise<string> {
    const normalized = baseUrl.trim().replace(/\/+$/, '');
    const modelsBase = normalized.replace(/\/chat\/completions$/, '');
    const modelsUrl = `${modelsBase}/models`;
    const response = await fetch(providerUrl(modelsUrl), {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    });
    if (!response.ok) throw new Error(`연결 실패 (${response.status})`);
    const result = (await response.json()) as { data?: Array<{ id?: string }> };
    const names = result.data?.map((model) => model.id).filter(Boolean).slice(0, 8) ?? [];
    return names.length ? `연결되었습니다. 사용 가능 모델: ${names.join(', ')}` : '연결되었습니다.';
  }
}
