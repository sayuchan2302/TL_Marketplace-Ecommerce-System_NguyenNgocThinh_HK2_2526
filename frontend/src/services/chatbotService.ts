import { apiRequest } from './apiClient';

export interface DirectLineTokenResponse {
  token: string;
  conversationId?: string;
  streamUrl?: string;
  expiresIn?: number;
}

interface DirectLineTokenRequest {
  userId?: string;
}

export const chatbotService = {
  createDirectLineToken: (userId?: string) =>
    apiRequest<DirectLineTokenResponse>('/api/bot/token', {
      method: 'POST',
      body: JSON.stringify({ userId } as DirectLineTokenRequest),
    }),
};
