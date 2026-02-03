/**
 * API module - Unified interface for both local and serverless modes
 * Automatically detects environment and uses appropriate backend
 */

import { getValidToken, isAuthenticated, startDeviceAuth, pollForToken, clearAuth, fetchUserInfo } from './auth';
import { search as tidalSearch, parseTidalUrl, getStreamInfo, getTrack, TidalTrack } from './tidal-client';
import { getSettings, saveSettings, TidalSettings } from './settings';
import { downloadTrack, DownloadProgress } from './downloader';

// Environment detection
const isServerless = process.env.NEXT_PUBLIC_SERVERLESS === 'true' || typeof window !== 'undefined' && !window.location.hostname.includes('localhost');
const PYTHON_API_BASE = "http://127.0.0.1:8000/api";
const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8787';

export const api = {
  /**
   * Check authentication status
   */
  checkStatus: async () => {
    // In serverless mode, check localStorage token
    if (isServerless || isAuthenticated()) {
      const token = await getValidToken();
      if (token) {
        const user = await fetchUserInfo();
        if (user) {
          return {
            logged_in: true,
            username: `${user.firstName} ${user.lastName}`.trim() || user.username,
            email: user.email,
          };
        }
      }
      return { logged_in: false, username: null, email: null };
    }

    // Try Python backend
    try {
      const res = await fetch(`${PYTHON_API_BASE}/status`);
      return res.json();
    } catch {
      return { logged_in: false, username: null, email: null };
    }
  },

  /**
   * Search for tracks, albums, playlists
   */
  search: async (query: string, type?: string) => {
    if (isServerless || isAuthenticated()) {
      const types = type ? [type.toUpperCase() + 'S'] : ['TRACKS', 'ALBUMS', 'PLAYLISTS'];
      return tidalSearch(query, types);
    }

    // Python backend
    const params = new URLSearchParams({ query });
    if (type) params.append("type", type);
    const res = await fetch(`${PYTHON_API_BASE}/search?${params.toString()}`);
    return res.json();
  },

  /**
   * Download media - triggers browser save dialog
   */
  download: async (
    data: { url?: string; media_id?: string; media_type?: string },
    onProgress?: (progress: DownloadProgress) => void
  ) => {
    let trackId: string | null = null;

    // Parse URL to get track ID
    if (data.url) {
      const parsed = parseTidalUrl(data.url);
      if (parsed && parsed.type === 'track') {
        trackId = parsed.id;
      } else if (parsed) {
        // For albums/playlists, we'd need to handle differently
        throw new Error(`${parsed.type} downloads not yet supported in serverless mode. Please use track URLs.`);
      }
    } else if (data.media_id && data.media_type?.toLowerCase() === 'track') {
      trackId = data.media_id;
    }

    if (!trackId) {
      throw new Error('Could not determine track ID from input');
    }

    // Use client-side downloader
    if (isServerless || isAuthenticated()) {
      await downloadTrack(trackId, onProgress);
      return { status: 'completed' };
    }

    // Fall back to Python backend
    const res = await fetch(`${PYTHON_API_BASE}/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  /**
   * Get settings from localStorage
   */
  getSettings: async (): Promise<TidalSettings> => {
    return getSettings();
  },

  /**
   * Save settings to localStorage
   */
  saveSettings: async (settings: Partial<TidalSettings>): Promise<TidalSettings> => {
    return saveSettings(settings);
  },

  /**
   * Start device login flow
   */
  startLogin: async () => {
    const auth = await startDeviceAuth();
    return {
      verification_uri: auth.verificationUri,
      verification_uri_complete: auth.verificationUriComplete,
      user_code: auth.userCode,
      device_code: auth.deviceCode,
      expires_in: auth.expiresIn,
      interval: auth.interval,
    };
  },

  /**
   * Poll for login completion
   */
  pollLogin: async (deviceCode: string) => {
    const token = await pollForToken(deviceCode);
    if (token) {
      return { success: true, token };
    }
    return { success: false, status: 'pending' };
  },

  /**
   * Logout
   */
  logout: async () => {
    clearAuth();

    // Also try Python backend for backward compatibility
    try {
      await fetch(`${PYTHON_API_BASE}/logout`, { method: "POST" });
    } catch {
      // Ignore errors
    }

    return { success: true };
  },

  /**
   * Check if running in serverless mode
   */
  isServerless: () => isServerless,
};
