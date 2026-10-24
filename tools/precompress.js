// After `vite build`: a gzipped copy (file.gz) next to each compressible file
// in dist/, which the server sends to browsers that accept gzip
// (server/index.js). The main bundle goes from ~1 MB to ~300 KB on the wire.
// Not the Vircon32 ROMs (hundreds of MB, only fetched when someone plays) nor
// formats that are already compressed (mp3, jpg, png).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DIST = path.join(__dirname, '..', 'dist');
const EXTENSIONS = new Set(['.js', '.css', '.html', '.json', '.svg', '.glb', '.wasm', '.wav']);
const MIN_BYTES = 1024;
const MIN_SAVING = 0.1; // keep the .gz only if it's at least 10% smaller

let before = 0;
let after = 0;
let files = 0;

function walk(directory) {
    fs.readdirSync(directory, { withFileTypes: true }).forEach(entry => {
        const full = path.join(directory, entry.name);
        if (entry.isDirectory()) return walk(full);
        if (!EXTENSIONS.has(path.extname(entry.name).toLowerCase())) return;
        const data = fs.readFileSync(full);
        if (data.length < MIN_BYTES) return;
        const compressed = zlib.gzipSync(data, { level: 9 });
        if (compressed.length > data.length * (1 - MIN_SAVING)) return;
        fs.writeFileSync(`${full}.gz`, compressed);
        before += data.length;
        after += compressed.length;
        files++;
    });
}

walk(DIST);
console.log(`precompress: ${files} files, ${Math.round(before / 1024)} KB -> ${Math.round(after / 1024)} KB gzipped`);
