/**
 * API module - Unified interface for both local and serverless modes
 * Automatically detects environment and uses appropriate backend
 */

import { getValidToken, isAuthenticated, startDeviceAuth, pollForToken, clearAuth, fetchUserInfo } from './auth';
import { search as tidalSearch, parseTidalUrl } from './tidal-client';
import { getSettings, saveSettings, TidalSettings } from './settings';
import { downloadTrack, downloadAlbum, downloadPlaylist, DownloadProgress } from '@/lib/downloader';

// Environment detection
const isServerless = process.env.NEXT_PUBLIC_SERVERLESS === 'true' || typeof window !== 'undefined' && !window.location.hostname.includes('localhost');
const PYTHON_API_BASE = "http://127.0.0.1:8000/api";

export const api = {
    /**
     * Check authentication status
     */
    checkStatus: async () => {
        // In serverless mode, check localStorage token
        if (isServerless || isAuthenticated()) {
            const token = await getValidToken();
            if (token) {
                // Token exists and is valid - user is logged in
                // Try to get user info, but don't fail if it doesn't work
                try {
                    const user = await fetchUserInfo();
                    if (user) {
                        return {
                            logged_in: true,
                            username: `${user.firstName} ${user.lastName}`.trim() || user.username,
                            email: user.email,
                        };
                    }
                } catch (e) {
                    console.warn('Could not fetch user info:', e);
                }
                // Token is valid but couldn't get user info - still logged in
                return { logged_in: true, username: 'Tidal User', email: null };
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
        onProgress?: (progress: DownloadProgress) => void,
        onLog?: (message: string) => void
    ) => {
        let trackId: string | null = null;
        let albumId: string | null = null;
        let playlistId: string | null = null;

        // Parse URL to get media type and ID
        if (data.url) {
            const parsed = parseTidalUrl(data.url);
            if (parsed) {
                if (parsed.type === 'track') {
                    trackId = parsed.id;
                } else if (parsed.type === 'album') {
                    albumId = parsed.id;
                } else if (parsed.type === 'playlist') {
                    playlistId = parsed.id;
                } else {
                    throw new Error(`${parsed.type} downloads not yet supported.`);
                }
            }
        } else if (data.media_id && data.media_type) {
            const type = data.media_type.toLowerCase();
            if (type === 'track') {
                trackId = data.media_id;
            } else if (type === 'album') {
                albumId = data.media_id;
            } else if (type === 'playlist') {
                playlistId = data.media_id;
            }
        }

        // Use client-side downloader
        if (isServerless || isAuthenticated()) {
            if (trackId) {
                const result = await downloadTrack(trackId, onProgress, onLog);
                return { status: 'completed', type: 'TRACK', data: result.track, isAtmos: result.isAtmos };
            } else if (albumId) {
                const result = await downloadAlbum(albumId, onProgress, onLog);
                return { status: 'completed', type: 'ALBUM', data: result.album, isAtmos: result.isAtmos };
            } else if (playlistId) {
                const result = await downloadPlaylist(playlistId, onProgress, onLog);
                return { status: 'completed', type: 'PLAYLIST', data: result.playlist, isAtmos: result.isAtmos };
            }
            throw new Error('Could not determine media type from input');
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
