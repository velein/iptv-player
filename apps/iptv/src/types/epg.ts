export interface EpgProgram {
  id: string
  channelId: string
  title: string
  description?: string
  category?: string
  start: Date
  stop: Date
  icon?: string
  rating?: string
  episode?: {
    season?: number
    episode?: number
    total?: number
  }
}

export interface EpgChannel {
  id: string
  displayName: string
  icon?: string
  programs: EpgProgram[]
}

export interface EpgData {
  channels: Map<string, EpgChannel>
  programs: EpgProgram[]
  generatedAt: Date
}