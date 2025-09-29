import { StrictMode } from 'react'
import * as ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter, createRootRoute, createRoute } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Outlet } from '@tanstack/react-router'

import PlaylistSelector from './components/PlaylistSelector'
import ChannelList from './components/ChannelList'
import VideoPlayer from './components/VideoPlayer'
import { useEpg } from './hooks/useEpg'

const queryClient = new QueryClient()

// Define root component
function RootComponent() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">IPTV Player</h1>
          <EpgStatusIndicator />
        </div>
      </header>
      <main className="container mx-auto p-4">
        <Outlet />
      </main>
    </div>
  )
}

function EpgStatusIndicator() {
  const { isLoading, hasData, error } = useEpg()

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2 text-sm">
        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500"></div>
        <span className="text-gray-400">Loading EPG...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center space-x-2 text-sm">
        <span className="text-red-400">⚠</span>
        <span className="text-gray-400">EPG unavailable</span>
      </div>
    )
  }

  if (hasData) {
    return (
      <div className="flex items-center space-x-2 text-sm">
        <span className="text-green-400">●</span>
        <span className="text-gray-400">EPG loaded</span>
      </div>
    )
  }

  return null
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
  )
}

function ChannelsComponent() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Channels</h2>
      <ChannelList />
    </div>
  )
}

function PlayerComponent() {
  return (
    <div>
      <VideoPlayer />
    </div>
  )
}

// Create routes
const rootRoute = createRootRoute({
  component: RootComponent,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomeComponent,
})

const channelsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/channels',
  component: ChannelsComponent,
})

const playerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/player/$channelId',
  component: PlayerComponent,
})

// Create the route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  channelsRoute,
  playerRoute,
])

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
)

root.render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
)
