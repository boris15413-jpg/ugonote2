"use strict";



const UniMuxer = (() => {

const bytes = new Uint8Array(8);

const view = new DataView(bytes.buffer);



const u8 = (value) => [(value % 256 + 256) % 256];

const u16 = (value) => { view.setUint16(0, value, false); return [bytes[0], bytes[1]]; };

const i16 = (value) => { view.setInt16(0, value, false); return [bytes[0], bytes[1]]; };

const u24 = (value) => { view.setUint32(0, value, false); return [bytes[1], bytes[2], bytes[3]]; };

const u32 = (value) => { view.setUint32(0, value, false); return [bytes[0], bytes[1], bytes[2], bytes[3]]; };

const i32 = (value) => { view.setInt32(0, value, false); return [bytes[0], bytes[1], bytes[2], bytes[3]]; };

const u64 = (value) => {

view.setUint32(0, Math.floor(value / 4294967296), false);

view.setUint32(4, value, false);

return [bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7]];

};



const fixed_8_8 = (value) => { view.setInt16(0, Math.round(256 * value), false); return [bytes[0], bytes[1]]; };

const fixed_16_16 = (value) => { view.setInt32(0, Math.round(65536 * value), false); return [bytes[0], bytes[1], bytes[2], bytes[3]]; };

const fixed_2_30 = (value) => { view.setInt32(0, Math.round(1073741824 * value), false); return [bytes[0], bytes[1], bytes[2], bytes[3]]; };



const ascii = (text, nullTerminated = false) => {

let b = Array(text.length).fill(null).map((_, i) => text.charCodeAt(i));

if (nullTerminated) b.push(0);

return b;

};



const last = (arr) => arr && arr[arr.length - 1];

const lastPresentedSample = (samples) => {

let r = undefined;

for (let s of samples) {

if (!r || s.presentationTimestamp > r.presentationTimestamp) r = s;

}

return r;

};



const intoTimescale = (timeInSeconds, timescale, round = true) => {

let v = timeInSeconds * timescale;

return round ? Math.round(v) : v;

};



const rotationMatrix = (rotationInDegrees) => {

let theta = rotationInDegrees * (Math.PI / 180);

let cosTheta = Math.cos(theta);

let sinTheta = Math.sin(theta);

return [cosTheta, sinTheta, 0, -sinTheta, cosTheta, 0, 0, 0, 1];

};



const IDENTITY_MATRIX = rotationMatrix(0);



const matrixToBytes = (matrix) => [

fixed_16_16(matrix[0]), fixed_16_16(matrix[1]), fixed_2_30(matrix[2]),

fixed_16_16(matrix[3]), fixed_16_16(matrix[4]), fixed_2_30(matrix[5]),

fixed_16_16(matrix[6]), fixed_16_16(matrix[7]), fixed_2_30(matrix[8])

];



const deepClone = (x) => {

if (!x) return x;

if (typeof x !== "object") return x;

if (Array.isArray(x)) return x.map(deepClone);

return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, deepClone(v)]));

};



const isU32 = (value) => value >= 0 && value < 4294967296;



const box = (type, contents, children) => ({ type, contents: contents && new Uint8Array(contents.flat(10)), children });

const fullBox = (type, version, flags, contents, children) => box(type, [u8(version), u24(flags), contents ?? []], children);



const ftyp = (details) => {

let minorVersion = 512;

if (details.fragmented) return box("ftyp", [ascii("iso5"), u32(minorVersion), ascii("iso5"), ascii("iso6"), ascii("mp41")]);

return box("ftyp", [ascii("isom"), u32(minorVersion), ascii("isom"), details.holdsAvc ? ascii("avc1") : [], ascii("mp41")]);

};



const mdat = (reserveLargeSize) => ({ type: "mdat", largeSize: reserveLargeSize });

const free = (size) => ({ type: "free", size });



const moov = (tracks, creationTime, fragmented = false) => box("moov", null, [

mvhd(creationTime, tracks),

...tracks.map((x) => trak(x, creationTime)),

fragmented ? mvex(tracks) : null

]);



const mvhd = (creationTime, tracks) => {

let duration = intoTimescale(Math.max(0, ...tracks.filter((x) => x.samples.length > 0).map((x) => {

const ls = lastPresentedSample(x.samples);

return ls.presentationTimestamp + ls.duration;

})), GLOBAL_TIMESCALE);

let nextTrackId = Math.max(...tracks.map((x) => x.id)) + 1;

let needsU64 = !isU32(creationTime) || !isU32(duration);

let u32OrU64 = needsU64 ? u64 : u32;

return fullBox("mvhd", +needsU64, 0, [

u32OrU64(creationTime), u32OrU64(creationTime), u32(GLOBAL_TIMESCALE), u32OrU64(duration),

fixed_16_16(1), fixed_8_8(1), Array(10).fill(0), matrixToBytes(IDENTITY_MATRIX), Array(24).fill(0), u32(nextTrackId)

]);

};



const trak = (track, creationTime) => box("trak", null, [tkhd(track, creationTime), mdia(track, creationTime)]);



const tkhd = (track, creationTime) => {

let ls = lastPresentedSample(track.samples);

let durationInGlobalTimescale = intoTimescale(ls ? ls.presentationTimestamp + ls.duration : 0, GLOBAL_TIMESCALE);

let needsU64 = !isU32(creationTime) || !isU32(durationInGlobalTimescale);

let u32OrU64 = needsU64 ? u64 : u32;

let matrix;

if (track.info.type === "video") {

matrix = typeof track.info.rotation === "number" ? rotationMatrix(track.info.rotation) : track.info.rotation;

} else {

matrix = IDENTITY_MATRIX;

}

return fullBox("tkhd", +needsU64, 3, [

u32OrU64(creationTime), u32OrU64(creationTime), u32(track.id), u32(0), u32OrU64(durationInGlobalTimescale),

Array(8).fill(0), u16(0), u16(0), fixed_8_8(track.info.type === "audio" ? 1 : 0), u16(0), matrixToBytes(matrix),

fixed_16_16(track.info.type === "video" ? track.info.width : 0), fixed_16_16(track.info.type === "video" ? track.info.height : 0)

]);

};



