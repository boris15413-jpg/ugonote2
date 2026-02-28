"use strict";
const UniMuxer = (() => {
  const bytes = new Uint8Array(8),
    view = new DataView(bytes.buffer),
    u8 = (value) => [((value % 256) + 256) % 256],
    u16 = (value) => (view.setUint16(0, value, !1), [bytes[0], bytes[1]]),
    u24 = (value) => (
      view.setUint32(0, value, !1),
      [bytes[1], bytes[2], bytes[3]]
    ),
    u32 = (value) => (
      view.setUint32(0, value, !1),
      [bytes[0], bytes[1], bytes[2], bytes[3]]
    ),
    i32 = (value) => (
      view.setInt32(0, value, !1),
      [bytes[0], bytes[1], bytes[2], bytes[3]]
    ),
    u64 = (value) => (
      view.setUint32(0, Math.floor(value / 4294967296), !1),
      view.setUint32(4, value, !1),
      [
        bytes[0],
        bytes[1],
        bytes[2],
        bytes[3],
        bytes[4],
        bytes[5],
        bytes[6],
        bytes[7],
      ]
    ),
    fixed_8_8 = (value) => (
      view.setInt16(0, Math.round(256 * value), !1),
      [bytes[0], bytes[1]]
    ),
    fixed_16_16 = (value) => (
      view.setInt32(0, Math.round(65536 * value), !1),
      [bytes[0], bytes[1], bytes[2], bytes[3]]
    ),
    fixed_2_30 = (value) => (
      view.setInt32(0, Math.round(1073741824 * value), !1),
      [bytes[0], bytes[1], bytes[2], bytes[3]]
    ),
    ascii = (text, nullTerminated = !1) => {
      let b = Array(text.length)
        .fill(null)
        .map((_, i) => text.charCodeAt(i));
      return (nullTerminated && b.push(0), b);
    },
    last = (arr) => arr && arr[arr.length - 1],
    lastPresentedSample = (samples) => {
      let r;
      for (let s of samples)
        (!r || s.presentationTimestamp > r.presentationTimestamp) && (r = s);
      return r;
    },
    intoTimescale = (timeInSeconds, timescale, round = !0) => {
      let v = timeInSeconds * timescale;
      return round ? Math.round(v) : v;
    },
    rotationMatrix = (rotationInDegrees) => {
      let theta = rotationInDegrees * (Math.PI / 180),
        cosTheta = Math.cos(theta),
        sinTheta = Math.sin(theta);
      return [cosTheta, sinTheta, 0, -sinTheta, cosTheta, 0, 0, 0, 1];
    },
    IDENTITY_MATRIX = rotationMatrix(0),
    matrixToBytes = (matrix) => [
      fixed_16_16(matrix[0]),
      fixed_16_16(matrix[1]),
      fixed_2_30(matrix[2]),
      fixed_16_16(matrix[3]),
      fixed_16_16(matrix[4]),
      fixed_2_30(matrix[5]),
      fixed_16_16(matrix[6]),
      fixed_16_16(matrix[7]),
      fixed_2_30(matrix[8]),
    ],
    deepClone = (x) =>
      x
        ? "object" != typeof x
          ? x
          : Array.isArray(x)
            ? x.map(deepClone)
            : Object.fromEntries(
                Object.entries(x).map(([k, v]) => [k, deepClone(v)]),
              )
        : x,
    isU32 = (value) => value >= 0 && value < 4294967296,
    box = (type, contents, children) => ({
      type: type,
      contents: contents && new Uint8Array(contents.flat(10)),
      children: children,
    }),
    fullBox = (type, version, flags, contents, children) =>
      box(type, [u8(version), u24(flags), contents ?? []], children),
    mdat = (reserveLargeSize) => ({
      type: "mdat",
      largeSize: reserveLargeSize,
    }),
    moov = (tracks, creationTime, fragmented = !1) =>
      box("moov", null, [
        mvhd(creationTime, tracks),
        ...tracks.map((x) => trak(x, creationTime)),
        fragmented ? mvex(tracks) : null,
      ]),
    mvhd = (creationTime, tracks) => {
      let duration = intoTimescale(
          Math.max(
            0,
            ...tracks
              .filter((x) => x.samples.length > 0)
              .map((x) => {
                const ls = lastPresentedSample(x.samples);
                return ls.presentationTimestamp + ls.duration;
              }),
          ),
          GLOBAL_TIMESCALE,
        ),
        nextTrackId = Math.max(...tracks.map((x) => x.id)) + 1,
        needsU64 = !isU32(creationTime) || !isU32(duration),
        u32OrU64 = needsU64 ? u64 : u32;
      return fullBox("mvhd", +needsU64, 0, [
        u32OrU64(creationTime),
        u32OrU64(creationTime),
        u32(GLOBAL_TIMESCALE),
        u32OrU64(duration),
        fixed_16_16(1),
        fixed_8_8(1),
        Array(10).fill(0),
        matrixToBytes(IDENTITY_MATRIX),
        Array(24).fill(0),
        u32(nextTrackId),
      ]);
    },
    trak = (track, creationTime) =>
      box("trak", null, [tkhd(track, creationTime), mdia(track, creationTime)]),
    tkhd = (track, creationTime) => {
      let matrix,
        ls = lastPresentedSample(track.samples),
        durationInGlobalTimescale = intoTimescale(
          ls ? ls.presentationTimestamp + ls.duration : 0,
          GLOBAL_TIMESCALE,
        ),
        needsU64 = !isU32(creationTime) || !isU32(durationInGlobalTimescale),
        u32OrU64 = needsU64 ? u64 : u32;
      return (
        (matrix =
          "video" === track.info.type
            ? "number" == typeof track.info.rotation
              ? rotationMatrix(track.info.rotation)
              : track.info.rotation
            : IDENTITY_MATRIX),
        fullBox("tkhd", +needsU64, 3, [
          u32OrU64(creationTime),
          u32OrU64(creationTime),
          u32(track.id),
          u32(0),
          u32OrU64(durationInGlobalTimescale),
          Array(8).fill(0),
          u16(0),
          u16(0),
          fixed_8_8("audio" === track.info.type ? 1 : 0),
          u16(0),
          matrixToBytes(matrix),
          fixed_16_16("video" === track.info.type ? track.info.width : 0),
          fixed_16_16("video" === track.info.type ? track.info.height : 0),
        ])
      );
    },
    mdia = (track, creationTime) =>
      box("mdia", null, [
        mdhd(track, creationTime),
        hdlr("video" === track.info.type ? "vide" : "soun"),
        minf(track),
      ]),
    mdhd = (track, creationTime) => {
      let ls = lastPresentedSample(track.samples),
        localDuration = intoTimescale(
          ls ? ls.presentationTimestamp + ls.duration : 0,
          track.timescale,
        ),
        needsU64 = !isU32(creationTime) || !isU32(localDuration),
        u32OrU64 = needsU64 ? u64 : u32;
      return fullBox("mdhd", +needsU64, 0, [
        u32OrU64(creationTime),
        u32OrU64(creationTime),
        u32(track.timescale),
        u32OrU64(localDuration),
        u16(21956),
        u16(0),
      ]);
    },
    hdlr = (componentSubtype) =>
      fullBox("hdlr", 0, 0, [
        ascii("mhlr"),
        ascii(componentSubtype),
        u32(0),
        u32(0),
        u32(0),
        ascii("unimuxer-hdlr", !0),
      ]),
    minf = (track) =>
      box("minf", null, [
        "video" === track.info.type ? vmhd() : smhd(),
        dinf(),
        stbl(track),
      ]),
    vmhd = () => fullBox("vmhd", 0, 1, [u16(0), u16(0), u16(0), u16(0)]),
    smhd = () => fullBox("smhd", 0, 0, [u16(0), u16(0)]),
    dinf = () => box("dinf", null, [dref()]),
    dref = () => fullBox("dref", 0, 0, [u32(1)], [url()]),
    url = () => fullBox("url ", 0, 1),
    stbl = (track) => {
      const needsCtts =
        track.compositionTimeOffsetTable.length > 1 ||
        track.compositionTimeOffsetTable.some(
          (x) => 0 !== x.sampleCompositionTimeOffset,
        );
      return box("stbl", null, [
        stsd(track),
        stts(track),
        stss(track),
        stsc(track),
        stsz(track),
        stco(track),
        needsCtts ? ctts(track) : null,
      ]);
    },
    stsd = (track) =>
      fullBox(
        "stsd",
        0,
        0,
        [u32(1)],
        [
          "video" === track.info.type
            ? videoSampleDescription(
                VIDEO_CODEC_TO_BOX_NAME[track.info.codec],
                track,
              )
            : soundSampleDescription(
                AUDIO_CODEC_TO_BOX_NAME[track.info.codec],
                track,
              ),
        ],
      ),
    videoSampleDescription = (compressionType, track) => {
      return box(
        compressionType,
        [
          Array(6).fill(0),
          u16(1),
          u16(0),
          u16(0),
          Array(12).fill(0),
          u16(track.info.width),
          u16(track.info.height),
          u32(4718592),
          u32(4718592),
          u32(0),
          u16(1),
          Array(32).fill(0),
          u16(24),
          ((value = 65535), view.setInt16(0, value, !1), [bytes[0], bytes[1]]),
        ],
        [
          VIDEO_CODEC_TO_CONFIGURATION_BOX[track.info.codec](track),
          track.info.decoderConfig?.colorSpace ? colr(track) : null,
        ],
      );
      var value;
    },
    COLOR_PRIMARIES_MAP = { bt709: 1, bt470bg: 5, smpte170m: 6 },
    TRANSFER_CHARACTERISTICS_MAP = {
      bt709: 1,
      smpte170m: 6,
      "iec61966-2-1": 13,
    },
    MATRIX_COEFFICIENTS_MAP = { rgb: 0, bt709: 1, bt470bg: 5, smpte170m: 6 },
    colr = (track) =>
      box("colr", [
        ascii("nclx"),
        u16(
          COLOR_PRIMARIES_MAP[track.info.decoderConfig.colorSpace.primaries] ||
            2,
        ),
        u16(
          TRANSFER_CHARACTERISTICS_MAP[
            track.info.decoderConfig.colorSpace.transfer
          ] || 2,
        ),
        u16(
          MATRIX_COEFFICIENTS_MAP[track.info.decoderConfig.colorSpace.matrix] ||
            2,
        ),
        u8((track.info.decoderConfig.colorSpace.fullRange ? 1 : 0) << 7),
      ]),
    soundSampleDescription = (compressionType, track) =>
      box(
        compressionType,
        [
          Array(6).fill(0),
          u16(1),
          u16(0),
          u16(0),
          u32(0),
          u16(track.info.numberOfChannels),
          u16(16),
          u16(0),
          u16(0),
          fixed_16_16(track.info.sampleRate),
        ],
        [AUDIO_CODEC_TO_CONFIGURATION_BOX[track.info.codec](track)],
      ),
    stts = (track) =>
      fullBox("stts", 0, 0, [
        u32(track.timeToSampleTable.length),
        track.timeToSampleTable.map((x) => [
          u32(x.sampleCount),
          u32(x.sampleDelta),
        ]),
      ]),
    stss = (track) => {
      if (track.samples.every((x) => "key" === x.type)) return null;
      let keySamples = [...track.samples.entries()].filter(
        ([, sample]) => "key" === sample.type,
      );
      return fullBox("stss", 0, 0, [
        u32(keySamples.length),
        keySamples.map(([index]) => u32(index + 1)),
      ]);
    },
    stsc = (track) =>
      fullBox("stsc", 0, 0, [
        u32(track.compactlyCodedChunkTable.length),
        track.compactlyCodedChunkTable.map((x) => [
          u32(x.firstChunk),
          u32(x.samplesPerChunk),
          u32(1),
        ]),
      ]),
    stsz = (track) =>
      fullBox("stsz", 0, 0, [
        u32(0),
        u32(track.samples.length),
        track.samples.map((x) => u32(x.size)),
      ]),
    stco = (track) =>
      track.finalizedChunks.length > 0 &&
      last(track.finalizedChunks).offset >= 4294967296
        ? fullBox("co64", 0, 0, [
            u32(track.finalizedChunks.length),
            track.finalizedChunks.map((x) => u64(x.offset)),
          ])
        : fullBox("stco", 0, 0, [
            u32(track.finalizedChunks.length),
            track.finalizedChunks.map((x) => u32(x.offset)),
          ]),
    ctts = (track) => {
      let hasNegative = track.compositionTimeOffsetTable.some(
        (x) => x.sampleCompositionTimeOffset < 0,
      );
      return fullBox("ctts", hasNegative ? 1 : 0, 0, [
        u32(track.compositionTimeOffsetTable.length),
        track.compositionTimeOffsetTable.map((x) => [
          u32(x.sampleCount),
          hasNegative
            ? i32(x.sampleCompositionTimeOffset)
            : u32(x.sampleCompositionTimeOffset),
        ]),
      ]);
    },
    mvex = (tracks) => box("mvex", null, tracks.map(trex)),
    trex = (track) =>
      fullBox("trex", 0, 0, [u32(track.id), u32(1), u32(0), u32(0), u32(0)]),
    moof = (sequenceNumber, tracks) =>
      box("moof", null, [mfhd(sequenceNumber), ...tracks.map(traf)]),
    mfhd = (sequenceNumber) => fullBox("mfhd", 0, 0, [u32(sequenceNumber)]),
    fragmentSampleFlags = (sample) => {
      let byte1 = 0,
        byte2 = 0,
        isDelta = "delta" === sample.type;
      return (
        (byte2 |= +isDelta),
        (byte1 |= isDelta ? 1 : 2),
        (byte1 << 24) | (byte2 << 16)
      );
    },
    traf = (track) =>
      box("traf", null, [tfhd(track), tfdt(track), trun(track)]),
    tfhd = (track) => {
      let referenceSample =
          track.currentChunk.samples[1] ?? track.currentChunk.samples[0],
        referenceSampleInfo = {
          duration: referenceSample
            ? referenceSample.timescaleUnitsToNextSample
            : 0,
          size: referenceSample ? referenceSample.size : 0,
          flags: referenceSample ? fragmentSampleFlags(referenceSample) : 0,
        };
      return fullBox("tfhd", 0, 131128, [
        u32(track.id),
        u32(referenceSampleInfo.duration),
        u32(referenceSampleInfo.size),
        u32(referenceSampleInfo.flags),
      ]);
    },
    tfdt = (track) =>
      fullBox("tfdt", 1, 0, [
        u64(intoTimescale(track.currentChunk.startTimestamp, track.timescale)),
      ]),
    trun = (track) => {
      let allDurations = track.currentChunk.samples.map(
          (x) => x.timescaleUnitsToNextSample,
        ),
        allSizes = track.currentChunk.samples.map((x) => x.size),
        allFlags = track.currentChunk.samples.map(fragmentSampleFlags),
        allOffsets = track.currentChunk.samples.map((x) =>
          intoTimescale(
            x.presentationTimestamp - x.decodeTimestamp,
            track.timescale,
          ),
        ),
        uniqueDurations = new Set(allDurations),
        uniqueSizes = new Set(allSizes),
        uniqueFlags = new Set(allFlags),
        uniqueOffsets = new Set(allOffsets),
        firstSampleFlagsPresent =
          2 === uniqueFlags.size && allFlags[0] !== allFlags[1],
        durationPresent = uniqueDurations.size > 1,
        sizePresent = uniqueSizes.size > 1,
        flagsPresent = !firstSampleFlagsPresent && uniqueFlags.size > 1,
        offsetsPresent =
          uniqueOffsets.size > 1 || [...uniqueOffsets].some((x) => 0 !== x),
        flags = 1;
      return (
        (flags |= 4 * +firstSampleFlagsPresent),
        (flags |= 256 * +durationPresent),
        (flags |= 512 * +sizePresent),
        (flags |= 1024 * +flagsPresent),
        (flags |= 2048 * +offsetsPresent),
        fullBox("trun", 1, flags, [
          u32(track.currentChunk.samples.length),
          u32(track.currentChunk.offset - track.currentChunk.moofOffset || 0),
          firstSampleFlagsPresent ? u32(allFlags[0]) : [],
          track.currentChunk.samples.map((_, i) => [
            durationPresent ? u32(allDurations[i]) : [],
            sizePresent ? u32(allSizes[i]) : [],
            flagsPresent ? u32(allFlags[i]) : [],
            offsetsPresent ? i32(allOffsets[i]) : [],
          ]),
        ])
      );
    },
    tfra = (track, trackIndex) =>
      fullBox("tfra", 1, 0, [
        u32(track.id),
        u32(63),
        u32(track.finalizedChunks.length),
        track.finalizedChunks.map((chunk) => [
          u64(intoTimescale(chunk.startTimestamp, track.timescale)),
          u64(chunk.moofOffset),
          u32(trackIndex + 1),
          u32(1),
          u32(1),
        ]),
      ]),
    mfro = () => fullBox("mfro", 0, 0, [u32(0)]),
    VIDEO_CODEC_TO_BOX_NAME = {
      avc: "avc1",
      hevc: "hvc1",
      vp9: "vp09",
      av1: "av01",
    },
    VIDEO_CODEC_TO_CONFIGURATION_BOX = {
      avc: (track) =>
        track.info.decoderConfig &&
        track.info.decoderConfig.description &&
        box("avcC", [...new Uint8Array(track.info.decoderConfig.description)]),
      hevc: (track) =>
        track.info.decoderConfig &&
        track.info.decoderConfig.description &&
        box("hvcC", [...new Uint8Array(track.info.decoderConfig.description)]),
      vp9: (track) => {
        if (!track.info.decoderConfig) return null;
        let decoderConfig = track.info.decoderConfig,
          colorSpace = decoderConfig.colorSpace || {},
          parts = decoderConfig.codec.split("."),
          profile = Number(parts[1]) || 0,
          level = Number(parts[2]) || 10,
          thirdByte =
            0 +
            ((Number(parts[3]) || 8) << 4) +
            Number(colorSpace.fullRange ? 1 : 0);
        return fullBox("vpcC", 1, 0, [
          u8(profile),
          u8(level),
          u8(thirdByte),
          u8(2),
          u8(2),
          u8(2),
          u16(0),
        ]);
      },
      av1: () => box("av1C", [129, 0, 0, 0]),
    },
    AUDIO_CODEC_TO_BOX_NAME = { aac: "mp4a", opus: "Opus" },
    AUDIO_CODEC_TO_CONFIGURATION_BOX = {
      aac: (track) => {
        let desc = new Uint8Array(track.info.decoderConfig.description || []);
        return fullBox("esds", 0, 0, [
          u32(58753152),
          u8(32 + desc.byteLength),
          u16(1),
          u8(0),
          u32(75530368),
          u8(18 + desc.byteLength),
          u8(64),
          u8(21),
          u24(0),
          u32(130071),
          u32(130071),
          u32(92307584),
          u8(desc.byteLength),
          ...desc,
          u32(109084800),
          u8(1),
          u8(2),
        ]);
      },
      opus: (track) => {
        let preskip = 3840,
          gain = 0;
        const desc = track.info.decoderConfig?.description;
        if (desc && desc.byteLength >= 18) {
          const view2 = ArrayBuffer.isView(desc)
            ? new DataView(desc.buffer, desc.byteOffset, desc.byteLength)
            : new DataView(desc);
          ((preskip = view2.getUint16(10, !0)),
            (gain = view2.getInt16(14, !0)));
        }
        return box("dOps", [
          u8(0),
          u8(track.info.numberOfChannels),
          u16(preskip),
          u32(track.info.sampleRate),
          fixed_8_8(gain),
          u8(0),
        ]);
      },
    };
  class Target {}
  class ArrayBufferTarget extends Target {
    constructor() {
      (super(), (this.buffer = null));
    }
  }
  class StreamTarget extends Target {
    constructor(options) {
      if ((super(), (this.options = options), "object" != typeof options))
        throw new TypeError();
      if (options.onData && "function" != typeof options.onData)
        throw new TypeError();
      if (void 0 !== options.chunked && "boolean" != typeof options.chunked)
        throw new TypeError();
      if (
        void 0 !== options.chunkSize &&
        (!Number.isInteger(options.chunkSize) || options.chunkSize < 1024)
      )
        throw new TypeError();
    }
  }
  class Writer {
    constructor() {
      ((this.pos = 0),
        (this._helper = new Uint8Array(8)),
        (this._helperView = new DataView(this._helper.buffer)),
        (this.offsets = new WeakMap()));
    }
    seek(newPos) {
      this.pos = newPos;
    }
    writeU32(value) {
      (this._helperView.setUint32(0, value, !1),
        this.write(this._helper.subarray(0, 4)));
    }
    writeU64(value) {
      (this._helperView.setUint32(0, Math.floor(value / 4294967296), !1),
        this._helperView.setUint32(4, value, !1),
        this.write(this._helper.subarray(0, 8)));
    }
    writeAscii(text) {
      for (let i = 0; i < text.length; i++)
        (this._helperView.setUint8(i % 8, text.charCodeAt(i)),
          i % 8 == 7 && this.write(this._helper));
      text.length % 8 != 0 &&
        this.write(this._helper.subarray(0, text.length % 8));
    }
    writeBox(b) {
      if ((this.offsets.set(b, this.pos), b.contents && !b.children))
        (this.writeBoxHeader(b, b.size ?? b.contents.byteLength + 8),
          this.write(b.contents));
      else {
        let startPos = this.pos;
        if (
          (this.writeBoxHeader(b, 0),
          b.contents && this.write(b.contents),
          b.children)
        )
          for (let child of b.children) child && this.writeBox(child);
        let endPos = this.pos,
          size = b.size ?? endPos - startPos;
        (this.seek(startPos), this.writeBoxHeader(b, size), this.seek(endPos));
      }
    }
    writeBoxHeader(b, size) {
      (this.writeU32(b.largeSize ? 1 : size),
        this.writeAscii(b.type),
        b.largeSize && this.writeU64(size));
    }
    measureBoxHeader(b) {
      return 8 + (b.largeSize ? 8 : 0);
    }
    patchBox(b) {
      let endPos = this.pos;
      (this.seek(this.offsets.get(b)), this.writeBox(b), this.seek(endPos));
    }
    measureBox(b) {
      if (b.contents && !b.children)
        return this.measureBoxHeader(b) + b.contents.byteLength;
      let result = this.measureBoxHeader(b);
      if ((b.contents && (result += b.contents.byteLength), b.children))
        for (let child of b.children)
          child && (result += this.measureBox(child));
      return result;
    }
  }
  class ArrayBufferTargetWriter extends Writer {
    constructor(target) {
      (super(),
        (this._target = target),
        (this._buffer = new ArrayBuffer(65536)),
        (this._bytes = new Uint8Array(this._buffer)),
        (this._maxPos = 0));
    }
    _ensureSize(size) {
      let newLength = this._buffer.byteLength;
      for (; newLength < size; )
        newLength < 10485760 ? (newLength *= 2) : (newLength += 10485760);
      if (newLength === this._buffer.byteLength) return;
      let newBuffer = new ArrayBuffer(newLength),
        newBytes = new Uint8Array(newBuffer);
      (newBytes.set(this._bytes, 0),
        (this._buffer = newBuffer),
        (this._bytes = newBytes));
    }
    write(data) {
      (this._ensureSize(this.pos + data.byteLength),
        this._bytes.set(data, this.pos),
        (this.pos += data.byteLength),
        (this._maxPos = Math.max(this._maxPos, this.pos)));
    }
    finalize() {
      (this._ensureSize(this.pos),
        (this._target.buffer = this._buffer.slice(
          0,
          Math.max(this._maxPos, this.pos),
        )));
    }
  }
  class StreamTargetWriter extends Writer {
    constructor(target) {
      (super(),
        (this._target = target),
        (this._sections = []),
        (this._chunked = target.options?.chunked ?? !1),
        (this._chunkSize = target.options?.chunkSize ?? 16777216),
        (this._chunks = []));
    }
    write(data) {
      (this._sections.push({ data: data.slice(), start: this.pos }),
        (this.pos += data.byteLength));
    }
    flush() {
      if (0 === this._sections.length) return;
      let chunks = [],
        sorted = [...this._sections].sort((a, b) => a.start - b.start);
      chunks.push({ start: sorted[0].start, size: sorted[0].data.byteLength });
      for (let i = 1; i < sorted.length; i++) {
        let lastChunk = chunks[chunks.length - 1],
          section = sorted[i];
        section.start <= lastChunk.start + lastChunk.size
          ? (lastChunk.size = Math.max(
              lastChunk.size,
              section.start + section.data.byteLength - lastChunk.start,
            ))
          : chunks.push({
              start: section.start,
              size: section.data.byteLength,
            });
      }
      for (let chunk of chunks) {
        chunk.data = new Uint8Array(chunk.size);
        for (let section of this._sections)
          chunk.start <= section.start &&
            section.start < chunk.start + chunk.size &&
            chunk.data.set(section.data, section.start - chunk.start);
        this._chunked
          ? (this._writeDataIntoChunks(chunk.data, chunk.start),
            this._flushChunks())
          : this._target.options.onData?.(chunk.data, chunk.start);
      }
      this._sections.length = 0;
    }
    finalize() {
      this._chunked && this._flushChunks(!0);
    }
    _writeDataIntoChunks(data, position) {
      let chunkIndex = this._chunks.findIndex(
        (x) => x.start <= position && position < x.start + this._chunkSize,
      );
      -1 === chunkIndex && (chunkIndex = this._createChunk(position));
      let chunk = this._chunks[chunkIndex],
        relativePosition = position - chunk.start,
        toWrite = data.subarray(
          0,
          Math.min(this._chunkSize - relativePosition, data.byteLength),
        );
      chunk.data.set(toWrite, relativePosition);
      let section = {
        start: relativePosition,
        end: relativePosition + toWrite.byteLength,
      };
      if (
        (this._insertSectionIntoChunk(chunk, section),
        0 === chunk.written[0].start &&
          chunk.written[0].end === this._chunkSize &&
          (chunk.shouldFlush = !0),
        this._chunks.length > 2)
      ) {
        for (let i = 0; i < this._chunks.length - 1; i++)
          this._chunks[i].shouldFlush = !0;
        this._flushChunks();
      }
      toWrite.byteLength < data.byteLength &&
        this._writeDataIntoChunks(
          data.subarray(toWrite.byteLength),
          position + toWrite.byteLength,
        );
    }
    _insertSectionIntoChunk(chunk, section) {
      let low = 0,
        high = chunk.written.length - 1,
        index = -1;
      for (; low <= high; ) {
        let mid = Math.floor(low + (high - low + 1) / 2);
        chunk.written[mid].start <= section.start
          ? ((low = mid + 1), (index = mid))
          : (high = mid - 1);
      }
      for (
        chunk.written.splice(index + 1, 0, section),
          (-1 === index || chunk.written[index].end < section.start) && index++;
        index < chunk.written.length - 1 &&
        chunk.written[index].end >= chunk.written[index + 1].start;
      )
        ((chunk.written[index].end = Math.max(
          chunk.written[index].end,
          chunk.written[index + 1].end,
        )),
          chunk.written.splice(index + 1, 1));
    }
    _createChunk(includesPosition) {
      let chunk = {
        start: Math.floor(includesPosition / this._chunkSize) * this._chunkSize,
        data: new Uint8Array(this._chunkSize),
        written: [],
        shouldFlush: !1,
      };
      return (
        this._chunks.push(chunk),
        this._chunks.sort((a, b) => a.start - b.start),
        this._chunks.indexOf(chunk)
      );
    }
    _flushChunks(force = !1) {
      for (let i = 0; i < this._chunks.length; i++) {
        let chunk = this._chunks[i];
        if (chunk.shouldFlush || force) {
          for (let section of chunk.written)
            this._target.options.onData?.(
              chunk.data.subarray(section.start, section.end),
              chunk.start + section.start,
            );
          this._chunks.splice(i--, 1);
        }
      }
    }
  }
  class FileSystemWritableFileStreamTargetWriter extends StreamTargetWriter {
    constructor(target) {
      super(
        new StreamTarget({
          onData: (data, position) => {
            target.stream &&
              "function" == typeof target.stream.write &&
              target.stream
                .write({ type: "write", data: data, position: position })
                .catch(() => {});
          },
          chunked: !0,
          chunkSize: target.options?.chunkSize,
        }),
      );
    }
  }
  const GLOBAL_TIMESCALE = 1e3;
  return {
    ArrayBufferTarget: ArrayBufferTarget,
    StreamTarget: StreamTarget,
    FileSystemWritableFileStreamTarget: class extends Target {
      constructor(stream, options) {
        if (
          (super(),
          (this.stream = stream),
          (this.options = options),
          void 0 !== options && "object" != typeof options)
        )
          throw new TypeError();
        if (
          options &&
          void 0 !== options.chunkSize &&
          (!Number.isInteger(options.chunkSize) || options.chunkSize <= 0)
        )
          throw new TypeError();
      }
    },
    Muxer: class {
      constructor(options) {
        if ("object" != typeof options || !(options.target instanceof Target))
          throw new TypeError();
        if (
          ((options.video = deepClone(options.video)),
          (options.audio = deepClone(options.audio)),
          (options.fastStart = deepClone(options.fastStart)),
          (this.target = options.target),
          (this._options = { firstTimestampBehavior: "strict", ...options }),
          options.target instanceof ArrayBufferTarget)
        )
          this._writer = new ArrayBufferTargetWriter(options.target);
        else if (options.target instanceof StreamTarget)
          this._writer = new StreamTargetWriter(options.target);
        else {
          if (!options.target || !options.target.stream) throw new Error();
          this._writer = new FileSystemWritableFileStreamTargetWriter(
            options.target,
          );
        }
        ((this._ftypSize = void 0),
          (this._mdat = void 0),
          (this._videoTrack = null),
          (this._audioTrack = null),
          (this._creationTime = Math.floor(Date.now() / 1e3) + 2082844800),
          (this._finalizedChunks = []),
          (this._nextFragmentNumber = 1),
          (this._videoSampleQueue = []),
          (this._audioSampleQueue = []),
          (this._finalized = !1),
          this._prepareTracks(),
          this._writeHeader());
      }
      addVideoChunk(sample, meta, timestamp, compositionTimeOffset) {
        if (!sample) return;
        let data = new Uint8Array(sample.byteLength);
        ("function" == typeof sample.copyTo
          ? sample.copyTo(data)
          : sample.buffer
            ? data.set(
                new Uint8Array(
                  sample.buffer,
                  sample.byteOffset,
                  sample.byteLength,
                ),
              )
            : data.set(sample),
          this.addVideoChunkRaw(
            data,
            sample.type,
            timestamp ?? sample.timestamp,
            sample.duration,
            meta,
            compositionTimeOffset,
          ));
      }
      addVideoChunkRaw(
        data,
        type,
        timestamp,
        duration,
        meta,
        compositionTimeOffset,
      ) {
        if (this._finalized) throw new Error();
        let videoSample = this._createSampleForTrack(
          this._videoTrack,
          data,
          type,
          timestamp,
          duration,
          meta,
          compositionTimeOffset,
        );
        if ("fragmented" === this._options.fastStart && this._audioTrack) {
          for (
            ;
            this._audioSampleQueue.length > 0 &&
            this._audioSampleQueue[0].decodeTimestamp <=
              videoSample.decodeTimestamp;
          ) {
            let audioSample = this._audioSampleQueue.shift();
            this._addSampleToTrack(this._audioTrack, audioSample);
          }
          videoSample.decodeTimestamp <= this._audioTrack.lastDecodeTimestamp
            ? this._addSampleToTrack(this._videoTrack, videoSample)
            : this._videoSampleQueue.push(videoSample);
        } else this._addSampleToTrack(this._videoTrack, videoSample);
      }
      addAudioChunk(sample, meta, timestamp) {
        if (!sample) return;
        let data = new Uint8Array(sample.byteLength);
        ("function" == typeof sample.copyTo
          ? sample.copyTo(data)
          : sample.buffer
            ? data.set(
                new Uint8Array(
                  sample.buffer,
                  sample.byteOffset,
                  sample.byteLength,
                ),
              )
            : data.set(sample),
          this.addAudioChunkRaw(
            data,
            sample.type,
            timestamp ?? sample.timestamp,
            sample.duration,
            meta,
          ));
      }
      addAudioChunkRaw(data, type, timestamp, duration, meta) {
        if (this._finalized) throw new Error();
        let audioSample = this._createSampleForTrack(
          this._audioTrack,
          data,
          type,
          timestamp,
          duration,
          meta,
        );
        if ("fragmented" === this._options.fastStart && this._videoTrack) {
          for (
            ;
            this._videoSampleQueue.length > 0 &&
            this._videoSampleQueue[0].decodeTimestamp <=
              audioSample.decodeTimestamp;
          ) {
            let videoSample = this._videoSampleQueue.shift();
            this._addSampleToTrack(this._videoTrack, videoSample);
          }
          audioSample.decodeTimestamp <= this._videoTrack.lastDecodeTimestamp
            ? this._addSampleToTrack(this._audioTrack, audioSample)
            : this._audioSampleQueue.push(audioSample);
        } else this._addSampleToTrack(this._audioTrack, audioSample);
      }
      finalize() {
        if (this._finalized) throw new Error();
        if ("fragmented" === this._options.fastStart) {
          for (let videoSample of this._videoSampleQueue)
            this._addSampleToTrack(this._videoTrack, videoSample);
          for (let audioSample of this._audioSampleQueue)
            this._addSampleToTrack(this._audioTrack, audioSample);
          this._finalizeFragment(!1);
        } else
          (this._videoTrack && this._finalizeCurrentChunk(this._videoTrack),
            this._audioTrack && this._finalizeCurrentChunk(this._audioTrack));
        let tracks = [this._videoTrack, this._audioTrack].filter(Boolean);
        if ("in-memory" === this._options.fastStart) {
          let mdatSize;
          for (let i = 0; i < 2; i++) {
            let movieBox2 = moov(tracks, this._creationTime),
              movieBoxSize = this._writer.measureBox(movieBox2);
            mdatSize = this._writer.measureBox(this._mdat);
            let currentChunkPos = this._writer.pos + movieBoxSize + mdatSize;
            for (let chunk of this._finalizedChunks) {
              chunk.offset = currentChunkPos;
              for (let { data: data } of chunk.samples)
                ((currentChunkPos += data.byteLength),
                  (mdatSize += data.byteLength));
            }
            if (currentChunkPos < 4294967296) break;
            mdatSize >= 4294967296 && (this._mdat.largeSize = !0);
          }
          let movieBox = moov(tracks, this._creationTime);
          (this._writer.writeBox(movieBox),
            (this._mdat.size = mdatSize),
            this._writer.writeBox(this._mdat));
          for (let chunk of this._finalizedChunks)
            for (let sample of chunk.samples)
              sample.data &&
                (this._writer.write(sample.data), (sample.data = null));
        } else if ("fragmented" === this._options.fastStart) {
          let startPos = this._writer.pos,
            mfraBox = ((tracks) =>
              box("mfra", null, [...tracks.map(tfra), mfro()]))(tracks);
          this._writer.writeBox(mfraBox);
          let mfraBoxSize = this._writer.pos - startPos;
          (this._writer.seek(this._writer.pos - 4),
            this._writer.writeU32(mfraBoxSize));
        } else {
          let mdatPos = this._writer.offsets.get(this._mdat),
            mdatSize = this._writer.pos - mdatPos;
          ((this._mdat.size = mdatSize),
            (this._mdat.largeSize = mdatSize >= 4294967296),
            this._writer.patchBox(this._mdat));
          let movieBox = moov(tracks, this._creationTime);
          if ("object" == typeof this._options.fastStart) {
            (this._writer.seek(this._ftypSize),
              this._writer.writeBox(movieBox));
            let remainingBytes = mdatPos - this._writer.pos;
            remainingBytes > 0 &&
              this._writer.writeBox({ type: "free", size: remainingBytes });
          } else this._writer.writeBox(movieBox);
        }
        (this._maybeFlushStreamingTargetWriter(),
          this._writer.finalize(),
          (this._finalized = !0));
      }
      _writeHeader() {
        var details;
        if (
          (this._writer.writeBox(
            (details = {
              holdsAvc: "avc" === this._options.video?.codec,
              fragmented: "fragmented" === this._options.fastStart,
            }).fragmented
              ? box("ftyp", [
                  ascii("iso5"),
                  u32(512),
                  ascii("iso5"),
                  ascii("iso6"),
                  ascii("mp41"),
                ])
              : box("ftyp", [
                  ascii("isom"),
                  u32(512),
                  ascii("isom"),
                  details.holdsAvc ? ascii("avc1") : [],
                  ascii("mp41"),
                ]),
          ),
          (this._ftypSize = this._writer.pos),
          "in-memory" === this._options.fastStart)
        )
          this._mdat = mdat(!1);
        else if ("fragmented" === this._options.fastStart);
        else {
          if ("object" == typeof this._options.fastStart) {
            let moovSizeUpperBound = this._computeMoovSizeUpperBound();
            this._writer.seek(this._writer.pos + moovSizeUpperBound);
          }
          ((this._mdat = mdat(!0)), this._writer.writeBox(this._mdat));
        }
        this._maybeFlushStreamingTargetWriter();
      }
      _computeMoovSizeUpperBound() {
        if ("object" != typeof this._options.fastStart) return;
        let upperBound = 0,
          sampleCounts = [
            this._options.fastStart.expectedVideoChunks,
            this._options.fastStart.expectedAudioChunks,
          ];
        for (let n of sampleCounts)
          n &&
            (upperBound +=
              8 * Math.ceil((2 / 3) * n) +
              4 * n +
              12 * Math.ceil((2 / 3) * n) +
              4 * n +
              8 * n);
        return ((upperBound += 4096), upperBound);
      }
      _prepareTracks() {
        if (
          (this._options.video &&
            (this._videoTrack = {
              id: 1,
              info: {
                type: "video",
                codec: this._options.video.codec,
                width: this._options.video.width,
                height: this._options.video.height,
                rotation: this._options.video.rotation ?? 0,
                decoderConfig: null,
              },
              timescale: this._options.video.frameRate ?? 9e4,
              samples: [],
              finalizedChunks: [],
              currentChunk: null,
              firstDecodeTimestamp: void 0,
              lastDecodeTimestamp: -1,
              timeToSampleTable: [],
              compositionTimeOffsetTable: [],
              lastTimescaleUnits: null,
              lastSample: null,
              compactlyCodedChunkTable: [],
            }),
          this._options.audio &&
            ((this._audioTrack = {
              id: this._options.video ? 2 : 1,
              info: {
                type: "audio",
                codec: this._options.audio.codec,
                numberOfChannels: this._options.audio.numberOfChannels,
                sampleRate: this._options.audio.sampleRate,
                decoderConfig: null,
              },
              timescale: this._options.audio.sampleRate,
              samples: [],
              finalizedChunks: [],
              currentChunk: null,
              firstDecodeTimestamp: void 0,
              lastDecodeTimestamp: -1,
              timeToSampleTable: [],
              compositionTimeOffsetTable: [],
              lastTimescaleUnits: null,
              lastSample: null,
              compactlyCodedChunkTable: [],
            }),
            "aac" === this._options.audio.codec))
        ) {
          let guessedCodecPrivate = this._generateMpeg4AudioSpecificConfig(
            2,
            this._options.audio.sampleRate,
            this._options.audio.numberOfChannels,
          );
          this._audioTrack.info.decoderConfig = {
            codec: this._options.audio.codec,
            description: guessedCodecPrivate,
            numberOfChannels: this._options.audio.numberOfChannels,
            sampleRate: this._options.audio.sampleRate,
          };
        }
      }
      _generateMpeg4AudioSpecificConfig(
        objectType,
        sampleRate,
        numberOfChannels,
      ) {
        let frequencyIndex = [
          96e3, 88200, 64e3, 48e3, 44100, 32e3, 24e3, 22050, 16e3, 12e3, 11025,
          8e3, 7350,
        ].indexOf(sampleRate);
        -1 === frequencyIndex && (frequencyIndex = 4);
        let channelConfig = numberOfChannels,
          configBits = "";
        ((configBits += objectType.toString(2).padStart(5, "0")),
          (configBits += frequencyIndex.toString(2).padStart(4, "0")),
          15 === frequencyIndex &&
            (configBits += sampleRate.toString(2).padStart(24, "0")),
          (configBits += channelConfig.toString(2).padStart(4, "0")));
        let paddingLength = 8 * Math.ceil(configBits.length / 8);
        configBits = configBits.padEnd(paddingLength, "0");
        let configBytes = new Uint8Array(configBits.length / 8);
        for (let i = 0; i < configBits.length; i += 8)
          configBytes[i / 8] = parseInt(configBits.slice(i, i + 8), 2);
        return configBytes;
      }
      _createSampleForTrack(
        track,
        data,
        type,
        timestamp,
        duration,
        meta,
        compositionTimeOffset,
      ) {
        let presentationTimestampInSeconds = timestamp / 1e6,
          decodeTimestampInSeconds =
            (timestamp - (compositionTimeOffset ?? 0)) / 1e6,
          durationInSeconds = duration / 1e6,
          adjusted = this._validateTimestamp(
            presentationTimestampInSeconds,
            decodeTimestampInSeconds,
            track,
          );
        return (
          (presentationTimestampInSeconds = adjusted.presentationTimestamp),
          (decodeTimestampInSeconds = adjusted.decodeTimestamp),
          meta?.decoderConfig &&
            (null === track.info.decoderConfig
              ? (track.info.decoderConfig = meta.decoderConfig)
              : (meta.decoderConfig.description &&
                  (track.info.decoderConfig.description =
                    meta.decoderConfig.description),
                Object.assign(track.info.decoderConfig, meta.decoderConfig))),
          {
            presentationTimestamp: presentationTimestampInSeconds,
            decodeTimestamp: decodeTimestampInSeconds,
            duration: durationInSeconds,
            data: data,
            size: data.byteLength,
            type: type,
            timescaleUnitsToNextSample: intoTimescale(
              durationInSeconds,
              track.timescale,
            ),
          }
        );
      }
      _addSampleToTrack(track, sample) {
        "fragmented" !== this._options.fastStart && track.samples.push(sample);
        const sampleCompositionTimeOffset = intoTimescale(
          sample.presentationTimestamp - sample.decodeTimestamp,
          track.timescale,
        );
        if (null !== track.lastTimescaleUnits) {
          let timescaleUnits = intoTimescale(
              sample.decodeTimestamp,
              track.timescale,
              !1,
            ),
            delta = Math.round(timescaleUnits - track.lastTimescaleUnits);
          if (
            ((track.lastTimescaleUnits += delta),
            (track.lastSample.timescaleUnitsToNextSample = delta),
            "fragmented" !== this._options.fastStart)
          ) {
            let lastTableEntry = last(track.timeToSampleTable);
            1 === lastTableEntry.sampleCount
              ? ((lastTableEntry.sampleDelta = delta),
                lastTableEntry.sampleCount++)
              : lastTableEntry.sampleDelta === delta
                ? lastTableEntry.sampleCount++
                : (lastTableEntry.sampleCount--,
                  track.timeToSampleTable.push({
                    sampleCount: 2,
                    sampleDelta: delta,
                  }));
            const lastCompositionTimeOffsetTableEntry = last(
              track.compositionTimeOffsetTable,
            );
            lastCompositionTimeOffsetTableEntry.sampleCompositionTimeOffset ===
            sampleCompositionTimeOffset
              ? lastCompositionTimeOffsetTableEntry.sampleCount++
              : track.compositionTimeOffsetTable.push({
                  sampleCount: 1,
                  sampleCompositionTimeOffset: sampleCompositionTimeOffset,
                });
          }
        } else
          ((track.lastTimescaleUnits = 0),
            "fragmented" !== this._options.fastStart &&
              (track.timeToSampleTable.push({
                sampleCount: 1,
                sampleDelta: intoTimescale(sample.duration, track.timescale),
              }),
              track.compositionTimeOffsetTable.push({
                sampleCount: 1,
                sampleCompositionTimeOffset: sampleCompositionTimeOffset,
              })));
        track.lastSample = sample;
        let beginNewChunk = !1;
        if (track.currentChunk) {
          let currentChunkDuration =
            sample.presentationTimestamp - track.currentChunk.startTimestamp;
          if ("fragmented" === this._options.fastStart) {
            let mostImportantTrack = this._videoTrack ?? this._audioTrack;
            const chunkDuration = this._options.minFragmentDuration ?? 1;
            track === mostImportantTrack &&
              "key" === sample.type &&
              currentChunkDuration >= chunkDuration &&
              ((beginNewChunk = !0), this._finalizeFragment());
          } else beginNewChunk = currentChunkDuration >= 0.5;
        } else beginNewChunk = !0;
        (beginNewChunk &&
          (track.currentChunk && this._finalizeCurrentChunk(track),
          (track.currentChunk = {
            startTimestamp: sample.presentationTimestamp,
            samples: [],
          })),
          track.currentChunk.samples.push(sample));
      }
      _validateTimestamp(presentationTimestamp, decodeTimestamp, track) {
        const strictTimestampBehavior =
            "strict" === this._options.firstTimestampBehavior,
          noLastDecodeTimestamp = -1 === track.lastDecodeTimestamp;
        if (
          (strictTimestampBehavior &&
            noLastDecodeTimestamp &&
            0 !== decodeTimestamp &&
            ((decodeTimestamp = 0), (presentationTimestamp = 0)),
          "offset" === this._options.firstTimestampBehavior ||
            "cross-track-offset" === this._options.firstTimestampBehavior)
        ) {
          let baseDecodeTimestamp;
          (void 0 === track.firstDecodeTimestamp &&
            (track.firstDecodeTimestamp = decodeTimestamp),
            (baseDecodeTimestamp =
              "offset" === this._options.firstTimestampBehavior
                ? track.firstDecodeTimestamp
                : Math.min(
                    this._videoTrack?.firstDecodeTimestamp ?? 1 / 0,
                    this._audioTrack?.firstDecodeTimestamp ?? 1 / 0,
                  )),
            (decodeTimestamp -= baseDecodeTimestamp),
            (presentationTimestamp -= baseDecodeTimestamp));
        }
        return (
          decodeTimestamp < track.lastDecodeTimestamp &&
            (decodeTimestamp = track.lastDecodeTimestamp + 1e-6),
          (track.lastDecodeTimestamp = decodeTimestamp),
          {
            presentationTimestamp: presentationTimestamp,
            decodeTimestamp: decodeTimestamp,
          }
        );
      }
      _finalizeCurrentChunk(track) {
        if (track.currentChunk)
          if (
            (track.finalizedChunks.push(track.currentChunk),
            this._finalizedChunks.push(track.currentChunk),
            (0 !== track.compactlyCodedChunkTable.length &&
              last(track.compactlyCodedChunkTable).samplesPerChunk ===
                track.currentChunk.samples.length) ||
              track.compactlyCodedChunkTable.push({
                firstChunk: track.finalizedChunks.length,
                samplesPerChunk: track.currentChunk.samples.length,
              }),
            "in-memory" !== this._options.fastStart)
          ) {
            track.currentChunk.offset = this._writer.pos;
            for (let sample of track.currentChunk.samples)
              (this._writer.write(sample.data), (sample.data = null));
            this._maybeFlushStreamingTargetWriter();
          } else track.currentChunk.offset = 0;
      }
      _finalizeFragment(flushStreamingWriter = !0) {
        let tracks = [this._videoTrack, this._audioTrack].filter(
          (track) => track && track.currentChunk,
        );
        if (0 === tracks.length) return;
        let fragmentNumber = this._nextFragmentNumber++;
        if (1 === fragmentNumber) {
          let movieBox = moov(tracks, this._creationTime, !0);
          this._writer.writeBox(movieBox);
        }
        let moofOffset = this._writer.pos,
          moofBox = moof(fragmentNumber, tracks);
        this._writer.writeBox(moofBox);
        {
          let mdatBox = mdat(!1),
            totalTrackSampleSize = 0;
          for (let track of tracks)
            for (let sample of track.currentChunk.samples)
              totalTrackSampleSize += sample.size;
          let mdatSize =
            this._writer.measureBox(mdatBox) + totalTrackSampleSize;
          (mdatSize >= 4294967296 &&
            ((mdatBox.largeSize = !0),
            (mdatSize =
              this._writer.measureBox(mdatBox) + totalTrackSampleSize)),
            (mdatBox.size = mdatSize),
            this._writer.writeBox(mdatBox));
        }
        for (let track of tracks) {
          ((track.currentChunk.offset = this._writer.pos),
            (track.currentChunk.moofOffset = moofOffset));
          for (let sample of track.currentChunk.samples)
            (this._writer.write(sample.data), (sample.data = null));
        }
        let endPos = this._writer.pos;
        this._writer.seek(this._writer.offsets.get(moofBox));
        let newMoofBox = moof(fragmentNumber, tracks);
        (this._writer.writeBox(newMoofBox), this._writer.seek(endPos));
        for (let track of tracks)
          (track.finalizedChunks.push(track.currentChunk),
            this._finalizedChunks.push(track.currentChunk),
            (track.currentChunk = null));
        flushStreamingWriter && this._maybeFlushStreamingTargetWriter();
      }
      _maybeFlushStreamingTargetWriter() {
        this._writer instanceof StreamTargetWriter && this._writer.flush();
      }
    },
  };
})();
"undefined" != typeof module && "object" == typeof module.exports
  ? (module.exports = UniMuxer)
  : "undefined" != typeof window && (window.UniMuxer = UniMuxer);
