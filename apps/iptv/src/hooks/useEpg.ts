import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useCallback, useRef } from 'react';
import type { EpgData, EpgProgram } from '../types/epg';
import {
  fetchAndParseEpg,
  loadParsedEpgCache,
  clearParsedEpgCache,
} from '../utils/epgParser';

const EPG_KEY = 'iptv-epg';
const SETTINGS_KEY = 'iptv-settings';

interface AppSettings {
  epgUrl: string;
  epgRefreshInterval: number;
  epgCacheEnabled: boolean;
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
      };
    }
  }
  return {
    epgUrl: '',
    epgRefreshInterval: 6,
    epgCacheEnabled: true,
  };
}

function generateEpgUrls(baseUrl: string): string[] {
  if (!baseUrl) return [];

  // Always try direct access first
  const urls = [baseUrl];

  // For HTTP URLs, add CORS proxy fallbacks
  if (baseUrl.startsWith('http://')) {
    urls.push(
      'https://corsproxy.io/?' + encodeURIComponent(baseUrl),
      'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(baseUrl),
      'https://thingproxy.freeboard.io/fetch/' + encodeURIComponent(baseUrl)
    );
  }

  return urls;
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

  // State for cache status and loaded timestamp
  const [epgLoadedAt, setEpgLoadedAt] = useState<Date | null>(null);

  const {
    data: epgData,
    isLoading,
    error,
    isFetching,
    isStale,
  } = useQuery<EpgData | null>({
    queryKey: [EPG_KEY, settings.epgUrl],
    queryFn: async () => {
      if (!settings.epgUrl) {
        return null;
      }

      // Check for cached data first (loads from IndexedDB)
      console.log('🔍 Checking for cached EPG data...');
      const cached = await loadParsedEpgCache(settings.epgUrl);
      if (cached) {
        console.log('✅ Found cached EPG data, using it');
        setEpgLoadedAt(cached.loadedAt);
        return cached.data;
      }

      console.log('❌ No cached EPG data found');
      return null;
    },
    enabled: !!settings.epgUrl, // Auto-load cache if URL is configured
    staleTime: Infinity, // Parsed cache never goes stale automatically
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: false, // Don't retry cache checks
  });

  // Track when EPG data changes to update loaded timestamp
  useEffect(() => {
    if (epgData && !isLoading && !isFetching) {
      // Only update timestamp if we don't already have one (fresh load)
      if (!epgLoadedAt) {
        setEpgLoadedAt(new Date());
      }
    }
  }, [epgData, isLoading, isFetching, epgLoadedAt]);

  // Track if we've attempted auto-load to prevent loops
  const autoLoadAttempted = useRef(false);

  const loadEpg = useCallback(
    async (forceFresh: boolean = false) => {
      console.log(
        '🔄 loadEpg called, epgUrl:',
        settings.epgUrl,
        'forceFresh:',
        forceFresh
      );

      if (!settings.epgUrl) {
        console.log('⚠️ No EPG URL configured, aborting');
        return;
      }

      // Only clear cache if forcing a fresh reload
      if (forceFresh) {
        await clearParsedEpgCache(settings.epgUrl);
        console.log('🗑️ Cleared parsed EPG cache (force refresh)');
      }

      // Reset timestamp so it gets updated when new data loads
      setEpgLoadedAt(null);

      console.log('🚀 Starting EPG fetch...');

      try {
        // Invalidate and remove the query first to ensure fresh fetch
        await queryClient.invalidateQueries({
          queryKey: [EPG_KEY, settings.epgUrl],
        });
        queryClient.removeQueries({ queryKey: [EPG_KEY, settings.epgUrl] });

        console.log('🗑️ Cleared React Query cache');

        // Manually fetch new EPG data
        const result = await queryClient.fetchQuery({
          queryKey: [EPG_KEY, settings.epgUrl],
          queryFn: async () => {
            console.log('📡 queryFn executing for URL:', settings.epgUrl);

            if (!settings.epgUrl) {
              return null;
            }

            const epgUrls = generateEpgUrls(settings.epgUrl);
            console.log('🔗 Generated URLs:', epgUrls);

            // Try multiple EPG URLs in sequence
            for (let i = 0; i < epgUrls.length; i++) {
              try {
                console.log(
                  `⏳ Attempting URL ${i + 1}/${epgUrls.length}:`,
                  epgUrls[i]
                );
                const data = await fetchAndParseEpg(
                  epgUrls[i],
                  settings.epgUrl
                );
                console.log('✅ EPG fetch successful!');
                setEpgLoadedAt(new Date());
                return data;
              } catch (error) {
                const errorMsg = (error as Error).message;
                console.log(`❌ URL ${i + 1} failed:`, errorMsg);

                if (i === epgUrls.length - 1) {
                  const isHttpUrl = settings.epgUrl.startsWith('http://');
                  const errorDetails = isHttpUrl
                    ? 'HTTP URLs may require CORS proxies which can be unreliable. Consider using an HTTPS EPG source if available.'
                    : 'All EPG loading attempts failed (including CORS proxy fallbacks).';

                  throw new Error(
                    `EPG loading failed: ${errorMsg}. ${errorDetails}`
                  );
                }
              }
            }
            return null;
          },
        });
        console.log(
          '✨ fetchQuery completed, result:',
          result ? 'has data' : 'null'
        );
      } catch (error) {
        console.error('💥 loadEpg error:', error);
        throw error;
      }
    },
    [settings.epgUrl, queryClient, setEpgLoadedAt]
  );

  const refreshEpg = useCallback(async () => {
    await loadEpg(true); // Force fresh reload
  }, [loadEpg]);

  // Don't auto-load EPG - let user manually load it
  // (Disabled because localStorage cache often fails due to size limits)

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
        return channelData.programs;
      }
    }

    // Try display name match
    for (const [id, channelData] of epgData.channels) {
      if (channelData.displayName.toLowerCase() === channelIdLower) {
        return channelData.programs;
      }
    }

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
    isFetching,
    error,
    refreshEpg,
    getChannelPrograms,
    getCurrentProgram,
    getNextPrograms,
    getProgramsForTimeRange,
    searchPrograms,
    hasData: !!epgData,
    hasCachedData: !!epgData, // If we have data, it came from cache or fresh load
    canReload: !!settings.epgUrl && !isLoading && !isFetching,
    epgLoadedAt,
    settings,
  };
}
