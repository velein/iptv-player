import type { Channel, ChannelGroup, PlaylistData } from '../types/channel'

export function parseM3U(content: string): PlaylistData {
  const lines = content.split('\n').map(line => line.trim())
  const channels: Channel[] = []
  const groupMap = new Map<string, Channel[]>()

  let currentExtinf: string | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith('#EXTINF:')) {
      currentExtinf = line
    } else if (line && !line.startsWith('#') && currentExtinf) {
      const url = line
      const channel = parseExtinf(currentExtinf, url)

      if (channel) {
        channels.push(channel)

        const groupName = channel.group || 'Uncategorized'
        if (!groupMap.has(groupName)) {
          groupMap.set(groupName, [])
        }
        groupMap.get(groupName)!.push(channel)
      }

      currentExtinf = null
    }
  }

  const groups: ChannelGroup[] = Array.from(groupMap.entries()).map(([name, channels]) => ({
    name,
    channels
  }))

  return { channels, groups }
}

function parseExtinf(extinf: string, url: string): Channel | null {
  // More robust parsing to handle various EXTINF formats
  const basicMatch = extinf.match(/#EXTINF:(-?\d+(?:\.\d+)?)\s*(.*)/)
  if (!basicMatch) return null

  const [, duration, rest] = basicMatch

  // Find the channel name - it's after the last comma
  const lastCommaIndex = rest.lastIndexOf(',')
  if (lastCommaIndex === -1) return null

  const attributes = rest.substring(0, lastCommaIndex)
  const name = rest.substring(lastCommaIndex + 1).trim()

  if (!name) return null

  const channel: Channel = {
    id: generateChannelId(name, url),
    name: name,
    url: url.trim()
  }

  // Parse attributes with better regex that handles malformed quotes
  const logoMatch = attributes.match(/tvg-logo="([^"]*)"/) || attributes.match(/tvg-logo=([^\s]+)/)
  if (logoMatch) {
    channel.logo = logoMatch[1]
  }

  const groupMatch = attributes.match(/group-title="([^"]*)"/) || attributes.match(/group-title=([^\s]+)/)
  if (groupMatch) {
    channel.group = groupMatch[1]
  }

  const epgIdMatch = attributes.match(/tvg-id="([^"]*)"/) || attributes.match(/tvg-id=([^\s]+)/)
  if (epgIdMatch) {
    channel.epgId = epgIdMatch[1]
  }

  // Parse additional attributes common in IPTV playlists
  const tvgNameMatch = attributes.match(/tvg-name="([^"]*)"/) || attributes.match(/tvg-name=([^\s]+)/)
  if (tvgNameMatch && !channel.name) {
    channel.name = tvgNameMatch[1]
  }

  // Parse catchup attributes
  const timeshiftMatch = attributes.match(/timeshift="([^"]*)"/) || attributes.match(/timeshift=([^\s]+)/)
  if (timeshiftMatch) {
    const hours = parseInt(timeshiftMatch[1])
    if (!isNaN(hours)) {
      channel.timeshift = hours
    }
  }

  const catchupMatch = attributes.match(/catchup="([^"]*)"/) || attributes.match(/catchup=([^\s]+)/)
  if (catchupMatch) {
    channel.catchup = catchupMatch[1]
  }

  // Log only first channel for debugging
  if (channel.name === '13 Ulica HD') {
    console.log('Sample channel parsed with catchup:', {
      name: channel.name,
      timeshift: channel.timeshift,
      catchup: channel.catchup
    })
  }

  return channel
}

function generateChannelId(name: string, url: string): string {
  // Create a simple hash from the name and url that works with Unicode
  const input = name + url
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  // Convert to positive number and then to base36 string
  const id = Math.abs(hash).toString(36)
  return id.substring(0, 16).padStart(8, '0')
}