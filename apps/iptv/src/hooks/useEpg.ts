import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { EpgData, EpgProgram } from '../types/epg';
import { fetchAndParseEpg } from '../utils/epgParser';

const EPG_KEY = 'iptv-epg';
const SETTINGS_KEY = 'iptv-settings';

interface AppSettings {
  epgUrl: string;
  epgRefreshInterval: number;
  epgCacheEnabled: boolean;
  enableHttpsProxy: boolean;
}

function getSettings(): AppSettings {
  const stored = localStorage.getItem(SETTINGS_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return {
        epgUrl: '',
        epgRefreshInterval: 6,
        epgCacheEnabled: true,
        enableHttpsProxy: false,
      };
    }
  }
  return {
    epgUrl: '',
    epgRefreshInterval: 6,
    epgCacheEnabled: true,
    enableHttpsProxy: false,
  };
}

function generateEpgUrls(baseUrl: string): string[] {
  if (!baseUrl) return [];

  // If URL starts with https:// or is localhost, try direct first (no proxy needed)
  const isHttps = baseUrl.startsWith('https://');
  const isLocalhost =
    baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');
  const isFile = baseUrl.startsWith('file:');

  if (isHttps || isLocalhost || isFile) {
    console.log('🔄 EPG: Using direct access (HTTPS/localhost/file detected)');
    return [baseUrl];
  }

  // For HTTP URLs, try direct first, then proxies only if needed
  console.log(
    '🔄 EPG: HTTP URL detected, will try direct first then proxies if needed'
  );
  return [
    baseUrl, // Try direct first - many deployment environments allow CORS
    'https://corsproxy.io/?' + encodeURIComponent(baseUrl),
    'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(baseUrl),
  ];
}

