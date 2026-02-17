/**
 * Tidal API client for browser
 * Uses Cloudflare Worker as CORS proxy
 */

import { getValidToken } from './auth';
import { getSettings } from './settings';

// Get Worker URL from environment
export function getWorkerUrl(): string {
    return process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8787';
}

export interface TidalTrack {
    id: number;
    title: string;
    duration: number;
    trackNumber: number;
    volumeNumber: number;
    explicit: boolean;
    audioQuality: string;
    audioModes?: string[]; // e.g. ['STEREO', 'DOLBY_ATMOS']
    version?: string;
    isrc?: string;
    copyright?: string;
    replayGain?: number;
    peak?: number;
    albumReplayGain?: number;
    albumPeak?: number;
    artist: {
        id: number;
        name: string;
    };
    artists: Array<{ id: number; name: string }>;
    album: {
        id: number;
        title: string;
        cover: string;
    };
}

export interface TidalAlbum {
    id: number;
    title: string;
    duration: number;
    numberOfTracks: number;
    numberOfVolumes: number;
    explicit: boolean;
    audioQuality: string;
    releaseDate: string;
    upc?: string;
    copyright?: string;
    artist: {
        id: number;
        name: string;
    };
    artists: Array<{ id: number; name: string }>;
    cover: string;
}

export interface TidalPlaylist {
    uuid: string;
    title: string;
    numberOfTracks: number;
    duration: number;
    image: string;
    squareImage: string;
    created: string;
    lastUpdated: string;
}

export interface SearchResults {
    tracks?: TidalTrack[];
    albums?: TidalAlbum[];
    playlists?: TidalPlaylist[];
}

export interface StreamInfo {
    trackId: number;
    audioQuality: string;
    manifest: string;
    manifestMimeType: string;
    // Decoded manifest will contain actual URL
    streamUrl?: string;
    streamUrls?: string[];
    // ReplayGain values from stream endpoint
    albumReplayGain?: number;
    albumPeakAmplitude?: number;
    trackReplayGain?: number;
    trackPeakAmplitude?: number;
}

/**
 * Get cover art URL from cover ID
 */
export function getCoverUrl(coverId: string, size: number = 640): string {
    if (!coverId) return '';
    const formattedId = coverId.replace(/-/g, '/');
    return `https://resources.tidal.com/images/${formattedId}/${size}x${size}.jpg`;
}

/**
 * Fetch with authentication
 */
