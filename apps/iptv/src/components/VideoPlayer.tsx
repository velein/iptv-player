import { useRef, useEffect, useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { usePlaylist } from '../hooks/usePlaylist';
import { useEpg } from '../hooks/useEpg';
import type { EpgProgram } from '../types/epg';
import CatchupSeekbar from './CatchupSeekbar';
import Hls from 'hls.js';
import { generateCatchupUrl, isTimeWithinCatchup } from '../utils/catchupUtils';

export default function VideoPlayer() {
  const { channelId } = useParams({ strict: false });
  const channelIdStr = channelId as string;
  const navigate = useNavigate();
  const { playlist } = usePlaylist();
  const { getCurrentProgram, getChannelPrograms } = useEpg();
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isLive, setIsLive] = useState(true);
  const [currentStreamUrl, setCurrentStreamUrl] = useState('');
  const [selectedProgram, setSelectedProgram] = useState<EpgProgram | null>(
    null
  );

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const channel = playlist?.channels.find((c) => c.id === channelIdStr);
  const currentProgram = channel
    ? getCurrentProgram(channel.epgId || channel.name)
    : null;

  const displayProgram = selectedProgram || currentProgram;

  // Load stream at specific time
  const loadStreamAtTime = (targetTime: Date) => {
    if (!channel) return;

    const streamUrl = generateCatchupUrl(channel, targetTime);
    const isTargetLive =
      Math.abs(targetTime.getTime() - new Date().getTime()) < 30000; // Within 30 seconds

    setCurrentTime(targetTime);
    setIsLive(isTargetLive);
    setCurrentStreamUrl(streamUrl);
    setError(null);
  };

  const handleProgramPlay = (program: EpgProgram) => {
    console.log('📺 EPG CLICK: Program selected:', program.title);
    console.log(
      '📺 EPG CLICK: Start time:',
      program.start.toISOString(),
      '(' + program.start.toLocaleString('pl-PL') + ')'
    );
    console.log(
      '📺 EPG CLICK: Stop time:',
      program.stop.toISOString(),
      '(' + program.stop.toLocaleString('pl-PL') + ')'
    );

    if (!channel) {
      console.log('❌ ERROR: No channel found');
      alert('Channel not found');
      return;
    }

    // Set this program as selected
    setSelectedProgram(program);

    // Dispatch event to notify root component
    window.dispatchEvent(
      new CustomEvent('program-selected', {
        detail: { program },
      })
    );

    const now = new Date();
    const timeDiffHours =
      (now.getTime() - program.start.getTime()) / (1000 * 60 * 60);
    console.log(
      '📺 EPG CLICK: Time difference:',
      timeDiffHours.toFixed(2),
      'hours ago'
    );

    const catchupAvailable = isTimeWithinCatchup(channel, program.start);
    console.log('📺 EPG CLICK: Catchup available:', catchupAvailable);

    if (!catchupAvailable) {
      console.log('❌ ERROR: Program not available for catchup');
      alert(
        `This program is not available for catchup.\n\nProgram: ${
          program.title
        }\nStart: ${program.start.toLocaleString(
          'pl-PL'
        )}\nTime diff: ${timeDiffHours.toFixed(1)}h ago\nChannel timeshift: ${
          channel.timeshift
        }h\nCatchup type: ${channel.catchup}`
      );
      return;
    }

    console.log('✅ EPG CLICK: Attempting to play program');
    loadStreamAtTime(program.start);
  };

  const handleTimeChange = (time: Date) => {
    loadStreamAtTime(time);

    // Update selected program based on the time we're seeking to
    if (channel) {
      const programs = getChannelPrograms(channel.epgId || channel.name);
      const programAtTime = programs.find(
        (program) => program.start <= time && program.stop > time
      );
      if (programAtTime) {
        setSelectedProgram(programAtTime);
        // Dispatch event to notify root component
        window.dispatchEvent(
          new CustomEvent('program-selected', {
            detail: { program: programAtTime },
          })
        );
      }
    }
  };

  // Initialize with live stream when channel loads
  useEffect(() => {
    if (channel && !currentStreamUrl) {
      setCurrentStreamUrl(channel.url);
      setCurrentTime(new Date());
      setIsLive(true);
    }
  }, [channel, currentStreamUrl]);

  // Sync selected program with current time and live status
  useEffect(() => {
    if (channel && isLive) {
      // When live, select the current program
      const current = getCurrentProgram(channel.epgId || channel.name);
      setSelectedProgram(current);
      // Dispatch event to notify root component
      if (current) {
        window.dispatchEvent(
          new CustomEvent('program-selected', {
            detail: { program: current },
          })
        );
      }
    } else if (channel && !isLive) {
      // When not live, find program for current playback time
      const programs = getChannelPrograms(channel.epgId || channel.name);
      const programAtTime = programs.find(
        (program) => program.start <= currentTime && program.stop > currentTime
      );
      if (programAtTime && programAtTime.id !== selectedProgram?.id) {
        setSelectedProgram(programAtTime);
        // Dispatch event to notify root component
        window.dispatchEvent(
          new CustomEvent('program-selected', {
            detail: { program: programAtTime },
          })
        );
      }
    }
  }, [
    channel,
    isLive,
    currentTime,
    getCurrentProgram,
    getChannelPrograms,
    selectedProgram?.id,
  ]);

  // Initialize stream when URL changes
  useEffect(() => {
    if (currentStreamUrl) {
      initializeStream();
    }
  }, [currentStreamUrl]);

  // Video event handlers
  useEffect(() => {
    if (!videoRef.current) return;

    const video = videoRef.current;

    const handleLoadStart = () => {
      setError(null);
    };
    const handleError = (e: Event) => {
      console.log('🎥 VIDEO: Video error event:', e);
      setError('Failed to load video stream');
    };

    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('error', handleError);
    };
  }, []);

  // Listen for EPG program play events
  useEffect(() => {
    const handleEpgProgramPlay = (event: CustomEvent) => {
      const { program, channel: eventChannel } = event.detail;
      if (eventChannel?.id === channel?.id) {
        handleProgramPlay(program);
      }
    };

    window.addEventListener(
      'epg-program-play',
      handleEpgProgramPlay as EventListener
    );

    return () => {
      window.removeEventListener(
        'epg-program-play',
        handleEpgProgramPlay as EventListener
      );
    };
  }, [channel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  const handleRetry = () => {
    if (!videoRef.current) return;

    setError(null);

    // Clean up existing HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Re-initialize the stream
    initializeStream();
  };

  const initializeStream = () => {
    if (!videoRef.current || !currentStreamUrl) return;

    const video = videoRef.current;
    let streamUrl = currentStreamUrl;

    // Clean up existing HLS
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (currentStreamUrl.includes('.m3u8') && Hls.isSupported()) {
      // Use HLS.js for m3u8 streams
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false, // Disable for IPTV streams
        backBufferLength: 30,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10,
        xhrSetup: function (xhr, url) {
          // Handle CORS for IPTV streams
          xhr.withCredentials = false;
        },
        fetchSetup: function (context, initParams) {
          // Handle fetch CORS for IPTV streams
          initParams.mode = 'cors';
          initParams.credentials = 'omit';
          return new Request(context.url, initParams);
        },
      });

      hlsRef.current = hls;

      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        // Media attached
      });

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch((err) => {
          // Auto-play failed silently
        });
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.log('🎥 HLS: Error:', data.type, data.details);

        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              // Try native video as fallback
              hls.destroy();
              hlsRef.current = null;
              video.src = currentStreamUrl;
              video.load();
              break;
          }
        }
      });

      hls.loadSource(streamUrl);
      hls.attachMedia(video);
    } else {
      // Direct video source
      video.src = streamUrl;
      video.load();
    }
  };

  if (!playlist) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 mb-4">No playlist loaded</p>
        <button
          onClick={() => navigate({ to: '/' })}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors"
        >
          Load Playlist
        </button>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400 mb-4">Channel not found</p>
        <button
          onClick={() => navigate({ to: '/channels' })}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors"
        >
          Back to Channels
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="bg-black rounded-lg overflow-hidden flex-1">
        <div className="relative aspect-video">
          <video
            ref={videoRef}
            className="w-full h-full"
            controls
            playsInline
            muted={false}
            crossOrigin="anonymous"
          />
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-90 z-10">
              <div className="text-center">
                <p className="text-red-400 mb-4">{error}</p>
                <div className="space-x-2">
                  <button
                    onClick={handleRetry}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
                  >
                    Retry Stream
                  </button>
                  <button
                    onClick={() => window.open(channel?.url, '_blank')}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition-colors"
                  >
                    Open in New Tab
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Program Seekbar - Compact snackbar style */}
      {displayProgram && (
        <div className="mt-4">
          <CatchupSeekbar
            channel={channel}
            currentTime={currentTime}
            isLive={isLive}
            currentProgram={displayProgram}
            onTimeChange={handleTimeChange}
            onSeekStart={() => {}}
            onSeekEnd={() => {}}
          />
        </div>
      )}
    </div>
  );
}
