import type { Channel, CatchupInfo } from '../types/channel';

export function getCatchupInfo(channel: Channel): CatchupInfo {
  const now = new Date();

  // If catchup attributes are missing but URL suggests timeshift capability
  // (common issue with some M3U parsers), assume default values
  let timeshiftHours = channel.timeshift || 0;
  let catchupType = channel.catchup || '';
  let catchupAvailable = !!(
    channel.catchup &&
    channel.timeshift &&
    channel.timeshift > 0
  );

  // Provider-specific catchup detection with extended windows
  if (channel.url) {
    const urlLower = channel.url.toLowerCase();
    // Check for plusx.tv provider (supports 5 days catchup despite M3U showing 10h)
    if (urlLower.includes('cdnx1.plusx.tv') || urlLower.includes('plusx.tv')) {
      console.log(
        '🔄 EXTENDED: Detected plusx.tv provider, using 5 days catchup (120h)'
      );
      timeshiftHours = 120; // 5 days = 120 hours
      catchupType = channel.catchup || 'fs';
      catchupAvailable = true;
    }
    // Check for other itvn.io providers
    else if (urlLower.includes('itvn.io')) {
      console.log(
        '🔄 FALLBACK: Detected itvn.io provider, assuming 10h catchup'
      );
      timeshiftHours = channel.timeshift || 10;
      catchupType = channel.catchup || 'fs';
      catchupAvailable = true;
    }
  }

  const startTime = new Date(now.getTime() - timeshiftHours * 60 * 60 * 1000);

  console.log('Getting catchup info for channel:', {
    name: channel.name,
    originalTimeshift: channel.timeshift,
    originalCatchup: channel.catchup,
    finalTimeshift: timeshiftHours,
    finalCatchup: catchupType,
    available: catchupAvailable,
    fallbackUsed: !channel.timeshift && catchupAvailable,
  });

  // Allow catchup for programs that are currently airing or scheduled for today/tomorrow
  // Add a buffer of 24 hours into the future to accommodate programs scheduled for today
  const endTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

  return {
    available: catchupAvailable,
    timeshiftHours,
    type: catchupType,
    startTime,
    endTime: endTime,
  };
}

export function generateCatchupUrl(channel: Channel, targetTime: Date): string {
  const catchupInfo = getCatchupInfo(channel);

  console.log('Generating catchup URL for:', {
    channel: channel.name,
    targetTime: targetTime.toISOString(),
    catchupAvailable: catchupInfo.available,
    catchupType: channel.catchup,
    baseUrl: channel.url,
  });

  if (!catchupInfo.available) {
    console.log('Catchup not available, returning live URL');
    return channel.url; // Return live URL if no catchup
  }

  // Validate time is within catchup range
  if (targetTime < catchupInfo.startTime || targetTime > catchupInfo.endTime) {
    console.log('Time out of catchup range, returning live URL');
    return channel.url; // Return live URL if time is out of range
  }

  const baseUrl = channel.url;
  const utcTime = Math.floor(targetTime.getTime() / 1000); // Unix timestamp

  console.log('UTC timestamp:', utcTime);

  // Different catchup URL formats based on type
  let catchupUrl: string;
  switch (channel.catchup?.toLowerCase()) {
    case 'fs': // FlussStreamS format
      catchupUrl = generateFlussStreamsCatchupUrl(baseUrl, utcTime);
      break;

    case 'shift':
      catchupUrl = generateShiftCatchupUrl(baseUrl, utcTime);
      break;

    case 'default':
    case 'append':
      catchupUrl = generateAppendCatchupUrl(baseUrl, utcTime);
      break;

    default:
      // Try FlussStreamS format as default for unknown types
      catchupUrl = generateFlussStreamsCatchupUrl(baseUrl, utcTime);
      break;
  }

  console.log('Generated catchup URL:', catchupUrl);
  return catchupUrl;
}

