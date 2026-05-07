import authorizedAxios from '@/api/authorizedAxios';

export interface AskResponse {
  question: string;
  answer: string;
}

export interface SearchResult {
  messageId: string;
  conversationId: string;
  senderId: string;
  content: string;
  timestamp: string;
  score: number;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
}

export interface SummaryResponse {
  conversationId: string;
  summary: string;
  fromDate: string | null;
  toDate: string | null;
  messageCount: number;
}

export interface TranslateResponse {
  original: string;
  translated: string;
  targetLanguage: string;
}

export interface MessageItem {
  senderId: string;
  senderName?: string;
  content: string;
  timestamp: string;
}

export interface RewriteVariant {
  style: string;
  label: string;
  text: string;
}

export interface RewriteResponse {
  original: string;
  rewrites: RewriteVariant[];
}

export const aiServices = {
  ask: (question: string, collectionId?: string) =>
    authorizedAxios
      .post<AskResponse>('/api/ai/ask', { question, collectionId })
      .then((r) => r.data),

  search: (query: string, conversationId?: string, limit = 10) =>
    authorizedAxios
      .post<SearchResponse>('/api/ai/search', { query, conversationId, limit })
      .then((r) => r.data),

  summarize: (conversationId: string, messages: MessageItem[], fromDate?: string, toDate?: string) =>
    authorizedAxios
      .post<SummaryResponse>(`/api/ai/conversations/${conversationId}/summary`, {
        messages,
        fromDate,
        toDate,
      })
      .then((r) => r.data),

  translate: (text: string, targetLanguage: string, sourceLanguage?: string) =>
    authorizedAxios
      .post<TranslateResponse>('/api/ai/translate', { text, targetLanguage, sourceLanguage })
      .then((r) => r.data),

  rewrite: (text: string) =>
    authorizedAxios
      .post<RewriteResponse>('/api/ai/rewrite', { text })
      .then((r) => r.data),

  reindexMessages: (messages: Array<{ messageId: string; conversationId: string; senderId: string; content: string; timestamp: string }>) =>
    authorizedAxios
      .post<{ indexed: number; failed: number; total: number }>('/api/ai/messages/reindex', { messages })
      .then((r) => r.data),
};
