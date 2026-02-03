/**
 * Download module with ffmpeg.wasm for client-side audio processing
 * Handles streaming downloads and metadata embedding
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import JSZip from 'jszip';
import { getStreamInfo, getTrack, getAlbum, getPlaylist, getAlbumTracks, getPlaylistTracks, getCoverUrl, getLyrics, TidalTrack, TidalAlbum, TidalPlaylist } from './tidal-client';
import { getSettings } from './settings';



// FFmpeg instance (lazy loaded)
let ffmpeg: FFmpeg | null = null;
let ffmpegLoaded = false;

export interface DownloadProgress {
    stage: 'fetching' | 'processing' | 'complete' | 'error';
    progress: number; // 0-100
    message: string;
    currentTrack?: number;
    totalTracks?: number;
    trackName?: string;
}

export type ProgressCallback = (progress: DownloadProgress) => void;

/**
 * Load FFmpeg WASM (lazy initialization)
 */
async function loadFFmpeg(onProgress?: ProgressCallback): Promise<FFmpeg> {
    if (ffmpeg && ffmpegLoaded) {
        return ffmpeg;
    }

    onProgress?.({ stage: 'processing', progress: 0, message: 'Loading audio processor...' });

    ffmpeg = new FFmpeg();

    // Use direct URLs instead of blob URLs to avoid Next.js module resolution issues
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';

    try {
        await ffmpeg.load({
            coreURL: `${baseURL}/ffmpeg-core.js`,
            wasmURL: `${baseURL}/ffmpeg-core.wasm`,
        });

        ffmpegLoaded = true;
        return ffmpeg;
    } catch (error) {
        console.error('Failed to load FFmpeg:', error);
        throw new Error('Failed to load audio processor. Please ensure you have a stable internet connection.');
    }
}

/**
 * Download a file from URL with progress tracking
 */
async function downloadWithProgress(
    url: string,
    onProgress?: ProgressCallback
): Promise<ArrayBuffer> {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
    }

    const contentLength = response.headers.get('Content-Length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;

    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error('Failed to get response reader');
    }

    const chunks: Uint8Array[] = [];
    let received = 0;

    while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        chunks.push(value);
        received += value.length;

        if (total > 0) {
            const progress = Math.round((received / total) * 100);
            onProgress?.({ stage: 'fetching', progress, message: `Downloading... ${progress}%` });
        }
    }

    // Combine chunks
    const combined = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
    }

    return combined.buffer;
}

/**
 * Format track metadata for filename
 */
