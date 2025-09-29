import { useState, useRef, useEffect } from 'react'
import type { Channel } from '../types/channel'
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
  onTimeChange: (time: Date) => void
  onSeekStart?: () => void
  onSeekEnd?: () => void
}

export default function CatchupSeekbar({
  channel,
  currentTime,
  isLive,
  onTimeChange,
  onSeekStart,
  onSeekEnd
}: CatchupSeekbarProps) {
  const { getProgramsForTimeRange } = useEpg()
  const [isDragging, setIsDragging] = useState(false)
  const [dragPosition, setDragPosition] = useState(0)
  const seekbarRef = useRef<HTMLDivElement>(null)

  const timeRange = getCatchupTimeRange(channel)

  if (!timeRange) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="text-center text-gray-400">
          <p className="text-sm">Catchup not available for this channel</p>
          <div className="flex items-center justify-center mt-2">
            <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse mr-2"></div>
            <span className="text-xs">LIVE</span>
          </div>
        </div>
      </div>
    )
  }

  const currentPosition = getRelativeTimePosition(channel, currentTime)
  const displayPosition = isDragging ? dragPosition : currentPosition

  // Get programs in the time range for visual markers
  const programs = getProgramsForTimeRange(channel.epgId || channel.name, timeRange.start, timeRange.end)

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!seekbarRef.current) return

    setIsDragging(true)
    onSeekStart?.()

    const rect = seekbarRef.current.getBoundingClientRect()
    const position = (e.clientX - rect.left) / rect.width
    const clampedPosition = Math.max(0, Math.min(1, position))

    setDragPosition(clampedPosition)
    const targetTime = getTimeFromRelativePosition(channel, clampedPosition)
    onTimeChange(targetTime)
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !seekbarRef.current) return

    const rect = seekbarRef.current.getBoundingClientRect()
    const position = (e.clientX - rect.left) / rect.width
    const clampedPosition = Math.max(0, Math.min(1, position))

    setDragPosition(clampedPosition)
    const targetTime = getTimeFromRelativePosition(channel, clampedPosition)
    onTimeChange(targetTime)
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

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-3">
      {/* Header with time info */}
      <div className="flex items-center justify-between text-sm">
        <div className="text-gray-400">
          {formatTimeDisplay(timeRange.start)}
        </div>
        <div className="flex items-center space-x-4">
          <div className={`text-center ${isLive ? 'text-green-400' : 'text-blue-400'}`}>
            <div className="font-medium">
              {isLive ? 'LIVE' : formatTimeDisplay(currentTime)}
            </div>
            {!isLive && (
              <div className="text-xs text-gray-500">
                {Math.round((new Date().getTime() - currentTime.getTime()) / (1000 * 60))} min ago
              </div>
            )}
          </div>
          <button
            onClick={handleGoLive}
            disabled={isLive}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              isLive
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            GO LIVE
          </button>
        </div>
        <div className="text-gray-400">
          NOW
        </div>
      </div>

      {/* Seekbar */}
      <div className="relative">
        <div
          ref={seekbarRef}
          className="relative h-8 bg-gray-700 rounded-full cursor-pointer hover:bg-gray-600 transition-colors"
          onMouseDown={handleMouseDown}
        >
          {/* Program markers */}
          {programs.map(program => {
            const startPos = getRelativeTimePosition(channel, program.start)
            const endPos = getRelativeTimePosition(channel, program.stop)
            const width = (endPos - startPos) * 100

            if (width < 0.5) return null // Skip very short programs

            return (
              <div
                key={program.id}
                className="absolute top-0 h-full bg-gradient-to-r from-blue-500/30 to-purple-500/30 rounded-full border-l border-r border-blue-400/50"
                style={{
                  left: `${startPos * 100}%`,
                  width: `${width}%`
                }}
                title={program.title}
              />
            )
          })}

          {/* Progress fill */}
          <div
            className={`absolute top-0 h-full rounded-full transition-all ${
              isLive ? 'bg-gradient-to-r from-red-500 to-red-600' : 'bg-gradient-to-r from-blue-500 to-blue-600'
            }`}
            style={{ width: `${displayPosition * 100}%` }}
          />

          {/* Seek handle */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 transition-all ${
              isLive
                ? 'bg-red-500 border-red-300'
                : 'bg-blue-500 border-blue-300'
            } ${
              isDragging ? 'scale-125 shadow-lg' : 'hover:scale-110'
            }`}
            style={{ left: `calc(${displayPosition * 100}% - 12px)` }}
          />

          {/* Live indicator */}
          <div className="absolute top-1/2 -translate-y-1/2 right-2 flex items-center space-x-1">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-red-400 font-medium">LIVE</span>
          </div>
        </div>

        {/* Program preview on hover */}
        {isDragging && (
          <div className="absolute -top-16 bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm whitespace-nowrap z-10"
            style={{ left: `calc(${dragPosition * 100}% - 50px)` }}>
            <div className="text-white font-medium">
              {formatTimeDisplay(getTimeFromRelativePosition(channel, dragPosition))}
            </div>
            <div className="text-gray-400 text-xs">
              {dragPosition === 1 ? 'Live' : 'Catchup'}
            </div>
          </div>
        )}
      </div>

      {/* Catchup info */}
      <div className="text-xs text-gray-500 text-center">
        <span>Catchup available: {channel.timeshift} hours</span>
        {channel.catchup && (
          <span className="ml-2">• Type: {channel.catchup}</span>
        )}
      </div>
    </div>
  )
}