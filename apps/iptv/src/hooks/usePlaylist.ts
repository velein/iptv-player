import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { PlaylistData } from '../types/channel';
import { parseM3U } from '../utils/m3uParser';

const PLAYLIST_KEY = 'iptv-playlist';

export function usePlaylist() {
  const queryClient = useQueryClient();

  const {
    data: playlist,
    isLoading,
    error,
  } = useQuery({
    queryKey: [PLAYLIST_KEY],
    queryFn: () => {
      const stored = localStorage.getItem(PLAYLIST_KEY);
      if (!stored) return null;
      try {
        return JSON.parse(stored) as PlaylistData;
      } catch {
        return null;
      }
    },
    staleTime: Infinity,
  });

  const setPlaylist = (playlistData: PlaylistData) => {
    localStorage.setItem(PLAYLIST_KEY, JSON.stringify(playlistData));
    queryClient.setQueryData([PLAYLIST_KEY], playlistData);
  };

  const loadPlaylistFromFile = async (file: File): Promise<void> => {
    const content = await file.text();
    const playlistData = parseM3U(content);
    setPlaylist(playlistData);
  };

  const loadPlaylistFromUrl = async (url: string): Promise<void> => {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'text/plain, */*',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const content = await response.text();
      const playlistData = parseM3U(content);
      setPlaylist(playlistData);
    } catch (error) {
      throw new Error(`Failed to load playlist: ${(error as Error).message}`);
    }
  };

  const clearPlaylist = () => {
    localStorage.removeItem(PLAYLIST_KEY);
    queryClient.setQueryData([PLAYLIST_KEY], null);
  };

  return {
    playlist,
    isLoading,
    error,
    loadPlaylistFromFile,
    loadPlaylistFromUrl,
    clearPlaylist,
    hasPlaylist: !!playlist,
  };
}
