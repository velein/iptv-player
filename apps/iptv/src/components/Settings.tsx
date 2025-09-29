import { useState, useEffect } from 'react';
import localforage from 'localforage';
import { useEpg } from '../hooks/useEpg';

// Configure localforage for EPG storage
const epgStore = localforage.createInstance({
  name: 'iptv-epg',
  storeName: 'parsed-epg',
  description: 'Parsed EPG data cache',
});

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

    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
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
  epgRefreshInterval: number; // hours
  epgCacheEnabled: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  epgUrl: '',
  epgRefreshInterval: 6,
  epgCacheEnabled: true,
};

export default function Settings({ onClose }: SettingsProps) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const { refreshEpg, canReload } = useEpg();

  useEffect(() => {
    // Load settings from localStorage
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

  const handleSave = async () => {
    setSaving(true);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

      // Clear EPG cache if URL changed
      if (settings.epgUrl) {
        const epgCacheKey = `iptv-epg-parsed-${btoa(settings.epgUrl)}`;
        await epgStore.removeItem(epgCacheKey);
      }

      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('settings-updated'));

      alert('Settings saved! EPG will reload automatically.');
      onClose();
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReloadEpg = () => {
    if (canReload) {
      refreshEpg();
      alert('EPG reload initiated!');
    } else {
      alert('EPG reload is not available at this time.');
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
                <input
                  type="url"
                  value={settings.epgUrl}
                  onChange={(e) =>
                    setSettings({ ...settings, epgUrl: e.target.value })
                  }
                  placeholder="Enter your EPG URL (e.g., http://example.com/epg.xml.gz)"
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Leave empty to disable EPG. Supports XML, XMLTV, and
                  compressed (.gz) formats.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Refresh Interval (hours)
                </label>
                <select
                  value={settings.epgRefreshInterval}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      epgRefreshInterval: parseInt(e.target.value),
                    })
                  }
                  className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={1}>1 hour</option>
                  <option value={3}>3 hours</option>
                  <option value={6}>6 hours</option>
                  <option value={12}>12 hours</option>
                  <option value={24}>24 hours</option>
                </select>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="epgCache"
                  checked={settings.epgCacheEnabled}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      epgCacheEnabled: e.target.checked,
                    })
                  }
                  className="mr-2"
                />
                <label htmlFor="epgCache" className="text-sm text-gray-300">
                  Enable EPG caching (recommended)
                </label>
              </div>
            </div>
          </div>

          {/* EPG Management */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">
              EPG Management
            </h3>

            <div className="space-y-4">
              <div className="bg-gray-700 rounded p-3 text-sm">
                <p className="text-gray-300 font-medium mb-2">Cache Status</p>
                <CacheStatus />
              </div>

              <button
                onClick={handleReloadEpg}
                disabled={!canReload}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reload EPG
              </button>
              <p className="text-xs text-gray-400 mt-1">
                Manually reload EPG data from the configured URL.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-4 mt-8">
          <button
            onClick={onClose}
            className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
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
