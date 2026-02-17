/**
 * Settings utility module for browser localStorage
 * Used for serverless deployment where no backend storage is available
 */

export interface TidalSettings {
    quality_audio: 'LOW' | 'HIGH' | 'LOSSLESS' | 'HI_RES_LOSSLESS';
    quality_video: '360' | '480' | '720' | '1080';
    skip_existing: boolean;
    lyrics_embed: boolean;
    lyrics_file: boolean;
    video_download: boolean;
    download_delay: boolean;
    download_dolby_atmos: boolean;
    format_album: string;
    format_playlist: string;
    format_mix: string;
    format_track: string;
    format_video: string;
    metadata_cover_dimension: string;
    metadata_cover_embed: boolean;
    metadata_genre_lookup: boolean;
    metadata_artist_separator: '; ' | ', ' | ' / ' | ' & ';
    multi_thread_download: boolean;
    playlist_details_mode: boolean;
}

export const DEFAULT_SETTINGS: TidalSettings = {
    quality_audio: 'LOSSLESS',
    quality_video: '1080',
    skip_existing: true,
    lyrics_embed: true,
    lyrics_file: false,
    video_download: true,
    download_delay: false,
    download_dolby_atmos: false,
    format_album: 'Albums/{album_artist} - {album_title}/{track_volume_num_optional}{album_track_num}. {artist_name} - {track_title}',
    format_playlist: 'Playlists/{playlist_name}/{list_pos}. {artist_name} - {track_title}',
    format_mix: 'Mix/{mix_name}/{artist_name} - {track_title}',
    format_track: 'Tracks/{artist_name} - {track_title}',
    format_video: 'Videos/{artist_name} - {track_title}',
    metadata_cover_dimension: '1280',
    metadata_cover_embed: true,
    metadata_genre_lookup: true,
    metadata_artist_separator: '; ',
    multi_thread_download: false,
    playlist_details_mode: false,
};

const STORAGE_KEY = 'tidal-dl-ng-settings';

/**
 * Get settings from localStorage, with defaults for missing values
 */
export function getSettings(): TidalSettings {
    if (typeof window === 'undefined') {
        return DEFAULT_SETTINGS;
    }

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            // Merge with defaults to ensure all keys exist
            return { ...DEFAULT_SETTINGS, ...parsed };
        }
    } catch (error) {
        console.error('Failed to load settings from localStorage:', error);
    }

    return DEFAULT_SETTINGS;
}

/**
 * Save settings to localStorage
 */
export function saveSettings(settings: Partial<TidalSettings>): TidalSettings {
    if (typeof window === 'undefined') {
        return { ...DEFAULT_SETTINGS, ...settings };
    }

    try {
        const current = getSettings();
        const updated = { ...current, ...settings };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return updated;
    } catch (error) {
        console.error('Failed to save settings to localStorage:', error);
        throw error;
    }
}

/**
 * Clear all settings from localStorage
 */
export function clearSettings(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
}