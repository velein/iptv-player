import { useMemo, memo, useState } from 'react'
import type { Channel } from '../types/channel'
import type { EpgProgram } from '../types/epg'
import type { ProgramDisplay } from '../types/channelBrowser'
import { useEpg } from '../hooks/useEpg'
import { 
  createProgramDisplay, 
  getCurrentAndUpcomingPrograms,
  formatProgramTime,
  formatProgramDuration,
  getProgramProgress
} from '../utils/programUtils'

interface ChannelEpgListProps {
  channel: Channel | null
  onProgramSelect: (program: EpgProgram, channelId: string) => void
  isLoading?: boolean
  className?: string
}

const ChannelEpgList = memo(function ChannelEpgList({
  channel,
  onProgramSelect,
  isLoading = false,
  className = ''
}: ChannelEpgListProps) {
  const { getChannelPrograms, getProgramsForTimeRange } = useEpg()

  // State for selected day
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [selectedDate, setSelectedDate] = useState<Date>(today)

  // Get all programs for the selected channel
  const allPrograms = useMemo(() => {
    if (!channel?.epgId) return []
    return getChannelPrograms(channel.epgId)
  }, [channel?.epgId, getChannelPrograms])

  // Get unique days from available programs
  const availableDays = useMemo(() => {
    const days = new Set<string>()
    allPrograms.forEach((program) => {
      const dayKey = new Date(program.start)
      dayKey.setHours(0, 0, 0, 0)
      days.add(dayKey.toISOString())
    })
    return Array.from(days)
      .map((dateStr) => new Date(dateStr))
      .sort((a, b) => a.getTime() - b.getTime())
  }, [allPrograms])

  // Helper to format day label
  const formatDayLabel = (date: Date) => {
    const todayDate = new Date()
    todayDate.setHours(0, 0, 0, 0)
    const tomorrow = new Date(todayDate)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const yesterday = new Date(todayDate)
    yesterday.setDate(yesterday.getDate() - 1)

    const checkDate = new Date(date)
    checkDate.setHours(0, 0, 0, 0)

    if (checkDate.getTime() === todayDate.getTime()) {
      return 'Today'
    } else if (checkDate.getTime() === tomorrow.getTime()) {
      return 'Tomorrow'
    } else if (checkDate.getTime() === yesterday.getTime()) {
      return 'Yesterday'
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    }
  }

  // Get programs for the selected day
  const programs = useMemo(() => {
    if (!channel?.epgId || !allPrograms.length) return []
    
    const startDate = new Date(selectedDate)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(selectedDate)
    endDate.setHours(23, 59, 59, 999)

    return allPrograms.filter(program => 
      program.start >= startDate && program.start <= endDate
    )
  }, [channel?.epgId, allPrograms, selectedDate])

  // Filter and enhance programs for display
  const displayPrograms = useMemo(() => {
    if (!programs.length) return []
    
    const hasCatchup = !!(channel?.timeshift && channel.timeshift > 0)
    
    return programs
      .slice(0, 50) // Show more programs since we're filtering by day
      .map(program => createProgramDisplay(program, hasCatchup))
  }, [programs, channel?.timeshift])

  // Handle program selection
  const handleProgramClick = (program: ProgramDisplay) => {
    if (!channel || !program.isClickable) return
    onProgramSelect(program, channel.id)
  }

  // Get status styling
  const getStatusStyling = (status: string, isSelected: boolean = false) => {
    switch (status) {
      case 'live':
        return isSelected 
          ? 'bg-red-500 text-white' 
          : 'bg-red-600 text-red-100'
      case 'upcoming':
        return isSelected 
          ? 'bg-blue-500 text-white' 
          : 'bg-blue-600 text-blue-100'
      case 'ended':
        return isSelected 
          ? 'bg-gray-500 text-white' 
          : 'bg-gray-600 text-gray-100'
      default:
        return 'bg-gray-600 text-gray-100'
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={`bg-gray-800 rounded-lg border border-gray-700 ${className}`}>
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">EPG Programs</h2>
        </div>
        <div className="p-4 space-y-3">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="animate-pulse">
              <div className="h-16 bg-gray-700 rounded-lg"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // No channel selected state
  if (!channel) {
    return (
      <div className={`bg-gray-800 rounded-lg border border-gray-700 ${className}`}>
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">EPG Programs</h2>
        </div>
        <div className="p-8 text-center">
          <div className="text-4xl mb-4 text-gray-500">👈</div>
          <p className="text-gray-400 text-sm">Select a channel to view programs</p>
          <p className="text-gray-500 text-xs mt-2">
            Choose a channel from the middle panel
          </p>
        </div>
      </div>
    )
  }

  // No EPG data state
  if (!channel.epgId) {
    return (
      <div className={`bg-gray-800 rounded-lg border border-gray-700 ${className}`}>
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">EPG Programs</h2>
          <p className="text-xs text-gray-400 mt-1">
            {channel.name}
          </p>
        </div>
        <div className="p-8 text-center">
          <div className="text-4xl mb-4 text-gray-500">📺</div>
          <p className="text-gray-400 text-sm">No EPG data available</p>
          <p className="text-gray-500 text-xs mt-2">
            This channel doesn't have program guide information
          </p>
          <button
            onClick={() => onProgramSelect({} as EpgProgram, channel.id)}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
          >
            Watch Live
          </button>
        </div>
      </div>
    )
  }

  // No programs available state
  if (!displayPrograms.length) {
    return (
      <div className={`bg-gray-800 rounded-lg border border-gray-700 ${className}`}>
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">EPG Programs</h2>
          <p className="text-xs text-gray-400 mt-1">
            {channel.name}
          </p>
        </div>
        <div className="p-8 text-center">
          <div className="text-4xl mb-4 text-gray-500">📅</div>
          <p className="text-gray-400 text-sm">No programs found</p>
          <p className="text-gray-500 text-xs mt-2">
            No program data available for the next 24 hours
          </p>
          <button
            onClick={() => onProgramSelect({} as EpgProgram, channel.id)}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
          >
            Watch Live
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-gray-800 rounded-lg border border-gray-700 flex flex-col ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-700 space-y-3 flex-shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-white">EPG Programs</h2>
          <p className="text-xs text-gray-400 mt-1">
            {channel.name} • {displayPrograms.length} program{displayPrograms.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Day selector */}
        {availableDays.length > 1 && (
          <div>
            <label className="text-xs text-gray-400 block mb-1">
              Select Day:
            </label>
            <select
              value={selectedDate.toISOString()}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {availableDays.map((date) => (
                <option key={date.toISOString()} value={date.toISOString()}>
                  {formatDayLabel(date)} - {date.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Programs List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-1">
          {displayPrograms.map((program, index) => {
            const progress = program.status === 'live' ? getProgramProgress(program) : 0
            
            return (
              <button
                key={`${program.channelId}-${program.start.getTime()}-${index}`}
                onClick={() => handleProgramClick(program)}
                disabled={!program.isClickable}
                className={`w-full text-left p-3 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  program.isClickable
                    ? 'hover:bg-gray-700 cursor-pointer'
                    : 'cursor-not-allowed opacity-60'
                } ${program.status === 'live' ? 'bg-gray-750' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {/* Program Title and Status */}
                    <div className="flex items-center space-x-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap ${
                        getStatusStyling(program.status)
                      }`}>
                        {program.status.toUpperCase()}
                      </span>
                      
                      {program.status === 'live' && (
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                      )}
                    </div>

                    <h3 className="font-medium text-gray-200 truncate mb-1">
                      {program.title}
                    </h3>

                    {/* Program Description */}
                    {program.description && (
                      <p className="text-sm text-gray-400 line-clamp-2 mb-2">
                        {program.description}
                      </p>
                    )}

                    {/* Program Time and Duration */}
                    <div className="flex items-center space-x-3 text-xs text-gray-500">
                      <span>{formatProgramTime(program)}</span>
                      <span>•</span>
                      <span>{formatProgramDuration(program.duration)}</span>
                      {program.category && (
                        <>
                          <span>•</span>
                          <span className="bg-gray-600 px-1.5 py-0.5 rounded">
                            {program.category}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Live Progress Bar */}
                    {program.status === 'live' && progress > 0 && (
                      <div className="mt-2">
                        <div className="w-full bg-gray-600 rounded-full h-1">
                          <div 
                            className="bg-red-500 h-1 rounded-full transition-all duration-1000"
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {Math.round(progress)}% complete
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Indicator */}
                  {program.isClickable && (
                    <div className="ml-3 flex-shrink-0">
                      <div className="text-blue-400 text-sm">
                        {program.status === 'live' ? 'Watch' : 
                         program.status === 'upcoming' ? 'Go Live' : 'Catchup'} →
                      </div>
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>


    </div>
  )
})

export default ChannelEpgList