import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import signalRService, { type NotificationData } from '../services/signalRService';
import useAuthStore from '../store/useAuthStore';

interface SignalRContextType {
  isConnected: boolean;
  connectionState: string | null;
  latestNotification: NotificationData | null;
  onNotification: (callback: (data: NotificationData) => void) => (() => void) | void;
  offNotification: (callback?: (data: NotificationData) => void) => void;
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
  // Use Set to support multiple callbacks from different components
  const notificationCallbacksRef = useRef<Set<(data: NotificationData) => void>>(new Set());
  const handlerRegisteredRef = useRef<boolean>(false);
  const handlerRef = useRef<((data: NotificationData) => void) | null>(null);

  // Helper function to register handler with all callbacks
  const registerHandler = useCallback(() => {
    const connected = signalRService.isConnected();
    
    if (!connected) {
      handlerRegisteredRef.current = false;
      return;
    }

    // Only register handler if we have callbacks to handle
    if (notificationCallbacksRef.current.size === 0) {
      handlerRegisteredRef.current = false;
      return;
    }

    // Remove old handler if exists
    if (handlerRef.current) {
      signalRService.offReceiveNotification();
      handlerRef.current = null;
    }

    // Create handler that calls all registered callbacks
    const handler = (data: NotificationData) => {
      setLatestNotification(data);
      // Call all registered callbacks
      notificationCallbacksRef.current.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error('[SignalRContext] Error in notification callback:', error);
        }
      });
    };

    signalRService.onReceiveNotification(handler);
    handlerRef.current = handler;
    handlerRegisteredRef.current = true;
    
    // Only log if callbacks count changed to reduce console noise
    if (notificationCallbacksRef.current.size > 0) {
      console.log('[SignalRContext] ✅ Handler registered with', notificationCallbacksRef.current.size, 'callback(s)');
    }
  }, []);

  // Initialize SignalR connection when user is authenticated
  // Use ref to prevent multiple connection attempts
  const connectingRef = useRef(false);
  const connectionAttemptedRef = useRef(false);
  
  useEffect(() => {
    if (!token || !user) {
      // Disconnect if user logs out
      signalRService.stop().catch(console.error);
      setIsConnected(false);
      setConnectionState(null);
      connectingRef.current = false;
      connectionAttemptedRef.current = false;
      return;
    }

    // Prevent multiple simultaneous connection attempts
    if (connectingRef.current) {
      return;
    }

    // Only attempt connection once per token/user session
    // Let SignalR's automatic reconnect handle retries
    if (connectionAttemptedRef.current && signalRService.isConnected()) {
      return;
    }

    // Start connection
    const connect = async () => {
      // Check if already connected
      if (signalRService.isConnected()) {
        const state = signalRService.getState();
        setIsConnected(true);
        setConnectionState(state?.toString() || null);
        connectingRef.current = false;
        connectionAttemptedRef.current = true;
        return;
      }

      connectingRef.current = true;
      connectionAttemptedRef.current = true;
      
      try {
        await signalRService.start();
        const state = signalRService.getState();
        const connected = signalRService.isConnected();
        setIsConnected(connected);
        setConnectionState(state?.toString() || null);

        // Register notification handler immediately after connection if we have callbacks
        // If no callbacks yet, they will be registered when components mount and call onNotification
        if (notificationCallbacksRef.current.size > 0) {
          registerHandler();
        }
      } catch (error) {
        console.error('[SignalRContext] Failed to connect:', error);
        setIsConnected(false);
        setConnectionState(null);
        // Don't reset connectionAttemptedRef - let SignalR's automatic reconnect handle retries
        // But reset connectingRef to allow manual retry if needed
      } finally {
        connectingRef.current = false;
      }
    };

    void connect();

    // Cleanup on unmount or when token/user changes
    return () => {
      // Don't stop connection on cleanup - let SignalR handle reconnection
      // Only clear handlers if user actually logged out
      if (!token || !user) {
        signalRService.offReceiveNotification();
        notificationCallbacksRef.current.clear();
        handlerRef.current = null;
        handlerRegisteredRef.current = false;
        connectionAttemptedRef.current = false;
      }
    };
  }, [token, user, registerHandler]);

  // Monitor connection state changes using SignalR events (no polling)
  useEffect(() => {
    if (!token || !user) return;

    // Use SignalR event callbacks instead of polling
    const handleStateChange = () => {
      const connected = signalRService.isConnected();
      const state = signalRService.getState();
      const wasConnected = isConnected;
      
      setIsConnected(connected);
      setConnectionState(state?.toString() || null);
      
      // If connection just became connected (reconnected), re-register handler
      if (connected && !wasConnected) {
        console.log('[SignalRContext] Connection established/reconnected, re-registering handler');
        handlerRegisteredRef.current = false; // Reset flag to allow re-registration
        registerHandler();
      }
    };

    // Register state change callback (no polling - uses SignalR events)
    signalRService.onStateChangeCallback(handleStateChange);

    // Initial state check
    handleStateChange();

    return () => {
      signalRService.offStateChangeCallback();
    };
  }, [token, user, isConnected, registerHandler]);

  // Re-register handler when connection state changes to connected
  // Only register if not already registered to avoid duplicate registrations
  useEffect(() => {
    if (isConnected && signalRService.isConnected() && notificationCallbacksRef.current.size > 0) {
      // Only re-register if handler is not already registered
      if (!handlerRegisteredRef.current) {
        registerHandler();
      }
    }
  }, [isConnected, registerHandler]);

  const onNotification = useCallback((callback: (data: NotificationData) => void) => {
    // Add callback to the set
    notificationCallbacksRef.current.add(callback);
    
    // Re-register handler if connection is ready to ensure handler is set up
    if (signalRService.isConnected()) {
      registerHandler();
    }
    
    // Return cleanup function to remove this specific callback
    return () => {
      notificationCallbacksRef.current.delete(callback);
      // Re-register handler to update the handler with remaining callbacks
      if (signalRService.isConnected() && notificationCallbacksRef.current.size > 0) {
        registerHandler();
      }
    };
  }, [registerHandler]);

  const offNotification = useCallback((callback?: (data: NotificationData) => void) => {
    if (callback) {
      // Remove specific callback
      notificationCallbacksRef.current.delete(callback);
      // Re-register handler if there are still callbacks
      if (signalRService.isConnected() && notificationCallbacksRef.current.size > 0) {
        registerHandler();
      }
    } else {
      // If no callback provided, clear all (for backward compatibility)
      notificationCallbacksRef.current.clear();
    }
  }, [registerHandler]);

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

