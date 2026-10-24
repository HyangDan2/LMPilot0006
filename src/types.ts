export type Role = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

export interface ChatSettings {
  baseUrl: string;
  modelName: string;
}

export interface ChatRequest {
  model: string;
  messages: Array<{ role: 'system' | Role; content: string }>;
  temperature: number;
  max_tokens: number;
  stream: true;
}
