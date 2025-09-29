import type { EpgData, EpgChannel, EpgProgram } from '../types/epg';
import * as pako from 'pako';

async function fetchWithCorsProxy(url: string): Promise<Response> {
  // List of public CORS proxy services
  const corsProxies = [
    'https://api.allorigins.win/raw?url=',
    'https://api.codetabs.com/v1/proxy?quest=',
    'https://corsproxy.io/?',
    'https://cors-proxy.htmldriven.com/?url=',
    'https://thingproxy.freeboard.io/fetch/',
  ];

  console.log('Attempting direct fetch first...');
  try {
    const response = await fetch(url, {
      mode: 'cors',
      headers: {
        Accept:
          'application/xml, text/xml, application/gzip, application/octet-stream, */*',
      },
    });

    if (response.ok) {
      console.log('Direct fetch successful');
      return response;
    }
  } catch (directError) {
    console.log(
      'Direct fetch failed, trying CORS proxies...',
      directError.message
    );
  }

  // Try CORS proxies
  for (let i = 0; i < corsProxies.length; i++) {
    const proxyUrl = corsProxies[i] + encodeURIComponent(url);
    console.log(`Trying proxy ${i + 1}/${corsProxies.length}:`, proxyUrl);

    try {
      const response = await fetch(proxyUrl, {
        mode: 'cors',
        headers: {
          Accept: 'application/gzip, application/octet-stream, */*',
        },
      });

      if (response.ok) {
        console.log(`Proxy ${i + 1} successful`);
        return response;
      } else {
        console.log(
          `Proxy ${i + 1} failed:`,
          response.status,
          response.statusText
        );
      }
    } catch (proxyError) {
      console.log(`Proxy ${i + 1} error:`, proxyError.message);
    }
  }

  throw new Error('All fetch attempts failed (direct and proxy)');
}

