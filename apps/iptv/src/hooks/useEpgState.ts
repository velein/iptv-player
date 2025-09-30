import { useState, useCallback, useEffect } from 'react';

export type EpgLoadingState = 'idle' | 'loading' | 'parsing' | 'complete' | 'error';

export interface EpgStateInfo {
  state: EpgLoadingState;
  progress?: number; // 0-100 for loading progress
  message?: string; // User-friendly status message
  error?: string; // Error message if state is 'error'
}

export interface EpgState {
  loadingState: EpgLoadingState;
  error: string | null;
  isFirstTimeSetup: boolean;
  hasValidEpgUrl: boolean;
}

const SETTINGS_KEY = 'iptv-settings';

interface AppSettings {
  epgUrl: string;
  epgRefreshInterval: number;
  epgCacheEnabled: boolean;
}

function getStoredSettings(): AppSettings | null {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error reading stored settings:', error);
  }
  return null;
}

export function useEpgState() {
  const [loadingState, setLoadingStateInternal] = useState<EpgLoadingState>('idle');
  const [error, setErrorInternal] = useState<string | null>(null);
  const [isFirstTimeSetup, setIsFirstTimeSetup] = useState<boolean>(true);
  const [hasValidEpgUrl, setHasValidEpgUrl] = useState<boolean>(false);

  // Check initial state on mount
  useEffect(() => {
    const settings = getStoredSettings();
    const hasEpgUrl = !!(settings?.epgUrl);
    
    setHasValidEpgUrl(hasEpgUrl);
    setIsFirstTimeSetup(!hasEpgUrl);
  }, []);

  // Listen for settings changes
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === SETTINGS_KEY) {
        checkFirstTimeSetup();
      }
    };

    const handleCustomEvent = () => {
      checkFirstTimeSetup();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('settings-updated', handleCustomEvent);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('settings-updated', handleCustomEvent);
    };
  }, []);

  const checkFirstTimeSetup = useCallback(() => {
    const settings = getStoredSettings();
    const hasEpgUrl = !!(settings?.epgUrl);
    
    setHasValidEpgUrl(hasEpgUrl);
    setIsFirstTimeSetup(!hasEpgUrl);
  }, []);

  const setLoadingState = useCallback((state: EpgLoadingState) => {
    setLoadingStateInternal(state);
    
    // Clear error when transitioning away from error state
    if (state !== 'error' && error) {
      setErrorInternal(null);
    }
  }, [error]);

  const setError = useCallback((errorMessage: string) => {
    setErrorInternal(errorMessage);
    setLoadingStateInternal('error');
  }, []);

  const clearError = useCallback(() => {
    setErrorInternal(null);
    if (loadingState === 'error') {
      setLoadingStateInternal('idle');
    }
  }, [loadingState]);

  const getStateInfo = useCallback((): EpgStateInfo => {
    const baseInfo: EpgStateInfo = {
      state: loadingState,
    };

    switch (loadingState) {
      case 'loading':
        return {
          ...baseInfo,
          message: 'Loading EPG...',
          progress: 25,
        };
      case 'parsing':
        return {
          ...baseInfo,
          message: 'Parsing EPG...',
          progress: 75,
        };
      case 'complete':
        return {
          ...baseInfo,
          message: 'EPG loaded successfully',
          progress: 100,
        };
      case 'error':
        return {
          ...baseInfo,
          message: error || 'EPG loading failed',
          error: error || undefined,
        };
      default:
        return baseInfo;
    }
  }, [loadingState, error]);

  const epgState: EpgState = {
    loadingState,
    error,
    isFirstTimeSetup,
    hasValidEpgUrl,
  };

  return {
    epgState,
    stateInfo: getStateInfo(),
    setLoadingState,
    setError,
    clearError,
    checkFirstTimeSetup,
  };
}