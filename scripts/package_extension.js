/**
 * Pure Node.js ZIP Packager for Mozilla Firefox Add-ons (AMO).
 * 1. Guarantees 100% standard forward slashes ('/') in all archive entries (fixes Windows backslash bug).
 * 2. Places manifest.json, icons, src, and ui directly at root.
 * 3. Zero external CLI dependencies (pure Node.js using zlib and Buffer).
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Standard CRC32 table & calculation
let crcTable = null;
function getCrcTable() {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[i] = c >>> 0;
  }
  return crcTable;
}

function calculateCrc32(buf) {
  const table = getCrcTable();
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Convert Date to MS-DOS date and time format
function getDosDateTime(date) {
  const d = date || new Date();
  const time = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF;
  const dosDate = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
  return { time, date: dosDate };
}

function createZipArchive(files, outputPath) {
  const localHeaders = [];
  const centralHeaders = [];
  let currentOffset = 0;
  const now = getDosDateTime(new Date());

  for (const file of files) {
    const rawData = fs.readFileSync(file.diskPath);
    const uncompressedSize = rawData.length;
    const crc = calculateCrc32(rawData);

    // Deflate raw data (RFC 1951 without zlib header/checksum)
    const compressedData = zlib.deflateRawSync(rawData, { level: 9 });
    const compressedSize = compressedData.length;

    // Strict forward-slash archive path (required by AMO)
    const archivePath = file.archivePath.replace(/\\/g, '/');
    const nameBuffer = Buffer.from(archivePath, 'utf8');

    // Local File Header (30 bytes + name length)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034B50, 0); // signature
    localHeader.writeUInt16LE(20, 4);         // version needed (2.0)
    localHeader.writeUInt16LE(0, 6);          // flags
    localHeader.writeUInt16LE(8, 8);          // compression method: deflate
    localHeader.writeUInt16LE(now.time, 10);  // last mod time
    localHeader.writeUInt16LE(now.date, 12);  // last mod date
    localHeader.writeUInt32LE(crc, 14);       // crc32
    localHeader.writeUInt32LE(compressedSize, 18);   // compressed size
    localHeader.writeUInt32LE(uncompressedSize, 22); // uncompressed size
    localHeader.writeUInt16LE(nameBuffer.length, 26); // name length
    localHeader.writeUInt16LE(0, 28);         // extra length

    const localEntry = Buffer.concat([localHeader, nameBuffer, compressedData]);
    localHeaders.push(localEntry);

    // Central Directory Header (46 bytes + name length)
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014B50, 0); // signature
    centralHeader.writeUInt16LE(20, 4);         // version made by
    centralHeader.writeUInt16LE(20, 6);         // version needed
    centralHeader.writeUInt16LE(0, 8);          // flags
    centralHeader.writeUInt16LE(8, 10);         // compression: deflate
    centralHeader.writeUInt16LE(now.time, 12);  // last mod time
    centralHeader.writeUInt16LE(now.date, 14);  // last mod date
    centralHeader.writeUInt32LE(crc, 16);       // crc32
    centralHeader.writeUInt32LE(compressedSize, 20);   // compressed size
    centralHeader.writeUInt32LE(uncompressedSize, 24); // uncompressed size
    centralHeader.writeUInt16LE(nameBuffer.length, 28); // name length
    centralHeader.writeUInt16LE(0, 30);         // extra length
    centralHeader.writeUInt16LE(0, 32);         // comment length
    centralHeader.writeUInt16LE(0, 34);         // disk start
    centralHeader.writeUInt16LE(0, 36);         // internal attrs
    centralHeader.writeUInt32LE(0x81A40000, 38); // external attrs (0644 file)
    centralHeader.writeUInt32LE(currentOffset, 42); // local header offset

    const centralEntry = Buffer.concat([centralHeader, nameBuffer]);
    centralHeaders.push(centralEntry);

    currentOffset += localEntry.length;
  }

  const centralDirBuffer = Buffer.concat(centralHeaders);
  const centralDirSize = centralDirBuffer.length;
  const centralDirOffset = currentOffset;

  // End of Central Directory (EOCD) (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054B50, 0);      // signature
  eocd.writeUInt16LE(0, 4);               // disk number
  eocd.writeUInt16LE(0, 6);               // central dir disk
  eocd.writeUInt16LE(files.length, 8);    // records on this disk
  eocd.writeUInt16LE(files.length, 10);   // total records
  eocd.writeUInt32LE(centralDirSize, 12); // central dir size
  eocd.writeUInt32LE(centralDirOffset, 16); // central dir offset
  eocd.writeUInt16LE(0, 20);              // comment length

  const finalZipBuffer = Buffer.concat([
    ...localHeaders,
    centralDirBuffer,
    eocd
  ]);

  fs.writeFileSync(outputPath, finalZipBuffer);
  return finalZipBuffer.length;
}

// Collect all extension production files recursively
function collectFiles(dir, baseDir = '') {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const item of list) {
    const fullPath = path.join(dir, item);
    const relPath = baseDir ? `${baseDir}/${item}` : item;
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(collectFiles(fullPath, relPath));
    } else {
      results.push({ diskPath: fullPath, archivePath: relPath });
    }
  }
  return results;
}

function packageExtension() {
  const rootDir = path.resolve(__dirname, '..');
  const distDir = path.join(rootDir, 'dist');

  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'manifest.json'), 'utf8'));
  const version = manifest.version || '1.0.0';
  const zipName = `gta-shield-v${version}.zip`;
  const outputPath = path.join(distDir, zipName);

  console.log(`Packaging GTA Shield v${version} for Mozilla AMO...`);

  // Include only required extension files at the root
  const filesToPackage = [];

  // 1. manifest.json directly at root
  filesToPackage.push({
    diskPath: path.join(rootDir, 'manifest.json'),
    archivePath: 'manifest.json'
  });

  // 2. icons/
  filesToPackage.push(...collectFiles(path.join(rootDir, 'icons'), 'icons'));

  // 3. src/
  filesToPackage.push(...collectFiles(path.join(rootDir, 'src'), 'src'));

  // 4. ui/
  filesToPackage.push(...collectFiles(path.join(rootDir, 'ui'), 'ui'));

  const zipSize = createZipArchive(filesToPackage, outputPath);

  console.log(`\n✓ Successfully created production package:`);
  console.log(`  File: dist/${zipName} (${Math.round(zipSize / 1024)} KB)`);
  console.log(`  Total entries: ${filesToPackage.length}`);
  console.log(`  All paths verified with forward slashes ('/')`);
  console.log(`  Upload this file directly to addons.mozilla.org!`);
}

packageExtension();
