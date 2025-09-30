import { useMemo, memo, useState } from 'react'
import type { Channel } from '../types/channel'
import { getChannelsInGroup } from '../utils/channelGroups'

interface ChannelListColumnProps {
  channels: Channel[]
  selectedGroup: string | null
  selectedChannel: string | null
  onChannelSelect: (channelId: string) => void
  isLoading?: boolean
  className?: string
}

const ChannelListColumn = memo(function ChannelListColumn({
  channels,
  selectedGroup,
  selectedChannel,
  onChannelSelect,
  isLoading = false,
  className = ''
}: ChannelListColumnProps) {
  // State for channel filtering
  const [channelFilter, setChannelFilter] = useState('')

  // Get all channels for the selected group
  const allGroupChannels = useMemo(() => {
    if (!selectedGroup || !channels.length) return []
    
    return getChannelsInGroup(channels, selectedGroup).map(channel => ({
      ...channel,
      isSelected: channel.id === selectedChannel,
      hasEpg: !!channel.epgId,
      hasCatchup: !!(channel.timeshift && channel.timeshift > 0),
    }))
  }, [channels, selectedGroup, selectedChannel])

  // Filter channels based on search
  const groupChannels = useMemo(() => {
    if (!channelFilter.trim()) return allGroupChannels
    
    const filterLower = channelFilter.toLowerCase()
    return allGroupChannels.filter(channel => 
      channel.name.toLowerCase().includes(filterLower)
    )
  }, [allGroupChannels, channelFilter])

  // Handle channel selection
  const handleChannelClick = (channelId: string) => {
    onChannelSelect(channelId)
  }

  // Handle logo error
  const handleLogoError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.style.display = 'none'
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={`bg-gray-800 rounded-lg border border-gray-700 ${className}`}>
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Channels</h2>
        </div>
        <div className="p-4 space-y-3">
          {[...Array(8)].map((_, index) => (
            <div key={index} className="animate-pulse flex items-center space-x-3">
              <div className="w-12 h-12 bg-gray-700 rounded-lg"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-700 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // No group selected state
  if (!selectedGroup) {
    return (
      <div className={`bg-gray-800 rounded-lg border border-gray-700 ${className}`}>
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Channels</h2>
        </div>
        <div className="p-8 text-center">
          <div className="text-4xl mb-4 text-gray-500">👈</div>
          <p className="text-gray-400 text-sm">Select a group to view channels</p>
          <p className="text-gray-500 text-xs mt-2">
            Choose a channel group from the left panel
          </p>
        </div>
      </div>
    )
  }

  // Empty group state
  if (!groupChannels.length) {
    return (
      <div className={`bg-gray-800 rounded-lg border border-gray-700 ${className}`}>
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Channels</h2>
          <p className="text-xs text-gray-400 mt-1">
            Group: {selectedGroup}
          </p>
        </div>
        <div className="p-8 text-center">
          <div className="text-4xl mb-4 text-gray-500">📺</div>
          <p className="text-gray-400 text-sm">No channels in this group</p>
          <p className="text-gray-500 text-xs mt-2">
            Try selecting a different group
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-gray-800 rounded-lg border border-gray-700 flex flex-col ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex-shrink-0 space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Channels</h2>
          <p className="text-xs text-gray-400 mt-1">
            {selectedGroup} • {groupChannels.length}{channelFilter.trim() && allGroupChannels.length !== groupChannels.length ? ` of ${allGroupChannels.length}` : ''} channel{(channelFilter.trim() ? allGroupChannels.length : groupChannels.length) !== 1 ? 's' : ''}
          </p>
        </div>
        
        {/* Channel Filter */}
        {selectedGroup && (
          <div>
            <input
              type="text"
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              placeholder="Filter channels..."
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
      </div>

      {/* Channels List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-1">
          {groupChannels.map((channel) => (
            <button
              key={channel.id}
              onClick={() => handleChannelClick(channel.id)}
              className={`w-full text-left p-3 rounded-lg transition-all duration-200 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                channel.isSelected
                  ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-3">
                {/* Channel Logo */}
                <div className="flex-shrink-0 w-12 h-12 bg-gray-700 rounded-lg overflow-hidden flex items-center justify-center">
                  {channel.logo ? (
                    <img
                      src={channel.logo}
                      alt={channel.name}
                      className="w-full h-full object-cover"
                      onError={handleLogoError}
                    />
                  ) : (
                    <div className="text-gray-400 text-xs font-bold">
                      {channel.name.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Channel Info */}
                <div className="flex-1 min-w-0">
                  <h3 className={`font-medium truncate ${
                    channel.isSelected ? 'text-white' : 'text-gray-200'
                  }`}>
                    {channel.name}
                  </h3>
                  
                  <div className="flex items-center space-x-2 mt-1">
                    {channel.hasEpg && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        channel.isSelected 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-green-600 text-green-100'
                      }`}>
                        EPG
                      </span>
                    )}
                    
                    {channel.hasCatchup && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        channel.isSelected 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-purple-600 text-purple-100'
                      }`}>
                        {channel.timeshift}h Catchup
                      </span>
                    )}
                    
                    {!channel.hasEpg && !channel.hasCatchup && (
                      <span className={`text-xs ${
                        channel.isSelected ? 'text-blue-100' : 'text-gray-500'
                      }`}>
                        Live only
                      </span>
                    )}
                  </div>
                </div>

                {/* Selection Indicator */}
                {channel.isSelected && (
                  <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>


    </div>
  )
})

export default ChannelListColumn