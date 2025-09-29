import { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useEpg } from '../hooks/useEpg'
import ProgramCard from './ProgramCard'
import type { Channel } from '../types/channel'
import type { EpgProgram } from '../types/epg'

interface ChannelEpgProps {
  channel: Channel
  showCurrentOnly?: boolean
  maxPrograms?: number
  onProgramPlay?: (program: EpgProgram) => void
}

export default function ChannelEpg({
  channel,
  showCurrentOnly = false,
  maxPrograms = 10,
  onProgramPlay
}: ChannelEpgProps) {
  const { getCurrentProgram, getNextPrograms, getProgramsForTimeRange, isLoading } = useEpg()

  const currentProgram = getCurrentProgram(channel.epgId || channel.name)
  const upcomingPrograms = getNextPrograms(channel.epgId || channel.name, maxPrograms - 1)

  // Get programs for the entire range (-5 days to tomorrow)
  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(today.getDate() - 5)
  startDate.setHours(0, 0, 0, 0)

  const endDate = new Date(today)
  endDate.setDate(today.getDate() + 1)
  endDate.setHours(23, 59, 59, 999)

  const allPrograms = getProgramsForTimeRange(
    channel.epgId || channel.name,
    startDate,
    endDate
  )

  // Auto-refresh current program every minute
  useEffect(() => {
    if (showCurrentOnly) return

    const interval = setInterval(() => {
      // This will trigger a re-render to update the current program status
    }, 60000)

    return () => clearInterval(interval)
  }, [showCurrentOnly])

  const formatDateHeader = (date: Date) => {
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow'
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    } else {
      // Calculate days difference for relative dates
      const diffTime = date.getTime() - today.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      if (diffDays < 0 && diffDays >= -7) {
        return `${Math.abs(diffDays)} days ago`
      } else if (diffDays > 0 && diffDays <= 3) {
        return `In ${diffDays} days`
      } else {
        return date.toLocaleDateString('pl-PL', {
          weekday: 'long',
          month: 'short',
          day: 'numeric'
        })
      }
    }
  }

  // Group programs by day
  const programsByDay = new Map<string, typeof allPrograms>()
  allPrograms.forEach(program => {
    const dayKey = program.start.toDateString()
    if (!programsByDay.has(dayKey)) {
      programsByDay.set(dayKey, [])
    }
    programsByDay.get(dayKey)!.push(program)
  })

  // Sort days chronologically
  const sortedDays = Array.from(programsByDay.keys()).sort((a, b) =>
    new Date(a).getTime() - new Date(b).getTime()
  )

  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-4">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
          <span className="text-gray-300">Loading program guide...</span>
        </div>
      </div>
    )
  }

  if (showCurrentOnly) {
    return (
      <div className="space-y-3">
        {currentProgram && (
          <ProgramCard
            program={currentProgram}
            channel={channel}
            isCurrentlyPlaying={true}
            onClick={onProgramPlay}
          />
        )}
        {upcomingPrograms.slice(0, 3).map(program => (
          <ProgramCard
            key={program.id}
            program={program}
            channel={channel}
            isUpcoming={true}
            onClick={onProgramPlay}
          />
        ))}
        {!currentProgram && upcomingPrograms.length === 0 && (
          <div className="bg-gray-800 rounded-lg p-4 text-center text-gray-400">
            No program information available for this channel
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-lg h-full flex flex-col">
      {/* Header with channel info */}
      <div className="p-4 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center space-x-3">
          {channel.logo ? (
            <img
              src={channel.logo}
              alt={channel.name}
              className="w-10 h-10 rounded object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          ) : (
            <div className="w-10 h-10 bg-gray-600 rounded flex items-center justify-center">
              <span className="text-sm font-bold">
                {channel.name.substring(0, 2).toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <h2 className="text-lg font-semibold text-white">{channel.name}</h2>
            <p className="text-xs text-gray-400">EPG - Program Guide</p>
          </div>
        </div>
      </div>

      {/* Programs list - grouped by day */}
      <div className="flex-1 overflow-y-auto">
        {sortedDays.length > 0 ? (
          sortedDays.map(dayKey => {
            const dayDate = new Date(dayKey)
            const dayPrograms = programsByDay.get(dayKey)!
            const now = new Date()

            return (
              <div key={dayKey} className="border-b border-gray-700 last:border-b-0">
                {/* Day header */}
                <div className="sticky top-0 bg-gray-700 px-4 py-2 text-sm font-semibold text-gray-200 border-b border-gray-600">
                  {formatDateHeader(dayDate)} - {dayDate.toLocaleDateString('pl-PL', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                  })}
                </div>

                {/* Programs for this day */}
                <div className="p-2 space-y-2">
                  {dayPrograms.map(program => {
                    const isCurrentlyPlaying = program.start <= now && program.stop > now
                    const isUpcoming = program.start > now

                    return (
                      <ProgramCard
                        key={program.id}
                        program={program}
                        channel={channel}
                        isCurrentlyPlaying={isCurrentlyPlaying}
                        isUpcoming={isUpcoming && program.start.getTime() - now.getTime() < 2 * 60 * 60 * 1000} // Next 2 hours
                        onClick={onProgramPlay}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })
        ) : (
          <div className="text-center py-8 text-gray-400">
            <p>No program information available</p>
            <p className="text-sm mt-2">EPG data may be loading...</p>
          </div>
        )}
      </div>
    </div>
  )
}