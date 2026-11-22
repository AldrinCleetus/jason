/**
 * Script to generate crisp PNG icons for GTA Shield (16x16, 48x48, 128x128).
 * Pure Node.js using zlib and Buffer, zero external dependencies.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function createChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcBody = Buffer.concat([typeBuf, data]);
  const crcVal = crc32(crcBody);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function generateShieldPNG(size) {
  const width = size;
  const height = size;

  // Raw image RGBA buffer: height scanlines, each having 1 filter byte + width*4 bytes
  const scanlines = [];

  const centerX = width / 2;
  const centerY = height / 2;
  const radius = width * 0.44;

  for (let y = 0; y < height; y++) {
    const line = Buffer.alloc(1 + width * 4);
    line[0] = 0; // Filter type: None

    for (let x = 0; x < width; x++) {
      const idx = 1 + x * 4;

      // Normalized coordinates from center (-1 to 1)
      const nx = (x - centerX) / radius;
      const ny = (y - centerY) / radius;

      // Shield shape condition:
      // Top curve / flat top with slight curve
      // Curved downward taper to a point at bottom (nx=0, ny=1)
      let inShield = false;
      let inBorder = false;

      if (ny >= -0.9 && ny <= 1.0) {
        // Width of shield at vertical level ny
        let maxWidth;
        if (ny <= 0.1) {
          maxWidth = 0.95;
        } else {
          // taper down smoothly to 0 at ny = 1.0
          const t = (ny - 0.1) / 0.9;
          maxWidth = 0.95 * (1 - t * t);
        }

        if (Math.abs(nx) <= maxWidth) {
          inShield = true;
          if (Math.abs(nx) >= maxWidth - 0.15 || ny <= -0.75 || ny >= 0.85) {
            inBorder = true;
          }
        }
      }

      if (inShield) {
        if (inBorder) {
          // Bright gold / red shield border
          line[idx + 0] = 255; // R
          line[idx + 1] = 215; // G
          line[idx + 2] = 0;   // B (Gold)
          line[idx + 3] = 255; // A
        } else {
          // Crimson / dark red gradient body
          const grad = Math.min(255, Math.max(0, Math.floor(180 - ny * 60)));
          line[idx + 0] = 230; // R
          line[idx + 1] = 57;  // G
          line[idx + 2] = 70;  // B
          line[idx + 3] = 255; // A
        }
      } else {
        // Transparent
        line[idx + 0] = 0;
        line[idx + 1] = 0;
        line[idx + 2] = 0;
        line[idx + 3] = 0;
      }
    }
    scanlines.push(line);
  }

  const rawData = Buffer.concat(scanlines);
  const compressed = zlib.deflateSync(rawData);

  // PNG Signature
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // Deflate
  ihdrData[11] = 0; // Filter standard
  ihdrData[12] = 0; // Non-interlaced
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // IDAT
  const idatChunk = createChunk('IDAT', compressed);

  // IEND
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

[16, 48, 128].forEach(size => {
  const pngBuf = generateShieldPNG(size);
  const outPath = path.join(__dirname, 'icons', `icon-${size}.png`);
  fs.writeFileSync(outPath, pngBuf);
  console.log(`Generated: ${outPath} (${pngBuf.length} bytes)`);
});