function formatFilename(track: TidalTrack): string {
    const artist = track.artist?.name || 'Unknown Artist';
    const title = track.title || 'Unknown Track';

    // Sanitize filename
    const sanitize = (str: string) => str
        .replace(/[<>:"/\\|?*]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    return `${sanitize(artist)} - ${sanitize(title)}`;
}

/**
 * Embed metadata into audio file using FFmpeg
 */
async function embedMetadata(
    ffmpegInstance: FFmpeg,
    audioData: Uint8Array,
    track: TidalTrack,
    coverData: Uint8Array | null,
    lyrics: string | null,
    inputFormat: string,
    onProgress?: ProgressCallback
): Promise<Uint8Array> {
    const settings = getSettings();

    onProgress?.({ stage: 'processing', progress: 50, message: 'Embedding metadata...' });

    const inputFile = `input.${inputFormat}`;
    const outputFile = inputFormat === 'flac' ? 'output.flac' : 'output.m4a';

    // Write input file
    await ffmpegInstance.writeFile(inputFile, audioData);

    // Prepare metadata arguments
    const metadataArgs: string[] = [];

    if (track.title) {
        metadataArgs.push('-metadata', `title=${track.title}`);
    }
    if (track.artist?.name) {
        metadataArgs.push('-metadata', `artist=${track.artist.name}`);
    }
    if (track.album?.title) {
        metadataArgs.push('-metadata', `album=${track.album.title}`);
    }
    if (track.trackNumber) {
        metadataArgs.push('-metadata', `track=${track.trackNumber}`);
    }
    if (track.explicit) {
        metadataArgs.push('-metadata', `explicit=1`);
    }

    // Build FFmpeg command
    const ffmpegArgs = ['-i', inputFile];

    // Add cover art if available and enabled
    let hasCoverArt = false;
    if (coverData && settings.metadata_cover_embed) {
        await ffmpegInstance.writeFile('cover.jpg', coverData);
        ffmpegArgs.push('-i', 'cover.jpg');
        ffmpegArgs.push('-map', '0:a', '-map', '1:0');
        hasCoverArt = true;

        if (inputFormat === 'flac') {
            ffmpegArgs.push('-disposition:v', 'attached_pic');
        } else {
            // Use copy codec for M4A/AAC to avoid mjpeg transcoding hangs in WASM
            ffmpegArgs.push('-c:v', 'copy');
            ffmpegArgs.push('-disposition:v:0', 'attached_pic');
        }
    }

    // Add lyrics if available and enabled (must be added to metadataArgs BEFORE spreading)
    if (lyrics && settings.lyrics_embed) {
        // Use LYRICS tag for synced/LRC format lyrics, and lyrics-XXX for plain text
        // Escape special characters for FFmpeg metadata
        // Note: We do NOT escape newlines (\n) because we want actual line breaks, 
        // not literal "\n" characters in the output.
        const escapedLyrics = lyrics.replace(/\\/g, '\\\\').replace(/=/g, '\\=').replace(/;/g, '\\;');
        metadataArgs.push('-metadata', `LYRICS=${escapedLyrics}`);
        // Also add as unsyncedlyrics for compatibility with more players
        metadataArgs.push('-metadata', `UNSYNCEDLYRICS=${escapedLyrics}`);
    }

    // Add metadata
    ffmpegArgs.push(...metadataArgs);

    // Copy audio codec (no re-encoding)
    ffmpegArgs.push('-c:a', 'copy');
    ffmpegArgs.push(outputFile);

    // Execute FFmpeg
    await ffmpegInstance.exec(ffmpegArgs);

    onProgress?.({ stage: 'processing', progress: 90, message: 'Finalizing...' });

    // Read output file
    const data = await ffmpegInstance.readFile(outputFile);

    // Cleanup
    await ffmpegInstance.deleteFile(inputFile);
    await ffmpegInstance.deleteFile(outputFile);
    if (hasCoverArt) {
        try {
            await ffmpegInstance.deleteFile('cover.jpg');
        } catch { }
    }

    return data as Uint8Array;
}

/**
 * Download a single track
 */
export async function downloadTrack(
    trackId: string | number,
    onProgress?: ProgressCallback
): Promise<TidalTrack> {
    try {
        const settings = getSettings();

        onProgress?.({ stage: 'fetching', progress: 0, message: 'Fetching track info...' });

        // Get track metadata
        const track = await getTrack(trackId);

        onProgress?.({ stage: 'fetching', progress: 10, message: 'Getting stream URL...' });

        // Get stream URL
        const streamInfo = await getStreamInfo(trackId);

        if (!streamInfo.streamUrl) {
            throw new Error('Could not get stream URL');
        }

        // Get cover art
        let coverData: Uint8Array | null = null;
        if (settings.metadata_cover_embed && track.album?.cover) {
            try {
                const coverUrl = getCoverUrl(track.album.cover, parseInt(settings.metadata_cover_dimension));
                const coverResponse = await fetch(coverUrl);
                if (coverResponse.ok) {
                    coverData = new Uint8Array(await coverResponse.arrayBuffer());
                }
            } catch (e) {
                console.warn('Failed to fetch cover art:', e);
            }
        }

        // Get lyrics
        let lyrics: string | null = null;
        if (settings.lyrics_embed) {
            lyrics = await getLyrics(trackId);
        }

        onProgress?.({ stage: 'fetching', progress: 20, message: 'Downloading audio...' });

        // Download audio file
        const audioBuffer = await downloadWithProgress(streamInfo.streamUrl, (p) => {
            if (p.stage === 'fetching') {
                // Scale to 20-80%
                const scaled = 20 + (p.progress * 0.6);
                onProgress?.({ ...p, progress: scaled });
            }
        });

        const audioData = new Uint8Array(audioBuffer);

        // Determine file format from quality
        const isFlac = streamInfo.audioQuality === 'HI_RES' || streamInfo.audioQuality === 'LOSSLESS';
        const inputFormat = isFlac ? 'flac' : 'm4a';

        // Load FFmpeg and process
        const ffmpegInstance = await loadFFmpeg(onProgress);

        const processedData = await embedMetadata(
            ffmpegInstance,
            audioData,
            track,
            coverData,
            lyrics,
            inputFormat,
            onProgress
        );

        onProgress?.({ stage: 'complete', progress: 100, message: 'Triggering save dialog...' });

        // Create blob and trigger download
        // Create a new Uint8Array to ensure standard ArrayBuffer (not SharedArrayBuffer) for Blob compatibility
        const standardData = new Uint8Array(processedData);

        const blob = new Blob([standardData], {
            type: isFlac ? 'audio/flac' : 'audio/mp4'
        });

        const filename = `${formatFilename(track)}.${isFlac ? 'flac' : 'm4a'}`;

        // Trigger browser save dialog
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Cleanup URL after a delay
        setTimeout(() => URL.revokeObjectURL(url), 10000);

        onProgress?.({ stage: 'complete', progress: 100, message: 'Download complete!' });

        return track;

    } catch (error) {
        console.error('Download error:', error);
        onProgress?.({
            stage: 'error',
            progress: 0,
            message: error instanceof Error ? error.message : 'Download failed'
        });
        throw error;
    }
}

/**
 * Check if FFmpeg is loaded
 */
export function isFFmpegLoaded(): boolean {
    return ffmpegLoaded;
}

/**
 * Process a single track and return the data (without saving to disk)
 * Used internally by downloadAlbum and downloadPlaylist
 * @param trackId - The track ID to process
 * @param prefetchedTrack - Optional pre-fetched track metadata (avoids extra API call)
 */
async function processTrackData(
    trackId: string | number,
    prefetchedTrack?: TidalTrack
): Promise<{ data: Uint8Array; filename: string; track: TidalTrack }> {
    const settings = getSettings();

    // Use pre-fetched track metadata if available, otherwise fetch it
    const track = prefetchedTrack || await getTrack(trackId);

    // Get stream URL
    const streamInfo = await getStreamInfo(trackId);

    if (!streamInfo.streamUrl) {
        throw new Error('Could not get stream URL');
    }

    // Get cover art
    let coverData: Uint8Array | null = null;
    if (settings.metadata_cover_embed && track.album?.cover) {
        try {
            const coverUrl = getCoverUrl(track.album.cover, parseInt(settings.metadata_cover_dimension));
            const coverResponse = await fetch(coverUrl);
            if (coverResponse.ok) {
                coverData = new Uint8Array(await coverResponse.arrayBuffer());
            }
        } catch (e) {
            console.warn('Failed to fetch cover art:', e);
        }
    }

    // Get lyrics (skip if it fails, not critical)
    let lyrics: string | null = null;
    if (settings.lyrics_embed) {
        try {
            lyrics = await getLyrics(trackId);
        } catch {
            console.warn('Failed to fetch lyrics for track', trackId);
        }
    }

    // Download audio file
    const audioResponse = await fetch(streamInfo.streamUrl);
    if (!audioResponse.ok) {
        throw new Error(`Download failed: ${audioResponse.status}`);
    }
    const audioData = new Uint8Array(await audioResponse.arrayBuffer());

    // Determine file format from quality
    const isFlac = streamInfo.audioQuality === 'HI_RES' || streamInfo.audioQuality === 'LOSSLESS';
    const inputFormat = isFlac ? 'flac' : 'm4a';

    // Load FFmpeg and process
    const ffmpegInstance = await loadFFmpeg();

    const processedData = await embedMetadata(
        ffmpegInstance,
        audioData,
        track,
        coverData,
        lyrics,
        inputFormat
    );

    const filename = `${formatFilename(track)}.${isFlac ? 'flac' : 'm4a'}`;

    return { data: new Uint8Array(processedData), filename, track };
}

/**
 * Download all tracks in an album as a ZIP file
 */
export async function downloadAlbum(
    albumId: string | number,
    onProgress?: ProgressCallback
): Promise<TidalAlbum> {
    try {
        onProgress?.({ stage: 'fetching', progress: 0, message: 'Fetching album info...' });

        // Get album info and tracks
        const album = await getAlbum(albumId);
        const tracks = await getAlbumTracks(albumId);

        if (!tracks || tracks.length === 0) {
            throw new Error('Album has no tracks');
        }

        const totalTracks = tracks.length;
        const zip = new JSZip();
        const albumFolder = `${album.artist?.name || 'Unknown Artist'} - ${album.title || 'Unknown Album'}`
            .replace(/[<>:"/\\|?*]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        onProgress?.({
            stage: 'fetching',
            progress: 5,
            message: `Downloading ${totalTracks} tracks...`,
            totalTracks,
            currentTrack: 0
        });

        // Download each track
        for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            const currentTrack = i + 1;
            const trackName = `${track.artist?.name || 'Unknown'} - ${track.title || 'Unknown'}`;

            onProgress?.({
                stage: 'fetching',
                progress: 5 + (i / totalTracks) * 85,
                message: `Downloading track ${currentTrack}/${totalTracks}: ${trackName}`,
                currentTrack,
                totalTracks,
                trackName
            });

            try {
                const { data, filename } = await processTrackData(track.id, track);
                // Add track number prefix for proper ordering
                const numberedFilename = `${String(track.trackNumber || currentTrack).padStart(2, '0')} - ${filename}`;
                zip.file(numberedFilename, data);
            } catch (error) {
                console.error(`Failed to download track ${track.id}:`, error);
                // Continue with other tracks
            }
        }

        onProgress?.({ stage: 'processing', progress: 90, message: 'Creating ZIP file...' });

        // Generate ZIP file
        const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
            onProgress?.({
                stage: 'processing',
                progress: 90 + (metadata.percent / 100) * 8,
                message: `Compressing... ${Math.round(metadata.percent)}%`
            });
        });

        onProgress?.({ stage: 'complete', progress: 98, message: 'Triggering save dialog...' });

        // Trigger browser save dialog
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${albumFolder}.zip`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Cleanup URL after a delay
        setTimeout(() => URL.revokeObjectURL(url), 10000);

        onProgress?.({ stage: 'complete', progress: 100, message: 'Download complete!' });

        return album;

    } catch (error) {
        console.error('Album download error:', error);
        onProgress?.({
            stage: 'error',
            progress: 0,
            message: error instanceof Error ? error.message : 'Album download failed'
        });
        throw error;
    }
}

/**
 * Download all tracks in a playlist as a ZIP file
 */
export async function downloadPlaylist(
    playlistId: string,
    onProgress?: ProgressCallback
): Promise<TidalPlaylist> {
    try {
        onProgress?.({ stage: 'fetching', progress: 0, message: 'Fetching playlist info...' });

        // Get playlist info
        const playlist = await getPlaylist(playlistId);
        const tracks = await getPlaylistTracks(playlistId);

        if (!tracks || tracks.length === 0) {
            throw new Error('Playlist has no tracks');
        }

        const totalTracks = tracks.length;
        const zip = new JSZip();

        onProgress?.({
            stage: 'fetching',
            progress: 5,
            message: `Downloading ${totalTracks} tracks...`,
            totalTracks,
            currentTrack: 0
        });

        // Download each track
        for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            const currentTrack = i + 1;

            // Skip if track is undefined (can happen with some playlist items)
            if (!track || !track.id) {
                console.warn(`Skipping undefined track at index ${i}`);
                continue;
            }

            const trackName = `${track.artist?.name || 'Unknown'} - ${track.title || 'Unknown'}`;

            onProgress?.({
                stage: 'fetching',
                progress: 5 + (i / totalTracks) * 85,
                message: `Downloading track ${currentTrack}/${totalTracks}: ${trackName}`,
                currentTrack,
                totalTracks,
                trackName
            });

            try {
                const { data, filename } = await processTrackData(track.id, track);
                // Add track number prefix for proper ordering
                const numberedFilename = `${String(currentTrack).padStart(2, '0')} - ${filename}`;
                zip.file(numberedFilename, data);
            } catch (error) {
                console.error(`Failed to download track ${track.id}:`, error);
                // Continue with other tracks
            }
        }

        onProgress?.({ stage: 'processing', progress: 90, message: 'Creating ZIP file...' });

        // Generate ZIP file
        const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
            onProgress?.({
                stage: 'processing',
                progress: 90 + (metadata.percent / 100) * 8,
                message: `Compressing... ${Math.round(metadata.percent)}%`
            });
        });

        onProgress?.({ stage: 'complete', progress: 98, message: 'Triggering save dialog...' });

        // Use proper playlist title for folder name
        const playlistFolder = `${playlist.title || 'Unknown Playlist'}`
            .replace(/[<>:"/\\|?*]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        // Trigger browser save dialog
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        // Use playlist title in filename
        link.download = `${playlistFolder}.zip`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Cleanup URL after a delay
        setTimeout(() => URL.revokeObjectURL(url), 10000);

        onProgress?.({ stage: 'complete', progress: 100, message: 'Download complete!' });

        return playlist;

    } catch (error) {
        console.error('Playlist download error:', error);
        onProgress?.({
            stage: 'error',
            progress: 0,
            message: error instanceof Error ? error.message : 'Playlist download failed'
        });
        throw error;
    }
}
