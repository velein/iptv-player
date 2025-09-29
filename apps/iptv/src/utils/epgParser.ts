import type { EpgData, EpgChannel, EpgProgram } from '../types/epg';
import * as pako from 'pako';

export async function fetchAndParseEpg(url: string): Promise<EpgData> {
  try {
    const response = await fetch(url, {
      headers: {
        Accept:
          'application/xml, text/xml, application/gzip, application/octet-stream, */*',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();

    // Decompress gzip data
    const uint8Array = new Uint8Array(arrayBuffer);

    try {
      const decompressed = pako.ungzip(uint8Array, { to: 'string' });
      return await parseXmltvData(decompressed);
    } catch (decompError) {
      // Try to parse as plain text in case it's not compressed
      const textDecoder = new TextDecoder('utf-8');
      const plainText = textDecoder.decode(uint8Array);
      return await parseXmltvData(plainText);
    }
  } catch (error) {
    console.error('Error fetching EPG:', error);
    throw error;
  }
}

// Helper function for chunked processing to avoid blocking UI
function processInChunks<T>(
  items: T[],
  chunkSize: number,
  processItem: (item: T, index: number) => void,
  onProgress?: (processed: number, total: number) => void
): Promise<void> {
  return new Promise((resolve) => {
    let index = 0;

    function processChunk() {
      const endIndex = Math.min(index + chunkSize, items.length);

      for (let i = index; i < endIndex; i++) {
        processItem(items[i], i);
      }

      index = endIndex;

      if (onProgress) {
        onProgress(index, items.length);
      }

      if (index < items.length) {
        // Use setTimeout to yield control back to the UI thread
        setTimeout(processChunk, 0);
      } else {
        resolve();
      }
    }

    processChunk();
  });
}

export async function parseXmltvData(xmlData: string): Promise<EpgData> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlData, 'text/xml');

  if (doc.documentElement.nodeName === 'parsererror') {
    throw new Error('Failed to parse EPG XML data');
  }

  const channels = new Map<string, EpgChannel>();
  const programs: EpgProgram[] = [];

  // Parse channels (fast, usually < 1000 items)
  const channelElements = Array.from(doc.querySelectorAll('channel'));

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
  const channelIds = Array.from(channels.keys()).slice(0, 10);

  // Parse programmes in chunks to avoid blocking UI
  const programmeElements = Array.from(doc.querySelectorAll('programme'));
  console.log(
    `🔄 EPG: Found ${programmeElements.length} programmes in EPG - processing in chunks...`
  );

  let validPrograms = 0;
  let programIndex = 0;

  // Process programmes in chunks to avoid blocking UI
  await processInChunks(
    programmeElements,
    500, // Process 500 programs at a time
    (progEl, index) => {
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
    },
    (processed, total) => {
      // Log progress every 2000 items
      if (processed % 2000 === 0 || processed === total) {
        console.log(
          `🔄 EPG: Processed ${processed}/${total} programmes (${Math.round(
            (processed / total) * 100
          )}%)`
        );
      }
    }
  );

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

  return date;
}
