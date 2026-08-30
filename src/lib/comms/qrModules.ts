/**
 * Compact QR (byte mode, ECC M) for personal contact URLs only.
 * Do not encode phones, emails, auth uids, or secret tokens.
 */

const ECC_M_CODEWORDS: Record<number, number> = {
  1: 10,
  2: 16,
  3: 26,
  4: 36,
  5: 46,
  6: 60,
  7: 66,
  8: 86,
  9: 100,
  10: 122,
};

const TOTAL_CODEWORDS: Record<number, number> = {
  1: 26,
  2: 44,
  3: 70,
  4: 100,
  5: 134,
  6: 172,
  7: 196,
  8: 242,
  9: 292,
  10: 346,
};

const GROUP_BLOCKS: Record<number, [number, number, number, number]> = {
  // [g1Blocks, g1Data, g2Blocks, g2Data]
  1: [1, 16, 0, 0],
  2: [1, 28, 0, 0],
  3: [1, 44, 0, 0],
  4: [2, 32, 0, 0],
  5: [2, 43, 1, 0],
  6: [4, 27, 0, 0],
  7: [4, 31, 0, 0],
  8: [2, 38, 2, 39],
  9: [3, 36, 2, 37],
  10: [4, 43, 1, 44],
};

const ALIGNMENT: Record<number, number[]> = {
  1: [],
  2: [18],
  3: [22],
  4: [26],
  5: [30],
  6: [34],
  7: [22, 38],
  8: [24, 42],
  9: [26, 46],
  10: [28, 50],
};

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  let p = 0;
  for (let i = 0; i < 8; i += 1) {
    if (b & 1) p ^= a;
    const hi = a & 0x80;
    a = (a << 1) & 0xff;
    if (hi) a ^= 0x11d;
    b >>= 1;
  }
  return p;
}

function rsGenerator(ecCount: number): number[] {
  let poly = [1];
  let root = 1;
  for (let i = 0; i < ecCount; i += 1) {
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], root);
    }
    poly = next;
    let r = root;
    r = gfMul(r, 2);
    root = r;
  }
  return poly;
}

function rsEncode(data: number[], ecCount: number): number[] {
  const gen = rsGenerator(ecCount);
  const ecc = new Array<number>(ecCount).fill(0);
  for (const byte of data) {
    const factor = byte ^ (ecc[0] ?? 0);
    ecc.shift();
    ecc.push(0);
    for (let i = 0; i < ecCount; i += 1) {
      ecc[i] ^= gfMul(gen[i + 1] ?? 0, factor);
    }
  }
  return ecc;
}

function bitPush(bits: number[], value: number, length: number) {
  for (let i = length - 1; i >= 0; i -= 1) {
    bits.push((value >> i) & 1);
  }
}

function chooseVersion(payloadLength: number): number {
  for (let version = 1; version <= 10; version += 1) {
    const [g1, d1, g2, d2] = GROUP_BLOCKS[version];
    const dataCapacity = g1 * d1 + g2 * d2;
    const bitCapacity = dataCapacity * 8;
    const needed = 4 + (version <= 9 ? 8 : 16) + payloadLength * 8 + 4;
    if (needed <= bitCapacity) {
      return version;
    }
  }
  throw new Error("Contact URL is too long for QR.");
}

function encodeData(bytes: Uint8Array, version: number): number[] {
  const [g1, d1, g2, d2] = GROUP_BLOCKS[version];
  const dataCapacity = g1 * d1 + g2 * d2;
  const bits: number[] = [];
  bitPush(bits, 0b0100, 4);
  bitPush(bits, bytes.length, version <= 9 ? 8 : 16);
  for (const b of bytes) {
    bitPush(bits, b, 8);
  }
  bitPush(bits, 0, Math.min(4, dataCapacity * 8 - bits.length));
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j += 1) {
      v = (v << 1) | (bits[i + j] ?? 0);
    }
    data.push(v);
  }
  const pads = [0xec, 0x11];
  let pad = 0;
  while (data.length < dataCapacity) {
    data.push(pads[pad % 2]);
    pad += 1;
  }
  return data;
}

function interleave(data: number[], version: number): number[] {
  const [g1, d1, g2, d2] = GROUP_BLOCKS[version];
  const ecCount = ECC_M_CODEWORDS[version] / (g1 + g2);
  const blocks: { data: number[]; ecc: number[] }[] = [];
  let offset = 0;
  for (let i = 0; i < g1; i += 1) {
    const slice = data.slice(offset, offset + d1);
    blocks.push({ data: slice, ecc: rsEncode(slice, ecCount) });
    offset += d1;
  }
  for (let i = 0; i < g2; i += 1) {
    const slice = data.slice(offset, offset + d2);
    blocks.push({ data: slice, ecc: rsEncode(slice, ecCount) });
    offset += d2;
  }
  const out: number[] = [];
  const maxData = Math.max(d1, d2);
  for (let i = 0; i < maxData; i += 1) {
    for (const block of blocks) {
      if (i < block.data.length) out.push(block.data[i]);
    }
  }
  for (let i = 0; i < ecCount; i += 1) {
    for (const block of blocks) {
      out.push(block.ecc[i] ?? 0);
    }
  }
  return out;
}

function sizeFor(version: number): number {
  return version * 4 + 17;
}

