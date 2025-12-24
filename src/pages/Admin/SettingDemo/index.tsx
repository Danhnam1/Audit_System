import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { useState, useEffect } from 'react';
import { getCurrentTime, setTime, resetTime, type TimeResponse } from '../../../api/time';
import { 
  getBackgroundServiceConfig, 
  updateBackgroundServiceConfig,
  type BackgroundServiceConfigResponse,
  type ServiceName 
} from '../../../api/backgroundServiceConfig';
import { toast } from 'react-toastify';

const AdminSettingDemo = () => {
  const { user } = useAuth();
  const [timeData, setTimeData] = useState<TimeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [settingTime, setSettingTime] = useState(false);
  const [resettingTime, setResettingTime] = useState(false);
  
  // Form state for setting time
  const [dateValue, setDateValue] = useState('');
  const [timeHours, setTimeHours] = useState('00');
  const [timeMinutes, setTimeMinutes] = useState('00');
  const [timeSeconds, setTimeSeconds] = useState('00');

  // Background service config state
  const [bgServiceConfig, setBgServiceConfig] = useState<BackgroundServiceConfigResponse | null>(null);
  const [loadingBgConfig, setLoadingBgConfig] = useState(false);
  const [updatingBgConfig, setUpdatingBgConfig] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceName>('AuditStatusUpdate');
  const [dailyTargetHours, setDailyTargetHours] = useState('00');
  const [dailyTargetMinutes, setDailyTargetMinutes] = useState('00');
  const [dailyTargetSeconds, setDailyTargetSeconds] = useState('00');
  const [hourlyIntervalHours, setHourlyIntervalHours] = useState('00');
  const [hourlyIntervalMinutes, setHourlyIntervalMinutes] = useState('00');
  const [hourlyIntervalSeconds, setHourlyIntervalSeconds] = useState('00');

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  // Fetch current time and background service config on component mount
  useEffect(() => {
    fetchCurrentTime();
    fetchBackgroundServiceConfig();
  }, []);

  // Update form fields when service is selected
  useEffect(() => {
    if (bgServiceConfig && selectedService) {
      let config;
      switch (selectedService) {
        case 'AuditStatusUpdate':
          config = bgServiceConfig.auditStatusUpdate;
          break;
        case 'AuditScheduleOverdue':
          config = bgServiceConfig.auditScheduleOverdue;
          break;
        case 'AccessGrantVerifyCodeUpdate':
          config = bgServiceConfig.accessGrantVerifyCodeUpdate;
          break;
        default:
          return;
      }
      if (config) {
        // Parse dailyTargetUtc
        if (config.dailyTargetUtc) {
          const [hours, minutes, seconds] = config.dailyTargetUtc.split(':');
          setDailyTargetHours(hours || '00');
          setDailyTargetMinutes(minutes || '00');
          setDailyTargetSeconds(seconds || '00');
        }
        // Parse hourlyInterval
        if (config.hourlyInterval) {
          const [hours, minutes, seconds] = config.hourlyInterval.split(':');
          setHourlyIntervalHours(hours || '00');
          setHourlyIntervalMinutes(minutes || '00');
          setHourlyIntervalSeconds(seconds || '00');
        }
      }
    }
  }, [selectedService, bgServiceConfig]);

  const fetchCurrentTime = async () => {
    try {
      setLoading(true);
      const data = await getCurrentTime();
      setTimeData(data);
      
      // Parse currentTime to populate form fields (24h format HH:mm:ss)
      if (data.currentTime) {
        const [date, time] = data.currentTime.split(' ');
        setDateValue(date || '');
        // Parse time into hours, minutes, seconds
        if (time) {
          const [hours, minutes, seconds] = time.split(':');
          setTimeHours(hours || '00');
          setTimeMinutes(minutes || '00');
          setTimeSeconds(seconds || '00');
        }
      }
    } catch (error: any) {
      console.error('Error fetching current time:', error);
      toast.error(error?.response?.data?.message || 'Failed to fetch current time');
    } finally {
      setLoading(false);
    }
  };

  const handleSetTime = async () => {
    if (!dateValue) {
      toast.error('Please provide date');
      return;
    }

    try {
      setSettingTime(true);
      // Format time from hours, minutes, seconds
      const timeToSend = `${timeHours.padStart(2, '0')}:${timeMinutes.padStart(2, '0')}:${timeSeconds.padStart(2, '0')}`;
      
      const data = await setTime(dateValue, timeToSend);
      setTimeData(data);
      toast.success('Time set successfully!');
      
      // Update form fields with new time (24h format HH:mm:ss)
      if (data.currentTime) {
        const [date, time] = data.currentTime.split(' ');
        setDateValue(date || '');
        if (time) {
          const [hours, minutes, seconds] = time.split(':');
          setTimeHours(hours || '00');
          setTimeMinutes(minutes || '00');
          setTimeSeconds(seconds || '00');
        }
      }
    } catch (error: any) {
      console.error('Error setting time:', error);
      toast.error(error?.response?.data?.message || 'Failed to set time');
    } finally {
      setSettingTime(false);
    }
  };

  const handleResetTime = async () => {
    if (!window.confirm('Are you sure you want to reset the time to system time?')) {
      return;
    }

    try {
      setResettingTime(true);
      const data = await resetTime();
      setTimeData(data);
      toast.success('Time reset successfully!');
      
      // Update form fields with reset time (24h format HH:mm:ss)
      if (data.currentTime) {
        const [date, time] = data.currentTime.split(' ');
        setDateValue(date || '');
        if (time) {
          const [hours, minutes, seconds] = time.split(':');
          setTimeHours(hours || '00');
          setTimeMinutes(minutes || '00');
          setTimeSeconds(seconds || '00');
        }
      }
    } catch (error: any) {
      console.error('Error resetting time:', error);
      toast.error(error?.response?.data?.message || 'Failed to reset time');
    } finally {
      setResettingTime(false);
    }
  };

  const fetchBackgroundServiceConfig = async () => {
    try {
      setLoadingBgConfig(true);
      const data = await getBackgroundServiceConfig();
      setBgServiceConfig(data);
      
      // Set initial values for selected service
      if (data) {
        const config = data.auditStatusUpdate;
        if (config.dailyTargetUtc) {
          const [hours, minutes, seconds] = config.dailyTargetUtc.split(':');
          setDailyTargetHours(hours || '00');
          setDailyTargetMinutes(minutes || '00');
          setDailyTargetSeconds(seconds || '00');
        }
        if (config.hourlyInterval) {
          const [hours, minutes, seconds] = config.hourlyInterval.split(':');
          setHourlyIntervalHours(hours || '00');
          setHourlyIntervalMinutes(minutes || '00');
          setHourlyIntervalSeconds(seconds || '00');
        }
      }
    } catch (error: any) {
      console.error('Error fetching background service config:', error);
      toast.error(error?.response?.data?.message || 'Failed to fetch background service config');
    } finally {
      setLoadingBgConfig(false);
    }
  };

  const handleUpdateBackgroundServiceConfig = async () => {
    // Format time from hours, minutes, seconds
    const dailyTargetUtc = `${dailyTargetHours.padStart(2, '0')}:${dailyTargetMinutes.padStart(2, '0')}:${dailyTargetSeconds.padStart(2, '0')}`;
    const hourlyInterval = `${hourlyIntervalHours.padStart(2, '0')}:${hourlyIntervalMinutes.padStart(2, '0')}:${hourlyIntervalSeconds.padStart(2, '0')}`;

    try {
      setUpdatingBgConfig(true);
      await updateBackgroundServiceConfig(selectedService, dailyTargetUtc, hourlyInterval);
      toast.success('Background service config updated successfully!');
      
      // Refresh config
      await fetchBackgroundServiceConfig();
    } catch (error: any) {
      console.error('Error updating background service config:', error);
      toast.error(error?.response?.data?.message || 'Failed to update background service config');
    } finally {
      setUpdatingBgConfig(false);
    }
  };

  // Helper function to render time select dropdowns
  const renderTimeSelects = (
    hours: string,
    minutes: string,
    seconds: string,
    setHours: (val: string) => void,
    setMinutes: (val: string) => void,
    setSeconds: (val: string) => void,
    disabled: boolean
  ) => {
    return (
      <div className="flex gap-2 items-end">
        <div className="flex-1">
        
          <select
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            disabled={disabled}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={String(i).padStart(2, '0')}>
                {String(i).padStart(2, '0')}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
        
          <select
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            disabled={disabled}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            {Array.from({ length: 60 }, (_, i) => (
              <option key={i} value={String(i).padStart(2, '0')}>
                {String(i).padStart(2, '0')}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
         
          <select
            value={seconds}
            onChange={(e) => setSeconds(e.target.value)}
            disabled={disabled}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            {Array.from({ length: 60 }, (_, i) => (
              <option key={i} value={String(i).padStart(2, '0')}>
                {String(i).padStart(2, '0')}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  };

  return (
    <MainLayout user={layoutUser}>
      {/* Header */}
      <div className="bg-white border-b border-primary-100 shadow-sm mb-6">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-semibold text-primary-600">Setting Demo</h1>
          <p className="text-gray-600 text-sm mt-1">Manage system time settings</p>
        </div>
      </div>

      <div className="px-6 pb-6 space-y-6">
        {/* Current Time Display */}
        <div className="bg-white rounded-xl border border-primary-100 shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-primary-600">Current System Time</h3>
              <p className="text-sm text-gray-600">Real-time system time information</p>
            </div>
            <button
              onClick={fetchCurrentTime}
              disabled={loading}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-150 ${
                loading
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm hover:shadow-md'
              }`}
            >
              {loading ? 'Loading...' : ' Refresh'}
            </button>
          </div>

          {loading && !timeData ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <p className="text-gray-600 mt-2">Loading time data...</p>
            </div>
          ) : timeData ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-lg p-4 border border-primary-200">
                <p className="text-sm text-gray-600 font-medium mb-1">Current Time</p>
                <p className="text-2xl font-bold text-primary-700">{timeData.currentTime || 'N/A'}</p>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                <p className="text-sm text-gray-600 font-medium mb-1">Today</p>
                <p className="text-2xl font-bold text-blue-700">{timeData.today || 'N/A'}</p>
              </div>
         
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No time data available. Click refresh to load.
            </div>
          )}

          {/* Offset Details */}
          {timeData?.offsetDetails && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm font-semibold text-gray-700 mb-2">Offset Details</p>
              <div className="grid grid-cols-4 gap-2">
                <div className="text-center">
                  <p className="text-xs text-gray-600">Days</p>
                  <p className="text-lg font-bold text-gray-800">{timeData.offsetDetails.days}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600">Hours</p>
                  <p className="text-lg font-bold text-gray-800">{timeData.offsetDetails.hours}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600">Minutes</p>
                  <p className="text-lg font-bold text-gray-800">{timeData.offsetDetails.minutes}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600">Seconds</p>
                  <p className="text-lg font-bold text-gray-800">{timeData.offsetDetails.seconds}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Set Time */}
        <div className="bg-white rounded-xl border border-blue-100 shadow-md p-6">
          <div className="flex items-center gap-3 mb-4">
         
            <div>
              <h3 className="text-lg font-semibold text-blue-600">Set System Time</h3>
              <p className="text-sm text-gray-600">Manually adjust the system time</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
                disabled={settingTime}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="YYYY-MM-DD"
              />
              <p className="text-xs text-gray-500 mt-1">Format: YYYY-MM-DD</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Time <span className="text-red-500">*</span>
              </label>
              {renderTimeSelects(timeHours, timeMinutes, timeSeconds, setTimeHours, setTimeMinutes, setTimeSeconds, settingTime)}
              <p className="text-xs text-gray-500 mt-1">Format: 24-hour (HH:mm:ss) - e.g., 14:16:58</p>
            </div>
          </div>

          <button
            onClick={handleSetTime}
            disabled={settingTime || !dateValue}
            className={`w-full px-6 py-3 rounded-lg font-medium transition-all duration-150 ${
              settingTime || !dateValue
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md'
            }`}
          >
            {settingTime ? 'Setting Time...' : ' Set Time'}
          </button>
        </div>

        {/* Reset Time */}
        <div className="bg-white rounded-xl border border-orange-100 shadow-md p-6">
          <div className="flex items-center gap-3 mb-4">
          
            <div>
              <h3 className="text-lg font-semibold text-orange-600">Reset to System Time</h3>
              <p className="text-sm text-gray-600">Reset the adjusted time back to actual system time</p>
            </div>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
            <div className="flex gap-2">
              <span className="text-orange-600 text-xl">⚠️</span>
              <div>
                <p className="text-sm font-semibold text-orange-800 mb-1">Warning</p>
                <p className="text-xs text-orange-700">
                  This will reset any time adjustments and restore the system to its actual time.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleResetTime}
            disabled={resettingTime}
            className={`w-full px-6 py-3 rounded-lg font-medium transition-all duration-150 ${
              resettingTime
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-orange-600 hover:bg-orange-700 text-white shadow-sm hover:shadow-md'
            }`}
          >
            {resettingTime ? 'Resetting...' : ' Reset Time'}
          </button>
        </div>

        {/* Background Service Config */}
        <div className="bg-white rounded-xl border border-green-100 shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-green-600">Background Service Configuration</h3>
              <p className="text-sm text-gray-600">Configure background service schedules</p>
            </div>
            <button
              onClick={fetchBackgroundServiceConfig}
              disabled={loadingBgConfig}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-150 ${
                loadingBgConfig
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white shadow-sm hover:shadow-md'
              }`}
            >
              {loadingBgConfig ? 'Loading...' : ' Refresh'}
            </button>
          </div>

          {loadingBgConfig && !bgServiceConfig ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
              <p className="text-gray-600 mt-2">Loading background service config...</p>
            </div>
          ) : bgServiceConfig ? (
            <>
              {/* Service Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Service Name <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value as ServiceName)}
                  disabled={updatingBgConfig}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="AuditStatusUpdate">Audit Status Update</option>
                  <option value="AuditScheduleOverdue">Audit Schedule Overdue</option>
                  <option value="AccessGrantVerifyCodeUpdate">Access Grant Verify Code Update</option>
                </select>
              </div>

              {/* Current Config Display */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                  <p className="text-sm text-gray-600 font-medium mb-1">Daily Target UTC</p>
                  <p className="text-xl font-bold text-green-700">
                    {selectedService === 'AuditStatusUpdate' && bgServiceConfig.auditStatusUpdate.dailyTargetUtc}
                    {selectedService === 'AuditScheduleOverdue' && bgServiceConfig.auditScheduleOverdue.dailyTargetUtc}
                    {selectedService === 'AccessGrantVerifyCodeUpdate' && bgServiceConfig.accessGrantVerifyCodeUpdate.dailyTargetUtc}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                  <p className="text-sm text-gray-600 font-medium mb-1">Hourly Interval</p>
                  <p className="text-xl font-bold text-blue-700">
                    {selectedService === 'AuditStatusUpdate' && bgServiceConfig.auditStatusUpdate.hourlyInterval}
                    {selectedService === 'AuditScheduleOverdue' && bgServiceConfig.auditScheduleOverdue.hourlyInterval}
                    {selectedService === 'AccessGrantVerifyCodeUpdate' && bgServiceConfig.accessGrantVerifyCodeUpdate.hourlyInterval}
                  </p>
                </div>
              </div>

              {/* Update Form */}
              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-md font-semibold text-gray-700 mb-3">Update Configuration</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Daily Target UTC <span className="text-red-500">*</span>
                    </label>
                    {renderTimeSelects(
                      dailyTargetHours,
                      dailyTargetMinutes,
                      dailyTargetSeconds,
                      setDailyTargetHours,
                      setDailyTargetMinutes,
                      setDailyTargetSeconds,
                      updatingBgConfig
                    )}
                    <p className="text-xs text-gray-500 mt-1">Format: HH:mm:ss (24h) - e.g., 17:01:00</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Hourly Interval <span className="text-red-500">*</span>
                    </label>
                    {renderTimeSelects(
                      hourlyIntervalHours,
                      hourlyIntervalMinutes,
                      hourlyIntervalSeconds,
                      setHourlyIntervalHours,
                      setHourlyIntervalMinutes,
                      setHourlyIntervalSeconds,
                      updatingBgConfig
                    )}
                    <p className="text-xs text-gray-500 mt-1">Format: HH:mm:ss (24h) - e.g., 12:00:00</p>
                  </div>
                </div>

                <button
                  onClick={handleUpdateBackgroundServiceConfig}
                  disabled={updatingBgConfig}
                  className={`w-full px-6 py-3 rounded-lg font-medium transition-all duration-150 ${
                    updatingBgConfig
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700 text-white shadow-sm hover:shadow-md'
                  }`}
                >
                  {updatingBgConfig ? 'Updating...' : ' Update Configuration'}
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No background service config available. Click refresh to load.
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default AdminSettingDemo;

