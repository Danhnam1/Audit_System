import { apiClient } from '../hooks/axios';

export interface PassThresholdResponse {
  $id?: string;
  id?: number;
  threshold?: number | null;
  passThreshold?: number | null;
  majorThreshold?: number | null;
  mediumThreshold?: number | null;
  minorThreshold?: number | null;
  maxFailMajor?: number | null;
  maxFailMedium?: number | null;
  maxFailMinor?: number | null;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

export interface PassThresholdPayload {
  passThreshold?: number | null;
  majorThreshold?: number | null;
  mediumThreshold?: number | null;
  minorThreshold?: number | null;
  maxFailMajor?: number | null;
  maxFailMedium?: number | null;
  maxFailMinor?: number | null;
}

export const getPassThreshold = async (): Promise<PassThresholdResponse> => {
  const res = await apiClient.get('/PassThreshold');
  return res as PassThresholdResponse;
};

export const updatePassThreshold = async (payload: PassThresholdPayload): Promise<void> => {
  await apiClient.put('/PassThreshold', payload);
};

