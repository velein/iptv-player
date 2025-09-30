import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useEpg } from '../hooks/useEpg';
import { usePlaylist } from '../hooks/usePlaylist';
import type { EpgProgram } from '../types/epg';

interface EpgSearchProps {
  onClose: () => void;
  onProgramSelect?: (program: EpgProgram, channelId: string) => void;
}

interface ProgramWithChannel extends EpgProgram {
  channelId: string;
  channelName: string;
}

export default function EpgSearch({ onClose, onProgramSelect }: EpgSearchProps) {
  const [executedQuery, setExecutedQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [showEnded, setShowEnded] = useState(true);
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [allSearchResults, setAllSearchResults] = useState<ProgramWithChannel[]>([]);
  const { searchPrograms, epgData } = useEpg();
  const { playlist } = usePlaylist();
  const navigate = useNavigate();

  // Simple controlled input
  const [inputValue, setInputValue] = useState('');

  // Handle form submission
  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (inputValue.trim().length >= 2) {
      setIsSearching(true);
      performSearch(inputValue.trim());
    }
  };

  // Handle input change with debouncing for better performance
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    
    // Clear results immediately when input is cleared
    if (value.trim() === '') {
      setExecutedQuery('');
      setAllSearchResults([]);
      setSelectedIndex(0);
    }
  };

  // Optimized search function
  const performSearch = async (query: string) => {
    try {
      setExecutedQuery(query);
      
      if (!epgData || !playlist) {
        setAllSearchResults([]);
        setIsSearching(false);
        return;
      }

      const programs = searchPrograms(query);
      
      // Early return if no programs found
      if (!programs.length) {
        setAllSearchResults([]);
        setIsSearching(false);
        return;
      }

      const programsWithChannels: ProgramWithChannel[] = [];

      // Limit results to prevent performance issues
      const limitedPrograms = programs.slice(0, 50);

      // Create optimized lookup maps for faster channel matching
      const channelMaps = {
        byId: new Map(playlist.channels.map(c => [c.id.toLowerCase(), c])),
        byName: new Map(playlist.channels.map(c => [c.name.toLowerCase(), c])),
        byEpgId: new Map(playlist.channels.filter(c => c.epgId).map(c => [c.epgId!.toLowerCase(), c])),
      };

      // Process programs efficiently
      for (const program of limitedPrograms) {
        if (!program.channelId) continue;

        const channelIdLower = program.channelId.toLowerCase();
        const playlistChannel = 
          channelMaps.byId.get(channelIdLower) ||
          channelMaps.byName.get(channelIdLower) ||
          channelMaps.byEpgId.get(channelIdLower);

        if (playlistChannel) {
          programsWithChannels.push({
            ...program,
            channelId: playlistChannel.id,
            channelName: playlistChannel.name,
          });
        }
      }

      // Sort by most recent programs first
      const sortedResults = programsWithChannels.sort((a, b) => {
        return b.start.getTime() - a.start.getTime();
      });

      setAllSearchResults(sortedResults);
      setSelectedIndex(0);
      setIsSearching(false);
    } catch (error) {
      console.error('Error in EPG search:', error);
      setAllSearchResults([]);
      setIsSearching(false);
    }
  };

  // Filter results based on checkbox selections - optimized for performance
  const filteredSearchResults = useMemo(() => {
    if (!allSearchResults.length) return [];

    // Cache the current time to avoid multiple Date() calls
    const now = Date.now();

    return allSearchResults.filter(program => {
      const startTime = program.start.getTime();
      const stopTime = program.stop.getTime();

      const isEnded = stopTime <= now;
      const isUpcoming = startTime > now;
      const isLive = startTime <= now && stopTime > now;

      // Always show live programs
      if (isLive) return true;

      // Filter based on checkbox selections
      if (isEnded && showEnded) return true;
      if (isUpcoming && showUpcoming) return true;

      return false;
    });
  }, [allSearchResults, showEnded, showUpcoming]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredSearchResults.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && filteredSearchResults[selectedIndex]) {
        e.preventDefault();
        handleProgramSelect(filteredSearchResults[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredSearchResults, selectedIndex, onClose]);

  // Reset selected index when search results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredSearchResults]);

  const handleProgramSelect = (program: ProgramWithChannel) => {
    const targetChannel = playlist?.channels.find(c => c.id === program.channelId);

    if (!targetChannel) {
      alert(`Channel "${program.channelName}" not found in playlist`);
      return;
    }

    // Navigate to the channel first
    navigate({ to: `/player/${program.channelId}` });

    // Notify parent component
    onProgramSelect?.(program, program.channelId);

    // Wait a bit for navigation to complete, then dispatch the program play event
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('epg-program-play', {
          detail: {
            program,
            channel: targetChannel
          },
        })
      );
    }, 100);

    onClose();
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const getProgramStatus = useMemo(() => {
    const now = new Date();
    return (program: EpgProgram) => {
      if (program.start <= now && program.stop > now) {
        return { status: 'live', label: 'LIVE', color: 'bg-red-600' };
      } else if (program.start > now) {
        return { status: 'upcoming', label: 'UPCOMING', color: 'bg-blue-600' };
      } else {
        return { status: 'past', label: 'ENDED', color: 'bg-gray-600' };
      }
    };
  }, []); // Only recalculate when component mounts

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg w-full max-w-4xl mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">EPG Search</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {/* Search Input */}
        <div className="p-6 border-b border-gray-700">
          <form onSubmit={handleSearch} className="flex gap-3">
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              placeholder="Search for programs, shows, movies..."
              className="flex-1 bg-gray-700 border border-gray-600 rounded px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <button
              type="submit"
              disabled={inputValue.trim().length < 2 || isSearching}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </form>
          <p className="text-xs text-gray-400 mt-2">
            Enter search term and press Enter or click Search. Use ↑↓ arrows to navigate results, Enter to select, Esc to close
          </p>
        </div>

        {/* Filters */}
        {executedQuery.trim() && (
          <div className="px-6 py-4 border-b border-gray-700 bg-gray-750">
            <div className="flex items-center space-x-6">
              <span className="text-sm font-medium text-gray-300">Show:</span>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showEnded}
                  onChange={(e) => setShowEnded(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                />
                <span className="text-sm text-gray-300">Ended Programs</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showUpcoming}
                  onChange={(e) => setShowUpcoming(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                />
                <span className="text-sm text-gray-300">Upcoming Programs</span>
              </label>
              <div className="text-xs text-gray-400">
                (Live programs are always shown)
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {!executedQuery.trim() ? (
            <div className="p-8 text-center text-gray-400">
              <div className="text-4xl mb-4">🔍</div>
              <p>Enter search terms and click Search to find EPG programs</p>
              <p className="text-sm mt-2">Minimum 2 characters required</p>
            </div>
          ) : isSearching ? (
            <div className="p-8 text-center text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p>Searching...</p>
            </div>
          ) : allSearchResults.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <div className="text-4xl mb-4">📺</div>
              <p>No programs found for "{executedQuery}"</p>
              <p className="text-sm mt-2">Try different keywords or check your EPG data</p>
            </div>
          ) : filteredSearchResults.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <div className="text-4xl mb-4">🔍</div>
              <p>No programs match the current filters</p>
              <p className="text-sm mt-2">
                Found {allSearchResults.length} total result{allSearchResults.length !== 1 ? 's' : ''} for "{executedQuery}", but none match your filter selection
              </p>
              <p className="text-xs mt-2 text-gray-500">
                Try enabling "Ended Programs" or "Upcoming Programs" filters above
              </p>
            </div>
          ) : (
            <div className="p-4">
              <div className="text-sm text-gray-400 mb-4">
                Showing {filteredSearchResults.length} of {allSearchResults.length} program{allSearchResults.length !== 1 ? 's' : ''} for "{executedQuery}" (sorted by most recent)
              </div>
              <div className="space-y-2">
                {filteredSearchResults.map((program, index) => {
                  const programStatus = getProgramStatus(program);
                  const isSelected = index === selectedIndex;

                  return (
                    <div
                      key={`${program.channelId}-${program.start.getTime()}-${program.title}-${index}`}
                      onClick={() => handleProgramSelect(program)}
                      className={`p-4 rounded-lg cursor-pointer transition-colors ${isSelected
                          ? 'bg-blue-600 ring-2 ring-blue-400'
                          : 'bg-gray-700 hover:bg-gray-600'
                        }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3 mb-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium text-white ${programStatus.color}`}>
                              {programStatus.label}
                            </span>
                            <span className="text-sm text-gray-300">
                              {program.channelName}
                            </span>
                          </div>
                          <h3 className="font-semibold text-white mb-1 truncate">
                            {program.title}
                          </h3>
                          {program.description && (
                            <p className="text-sm text-gray-300 line-clamp-2 mb-2">
                              {program.description}
                            </p>
                          )}
                          <div className="flex items-center space-x-4 text-xs text-gray-400">
                            <span>
                              {formatDate(program.start)} • {formatTime(program.start)} - {formatTime(program.stop)}
                            </span>
                            {program.category && (
                              <span className="bg-gray-600 px-2 py-1 rounded">
                                {program.category}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="ml-4 flex-shrink-0">
                          <button className="text-blue-400 hover:text-blue-300 text-sm">
                            Watch →
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}