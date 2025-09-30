import type { EpgProgram } from '../types/epg'
import type { ProgramDisplay } from '../types/channelBrowser'

/**
 * Determine the status of a program relative to current time
 */
export function getProgramStatus(program: EpgProgram, now: Date = new Date()): 'live' | 'upcoming' | 'ended' {
  const currentTime = now.getTime()
  const startTime = program.start.getTime()
  const endTime = program.stop.getTime()

  if (startTime <= currentTime && endTime > currentTime) {
    return 'live'
  } else if (startTime > currentTime) {
    return 'upcoming'
  } else {
    return 'ended'
  }
}

/**
 * Calculate program duration in minutes
 */
export function getProgramDuration(program: EpgProgram): number {
  return Math.round((program.stop.getTime() - program.start.getTime()) / (1000 * 60))
}

/**
 * Check if a program is clickable (can be played or scheduled)
 */
export function isProgramClickable(program: EpgProgram, hasCatchup: boolean = false): boolean {
  const status = getProgramStatus(program)
  
  // Live programs are always clickable
  if (status === 'live') return true
  
  // Upcoming programs are clickable (will start live stream)
  if (status === 'upcoming') return true
  
  // Ended programs are only clickable if catchup is available
  return status === 'ended' && hasCatchup
}

/**
 * Convert EPG program to display format
 */
export function createProgramDisplay(program: EpgProgram, hasCatchup: boolean = false): ProgramDisplay {
  const status = getProgramStatus(program)
  const duration = getProgramDuration(program)
  const isClickable = isProgramClickable(program, hasCatchup)

  return {
    ...program,
    status,
    duration,
    isClickable,
  }
}

/**
 * Get programs for a specific time range
 */
export function getProgramsInRange(
  programs: EpgProgram[],
  startTime: Date,
  endTime: Date
): EpgProgram[] {
  return programs.filter(program => {
    // Program overlaps with the time range
    return program.start < endTime && program.stop > startTime
  }).sort((a, b) => a.start.getTime() - b.start.getTime())
}

/**
 * Get current and upcoming programs (next 24 hours)
 */
export function getCurrentAndUpcomingPrograms(
  programs: EpgProgram[],
  now: Date = new Date(),
  hoursAhead: number = 24
): EpgProgram[] {
  const endTime = new Date(now.getTime() + (hoursAhead * 60 * 60 * 1000))
  
  return programs.filter(program => {
    // Include programs that are currently running or start within the time window
    return program.stop > now && program.start < endTime
  }).sort((a, b) => a.start.getTime() - b.start.getTime())
}

/**
 * Find the currently live program
 */
export function getCurrentProgram(programs: EpgProgram[], now: Date = new Date()): EpgProgram | null {
  return programs.find(program => getProgramStatus(program, now) === 'live') || null
}

/**
 * Get the next upcoming program
 */
export function getNextProgram(programs: EpgProgram[], now: Date = new Date()): EpgProgram | null {
  const upcomingPrograms = programs
    .filter(program => program.start > now)
    .sort((a, b) => a.start.getTime() - b.start.getTime())
  
  return upcomingPrograms[0] || null
}

/**
 * Format program time for display
 */
export function formatProgramTime(program: EpgProgram): string {
  const startTime = program.start.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  
  const endTime = program.stop.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  
  return `${startTime} - ${endTime}`
}

/**
 * Format program duration for display
 */
export function formatProgramDuration(duration: number): string {
  const hours = Math.floor(duration / 60)
  const minutes = duration % 60
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

/**
 * Get program progress percentage (0-100)
 */
export function getProgramProgress(program: EpgProgram, now: Date = new Date()): number {
  const status = getProgramStatus(program, now)
  
  if (status === 'upcoming') return 0
  if (status === 'ended') return 100
  
  // Live program - calculate progress
  const totalDuration = program.stop.getTime() - program.start.getTime()
  const elapsed = now.getTime() - program.start.getTime()
  
  return Math.max(0, Math.min(100, (elapsed / totalDuration) * 100))
}

/**
 * Search programs by title or description
 */
export function searchPrograms(programs: EpgProgram[], query: string): EpgProgram[] {
  const searchTerm = query.toLowerCase().trim()
  if (!searchTerm) return []

  return programs.filter(program =>
    program.title.toLowerCase().includes(searchTerm) ||
    (program.description && program.description.toLowerCase().includes(searchTerm)) ||
    (program.category && program.category.toLowerCase().includes(searchTerm))
  ).sort((a, b) => {
    // Prioritize exact title matches, then by start time
    const aExactMatch = a.title.toLowerCase().startsWith(searchTerm)
    const bExactMatch = b.title.toLowerCase().startsWith(searchTerm)
    
    if (aExactMatch && !bExactMatch) return -1
    if (!aExactMatch && bExactMatch) return 1
    
    return a.start.getTime() - b.start.getTime()
  })
}