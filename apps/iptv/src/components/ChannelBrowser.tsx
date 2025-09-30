import { useState, useCallback, useEffect, useMemo } from 'react'
import type { Channel } from '../types/channel'
import type { EpgProgram } from '../types/epg'
import type { ChannelBrowserState } from '../types/channelBrowser'
import { usePlaylist } from '../hooks/usePlaylist'
import { findChannelById } from '../utils/channelGroups'
import ChannelGroupList from './ChannelGroupList'
import ChannelListColumn from './ChannelListColumn'
import ChannelEpgList from './ChannelEpgList'

interface ChannelBrowserProps {
  onChannelSelect?: (channelId: string) => void
  onProgramSelect?: (program: EpgProgram, channelId: string) => void
  className?: string
}

export default function ChannelBrowser({
  onChannelSelect,
  onProgramSelect,
  className = ''
}: ChannelBrowserProps) {
  const { playlist, isLoading: playlistLoading } = usePlaylist()
  
  // Load persisted state from localStorage
  const loadPersistedState = (): ChannelBrowserState => {
    try {
      const saved = localStorage.getItem('channel-browser-state')
      if (saved) {
        const parsed = JSON.parse(saved)
        return {
          selectedGroup: parsed.selectedGroup || null,
          selectedChannel: parsed.selectedChannel || null,
          isLoading: false,
          error: null,
        }
      }
    } catch (error) {
      console.warn('Failed to load persisted channel browser state:', error)
    }
    
    return {
      selectedGroup: null,
      selectedChannel: null,
      isLoading: false,
      error: null,
    }
  }

  // Component state
  const [state, setState] = useState<ChannelBrowserState>(loadPersistedState)

  // Get selected channel object - memoized for performance
  const selectedChannelObj = useMemo(() => {
    if (!state.selectedChannel || !playlist?.channels) return null
    return findChannelById(playlist.channels, state.selectedChannel)
  }, [state.selectedChannel, playlist?.channels])

  // Persist state to localStorage
  const persistState = useCallback((newState: Partial<ChannelBrowserState>) => {
    try {
      const stateToSave = {
        selectedGroup: newState.selectedGroup,
        selectedChannel: newState.selectedChannel,
      }
      localStorage.setItem('channel-browser-state', JSON.stringify(stateToSave))
    } catch (error) {
      console.warn('Failed to persist channel browser state:', error)
    }
  }, [])

  // Handle group selection
  const handleGroupSelect = useCallback((groupName: string) => {
    const newState = {
      selectedGroup: groupName,
      selectedChannel: null, // Reset channel selection when group changes
      isLoading: false,
      error: null,
    }
    setState(newState)
    persistState(newState)
  }, [persistState])

  // Handle channel selection
  const handleChannelSelect = useCallback((channelId: string) => {
    setState(prev => {
      const newState = {
        ...prev,
        selectedChannel: channelId,
      }
      persistState(newState)
      return newState
    })
    
    // Notify parent component
    onChannelSelect?.(channelId)
  }, [onChannelSelect, persistState])

  // Handle program selection
  const handleProgramSelect = useCallback((program: EpgProgram, channelId: string) => {
    // Notify parent component
    onProgramSelect?.(program, channelId)
  }, [onProgramSelect])

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle keyboard navigation if no input is focused
      if (document.activeElement?.tagName === 'INPUT') return

      switch (e.key) {
        case 'Escape':
          // Clear selections on escape
          const clearedState = {
            selectedGroup: null,
            selectedChannel: null,
            isLoading: false,
            error: null,
          }
          setState(clearedState)
          persistState(clearedState)
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Loading state
  if (playlistLoading) {
    return (
      <div className={`grid grid-cols-1 lg:grid-cols-3 gap-4 h-full ${className}`}>
        <ChannelGroupList
          channels={[]}
          selectedGroup={null}
          onGroupSelect={handleGroupSelect}
          isLoading={true}
        />
        <ChannelListColumn
          channels={[]}
          selectedGroup={null}
          selectedChannel={null}
          onChannelSelect={handleChannelSelect}
          isLoading={true}
        />
        <ChannelEpgList
          channel={null}
          onProgramSelect={handleProgramSelect}
          isLoading={true}
        />
      </div>
    )
  }

  // No playlist state
  if (!playlist) {
    return (
      <div className={`bg-gray-800 rounded-lg border border-gray-700 p-8 text-center ${className}`}>
        <div className="text-4xl mb-4 text-gray-500">📺</div>
        <h2 className="text-xl font-semibold text-white mb-2">No Playlist Loaded</h2>
        <p className="text-gray-400 text-sm mb-4">
          Load a playlist to browse channels and programs
        </p>
        <p className="text-gray-500 text-xs">
          Go to Settings to load your IPTV playlist
        </p>
      </div>
    )
  }

  return (
    <div className={`${className}`}>
      {/* Desktop: Three-column layout */}
      <div className="hidden lg:grid lg:grid-cols-3 gap-4 h-full max-h-[calc(100vh-120px)] overflow-hidden">
        {/* Column 1: Channel Groups */}
        <div className="lg:col-span-1 flex flex-col min-h-0">
          <ChannelGroupList
            channels={playlist.channels}
            selectedGroup={state.selectedGroup}
            onGroupSelect={handleGroupSelect}
            isLoading={state.isLoading}
            className="flex-1 h-full"
          />
        </div>

        {/* Column 2: Channels in Selected Group */}
        <div className="lg:col-span-1 flex flex-col min-h-0">
          <ChannelListColumn
            channels={playlist.channels}
            selectedGroup={state.selectedGroup}
            selectedChannel={state.selectedChannel}
            onChannelSelect={handleChannelSelect}
            isLoading={state.isLoading}
            className="flex-1 h-full"
          />
        </div>

        {/* Column 3: EPG Programs for Selected Channel */}
        <div className="lg:col-span-1 flex flex-col min-h-0">
          <ChannelEpgList
            channel={selectedChannelObj}
            onProgramSelect={handleProgramSelect}
            isLoading={state.isLoading}
            className="flex-1 h-full"
          />
        </div>
      </div>

      {/* Mobile/Tablet: Stacked layout with conditional visibility */}
      <div className="lg:hidden space-y-4">
        {/* Always show groups on mobile */}
        {!state.selectedGroup && (
          <ChannelGroupList
            channels={playlist.channels}
            selectedGroup={state.selectedGroup}
            onGroupSelect={handleGroupSelect}
            isLoading={state.isLoading}
          />
        )}

        {/* Show channels when group is selected but no channel selected */}
        {state.selectedGroup && !state.selectedChannel && (
          <div className="space-y-4">
            {/* Back to groups button */}
            <button
              onClick={() => {
                const newState = { selectedGroup: null, selectedChannel: null, isLoading: false, error: null }
                setState(newState)
                persistState(newState)
              }}
              className="flex items-center space-x-2 text-blue-400 hover:text-blue-300 text-sm"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>Back to Groups</span>
            </button>
            
            <ChannelListColumn
              channels={playlist.channels}
              selectedGroup={state.selectedGroup}
              selectedChannel={state.selectedChannel}
              onChannelSelect={handleChannelSelect}
              isLoading={state.isLoading}
            />
          </div>
        )}

        {/* Show EPG when channel is selected */}
        {state.selectedChannel && selectedChannelObj && (
          <div className="space-y-4">
            {/* Back to channels button */}
            <button
              onClick={() => {
                setState(prev => {
                  const newState = { ...prev, selectedChannel: null }
                  persistState(newState)
                  return newState
                })
              }}
              className="flex items-center space-x-2 text-blue-400 hover:text-blue-300 text-sm"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>Back to {state.selectedGroup}</span>
            </button>
            
            <ChannelEpgList
              channel={selectedChannelObj}
              onProgramSelect={handleProgramSelect}
              isLoading={state.isLoading}
            />
          </div>
        )}
      </div>
    </div>
  )
}