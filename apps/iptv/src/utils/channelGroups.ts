import type { Channel, ChannelGroup } from '../types/channel'

/**
 * Enhanced channel group interface with additional metadata
 */
export interface ChannelGroupWithMetadata extends ChannelGroup {
  channelCount: number
  hasEpgChannels: number
  hasCatchupChannels: number
}

/**
 * Extract and enhance channel groups from a list of channels
 */
export function extractChannelGroups(channels: Channel[]): ChannelGroupWithMetadata[] {
  const groupMap = new Map<string, Channel[]>()

  // Group channels by their group property
  channels.forEach(channel => {
    const groupName = channel.group || 'Uncategorized'
    if (!groupMap.has(groupName)) {
      groupMap.set(groupName, [])
    }
    groupMap.get(groupName)!.push(channel)
  })

  // Convert to enhanced group objects with metadata
  return Array.from(groupMap.entries())
    .map(([name, groupChannels]) => ({
      name,
      channels: groupChannels.sort((a, b) => a.name.localeCompare(b.name)),
      channelCount: groupChannels.length,
      hasEpgChannels: groupChannels.filter(c => c.epgId).length,
      hasCatchupChannels: groupChannels.filter(c => c.timeshift && c.timeshift > 0).length,
    }))
    .sort((a, b) => {
      // Sort groups: Uncategorized last, others alphabetically
      if (a.name === 'Uncategorized') return 1
      if (b.name === 'Uncategorized') return -1
      return a.name.localeCompare(b.name)
    })
}

/**
 * Get channels for a specific group
 */
export function getChannelsInGroup(channels: Channel[], groupName: string): Channel[] {
  return channels
    .filter(channel => (channel.group || 'Uncategorized') === groupName)
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Get all unique group names from channels
 */
export function getGroupNames(channels: Channel[]): string[] {
  const groups = new Set<string>()
  channels.forEach(channel => {
    groups.add(channel.group || 'Uncategorized')
  })
  
  const groupArray = Array.from(groups).sort()
  
  // Move 'Uncategorized' to the end if it exists
  const uncategorizedIndex = groupArray.indexOf('Uncategorized')
  if (uncategorizedIndex > -1) {
    groupArray.splice(uncategorizedIndex, 1)
    groupArray.push('Uncategorized')
  }
  
  return groupArray
}

/**
 * Find a channel by ID across all groups
 */
export function findChannelById(channels: Channel[], channelId: string): Channel | null {
  return channels.find(channel => channel.id === channelId) || null
}

/**
 * Get group statistics
 */
export function getGroupStatistics(channels: Channel[]) {
  const groups = extractChannelGroups(channels)
  
  return {
    totalGroups: groups.length,
    totalChannels: channels.length,
    channelsWithEpg: channels.filter(c => c.epgId).length,
    channelsWithCatchup: channels.filter(c => c.timeshift && c.timeshift > 0).length,
    largestGroup: groups.reduce((largest, group) => 
      group.channelCount > largest.channelCount ? group : largest, 
      groups[0] || { name: '', channelCount: 0 }
    ),
  }
}

/**
 * Search channels across all groups
 */
export function searchChannels(channels: Channel[], query: string): Channel[] {
  const searchTerm = query.toLowerCase().trim()
  if (!searchTerm) return []

  return channels.filter(channel =>
    channel.name.toLowerCase().includes(searchTerm) ||
    (channel.group && channel.group.toLowerCase().includes(searchTerm)) ||
    (channel.epgId && channel.epgId.toLowerCase().includes(searchTerm))
  ).sort((a, b) => {
    // Prioritize exact name matches
    const aNameMatch = a.name.toLowerCase().startsWith(searchTerm)
    const bNameMatch = b.name.toLowerCase().startsWith(searchTerm)
    
    if (aNameMatch && !bNameMatch) return -1
    if (!aNameMatch && bNameMatch) return 1
    
    return a.name.localeCompare(b.name)
  })
}

/**
 * Validate channel group data
 */
export function validateChannelGroup(group: ChannelGroup): boolean {
  return !!(
    group &&
    typeof group.name === 'string' &&
    group.name.trim().length > 0 &&
    Array.isArray(group.channels) &&
    group.channels.every(channel => 
      channel &&
      typeof channel.id === 'string' &&
      typeof channel.name === 'string' &&
      typeof channel.url === 'string'
    )
  )
}