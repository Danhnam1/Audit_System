import apiClient from './client';

// Service names
export type ServiceName = 
  | 'AuditStatusUpdate' 
  | 'AuditScheduleOverdue' 
  | 'AccessGrantVerifyCodeUpdate';

// Service config interface
export interface ServiceConfig {
  $id: string;
  dailyTargetUtc: string; // Format: "17:01:00"
  hourlyInterval: string; // Format: "12:00:00"
  parsedDailyTargetUtc: string;
  parsedHourlyInterval: string;
}

// Background service config response interface
export interface BackgroundServiceConfigResponse {
  $id: string;
  auditStatusUpdate: ServiceConfig;
  auditScheduleOverdue: ServiceConfig;
  accessGrantVerifyCodeUpdate: ServiceConfig;
}

// Update service config request interface
export interface UpdateServiceConfigRequest {
  dailyTargetUtc: string; // Format: "HH:mm:ss"
  hourlyInterval: string; // Format: "HH:mm:ss"
}

/**
 * Get all background service configurations
 */
export const getBackgroundServiceConfig = async (): Promise<BackgroundServiceConfigResponse> => {
  const response = await apiClient.get<BackgroundServiceConfigResponse>('/BackgroundServiceConfig');
  return response.data;
};

/**
 * Update background service configuration
 * @param serviceName Service name (AuditStatusUpdate, AuditScheduleOverdue, AccessGrantVerifyCodeUpdate)
 * @param dailyTargetUtc Daily target time in UTC (format: "HH:mm:ss")
 * @param hourlyInterval Hourly interval (format: "HH:mm:ss")
 */
export const updateBackgroundServiceConfig = async (
  serviceName: ServiceName,
  dailyTargetUtc: string,
  hourlyInterval: string
): Promise<ServiceConfig> => {
  const response = await apiClient.post<ServiceConfig>(
    `/BackgroundServiceConfig/${serviceName}`,
    {
      dailyTargetUtc,
      hourlyInterval,
    } as UpdateServiceConfigRequest
  );
  return response.data;
};

