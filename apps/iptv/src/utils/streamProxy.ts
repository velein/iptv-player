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
 * Checks if HTTPS proxy is enabled in user settings
 */
function isHttpsProxyEnabled(): boolean {
  try {
    const settings = localStorage.getItem('iptv-settings');
    if (settings) {
      const parsed = JSON.parse(settings);
      return parsed.enableHttpsProxy === true;
    }
  } catch {
    // Ignore parsing errors
  }
  return false;
}

/**
 * Checks if a URL is HTTP (insecure)
 */
function isHttpUrl(url: string): boolean {
  return url.startsWith('http://');
}

/**
 * Available HTTPS proxy services for streaming
 * These are popular public CORS proxy services that help bypass Mixed Content restrictions
 */
const STREAM_PROXIES = [
  // cors-anywhere style proxies (work well for simple HTTP->HTTPS conversion)
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,

  // Simple URL prepending proxy (good for direct streaming)
  (url: string) => `https://proxy.cors.sh/${url}`,

  // GitHub-based CORS proxy (https://github.com/Rob--W/cors-anywhere)
  (url: string) => `https://cors-anywhere.herokuapp.com/${url}`,

  // Additional backup proxies
  (url: string) =>
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
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

  // Check if user has enabled HTTPS proxy in settings
  if (!isHttpsProxyEnabled()) {
    console.log(
      '🔒 HTTPS: Proxy disabled in settings, returning original HTTP URL'
    );
    return streamUrl;
  }

  // For HLS streams (.m3u8), warn but try proxying if user enabled it
  if (streamUrl.includes('.m3u8')) {
    console.warn(
      '🔒 HTTPS: HLS stream detected. Proxying may break segment loading, but user enabled proxy.'
    );
  }

  // Try proxying with user's permission
  if (proxyIndex < STREAM_PROXIES.length) {
    const proxiedUrl = STREAM_PROXIES[proxyIndex](streamUrl);
    console.log(
      `🔒 HTTPS: User enabled proxy - using proxy ${proxyIndex + 1}/${
        STREAM_PROXIES.length
      }:`,
      proxiedUrl
    );
    return proxiedUrl;
  }

  // Fallback: return original URL (will likely fail but user will see error)
  console.warn('🔒 HTTPS: All proxies exhausted, returning original HTTP URL');
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
  return isHttpsEnvironment() && isHttpUrl(streamUrl) && isHttpsProxyEnabled();
}