const mdia = (track, creationTime) => box("mdia", null, [mdhd(track, creationTime), hdlr(track.info.type === "video" ? "vide" : "soun"), minf(track)]);



const mdhd = (track, creationTime) => {

let ls = lastPresentedSample(track.samples);

let localDuration = intoTimescale(ls ? ls.presentationTimestamp + ls.duration : 0, track.timescale);

let needsU64 = !isU32(creationTime) || !isU32(localDuration);

let u32OrU64 = needsU64 ? u64 : u32;

return fullBox("mdhd", +needsU64, 0, [

u32OrU64(creationTime), u32OrU64(creationTime), u32(track.timescale), u32OrU64(localDuration), u16(21956), u16(0)

]);

};



const hdlr = (componentSubtype) => fullBox("hdlr", 0, 0, [

ascii("mhlr"), ascii(componentSubtype), u32(0), u32(0), u32(0), ascii("unimuxer-hdlr", true)

]);



const minf = (track) => box("minf", null, [track.info.type === "video" ? vmhd() : smhd(), dinf(), stbl(track)]);



const vmhd = () => fullBox("vmhd", 0, 1, [u16(0), u16(0), u16(0), u16(0)]);

const smhd = () => fullBox("smhd", 0, 0, [u16(0), u16(0)]);



const dinf = () => box("dinf", null, [dref()]);

const dref = () => fullBox("dref", 0, 0, [u32(1)], [url()]);

const url = () => fullBox("url ", 0, 1);



const stbl = (track) => {

const needsCtts = track.compositionTimeOffsetTable.length > 1 || track.compositionTimeOffsetTable.some((x) => x.sampleCompositionTimeOffset !== 0);

return box("stbl", null, [

stsd(track), stts(track), stss(track), stsc(track), stsz(track), stco(track), needsCtts ? ctts(track) : null

]);

};



const stsd = (track) => fullBox("stsd", 0, 0, [u32(1)], [

track.info.type === "video" ? videoSampleDescription(VIDEO_CODEC_TO_BOX_NAME[track.info.codec], track) : soundSampleDescription(AUDIO_CODEC_TO_BOX_NAME[track.info.codec], track)

]);



const videoSampleDescription = (compressionType, track) => box(compressionType, [

Array(6).fill(0), u16(1), u16(0), u16(0), Array(12).fill(0),

u16(track.info.width), u16(track.info.height), u32(4718592), u32(4718592), u32(0), u16(1),

Array(32).fill(0), u16(24), i16(65535)

], [

VIDEO_CODEC_TO_CONFIGURATION_BOX[track.info.codec](track),

track.info.decoderConfig?.colorSpace ? colr(track) : null

]);



const COLOR_PRIMARIES_MAP = { "bt709": 1, "bt470bg": 5, "smpte170m": 6 };

const TRANSFER_CHARACTERISTICS_MAP = { "bt709": 1, "smpte170m": 6, "iec61966-2-1": 13 };

const MATRIX_COEFFICIENTS_MAP = { "rgb": 0, "bt709": 1, "bt470bg": 5, "smpte170m": 6 };



const colr = (track) => box("colr", [

ascii("nclx"),

u16(COLOR_PRIMARIES_MAP[track.info.decoderConfig.colorSpace.primaries] || 2),

u16(TRANSFER_CHARACTERISTICS_MAP[track.info.decoderConfig.colorSpace.transfer] || 2),

u16(MATRIX_COEFFICIENTS_MAP[track.info.decoderConfig.colorSpace.matrix] || 2),

u8((track.info.decoderConfig.colorSpace.fullRange ? 1 : 0) << 7)

]);



const avcC = (track) => track.info.decoderConfig && track.info.decoderConfig.description && box("avcC", [...new Uint8Array(track.info.decoderConfig.description)]);

const hvcC = (track) => track.info.decoderConfig && track.info.decoderConfig.description && box("hvcC", [...new Uint8Array(track.info.decoderConfig.description)]);



const vpcC = (track) => {

if (!track.info.decoderConfig) return null;

let decoderConfig = track.info.decoderConfig;

let colorSpace = decoderConfig.colorSpace || {};

let parts = decoderConfig.codec.split(".");

let profile = Number(parts[1]) || 0;

let level = Number(parts[2]) || 10;

let bitDepth = Number(parts[3]) || 8;

let chromaSubsampling = 0;

let thirdByte = (bitDepth << 4) + (chromaSubsampling << 1) + Number(colorSpace.fullRange ? 1 : 0);

return fullBox("vpcC", 1, 0, [u8(profile), u8(level), u8(thirdByte), u8(2), u8(2), u8(2), u16(0)]);

};



const av1C = () => box("av1C", [129, 0, 0, 0]);



const soundSampleDescription = (compressionType, track) => box(compressionType, [

Array(6).fill(0), u16(1), u16(0), u16(0), u32(0), u16(track.info.numberOfChannels), u16(16), u16(0), u16(0), fixed_16_16(track.info.sampleRate)

], [AUDIO_CODEC_TO_CONFIGURATION_BOX[track.info.codec](track)]);



const esds = (track) => {

let desc = new Uint8Array(track.info.decoderConfig.description || []);

return fullBox("esds", 0, 0, [

u32(58753152), u8(32 + desc.byteLength), u16(1), u8(0),

u32(75530368), u8(18 + desc.byteLength), u8(64), u8(21),

u24(0), u32(130071), u32(130071), u32(92307584), u8(desc.byteLength),

...desc, u32(109084800), u8(1), u8(2)

]);

};



