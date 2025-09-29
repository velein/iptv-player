import { useState } from 'react';

interface HttpsWarningProps {
  streamUrl: string;
}

export default function HttpsWarning({ streamUrl }: HttpsWarningProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Only show for HTTP streams on HTTPS sites
  const isHttps =
    typeof window !== 'undefined' && window.location.protocol === 'https:';
  const isHttpStream = streamUrl.startsWith('http://');

  if (!isHttps || !isHttpStream) {
    return null;
  }

  return (
    <div className="bg-orange-900 border border-orange-700 rounded-lg p-4 mb-4">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <span className="text-orange-400 text-xl">⚠️</span>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-orange-200 font-medium">
            HTTPS Compatibility Issue
          </h3>
          <p className="text-orange-300 text-sm mt-1">
            This stream uses HTTP and cannot be loaded on HTTPS sites due to
            browser security policies.
          </p>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-orange-400 text-sm underline mt-2 hover:text-orange-300"
          >
            {isExpanded ? 'Hide details' : 'Show solutions'}
          </button>

          {isExpanded && (
            <div className="mt-3 space-y-2 text-sm text-orange-200">
              <p className="font-medium">Possible solutions:</p>
              <ul className="space-y-1 ml-4">
                <li>
                  • <strong>Quick Fix:</strong> Enable "HTTPS proxy" in Settings
                  → Stream Proxy Settings
                </li>
                <li>
                  • <strong>Best:</strong> Use HTTPS streams instead of HTTP
                </li>
                <li>
                  • <strong>Alternative:</strong> Access the site via HTTP (not
                  HTTPS)
                </li>
                <li>
                  • <strong>Technical:</strong> Set up a reverse proxy with
                  HTTPS
                </li>
              </ul>

              <div className="mt-3 p-3 bg-orange-800 rounded text-xs">
                <p className="font-medium mb-1">For Stream Providers:</p>
                <p>
                  Consider offering HTTPS endpoints for better compatibility
                  with modern web deployments.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
