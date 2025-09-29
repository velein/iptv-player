import { useState, useEffect } from 'react';

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
        const epgCacheKey = `iptv-epg-cache-${btoa(settings.epgUrl)}`;
        localStorage.removeItem(epgCacheKey);
        // Also clear the query cache
        localStorage.removeItem('iptv-epg');
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

  const handleClearCache = () => {
    // Clear all EPG related cache
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('iptv-epg')) {
        localStorage.removeItem(key);
      }
    });
    alert('EPG cache cleared!');
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

          {/* Cache Management */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">
              Cache Management
            </h3>
            <button
              onClick={handleClearCache}
              className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded transition-colors"
            >
              Clear EPG Cache
            </button>
            <p className="text-xs text-gray-400 mt-1">
              Clear all cached EPG data. Useful if you're experiencing issues.
            </p>
          </div>

          {/* EPG Information */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">
              EPG Configuration Guide
            </h3>
            <div className="bg-gray-700 rounded p-4 text-sm">
              <p className="text-gray-300 mb-3">
                Configure your own EPG source:
              </p>

              <div className="space-y-3">
                <div className="p-3 bg-gray-800 rounded">
                  <p className="text-yellow-200 text-xs font-medium mb-2">
                    📋 EPG URL Requirements:
                  </p>
                  <ul className="space-y-1 text-gray-400 text-xs">
                    <li>• Must be a valid XMLTV format EPG file</li>
                    <li>• Supports .xml, .xml.gz, and compressed formats</li>
                    <li>• Channel IDs should match your M3U playlist</li>
                  </ul>
                </div>

                <div className="p-3 bg-blue-900 rounded">
                  <p className="text-blue-200 text-xs font-medium mb-2">
                    💡 Deployment Tips:
                  </p>
                  <ul className="space-y-1 text-blue-300 text-xs">
                    <li>• HTTPS URLs work directly without proxies</li>
                    <li>• HTTP URLs may need CORS proxies (less reliable)</li>
                    <li>• Test your EPG URL in browser first</li>
                  </ul>
                </div>

                <div className="p-3 bg-orange-900 rounded">
                  <p className="text-orange-200 text-xs font-medium mb-2">
                    ⚠️ Important:
                  </p>
                  <p className="text-orange-300 text-xs">
                    No EPG sources are included by default. You must provide
                    your own EPG URL that matches your M3U playlist's channel
                    names or IDs.
                  </p>
                </div>
              </div>
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