const dOps = (track) => {

let preskip = 3840;

let gain = 0;

const desc = track.info.decoderConfig?.description;

if (desc && desc.byteLength >= 18) {

const view2 = ArrayBuffer.isView(desc) ? new DataView(desc.buffer, desc.byteOffset, desc.byteLength) : new DataView(desc);

preskip = view2.getUint16(10, true);

gain = view2.getInt16(14, true);

}

return box("dOps", [u8(0), u8(track.info.numberOfChannels), u16(preskip), u32(track.info.sampleRate), fixed_8_8(gain), u8(0)]);

};



const stts = (track) => fullBox("stts", 0, 0, [

u32(track.timeToSampleTable.length),

track.timeToSampleTable.map((x) => [u32(x.sampleCount), u32(x.sampleDelta)])

]);



const stss = (track) => {

if (track.samples.every((x) => x.type === "key")) return null;

let keySamples = [...track.samples.entries()].filter(([, sample]) => sample.type === "key");

return fullBox("stss", 0, 0, [

u32(keySamples.length),

keySamples.map(([index]) => u32(index + 1))

]);

};



const stsc = (track) => fullBox("stsc", 0, 0, [

u32(track.compactlyCodedChunkTable.length),

track.compactlyCodedChunkTable.map((x) => [u32(x.firstChunk), u32(x.samplesPerChunk), u32(1)])

]);



const stsz = (track) => fullBox("stsz", 0, 0, [

u32(0), u32(track.samples.length), track.samples.map((x) => u32(x.size))

]);



const stco = (track) => {

if (track.finalizedChunks.length > 0 && last(track.finalizedChunks).offset >= 4294967296) {

return fullBox("co64", 0, 0, [

u32(track.finalizedChunks.length), track.finalizedChunks.map((x) => u64(x.offset))

]);

}

return fullBox("stco", 0, 0, [

u32(track.finalizedChunks.length), track.finalizedChunks.map((x) => u32(x.offset))

]);

};



const ctts = (track) => {

let hasNegative = track.compositionTimeOffsetTable.some(x => x.sampleCompositionTimeOffset < 0);

return fullBox("ctts", hasNegative ? 1 : 0, 0, [

u32(track.compositionTimeOffsetTable.length),

track.compositionTimeOffsetTable.map((x) => [

u32(x.sampleCount),

hasNegative ? i32(x.sampleCompositionTimeOffset) : u32(x.sampleCompositionTimeOffset)

])

]);

};



const mvex = (tracks) => box("mvex", null, tracks.map(trex));

const trex = (track) => fullBox("trex", 0, 0, [u32(track.id), u32(1), u32(0), u32(0), u32(0)]);

const moof = (sequenceNumber, tracks) => box("moof", null, [mfhd(sequenceNumber), ...tracks.map(traf)]);

const mfhd = (sequenceNumber) => fullBox("mfhd", 0, 0, [u32(sequenceNumber)]);



const fragmentSampleFlags = (sample) => {

let byte1 = 0, byte2 = 0, byte3 = 0, byte4 = 0;

let isDelta = sample.type === "delta";

byte2 |= +isDelta;

if (isDelta) byte1 |= 1; else byte1 |= 2;

return byte1 << 24 | byte2 << 16 | byte3 << 8 | byte4;

};



const traf = (track) => box("traf", null, [tfhd(track), tfdt(track), trun(track)]);



const tfhd = (track) => {

let tfFlags = 8 | 16 | 32 | 131072;

let referenceSample = track.currentChunk.samples[1] ?? track.currentChunk.samples[0];

let referenceSampleInfo = {

duration: referenceSample ? referenceSample.timescaleUnitsToNextSample : 0,

size: referenceSample ? referenceSample.size : 0,

flags: referenceSample ? fragmentSampleFlags(referenceSample) : 0

};

return fullBox("tfhd", 0, tfFlags, [

u32(track.id), u32(referenceSampleInfo.duration), u32(referenceSampleInfo.size), u32(referenceSampleInfo.flags)

]);

};



const tfdt = (track) => fullBox("tfdt", 1, 0, [u64(intoTimescale(track.currentChunk.startTimestamp, track.timescale))]);



const trun = (track) => {

let allDurations = track.currentChunk.samples.map((x) => x.timescaleUnitsToNextSample);

let allSizes = track.currentChunk.samples.map((x) => x.size);

let allFlags = track.currentChunk.samples.map(fragmentSampleFlags);

let allOffsets = track.currentChunk.samples.map((x) => intoTimescale(x.presentationTimestamp - x.decodeTimestamp, track.timescale));

let uniqueDurations = new Set(allDurations);

let uniqueSizes = new Set(allSizes);

let uniqueFlags = new Set(allFlags);

let uniqueOffsets = new Set(allOffsets);

let firstSampleFlagsPresent = uniqueFlags.size === 2 && allFlags[0] !== allFlags[1];

let durationPresent = uniqueDurations.size > 1;

let sizePresent = uniqueSizes.size > 1;

let flagsPresent = !firstSampleFlagsPresent && uniqueFlags.size > 1;

let offsetsPresent = uniqueOffsets.size > 1 || [...uniqueOffsets].some((x) => x !== 0);

let flags = 1;

flags |= 4 * +firstSampleFlagsPresent;

flags |= 256 * +durationPresent;

flags |= 512 * +sizePresent;

flags |= 1024 * +flagsPresent;

flags |= 2048 * +offsetsPresent;

return fullBox("trun", 1, flags, [

u32(track.currentChunk.samples.length),

u32(track.currentChunk.offset - track.currentChunk.moofOffset || 0),

firstSampleFlagsPresent ? u32(allFlags[0]) : [],

track.currentChunk.samples.map((_, i) => [

durationPresent ? u32(allDurations[i]) : [],

sizePresent ? u32(allSizes[i]) : [],

flagsPresent ? u32(allFlags[i]) : [],

offsetsPresent ? i32(allOffsets[i]) : []

])

]);

};



