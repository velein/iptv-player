import { useState, useRef, useEffect } from 'react'
import type { Channel } from '../types/channel'
import type { EpgProgram } from '../types/epg'
import { useEpg } from '../hooks/useEpg'
import {
  getCatchupTimeRange,
  getRelativeTimePosition,
  getTimeFromRelativePosition,
  isTimeWithinCatchup
} from '../utils/catchupUtils'

interface CatchupSeekbarProps {
  channel: Channel
  currentTime: Date
  isLive: boolean
  currentProgram: EpgProgram | null
  onTimeChange: (time: Date) => void
  onSeekStart?: () => void
  onSeekEnd?: () => void
}

export default function CatchupSeekbar({
  channel,
  currentTime,
  isLive,
  currentProgram,
  onTimeChange,
  onSeekStart,
  onSeekEnd
}: CatchupSeekbarProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragPosition, setDragPosition] = useState(0)
  const [hoverPosition, setHoverPosition] = useState<number | null>(null)
  const [showHoverTooltip, setShowHoverTooltip] = useState(false)
  const seekbarRef = useRef<HTMLDivElement>(null)

  // Calculate position within current program
  const now = new Date()
  const programStart = currentProgram?.start.getTime() || now.getTime()
  const programEnd = currentProgram?.stop.getTime() || now.getTime() // Full program end time
  const programDuration = programEnd - programStart // Full program duration
  const livePoint = Math.min(programEnd, now.getTime()) // How far we can actually seek (up to now or program end)
  
  // Position calculation based on full program duration for proper visual representation
  const currentPosition = Math.max(0, Math.min(1, (currentTime.getTime() - programStart) / programDuration))
  const livePosition = Math.max(0, Math.min(1, (livePoint - programStart) / programDuration)) // Where "live" is on the bar
  
  // When watching live, the current position should match the live position
  const adjustedCurrentPosition = isLive ? livePosition : currentPosition
  const displayPosition = isDragging ? dragPosition : adjustedCurrentPosition

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!seekbarRef.current || !currentProgram) return

    setIsDragging(true)
    onSeekStart?.()

    const rect = seekbarRef.current.getBoundingClientRect()
    const position = (e.clientX - rect.left) / rect.width
    const clampedPosition = Math.max(0, Math.min(1, position))

    setDragPosition(clampedPosition)

    // Calculate target time based on full program duration
    const targetTime = new Date(programStart + clampedPosition * programDuration)

    // If user tries to seek beyond live point, go to live
    if (targetTime >= livePoint) {
      onTimeChange(new Date(livePoint))
    } else {
      onTimeChange(targetTime)
    }
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !seekbarRef.current || !currentProgram) return

    const rect = seekbarRef.current.getBoundingClientRect()
    const position = (e.clientX - rect.left) / rect.width
    const clampedPosition = Math.max(0, Math.min(1, position))

    setDragPosition(clampedPosition)

    // Calculate target time based on full program duration
    const targetTime = new Date(programStart + clampedPosition * programDuration)

    // If user tries to seek beyond live point, go to live
    if (targetTime >= livePoint) {
      onTimeChange(new Date(livePoint))
    } else {
      onTimeChange(targetTime)
    }
  }

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false)
      onSeekEnd?.()
    }
  }

  const handleMouseEnter = () => {
    setShowHoverTooltip(true)
  }

  const handleMouseLeave = () => {
    setShowHoverTooltip(false)
    setHoverPosition(null)
  }

  const handleMouseHover = (e: React.MouseEvent) => {
    if (!seekbarRef.current || !currentProgram || isDragging) return

    const rect = seekbarRef.current.getBoundingClientRect()
    const position = (e.clientX - rect.left) / rect.width
    const clampedPosition = Math.max(0, Math.min(1, position))
    setHoverPosition(clampedPosition)
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)

      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging])

  const formatTimeDisplay = (date: Date) => {
    return date.toLocaleTimeString('pl-PL', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleGoLive = () => {
    onTimeChange(new Date())
  }

  // Helper to calculate program progress
  const getProgramProgress = () => {
    if (!currentProgram) return { elapsed: '0:00', total: '0:00' }

    const total = programDuration
    const elapsed = Math.max(0, currentTime.getTime() - programStart)

    const formatDuration = (ms: number) => {
      const totalSeconds = Math.floor(ms / 1000)
      const hours = Math.floor(totalSeconds / 3600)
      const minutes = Math.floor((totalSeconds % 3600) / 60)
      const seconds = totalSeconds % 60

      if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      }
      return `${minutes}:${seconds.toString().padStart(2, '0')}`
    }

    return {
      elapsed: formatDuration(elapsed),
      total: formatDuration(total),
    }
  }

  const programProgress = getProgramProgress()

  // Helper to get program minute from position
  const getProgramMinuteFromPosition = (position: number) => {
    if (!currentProgram) return { minute: 0, timeDisplay: '0:00' }

    const targetTime = new Date(programStart + position * programDuration)
    
    // Calculate minutes from program start
    const minutesFromStart = Math.floor((targetTime.getTime() - programStart) / (1000 * 60))
    
    // Format time display
    const timeDisplay = targetTime.toLocaleTimeString('pl-PL', {
      hour: '2-digit',
      minute: '2-digit'
    })

    return { minute: minutesFromStart + 1, timeDisplay } // +1 for 1-based minute counting
  }

  // If no program, just show live indicator
  if (!currentProgram) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="text-center text-gray-400">
          <p className="text-sm">No EPG data available</p>
          <div className="flex items-center justify-center mt-2">
            <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse mr-2"></div>
            <span className="text-xs">LIVE</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
      {/* Compact header with program info and times */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center flex-wrap gap-2 flex-1 min-w-0">
          {/* Program Title */}
          <h3 className="text-base font-semibold text-white truncate">
            {currentProgram.title}
          </h3>

          {/* Program Time Range */}
          <span className="text-sm text-gray-400 whitespace-nowrap">
            {formatTimeDisplay(currentProgram.start)} - {formatTimeDisplay(new Date(programEnd))}
          </span>

          {/* Mode Indicator */}
          <span className={`px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap ${
            isLive
              ? 'bg-red-600 text-white'
              : 'bg-purple-600 text-white'
          }`}>
            {isLive ? 'LIVE' : 'CATCHUP'}
          </span>

          {/* Go Live Button - only show when watching catchup */}
          {!isLive && (
            <button
              onClick={handleGoLive}
              className="px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap bg-red-600 text-white hover:bg-red-700 transition-colors"
            >
              Go Live
            </button>
          )}
        </div>

        {/* Current Time Display */}
        <div className="flex items-center space-x-2 text-sm whitespace-nowrap ml-4">
          <span className="text-gray-400">
            {isLive ? 'Live:' : 'Catchup:'}
          </span>
          <span className={isLive ? 'text-red-400 font-medium' : 'text-purple-400 font-medium'}>
            {formatTimeDisplay(currentTime)}
          </span>
        </div>
      </div>

      {/* Compact Seekbar */}
      <div className="relative">
        <div
          ref={seekbarRef}
          className="relative h-2 bg-gray-700 rounded-full cursor-pointer"
          onMouseDown={handleMouseDown}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onMouseMove={handleMouseHover}
        >
          {/* Background for full program duration */}
          <div className="absolute top-0 h-full w-full bg-gray-600 rounded-full opacity-30" />
          
          {/* Available/seekable portion */}
          <div
            className="absolute top-0 h-full bg-gray-500 rounded-full opacity-50"
            style={{ width: `${livePosition * 100}%` }}
          />
          
          {/* Progress fill */}
          <div
            className={`absolute top-0 h-full rounded-full transition-all ${
              isLive ? 'bg-red-600' : 'bg-purple-600'
            }`}
            style={{ width: `${displayPosition * 100}%` }}
          />

          {/* Live point indicator - show where live/current time is */}
          {livePosition < 1 && (
            <div
              className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-red-400 border border-white shadow-sm"
              style={{ left: `calc(${livePosition * 100}% - 4px)` }}
              title="Live point"
            />
          )}

          {/* Seek handle - only show on hover */}
          {isDragging && (
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-lg"
              style={{ left: `calc(${displayPosition * 100}% - 6px)` }}
            />
          )}
        </div>

        {/* Time preview on drag */}
        {isDragging && currentProgram && (
          <div className="absolute -top-12 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs whitespace-nowrap z-10"
            style={{ left: `calc(${dragPosition * 100}% - 40px)` }}>
            <div className="text-white font-medium">
              {formatTimeDisplay(new Date(programStart + dragPosition * programDuration))}
            </div>
          </div>
        )}

        {/* Hover tooltip showing time */}
        {showHoverTooltip && hoverPosition !== null && currentProgram && !isDragging && (
          <div className="absolute -top-12 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs whitespace-nowrap z-10 shadow-lg"
            style={{ left: `calc(${hoverPosition * 100}% - 30px)` }}>
            <div className="text-white font-medium">
              {getProgramMinuteFromPosition(hoverPosition).timeDisplay}
            </div>
            {/* Tooltip arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-600"></div>
          </div>
        )}
      </div>
    </div>
  )
}