function placeFinder(modules: number[][], ox: number, oy: number) {
  for (let y = 0; y < 7; y += 1) {
    for (let x = 0; x < 7; x += 1) {
      const onBorder = x === 0 || y === 0 || x === 6 || y === 6;
      const inCenter = x >= 2 && x <= 4 && y >= 2 && y <= 4;
      modules[oy + y][ox + x] = onBorder || inCenter ? 1 : 0;
    }
  }
}

function placeAlignment(modules: number[][], cx: number, cy: number) {
  for (let y = -2; y <= 2; y += 1) {
    for (let x = -2; x <= 2; x += 1) {
      modules[cy + y][cx + x] =
        Math.max(Math.abs(x), Math.abs(y)) === 2 || (x === 0 && y === 0) ? 1 : 0;
    }
  }
}

function maskBit(x: number, y: number): boolean {
  return (x + y) % 2 === 0;
}

function buildModules(codewords: number[], version: number): number[][] {
  const size = sizeFor(version);
  const modules = Array.from({ length: size }, () => new Array<number>(size).fill(-1));
  placeFinder(modules, 0, 0);
  placeFinder(modules, size - 7, 0);
  placeFinder(modules, 0, size - 7);
  for (let i = 0; i < 8; i += 1) {
    if (modules[7][i] < 0) modules[7][i] = 0;
    if (modules[i][7] < 0) modules[i][7] = 0;
    if (modules[7][size - 1 - i] < 0) modules[7][size - 1 - i] = 0;
    if (modules[i][size - 8] < 0) modules[i][size - 8] = 0;
    if (modules[size - 8][i] < 0) modules[size - 8][i] = 0;
    if (modules[size - 1 - i][7] < 0) modules[size - 1 - i][7] = 0;
  }
  for (let i = 8; i < size - 8; i += 1) {
    modules[6][i] = i % 2 === 0 ? 1 : 0;
    modules[i][6] = i % 2 === 0 ? 1 : 0;
  }
  const aligns = ALIGNMENT[version];
  for (const ay of [6, ...aligns]) {
    for (const ax of [6, ...aligns]) {
      if ((ax === 6 && ay === 6) || (ax === 6 && ay === size - 7) || (ax === size - 7 && ay === 6)) {
        continue;
      }
      placeAlignment(modules, ax, ay);
    }
  }
  modules[size - 8][8] = 1;

  const bits: number[] = [];
  for (const word of codewords) {
    for (let i = 7; i >= 0; i -= 1) bits.push((word >> i) & 1);
  }
  const remainder = version >= 7 ? 0 : [0, 0, 7, 7, 7, 7, 0, 0, 0, 0, 0][version] ?? 0;
  for (let i = 0; i < remainder; i += 1) bits.push(0);

  let bit = 0;
  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1;
    for (let i = 0; i < size; i += 1) {
      const y = upward ? size - 1 - i : i;
      for (const x of [col, col - 1]) {
        if (modules[y][x] !== -1) continue;
        const dataBit = bits[bit] ?? 0;
        bit += 1;
        modules[y][x] = dataBit ^ (maskBit(x, y) ? 1 : 0);
      }
    }
    upward = !upward;
  }

  // Format bits for mask 0 + ECC M (0b00 mask, 0b00 ECC? M = 00)
  // Format: ECC M (00) + mask 0 (000) = 00000, BCH → 0x5412
  const format = 0x5412;
  for (let i = 0; i < 15; i += 1) {
    const on = (format >> i) & 1;
    if (i < 6) {
      modules[i][8] = on;
      modules[8][size - 1 - i] = on;
    } else if (i < 8) {
      modules[i + 1][8] = on;
      modules[8][size - 1 - i] = on;
    } else {
      modules[8][14 - i] = on;
      modules[size - 15 + i][8] = on;
    }
  }
  modules[8][7] = (format >> 8) & 1;
  modules[7][8] = (format >> 8) & 1;

  return modules;
}

export function encodeContactQrModules(payload: string): number[][] {
  const bytes = new TextEncoder().encode(payload);
  const version = chooseVersion(bytes.length);
  const data = encodeData(bytes, version);
  const interleaved = interleave(data, version);
  if (interleaved.length !== TOTAL_CODEWORDS[version]) {
    while (interleaved.length < TOTAL_CODEWORDS[version]) interleaved.push(0);
  }
  return buildModules(interleaved, version);
}

export function renderContactQrSvg(
  payload: string,
  options?: { size?: number; dark?: string; light?: string }
): string {
  const modules = encodeContactQrModules(payload);
  const n = modules.length;
  const quiet = 4;
  const dim = n + quiet * 2;
  const size = options?.size ?? 192;
  const dark = options?.dark ?? "#050510";
  const light = options?.light ?? "#f4f7ff";
  const cell = size / dim;
  const rects: string[] = [];
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      if (!modules[y][x]) continue;
      rects.push(
        `<rect x="${((x + quiet) * cell).toFixed(3)}" y="${((y + quiet) * cell).toFixed(3)}" width="${cell.toFixed(3)}" height="${cell.toFixed(3)}" rx="${(cell * 0.18).toFixed(3)}"/>`
      );
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-hidden="true"><rect width="${size}" height="${size}" rx="16" fill="${light}"/><g fill="${dark}">${rects.join("")}</g></svg>`;
}
