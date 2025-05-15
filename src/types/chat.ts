export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  role: MessageRole;
  content: string;
  timestamp: Date;
}

export interface ChatMessage {
  role: MessageRole;
  content: string;
  timestamp: string;
}

export type UserRole = 'user' | 'employee' | 'admin';

export interface ChatRequest {
  query: string;
  userRole: UserRole;
  chatHistory?: ChatMessage[];
}

export interface ChatResponse {
  response: string;
  suggestedQuestions?: string[];
  error?: string;
} 