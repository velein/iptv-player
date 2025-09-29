/**
 * Utility functions for handling stream URLs in HTTPS environments
 */

/**
 * Checks if we're running in an HTTPS environment
 */
function isHttpsEnvironment(): boolean {
  return typeof window !== 'undefined' && window.location.protocol === 'https:';
}

/**
 * Checks if a URL is HTTP (insecure)
 */
function isHttpUrl(url: string): boolean {
  return url.startsWith('http://');
}

/**
 * Available HTTPS proxy services for streaming
 * Note: Some proxies don't work well with HLS segments due to URL rewriting
 */
const STREAM_PROXIES = [
  // CORS Anywhere style proxy (works better with HLS)
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,

  // Simple proxy that just prepends the URL (good for HLS)
  (url: string) => `https://proxy.cors.sh/${url}`,

  // This one tends to rewrite URLs which breaks HLS segments - disabled
  // (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

/**
 * Converts an HTTP stream URL to HTTPS if needed
 * @param streamUrl - The original stream URL
 * @param proxyIndex - Which proxy to use (0-based, for retry logic)
 * @returns The proxied HTTPS URL or original URL if no proxy needed
 */
export function getSecureStreamUrl(
  streamUrl: string,
  proxyIndex: number = 0
): string {
  // If we're not in HTTPS environment, return original URL
  if (!isHttpsEnvironment()) {
    return streamUrl;
  }

  // If URL is already HTTPS, return as-is
  if (!isHttpUrl(streamUrl)) {
    return streamUrl;
  }

  // For HLS streams (.m3u8), proxying often breaks segment loading
  // Return original URL and let error handling deal with it
  if (streamUrl.includes('.m3u8')) {
    console.warn(
      '🔒 HTTPS: HLS stream detected. HTTP HLS streams may not work in HTTPS deployment.'
    );
    return streamUrl;
  }

  // For non-HLS streams, try proxying
  if (proxyIndex < STREAM_PROXIES.length) {
    const proxiedUrl = STREAM_PROXIES[proxyIndex](streamUrl);
    console.log(
      `🔒 HTTPS: Proxying HTTP stream via proxy ${proxyIndex + 1}:`,
      proxiedUrl
    );
    return proxiedUrl;
  }

  // Fallback: return original URL (will likely fail but user will see error)
  console.warn(
    '🔒 HTTPS: No more proxies available, returning original HTTP URL'
  );
  return streamUrl;
}

/**
 * Gets the number of available stream proxies
 */
export function getStreamProxyCount(): number {
  return STREAM_PROXIES.length;
}

/**
 * Checks if a stream URL needs proxying in current environment
 */
export function needsStreamProxy(streamUrl: string): boolean {
  return isHttpsEnvironment() && isHttpUrl(streamUrl);
}
