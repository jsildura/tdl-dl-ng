/**
 * Download module with ffmpeg.wasm for client-side audio processing
 * Handles streaming downloads and metadata embedding
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import JSZip from 'jszip';
import { getStreamInfo, getTrack, getAlbum, getPlaylist, getAlbumTracks, getPlaylistTracks, getLyrics, getWorkerUrl, TidalTrack, TidalAlbum, TidalPlaylist } from './tidal-client';
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
 * Download multiple segments and combine them
 */
async function downloadSegments(
    urls: string[],
    onProgress?: ProgressCallback
): Promise<Uint8Array> {
    const totalSegments = urls.length;
    const downloadedChunks: Uint8Array[] = [];
    let totalLength = 0;

    for (let i = 0; i < totalSegments; i++) {
        const url = urls[i];

        // Download each segment and properly await the result
        const buffer = await downloadWithProgress(url, (p) => {
            if (p.stage === 'fetching') {
                // Calculate overall progress based on current segment
                const segmentProgress = p.progress; // 0-100
                const overallProgress = Math.round(((i / totalSegments) * 100) + ((segmentProgress / totalSegments)));

                onProgress?.({
                    ...p,
                    progress: overallProgress,
                    message: `Downloading segment ${i + 1}/${totalSegments}...`
                });
            }
        });

        // Store the downloaded chunk
        const chunk = new Uint8Array(buffer);
        downloadedChunks.push(chunk);
        totalLength += chunk.length;

        console.log(`Segment ${i + 1}/${totalSegments} downloaded: ${chunk.length} bytes`);
    }

    console.log(`All segments downloaded. Total size: ${totalLength} bytes`);

    // Combine all chunks
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of downloadedChunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
    }

    return combined;
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
    album: TidalAlbum | null,
    coverData: Uint8Array | null,
    lyrics: string | null,
    inputFormat: string,
    outputFormat: string, // 'flac' or 'm4a'
    onProgress?: ProgressCallback
): Promise<Uint8Array> {
    const settings = getSettings();

    onProgress?.({ stage: 'processing', progress: 50, message: 'Embedding metadata...' });

    const inputFile = `input.${inputFormat}`;
    const outputFile = `output.${outputFormat}`;

    console.log(`FFmpeg processing: ${inputFile} -> ${outputFile}`);

    // Write input file
    await ffmpegInstance.writeFile(inputFile, audioData);

    // Prepare metadata arguments
    const metadataArgs: string[] = [];

    // Basic metadata
    if (track.title) {
        metadataArgs.push('-metadata', `title=${track.title}`);
    }
    if (track.artist?.name) {
        metadataArgs.push('-metadata', `artist=${track.artist.name}`);
    }
    if (track.album?.title) {
        metadataArgs.push('-metadata', `album=${track.album.title}`);
    }

    // Track number with total (format: trackNumber/totalTracks for M4A compatibility)
    if (track.trackNumber) {
        if (album?.numberOfTracks) {
            metadataArgs.push('-metadata', `track=${track.trackNumber}/${album.numberOfTracks}`);
        } else {
            metadataArgs.push('-metadata', `track=${track.trackNumber}`);
        }
    }

    if (track.explicit) {
        metadataArgs.push('-metadata', `explicit=1`);
    }

    // Album artist (Album/Performer)
    if (album?.artist?.name) {
        metadataArgs.push('-metadata', `album_artist=${album.artist.name}`);
    }

    // Disc number with total (format: discNumber/totalDiscs for M4A compatibility)
    if (track.volumeNumber) {
        if (album?.numberOfVolumes) {
            metadataArgs.push('-metadata', `disc=${track.volumeNumber}/${album.numberOfVolumes}`);
        } else {
            metadataArgs.push('-metadata', `disc=${track.volumeNumber}`);
        }
    }

    // Release date (Recorded date)
    if (album?.releaseDate) {
        metadataArgs.push('-metadata', `date=${album.releaseDate}`);
    }

    // Copyright
    const copyrightInfo = track.copyright || album?.copyright;
    if (copyrightInfo) {
        metadataArgs.push('-metadata', `copyright=${copyrightInfo}`);
    }

    // Track URL (Title/Url in MediaInfo)
    metadataArgs.push('-metadata', `comment=https://tidal.com/browse/track/${track.id}`);

    // UPC (album barcode) - use lowercase for better compatibility
    if (album?.upc) {
        metadataArgs.push('-metadata', `upc=${album.upc}`);
    }

    // ISRC (track identifier) - use lowercase for better compatibility
    if (track.isrc) {
        metadataArgs.push('-metadata', `isrc=${track.isrc}`);
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
        // Escape special characters for FFmpeg metadata
        // Note: We do NOT escape newlines (\n) because we want actual line breaks, 
        // not literal "\n" characters in the output.
        const escapedLyrics = lyrics.replace(/\\/g, '\\\\').replace(/=/g, '\\=').replace(/;/g, '\\;');

        // Add synced lyrics (with timestamps) as LYRICS tag
        metadataArgs.push('-metadata', `LYRICS=${escapedLyrics}`);

        // Generate unsynced lyrics by stripping timestamps [MM:SS.ss] from synced lyrics
        // Regex matches patterns like [00:15.16] at the start of lines
        const unsyncedLyrics = lyrics
            .replace(/\[[\d:.]+\]\s*/g, '')  // Remove timestamp patterns
            .replace(/\n+/g, ' / ')           // Replace newlines with " / " separator
            .replace(/\s+/g, ' ')             // Normalize whitespace
            .trim();

        if (unsyncedLyrics) {
            const escapedUnsyncedLyrics = unsyncedLyrics.replace(/\\/g, '\\\\').replace(/=/g, '\\=').replace(/;/g, '\\;');
            metadataArgs.push('-metadata', `UNSYNCEDLYRICS=${escapedUnsyncedLyrics}`);
        }
    }

    // Add metadata
    ffmpegArgs.push(...metadataArgs);

    // For fMP4 to FLAC conversion, we need to extract the FLAC audio from the MP4 container
    // The fMP4 contains FLAC-encoded audio, so we can copy it directly
    // For same-format operations, just copy the audio stream
    if (inputFormat === 'mp4' && outputFormat === 'flac') {
        // Extract FLAC from fragmented MP4 container
        // Use copy to avoid re-encoding since the audio is already FLAC
        ffmpegArgs.push('-c:a', 'copy');
    } else {
        // Copy audio codec (no re-encoding)
        ffmpegArgs.push('-c:a', 'copy');
    }

    ffmpegArgs.push(outputFile);

    console.log('FFmpeg command args:', ffmpegArgs.join(' '));

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
        const trackName = `${track.artist?.name || 'Unknown'} - ${track.title || 'Unknown'}`;

        onProgress?.({ stage: 'fetching', progress: 5, message: 'Fetching album info...', trackName });

        // Get full album metadata for additional fields (upc, copyright, releaseDate, etc.)
        let album: TidalAlbum | null = null;
        if (track.album?.id) {
            try {
                album = await getAlbum(track.album.id);
            } catch (e) {
                console.warn('Failed to fetch album info:', e);
            }
        }

        onProgress?.({ stage: 'fetching', progress: 10, message: 'Getting stream URL...', trackName });

        // Get stream URL
        const streamInfo = await getStreamInfo(trackId);

        if (!streamInfo.streamUrl && (!streamInfo.streamUrls || streamInfo.streamUrls.length === 0)) {
            throw new Error('Could not get stream URL');
        }

        // Get cover art (through proxy to avoid CORS/timeout issues)
        let coverData: Uint8Array | null = null;
        if (settings.metadata_cover_embed && track.album?.cover) {
            try {
                const workerUrl = getWorkerUrl();
                const coverProxyUrl = `${workerUrl}/cover?id=${track.album.cover}&size=${settings.metadata_cover_dimension}`;
                const coverResponse = await fetch(coverProxyUrl);
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

        onProgress?.({ stage: 'fetching', progress: 20, message: 'Downloading audio...', trackName });

        // Download audio file
        let audioBuffer: ArrayBufferLike;

        console.log('Stream info in downloadTrack:', {
            hasStreamUrl: !!streamInfo.streamUrl,
            streamUrlSample: streamInfo.streamUrl?.substring(0, 50),
            hasStreamUrls: !!streamInfo.streamUrls,
            streamUrlsLength: streamInfo.streamUrls?.length || 0
        });

        if (streamInfo.streamUrls && streamInfo.streamUrls.length > 0) {
            console.log(`Downloading ${streamInfo.streamUrls.length} segments...`);
            const segmentData = await downloadSegments(streamInfo.streamUrls, (p) => {
                if (p.stage === 'fetching') {
                    // Scale to 20-80%
                    const scaled = 20 + (p.progress * 0.6);
                    onProgress?.({ ...p, progress: scaled, trackName });
                }
            });
            audioBuffer = segmentData.buffer;
        } else if (streamInfo.streamUrl) {
            audioBuffer = await downloadWithProgress(streamInfo.streamUrl, (p) => {
                if (p.stage === 'fetching') {
                    // Scale to 20-80%
                    const scaled = 20 + (p.progress * 0.6);
                    onProgress?.({ ...p, progress: scaled, trackName });
                }
            });
        } else {
            throw new Error('No stream URL available');
        }

        const audioData = new Uint8Array(audioBuffer);

        console.log('Audio data size before processing:', audioData.length, 'bytes');
        console.log('Audio quality:', streamInfo.audioQuality);

        // Determine file format from quality
        // HI_RES_LOSSLESS is FLAC wrapped in fMP4 container (from DASH segments)
        // HI_RES and LOSSLESS are also high quality
        const isHiRes = streamInfo.audioQuality === 'HI_RES_LOSSLESS' ||
            streamInfo.audioQuality === 'HI_RES' ||
            streamInfo.audioQuality === 'LOSSLESS';

        // For segmented streams, input is fragmented MP4 containing FLAC
        // For non-segmented streams, it might be direct FLAC or M4A
        const isSegmented = streamInfo.streamUrls && streamInfo.streamUrls.length > 0;
        const inputFormat = isSegmented ? 'mp4' : (isHiRes ? 'flac' : 'm4a');

        console.log('Format detection:', { isHiRes, isSegmented, inputFormat });

        // Load FFmpeg and process
        const ffmpegInstance = await loadFFmpeg((p) => onProgress?.({ ...p, trackName }));

        const processedData = await embedMetadata(
            ffmpegInstance,
            audioData,
            track,
            album,
            coverData,
            lyrics,
            inputFormat,
            isHiRes ? 'flac' : 'm4a', // outputFormat
            (p) => onProgress?.({ ...p, trackName })
        );

        onProgress?.({ stage: 'complete', progress: 100, message: 'Triggering save dialog...', trackName });

        // Create blob and trigger download
        // Create a new Uint8Array to ensure standard ArrayBuffer (not SharedArrayBuffer) for Blob compatibility
        const standardData = new Uint8Array(processedData);

        const blob = new Blob([standardData], {
            type: isHiRes ? 'audio/flac' : 'audio/mp4'
        });

        const filename = `${formatFilename(track)}.${isHiRes ? 'flac' : 'm4a'}`;

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

        onProgress?.({ stage: 'complete', progress: 100, message: 'Download complete!', trackName });

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
 * @param prefetchedAlbum - Optional pre-fetched album metadata for metadata embedding
 */
async function processTrackData(
    trackId: string | number,
    prefetchedTrack?: TidalTrack,
    prefetchedAlbum?: TidalAlbum | null
): Promise<{ data: Uint8Array; filename: string; track: TidalTrack }> {
    const settings = getSettings();

    // Use pre-fetched track metadata if available, otherwise fetch it
    const track = prefetchedTrack || await getTrack(trackId);

    // Use pre-fetched album or fetch it for full metadata
    let album: TidalAlbum | null = prefetchedAlbum ?? null;
    if (!album && track.album?.id) {
        try {
            album = await getAlbum(track.album.id);
        } catch (e) {
            console.warn('Failed to fetch album info:', e);
        }
    }

    // Get stream URL
    const streamInfo = await getStreamInfo(trackId);

    if (!streamInfo.streamUrl) {
        throw new Error('Could not get stream URL');
    }

    // Get cover art (through proxy to avoid CORS/timeout issues)
    let coverData: Uint8Array | null = null;
    if (settings.metadata_cover_embed && track.album?.cover) {
        try {
            const workerUrl = getWorkerUrl();
            const coverProxyUrl = `${workerUrl}/cover?id=${track.album.cover}&size=${settings.metadata_cover_dimension}`;
            const coverResponse = await fetch(coverProxyUrl);
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
    let audioData: Uint8Array;

    if (streamInfo.streamUrls && streamInfo.streamUrls.length > 0) {
        // Segmented DASH stream
        audioData = await downloadSegments(streamInfo.streamUrls);
    } else if (streamInfo.streamUrl) {
        const audioResponse = await fetch(streamInfo.streamUrl);
        if (!audioResponse.ok) {
            throw new Error(`Download failed: ${audioResponse.status}`);
        }
        audioData = new Uint8Array(await audioResponse.arrayBuffer());
    } else {
        throw new Error('No stream URL available');
    }

    // Determine file format from quality
    const isHiRes = streamInfo.audioQuality === 'HI_RES_LOSSLESS' ||
        streamInfo.audioQuality === 'HI_RES' ||
        streamInfo.audioQuality === 'LOSSLESS';
    const isSegmented = streamInfo.streamUrls && streamInfo.streamUrls.length > 0;
    const inputFormat = isSegmented ? 'mp4' : (isHiRes ? 'flac' : 'm4a');
    const outputFormat = isHiRes ? 'flac' : 'm4a';

    // Load FFmpeg and process
    const ffmpegInstance = await loadFFmpeg();

    const processedData = await embedMetadata(
        ffmpegInstance,
        audioData,
        track,
        album,
        coverData,
        lyrics,
        inputFormat,
        outputFormat
    );

    const filename = `${formatFilename(track)}.${outputFormat}`;

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
                const { data, filename } = await processTrackData(track.id, track, album);
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
                const { data, filename } = await processTrackData(track.id, track, null);
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
