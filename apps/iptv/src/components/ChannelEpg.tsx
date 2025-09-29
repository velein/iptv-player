import { useState, useEffect, useRef } from 'react';
import { useEpg } from '../hooks/useEpg';
import ProgramCard from './ProgramCard';
import type { Channel } from '../types/channel';
import type { EpgProgram } from '../types/epg';

interface ChannelEpgProps {
  channel: Channel;
  showCurrentOnly?: boolean;
  maxPrograms?: number;
  onProgramPlay?: (program: EpgProgram) => void;
  selectedProgram?: EpgProgram | null;
  epgStatus?: React.ReactNode;
}

export default function ChannelEpg({
  channel,
  showCurrentOnly = false,
  maxPrograms = 10,
  onProgramPlay,
  selectedProgram,
  epgStatus,
}: ChannelEpgProps) {
  const {
    getCurrentProgram,
    getNextPrograms,
    getProgramsForTimeRange,
    isLoading,
  } = useEpg();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const selectedProgramRef = useRef<HTMLDivElement>(null);

  // State for selected day
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  const currentProgram = getCurrentProgram(channel.epgId || channel.name);
  const upcomingPrograms = getNextPrograms(
    channel.epgId || channel.name,
    maxPrograms - 1
  );

  // Get programs for the selected day only
  const startDate = new Date(selectedDate);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(selectedDate);
  endDate.setHours(23, 59, 59, 999);

  const allPrograms = getProgramsForTimeRange(
    channel.epgId || channel.name,
    startDate,
    endDate
  );

  // Get all available days (from -5 days to tomorrow)
  const allStartDate = new Date(today);
  allStartDate.setDate(today.getDate() - 5);
  allStartDate.setHours(0, 0, 0, 0);

  const allEndDate = new Date(today);
  allEndDate.setDate(today.getDate() + 1);
  allEndDate.setHours(23, 59, 59, 999);

  const allAvailablePrograms = getProgramsForTimeRange(
    channel.epgId || channel.name,
    allStartDate,
    allEndDate
  );

  // Get unique days from available programs
  const availableDays = new Set<string>();
  allAvailablePrograms.forEach((program) => {
    const dayKey = new Date(program.start);
    dayKey.setHours(0, 0, 0, 0);
    availableDays.add(dayKey.toISOString());
  });

  const sortedAvailableDays = Array.from(availableDays)
    .map((dateStr) => new Date(dateStr))
    .sort((a, b) => a.getTime() - b.getTime());

  // Auto-refresh current program every minute
  useEffect(() => {
    if (showCurrentOnly) return;

    const interval = setInterval(() => {
      // This will trigger a re-render to update the current program status
    }, 60000);

    return () => clearInterval(interval);
  }, [showCurrentOnly]);

  // Auto-scroll to selected program
  useEffect(() => {
    if (
      selectedProgram &&
      selectedProgramRef.current &&
      scrollContainerRef.current &&
      !showCurrentOnly
    ) {
      const container = scrollContainerRef.current;
      const element = selectedProgramRef.current;

      // Use a small delay to ensure the DOM is updated
      setTimeout(() => {
        // Get the element's position relative to the scroll container
        const containerRect = container.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();

        // Calculate the element's position within the scroll container
        const elementRelativeTop =
          elementRect.top - containerRect.top + container.scrollTop;
        const elementHeight = elementRect.height;
        const containerHeight = container.clientHeight;

        // Calculate scroll position to center the selected program
        const targetScrollTop =
          elementRelativeTop - containerHeight / 2 + elementHeight / 2;

        container.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: 'smooth',
        });
      }, 100); // Small delay to ensure DOM is updated
    }
  }, [selectedProgram?.id, showCurrentOnly]);

  // Auto-scroll to current program when EPG first loads
  useEffect(() => {
    if (!showCurrentOnly && scrollContainerRef.current && !selectedProgram) {
      // If no program is selected yet, try to scroll to current program
      const container = scrollContainerRef.current;

      setTimeout(() => {
        // Find current program element by looking for one with "LIVE" badge
        const liveElement = container
          .querySelector('[class*="bg-red-600"]')
          ?.closest('[class*="space-y-2"] > div');

        if (liveElement && liveElement instanceof HTMLElement) {
          const containerRect = container.getBoundingClientRect();
          const elementRect = liveElement.getBoundingClientRect();

          const elementRelativeTop =
            elementRect.top - containerRect.top + container.scrollTop;
          const elementHeight = elementRect.height;
          const containerHeight = container.clientHeight;

          const targetScrollTop =
            elementRelativeTop - containerHeight / 2 + elementHeight / 2;

          console.log('📍 INITIAL SCROLL: Scrolling to current program');

          container.scrollTo({
            top: Math.max(0, targetScrollTop),
            behavior: 'smooth',
          });
        }
      }, 500); // Longer delay for initial load
    }
  }, [currentProgram?.id, showCurrentOnly, selectedProgram]);

  // Helper to format day label
  const formatDayLabel = (date: Date) => {
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const tomorrow = new Date(todayDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(todayDate);
    yesterday.setDate(yesterday.getDate() - 1);

    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    if (checkDate.getTime() === todayDate.getTime()) {
      return 'Today';
    } else if (checkDate.getTime() === tomorrow.getTime()) {
      return 'Tomorrow';
    } else if (checkDate.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('pl-PL', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-4">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
          <span className="text-gray-300">Loading program guide...</span>
        </div>
      </div>
    );
  }

  if (showCurrentOnly) {
    return (
      <div className="space-y-3">
        {currentProgram && (
          <ProgramCard
            program={currentProgram}
            channel={channel}
            isCurrentlyPlaying={true}
            onClick={onProgramPlay}
          />
        )}
        {upcomingPrograms.slice(0, 3).map((program) => (
          <ProgramCard
            key={program.id}
            program={program}
            channel={channel}
            isUpcoming={true}
            onClick={onProgramPlay}
          />
        ))}
        {!currentProgram && upcomingPrograms.length === 0 && (
          <div className="bg-gray-800 rounded-lg p-4 text-center text-gray-400">
            No program information available for this channel
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gray-800 h-full flex flex-col">
      {/* Header with channel info and day selector */}
      <div className="p-4 border-b border-gray-700 flex-shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {channel.logo ? (
              <img
                src={channel.logo}
                alt={channel.name}
                className="w-10 h-10 rounded object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="w-10 h-10 bg-gray-600 rounded flex items-center justify-center">
                <span className="text-sm font-bold">
                  {channel.name.substring(0, 2).toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold text-white">
                {channel.name}
              </h2>
              <p className="text-xs text-gray-400">EPG - Program Guide</p>
            </div>
          </div>
          {epgStatus && <div className="flex-shrink-0">{epgStatus}</div>}
        </div>

        {/* Day selector */}
        <div>
          <label className="text-xs text-gray-400 block mb-1">
            Select Day:
          </label>
          <select
            value={selectedDate.toISOString()}
            onChange={(e) => setSelectedDate(new Date(e.target.value))}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {sortedAvailableDays.map((date) => (
              <option key={date.toISOString()} value={date.toISOString()}>
                {formatDayLabel(date)} -{' '}
                {date.toLocaleDateString('pl-PL', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Programs list for selected day */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
        {allPrograms.length > 0 ? (
          <div className="p-2 space-y-2">
            {allPrograms.map((program) => {
              const now = new Date();
              const isCurrentlyPlaying =
                program.start <= now && program.stop > now;
              const isUpcoming = program.start > now;
              const isSelected = selectedProgram?.id === program.id;

              return (
                <div
                  key={program.id}
                  ref={isSelected ? selectedProgramRef : undefined}
                >
                  <ProgramCard
                    program={program}
                    channel={channel}
                    isCurrentlyPlaying={isCurrentlyPlaying}
                    isUpcoming={
                      isUpcoming &&
                      program.start.getTime() - now.getTime() <
                        2 * 60 * 60 * 1000
                    }
                    isSelected={isSelected}
                    onClick={onProgramPlay}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <p>No program information available for this day</p>
          </div>
        )}
      </div>
    </div>
  );
}
