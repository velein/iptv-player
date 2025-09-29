import { useRef, useEffect } from 'react'
import videojs from 'video.js'
import 'video.js/dist/video-js.css'
import '@videojs/themes/dist/fantasy/index.css'

interface VideoJsPlayerProps {
  src: string
  onTimeUpdate?: (currentTime: number) => void
  onSeek?: (time: number) => void
  onLoadStart?: () => void
  onError?: (error: any) => void
  isLive?: boolean
}

export default function VideoJsPlayer({
  src,
  onTimeUpdate,
  onSeek,
  onLoadStart,
  onError,
  isLive = true
}: VideoJsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<any>(null)

  useEffect(() => {
    if (!videoRef.current) return

    // Initialize Video.js player
    const player = videojs(videoRef.current, {
      controls: true,
      responsive: true,
      fluid: true,
      fill: true,
      playbackRates: [0.5, 1, 1.25, 1.5, 2],
      techOrder: ['html5'],
      html5: {
        vhs: {
          enableLowInitialPlaylist: true,
          smoothQualityChange: true,
          overrideNative: true
        },
        nativeAudioTracks: false,
        nativeVideoTracks: false
      },
      liveui: isLive,
      liveTracker: isLive ? {
        trackingThreshold: 20,
        liveTolerance: 15
      } : false,
      userActions: {
        hotkeys: true
      }
    })

    playerRef.current = player

    // Event listeners
    player.on('loadstart', () => {
      console.log('Video.js: Load started')
      onLoadStart?.()
    })

    player.on('error', (e: any) => {
      const error = player.error()
      console.error('Video.js error:', error)
      onError?.(error)
    })

    player.on('timeupdate', () => {
      const currentTime = player.currentTime()
      onTimeUpdate?.(currentTime)
    })

    player.on('seeked', () => {
      const currentTime = player.currentTime()
      console.log('Video.js: Seeked to', currentTime)
      onSeek?.(currentTime)
    })

    // Load the source
    player.ready(() => {
      console.log('Video.js player ready, setting source:', src)
      player.src({
        src: src,
        type: getVideoType(src)
      })
    })

    return () => {
      if (playerRef.current) {
        playerRef.current.dispose()
        playerRef.current = null
      }
    }
  }, [])

  // Update source when it changes
  useEffect(() => {
    if (playerRef.current && src) {
      console.log('Video.js: Updating source to', src)
      playerRef.current.src({
        src: src,
        type: getVideoType(src)
      })
    }
  }, [src])

  // Update live UI when isLive changes
  useEffect(() => {
    if (playerRef.current) {
      if (isLive) {
        playerRef.current.addClass('vjs-live')
      } else {
        playerRef.current.removeClass('vjs-live')
      }
    }
  }, [isLive])

  const getVideoType = (url: string): string => {
    if (url.includes('.m3u8')) {
      return 'application/x-mpegURL'
    } else if (url.includes('.mp4')) {
      return 'video/mp4'
    } else if (url.includes('.webm')) {
      return 'video/webm'
    }
    return 'application/x-mpegURL' // Default to HLS
  }

  return (
    <div className="video-js-container w-full" style={{ backgroundColor: '#000' }}>
      <video
        ref={videoRef}
        className="video-js vjs-theme-fantasy vjs-big-play-centered"
        controls
        preload="auto"
        data-setup="{}"
        style={{ width: '100%', height: '100%' }}
      >
        <p className="vjs-no-js">
          To view this video please enable JavaScript, and consider upgrading to a web browser that{' '}
          <a href="https://videojs.com/html5-video-support/" target="_blank" rel="noopener noreferrer">
            supports HTML5 video
          </a>.
        </p>
      </video>
    </div>
  )
}