import { useNavigate } from '@tanstack/react-router'
import type { EpgProgram } from '../types/epg'
import { getProgramStatus } from '../utils/programUtils'
import ChannelBrowser from './ChannelBrowser'

export default function ChannelBrowserPage() {
  const navigate = useNavigate()

  // Handle channel selection - just show EPG, don't navigate to player yet
  const handleChannelSelect = (channelId: string) => {
    // Don't navigate to player, just let the browser show the EPG
    // Navigation will happen when user clicks on a program
  }

  // Handle program selection - navigate to player and attempt to play program
  const handleProgramSelect = (program: EpgProgram, channelId: string) => {
    // Navigate to the channel first
    navigate({ to: `/player/${channelId}` })

    // If it's a valid program, dispatch event for the player to handle
    if (program.title) {
      const status = getProgramStatus(program)
      
      // Wait a bit for navigation to complete, then dispatch the program play event
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent('epg-program-play', {
            detail: {
              program,
              channel: { id: channelId }, // VideoPlayer expects 'channel' not 'channelId'
              action: status === 'live' ? 'play-live' : 
                     status === 'upcoming' ? 'play-live' : 'play-catchup'
            },
          })
        )
      }, 100)
    }
  }

  return (
    <div className="h-full overflow-hidden">
      <ChannelBrowser
        onChannelSelect={handleChannelSelect}
        onProgramSelect={handleProgramSelect}
        className="h-full"
      />
    </div>
  )
}