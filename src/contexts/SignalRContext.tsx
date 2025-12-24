import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import signalRService, { type NotificationData } from '../services/signalRService';
import useAuthStore from '../store/useAuthStore';

interface SignalRContextType {
  isConnected: boolean;
  connectionState: string | null;
  latestNotification: NotificationData | null;
  onNotification: (callback: (data: NotificationData) => void) => void;
  offNotification: () => void;
}

const SignalRContext = createContext<SignalRContextType | undefined>(undefined);

interface SignalRProviderProps {
  children: ReactNode;
}

export function SignalRProvider({ children }: SignalRProviderProps) {
  const { token, user } = useAuthStore();
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<string | null>(null);
  const [latestNotification, setLatestNotification] = useState<NotificationData | null>(null);
  const notificationCallbackRef = useRef<((data: NotificationData) => void) | null>(null);
  const handlerRegisteredRef = useRef<boolean>(false);

  // Helper function to register handler with current callback
  const registerHandler = useCallback(() => {
    const connected = signalRService.isConnected();
    
    if (!connected) {
      handlerRegisteredRef.current = false;
      return;
    }

    // Only register if not already registered
    if (handlerRegisteredRef.current) {
      return;
    }

    // Create handler that always uses the latest callback ref
    const handler = (data: NotificationData) => {
      setLatestNotification(data);
      // Always check the latest callback ref
      if (notificationCallbackRef.current) {
        try {
          notificationCallbackRef.current(data);
        } catch (error) {
          console.error('[SignalRContext] Error in notification callback:', error);
        }
      } else {
        console.warn('[SignalRContext] No callback registered yet; storing notification in latestNotification');
      }
    };

    signalRService.onReceiveNotification(handler);
    handlerRegisteredRef.current = true;
  }, []);

  // Initialize SignalR connection when user is authenticated
  useEffect(() => {
    if (!token || !user) {
      // Disconnect if user logs out
      signalRService.stop().catch(console.error);
      setIsConnected(false);
      setConnectionState(null);
      return;
    }

    // Start connection
    const connect = async () => {
      try {
        await signalRService.start();
        const state = signalRService.getState();
        const connected = signalRService.isConnected();
        setIsConnected(connected);
        setConnectionState(state?.toString() || null);

        // Register notification handler immediately after connection
        registerHandler();
      } catch (error) {
        console.error('[SignalRContext] Failed to connect:', error);
        setIsConnected(false);
        setConnectionState(null);
      }
    };

    void connect();

    // Cleanup on unmount or when token/user changes
    return () => {
      signalRService.offReceiveNotification();
      notificationCallbackRef.current = null;
      handlerRegisteredRef.current = false;
    };
  }, [token, user]);

  // Monitor connection state changes
  useEffect(() => {
    if (!token || !user) return;

    const interval = setInterval(() => {
      const connected = signalRService.isConnected();
      const state = signalRService.getState();
      setIsConnected(connected);
      setConnectionState(state?.toString() || null);
    }, 2000); // Check every 2 seconds

    return () => clearInterval(interval);
  }, [token, user]);

  // Re-register handler when connection state changes to connected
  useEffect(() => {
    if (isConnected && signalRService.isConnected()) {
      registerHandler();
    }
  }, [isConnected, registerHandler]);

  const onNotification = useCallback((callback: (data: NotificationData) => void) => {
    notificationCallbackRef.current = callback;
    
    // Re-register handler if connection is ready (this will be a no-op if already registered)
    if (signalRService.isConnected()) {
      handlerRegisteredRef.current = false; // Reset flag to allow re-registration with new callback
      registerHandler();
    }
    
    // If there's a pending notification (arrived before callback was registered), trigger it now
    if (latestNotification) {
      try {
        callback(latestNotification);
      } catch (error) {
        console.error('[SignalRContext] Error triggering callback for pending notification:', error);
      }
    }
  }, [registerHandler, latestNotification]);

  const offNotification = useCallback(() => {
    notificationCallbackRef.current = null;
    handlerRegisteredRef.current = false;
  }, []);

  const value: SignalRContextType = {
    isConnected,
    connectionState,
    latestNotification,
    onNotification,
    offNotification,
  };

  return <SignalRContext.Provider value={value}>{children}</SignalRContext.Provider>;
}

// Hook to use SignalR context
export function useSignalR() {
  const context = useContext(SignalRContext);
  if (context === undefined) {
    throw new Error('useSignalR must be used within a SignalRProvider');
  }
  return context;
}