const mfra = (tracks) => box("mfra", null, [...tracks.map(tfra), mfro()]);

const tfra = (track, trackIndex) => fullBox("tfra", 1, 0, [

u32(track.id), u32(63), u32(track.finalizedChunks.length),

track.finalizedChunks.map((chunk) => [u64(intoTimescale(chunk.startTimestamp, track.timescale)), u64(chunk.moofOffset), u32(trackIndex + 1), u32(1), u32(1)])

]);

const mfro = () => fullBox("mfro", 0, 0, [u32(0)]);



const VIDEO_CODEC_TO_BOX_NAME = { "avc": "avc1", "hevc": "hvc1", "vp9": "vp09", "av1": "av01" };

const VIDEO_CODEC_TO_CONFIGURATION_BOX = { "avc": avcC, "hevc": hvcC, "vp9": vpcC, "av1": av1C };

const AUDIO_CODEC_TO_BOX_NAME = { "aac": "mp4a", "opus": "Opus" };

const AUDIO_CODEC_TO_CONFIGURATION_BOX = { "aac": esds, "opus": dOps };



class Target {}



class ArrayBufferTarget extends Target {

constructor() { super(); this.buffer = null; }

}



class StreamTarget extends Target {

constructor(options) {

super();

this.options = options;

if (typeof options !== "object") throw new TypeError();

if (options.onData && typeof options.onData !== "function") throw new TypeError();

if (options.chunked !== void 0 && typeof options.chunked !== "boolean") throw new TypeError();

if (options.chunkSize !== void 0 && (!Number.isInteger(options.chunkSize) || options.chunkSize < 1024)) throw new TypeError();

}

}



class FileSystemWritableFileStreamTarget extends Target {

constructor(stream, options) {

super();

this.stream = stream;

this.options = options;

if (options !== void 0 && typeof options !== "object") throw new TypeError();

if (options && options.chunkSize !== void 0 && (!Number.isInteger(options.chunkSize) || options.chunkSize <= 0)) throw new TypeError();

}

}



class Writer {

constructor() {

this.pos = 0;

this._helper = new Uint8Array(8);

this._helperView = new DataView(this._helper.buffer);

this.offsets = new WeakMap();

}

seek(newPos) { this.pos = newPos; }

writeU32(value) { this._helperView.setUint32(0, value, false); this.write(this._helper.subarray(0, 4)); }

writeU64(value) { this._helperView.setUint32(0, Math.floor(value / 4294967296), false); this._helperView.setUint32(4, value, false); this.write(this._helper.subarray(0, 8)); }

writeAscii(text) {

for (let i = 0; i < text.length; i++) {

this._helperView.setUint8(i % 8, text.charCodeAt(i));

if (i % 8 === 7) this.write(this._helper);

}

if (text.length % 8 !== 0) this.write(this._helper.subarray(0, text.length % 8));

}

writeBox(b) {

this.offsets.set(b, this.pos);

if (b.contents && !b.children) {

this.writeBoxHeader(b, b.size ?? b.contents.byteLength + 8);

this.write(b.contents);

} else {

let startPos = this.pos;

this.writeBoxHeader(b, 0);

if (b.contents) this.write(b.contents);

if (b.children) {

for (let child of b.children) if (child) this.writeBox(child);

}

let endPos = this.pos;

let size = b.size ?? endPos - startPos;

this.seek(startPos);

this.writeBoxHeader(b, size);

this.seek(endPos);

}

}

writeBoxHeader(b, size) {

this.writeU32(b.largeSize ? 1 : size);

this.writeAscii(b.type);

if (b.largeSize) this.writeU64(size);

}

measureBoxHeader(b) { return 8 + (b.largeSize ? 8 : 0); }

patchBox(b) {

let endPos = this.pos;

this.seek(this.offsets.get(b));

this.writeBox(b);

this.seek(endPos);

}

measureBox(b) {

if (b.contents && !b.children) return this.measureBoxHeader(b) + b.contents.byteLength;

let result = this.measureBoxHeader(b);

if (b.contents) result += b.contents.byteLength;

if (b.children) {

for (let child of b.children) if (child) result += this.measureBox(child);

}

return result;

}

}



class ArrayBufferTargetWriter extends Writer {

constructor(target) {

super();

this._target = target;

this._buffer = new ArrayBuffer(2 ** 16);

this._bytes = new Uint8Array(this._buffer);

this._maxPos = 0;

}

_ensureSize(size) {

let newLength = this._buffer.byteLength;

const CHUNK_MAX_GROWTH = 10 * 1024 * 1024;

while (newLength < size) {

if (newLength < CHUNK_MAX_GROWTH) newLength *= 2;

else newLength += CHUNK_MAX_GROWTH;

}

if (newLength === this._buffer.byteLength) return;

let newBuffer = new ArrayBuffer(newLength);

let newBytes = new Uint8Array(newBuffer);

newBytes.set(this._bytes, 0);

this._buffer = newBuffer;

this._bytes = newBytes;

}

write(data) {

this._ensureSize(this.pos + data.byteLength);

this._bytes.set(data, this.pos);

this.pos += data.byteLength;

this._maxPos = Math.max(this._maxPos, this.pos);

}

finalize() {

this._ensureSize(this.pos);

this._target.buffer = this._buffer.slice(0, Math.max(this._maxPos, this.pos));

}

}



const DEFAULT_CHUNK_SIZE = 2 ** 24;

const MAX_CHUNKS_AT_ONCE = 2;



