import { useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { usePlaylist } from '../hooks/usePlaylist';

export default function PlaylistSelector() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const {
    hasPlaylist,
    loadPlaylistFromFile,
    loadPlaylistFromUrl,
    clearPlaylist,
  } = usePlaylist();
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // More permissive validation - allow the file and let the parser handle validation
    const fileName = file.name.toLowerCase();
    console.log('🔍 File selected:', {
      name: file.name,
      type: file.type,
      size: file.size,
    });

    try {
      await loadPlaylistFromFile(file);
      navigate({ to: '/channels' });
    } catch (error) {
      console.error('Error loading playlist:', error);
      alert('Error loading playlist file');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSelectFile = () => {
    fileInputRef.current?.click();
  };

  const handleClearPlaylist = () => {
    clearPlaylist();
    alert('Playlist cleared');
  };

  const handleUrlLoad = async () => {
    if (!urlInput.trim()) {
      alert('Please enter a playlist URL');
      return;
    }

    setLoading(true);
    try {
      await loadPlaylistFromUrl(urlInput.trim());
      navigate({ to: '/channels' });
    } catch (error) {
      console.error('Error loading playlist from URL:', error);
      alert('Error loading playlist from URL');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-xl font-semibold mb-4">Load M3U Playlist</h3>

        {hasPlaylist ? (
          <div className="space-y-4">
            <div className="text-green-400 text-sm">
              ✓ Playlist loaded successfully
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => navigate({ to: '/channels' })}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors"
              >
                View Channels
              </button>
              <button
                onClick={handleSelectFile}
                className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded transition-colors"
              >
                Load New
              </button>
              <button
                onClick={handleClearPlaylist}
                className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-300 text-sm">
              Select an M3U playlist file from your computer or load from URL.
            </p>
            <p className="text-gray-400 text-xs">
              Supports .m3u, .m3u8 files and plain text files containing
              playlist data.
              <br />
              Having trouble in Firefox? Try selecting "All Files" in the file
              picker.
            </p>

            <button
              onClick={handleSelectFile}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded transition-colors"
              disabled={loading}
            >
              Select M3U File
            </button>

            <div className="border-t border-gray-600 pt-4">
              <p className="text-gray-300 text-sm mb-2">Or load from URL:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="Enter M3U playlist URL..."
                  className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
                <button
                  onClick={handleUrlLoad}
                  className="bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2 rounded transition-colors"
                  disabled={loading || !urlInput.trim()}
                >
                  {loading ? 'Loading...' : 'Load'}
                </button>
              </div>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    </div>
  );
}
