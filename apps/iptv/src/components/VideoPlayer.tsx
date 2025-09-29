import { useRef, useEffect, useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { usePlaylist } from '../hooks/usePlaylist';
import { useEpg } from '../hooks/useEpg';
import type { EpgProgram } from '../types/epg';
import ChannelEpg from './ChannelEpg';
import CatchupSeekbar from './CatchupSeekbar';
import Hls from 'hls.js';
import {
  getCatchupInfo,
  generateCatchupUrl,
  isTimeWithinCatchup,
} from '../utils/catchupUtils';

export default function VideoPlayer() {
  const { channelId } = useParams({ strict: false });
  const channelIdStr = channelId as string;
  const navigate = useNavigate();
  const { playlist } = usePlaylist();
  const { getCurrentProgram, getChannelPrograms } = useEpg();
  const [error, setError] = useState<string | null>(null);
  const [showEpg, setShowEpg] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isLive, setIsLive] = useState(true);
  const [isSeekbarVisible, setIsSeekbarVisible] = useState(true); // Show by default
  const [currentStreamUrl, setCurrentStreamUrl] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [selectedProgram, setSelectedProgram] = useState<EpgProgram | null>(
    null
  );
  const [videoCurrentTime, setVideoCurrentTime] = useState(0); // Video element's current time in seconds

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const channel = playlist?.channels.find((c) => c.id === channelIdStr);
  const currentProgram = channel
    ? getCurrentProgram(channel.epgId || channel.name)
    : null;
  const catchupInfo = channel ? getCatchupInfo(channel) : null;

  // Calculate program progress for display
  const getProgramProgress = (
    program: EpgProgram | null,
    playbackTime: Date
  ) => {
    if (!program)
      return { percent: 0, elapsed: '0:00', total: '0:00', remaining: '0:00' };

    console.log('🎯 PROGRESS DEBUG:', {
      programTitle: program.title,
      programStart: program.start.toISOString(),
      programStartLocal: program.start.toString(),
      programStop: program.stop.toISOString(),
      programStopLocal: program.stop.toString(),
      playbackTime: playbackTime.toISOString(),
      playbackTimeLocal: playbackTime.toString(),
    });

    const total = program.stop.getTime() - program.start.getTime();
    const elapsed = Math.max(
      0,
      playbackTime.getTime() - program.start.getTime()
    );
    const percent = Math.max(0, Math.min(100, (elapsed / total) * 100));

    const formatDuration = (ms: number) => {
      const totalSeconds = Math.floor(ms / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
          .toString()
          .padStart(2, '0')}`;
      }
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    console.log('🎯 DURATION DEBUG:', {
      totalMs: total,
      elapsedMs: elapsed,
      totalFormatted: formatDuration(total),
      elapsedFormatted: formatDuration(elapsed),
      percent: percent.toFixed(1),
    });

    return {
      percent,
      elapsed: formatDuration(elapsed),
      total: formatDuration(total),
      remaining: formatDuration(total - elapsed),
    };
  };

  const displayProgram = selectedProgram || currentProgram;
  const programProgress = getProgramProgress(displayProgram, currentTime);

  // Load stream at specific time
  const loadStreamAtTime = (targetTime: Date) => {
    if (!channel) return;

    const streamUrl = generateCatchupUrl(channel, targetTime);
    const isTargetLive =
      Math.abs(targetTime.getTime() - new Date().getTime()) < 30000; // Within 30 seconds

    console.log('🎯 PLAYER: Loading stream at time:', targetTime.toISOString());
    console.log('🎯 PLAYER: Generated URL:', streamUrl);
    console.log('🎯 PLAYER: Is live:', isTargetLive);

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
    } else if (channel && !isLive) {
      // When not live, find program for current playback time
      const programs = getChannelPrograms(channel.epgId || channel.name);
      const programAtTime = programs.find(
        (program) => program.start <= currentTime && program.stop > currentTime
      );
      if (programAtTime && programAtTime.id !== selectedProgram?.id) {
        setSelectedProgram(programAtTime);
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

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleLoadStart = () => {
      setError(null);
    };
    const handleError = (e: Event) => {
      console.log('🎥 VIDEO: Video error event:', e);
      setError('Failed to load video stream');
    };
    const handleTimeUpdate = () => {
      setVideoCurrentTime(video.currentTime);
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('error', handleError);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.volume = volume;

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('error', handleError);
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  const handlePlayPause = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch((error) => {
        setError(`Failed to play stream: ${error.message || 'Unknown error'}`);
      });
    }
  };

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

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  };

  const handleSeek = (seconds: number) => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const newTime = Math.max(0, video.currentTime + seconds);

    // For live streams and simple seek operations, just use video.currentTime
    if (isLive || !selectedProgram || !catchupInfo?.available) {
      video.currentTime = newTime;
      return;
    }

    // For catchup streams, we need to reload the stream at a different time
    // Calculate the target time in the program
    const programStartTime = selectedProgram.start.getTime();
    const programDuration = selectedProgram.stop.getTime() - programStartTime;
    const videoProgress = video.currentTime / video.duration || 0;
    const currentProgramTime =
      programStartTime + videoProgress * programDuration;
    const targetProgramTime = new Date(currentProgramTime + seconds * 1000);

    // Check if target time is within the program bounds
    if (
      targetProgramTime >= selectedProgram.start &&
      targetProgramTime <= selectedProgram.stop
    ) {
      handleTimeChange(targetProgramTime);
    }
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate({ to: '/channels' })}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded transition-colors"
          >
            ← Back to Channels
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{channel.name}</h1>
            <div className="space-y-1">
              {channel.group && (
                <p className="text-sm text-gray-400">{channel.group}</p>
              )}
              {catchupInfo?.available && !isLive && (
                <div className="text-xs text-orange-400">
                  Watching from{' '}
                  {currentTime.toLocaleTimeString('pl-PL', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              )}
              {catchupInfo?.available && (
                <div className="text-xs text-gray-500">
                  Catchup:{' '}
                  {catchupInfo.timeshiftHours >= 24
                    ? `${Math.floor(catchupInfo.timeshiftHours / 24)} days`
                    : `${catchupInfo.timeshiftHours}h`}{' '}
                  available
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {catchupInfo?.available && (
              <button
                onClick={() => setIsSeekbarVisible(!isSeekbarVisible)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded transition-colors"
              >
                {isSeekbarVisible ? 'Hide Seekbar' : 'Show Seekbar'}
              </button>
            )}
            <button
              onClick={() => setShowEpg(!showEpg)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
            >
              {showEpg ? 'Hide EPG' : 'Show EPG'}
            </button>
          </div>
        </div>
        {channel.logo && (
          <img
            src={channel.logo}
            alt={channel.name}
            className="w-16 h-16 rounded object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        )}
      </div>

      {/* Program Info Display */}
      {displayProgram && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <h2 className="text-xl font-semibold text-white">
                  {displayProgram.title}
                </h2>
                <div className="flex items-center space-x-2">
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${
                      isLive
                        ? 'bg-red-600 text-white'
                        : 'bg-purple-600 text-white'
                    }`}
                  >
                    {isLive ? '🔴 LIVE' : '📺 CATCHUP'}
                  </span>
                  {displayProgram.category && (
                    <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">
                      {displayProgram.category}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-4 text-sm text-gray-400">
                <span>
                  {displayProgram.start.toLocaleTimeString('pl-PL', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Europe/Warsaw',
                  })}{' '}
                  -
                  {displayProgram.stop.toLocaleTimeString('pl-PL', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Europe/Warsaw',
                  })}
                </span>
                <span>•</span>
                <span>
                  {programProgress.elapsed} / {programProgress.total}
                </span>
                <span>•</span>
                <span className="text-green-400">
                  {Math.round(programProgress.percent)}% complete
                </span>
              </div>

              {displayProgram.description && (
                <p className="text-sm text-gray-300 mt-2 line-clamp-2">
                  {displayProgram.description}
                </p>
              )}
            </div>

            {displayProgram.icon && (
              <img
                src={displayProgram.icon}
                alt={displayProgram.title}
                className="w-16 h-16 rounded object-cover ml-4"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-1000 ${
                isLive
                  ? 'bg-gradient-to-r from-red-500 to-red-600'
                  : 'bg-gradient-to-r from-purple-500 to-purple-600'
              }`}
              style={{ width: `${programProgress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Main Content Area - Side by Side */}
      <div className="flex gap-4">
        {/* Left Side - Video Player */}
        <div className="flex-1">
          <div className="bg-black rounded-lg overflow-hidden">
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

            {/* Custom Controls */}
            <div className="bg-gray-800 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {/* Seek Controls */}
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleSeek(-30)}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded transition-colors text-sm"
                      title="Seek backward 30 seconds"
                    >
                      ⏪30s
                    </button>
                    <button
                      onClick={() => handleSeek(-10)}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded transition-colors text-sm"
                      title="Seek backward 10 seconds"
                    >
                      ⏪10s
                    </button>
                  </div>

                  <button
                    onClick={handlePlayPause}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
                  >
                    {isPlaying ? '⏸️ Pause' : '▶️ Play'}
                  </button>

                  {/* Forward Seek Controls */}
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleSeek(10)}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded transition-colors text-sm"
                      title="Seek forward 10 seconds"
                    >
                      10s⏩
                    </button>
                    <button
                      onClick={() => handleSeek(30)}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded transition-colors text-sm"
                      title="Seek forward 30 seconds"
                    >
                      30s⏩
                    </button>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-400">🔊</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={volume}
                      onChange={handleVolumeChange}
                      className="w-20"
                    />
                    <span className="text-sm text-gray-400 w-8">
                      {Math.round(volume * 100)}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-xs text-gray-500">
                    {Math.floor(videoCurrentTime / 60)}:
                    {Math.floor(videoCurrentTime % 60)
                      .toString()
                      .padStart(2, '0')}
                  </div>
                  <div className="text-sm text-gray-400">
                    {isLive ? '🔴 LIVE' : '📺 CATCHUP'} •{' '}
                    {isPlaying ? 'Playing' : 'Stopped'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Catchup Seekbar */}
          {isSeekbarVisible && catchupInfo?.available && channel && (
            <div className="mt-4">
              <CatchupSeekbar
                channel={channel}
                currentTime={currentTime}
                isLive={isLive}
                onTimeChange={handleTimeChange}
                onSeekStart={() => {}}
                onSeekEnd={() => {}}
              />
            </div>
          )}

          {/* Channel Info */}
          <div className="bg-gray-800 rounded-lg p-4 mt-4">
            <h3 className="text-lg font-semibold mb-2">Channel Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Name:</span> {channel.name}
              </div>
              {channel.group && (
                <div>
                  <span className="text-gray-400">Group:</span> {channel.group}
                </div>
              )}
              {channel.epgId && (
                <div>
                  <span className="text-gray-400">EPG ID:</span> {channel.epgId}
                </div>
              )}
              <div className="md:col-span-2">
                <span className="text-gray-400">Stream URL:</span>
                <code className="ml-2 text-xs bg-gray-700 px-2 py-1 rounded break-all">
                  {channel.url}
                </code>
              </div>
              {channel.url.includes('.m3u8') && (
                <div className="md:col-span-2">
                  <div className="text-green-400 text-xs mb-1">
                    📡 HLS Stream{' '}
                    {Hls.isSupported()
                      ? '(HLS.js enabled)'
                      : '(Native support)'}
                  </div>
                  {!Hls.isSupported() && (
                    <div className="text-orange-400 text-xs">
                      ⚠️ For best compatibility, use Chrome, Firefox, or Edge
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side - EPG */}
        {showEpg && channel && (
          <div className="w-[500px] flex-shrink-0 h-screen">
            <ChannelEpg
              channel={channel}
              showCurrentOnly={false}
              onProgramPlay={handleProgramPlay}
              selectedProgram={selectedProgram}
            />
          </div>
        )}
      </div>
    </div>
  );
}
