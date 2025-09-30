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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [controlsTimeout, setControlsTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const channel = playlist?.channels.find((c) => c.id === channelIdStr);
  const currentProgram = channel
    ? getCurrentProgram(channel.epgId || channel.name)
    : null;

  const displayProgram = selectedProgram || currentProgram;

  // Fullscreen handlers
  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(err => {
        console.error('Error attempting to exit fullscreen:', err);
      });
    }
  };

  // Volume handlers
  const handleVolumeChange = (newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolume(clampedVolume);
    if (videoRef.current) {
      videoRef.current.volume = clampedVolume;
      if (clampedVolume === 0) {
        setIsMuted(true);
        videoRef.current.muted = true;
      } else {
        setIsMuted(false);
        videoRef.current.muted = false;
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      videoRef.current.muted = newMuted;
    }
  };

  // Controls visibility handlers
  const showControlsTemporarily = () => {
    setShowControls(true);
    if (controlsTimeout) {
      clearTimeout(controlsTimeout);
    }
    const timeout = setTimeout(() => {
      setShowControls(false);
    }, 3000);
    setControlsTimeout(timeout);
  };

  const handleMouseMove = () => {
    if (isFullscreen) {
      showControlsTemporarily();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.target !== document.body) return; // Only handle when not in input fields
    
    switch (e.key) {
      case 'f':
      case 'F':
        e.preventDefault();
        toggleFullscreen();
        break;
      case ' ':
        e.preventDefault();
        if (videoRef.current) {
          if (videoRef.current.paused) {
            videoRef.current.play();
          } else {
            videoRef.current.pause();
          }
        }
        break;
      case 'm':
      case 'M':
        e.preventDefault();
        toggleMute();
        break;
      case 'ArrowUp':
        e.preventDefault();
        handleVolumeChange(volume + 0.1);
        if (isFullscreen) showControlsTemporarily();
        break;
      case 'ArrowDown':
        e.preventDefault();
        handleVolumeChange(volume - 0.1);
        if (isFullscreen) showControlsTemporarily();
        break;
      case 'Escape':
        if (isFullscreen) {
          e.preventDefault();
          toggleFullscreen();
        }
        break;
    }
  };

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
    console.log('🎯 VideoPlayer: Dispatching program-selected event for:', program.title);
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

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      if (!document.fullscreenElement) {
        setShowControls(false);
        if (controlsTimeout) {
          clearTimeout(controlsTimeout);
          setControlsTimeout(null);
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [controlsTimeout]);

  // Keyboard event listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [volume, isMuted, isFullscreen]);

  // Initialize video volume
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;
    }
  }, []);

  // Cleanup controls timeout on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeout) {
        clearTimeout(controlsTimeout);
      }
    };
  }, [controlsTimeout]);

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
      console.log('🎥 VideoPlayer: Received epg-program-play event');
      console.log('🎥 VideoPlayer: Event channel ID:', eventChannel?.id);
      console.log('🎥 VideoPlayer: Current channel ID:', channel?.id);
      console.log('🎥 VideoPlayer: Program:', program.title);
      
      if (eventChannel?.id === channel?.id) {
        console.log('🎥 VideoPlayer: Channel match! Playing program');
        handleProgramPlay(program);
      } else {
        console.log('🎥 VideoPlayer: Channel mismatch, ignoring event');
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

      // Track play/pause state
      video.addEventListener('play', () => setIsPlaying(true));
      video.addEventListener('pause', () => setIsPlaying(false));

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
      {/* Program Seekbar - Above the player */}
      {displayProgram && !isFullscreen && (
        <div className="mb-4">
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

      <div 
        ref={containerRef}
        className={`bg-black rounded-lg overflow-hidden flex-1 relative ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => !isFullscreen && setShowControls(true)}
        onMouseLeave={() => !isFullscreen && setShowControls(false)}
      >
        <div className={`relative ${isFullscreen ? 'w-full h-full' : 'aspect-video'}`}>
          <video
            ref={videoRef}
            className="w-full h-full"
            playsInline
            muted={isMuted}
            crossOrigin="anonymous"
            controls={false} // Hide default controls
          />
          
          {/* Custom Controls Overlay - Only show on hover */}
          <div className={`absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none ${showControls ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}>
            {/* Bottom Right Controls */}
            <div className="absolute bottom-4 right-4 flex items-center space-x-4 pointer-events-auto">
              {/* Volume Control */}
              <div className="flex items-center space-x-3 bg-black/70 rounded-xl px-4 py-3 backdrop-blur-sm border border-white/10">
                <button
                  onClick={toggleMute}
                  className="text-white hover:text-gray-300 transition-colors"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.793L4.617 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.617l3.766-3.793a1 1 0 011.617.793zM12.22 6.22a.75.75 0 011.06 0L15 7.94l1.72-1.72a.75.75 0 111.06 1.06L16.06 9l1.72 1.72a.75.75 0 11-1.06 1.06L15 10.06l-1.72 1.72a.75.75 0 11-1.06-1.06L13.94 9l-1.72-1.72a.75.75 0 010-1.06z" clipRule="evenodd" />
                      </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.793L4.617 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.617l3.766-3.793a1 1 0 011.617.793zM12 8a1 1 0 011.414 0L15 9.586l1.586-1.586A1 1 0 1118 9.414L16.414 11 18 12.586A1 1 0 0116.586 14L15 12.414 13.414 14A1 1 0 0112 12.586L13.586 11 12 9.414A1 1 0 0112 8z" clipRule="evenodd" />
                      </svg>
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-24 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(isMuted ? 0 : volume) * 100}%, #4b5563 ${(isMuted ? 0 : volume) * 100}%, #4b5563 100%)`
                  }}
                  title="Volume"
                />
                <span className="text-white text-sm min-w-[3ch] font-medium">
                  {Math.round((isMuted ? 0 : volume) * 100)}%
                </span>
              </div>

              {/* Play/Pause Button */}
              <button
                onClick={() => {
                  if (videoRef.current) {
                    if (videoRef.current.paused) {
                      videoRef.current.play();
                    } else {
                      videoRef.current.pause();
                    }
                  }
                }}
                className="bg-black/70 hover:bg-black/80 text-white p-3 rounded-xl transition-colors backdrop-blur-sm border border-white/10"
                title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              >
                {isPlaying ? (
                  <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                )}
              </button>

              {/* Fullscreen Button */}
              <button
                onClick={toggleFullscreen}
                className="bg-black/70 hover:bg-black/80 text-white p-3 rounded-xl transition-colors backdrop-blur-sm border border-white/10"
                title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
              >
                {isFullscreen ? (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8 2a1 1 0 000 2h2.586L7.293 7.293a1 1 0 101.414 1.414L12 5.414V8a1 1 0 102 0V3a1 1 0 00-1-1H8zM2 8a1 1 0 012 0v2.586l3.293-3.293a1 1 0 011.414 1.414L5.414 12H8a1 1 0 010 2H3a1 1 0 01-1-1V8z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 11-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 111.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 111.414-1.414L15 13.586V12a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            </div>

            {/* Fullscreen Controls and Seekbar */}
            {isFullscreen && displayProgram && (
              <div className="absolute bottom-4 left-4 right-4 pointer-events-auto">
                {/* Fullscreen Controls - Above the seekbar */}
                <div className="flex items-center justify-center space-x-4 mb-4">
                  {/* Volume Control */}
                  <div className="flex items-center space-x-3 bg-black/70 rounded-xl px-4 py-3 backdrop-blur-sm border border-white/10">
                    <button
                      onClick={toggleMute}
                      className="text-white hover:text-gray-300 transition-colors"
                      title={isMuted ? 'Unmute' : 'Mute'}
                    >
                      {isMuted ? (
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.793L4.617 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.617l3.766-3.793a1 1 0 011.617.793zM12.22 6.22a.75.75 0 011.06 0L15 7.94l1.72-1.72a.75.75 0 111.06 1.06L16.06 9l1.72 1.72a.75.75 0 11-1.06 1.06L15 10.06l-1.72 1.72a.75.75 0 11-1.06-1.06L13.94 9l-1.72-1.72a.75.75 0 010-1.06z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.793L4.617 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.617l3.766-3.793a1 1 0 011.617.793zM12 8a1 1 0 011.414 0L15 9.586l1.586-1.586A1 1 0 1118 9.414L16.414 11 18 12.586A1 1 0 0116.586 14L15 12.414 13.414 14A1 1 0 0112 12.586L13.586 11 12 9.414A1 1 0 0112 8z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={isMuted ? 0 : volume}
                      onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                      className="w-24 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(isMuted ? 0 : volume) * 100}%, #4b5563 ${(isMuted ? 0 : volume) * 100}%, #4b5563 100%)`
                      }}
                      title="Volume"
                    />
                    <span className="text-white text-sm min-w-[3ch] font-medium">
                      {Math.round((isMuted ? 0 : volume) * 100)}%
                    </span>
                  </div>

                  {/* Play/Pause Button */}
                  <button
                    onClick={() => {
                      if (videoRef.current) {
                        if (videoRef.current.paused) {
                          videoRef.current.play();
                        } else {
                          videoRef.current.pause();
                        }
                      }
                    }}
                    className="bg-black/70 hover:bg-black/80 text-white p-3 rounded-xl transition-colors backdrop-blur-sm border border-white/10"
                    title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                  >
                    {isPlaying ? (
                      <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>

                  {/* Fullscreen Button */}
                  <button
                    onClick={toggleFullscreen}
                    className="bg-black/70 hover:bg-black/80 text-white p-3 rounded-xl transition-colors backdrop-blur-sm border border-white/10"
                    title="Exit Fullscreen (F)"
                  >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8 2a1 1 0 000 2h2.586L7.293 7.293a1 1 0 101.414 1.414L12 5.414V8a1 1 0 102 0V3a1 1 0 00-1-1H8zM2 8a1 1 0 012 0v2.586l3.293-3.293a1 1 0 011.414 1.414L5.414 12H8a1 1 0 010 2H3a1 1 0 01-1-1V8z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>

                {/* Fullscreen Seekbar */}
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

              {/* Keyboard Shortcuts Help */}
              {isFullscreen && showControls && (
                <div className="absolute top-4 right-4 bg-black/70 text-white text-xs rounded-lg p-3 pointer-events-auto backdrop-blur-sm border border-white/10">
                  <div className="space-y-1">
                    <div><kbd className="bg-gray-600 px-1 rounded">F</kbd> Fullscreen</div>
                    <div><kbd className="bg-gray-600 px-1 rounded">Space</kbd> Play/Pause</div>
                    <div><kbd className="bg-gray-600 px-1 rounded">M</kbd> Mute</div>
                    <div><kbd className="bg-gray-600 px-1 rounded">↑↓</kbd> Volume</div>
                    <div><kbd className="bg-gray-600 px-1 rounded">Esc</kbd> Exit</div>
                  </div>
                </div>
              )}
          </div>

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
    </div>
  );
}
