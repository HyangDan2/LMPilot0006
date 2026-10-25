export type Role = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  displayContent?: string;
  attachments?: AttachmentReference[];
}

export interface AttachmentReference {
  id: string;
  name: string;
  type: string;
  size: number;
}

export interface LocalAttachment extends AttachmentReference {
  sessionId: string;
  lastModified: number;
  extractedText: string;
  blob: Blob;
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