class StreamTargetWriter extends Writer {

constructor(target) {

super();

this._target = target;

this._sections = [];

this._chunked = target.options?.chunked ?? false;

this._chunkSize = target.options?.chunkSize ?? DEFAULT_CHUNK_SIZE;

this._chunks = [];

}

write(data) {

this._sections.push({ data: data.slice(), start: this.pos });

this.pos += data.byteLength;

}

flush() {

if (this._sections.length === 0) return;

let chunks = [];

let sorted = [...this._sections].sort((a, b) => a.start - b.start);

chunks.push({ start: sorted[0].start, size: sorted[0].data.byteLength });

for (let i = 1; i < sorted.length; i++) {

let lastChunk = chunks[chunks.length - 1];

let section = sorted[i];

if (section.start <= lastChunk.start + lastChunk.size) {

lastChunk.size = Math.max(lastChunk.size, section.start + section.data.byteLength - lastChunk.start);

} else {

chunks.push({ start: section.start, size: section.data.byteLength });

}

}

for (let chunk of chunks) {

chunk.data = new Uint8Array(chunk.size);

for (let section of this._sections) {

if (chunk.start <= section.start && section.start < chunk.start + chunk.size) {

chunk.data.set(section.data, section.start - chunk.start);

}

}

if (this._chunked) {

this._writeDataIntoChunks(chunk.data, chunk.start);

this._flushChunks();

} else {

this._target.options.onData?.(chunk.data, chunk.start);

}

}

this._sections.length = 0;

}

finalize() {

if (this._chunked) this._flushChunks(true);

}

_writeDataIntoChunks(data, position) {

let chunkIndex = this._chunks.findIndex((x) => x.start <= position && position < x.start + this._chunkSize);

if (chunkIndex === -1) chunkIndex = this._createChunk(position);

let chunk = this._chunks[chunkIndex];

let relativePosition = position - chunk.start;

let toWrite = data.subarray(0, Math.min(this._chunkSize - relativePosition, data.byteLength));

chunk.data.set(toWrite, relativePosition);

let section = { start: relativePosition, end: relativePosition + toWrite.byteLength };

this._insertSectionIntoChunk(chunk, section);

if (chunk.written[0].start === 0 && chunk.written[0].end === this._chunkSize) {

chunk.shouldFlush = true;

}

if (this._chunks.length > MAX_CHUNKS_AT_ONCE) {

for (let i = 0; i < this._chunks.length - 1; i++) this._chunks[i].shouldFlush = true;

this._flushChunks();

}

if (toWrite.byteLength < data.byteLength) {

this._writeDataIntoChunks(data.subarray(toWrite.byteLength), position + toWrite.byteLength);

}

}

_insertSectionIntoChunk(chunk, section) {

let low = 0, high = chunk.written.length - 1, index = -1;

while (low <= high) {

let mid = Math.floor(low + (high - low + 1) / 2);

if (chunk.written[mid].start <= section.start) { low = mid + 1; index = mid; }

else { high = mid - 1; }

}

chunk.written.splice(index + 1, 0, section);

if (index === -1 || chunk.written[index].end < section.start) index++;

while (index < chunk.written.length - 1 && chunk.written[index].end >= chunk.written[index + 1].start) {

chunk.written[index].end = Math.max(chunk.written[index].end, chunk.written[index + 1].end);

chunk.written.splice(index + 1, 1);

}

}

_createChunk(includesPosition) {

let start = Math.floor(includesPosition / this._chunkSize) * this._chunkSize;

let chunk = { start, data: new Uint8Array(this._chunkSize), written: [], shouldFlush: false };

this._chunks.push(chunk);

this._chunks.sort((a, b) => a.start - b.start);

return this._chunks.indexOf(chunk);

}

_flushChunks(force = false) {

for (let i = 0; i < this._chunks.length; i++) {

let chunk = this._chunks[i];

if (!chunk.shouldFlush && !force) continue;

for (let section of chunk.written) {

this._target.options.onData?.(chunk.data.subarray(section.start, section.end), chunk.start + section.start);

}

this._chunks.splice(i--, 1);

}

}

}



class FileSystemWritableFileStreamTargetWriter extends StreamTargetWriter {

constructor(target) {

super(new StreamTarget({

onData: (data, position) => {

if (target.stream && typeof target.stream.write === 'function') {

target.stream.write({ type: "write", data, position }).catch(() => {});

}

},

chunked: true,

chunkSize: target.options?.chunkSize

}));

}

}



const GLOBAL_TIMESCALE = 1e3;

const SUPPORTED_VIDEO_CODECS = ["avc", "hevc", "vp9", "av1"];

const SUPPORTED_AUDIO_CODECS = ["aac", "opus"];

const TIMESTAMP_OFFSET = 2082844800;



