import { useRef, useEffect, useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { usePlaylist } from '../hooks/usePlaylist'
import { useEpg } from '../hooks/useEpg'
import type { Channel } from '../types/channel'
import type { EpgProgram } from '../types/epg'
import ChannelEpg from './ChannelEpg'
import CatchupSeekbar from './CatchupSeekbar'
import Hls from 'hls.js'
import {
  getCatchupInfo,
  generateCatchupUrl,
  isTimeWithinCatchup
} from '../utils/catchupUtils'

export default function VideoPlayer() {
  const { channelId } = useParams({ strict: false })
  const channelIdStr = channelId as string
  const navigate = useNavigate()
  const { playlist } = usePlaylist()
  const { getCurrentProgram } = useEpg()
  const [error, setError] = useState<string | null>(null)
  const [showEpg, setShowEpg] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isLive, setIsLive] = useState(true)
  const [isSeekbarVisible, setIsSeekbarVisible] = useState(true) // Show by default
  const [currentStreamUrl, setCurrentStreamUrl] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(0.8)

  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)

  const channel = playlist?.channels.find(c => c.id === channelIdStr)
  const currentProgram = channel ? getCurrentProgram(channel.epgId || channel.name) : null
  const catchupInfo = channel ? getCatchupInfo(channel) : null

  // Load stream at specific time
  const loadStreamAtTime = (targetTime: Date) => {
    if (!channel) return

    const streamUrl = generateCatchupUrl(channel, targetTime)
    const isTargetLive = Math.abs(targetTime.getTime() - new Date().getTime()) < 30000 // Within 30 seconds

    console.log('Loading stream at time:', targetTime.toISOString(), 'URL:', streamUrl)

    setCurrentTime(targetTime)
    setIsLive(isTargetLive)
    setCurrentStreamUrl(streamUrl)
    setError(null)
  }

  const handleProgramPlay = (program: EpgProgram) => {
    console.log('=== EPG Program Play Attempt ===')
    console.log('Program:', program.title)
    console.log('Program start:', program.start.toISOString())
    console.log('Program start (local):', program.start.toLocaleString('pl-PL'))
    console.log('Program stop:', program.stop.toISOString())
    console.log('Program stop (local):', program.stop.toLocaleString('pl-PL'))
    console.log('Current time:', new Date().toISOString())
    console.log('Current time (local):', new Date().toLocaleString('pl-PL'))
    console.log('Channel:', channel?.name)
    console.log('Channel timeshift:', channel?.timeshift)
    console.log('Channel catchup:', channel?.catchup)

    if (!channel) {
      console.log('ERROR: No channel found')
      alert('Channel not found')
      return
    }

    // Add detailed timezone debugging
    const now = new Date()
    const programStartTime = program.start
    const timeDiffHours = (now.getTime() - programStartTime.getTime()) / (1000 * 60 * 60)

    console.log('Time difference (hours):', timeDiffHours.toFixed(2))
    console.log('Program start timezone offset:', programStartTime.getTimezoneOffset())
    console.log('Current time timezone offset:', now.getTimezoneOffset())

    const catchupAvailable = isTimeWithinCatchup(channel, program.start)
    console.log('Catchup available for this program:', catchupAvailable)

    if (!catchupAvailable) {
      console.log('ERROR: Program not available for catchup')
      alert(`This program is not available for catchup.\n\nProgram: ${program.title}\nStart: ${program.start.toLocaleString('pl-PL')}\nTime diff: ${timeDiffHours.toFixed(1)}h ago\nChannel timeshift: ${channel.timeshift}h\nCatchup type: ${channel.catchup}`)
      return
    }

    console.log('SUCCESS: Playing program from start:', program.title, program.start.toISOString())
    loadStreamAtTime(program.start)
  }

  const handleTimeChange = (time: Date) => {
    loadStreamAtTime(time)
  }

  // Initialize with live stream when channel loads
  useEffect(() => {
    if (channel && !currentStreamUrl) {
      console.log('Initializing live stream for channel:', channel.name)
      setCurrentStreamUrl(channel.url)
      setCurrentTime(new Date())
      setIsLive(true)
    }
  }, [channel, currentStreamUrl])

  // Initialize stream when URL changes
  useEffect(() => {
    if (currentStreamUrl) {
      initializeStream()
    }
  }, [currentStreamUrl])

  // Video event handlers
  useEffect(() => {
    if (!videoRef.current) return

    const video = videoRef.current

    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleLoadStart = () => {
      console.log('Video load started')
      setError(null)
    }
    const handleError = (e: Event) => {
      console.error('Video error:', e)
      setError('Failed to load video stream')
    }

    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('loadstart', handleLoadStart)
    video.addEventListener('error', handleError)
    video.volume = volume

    return () => {
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('loadstart', handleLoadStart)
      video.removeEventListener('error', handleError)
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [])

  const handlePlayPause = () => {
    if (!videoRef.current) return

    if (isPlaying) {
      videoRef.current.pause()
    } else {
      console.log('Attempting to play video')
      videoRef.current.play().catch((error) => {
        console.error('Play failed:', error)
        setError(`Failed to play stream: ${error.message || 'Unknown error'}`)
      })
    }
  }

  const handleRetry = () => {
    if (!videoRef.current) return

    console.log('Retrying stream load')
    setError(null)

    // Clean up existing HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    // Re-initialize the stream
    initializeStream()
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    if (videoRef.current) {
      videoRef.current.volume = newVolume
    }
  }

  const initializeStream = () => {
    if (!videoRef.current || !currentStreamUrl) return

    const video = videoRef.current
    console.log('Initializing stream:', currentStreamUrl)

    // For some IPTV providers, we might need to handle CORS
    // Try direct first, fallback to cors proxy if needed
    let streamUrl = currentStreamUrl

    // Clean up existing HLS
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    if (currentStreamUrl.includes('.m3u8') && Hls.isSupported()) {
      // Use HLS.js for m3u8 streams
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false, // Disable for IPTV streams
        backBufferLength: 30,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10,
        xhrSetup: function(xhr, url) {
          // Handle CORS for IPTV streams
          xhr.withCredentials = false
        },
        fetchSetup: function(context, initParams) {
          // Handle fetch CORS for IPTV streams
          initParams.mode = 'cors'
          initParams.credentials = 'omit'
          return new Request(context.url, initParams)
        }
      })

      hlsRef.current = hls

      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        console.log('HLS: Media attached')
      })

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('HLS: Manifest parsed, starting playback')
        video.play().catch(err => {
          console.error('Auto-play failed:', err)
        })
      })

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS Error:', data)
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('Trying to recover from network error...')
              hls.startLoad()
              break
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('Trying to recover from media error...')
              hls.recoverMediaError()
              break
            default:
              console.log('Fatal error, trying native video fallback...')
              // Try native video as fallback
              hls.destroy()
              hlsRef.current = null
              video.src = currentStreamUrl
              video.load()
              break
          }
        }
      })

      hls.loadSource(streamUrl)
      hls.attachMedia(video)
    } else {
      // Direct video source
      video.src = streamUrl
      video.load()
    }
  }

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

  if (!channel) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 mb-4">Channel not found</p>
        <button
          onClick={() => navigate({ to: '/channels' })}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors"
        >
          Back to Channels
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate({ to: '/channels' })}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
          >
            ← Back to Channels
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{channel.name}</h1>
            <div className="space-y-1">
              {currentProgram ? (
                <div className="text-sm text-gray-300">
                  <span className={isLive ? 'text-green-400' : 'text-orange-400'}>
                    {isLive ? '● LIVE:' : '◄ CATCHUP:'}
                  </span> {currentProgram.title}
                  {currentProgram.category && (
                    <span className="ml-2 text-gray-400">• {currentProgram.category}</span>
                  )}
                </div>
              ) : channel.group && (
                <p className="text-gray-400">{channel.group}</p>
              )}
              {catchupInfo?.available && !isLive && (
                <div className="text-xs text-orange-400">
                  Watching from {currentTime.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
              {catchupInfo?.available && (
                <div className="text-xs text-gray-500">
                  Catchup: {catchupInfo.timeshiftHours >= 24
                    ? `${Math.floor(catchupInfo.timeshiftHours / 24)} days`
                    : `${catchupInfo.timeshiftHours}h`} available
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {catchupInfo?.available && (
              <button
                onClick={() => setIsSeekbarVisible(!isSeekbarVisible)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded transition-colors"
              >
                {isSeekbarVisible ? 'Hide Seekbar' : 'Show Seekbar'}
              </button>
            )}
            <button
              onClick={() => setShowEpg(!showEpg)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
            >
              {showEpg ? 'Hide EPG' : 'Show EPG'}
            </button>
          </div>
        </div>
        {channel.logo && (
          <img
            src={channel.logo}
            alt={channel.name}
            className="w-16 h-16 rounded object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        )}
      </div>

      {/* Main Content Area - Side by Side */}
      <div className="flex gap-4">
        {/* Left Side - Video Player */}
        <div className="flex-1">
          <div className="bg-black rounded-lg overflow-hidden">
            <div className="relative aspect-video">
              <video
                ref={videoRef}
                className="w-full h-full"
                controls
                playsInline
                muted={false}
                crossOrigin="anonymous"
              />
              {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-90 z-10">
                  <div className="text-center">
                    <p className="text-red-400 mb-4">{error}</p>
                    <div className="space-x-2">
                      <button
                        onClick={handleRetry}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
                      >
                        Retry Stream
                      </button>
                      <button
                        onClick={() => window.open(channel?.url, '_blank')}
                        className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition-colors"
                      >
                        Open in New Tab
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Custom Controls */}
            <div className="bg-gray-800 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={handlePlayPause}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
                  >
                    {isPlaying ? '⏸️ Pause' : '▶️ Play'}
                  </button>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-400">🔊</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={volume}
                      onChange={handleVolumeChange}
                      className="w-20"
                    />
                    <span className="text-sm text-gray-400 w-8">
                      {Math.round(volume * 100)}%
                    </span>
                  </div>
                </div>
                <div className="text-sm text-gray-400">
                  {isLive ? '🔴 LIVE' : '📺 CATCHUP'} • {isPlaying ? 'Playing' : 'Stopped'}
                </div>
              </div>
            </div>
          </div>

          {/* Catchup Seekbar */}
          {isSeekbarVisible && catchupInfo?.available && channel && (
            <div className="mt-4">
              <CatchupSeekbar
                channel={channel}
                currentTime={currentTime}
                isLive={isLive}
                onTimeChange={handleTimeChange}
                onSeekStart={() => console.log('Seek started')}
                onSeekEnd={() => console.log('Seek ended')}
              />
            </div>
          )}

          {/* Channel Info */}
          <div className="bg-gray-800 rounded-lg p-4 mt-4">
            <h3 className="text-lg font-semibold mb-2">Channel Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Name:</span> {channel.name}
              </div>
              {channel.group && (
                <div>
                  <span className="text-gray-400">Group:</span> {channel.group}
                </div>
              )}
              {channel.epgId && (
                <div>
                  <span className="text-gray-400">EPG ID:</span> {channel.epgId}
                </div>
                )}
              <div className="md:col-span-2">
                <span className="text-gray-400">Stream URL:</span>
                <code className="ml-2 text-xs bg-gray-700 px-2 py-1 rounded break-all">
                  {channel.url}
                </code>
              </div>
              {channel.url.includes('.m3u8') && (
                <div className="md:col-span-2">
                  <div className="text-green-400 text-xs mb-1">
                    📡 HLS Stream {Hls.isSupported() ? '(HLS.js enabled)' : '(Native support)'}
                  </div>
                  {!Hls.isSupported() && (
                    <div className="text-orange-400 text-xs">
                      ⚠️ For best compatibility, use Chrome, Firefox, or Edge
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side - EPG */}
        {showEpg && channel && (
          <div className="w-96 flex-shrink-0">
            <ChannelEpg
              channel={channel}
              showCurrentOnly={false}
              onProgramPlay={handleProgramPlay}
            />
          </div>
        )}
      </div>
    </div>
  )
}