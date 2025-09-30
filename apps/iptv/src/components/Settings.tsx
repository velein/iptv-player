import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import localforage from 'localforage';
import { useEpg } from '../hooks/useEpg';
import type { EpgLoadingState } from '../hooks/useEpgState';
import { usePlaylist } from '../hooks/usePlaylist';

// Configure localforage for EPG storage
const epgStore = localforage.createInstance({
  name: 'iptv-epg',
  storeName: 'parsed-epg',
  description: 'Parsed EPG data cache',
});

function LoadingIndicator({ 
  state, 
  message, 
  onRetry 
}: { 
  state: EpgLoadingState; 
  message?: string;
  onRetry?: () => void;
}) {
  if (state === 'idle' || state === 'complete') return null;

  const getDisplayMessage = () => {
    if (message) return message;
    switch (state) {
      case 'loading':
        return 'Loading EPG...';
      case 'parsing':
        return 'Parsing EPG...';
      case 'error':
        return 'EPG loading failed';
      default:
        return '';
    }
  };

  const getProgressWidth = () => {
    switch (state) {
      case 'loading':
        return '25%';
      case 'parsing':
        return '75%';
      case 'error':
        return '100%';
      default:
        return '0%';
    }
  };

  return (
    <div className="mt-2 p-3 bg-gray-700 rounded">
      <div className="flex items-center space-x-3">
        {state !== 'error' && (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
        )}
        {state === 'error' && (
          <div className="text-red-400">⚠</div>
        )}
        <div className="flex-1">
          <p className={`text-sm ${state === 'error' ? 'text-red-400' : 'text-gray-300'}`}>
            {getDisplayMessage()}
          </p>
          {state !== 'error' && (
            <div className="mt-1 w-full bg-gray-600 rounded-full h-1">
              <div 
                className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                style={{ width: getProgressWidth() }}
              ></div>
            </div>
          )}
        </div>
        {state === 'error' && onRetry && (
          <button
            onClick={onRetry}
            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

function CacheStatus() {
  const [cacheInfo, setCacheInfo] = useState<{
    hasCachedData: boolean;
    cacheAge?: string;
    cacheSize?: string;
  }>({ hasCachedData: false });

  useEffect(() => {
    const checkCache = async () => {
      try {
        const settings = localStorage.getItem('iptv-settings');
        if (!settings) return;

        const parsed = JSON.parse(settings);
        if (!parsed.epgUrl) return;

        const cacheKey = `iptv-epg-parsed-${btoa(parsed.epgUrl)}`;
        const cached = await epgStore.getItem<any>(cacheKey);

        if (cached) {
          const ageMs = Date.now() - cached.timestamp;
          const ageHours = Math.floor(ageMs / (1000 * 60 * 60));
          const ageMinutes = Math.floor(
            (ageMs % (1000 * 60 * 60)) / (1000 * 60)
          );

          const jsonString = JSON.stringify(cached);
          const sizeInMB = (jsonString.length / (1024 * 1024)).toFixed(2);

          setCacheInfo({
            hasCachedData: true,
            cacheAge:
              ageHours > 0
                ? `${ageHours}h ${ageMinutes}m ago`
                : `${ageMinutes}m ago`,
            cacheSize: `${sizeInMB} MB`,
          });
        } else {
          setCacheInfo({ hasCachedData: false });
        }
      } catch (error) {
        setCacheInfo({ hasCachedData: false });
      }
    };

    checkCache();

    // Update every 30 seconds
    const interval = setInterval(checkCache, 30000);

    // Listen for storage changes (when cache is updated)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key?.startsWith('iptv-epg-parsed-')) {
        checkCache();
      }
    };

    // Listen for custom EPG cache update events
    const handleEpgCacheUpdate = () => {
      console.log('🔵 EPG cache updated, refreshing cache status');
      checkCache();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('epg-cache-updated', handleEpgCacheUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('epg-cache-updated', handleEpgCacheUpdate);
    };
  }, []);

  if (!cacheInfo.hasCachedData) {
    return (
      <div className="text-gray-400 text-xs">
        <span className="text-red-400">●</span> No cached EPG data
      </div>
    );
  }

  return (
    <div className="space-y-1 text-xs">
      <div className="text-green-400">
        <span className="text-green-400">●</span> EPG data cached
      </div>
      <div className="text-gray-400">Age: {cacheInfo.cacheAge}</div>
      <div className="text-gray-400">Size: {cacheInfo.cacheSize}</div>
    </div>
  );
}

interface SettingsProps {
  onClose: () => void;
}

const SETTINGS_KEY = 'iptv-settings';

interface AppSettings {
  epgUrl: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  epgUrl: '',
};

interface EpgFormData {
  epgUrl: string;
}

export default function Settings({ onClose }: SettingsProps) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const { refreshEpg, canReload, loadEpgWithProgress, epgLoadingState, isFirstTimeSetup } = useEpg();
  const [epgError, setEpgError] = useState<string | null>(null);
  const { clearPlaylist } = usePlaylist();

  // React Hook Form setup for EPG URL
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<EpgFormData>({
    defaultValues: {
      epgUrl: ''
    }
  });

  const currentEpgUrl = watch('epgUrl');

  useEffect(() => {
    // Load settings from localStorage
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      try {
        const parsedSettings = JSON.parse(stored);
        const loadedSettings = { ...DEFAULT_SETTINGS, ...parsedSettings };
        setSettings(loadedSettings);
        setValue('epgUrl', loadedSettings.epgUrl);
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    }
  }, [setValue]);

  // Helper method to determine save button state
  const getEpgButtonState = () => {
    const isUrlEmpty = !currentEpgUrl.trim();
    const isUrlUnchanged = currentEpgUrl === settings.epgUrl;
    const isLoading = epgLoadingState === 'loading' || epgLoadingState === 'parsing';
    const hasValidationError = validateEpgUrl(currentEpgUrl) !== null;
    
    return {
      disabled: isUrlEmpty || isUrlUnchanged || isLoading || hasValidationError,
      loading: isLoading,
      validationError: hasValidationError ? validateEpgUrl(currentEpgUrl) : null,
    };
  };

  // URL validation helper
  const validateEpgUrl = (url: string): string | null => {
    if (!url.trim()) return null;
    
    try {
      const urlObj = new URL(url);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return 'URL must use HTTP or HTTPS protocol';
      }
      return null;
    } catch {
      return 'Please enter a valid URL';
    }
  };

  // Handle saving EPG URL and initiating load
  const onSubmitEpg = async (data: EpgFormData) => {
    console.log('🔵 handleSaveEpg called with URL:', data.epgUrl);
    
    const buttonState = getEpgButtonState();
    if (buttonState.disabled) {
      console.log('🔴 Save EPG button is disabled, aborting');
      return;
    }

    // Validate URL before proceeding
    const validationError = validateEpgUrl(data.epgUrl);
    if (validationError) {
      console.log('🔴 Validation error:', validationError);
      setEpgError(validationError);
      return;
    }

    try {
      // Clear any existing errors
      setEpgError(null);

      // Update settings with new EPG URL
      const newSettings = { ...settings, epgUrl: data.epgUrl.trim() };
      console.log('🔵 Updating settings:', newSettings);
      setSettings(newSettings);
      
      // Save to localStorage
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
      console.log('🔵 Settings saved to localStorage');
      
      // Clear EPG cache for the new URL
      if (newSettings.epgUrl) {
        const epgCacheKey = `iptv-epg-parsed-${btoa(newSettings.epgUrl)}`;
        await epgStore.removeItem(epgCacheKey);
        console.log('🔵 Cleared EPG cache for new URL');
      }

      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('settings-updated'));
      console.log('🔵 Dispatched settings-updated event');

      // Load EPG with progress tracking - pass the new EPG URL directly
      console.log('🔵 Starting EPG load with URL:', newSettings.epgUrl);
      await loadEpgWithProgress(true, undefined, newSettings.epgUrl);
      console.log('🔵 EPG load completed successfully');

    } catch (error) {
      console.error('🔴 Error saving EPG settings:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save EPG settings';
      setEpgError(errorMessage);
    }
  };

  // Clear errors when user starts typing
  useEffect(() => {
    if (epgError) {
      setEpgError(null);
    }
  }, [currentEpgUrl, epgError]);

  // Handle retrying EPG load after error
  const handleRetryEpg = async () => {
    if (!settings.epgUrl) return;
    
    try {
      setEpgError(null);
      await loadEpgWithProgress(true);
    } catch (error) {
      console.error('Error retrying EPG load:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to retry EPG loading';
      setEpgError(errorMessage);
    }
  };

  // Handle resetting everything to default state
  const handleResetEverything = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to reset everything? This will:\n\n' +
      '• Remove all M3U playlist data\n' +
      '• Clear all EPG cache data\n' +
      '• Reset EPG URL to empty\n\n' +
      'This action cannot be undone.'
    );

    if (!confirmed) return;

    try {
      // Clear M3U playlist data
      clearPlaylist();

      // Clear EPG cache data
      if (settings.epgUrl) {
        const epgCacheKey = `iptv-epg-parsed-${btoa(settings.epgUrl)}`;
        await epgStore.removeItem(epgCacheKey);
      }

      // Reset settings to default
      const resetSettings = { ...DEFAULT_SETTINGS };
      setSettings(resetSettings);
      setUnsavedEpgUrl('');
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(resetSettings));

      // Clear EPG error state
      setEpgError(null);

      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('settings-updated'));

      alert('Everything has been reset to default settings.');
    } catch (error) {
      console.error('Error resetting everything:', error);
      alert('Error occurred while resetting. Some data may not have been cleared.');
    }
  };



  const handleReloadEpg = async () => {
    if (!canReload) return;

    try {
      await refreshEpg();
    } catch (error) {
      console.error('Error reloading EPG:', error);
      setEpgError('EPG reload failed. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        <div className="space-y-6">
          {/* EPG Configuration */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">
              EPG Configuration
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  EPG URL
                </label>
                <form onSubmit={handleSubmit(onSubmitEpg)} className="flex gap-2">
                  <input
                    {...register('epgUrl', {
                      validate: (value) => {
                        if (!value.trim()) return 'EPG URL is required';
                        const error = validateEpgUrl(value);
                        return error || true;
                      }
                    })}
                    type="url"
                    disabled={epgLoadingState === 'loading' || epgLoadingState === 'parsing'}
                    placeholder="Enter your EPG URL (e.g., http://example.com/epg.xml.gz)"
                    className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <button
                    type="submit"
                    disabled={getEpgButtonState().disabled}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {getEpgButtonState().loading ? 'Saving...' : 'Save EPG'}
                  </button>
                  {settings.epgUrl && (
                    <button
                      type="button"
                      onClick={handleReloadEpg}
                      disabled={!canReload || epgLoadingState === 'loading' || epgLoadingState === 'parsing'}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      Refresh EPG
                    </button>
                  )}
                </form>
                {errors.epgUrl ? (
                  <p className="text-xs text-red-400 mt-1">
                    {errors.epgUrl.message}
                  </p>
                ) : epgError ? (
                  <p className="text-xs text-red-400 mt-1">
                    Error: {epgError}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 mt-1">
                    Leave empty to disable EPG. Supports XML, XMLTV, and compressed (.gz) formats. EPG data is automatically refreshed every 6 hours.
                  </p>
                )}
                <LoadingIndicator 
                  state={epgLoadingState} 
                  message={epgError || undefined}
                  onRetry={settings.epgUrl ? handleRetryEpg : undefined}
                />
              </div>


            </div>
          </div>

          {/* EPG Cache Status - Only show when EPG URL is saved */}
          {settings.epgUrl && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">
                EPG Cache Status
              </h3>
              <div className="bg-gray-700 rounded p-3 text-sm">
                <CacheStatus />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center mt-8">
          <button
            onClick={handleResetEverything}
            disabled={epgLoadingState === 'loading' || epgLoadingState === 'parsing'}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reset Everything
          </button>
          <button
            onClick={onClose}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export function useSettings(): AppSettings {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      try {
        const parsedSettings = JSON.parse(stored);
        setSettings({ ...DEFAULT_SETTINGS, ...parsedSettings });
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    }
  }, []);

  return settings;
}
