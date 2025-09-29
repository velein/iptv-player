import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { PlaylistData } from '../types/channel'
import { parseM3U } from '../utils/m3uParser'

const PLAYLIST_KEY = 'iptv-playlist'

export function usePlaylist() {
  const queryClient = useQueryClient()

  const { data: playlist, isLoading, error } = useQuery({
    queryKey: [PLAYLIST_KEY],
    queryFn: () => {
      const stored = localStorage.getItem(PLAYLIST_KEY)
      if (!stored) return null
      try {
        return JSON.parse(stored) as PlaylistData
      } catch {
        return null
      }
    },
    staleTime: Infinity
  })

  const setPlaylist = (playlistData: PlaylistData) => {
    localStorage.setItem(PLAYLIST_KEY, JSON.stringify(playlistData))
    queryClient.setQueryData([PLAYLIST_KEY], playlistData)
  }

  const loadPlaylistFromFile = async (file: File): Promise<void> => {
    const content = await file.text()
    const playlistData = parseM3U(content)
    setPlaylist(playlistData)
  }

  const loadPlaylistFromUrl = async (url: string): Promise<void> => {
    try {
      // Try direct fetch first
      const response = await fetch(url, {
        mode: 'cors',
        headers: {
          'Accept': 'text/plain, */*'
        }
      })

      if (response.ok) {
        const content = await response.text()
        const playlistData = parseM3U(content)
        setPlaylist(playlistData)
        return
      }
    } catch (directError) {
      // Direct fetch failed, try CORS proxy
    }

    // CORS proxies for playlist loading
    const corsProxies = [
      'https://api.allorigins.win/raw?url=',
      'https://corsproxy.io/?',
      'https://thingproxy.freeboard.io/fetch/'
    ]

    let lastError: Error | null = null

    for (const proxy of corsProxies) {
      try {
        const proxyUrl = proxy + encodeURIComponent(url)
        const response = await fetch(proxyUrl, {
          mode: 'cors',
          headers: {
            'Accept': 'text/plain, */*'
          }
        })

        if (response.ok) {
          const content = await response.text()
          const playlistData = parseM3U(content)
          setPlaylist(playlistData)
          return
        }
      } catch (error) {
        lastError = error as Error
      }
    }

    throw lastError || new Error('Failed to fetch playlist from all sources')
  }

  const clearPlaylist = () => {
    localStorage.removeItem(PLAYLIST_KEY)
    queryClient.setQueryData([PLAYLIST_KEY], null)
  }

  return {
    playlist,
    isLoading,
    error,
    loadPlaylistFromFile,
    loadPlaylistFromUrl,
    clearPlaylist,
    hasPlaylist: !!playlist
  }
}