/**
 * Download module with ffmpeg.wasm for client-side audio processing
 * Handles streaming downloads and metadata embedding
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { getStreamInfo, getTrack, getCoverUrl, getLyrics, TidalTrack } from './tidal-client';
import { getSettings } from './settings';

// FFmpeg instance (lazy loaded)
let ffmpeg: FFmpeg | null = null;
let ffmpegLoaded = false;

export interface DownloadProgress {
    stage: 'fetching' | 'processing' | 'complete' | 'error';
    progress: number; // 0-100
    message: string;
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

    // Load FFmpeg with proper CORS settings for WASM
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

    await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    ffmpegLoaded = true;
    return ffmpeg;
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
    if (coverData && settings.metadata_cover_embed) {
        await ffmpegInstance.writeFile('cover.jpg', coverData);
        ffmpegArgs.push('-i', 'cover.jpg');
        ffmpegArgs.push('-map', '0:a', '-map', '1:0');

        if (inputFormat === 'flac') {
            ffmpegArgs.push('-disposition:v', 'attached_pic');
        } else {
            ffmpegArgs.push('-c:v', 'mjpeg');
            ffmpegArgs.push('-disposition:v:0', 'attached_pic');
        }
    }

    // Add metadata
    ffmpegArgs.push(...metadataArgs);

    // Add lyrics if available and enabled
    if (lyrics && settings.lyrics_embed) {
        metadataArgs.push('-metadata', `lyrics=${lyrics}`);
    }

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
    if (coverData) {
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
): Promise<void> {
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
