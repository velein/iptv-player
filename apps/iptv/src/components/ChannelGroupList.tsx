import { useMemo, memo, useState } from 'react'
import type { Channel } from '../types/channel'
import type { ChannelGroupDisplay } from '../types/channelBrowser'
import { extractChannelGroups } from '../utils/channelGroups'

interface ChannelGroupListProps {
  channels: Channel[]
  selectedGroup: string | null
  onGroupSelect: (groupName: string) => void
  isLoading?: boolean
  className?: string
}

const ChannelGroupList = memo(function ChannelGroupList({
  channels,
  selectedGroup,
  onGroupSelect,
  isLoading = false,
  className = ''
}: ChannelGroupListProps) {
  // State for group filtering
  const [groupFilter, setGroupFilter] = useState('')

  // Extract and enhance groups with metadata
  const allGroups = useMemo(() => {
    if (!channels.length) return []
    
    return extractChannelGroups(channels).map(group => ({
      ...group,
      isSelected: group.name === selectedGroup,
    }))
  }, [channels, selectedGroup])

  // Filter groups based on search
  const groups = useMemo(() => {
    if (!groupFilter.trim()) return allGroups
    
    const filterLower = groupFilter.toLowerCase()
    return allGroups.filter(group => 
      group.name.toLowerCase().includes(filterLower)
    )
  }, [allGroups, groupFilter])

  // Handle group selection
  const handleGroupClick = (groupName: string) => {
    onGroupSelect(groupName)
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={`bg-gray-800 rounded-lg border border-gray-700 ${className}`}>
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Channel Groups</h2>
        </div>
        <div className="p-4 space-y-3">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="animate-pulse">
              <div className="h-12 bg-gray-700 rounded-lg"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Empty state
  if (!groups.length) {
    return (
      <div className={`bg-gray-800 rounded-lg border border-gray-700 ${className}`}>
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Channel Groups</h2>
        </div>
        <div className="p-8 text-center">
          <div className="text-4xl mb-4 text-gray-500">📺</div>
          <p className="text-gray-400 text-sm">No channel groups found</p>
          <p className="text-gray-500 text-xs mt-2">
            Load a playlist to see channel groups
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
          <h2 className="text-lg font-semibold text-white">Channel Groups</h2>
          <p className="text-xs text-gray-400 mt-1">
            {groups.length}{groupFilter.trim() && allGroups.length !== groups.length ? ` of ${allGroups.length}` : ''} group{(groupFilter.trim() ? allGroups.length : groups.length) !== 1 ? 's' : ''} • {channels.length} channel{channels.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        {/* Group Filter */}
        <div>
          <label className="text-xs text-gray-400 block mb-1">
            Search by text:
          </label>
          <input
            type="text"
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            placeholder="Filter groups..."
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Groups List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-1">
          {groups.map((group) => (
            <button
              key={group.name}
              onClick={() => handleGroupClick(group.name)}
              className={`w-full text-left p-3 rounded-lg transition-all duration-200 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                group.isSelected
                  ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className={`font-medium truncate ${
                    group.isSelected ? 'text-white' : 'text-gray-200'
                  }`}>
                    {group.name}
                  </h3>
                  <div className="flex items-center space-x-3 mt-1">
                    <span className={`text-xs ${
                      group.isSelected ? 'text-blue-100' : 'text-gray-400'
                    }`}>
                      {group.channelCount} channel{group.channelCount !== 1 ? 's' : ''}
                    </span>
                    
                    {group.hasEpgChannels > 0 && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        group.isSelected 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-green-600 text-green-100'
                      }`}>
                        {group.hasEpgChannels} EPG
                      </span>
                    )}
                    
                    {group.hasCatchupChannels > 0 && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        group.isSelected 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-purple-600 text-purple-100'
                      }`}>
                        {group.hasCatchupChannels} Catchup
                      </span>
                    )}
                  </div>
                </div>
                
                {group.isSelected && (
                  <div className="ml-2 flex-shrink-0">
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

export default ChannelGroupList