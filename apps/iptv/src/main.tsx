import { StrictMode, useState, useEffect } from 'react';
import * as ReactDOM from 'react-dom/client';
import {
  RouterProvider,
  createRouter,
  createRootRoute,
  createRoute,
  useLocation,
  useNavigate,
} from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Outlet } from '@tanstack/react-router';

import PlaylistSelector from './components/PlaylistSelector';
import ChannelBrowserPage from './components/ChannelBrowserPage';
import VideoPlayer from './components/VideoPlayer';
import Settings from './components/Settings';
import ChannelEpg from './components/ChannelEpg';
import EpgSearch from './components/EpgSearch';
import { useEpg } from './hooks/useEpg';
import { usePlaylist } from './hooks/usePlaylist';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep data fresh for 1 hour by default
      staleTime: 60 * 60 * 1000,
      // Keep inactive queries in cache for 24 hours
      gcTime: 24 * 60 * 60 * 1000,
      // Retry failed requests 2 times
      retry: 2,
      // Don't refetch on window focus (annoying for IPTV)
      refetchOnWindowFocus: false,
    },
  },
});

// App version
const APP_VERSION = 'v1.0.0';

// Define root component
function RootComponent() {
  const [showSettings, setShowSettings] = useState(false);
  const [showEpgSearch, setShowEpgSearch] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<any>(null);
  const { hasData: hasEpgData } = useEpg();
  const { playlist } = usePlaylist();
  const location = useLocation();

  // Get current channel if on player page
  const channelId = location.pathname.startsWith('/player/')
    ? location.pathname.split('/player/')[1]
    : null;
  const channel = channelId
    ? playlist?.channels.find((c) => c.id === channelId)
    : null;

  // Handle EPG program play
  const handleEpgProgramPlay = (program: any) => {
    // Dispatch a custom event that the VideoPlayer can listen to
    window.dispatchEvent(
      new CustomEvent('epg-program-play', {
        detail: { program, channel },
      })
    );
  };

  // Listen for program selection changes from VideoPlayer
  useEffect(() => {
    const handleProgramSelected = (event: CustomEvent) => {
      console.log('🎯 Main: Received program-selected event:', event.detail.program?.title);
      setSelectedProgram(event.detail.program);
    };

    console.log('🎯 Main: Setting up program-selected event listener');
    window.addEventListener(
      'program-selected',
      handleProgramSelected as EventListener
    );

    return () => {
      console.log('🎯 Main: Removing program-selected event listener');
      window.removeEventListener(
        'program-selected',
        handleProgramSelected as EventListener
      );
    };
  }, []);

  return (
    <div className="bg-gray-900 text-white flex gap-4 p-4 min-h-screen h-screen overflow-hidden">
      {/* Left side - Header + Main content */}
      <div className="flex-1 flex flex-col gap-4">
        <header className="bg-gray-800 border-b border-gray-700 p-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold">IPTV Player</h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-900 text-blue-200 border border-blue-700">
                {APP_VERSION}
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <BackToChannelsButton />
              {hasEpgData && (
                <button
                  onClick={() => setShowEpgSearch(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded transition-colors text-sm"
                  title="Search EPG Programs"
                >
                  🔍 EPG Search
                </button>
              )}
              <button
                onClick={() => setShowSettings(true)}
                className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded transition-colors text-sm"
                title="Settings"
              >
                ⚙️ Settings
              </button>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>

      {/* EPG Sidebar */}
      {hasEpgData && channel && (
        <div className="w-[500px] flex-shrink-0 h-screen">
          <ChannelEpg
            channel={channel}
            showCurrentOnly={false}
            onProgramPlay={handleEpgProgramPlay}
            selectedProgram={selectedProgram}
            epgStatus={<EpgStatusIndicator />}
          />
        </div>
      )}

      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      {showEpgSearch && (
        <EpgSearch 
          onClose={() => setShowEpgSearch(false)}
          onProgramSelect={(program, channelId) => {
            // Update selected program for EPG sidebar
            setSelectedProgram(program);
          }}
        />
      )}
    </div>
  );
}

function BackToChannelsButton() {
  const location = useLocation();
  const navigate = useNavigate();

  // Only show on player page
  if (location.pathname.startsWith('/player/')) {
    return (
      <button
        onClick={() => navigate({ to: '/channels' })}
        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded transition-colors text-sm"
        title="Back to Channels"
      >
        Back to Channels
      </button>
    );
  }

  return null;
}

function EpgStatusIndicator() {
  const {
    isLoading,
    isFetching,
    hasData,
    error,
    settings,
    refreshEpg,
    canReload,
    epgLoadedAt,
  } = useEpg();

  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('pl-PL', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Gray: EPG not configured
  if (!settings.epgUrl) {
    return (
      <div className="flex items-center space-x-2 text-sm">
        <span className="text-gray-500">●</span>
        <span className="text-gray-400">EPG not configured</span>
      </div>
    );
  }

  // Yellow: Loading/Processing
  if (isLoading || isFetching) {
    return (
      <div className="flex items-center space-x-2 text-sm">
        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-yellow-500"></div>
        <span className="text-yellow-400">Processing EPG...</span>
      </div>
    );
  }

  // Red: Error
  if (error) {
    return (
      <div className="flex items-center space-x-3 text-sm">
        <div className="flex items-center space-x-2">
          <span className="text-red-500">●</span>
          <span className="text-red-400">EPG failed</span>
        </div>
      </div>
    );
  }

  // Green: EPG loaded successfully
  if (hasData) {
    return (
      <div className="flex items-center space-x-3 text-sm">
        <div className="flex items-center space-x-2">
          <span className="text-green-500">●</span>
          <span className="text-green-400">
            EPG loaded {epgLoadedAt && `(${formatTimeAgo(epgLoadedAt)})`}
          </span>
        </div>
      </div>
    );
  }

  // Gray: No cache - show Load button
  return (
    <div className="flex items-center space-x-3 text-sm">
      <div className="flex items-center space-x-2">
        <span className="text-gray-500">●</span>
        <span className="text-gray-400">No EPG cache</span>
      </div>
      <button
        onClick={refreshEpg}
        disabled={!canReload}
        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Load EPG
      </button>
    </div>
  );
}

function HomeComponent() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-4">Welcome to IPTV Player</h2>
        <p className="text-gray-300 mb-8">
          Select your M3U playlist to start watching channels
        </p>
      </div>
      <PlaylistSelector />
    </div>
  );
}

function ChannelsComponent() {
  return <ChannelBrowserPage />;
}

function PlayerComponent() {
  return (
    <div>
      <VideoPlayer />
    </div>
  );
}

// Create routes
const rootRoute = createRootRoute({
  component: RootComponent,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomeComponent,
});

const channelsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/channels',
  component: ChannelsComponent,
});

const playerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/player/$channelId',
  component: PlayerComponent,
});

// Create the route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  channelsRoute,
  playerRoute,
]);

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
);
