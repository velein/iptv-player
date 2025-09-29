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
  const seekbarRef = useRef<HTMLDivElement>(null)

  // Calculate position within current program (0 = program start, 1 = program end/now)
  const now = new Date()
  const programStart = currentProgram?.start.getTime() || now.getTime()
  const programEnd = currentProgram ? Math.min(currentProgram.stop.getTime(), now.getTime()) : now.getTime()
  const programDuration = programEnd - programStart
  const currentPosition = Math.max(0, Math.min(1, (currentTime.getTime() - programStart) / programDuration))
  const displayPosition = isDragging ? dragPosition : currentPosition

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!seekbarRef.current || !currentProgram) return

    setIsDragging(true)
    onSeekStart?.()

    const rect = seekbarRef.current.getBoundingClientRect()
    const position = (e.clientX - rect.left) / rect.width
    const clampedPosition = Math.max(0, Math.min(1, position))

    setDragPosition(clampedPosition)

    // Calculate target time within program bounds
    const programStart = currentProgram.start.getTime()
    const programEnd = Math.min(currentProgram.stop.getTime(), now.getTime())
    const targetTime = new Date(programStart + clampedPosition * (programEnd - programStart))

    // If user tries to seek beyond now, go to live
    if (targetTime >= now) {
      onTimeChange(now)
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

    // Calculate target time within program bounds
    const programStart = currentProgram.start.getTime()
    const programEnd = Math.min(currentProgram.stop.getTime(), now.getTime())
    const targetTime = new Date(programStart + clampedPosition * (programEnd - programStart))

    // If user tries to seek beyond now, go to live
    if (targetTime >= now) {
      onTimeChange(now)
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

    const total = programEnd - programStart
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
          className="relative h-2 bg-gray-700 rounded-full cursor-pointer hover:h-3 transition-all"
          onMouseDown={handleMouseDown}
        >
          {/* Progress fill */}
          <div
            className={`absolute top-0 h-full rounded-full transition-all ${
              isLive ? 'bg-red-600' : 'bg-purple-600'
            }`}
            style={{ width: `${displayPosition * 100}%` }}
          />

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
              {formatTimeDisplay(new Date(programStart + dragPosition * (programEnd - programStart)))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}