async function fetchWithAuth(path: string, options: RequestInit = {}): Promise<Response> {
    const token = await getValidToken();
    const workerUrl = getWorkerUrl();

    if (!token) {
        throw new Error('Not authenticated');
    }

    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${token}`);

    return fetch(`${workerUrl}${path}`, {
        ...options,
        headers,
    });
}

/**
 * Search Tidal for tracks, albums, playlists
 */
export async function search(query: string, types: string[] = ['TRACKS', 'ALBUMS', 'PLAYLISTS'], limit: number = 10): Promise<SearchResults> {
    const params = new URLSearchParams({
        query,
        limit: limit.toString(),
        types: types.join(','),
        countryCode: 'US', // TODO: Get from user settings
    });

    const response = await fetchWithAuth(`/api/search?${params}`);

    if (!response.ok) {
        throw new Error('Search failed');
    }

    const data = await response.json();

    return {
        tracks: data.tracks?.items,
        albums: data.albums?.items,
        playlists: data.playlists?.items,
    };
}

/**
 * Get track info by ID
 */
export async function getTrack(trackId: string | number): Promise<TidalTrack> {
    const response = await fetchWithAuth(`/api/tracks/${trackId}?countryCode=US`);

    if (!response.ok) {
        throw new Error('Failed to get track');
    }

    return response.json();
}

/**
 * Get playlist info by ID
 */
export async function getPlaylist(playlistId: string): Promise<TidalPlaylist> {
    const response = await fetchWithAuth(`/api/playlists/${playlistId}?countryCode=US`);

    if (!response.ok) {
        throw new Error('Failed to get playlist');
    }

    return response.json();
}

/**
 * Get album info by ID
 */
export async function getAlbum(albumId: string | number): Promise<TidalAlbum> {
    const response = await fetchWithAuth(`/api/albums/${albumId}?countryCode=US`);

    if (!response.ok) {
        throw new Error('Failed to get album');
    }

    return response.json();
}

/**
 * Get album tracks
 */
export async function getAlbumTracks(albumId: string | number): Promise<TidalTrack[]> {
    const response = await fetchWithAuth(`/api/albums/${albumId}/tracks?countryCode=US&limit=100`);

    if (!response.ok) {
        throw new Error('Failed to get album tracks');
    }

    const data = await response.json();
    return data.items;
}

/**
 * Get playlist tracks
 */
export async function getPlaylistTracks(playlistId: string): Promise<TidalTrack[]> {
    const response = await fetchWithAuth(`/api/playlists/${playlistId}/tracks?countryCode=US&limit=100`);

    if (!response.ok) {
        throw new Error('Failed to get playlist tracks');
    }

    const data = await response.json();

    // Handle different response structures
    let items = data.items;
    if (!items && data.tracks?.items) {
        items = data.tracks.items;
    }

    if (!items || !Array.isArray(items)) {
        console.error('Unexpected playlist response structure:', data);
        return [];
    }

    // Map items - handle both direct track objects and nested {item: track} structure
    const tracks = items
        .map((item: TidalTrack | { item?: TidalTrack }) => {
            if ('item' in item && item.item) {
                return item.item;
            }
            // Direct track object
            if ('id' in item && 'title' in item) {
                return item as TidalTrack;
            }
            return undefined;
        })
        .filter((track: TidalTrack | undefined): track is TidalTrack => track !== undefined && track !== null);

    return tracks;
}

/**
 * Get stream URL for a track
 */
export async function getStreamInfo(trackId: string | number): Promise<StreamInfo> {
    const settings = getSettings();
    const quality = settings.quality_audio;
    const workerUrl = getWorkerUrl();
    const token = await getValidToken();

    if (!token) {
        throw new Error('Not authenticated');
    }

    const response = await fetch(`${workerUrl}/stream?trackId=${trackId}&quality=${quality}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        throw new Error('Failed to get stream URL');
    }

    const data = await response.json();

    // Decode manifest to get actual stream URL
    let streamUrl = '';
    let streamUrls: string[] = [];
    if (data.manifestMimeType === 'application/vnd.tidal.bts') {
        // BTS manifest - base64 encoded JSON
        try {
            const manifestJson = JSON.parse(atob(data.manifest));
            streamUrl = (manifestJson.urls?.[0] || '').replace('http://', 'https://');
        } catch (e) {
            console.error('Failed to decode BTS manifest:', e);
        }
    } else if (data.manifestMimeType === 'application/dash+xml') {
        // DASH manifest - base64 encoded MPD XML (used for Hi-Res)
        try {
            const mpdXml = atob(data.manifest);

            // Parse the MPD XML to extract the media URL
            // The URL is typically in a <BaseURL> element or as a template
            const parser = new DOMParser();
            const doc = parser.parseFromString(mpdXml, 'text/xml');

            // Try to find BaseURL first (most common for Hi-Res FLAC)
            const baseUrlElement = doc.querySelector('BaseURL');
            if (baseUrlElement?.textContent) {
                streamUrl = baseUrlElement.textContent.replace('http://', 'https://');
            } else {
                // Fallback: Try to find SegmentTemplate with media attribute
                const segmentTemplate = doc.querySelector('SegmentTemplate');
                const initialization = segmentTemplate?.getAttribute('initialization');
                const media = segmentTemplate?.getAttribute('media');

                // Check if media URL has $Number$ placeholder - this means it's a segmented stream
                if (media && media.includes('$Number$') && segmentTemplate) {
                    // Calculate number of segments from SegmentTimeline
                    const S_elements = segmentTemplate.querySelectorAll('SegmentTimeline S');

                    // CLI logic: segments_count = 1 + 1 (min), then add repeats
                    let totalCount = 2; // Init + First media
                    S_elements.forEach(S => {
                        const r = parseInt(S.getAttribute('r') || '0', 10);
                        if (r > 0) totalCount += r;
                    });

                    // Generate URLs by replacing $Number$ with actual segment numbers
                    const urls: string[] = [];
                    for (let i = 0; i < totalCount; i++) {
                        urls.push(media.replace('$Number$', i.toString()).replace('http://', 'https://'));
                    }

                    if (urls.length > 0) {
                        streamUrls = urls;
                        streamUrl = urls[0]; // Set first as primary for back-compat
                    }
                } else if (media) {
                    // Non-segmented media URL (no $Number$ placeholder)
                    streamUrl = media.replace('http://', 'https://');
                } else if (initialization) {
                    // Some streams might only have initialization URL
                    streamUrl = initialization.replace('http://', 'https://');
                }

                // Also check Representation with BaseURL as final fallback
                if (!streamUrl && !streamUrls?.length) {
                    const representation = doc.querySelector('Representation BaseURL');
                    if (representation?.textContent) {
                        streamUrl = representation.textContent.replace('http://', 'https://');
                    }
                }
            }

            if (!streamUrl && !streamUrls?.length) {
                console.error('Could not extract URL from DASH manifest. MPD content:', mpdXml.substring(0, 500));
            }
        } catch (e) {
            console.error('Failed to decode DASH manifest:', e);
        }
    } else {
        console.warn('Unknown manifest type:', data.manifestMimeType);
    }

    return {
        trackId: data.trackId,
        audioQuality: data.audioQuality,
        manifest: data.manifest,
        manifestMimeType: data.manifestMimeType,
        streamUrl,
        streamUrls,
        // ReplayGain values from stream response
        albumReplayGain: data.albumReplayGain,
        albumPeakAmplitude: data.albumPeakAmplitude,
        trackReplayGain: data.trackReplayGain,
        trackPeakAmplitude: data.trackPeakAmplitude,
    };
}

