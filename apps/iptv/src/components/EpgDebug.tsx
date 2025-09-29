import { useEpg } from '../hooks/useEpg'
import { usePlaylist } from '../hooks/usePlaylist'

export default function EpgDebug() {
  const { epgData, isLoading, error, refreshEpg } = useEpg()
  const { playlist } = usePlaylist()

  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4">EPG Debug</h3>
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
          <p className="text-gray-400">Loading EPG data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4">EPG Debug</h3>
        <div className="space-y-3">
          <div className="text-red-400">
            ❌ EPG Failed to Load: {error.message}
          </div>
          <div className="text-sm text-gray-400">
            <p>• Check browser console for detailed logs</p>
            <p>• Ensure the EPG URL is accessible and returns valid XMLTV data</p>
          </div>
          <button
            onClick={refreshEpg}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm transition-colors"
          >
            🔄 Retry EPG Load
          </button>
        </div>
      </div>
    )
  }

  if (!epgData && !playlist) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4">EPG Debug</h3>
        <p className="text-gray-400">
          Waiting for EPG and playlist data...
        </p>
      </div>
    )
  }

  if (!playlist) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4">EPG Debug</h3>
        <p className="text-gray-400">
          EPG loaded successfully! Please load a playlist to see channel matching.
        </p>
      </div>
    )
  }

  if (!epgData) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4">EPG Debug</h3>
        <p className="text-gray-400">
          EPG data still loading...
        </p>
      </div>
    )
  }

  const sampleEpgChannels = Array.from(epgData.channels.entries()).slice(0, 10)
  const samplePlaylistChannels = playlist.channels.slice(0, 10)

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-4">
      <h3 className="text-lg font-semibold">EPG Debug</h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <h4 className="font-medium text-green-400 mb-2">EPG Channel IDs (sample)</h4>
          <div className="text-xs space-y-1 max-h-40 overflow-y-auto">
            {sampleEpgChannels.map(([id, channel]) => (
              <div key={id} className="text-gray-300">
                <code className="bg-gray-700 px-1 rounded">{id}</code>
                <span className="ml-2 text-gray-400">→ {channel.displayName}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="font-medium text-blue-400 mb-2">Playlist tvg-id values (sample)</h4>
          <div className="text-xs space-y-1 max-h-40 overflow-y-auto">
            {samplePlaylistChannels.map(channel => (
              <div key={channel.id} className="text-gray-300">
                <code className="bg-gray-700 px-1 rounded">{channel.epgId || 'N/A'}</code>
                <span className="ml-2 text-gray-400">→ {channel.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="text-sm text-gray-400">
        <p>EPG Channels: {epgData.channels.size}</p>
        <p>EPG Programs: {epgData.programs.length}</p>
        <p>Playlist Channels: {playlist.channels.length}</p>
      </div>
    </div>
  )
}