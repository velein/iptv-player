import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useEpgState, type EpgLoadingState } from './useEpgState';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock window events
const mockEventListeners: { [key: string]: EventListener[] } = {};

Object.defineProperty(window, 'addEventListener', {
  value: vi.fn((event: string, listener: EventListener) => {
    if (!mockEventListeners[event]) {
      mockEventListeners[event] = [];
    }
    mockEventListeners[event].push(listener);
  }),
});

Object.defineProperty(window, 'removeEventListener', {
  value: vi.fn((event: string, listener: EventListener) => {
    if (mockEventListeners[event]) {
      const index = mockEventListeners[event].indexOf(listener);
      if (index > -1) {
        mockEventListeners[event].splice(index, 1);
      }
    }
  }),
});

Object.defineProperty(window, 'dispatchEvent', {
  value: vi.fn((event: Event) => {
    const listeners = mockEventListeners[event.type];
    if (listeners) {
      listeners.forEach(listener => listener(event));
    }
  }),
});

describe('useEpgState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockEventListeners).forEach(key => {
      mockEventListeners[key] = [];
    });
    // Reset localStorage mock to return null by default
    localStorageMock.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with default state when no EPG URL is saved', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const { result } = renderHook(() => useEpgState());

      expect(result.current.epgState).toEqual({
        loadingState: 'idle',
        error: null,
        isFirstTimeSetup: true,
        hasValidEpgUrl: false,
      });
    });

    it('should initialize with EPG URL present when settings exist', () => {
      const mockSettings = {
        epgUrl: 'https://example.com/epg.xml',
        epgRefreshInterval: 6,
        epgCacheEnabled: true,
      };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockSettings));

      const { result } = renderHook(() => useEpgState());

      expect(result.current.epgState).toEqual({
        loadingState: 'idle',
        error: null,
        isFirstTimeSetup: false,
        hasValidEpgUrl: true,
      });
    });

    it('should handle corrupted localStorage gracefully', () => {
      localStorageMock.getItem.mockReturnValue('invalid-json');
      
      // Suppress console.error for this test since we expect it
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useEpgState());

      expect(result.current.epgState).toEqual({
        loadingState: 'idle',
        error: null,
        isFirstTimeSetup: true,
        hasValidEpgUrl: false,
      });

      consoleSpy.mockRestore();
    });
  });

  describe('State Transitions', () => {
    it('should transition loading states correctly', () => {
      const { result } = renderHook(() => useEpgState());

      act(() => {
        result.current.setLoadingState('loading');
      });

      expect(result.current.epgState.loadingState).toBe('loading');
      expect(result.current.stateInfo.message).toBe('Loading EPG...');
      expect(result.current.stateInfo.progress).toBe(25);

      act(() => {
        result.current.setLoadingState('parsing');
      });

      expect(result.current.epgState.loadingState).toBe('parsing');
      expect(result.current.stateInfo.message).toBe('Parsing EPG...');
      expect(result.current.stateInfo.progress).toBe(75);

      act(() => {
        result.current.setLoadingState('complete');
      });

      expect(result.current.epgState.loadingState).toBe('complete');
      expect(result.current.stateInfo.message).toBe('EPG loaded successfully');
      expect(result.current.stateInfo.progress).toBe(100);
    });

    it('should handle error state correctly', () => {
      const { result } = renderHook(() => useEpgState());
      const errorMessage = 'Failed to load EPG';

      act(() => {
        result.current.setError(errorMessage);
      });

      expect(result.current.epgState.loadingState).toBe('error');
      expect(result.current.epgState.error).toBe(errorMessage);
      expect(result.current.stateInfo.message).toBe(errorMessage);
      expect(result.current.stateInfo.error).toBe(errorMessage);
    });

    it('should clear error when transitioning away from error state', () => {
      const { result } = renderHook(() => useEpgState());

      act(() => {
        result.current.setError('Test error');
      });

      expect(result.current.epgState.error).toBe('Test error');

      act(() => {
        result.current.setLoadingState('loading');
      });

      expect(result.current.epgState.error).toBeNull();
      expect(result.current.epgState.loadingState).toBe('loading');
    });

    it('should clear error explicitly', () => {
      const { result } = renderHook(() => useEpgState());

      act(() => {
        result.current.setError('Test error');
      });

      expect(result.current.epgState.error).toBe('Test error');
      expect(result.current.epgState.loadingState).toBe('error');

      act(() => {
        result.current.clearError();
      });

      expect(result.current.epgState.error).toBeNull();
      expect(result.current.epgState.loadingState).toBe('idle');
    });
  });

  describe('First Time Setup Detection', () => {
    it('should update first time setup when settings change', () => {
      localStorageMock.getItem.mockReturnValue(null);
      const { result } = renderHook(() => useEpgState());

      expect(result.current.epgState.isFirstTimeSetup).toBe(true);
      expect(result.current.epgState.hasValidEpgUrl).toBe(false);

      // Simulate settings being saved
      const mockSettings = {
        epgUrl: 'https://example.com/epg.xml',
        epgRefreshInterval: 6,
        epgCacheEnabled: true,
      };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockSettings));

      act(() => {
        result.current.checkFirstTimeSetup();
      });

      expect(result.current.epgState.isFirstTimeSetup).toBe(false);
      expect(result.current.epgState.hasValidEpgUrl).toBe(true);
    });
  });

  describe('Event Listeners', () => {
    it('should listen for storage events', () => {
      // Ensure localStorage returns null initially
      localStorageMock.getItem.mockReturnValue(null);
      const { result } = renderHook(() => useEpgState());

      // Initially no EPG URL
      expect(result.current.epgState.isFirstTimeSetup).toBe(true);

      // Simulate storage event with new EPG URL
      const mockSettings = {
        epgUrl: 'https://example.com/epg.xml',
        epgRefreshInterval: 6,
        epgCacheEnabled: true,
      };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockSettings));

      act(() => {
        const storageEvent = new StorageEvent('storage', {
          key: 'iptv-settings',
          newValue: JSON.stringify(mockSettings),
        });
        window.dispatchEvent(storageEvent);
      });

      expect(result.current.epgState.isFirstTimeSetup).toBe(false);
      expect(result.current.epgState.hasValidEpgUrl).toBe(true);
    });

    it('should listen for custom settings-updated events', () => {
      const { result } = renderHook(() => useEpgState());

      // Initially no EPG URL
      localStorageMock.getItem.mockReturnValue(null);
      expect(result.current.epgState.isFirstTimeSetup).toBe(true);

      // Simulate custom event with new EPG URL
      const mockSettings = {
        epgUrl: 'https://example.com/epg.xml',
        epgRefreshInterval: 6,
        epgCacheEnabled: true,
      };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockSettings));

      act(() => {
        const customEvent = new CustomEvent('settings-updated');
        window.dispatchEvent(customEvent);
      });

      expect(result.current.epgState.isFirstTimeSetup).toBe(false);
      expect(result.current.epgState.hasValidEpgUrl).toBe(true);
    });

    it('should clean up event listeners on unmount', () => {
      const { unmount } = renderHook(() => useEpgState());

      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('storage', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('settings-updated', expect.any(Function));
    });
  });

  describe('State Info', () => {
    it('should provide correct state info for each loading state', () => {
      const { result } = renderHook(() => useEpgState());

      // Idle state
      expect(result.current.stateInfo).toEqual({
        state: 'idle',
      });

      // Loading state
      act(() => {
        result.current.setLoadingState('loading');
      });
      expect(result.current.stateInfo).toEqual({
        state: 'loading',
        message: 'Loading EPG...',
        progress: 25,
      });

      // Parsing state
      act(() => {
        result.current.setLoadingState('parsing');
      });
      expect(result.current.stateInfo).toEqual({
        state: 'parsing',
        message: 'Parsing EPG...',
        progress: 75,
      });

      // Complete state
      act(() => {
        result.current.setLoadingState('complete');
      });
      expect(result.current.stateInfo).toEqual({
        state: 'complete',
        message: 'EPG loaded successfully',
        progress: 100,
      });

      // Error state
      const errorMessage = 'Test error';
      act(() => {
        result.current.setError(errorMessage);
      });
      expect(result.current.stateInfo).toEqual({
        state: 'error',
        message: errorMessage,
        error: errorMessage,
      });
    });
  });
});