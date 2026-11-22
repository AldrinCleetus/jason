/**
 * Script to generate crisp GTA VI / Vice City themed PNG icons (16x16, 48x48, 128x128).
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

function generateViceCityShieldPNG(size) {
  const width = size;
  const height = size;
  const scanlines = [];

  const centerX = width / 2;
  const centerY = height / 2;
  const radius = width * 0.44;

  for (let y = 0; y < height; y++) {
    const line = Buffer.alloc(1 + width * 4);
    line[0] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const idx = 1 + x * 4;

      const nx = (x - centerX) / radius;
      const ny = (y - centerY) / radius;

      let inShield = false;
      let inBorder = false;

      if (ny >= -0.9 && ny <= 1.0) {
        let maxWidth;
        if (ny <= 0.1) {
          maxWidth = 0.95;
        } else {
          const t = (ny - 0.1) / 0.9;
          maxWidth = 0.95 * (1 - t * t);
        }

        if (Math.abs(nx) <= maxWidth) {
          inShield = true;
          if (Math.abs(nx) >= maxWidth - 0.14 || ny <= -0.76 || ny >= 0.86) {
            inBorder = true;
          }
        }
      }

      if (inShield) {
        if (inBorder) {
          // GTA VI Neon Sunset Gradient Border: Hot Pink (#FF2A85) to Sunset Orange (#FFAA00)
          const gradFactor = (ny + 0.9) / 1.9; // 0 (top) to 1 (bottom)
          line[idx + 0] = Math.floor(255 - gradFactor * 20); // R
          line[idx + 1] = Math.floor(42 + gradFactor * 130);  // G (Pink to Orange/Gold)
          line[idx + 2] = Math.floor(133 * (1 - gradFactor)); // B
          line[idx + 3] = 255; // A
        } else {
          // Inner Body: Vice City Deep Purple to Magenta Sunset Gradient
          const gradFactor = (ny + 0.9) / 1.9;
          const r = Math.floor(45 + gradFactor * 170);   // Dark violet to hot magenta
          const g = Math.floor(10 + gradFactor * 30);
          const b = Math.floor(75 + gradFactor * 50);

          // Center VI accent highlight if icon is large enough
          let isVIHighlight = false;
          if (size >= 48) {
            const inVLeft = (nx >= -0.55 && nx <= -0.35 && ny >= -0.4 && ny <= 0.3 && Math.abs(nx + 0.45 - (ny * 0.25)) < 0.1);
            const inVRight = (nx >= -0.35 && nx <= -0.15 && ny >= -0.4 && ny <= 0.3 && Math.abs(nx + 0.25 + (ny * 0.25)) < 0.1);
            const inI = (nx >= 0.15 && nx <= 0.35 && ny >= -0.4 && ny <= 0.3);
            isVIHighlight = inVLeft || inVRight || inI;
          }

          if (isVIHighlight) {
            // Neon Cyan / Mint accent (#00F5D4)
            line[idx + 0] = 0;
            line[idx + 1] = 245;
            line[idx + 2] = 212;
            line[idx + 3] = 255;
          } else {
            line[idx + 0] = r;
            line[idx + 1] = g;
            line[idx + 2] = b;
            line[idx + 3] = 255;
          }
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

  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdrChunk = createChunk('IHDR', ihdrData);

  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

[16, 48, 128].forEach(size => {
  const pngBuf = generateViceCityShieldPNG(size);
  const outPath = path.join(__dirname, '..', 'icons', `icon-${size}.png`);
  fs.writeFileSync(outPath, pngBuf);
  console.log(`Generated Vice City Icon: ${outPath} (${pngBuf.length} bytes)`);
});