export function useEpg() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<AppSettings>(() => getSettings());

  // Update settings when they change in localStorage
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === SETTINGS_KEY) {
        const newSettings = getSettings();
        setSettings(newSettings);
        // Invalidate EPG cache when URL changes
        if (newSettings.epgUrl) {
          queryClient.invalidateQueries({ queryKey: [EPG_KEY] });
        }
      }
    };

    // Also listen for manual settings updates (same-window)
    const handleCustomEvent = () => {
      const newSettings = getSettings();
      setSettings(newSettings);
      if (newSettings.epgUrl) {
        queryClient.invalidateQueries({ queryKey: [EPG_KEY] });
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('settings-updated', handleCustomEvent);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('settings-updated', handleCustomEvent);
    };
  }, [queryClient]);

  const {
    data: epgData,
    isLoading,
    error,
  } = useQuery({
    queryKey: [EPG_KEY, settings.epgUrl],
    queryFn: async () => {
      if (!settings.epgUrl) {
        console.log('📺 EPG: No EPG URL configured, skipping EPG load');
        return null;
      }

      const epgUrls = generateEpgUrls(settings.epgUrl);
      console.log('🔄 EPG: Attempting to load from:', settings.epgUrl);

      // Try cache first if enabled
      if (settings.epgCacheEnabled) {
        const cacheKey = `iptv-epg-cache-${btoa(settings.epgUrl)}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const cachedData = JSON.parse(cached);
            const cacheAge = Date.now() - cachedData.timestamp;
            const maxAge = settings.epgRefreshInterval * 60 * 60 * 1000;

            if (cacheAge < maxAge) {
              console.log(
                '🔄 EPG: Using cached data, age:',
                Math.round(cacheAge / (1000 * 60)),
                'minutes'
              );
              return cachedData.data;
            }
          } catch (error) {
            console.log('🔄 EPG: Cache corrupted, removing');
            localStorage.removeItem(cacheKey);
          }
        }
      }

      // Try multiple EPG URLs in sequence
      for (let i = 0; i < epgUrls.length; i++) {
        try {
          console.log(
            `🔄 EPG: Trying URL ${i + 1}/${epgUrls.length}:`,
            epgUrls[i]
          );
          const epgData = await fetchAndParseEpg(epgUrls[i]);

          // Cache the result if enabled
          if (settings.epgCacheEnabled && epgData) {
            const cacheKey = `iptv-epg-cache-${btoa(settings.epgUrl)}`;
            const cacheData = {
              data: epgData,
              timestamp: Date.now(),
            };
            try {
              localStorage.setItem(cacheKey, JSON.stringify(cacheData));
              console.log('🔄 EPG: Data cached successfully');
            } catch (cacheError) {
              console.log('🔄 EPG: Failed to cache data:', cacheError);
            }
          }

          return epgData;
        } catch (error) {
          const errorMsg = (error as Error).message;
          console.log(`❌ EPG: URL ${i + 1} failed:`, errorMsg);

          if (i === epgUrls.length - 1) {
            // Last attempt failed - provide helpful error message
            const isHttpUrl = settings.epgUrl.startsWith('http://');
            const errorDetails = isHttpUrl
              ? 'HTTP URLs may require CORS proxies which can be unreliable in deployment. Consider using an HTTPS EPG source instead.'
              : 'All EPG loading attempts failed.';

            throw new Error(`EPG loading failed: ${errorMsg}. ${errorDetails}`);
          }
        }
      }
      return null;
    },
    enabled: !!settings.epgUrl, // Only run query if EPG URL is configured
    staleTime: settings.epgRefreshInterval * 60 * 60 * 1000, // Use user-configured interval
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
    refetchInterval: false, // Disable auto-refetch to avoid CORS spam
    retry: (failureCount, error) => {
      console.log(
        `EPG fetch attempt ${failureCount + 1} failed:`,
        error.message
      );
      return failureCount < 2; // Retry up to 2 times
    },
    retryDelay: (attemptIndex) => {
      const delay = Math.min(1000 * 2 ** attemptIndex, 10000);
      console.log(`Retrying EPG fetch in ${delay}ms...`);
      return delay;
    },
  });

  const refreshEpg = () => {
    queryClient.invalidateQueries({ queryKey: [EPG_KEY] });
  };

  const getChannelPrograms = (channelId: string): EpgProgram[] => {
    if (!epgData) return [];

    // Try exact match first
    let channel = epgData.channels.get(channelId);
    if (channel) return channel.programs;

    // Try case-insensitive match
    const channelIdLower = channelId.toLowerCase();
    for (const [id, channelData] of epgData.channels) {
      if (id.toLowerCase() === channelIdLower) {
        console.log(
          `Found case-insensitive match for "${channelId}" -> "${id}"`
        );
        return channelData.programs;
      }
    }

    // Try partial match
    for (const [id, channelData] of epgData.channels) {
      if (
        id.toLowerCase().includes(channelIdLower) ||
        channelIdLower.includes(id.toLowerCase())
      ) {
        console.log(`Found partial match for "${channelId}" -> "${id}"`);
        return channelData.programs;
      }
    }

    // Try display name match
    for (const [id, channelData] of epgData.channels) {
      if (channelData.displayName.toLowerCase() === channelIdLower) {
        console.log(
          `Found display name match for "${channelId}" -> "${channelData.displayName}" (${id})`
        );
        return channelData.programs;
      }
    }

    console.log(`No EPG match found for channel: "${channelId}"`);
    return [];
  };

  const getCurrentProgram = (channelId: string): EpgProgram | null => {
    const programs = getChannelPrograms(channelId);
    const now = new Date();

    return (
      programs.find((program) => program.start <= now && program.stop > now) ||
      null
    );
  };

  const getNextPrograms = (
    channelId: string,
    count: number = 5
  ): EpgProgram[] => {
    const programs = getChannelPrograms(channelId);
    const now = new Date();

    return programs.filter((program) => program.start > now).slice(0, count);
  };

  const getProgramsForTimeRange = (
    channelId: string,
    startTime: Date,
    endTime: Date
  ): EpgProgram[] => {
    const programs = getChannelPrograms(channelId);

    return programs.filter(
      (program) =>
        (program.start >= startTime && program.start < endTime) ||
        (program.stop > startTime && program.stop <= endTime) ||
        (program.start <= startTime && program.stop >= endTime)
    );
  };

  const searchPrograms = (query: string): EpgProgram[] => {
    if (!epgData || !query.trim()) return [];

    const searchTerm = query.toLowerCase();
    return epgData.programs.filter(
      (program) =>
        program.title.toLowerCase().includes(searchTerm) ||
        (program.description &&
          program.description.toLowerCase().includes(searchTerm)) ||
        (program.category &&
          program.category.toLowerCase().includes(searchTerm))
    );
  };

  return {
    epgData,
    isLoading,
    error,
    refreshEpg,
    getChannelPrograms,
    getCurrentProgram,
    getNextPrograms,
    getProgramsForTimeRange,
    searchPrograms,
    hasData: !!epgData,
    settings,
  };
}
