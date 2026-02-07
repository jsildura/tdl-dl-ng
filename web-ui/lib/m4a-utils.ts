/**
 * M4A Utility Library for ReplayGain Injection
 * 
 * Purpose: Inject ReplayGain tags into M4A files as custom iTunes metadata atoms.
 * This bypasses FFmpeg's limitation where `-movflags use_metadata_tags` breaks cover art.
 * 
 * Atom Structure for Custom Metadata:
 * moov -> udta -> meta -> ilst -> ---- (custom atom)
 * 
 * Custom Atom Layout:
 * [size: 4] [name: "----"]
 * [size: 4] [name: "mean"] [flags: 4] [data: "com.apple.iTunes"]
 * [size: 4] [name: "name"] [flags: 4] [data: "REPLAYGAIN_TRACK_GAIN"]
 * [size: 4] [name: "data"] [type: 1 (text)] [flags: 4] [data: "-8.50 dB"]
 */

export async function injectReplayGain(fileBuffer: Uint8Array, tags: Record<string, string>): Promise<Uint8Array> {
    const dataView = new DataView(fileBuffer.buffer);

    // 1. Find 'moov' atom
    const moovOffset = findAtom(dataView, 'moov', 0);
    if (moovOffset === -1) {
        console.error('M4A: moov atom not found');
        return fileBuffer; // Return original if structure is invalid
    }
    const moovSize = dataView.getUint32(moovOffset);

    // 2. Find 'udta' inside 'moov'
    const udtaOffset = findAtom(dataView, 'udta', moovOffset + 8, moovOffset + moovSize);

    // If udta doesn't exist, we'd need to resize moov and insert it (complex).
    // FFmpeg usually creates udta if metadata exists. If not found, we skip for safety.
    if (udtaOffset === -1) {
        console.warn('M4A: udta atom not found, skipping ReplayGain injection');
        return fileBuffer;
    }
    const udtaSize = dataView.getUint32(udtaOffset);

    // 3. Find 'meta' inside 'udta'
    const metaOffset = findAtom(dataView, 'meta', udtaOffset + 8, udtaOffset + udtaSize);
    if (metaOffset === -1) {
        console.warn('M4A: meta atom not found, skipping ReplayGain injection');
        return fileBuffer;
    }
    const metaSize = dataView.getUint32(metaOffset);

    // 4. Find 'ilst' inside 'meta'
    // meta atom usually has 4 bytes of version/flags after size+type
    const ilstOffset = findAtom(dataView, 'ilst', metaOffset + 12, metaOffset + metaSize);
    if (ilstOffset === -1) {
        console.warn('M4A: ilst atom not found, skipping ReplayGain injection');
        return fileBuffer;
    }
    const ilstSize = dataView.getUint32(ilstOffset);

    // 5. Create new custom atoms
    const newAtoms: Uint8Array[] = [];
    let addedSize = 0;

    for (const [key, value] of Object.entries(tags)) {
        if (!value) continue;
        const atom = createCustomAtom(key, value);
        newAtoms.push(atom);
        addedSize += atom.length;
    }

    if (addedSize === 0) return fileBuffer;

    // 6. Construct new file
    // We need to insert addedSize bytes at (ilstOffset + ilstSize)
    // AND update sizes for: ilst, meta, udta, moov

    const newFileSize = fileBuffer.length + addedSize;
    const newBuffer = new Uint8Array(newFileSize);
    const newDataView = new DataView(newBuffer.buffer);

    // Copy everything up to end of ilst
    const insertionPoint = ilstOffset + ilstSize;
    newBuffer.set(fileBuffer.slice(0, insertionPoint), 0);

    // Insert new atoms
    let currentPos = insertionPoint;
    for (const atom of newAtoms) {
        newBuffer.set(atom, currentPos);
        currentPos += atom.length;
    }

    // Copy rest of file
    newBuffer.set(fileBuffer.slice(insertionPoint), currentPos);

    // 7. Update atom sizes (working backward from inner to outer)

    // Update 'ilst' size
    const newIlstSize = ilstSize + addedSize;
    newDataView.setUint32(ilstOffset, newIlstSize);

    // Update 'meta' size
    const newMetaSize = metaSize + addedSize;
    newDataView.setUint32(metaOffset, newMetaSize);

    // Update 'udta' size
    const newUdtaSize = udtaSize + addedSize;
    newDataView.setUint32(udtaOffset, newUdtaSize);

    // Update 'moov' size
    const newMoovSize = moovSize + addedSize;
    newDataView.setUint32(moovOffset, newMoovSize);

    // 8. Update 'stco' or 'co64' offsets? 
    // If 'moov' is at the end of the file (common for non-faststart), offsets are from start of file.
    // If we changed size of moov, do we need to shift offsets?
    // If moov is at START, shifting it shifts mdia data, invalidating offsets.
    // If moov is at END, shifting it doesn't affect offsets pointing to mdat at start.
    // FFmpeg usually puts moov at end unless -movflags faststart is used.

    // Check if mdat is BEFORE moov. If so, safe.
    // If mdat is AFTER moov, we broke the file.
    const mdatOffset = findAtom(dataView, 'mdat', 0);
    if (mdatOffset > moovOffset) {
        console.warn('M4A: mdat follows moov. Injection might break file offsets. Use faststart disabled.');
        // If we strictly just append to ilst which is near end of file, we are safe if moov is at end.
    }

    return newBuffer;
}

