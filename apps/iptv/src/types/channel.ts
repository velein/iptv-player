export interface Channel {
  id: string
  name: string
  url: string
  logo?: string
  group?: string
  epgId?: string
  timeshift?: number // Hours of catchup available
  catchup?: string // Catchup type (fs, shift, etc.)
}

export interface CatchupInfo {
  available: boolean
  timeshiftHours: number
  type: string
  startTime: Date
  endTime: Date
}

export interface ChannelGroup {
  name: string
  channels: Channel[]
}

export interface PlaylistData {
  channels: Channel[]
  groups: ChannelGroup[]
}