/**
 * Get Dolby Atmos stream info for a track
 * Uses the Atmos-specific access token obtained via token swap.
 * The Atmos client credentials are required to get E-AC-3 JOC streams.
 */
export async function getStreamInfoAtmos(trackId: string | number): Promise<StreamInfo> {
    const { getValidAtmosToken } = await import('./auth');

    const workerUrl = getWorkerUrl();
    const token = await getValidAtmosToken();

    if (!token) {
        throw new Error('Atmos token not available - enable Dolby Atmos in settings to authenticate');
    }

    const response = await fetch(`${workerUrl}/stream-atmos?trackId=${trackId}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to get Atmos stream URL');
    }

    const data = await response.json();

    // Decode manifest to get actual stream URL
    // Atmos streams use BTS manifest format
    let streamUrl = '';
    const streamUrls: string[] = [];
    if (data.manifestMimeType === 'application/vnd.tidal.bts') {
        try {
            const manifestJson = JSON.parse(atob(data.manifest));
            streamUrl = (manifestJson.urls?.[0] || '').replace('http://', 'https://');
        } catch (e) {
            console.error('Failed to decode Atmos BTS manifest:', e);
        }
    } else {
        console.warn('Unexpected Atmos manifest type:', data.manifestMimeType);
    }

    return {
        trackId: data.trackId,
        audioQuality: data.audioQuality,
        manifest: data.manifest,
        manifestMimeType: data.manifestMimeType,
        streamUrl,
        streamUrls,
        // ReplayGain values from stream response
        albumReplayGain: data.albumReplayGain,
        albumPeakAmplitude: data.albumPeakAmplitude,
        trackReplayGain: data.trackReplayGain,
        trackPeakAmplitude: data.trackPeakAmplitude,
    };
}

/**
 * Parse a Tidal URL and extract media type and ID
 */
export function parseTidalUrl(url: string): { type: string; id: string } | null {
    const patterns = [
        { regex: /tidal\.com\/(?:browse\/)?track\/(\d+)/i, type: 'track' },
        { regex: /tidal\.com\/(?:browse\/)?album\/(\d+)/i, type: 'album' },
        { regex: /tidal\.com\/(?:browse\/)?playlist\/([a-f0-9-]+)/i, type: 'playlist' },
        { regex: /tidal\.com\/(?:browse\/)?video\/(\d+)/i, type: 'video' },
        { regex: /tidal\.com\/(?:browse\/)?artist\/(\d+)/i, type: 'artist' },
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern.regex);
        if (match) {
            return { type: pattern.type, id: match[1] };
        }
    }

    return null;
}

/**
 * Get lyrics for a track
 */
export async function getLyrics(trackId: string | number): Promise<string | null> {
    try {
        const response = await fetchWithAuth(`/api/tracks/${trackId}/lyrics?countryCode=US`);

        if (!response.ok) {

            return null;
        }

        const data = await response.json();

        // Tidal returns lyrics in 'subtitles' for synced lyrics (LRC format) or 'lyrics' for plain text
        const lyrics = data.subtitles || data.lyrics || null;
        if (lyrics) {

        }
        return lyrics;
    } catch (e) {
        console.warn('Failed to fetch lyrics:', e);
        return null;
    }
}