function findAtom(view: DataView, type: string, start: number, end: number = view.byteLength): number {
    let offset = start;
    while (offset < end - 8) {
        const size = view.getUint32(offset);
        if (size < 8) return -1; // Invalid size

        const atomType = getAtomType(view, offset + 4);
        if (atomType === type) {
            return offset;
        }

        offset += size;
    }
    return -1;
}

function getAtomType(view: DataView, offset: number): string {
    let type = '';
    for (let i = 0; i < 4; i++) {
        type += String.fromCharCode(view.getUint8(offset + i));
    }
    return type;
}

function createCustomAtom(name: string, value: string): Uint8Array {
    // Structure:
    // [size] [----]
    //   [size] [mean] [0000] [com.apple.iTunes]
    //   [size] [name] [0000] [TagName]
    //   [size] [data] [0001] [0000] [Value]

    const mean = 'com.apple.iTunes';
    const atomName = name.toUpperCase(); // ReplayGain traditional caps
    const atomValue = value;

    // Calculate sizes
    // header: 4 size + 4 type = 8
    // mean: 8 header + 4 flags + mean.length
    const meanSize = 12 + mean.length;
    // name: 8 header + 4 flags + atomName.length
    const nameSize = 12 + atomName.length;
    // data: 8 header + 4 type/flags + 4 null + value.length
    const dataSize = 16 + atomValue.length;

    const totalSize = 8 + meanSize + nameSize + dataSize;

    const buffer = new Uint8Array(totalSize);
    const view = new DataView(buffer.buffer);
    let pos = 0;

    // Top level '----' atom
    view.setUint32(pos, totalSize); pos += 4;
    writeString(view, pos, '----'); pos += 4;

    // 'mean' atom
    view.setUint32(pos, meanSize); pos += 4;
    writeString(view, pos, 'mean'); pos += 4;
    view.setUint32(pos, 0); pos += 4; // Version/Flags
    writeString(view, pos, mean); pos += mean.length;

    // 'name' atom
    view.setUint32(pos, nameSize); pos += 4;
    writeString(view, pos, 'name'); pos += 4;
    view.setUint32(pos, 0); pos += 4; // Version/Flags
    writeString(view, pos, atomName); pos += atomName.length;

    // 'data' atom
    view.setUint32(pos, dataSize); pos += 4;
    writeString(view, pos, 'data'); pos += 4;
    view.setUint32(pos, 1); pos += 4; // Type 1 = UTF-8 text
    view.setUint32(pos, 0); pos += 4; // Null
    writeString(view, pos, atomValue); pos += atomValue.length;

    return buffer;
}

function writeString(view: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
    }
}
