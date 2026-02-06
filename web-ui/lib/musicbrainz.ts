/**
 * MusicBrainz API client for genre lookup via ISRC
 * API Documentation: https://musicbrainz.org/doc/MusicBrainz_API
 */

const MUSICBRAINZ_API_URL = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'tidal-dl-ng/1.0.0 (https://github.com/jsildura/tidal-dl-ng)';

// Simple in-memory cache to avoid duplicate lookups
const genreCache = new Map<string, string[]>();

export interface MusicBrainzRecording {
    id: string;
    title: string;
    genres?: Array<{
        id: string;
        name: string;
        count: number;
    }>;
}

export interface MusicBrainzISRCResponse {
    recordings?: MusicBrainzRecording[];
}

/**
 * Fetch genre(s) from MusicBrainz using ISRC
 * Uses two-step lookup: ISRC → recording MBID → recording with genres
 * @param isrc - International Standard Recording Code
 * @returns Array of genre names, or empty array if not found
 */
export async function getGenresByISRC(isrc: string): Promise<string[]> {
    if (!isrc) {
        return [];
    }

    // Check cache first
    const cached = genreCache.get(isrc);
    if (cached !== undefined) {
        return cached;
    }

    try {
        // Step 1: Get recording MBID from ISRC
        const isrcUrl = `${MUSICBRAINZ_API_URL}/isrc/${encodeURIComponent(isrc)}?fmt=json`;

        const controller1 = new AbortController();
        const timeoutId1 = setTimeout(() => controller1.abort(), 5000);

        const isrcResponse = await fetch(isrcUrl, {
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'application/json',
            },
            signal: controller1.signal,
        });

        clearTimeout(timeoutId1);

        if (!isrcResponse.ok) {
            console.warn(`MusicBrainz ISRC lookup failed: ${isrcResponse.status}`);
            genreCache.set(isrc, []);
            return [];
        }

        const isrcData = await isrcResponse.json();

        // Get the first recording's MBID
        if (!isrcData.recordings || isrcData.recordings.length === 0) {
            genreCache.set(isrc, []);
            return [];
        }

        const recordingMbid = isrcData.recordings[0].id;

        // Step 2: Get recording with genres
        const recordingUrl = `${MUSICBRAINZ_API_URL}/recording/${recordingMbid}?inc=genres&fmt=json`;

        const controller2 = new AbortController();
        const timeoutId2 = setTimeout(() => controller2.abort(), 5000);

        const recordingResponse = await fetch(recordingUrl, {
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'application/json',
            },
            signal: controller2.signal,
        });

        clearTimeout(timeoutId2);

        if (!recordingResponse.ok) {
            console.warn(`MusicBrainz recording lookup failed: ${recordingResponse.status}`);
            genreCache.set(isrc, []);
            return [];
        }

        const recordingData: MusicBrainzRecording = await recordingResponse.json();

        // Extract genres
        const genres: string[] = [];
        if (recordingData.genres && recordingData.genres.length > 0) {
            const sortedGenres = recordingData.genres
                .sort((a, b) => b.count - a.count)
                .map(g => g.name);
            genres.push(...sortedGenres);
        }

        // Cache the result
        genreCache.set(isrc, genres);

        return genres;
    } catch (error) {
        console.warn('MusicBrainz lookup failed:', error);
        genreCache.set(isrc, []);
        return [];
    }
}

/**
 * Clear the genre cache (useful for testing)
 */
export function clearGenreCache(): void {
    genreCache.clear();
}

