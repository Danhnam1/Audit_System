import { apiClient } from '../hooks/axios';

export interface ChatBotRequest {
  message: string;
  conversationHistory: string;
}

export interface ChatBotResponse {
  $id?: string;
  answer: string;
  isError: boolean;
  errorMessage: string | null;
}

/**
 * Send a message to the chatbot API
 * @param message - The user's message
 * @param conversationHistory - The conversation history as a string
 * @returns The chatbot's response
 */
export const sendChatMessage = async (
  message: string,
  conversationHistory: string = ''
): Promise<ChatBotResponse> => {
  try {
    // apiClient interceptor returns response.data, so response is already ChatBotResponse
    const response = await apiClient.post('/ChatBot/chat', {
      message,
      conversationHistory,
    }) as ChatBotResponse;
    return response;
  } catch (error: any) {
    console.error('[ChatBot] Failed to send message:', error);
    throw error;
  }
};

