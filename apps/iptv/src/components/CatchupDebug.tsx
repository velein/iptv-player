import { usePlaylist } from '../hooks/usePlaylist'
import { getCatchupInfo } from '../utils/catchupUtils'

export default function CatchupDebug() {
  const { playlist } = usePlaylist()

  if (!playlist) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4">Catchup Debug</h3>
        <p className="text-gray-400">No playlist loaded</p>
      </div>
    )
  }

  const sampleChannels = playlist.channels.slice(0, 5)

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-4">
      <h3 className="text-lg font-semibold">Catchup Debug - Channel Parsing</h3>

      {sampleChannels.map(channel => {
        const catchupInfo = getCatchupInfo(channel)

        return (
          <div key={channel.id} className="border border-gray-700 rounded p-3 text-sm">
            <div className="font-medium text-white mb-2">{channel.name}</div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <h5 className="text-blue-400 mb-1">Raw Channel Data:</h5>
                <div className="space-y-1 text-gray-300">
                  <div>timeshift: <code className="bg-gray-700 px-1 rounded">{channel.timeshift ?? 'undefined'}</code></div>
                  <div>catchup: <code className="bg-gray-700 px-1 rounded">{channel.catchup ?? 'undefined'}</code></div>
                  <div>epgId: <code className="bg-gray-700 px-1 rounded">{channel.epgId ?? 'undefined'}</code></div>
                </div>
              </div>

              <div>
                <h5 className="text-green-400 mb-1">Processed Catchup Info:</h5>
                <div className="space-y-1 text-gray-300">
                  <div>available: <code className="bg-gray-700 px-1 rounded">{catchupInfo.available.toString()}</code></div>
                  <div>timeshiftHours: <code className="bg-gray-700 px-1 rounded">{catchupInfo.timeshiftHours}</code></div>
                  <div>type: <code className="bg-gray-700 px-1 rounded">{catchupInfo.type}</code></div>
                  <div>startTime: <code className="bg-gray-700 px-1 rounded text-xs">{catchupInfo.startTime.toLocaleString()}</code></div>
                </div>
              </div>
            </div>

            <div className="mt-2 text-xs">
              <span className="text-gray-400">URL Sample:</span>
              <code className="ml-2 bg-gray-700 px-1 rounded text-xs break-all">
                {channel.url.substring(0, 80)}...
              </code>
            </div>
          </div>
        )
      })}

      <div className="text-xs text-gray-500 mt-4">
        <p>Total channels: {playlist.channels.length}</p>
        <p>Catchup enabled: {playlist.channels.filter(c => getCatchupInfo(c).available).length}</p>
      </div>
    </div>
  )
}