export async function fetchAndParseEpg(url: string): Promise<EpgData> {
  try {
    console.log('🔄 EPG: Fetching EPG data from:', url);

    // If URL already contains a proxy, use direct fetch
    let response: Response;
    if (
      url.includes('allorigins.win') ||
      url.includes('corsproxy.io') ||
      url.includes('codetabs.com') ||
      url.includes('htmldriven.com') ||
      url.includes('proxy')
    ) {
      console.log('🔄 EPG: URL contains proxy, using direct fetch');
      response = await fetch(url, {
        mode: 'cors',
        headers: {
          Accept:
            'application/xml, text/xml, application/gzip, application/octet-stream, */*',
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } else {
      response = await fetchWithCorsProxy(url);
    }

    console.log(
      '🔄 EPG: Response received, content-type:',
      response.headers.get('content-type')
    );
    console.log(
      '🔄 EPG: Response size:',
      response.headers.get('content-length')
    );

    const arrayBuffer = await response.arrayBuffer();
    console.log('🔄 EPG: Array buffer size:', arrayBuffer.byteLength);

    // Decompress gzip data
    const uint8Array = new Uint8Array(arrayBuffer);

    try {
      const decompressed = pako.ungzip(uint8Array, { to: 'string' });
      console.log(
        '🔄 EPG: Data decompressed successfully, size:',
        decompressed.length
      );

      // Show first 500 characters for debugging
      console.log('🔄 EPG: Data sample:', decompressed.substring(0, 500));

      // Parse the XML
      return parseXmltvData(decompressed);
    } catch (decompError) {
      console.log(
        '🔄 EPG: Failed to decompress, trying as plain XML:',
        decompError.message
      );
      // Try to parse as plain text in case it's not compressed
      const textDecoder = new TextDecoder('utf-8');
      const plainText = textDecoder.decode(uint8Array);
      console.log(
        '🔄 EPG: Trying to parse as plain text, size:',
        plainText.length
      );
      console.log('🔄 EPG: Plain text sample:', plainText.substring(0, 500));
      return parseXmltvData(plainText);
    }
  } catch (error) {
    console.error('Error fetching EPG:', error);
    throw error;
  }
}

export function parseXmltvData(xmlData: string): EpgData {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlData, 'text/xml');

  if (doc.documentElement.nodeName === 'parsererror') {
    throw new Error('Failed to parse EPG XML data');
  }

  const channels = new Map<string, EpgChannel>();
  const programs: EpgProgram[] = [];

  // Parse channels
  const channelElements = doc.querySelectorAll('channel');
  console.log(`Found ${channelElements.length} channels in EPG`);

  channelElements.forEach((channelEl) => {
    const id = channelEl.getAttribute('id');
    if (!id) return;

    const displayNameEl = channelEl.querySelector('display-name');
    const iconEl = channelEl.querySelector('icon');

    const channel: EpgChannel = {
      id,
      displayName: displayNameEl?.textContent || id,
      icon: iconEl?.getAttribute('src') || undefined,
      programs: [],
    };

    channels.set(id, channel);
  });

  // Log some example channel IDs for debugging
  const channelIds = Array.from(channels.keys()).slice(0, 20);
  console.log('📺 EPG CHANNELS: Sample channel IDs from EPG:', channelIds);

  // Also log channel display names to help with matching
  const channelNames = Array.from(channels.values())
    .slice(0, 20)
    .map((c) => c.displayName);
  console.log('📺 EPG CHANNELS: Sample channel names from EPG:', channelNames);

  // Parse programmes
  const programmeElements = doc.querySelectorAll('programme');
  console.log(`Found ${programmeElements.length} programmes in EPG`);

  let validPrograms = 0;
  let programIndex = 0;
  programmeElements.forEach((progEl) => {
    const channelId = progEl.getAttribute('channel');
    const startStr = progEl.getAttribute('start');
    const stopStr = progEl.getAttribute('stop');

    if (!channelId || !startStr || !stopStr) return;

    const titleEl = progEl.querySelector('title');
    const descEl = progEl.querySelector('desc');
    const categoryEl = progEl.querySelector('category');
    const iconEl = progEl.querySelector('icon');
    const ratingEl = progEl.querySelector('rating > value');
    const episodeEl = progEl.querySelector('episode-num[system="xmltv_ns"]');

    const program: EpgProgram = {
      id: `${channelId}-${startStr}-${programIndex}`,
      channelId,
      title: titleEl?.textContent || 'Unknown Program',
      description: descEl?.textContent || undefined,
      category: categoryEl?.textContent || undefined,
      start: parseXmltvTime(startStr),
      stop: parseXmltvTime(stopStr),
      icon: iconEl?.getAttribute('src') || undefined,
      rating: ratingEl?.textContent || undefined,
    };

    // Parse episode information
    if (episodeEl) {
      const episodeStr = episodeEl.textContent;
      if (episodeStr) {
        const parts = episodeStr.split('.');
        if (parts.length >= 2) {
          const season = parseInt(parts[0]) + 1; // XMLTV uses 0-based
          const episode = parseInt(parts[1]) + 1;
          program.episode = { season, episode };
        }
      }
    }

    programs.push(program);
    validPrograms++;
    programIndex++;

    // Add to channel
    const channel = channels.get(channelId);
    if (channel) {
      channel.programs.push(program);
    }
  });

  console.log(`Successfully parsed ${validPrograms} valid programs`);

  // Sort programs by start time for each channel
  channels.forEach((channel) => {
    channel.programs.sort((a, b) => a.start.getTime() - b.start.getTime());
  });

  // Log some example programs for today
  const today = new Date();
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const todayPrograms = programs.filter(
    (p) => p.start >= todayStart && p.start < todayEnd
  );
  console.log(`Found ${todayPrograms.length} programs for today`);

  if (todayPrograms.length > 0) {
    console.log(
      'Sample today programs:',
      todayPrograms.slice(0, 3).map((p) => ({
        channel: p.channelId,
        title: p.title,
        start: p.start.toISOString(),
      }))
    );
  }

  return {
    channels,
    programs: programs.sort((a, b) => a.start.getTime() - b.start.getTime()),
    generatedAt: new Date(),
  };
}

function parseXmltvTime(timeStr: string): Date {
  // XMLTV time format: YYYYMMDDHHmmss +ZZZZ
  // Example: 20231215120000 +0100
  const match = timeStr.match(/(\d{14})\s*([\+\-]\d{4})?/);
  if (!match) return new Date();

  const [, dateTime, timezone] = match;
  const year = parseInt(dateTime.substring(0, 4));
  const month = parseInt(dateTime.substring(4, 6)) - 1; // JS months are 0-based
  const day = parseInt(dateTime.substring(6, 8));
  const hour = parseInt(dateTime.substring(8, 10));
  const minute = parseInt(dateTime.substring(10, 12));
  const second = parseInt(dateTime.substring(12, 14));

  // Create date in UTC first
  const date = new Date(Date.UTC(year, month, day, hour, minute, second));

  // Handle timezone offset if present
  if (timezone) {
    const sign = timezone[0] === '+' ? 1 : -1;
    const offsetHours = parseInt(timezone.substring(1, 3));
    const offsetMinutes = parseInt(timezone.substring(3, 5));
    const offsetMs = sign * (offsetHours * 60 + offsetMinutes) * 60 * 1000;

    // Convert from source timezone to UTC
    date.setTime(date.getTime() - offsetMs);
  } else {
    // If no timezone specified, assume it's in Polish timezone (CET/CEST)
    // CET = UTC+1, CEST = UTC+2 (during DST)
    const now = new Date();
    const isWinter = now.getMonth() < 2 || now.getMonth() > 9; // Rough DST check
    const polishOffset = isWinter ? 1 : 2; // CET=+1, CEST=+2
    date.setTime(date.getTime() - polishOffset * 60 * 60 * 1000);
  }

  console.log('🕐 TIME DEBUG:', {
    originalTime: timeStr,
    parsedUTC: date.toISOString(),
    parsedLocal: date.toString(),
    localTime: date.toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' }),
  });

  return date;
}
