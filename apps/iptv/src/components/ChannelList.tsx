import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { usePlaylist } from '../hooks/usePlaylist'
import { useEpg } from '../hooks/useEpg'
import type { Channel, ChannelGroup } from '../types/channel'
import EpgDebug from './EpgDebug'
import CatchupDebug from './CatchupDebug'

export default function ChannelList() {
  const navigate = useNavigate()
  const { playlist } = usePlaylist()
  const { getCurrentProgram } = useEpg()
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  if (!playlist) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 mb-4">No playlist loaded</p>
        <button
          onClick={() => navigate({ to: '/' })}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors"
        >
          Load Playlist
        </button>
      </div>
    )
  }

  const filteredGroups = playlist.groups.filter(group => {
    if (selectedGroup && group.name !== selectedGroup) return false
    if (!searchTerm) return true
    return group.channels.some(channel =>
      channel.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })

  const getFilteredChannels = (group: ChannelGroup): Channel[] => {
    if (!searchTerm) return group.channels
    return group.channels.filter(channel =>
      channel.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }

  const handleChannelClick = (channel: Channel) => {
    navigate({ to: '/player/$channelId', params: { channelId: channel.id } })
  }

  return (
    <div className="space-y-6">
      {/* Debug Info */}
      <CatchupDebug />

      {/* Search and Filter Controls */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search channels..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="md:w-64">
          <select
            value={selectedGroup || ''}
            onChange={(e) => setSelectedGroup(e.target.value || null)}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Groups</option>
            {playlist.groups.map(group => (
              <option key={group.name} value={group.name}>
                {group.name} ({group.channels.length})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Channel Groups */}
      <div className="space-y-6">
        {filteredGroups.map(group => {
          const channels = getFilteredChannels(group)
          if (channels.length === 0) return null

          return (
            <div key={group.name} className="bg-gray-800 rounded-lg overflow-hidden">
              <div className="bg-gray-700 px-4 py-3 border-b border-gray-600">
                <h3 className="text-lg font-semibold text-white">
                  {group.name}
                  <span className="ml-2 text-sm text-gray-400">
                    ({channels.length} channels)
                  </span>
                </h3>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {channels.map(channel => {
                    const currentProgram = getCurrentProgram(channel.epgId || channel.name)

                    return (
                      <button
                        key={channel.id}
                        onClick={() => handleChannelClick(channel)}
                        className="flex items-center space-x-3 p-3 bg-gray-900 hover:bg-gray-700 rounded-lg transition-colors text-left"
                      >
                        {channel.logo ? (
                          <img
                            src={channel.logo}
                            alt={channel.name}
                            className="w-10 h-10 rounded object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gray-600 rounded flex items-center justify-center">
                            <span className="text-xs font-bold">
                              {channel.name.substring(0, 2).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-white truncate">
                            {channel.name}
                          </h4>
                          {currentProgram ? (
                            <div className="text-sm">
                              <p className="text-green-400 truncate">
                                ● {currentProgram.title}
                              </p>
                              {currentProgram.category && (
                                <p className="text-gray-500 text-xs truncate">
                                  {currentProgram.category}
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-400 truncate">
                              Click to play
                            </p>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {filteredGroups.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400">No channels found matching your criteria</p>
        </div>
      )}
    </div>
  )
}