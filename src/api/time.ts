import apiClient from './client';

// Time API response interface
export interface TimeResponse {
  $id: string;
  currentTime: string; // Format: "2025-12-24 14:17:50"
  today: string; // Format: "2025-12-24"
  isAdjusted: boolean;
  offset: string;
  offsetDetails: {
    $id: string;
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  };
}

// Set time request interface
export interface SetTimeRequest {
  date: string; // Format: "2025-12-24"
  time: string; // Format: "14:17:50"
}

/**
 * Get current time from API
 */
export const getCurrentTime = async (): Promise<TimeResponse> => {
  const response = await apiClient.get<TimeResponse>('/Time');
  return response.data;
};

/**
 * Set time via API
 * @param date Date string in format "YYYY-MM-DD"
 * @param time Time string in format "HH:mm:ss"
 */
export const setTime = async (date: string, time: string): Promise<TimeResponse> => {
  const response = await apiClient.post<TimeResponse>('/Time/set', {
    date,
    time,
  } as SetTimeRequest);
  return response.data;
};

/**
 * Reset time to system time
 */
export const resetTime = async (): Promise<TimeResponse> => {
  const response = await apiClient.post<TimeResponse>('/Time/reset');
  return response.data;
};

