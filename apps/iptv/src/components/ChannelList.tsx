import { useNavigate } from '@tanstack/react-router'
import { usePlaylist } from '../hooks/usePlaylist'

// Simple ChannelList component for backward compatibility
// This is used in the old routing structure
export default function ChannelList() {
  const { playlist } = usePlaylist()
  const navigate = useNavigate()

  // Handle channel click
  const handleChannelClick = (channelId: string) => {
    navigate({ to: `/player/${channelId}` })
  }

  // If no playlist, show message
  if (!playlist) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-8 text-center">
        <div className="text-4xl mb-4 text-gray-500">📺</div>
        <h3 className="text-xl font-semibold text-white mb-2">No Playlist Loaded</h3>
        <p className="text-gray-400 text-sm">
          Load a playlist to see available channels
        </p>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700">
      <div className="p-4 border-b border-gray-700">
        <h3 className="text-lg font-semibold text-white">All Channels</h3>
        <p className="text-xs text-gray-400 mt-1">
          {playlist.channels.length} channel{playlist.channels.length !== 1 ? 's' : ''} available
        </p>
      </div>
      
      <div className="overflow-y-auto max-h-96">
        <div className="p-2 space-y-1">
          {playlist.channels.map((channel) => (
            <button
              key={channel.id}
              onClick={() => handleChannelClick(channel.id)}
              className="w-full text-left p-3 rounded-lg transition-all duration-200 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-300 hover:text-white"
            >
              <div className="flex items-center space-x-3">
                {/* Channel Logo */}
                <div className="flex-shrink-0 w-10 h-10 bg-gray-700 rounded-lg overflow-hidden flex items-center justify-center">
                  {channel.logo ? (
                    <img
                      src={channel.logo}
                      alt={channel.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="text-gray-400 text-xs font-bold">
                      {channel.name.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Channel Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-200 truncate">
                    {channel.name}
                  </h4>
                  {channel.group && (
                    <p className="text-xs text-gray-500 truncate">
                      {channel.group}
                    </p>
                  )}
                </div>

                {/* Indicators */}
                <div className="flex items-center space-x-1">
                  {channel.epgId && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-green-600 text-green-100">
                      EPG
                    </span>
                  )}
                  {channel.timeshift && channel.timeshift > 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-purple-600 text-purple-100">
                      Catchup
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}