function generateFlussStreamsCatchupUrl(
  baseUrl: string,
  utcTime: number
): string {
  // FlussStreamS catchup format - multiple possible patterns to try
  // Based on TiviMate and real IPTV catchup implementations

  try {
    const url = new URL(baseUrl);
    console.log('Original URL parts:', {
      protocol: url.protocol,
      host: url.host,
      pathname: url.pathname,
      search: url.search,
    });

    const pathParts = url.pathname.split('/').filter((part) => part.length > 0);
    console.log('Path parts:', pathParts);

    // Try multiple catchup URL formats that are commonly used
    const formats = [];

    // Format 1: Timeshift path format (most common for FlussStreamS)
    // Original: /325/mono.m3u8 -> /timeshift/1234567890/325/mono.m3u8
    if (pathParts.length >= 1) {
      const channelPath = pathParts.join('/');
      const newPath = `/timeshift/${utcTime}/${channelPath}`;
      const format1Url = new URL(baseUrl);
      format1Url.pathname = newPath;
      formats.push({
        name: 'timeshift_path',
        url: format1Url.toString(),
      });
    }

    // Format 2: Archive path format
    // Original: /325/mono.m3u8 -> /archive/1234567890/325/mono.m3u8
    if (pathParts.length >= 1) {
      const channelPath = pathParts.join('/');
      const newPath = `/archive/${utcTime}/${channelPath}`;
      const format2Url = new URL(baseUrl);
      format2Url.pathname = newPath;
      formats.push({
        name: 'archive_path',
        url: format2Url.toString(),
      });
    }

    // Format 3: UTC timestamp parameter
    const format3Url = new URL(baseUrl);
    format3Url.searchParams.set('utc', utcTime.toString());
    formats.push({
      name: 'utc_param',
      url: format3Url.toString(),
    });

    // Format 4: Offset parameter (seconds from now)
    const offsetSeconds = Math.floor((Date.now() - utcTime * 1000) / 1000);
    const format4Url = new URL(baseUrl);
    format4Url.searchParams.set('offset', offsetSeconds.toString());
    formats.push({
      name: 'offset_param',
      url: format4Url.toString(),
    });

    // Format 5: Archive timestamp parameter
    const format5Url = new URL(baseUrl);
    format5Url.searchParams.set('archive', utcTime.toString());
    formats.push({
      name: 'archive_param',
      url: format5Url.toString(),
    });

    console.log('All catchup URL format attempts:', formats);

    // Try the UTC parameter format first (more compatible)
    const result = formats[2].url; // UTC parameter format
    console.log('Using primary catchup URL (utc_param):', result);

    return result;
  } catch (error) {
    console.error('Error generating FlussStreamS catchup URL:', error);
    return baseUrl;
  }
}

function generateShiftCatchupUrl(baseUrl: string, utcTime: number): string {
  // Shift format: add ?utc={timestamp} parameter
  try {
    const url = new URL(baseUrl);
    url.searchParams.set('utc', utcTime.toString());
    return url.toString();
  } catch (error) {
    console.error('Error generating shift catchup URL:', error);
    return baseUrl;
  }
}

function generateAppendCatchupUrl(baseUrl: string, utcTime: number): string {
  // Append format: add &utc={timestamp} to existing query string
  try {
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}utc=${utcTime}`;
  } catch (error) {
    console.error('Error generating append catchup URL:', error);
    return baseUrl;
  }
}

export function isTimeWithinCatchup(channel: Channel, time: Date): boolean {
  const catchupInfo = getCatchupInfo(channel);
  const now = new Date();
  const timeDiffHours = (now.getTime() - time.getTime()) / (1000 * 60 * 60);

  console.log(
    '🔍 CATCHUP DEBUG - Current time:',
    now.toISOString(),
    '(' + now.toString() + ')'
  );
  console.log(
    '🔍 CATCHUP DEBUG - Target time:',
    time.toISOString(),
    '(' + time.toString() + ')'
  );

  // Check if catchup is configured for this channel
  if (!catchupInfo.available) {
    console.log('Catchup not available for channel - no catchup configuration');
    return false;
  }

  // Check if time is too far in the future (allow some buffer for ongoing programs)
  if (time > catchupInfo.endTime) {
    console.log('Time is too far in the future, cannot catchup');
    console.log('Target time:', time.toISOString());
    console.log('Max allowed time:', catchupInfo.endTime.toISOString());
    console.log('Time difference (hours):', timeDiffHours.toFixed(2));

    // Additional check: allow if it's within 48 hours in the future (for scheduled programs)
    const hoursDifference = Math.abs(timeDiffHours);
    if (timeDiffHours < 0 && hoursDifference <= 48) {
      console.log('Allowing future program within 48 hours');
    } else {
      return false;
    }
  }

  // Check if time is within catchup window
  const withinWindow = time >= catchupInfo.startTime;
  console.log('Time within catchup window:', withinWindow);
  console.log('Time diff from now (hours):', timeDiffHours);
  console.log('Available catchup hours:', catchupInfo.timeshiftHours);

  const result = withinWindow;
  console.log('Final catchup availability result:', result);

  return result;
}

export function formatTimeForCatchup(date: Date): string {
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

export function getCatchupTimeRange(
  channel: Channel
): { start: Date; end: Date } | null {
  const catchupInfo = getCatchupInfo(channel);

  if (!catchupInfo.available) {
    return null;
  }

  return {
    start: catchupInfo.startTime,
    end: catchupInfo.endTime,
  };
}

// Calculate relative time position (0-1) within catchup range
export function getRelativeTimePosition(channel: Channel, time: Date): number {
  const range = getCatchupTimeRange(channel);
  if (!range) return 1; // Live position

  const totalDuration = range.end.getTime() - range.start.getTime();
  const elapsed = time.getTime() - range.start.getTime();

  return Math.max(0, Math.min(1, elapsed / totalDuration));
}

// Get time from relative position (0-1) within catchup range
export function getTimeFromRelativePosition(
  channel: Channel,
  position: number
): Date {
  const range = getCatchupTimeRange(channel);
  if (!range) return new Date(); // Current time

  const totalDuration = range.end.getTime() - range.start.getTime();
  const targetTime = range.start.getTime() + position * totalDuration;

  return new Date(targetTime);
}
