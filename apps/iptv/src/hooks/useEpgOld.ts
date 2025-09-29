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
}

function getSettings(): AppSettings {
  const stored = localStorage.getItem(SETTINGS_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return { epgUrl: '', epgRefreshInterval: 6, epgCacheEnabled: true };
    }
  }
  return { epgUrl: '', epgRefreshInterval: 6, epgCacheEnabled: true };
}

function generateEpgUrls(baseUrl: string): string[] {
  if (!baseUrl) return [];
  
  // If URL contains localhost or looks like direct access, don't use proxies
  if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1') || baseUrl.startsWith('file:')) {
    return [baseUrl];
  }
  
  // For remote URLs, try multiple CORS proxy options
  return [
    baseUrl, // Try direct first
    'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(baseUrl),
    'https://corsproxy.io/?' + encodeURIComponent(baseUrl),
    'https://cors-proxy.htmldriven.com/?url=' + encodeURIComponent(baseUrl),
    'https://api.allorigins.win/raw?url=' + encodeURIComponent(baseUrl),
  ];
}

export function useEpg() {
  const queryClient = useQueryClient();

  const {
    data: epgData,
    isLoading,
    error,
  } = useQuery({
    queryKey: [EPG_KEY],
    queryFn: async () => {
      // Try multiple EPG URLs in sequence
      for (let i = 0; i < EPG_URLS.length; i++) {
        try {
          console.log(
            `🔄 EPG: Trying URL ${i + 1}/${EPG_URLS.length}:`,
            EPG_URLS[i]
          );
          return await fetchAndParseEpg(EPG_URLS[i]);
        } catch (error) {
          console.log(`🔄 EPG: URL ${i + 1} failed:`, (error as Error).message);
          if (i === EPG_URLS.length - 1) {
            throw error; // Last attempt failed
          }
        }
      }
    },
    staleTime: 1000 * 60 * 60, // 1 hour
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
  };
}
