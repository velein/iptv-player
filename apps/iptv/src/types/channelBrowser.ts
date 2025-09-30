import type { Channel } from './channel'
import type { EpgProgram } from './epg'

/**
 * Enhanced channel group interface with metadata for the browser
 */
export interface ChannelGroupDisplay {
  name: string
  channelCount: number
  hasEpgChannels: number
  hasCatchupChannels: number
  isSelected: boolean
}

/**
 * Enhanced channel interface for display in the browser
 */
export interface ChannelDisplay extends Channel {
  isSelected: boolean
  hasEpg: boolean
  hasCatchup: boolean
  currentProgram?: EpgProgram
}

/**
 * Enhanced program interface for display with status
 */
export interface ProgramDisplay extends EpgProgram {
  status: 'live' | 'upcoming' | 'ended'
  isClickable: boolean
  duration: number // in minutes
}

/**
 * Channel browser state interface
 */
export interface ChannelBrowserState {
  selectedGroup: string | null
  selectedChannel: string | null
  isLoading: boolean
  error: string | null
}

/**
 * Program selection event data
 */
export interface ProgramSelectEvent {
  program: EpgProgram
  channel: Channel
  action: 'play' | 'schedule' | 'info'
}

/**
 * Channel browser configuration
 */
export interface ChannelBrowserConfig {
  showEmptyGroups: boolean
  showChannelLogos: boolean
  showProgramDescriptions: boolean
  maxProgramsToShow: number
  enableKeyboardNavigation: boolean
}

/**
 * Loading states for different sections
 */
export interface LoadingStates {
  groups: boolean
  channels: boolean
  epg: boolean
}

/**
 * Error states for different sections
 */
export interface ErrorStates {
  groups: string | null
  channels: string | null
  epg: string | null
}