class Muxer {

constructor(options) {

if (typeof options !== "object" || !(options.target instanceof Target)) throw new TypeError();

options.video = deepClone(options.video);

options.audio = deepClone(options.audio);

options.fastStart = deepClone(options.fastStart);

this.target = options.target;

this._options = { firstTimestampBehavior: "strict", ...options };


if (options.target instanceof ArrayBufferTarget) {

this._writer = new ArrayBufferTargetWriter(options.target);

} else if (options.target instanceof StreamTarget) {

this._writer = new StreamTargetWriter(options.target);

} else if (options.target && options.target.stream) {

this._writer = new FileSystemWritableFileStreamTargetWriter(options.target);

} else {

throw new Error();

}

this._ftypSize = undefined;

this._mdat = undefined;

this._videoTrack = null;

this._audioTrack = null;

this._creationTime = Math.floor(Date.now() / 1e3) + TIMESTAMP_OFFSET;

this._finalizedChunks = [];

this._nextFragmentNumber = 1;

this._videoSampleQueue = [];

this._audioSampleQueue = [];

this._finalized = false;



this._prepareTracks();

this._writeHeader();

}



addVideoChunk(sample, meta, timestamp, compositionTimeOffset) {

if (!sample) return;

let data = new Uint8Array(sample.byteLength);

if (typeof sample.copyTo === "function") sample.copyTo(data);

else if (sample.buffer) data.set(new Uint8Array(sample.buffer, sample.byteOffset, sample.byteLength));

else data.set(sample);

this.addVideoChunkRaw(data, sample.type, timestamp ?? sample.timestamp, sample.duration, meta, compositionTimeOffset);

}



addVideoChunkRaw(data, type, timestamp, duration, meta, compositionTimeOffset) {

if (this._finalized) throw new Error();

let videoSample = this._createSampleForTrack(this._videoTrack, data, type, timestamp, duration, meta, compositionTimeOffset);

if (this._options.fastStart === "fragmented" && this._audioTrack) {

while (this._audioSampleQueue.length > 0 && this._audioSampleQueue[0].decodeTimestamp <= videoSample.decodeTimestamp) {

let audioSample = this._audioSampleQueue.shift();

this._addSampleToTrack(this._audioTrack, audioSample);

}

if (videoSample.decodeTimestamp <= this._audioTrack.lastDecodeTimestamp) {

this._addSampleToTrack(this._videoTrack, videoSample);

} else {

this._videoSampleQueue.push(videoSample);

}

} else {

this._addSampleToTrack(this._videoTrack, videoSample);

}

}



addAudioChunk(sample, meta, timestamp) {

if (!sample) return;

let data = new Uint8Array(sample.byteLength);

if (typeof sample.copyTo === "function") sample.copyTo(data);

else if (sample.buffer) data.set(new Uint8Array(sample.buffer, sample.byteOffset, sample.byteLength));

else data.set(sample);

this.addAudioChunkRaw(data, sample.type, timestamp ?? sample.timestamp, sample.duration, meta);

}



addAudioChunkRaw(data, type, timestamp, duration, meta) {

if (this._finalized) throw new Error();

let audioSample = this._createSampleForTrack(this._audioTrack, data, type, timestamp, duration, meta);

if (this._options.fastStart === "fragmented" && this._videoTrack) {

while (this._videoSampleQueue.length > 0 && this._videoSampleQueue[0].decodeTimestamp <= audioSample.decodeTimestamp) {

let videoSample = this._videoSampleQueue.shift();

this._addSampleToTrack(this._videoTrack, videoSample);

}

if (audioSample.decodeTimestamp <= this._videoTrack.lastDecodeTimestamp) {

this._addSampleToTrack(this._audioTrack, audioSample);

} else {

this._audioSampleQueue.push(audioSample);

}

} else {

this._addSampleToTrack(this._audioTrack, audioSample);

}

}



finalize() {

if (this._finalized) throw new Error();

if (this._options.fastStart === "fragmented") {

for (let videoSample of this._videoSampleQueue) this._addSampleToTrack(this._videoTrack, videoSample);

for (let audioSample of this._audioSampleQueue) this._addSampleToTrack(this._audioTrack, audioSample);

this._finalizeFragment(false);

} else {

if (this._videoTrack) this._finalizeCurrentChunk(this._videoTrack);

if (this._audioTrack) this._finalizeCurrentChunk(this._audioTrack);

}

let tracks = [this._videoTrack, this._audioTrack].filter(Boolean);

if (this._options.fastStart === "in-memory") {

let mdatSize;

for (let i = 0; i < 2; i++) {

let movieBox2 = moov(tracks, this._creationTime);

let movieBoxSize = this._writer.measureBox(movieBox2);

mdatSize = this._writer.measureBox(this._mdat);

let currentChunkPos = this._writer.pos + movieBoxSize + mdatSize;

for (let chunk of this._finalizedChunks) {

chunk.offset = currentChunkPos;

for (let { data } of chunk.samples) {

currentChunkPos += data.byteLength;

mdatSize += data.byteLength;

}

}

if (currentChunkPos < 4294967296) break;

if (mdatSize >= 4294967296) this._mdat.largeSize = true;

}

let movieBox = moov(tracks, this._creationTime);

this._writer.writeBox(movieBox);

this._mdat.size = mdatSize;

this._writer.writeBox(this._mdat);

for (let chunk of this._finalizedChunks) {

for (let sample of chunk.samples) {

if (sample.data) {

this._writer.write(sample.data);

sample.data = null;

}

}

}

} else if (this._options.fastStart === "fragmented") {

let startPos = this._writer.pos;

let mfraBox = mfra(tracks);

this._writer.writeBox(mfraBox);

let mfraBoxSize = this._writer.pos - startPos;

this._writer.seek(this._writer.pos - 4);

this._writer.writeU32(mfraBoxSize);

} else {

let mdatPos = this._writer.offsets.get(this._mdat);

let mdatSize = this._writer.pos - mdatPos;

this._mdat.size = mdatSize;

this._mdat.largeSize = mdatSize >= 4294967296;

this._writer.patchBox(this._mdat);

let movieBox = moov(tracks, this._creationTime);

if (typeof this._options.fastStart === "object") {

this._writer.seek(this._ftypSize);

this._writer.writeBox(movieBox);

let remainingBytes = mdatPos - this._writer.pos;

if (remainingBytes > 0) this._writer.writeBox(free(remainingBytes));

} else {

this._writer.writeBox(movieBox);

}

}

this._maybeFlushStreamingTargetWriter();

this._writer.finalize();

this._finalized = true;

}



_writeHeader() {

this._writer.writeBox(ftyp({

holdsAvc: this._options.video?.codec === "avc",

fragmented: this._options.fastStart === "fragmented"

}));

this._ftypSize = this._writer.pos;

if (this._options.fastStart === "in-memory") {

this._mdat = mdat(false);

} else if (this._options.fastStart === "fragmented") {

} else {

if (typeof this._options.fastStart === "object") {

let moovSizeUpperBound = this._computeMoovSizeUpperBound();

this._writer.seek(this._writer.pos + moovSizeUpperBound);

}

this._mdat = mdat(true);

this._writer.writeBox(this._mdat);

}

this._maybeFlushStreamingTargetWriter();

}



_computeMoovSizeUpperBound() {

if (typeof this._options.fastStart !== "object") return;

let upperBound = 0;

let sampleCounts = [

this._options.fastStart.expectedVideoChunks,

this._options.fastStart.expectedAudioChunks

];

for (let n of sampleCounts) {

if (!n) continue;

upperBound += 8 * Math.ceil(2 / 3 * n) + 4 * n + 12 * Math.ceil(2 / 3 * n) + 4 * n + 8 * n;

}

upperBound += 4096;

return upperBound;

}



_prepareTracks() {

if (this._options.video) {

this._videoTrack = {

id: 1,

info: {

type: "video",

codec: this._options.video.codec,

width: this._options.video.width,

height: this._options.video.height,

rotation: this._options.video.rotation ?? 0,

decoderConfig: null

},

timescale: this._options.video.frameRate ?? 90000,

samples: [], finalizedChunks: [], currentChunk: null,

firstDecodeTimestamp: void 0, lastDecodeTimestamp: -1,

timeToSampleTable: [], compositionTimeOffsetTable: [],

lastTimescaleUnits: null, lastSample: null, compactlyCodedChunkTable: []

};

}

if (this._options.audio) {

this._audioTrack = {

id: this._options.video ? 2 : 1,

info: {

type: "audio",

codec: this._options.audio.codec,

numberOfChannels: this._options.audio.numberOfChannels,

sampleRate: this._options.audio.sampleRate,

decoderConfig: null

},

timescale: this._options.audio.sampleRate,

samples: [], finalizedChunks: [], currentChunk: null,

firstDecodeTimestamp: void 0, lastDecodeTimestamp: -1,

timeToSampleTable: [], compositionTimeOffsetTable: [],

lastTimescaleUnits: null, lastSample: null, compactlyCodedChunkTable: []

};

if (this._options.audio.codec === "aac") {

let guessedCodecPrivate = this._generateMpeg4AudioSpecificConfig(2, this._options.audio.sampleRate, this._options.audio.numberOfChannels);

this._audioTrack.info.decoderConfig = {

codec: this._options.audio.codec,

description: guessedCodecPrivate,

numberOfChannels: this._options.audio.numberOfChannels,

sampleRate: this._options.audio.sampleRate

};

}

}

}



_generateMpeg4AudioSpecificConfig(objectType, sampleRate, numberOfChannels) {

let frequencyIndices = [96e3, 88200, 64e3, 48e3, 44100, 32e3, 24e3, 22050, 16e3, 12e3, 11025, 8e3, 7350];

let frequencyIndex = frequencyIndices.indexOf(sampleRate);

if (frequencyIndex === -1) frequencyIndex = 4;

let channelConfig = numberOfChannels;

let configBits = "";

configBits += objectType.toString(2).padStart(5, "0");

configBits += frequencyIndex.toString(2).padStart(4, "0");

if (frequencyIndex === 15) configBits += sampleRate.toString(2).padStart(24, "0");

configBits += channelConfig.toString(2).padStart(4, "0");

let paddingLength = Math.ceil(configBits.length / 8) * 8;

configBits = configBits.padEnd(paddingLength, "0");

let configBytes = new Uint8Array(configBits.length / 8);

for (let i = 0; i < configBits.length; i += 8) {

configBytes[i / 8] = parseInt(configBits.slice(i, i + 8), 2);

}

return configBytes;

}



_createSampleForTrack(track, data, type, timestamp, duration, meta, compositionTimeOffset) {

let presentationTimestampInSeconds = timestamp / 1e6;

let decodeTimestampInSeconds = (timestamp - (compositionTimeOffset ?? 0)) / 1e6;

let durationInSeconds = duration / 1e6;

let adjusted = this._validateTimestamp(presentationTimestampInSeconds, decodeTimestampInSeconds, track);

presentationTimestampInSeconds = adjusted.presentationTimestamp;

decodeTimestampInSeconds = adjusted.decodeTimestamp;

if (meta?.decoderConfig) {

if (track.info.decoderConfig === null) {

track.info.decoderConfig = meta.decoderConfig;

} else {

if (meta.decoderConfig.description) track.info.decoderConfig.description = meta.decoderConfig.description;

Object.assign(track.info.decoderConfig, meta.decoderConfig);

}

}

return {

presentationTimestamp: presentationTimestampInSeconds,

decodeTimestamp: decodeTimestampInSeconds,

duration: durationInSeconds,

data, size: data.byteLength, type,

timescaleUnitsToNextSample: intoTimescale(durationInSeconds, track.timescale)

};

}



_addSampleToTrack(track, sample) {

if (this._options.fastStart !== "fragmented") track.samples.push(sample);

const sampleCompositionTimeOffset = intoTimescale(sample.presentationTimestamp - sample.decodeTimestamp, track.timescale);

if (track.lastTimescaleUnits !== null) {

let timescaleUnits = intoTimescale(sample.decodeTimestamp, track.timescale, false);

let delta = Math.round(timescaleUnits - track.lastTimescaleUnits);

track.lastTimescaleUnits += delta;

track.lastSample.timescaleUnitsToNextSample = delta;

if (this._options.fastStart !== "fragmented") {

let lastTableEntry = last(track.timeToSampleTable);

if (lastTableEntry.sampleCount === 1) {

lastTableEntry.sampleDelta = delta;

lastTableEntry.sampleCount++;

} else if (lastTableEntry.sampleDelta === delta) {

lastTableEntry.sampleCount++;

} else {

lastTableEntry.sampleCount--;

track.timeToSampleTable.push({ sampleCount: 2, sampleDelta: delta });

}

const lastCompositionTimeOffsetTableEntry = last(track.compositionTimeOffsetTable);

if (lastCompositionTimeOffsetTableEntry.sampleCompositionTimeOffset === sampleCompositionTimeOffset) {

lastCompositionTimeOffsetTableEntry.sampleCount++;

} else {

track.compositionTimeOffsetTable.push({ sampleCount: 1, sampleCompositionTimeOffset });

}

}

} else {

track.lastTimescaleUnits = 0;

if (this._options.fastStart !== "fragmented") {

track.timeToSampleTable.push({ sampleCount: 1, sampleDelta: intoTimescale(sample.duration, track.timescale) });

track.compositionTimeOffsetTable.push({ sampleCount: 1, sampleCompositionTimeOffset });

}

}

track.lastSample = sample;

let beginNewChunk = false;

if (!track.currentChunk) {

beginNewChunk = true;

} else {

let currentChunkDuration = sample.presentationTimestamp - track.currentChunk.startTimestamp;

if (this._options.fastStart === "fragmented") {

let mostImportantTrack = this._videoTrack ?? this._audioTrack;

const chunkDuration = this._options.minFragmentDuration ?? 1;

if (track === mostImportantTrack && sample.type === "key" && currentChunkDuration >= chunkDuration) {

beginNewChunk = true;

this._finalizeFragment();

}

} else {

beginNewChunk = currentChunkDuration >= 0.5;

}

}

if (beginNewChunk) {

if (track.currentChunk) this._finalizeCurrentChunk(track);

track.currentChunk = { startTimestamp: sample.presentationTimestamp, samples: [] };

}

track.currentChunk.samples.push(sample);

}



_validateTimestamp(presentationTimestamp, decodeTimestamp, track) {

const strictTimestampBehavior = this._options.firstTimestampBehavior === "strict";

const noLastDecodeTimestamp = track.lastDecodeTimestamp === -1;

const timestampNonZero = decodeTimestamp !== 0;

if (strictTimestampBehavior && noLastDecodeTimestamp && timestampNonZero) {

decodeTimestamp = 0;

presentationTimestamp = 0;

}

if (this._options.firstTimestampBehavior === "offset" || this._options.firstTimestampBehavior === "cross-track-offset") {

if (track.firstDecodeTimestamp === void 0) track.firstDecodeTimestamp = decodeTimestamp;

let baseDecodeTimestamp;

if (this._options.firstTimestampBehavior === "offset") {

baseDecodeTimestamp = track.firstDecodeTimestamp;

} else {

baseDecodeTimestamp = Math.min(

this._videoTrack?.firstDecodeTimestamp ?? Infinity,

this._audioTrack?.firstDecodeTimestamp ?? Infinity

);

}

decodeTimestamp -= baseDecodeTimestamp;

presentationTimestamp -= baseDecodeTimestamp;

}

if (decodeTimestamp < track.lastDecodeTimestamp) {

decodeTimestamp = track.lastDecodeTimestamp + 1e-6;

}

track.lastDecodeTimestamp = decodeTimestamp;

return { presentationTimestamp, decodeTimestamp };

}



_finalizeCurrentChunk(track) {

if (!track.currentChunk) return;

track.finalizedChunks.push(track.currentChunk);

this._finalizedChunks.push(track.currentChunk);

if (track.compactlyCodedChunkTable.length === 0 || last(track.compactlyCodedChunkTable).samplesPerChunk !== track.currentChunk.samples.length) {

track.compactlyCodedChunkTable.push({

firstChunk: track.finalizedChunks.length,

samplesPerChunk: track.currentChunk.samples.length

});

}

if (this._options.fastStart === "in-memory") {

track.currentChunk.offset = 0;

return;

}

track.currentChunk.offset = this._writer.pos;

for (let sample of track.currentChunk.samples) {

this._writer.write(sample.data);

sample.data = null;

}

this._maybeFlushStreamingTargetWriter();

}



_finalizeFragment(flushStreamingWriter = true) {

let tracks = [this._videoTrack, this._audioTrack].filter((track) => track && track.currentChunk);

if (tracks.length === 0) return;

let fragmentNumber = this._nextFragmentNumber++;

if (fragmentNumber === 1) {

let movieBox = moov(tracks, this._creationTime, true);

this._writer.writeBox(movieBox);

}

let moofOffset = this._writer.pos;

let moofBox = moof(fragmentNumber, tracks);

this._writer.writeBox(moofBox);

{

let mdatBox = mdat(false);

let totalTrackSampleSize = 0;

for (let track of tracks) {

for (let sample of track.currentChunk.samples) totalTrackSampleSize += sample.size;

}

let mdatSize = this._writer.measureBox(mdatBox) + totalTrackSampleSize;

if (mdatSize >= 4294967296) {

mdatBox.largeSize = true;

mdatSize = this._writer.measureBox(mdatBox) + totalTrackSampleSize;

}

mdatBox.size = mdatSize;

this._writer.writeBox(mdatBox);

}

for (let track of tracks) {

track.currentChunk.offset = this._writer.pos;

track.currentChunk.moofOffset = moofOffset;

for (let sample of track.currentChunk.samples) {

this._writer.write(sample.data);

sample.data = null;

}

}

let endPos = this._writer.pos;

this._writer.seek(this._writer.offsets.get(moofBox));

let newMoofBox = moof(fragmentNumber, tracks);

this._writer.writeBox(newMoofBox);

this._writer.seek(endPos);

for (let track of tracks) {

track.finalizedChunks.push(track.currentChunk);

this._finalizedChunks.push(track.currentChunk);

track.currentChunk = null;

}

if (flushStreamingWriter) this._maybeFlushStreamingTargetWriter();

}



_maybeFlushStreamingTargetWriter() {

if (this._writer instanceof StreamTargetWriter) this._writer.flush();

}

}



return { ArrayBufferTarget, StreamTarget, FileSystemWritableFileStreamTarget, Muxer };

})();



if (typeof module !== "undefined" && typeof module.exports === "object") {

module.exports = UniMuxer;

} else if (typeof window !== "undefined") {

window.UniMuxer = UniMuxer;

}