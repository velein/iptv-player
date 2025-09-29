import type { EpgProgram } from '../types/epg';
import type { Channel } from '../types/channel';
import { isTimeWithinCatchup } from '../utils/catchupUtils';

interface ProgramCardProps {
  program: EpgProgram;
  channel?: Channel;
  isCurrentlyPlaying?: boolean;
  isUpcoming?: boolean;
  isSelected?: boolean;
  onClick?: (program: EpgProgram) => void;
}

export default function ProgramCard({
  program,
  channel,
  isCurrentlyPlaying = false,
  isUpcoming = false,
  isSelected = false,
  onClick,
}: ProgramCardProps) {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pl-PL', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Warsaw',
    });
  };

  const formatDuration = (start: Date, stop: Date) => {
    const durationMs = stop.getTime() - start.getTime();
    const durationMinutes = Math.round(durationMs / (1000 * 60));

    if (durationMinutes < 60) {
      return `${durationMinutes} min`;
    } else {
      const hours = Math.floor(durationMinutes / 60);
      const minutes = durationMinutes % 60;
      return `${hours}h ${minutes}m`;
    }
  };

  const getProgressPercent = (start: Date, stop: Date): number => {
    if (!isCurrentlyPlaying) return 0;

    const now = new Date();
    const total = stop.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();

    return Math.max(0, Math.min(100, (elapsed / total) * 100));
  };

  const progressPercent = getProgressPercent(program.start, program.stop);

  // Check if program is available for catchup
  const isPastProgram = program.stop <= new Date();
  const isCatchupAvailable = channel
    ? isTimeWithinCatchup(channel, program.start)
    : false;
  const canPlayFromStart =
    isCatchupAvailable && (isCurrentlyPlaying || isPastProgram);

  const handleClick = () => {
    // Only allow clicking on past programs and currently playing programs
    // Future programs cannot be played
    const now = new Date();
    const isFutureProgram = program.start > now;

    if (isFutureProgram) {
      console.log('🚫 FUTURE: Cannot play future program:', program.title);
      return;
    }

    onClick?.(program);
  };

  const now = new Date();
  const isFutureProgram = program.start > now;

  return (
    <div
      className={`p-4 rounded-lg border transition-all duration-200 ${
        isCurrentlyPlaying
          ? 'bg-blue-900 border-blue-500 ring-2 ring-blue-400'
          : isSelected
          ? 'bg-purple-900 border-purple-500 ring-2 ring-purple-400'
          : isFutureProgram
          ? 'bg-gray-900 border-gray-600 opacity-75' // Future programs - no hover, dimmed
          : isUpcoming
          ? 'bg-gray-800 border-gray-600 hover:bg-purple-800/30'
          : 'bg-gray-800 border-gray-700 hover:bg-purple-800/30'
      } ${
        onClick && !isFutureProgram
          ? 'cursor-pointer'
          : isFutureProgram
          ? 'cursor-not-allowed'
          : ''
      }`}
      onClick={handleClick}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center space-x-2">
          <span
            className={`text-sm font-medium ${
              isCurrentlyPlaying
                ? 'text-blue-300'
                : isSelected
                ? 'text-purple-300'
                : 'text-gray-400'
            }`}
          >
            {formatTime(program.start)}
          </span>
          <span className="text-gray-500">-</span>
          <span className="text-sm text-gray-400">
            {formatTime(program.stop)}
          </span>
          <span className="text-xs text-gray-500">
            ({formatDuration(program.start, program.stop)})
          </span>
        </div>
        {isCurrentlyPlaying && (
          <span className="text-xs bg-red-600 text-white px-2 py-1 rounded-full">
            LIVE
          </span>
        )}
        {isUpcoming && (
          <span className="text-xs bg-green-600 text-white px-2 py-1 rounded-full">
            UPCOMING
          </span>
        )}
        {isSelected && !isCurrentlyPlaying && (
          <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded-full">
            SELECTED
          </span>
        )}
      </div>

      <h3
        className={`font-semibold mb-1 line-clamp-2 ${
          isCurrentlyPlaying
            ? 'text-white'
            : isSelected
            ? 'text-purple-100'
            : 'text-gray-100'
        }`}
      >
        {program.title}
      </h3>

      {program.description && (
        <p className="text-sm text-gray-400 line-clamp-3 mb-2">
          {program.description}
        </p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {program.category && (
            <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">
              {program.category}
            </span>
          )}
          {program.episode && (
            <span className="text-xs text-gray-500">
              S{program.episode.season}E{program.episode.episode}
            </span>
          )}
          {program.rating && (
            <span className="text-xs bg-yellow-700 text-yellow-200 px-2 py-1 rounded">
              {program.rating}
            </span>
          )}
        </div>

        {program.icon && (
          <img
            src={program.icon}
            alt={program.title}
            className="w-8 h-8 rounded object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        )}
      </div>

      {isCurrentlyPlaying && progressPercent > 0 && (
        <div className="mt-3">
          <div className="w-full bg-gray-700 rounded-full h-1">
            <div
              className="bg-blue-500 h-1 rounded-full transition-all duration-1000"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {Math.round(progressPercent)}% complete
          </div>
        </div>
      )}
    </div>
  );
}
