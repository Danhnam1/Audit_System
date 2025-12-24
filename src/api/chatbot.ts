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
    throw error;
  }
};

export interface SuggestedRootCause {
  $id?: string;
  name: string;
  description: string;
  reasoning: string;
  confidence: number;
}

export interface AnalyzeFindingResponse {
  $id?: string;
  suggestedRootCauses: {
    $id?: string;
    $values?: SuggestedRootCause[];
  };
  analysisSummary: string;
  isError: boolean;
  errorMessage: string | null;
}

/**
 * Analyze finding and get suggested root causes
 * @param findingId - The finding ID to analyze
 * @returns Suggested root causes and analysis summary
 */
export const analyzeFinding = async (
  findingId: string
): Promise<AnalyzeFindingResponse> => {
  try {
    // POST method - findingId is in the URL path
    const response = await apiClient.post(`/ChatBot/analyze-finding/${findingId}`, {}) as AnalyzeFindingResponse;
    return response;
  } catch (error: any) {
    throw error;
  }
};

