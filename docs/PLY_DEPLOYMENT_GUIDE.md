# PLY Deployment Guide for Progressive Loading

This guide details the process for deploying Gaussian Splat PLY files using the progressive binary chunk loading system. This system enables fast, parallel downloads of large splat files for optimal user experience.

## Overview

The progressive loading system works by:
1. Splitting a large PLY file into 100 binary chunks
2. Uploading chunks to Google Cloud Storage
3. Creating a manifest file that references all chunks
4. The browser downloads chunks in parallel (5 at a time)
5. Chunks are concatenated back into the original PLY file
6. SuperSplat loads the complete file

### Benefits
- **Fast loading**: Parallel downloads with staggered queue (5 concurrent)
- **Progress tracking**: Accurate 10-70% progress during downloads
- **Fault tolerance**: Failed chunks can be retried independently
- **CDN optimization**: Small chunks cache better than monolithic files
- **No splat artifacts**: Single file prevents race conditions and rendering glitches

## Prerequisites

- Google Cloud SDK (`gcloud` CLI) installed and configured
- Access to your Google Cloud Storage bucket
- Original uncompressed PLY file from Gaussian splatting pipeline
- Bash environment (Linux/Mac or WSL on Windows)
- Environment variables configured (see CLOUD_CONFIG.md)

## Step 1: Split PLY into Binary Chunks

### Create the Splitting Script

The splitting script divides any file into exactly N binary chunks at byte boundaries.

Create `/tmp/binary_split.sh`:

```bash
#!/bin/bash

if [ "$#" -ne 3 ]; then
    echo "Usage: $0 <input_file> <output_dir> <num_chunks>"
    echo "Example: $0 splat.ply /tmp/chunks 100"
    exit 1
fi

INPUT_FILE="$1"
OUTPUT_DIR="$2"
NUM_CHUNKS="$3"

if [ ! -f "$INPUT_FILE" ]; then
    echo "Error: Input file '$INPUT_FILE' not found"
    exit 1
fi

mkdir -p "$OUTPUT_DIR"

FILE_SIZE=$(stat -f%z "$INPUT_FILE" 2>/dev/null || stat -c%s "$INPUT_FILE")
CHUNK_SIZE=$((FILE_SIZE / NUM_CHUNKS))
REMAINDER=$((FILE_SIZE % NUM_CHUNKS))

echo "Splitting file: $INPUT_FILE"
echo "Total size: $FILE_SIZE bytes"
echo "Chunk size: $CHUNK_SIZE bytes"
echo "Number of chunks: $NUM_CHUNKS"
echo "Output directory: $OUTPUT_DIR"
echo ""

for i in $(seq 0 $((NUM_CHUNKS - 1))); do
    PADDED=$(printf "%03d" $i)
    OUTPUT_FILE="$OUTPUT_DIR/chunk_${PADDED}.bin"
    OFFSET=$((i * CHUNK_SIZE))

    if [ $i -eq $((NUM_CHUNKS - 1)) ]; then
        SIZE=$((CHUNK_SIZE + REMAINDER))
    else
        SIZE=$CHUNK_SIZE
    fi

    echo "Creating chunk $PADDED: offset=$OFFSET size=$SIZE"
    dd if="$INPUT_FILE" of="$OUTPUT_FILE" bs=1 skip=$OFFSET count=$SIZE 2>/dev/null
done

echo ""
echo "Split complete! Created $NUM_CHUNKS chunks in $OUTPUT_DIR"
ls -lh "$OUTPUT_DIR"
```

Make it executable:
```bash
chmod +x /tmp/binary_split.sh
```

### Run the Split

Split your PLY file into 100 chunks:

```bash
# Example: Split demo-site splat
/tmp/binary_split.sh \
    /path/to/your/splat.ply \
    /tmp/splat_chunks \
    100
```

Expected output:
```
Splitting file: splat.ply
Total size: 126564033 bytes
Chunk size: 1265640 bytes
Number of chunks: 100
Output directory: /tmp/splat_chunks

Creating chunk 000: offset=0 size=1265640
Creating chunk 001: offset=1265640 size=1265640
...
Creating chunk 099: offset=124373160 size=2190873

Split complete! Created 100 chunks in /tmp/splat_chunks
```

### Verify Chunks

Check that all 100 chunks were created:
```bash
ls /tmp/splat_chunks | wc -l  # Should output: 100
du -sh /tmp/splat_chunks        # Should match original file size
```

## Step 2: Upload Chunks to Google Cloud Storage

### Bucket Structure

Store chunks in your GCS bucket with this structure:
```
gs://${GCS_BUCKET}/splats/chunks/${SITE_ID}/
├── chunk_000.bin
├── chunk_001.bin
├── chunk_002.bin
...
└── chunk_099.bin
```

### Upload to GCS

Upload all chunks in parallel using `gsutil`:

```bash
# Set your site ID
SITE_ID="your-site-name"

# Upload chunks (using environment variable for bucket name)
gsutil -m cp /tmp/splat_chunks/*.bin gs://${GCS_BUCKET}/splats/chunks/${SITE_ID}/
```

The `-m` flag enables parallel uploads for faster transfer.

### Verify Upload

```bash
# List uploaded chunks
gsutil ls gs://${GCS_BUCKET}/splats/chunks/${SITE_ID}/ | wc -l  # Should be 100

# Check total size
gsutil du -sh gs://${GCS_BUCKET}/splats/chunks/${SITE_ID}/

# Test a single chunk URL (should return binary data)
curl -I https://storage.googleapis.com/${GCS_BUCKET}/splats/chunks/${SITE_ID}/chunk_000.bin
```

Expected response headers:
```
HTTP/2 200
content-type: application/octet-stream
access-control-allow-origin: *
content-length: 1265640
```

## Step 3: Create Manifest File

### Manifest Structure

The manifest file tells the browser where to find all chunks and how to assemble them.

Create `data/${SITE_ID}/${SITE_ID}_manifest.json`:

```json
{
  "site_id": "your-site-name",
  "total_parts": 100,
  "total_size": 126564033,
  "chunk_size": 1265640,
  "base_url": "https://storage.googleapis.com/${GCS_BUCKET}/splats/chunks/your-site-name",
  "parts": [
    {
      "index": 0,
      "filename": "chunk_000.bin",
      "url": "https://storage.googleapis.com/${GCS_BUCKET}/splats/chunks/your-site-name/chunk_000.bin"
    },
    {
      "index": 1,
      "filename": "chunk_001.bin",
      "url": "https://storage.googleapis.com/${GCS_BUCKET}/splats/chunks/your-site-name/chunk_001.bin"
    }
  ]
}
```

### Generate Manifest Automatically

Use this script to generate the manifest from your chunks:

```bash
#!/bin/bash
# generate_manifest.sh

SITE_ID="$1"
CHUNKS_DIR="$2"
OUTPUT_FILE="data/${SITE_ID}/${SITE_ID}_manifest.json"

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <site_id> <chunks_dir>"
    echo "Example: $0 demo-site /tmp/splat_chunks"
    exit 1
fi

# Calculate total size
TOTAL_SIZE=$(du -sb "$CHUNKS_DIR" | cut -f1)

# Calculate average chunk size
NUM_FILES=$(ls "$CHUNKS_DIR"/*.bin | wc -l)
CHUNK_SIZE=$((TOTAL_SIZE / NUM_FILES))

# Start JSON
cat > "$OUTPUT_FILE" <<EOF
{
  "site_id": "$SITE_ID",
  "total_parts": $NUM_FILES,
  "total_size": $TOTAL_SIZE,
  "chunk_size": $CHUNK_SIZE,
  "base_url": "https://storage.googleapis.com/${GCS_BUCKET}/splats/chunks/${SITE_ID}",
  "parts": [
EOF

# Generate parts array
INDEX=0
for FILE in "$CHUNKS_DIR"/*.bin; do
    FILENAME=$(basename "$FILE")

    if [ $INDEX -gt 0 ]; then
        echo "," >> "$OUTPUT_FILE"
    fi

    cat >> "$OUTPUT_FILE" <<EOF
    {
      "index": $INDEX,
      "filename": "$FILENAME",
      "url": "https://storage.googleapis.com/${GCS_BUCKET}/splats/chunks/${SITE_ID}/$FILENAME"
    }
EOF

    INDEX=$((INDEX + 1))
done

# Close JSON
cat >> "$OUTPUT_FILE" <<EOF

  ]
}
EOF

echo "Manifest created: $OUTPUT_FILE"
echo "Remember to replace \${GCS_BUCKET} with your actual bucket name"
```

Usage:
```bash
chmod +x generate_manifest.sh
./generate_manifest.sh your-site-name /tmp/splat_chunks
```

## Step 4: Configure Site Data

### Site Bounds Configuration

Create or update `data/${SITE_ID}/site-bounds.json` with coordinate transformation parameters:

```json
{
  "minLongitude": -118.54076,
  "maxLongitude": -118.53913,
  "minLatitude": 34.04522,
  "maxLatitude": 34.04648,
  "centerLongitude": -118.53994,
  "centerLatitude": 34.04585,
  "originX": -118.53994,
  "originY": 34.04585,
  "rotation": 0
}
```

These values are used to:
- Transform geographic coordinates (lon/lat) to SuperSplat world space
- Position polygon overlays correctly on the splat
- Define the bounding box for camera controls

### How to Obtain Bounds

1. **From drone survey metadata**: Most photogrammetry software exports bounding coordinates
2. **From GeoJSON data**: Extract bounds from your plantable area polygons
3. **From SuperSplat Lab**: Load the splat and note the coordinate range

## Step 5: Test Locally

### Start Development Server

```bash
python server.py
```

The server runs on `http://localhost:5001` by default.

### Test the Loading Sequence

1. Open browser to `http://localhost:5001`
2. Open Developer Console (F12)
3. Watch for progressive loading messages

Expected console output:
```
[ProgressivePlyLoader] Fetching manifest: /api/splat-manifest/your-site
[ProgressivePlyLoader] Manifest loaded: 100 parts, 126564033 bytes total
[ProgressivePlyLoader] Starting staggered downloads (5 concurrent)
[ProgressivePlyLoader] Downloaded part 0/100 (1265640 bytes)
...
[ProgressivePlyLoader] All parts downloaded, concatenating...
[SuperSplatManager] Loading complete PLY file
[SuperSplatManager] Rendering complete
```

### Verify Progress Stages

Watch the loading screen progress bar:
- **0-10%**: Initialization and manifest fetch
- **10-70%**: Downloading 100 chunks (staggered, 5 concurrent)
- **70-99%**: Counting up while SuperSplat loads
- **99%**: Hangs until rendering complete
- **100%**: Fade out

## Step 6: Deploy to Production

### Commit Changes

```bash
# Add manifest and site data
git add data/${SITE_ID}/${SITE_ID}_manifest.json
git add data/${SITE_ID}/site-bounds.json

# Commit with descriptive message
git commit -m "Add progressive loading for ${SITE_NAME} Gaussian splat"

# Push to repository
git push origin main
```

### Deploy to Server

Follow your deployment workflow (see your internal deployment documentation).

## Troubleshooting

### Chunks Not Downloading

**Symptoms**: Progress stuck at 10%, browser console shows 404 errors

**Solutions**:
1. Verify chunks uploaded to GCS: `gsutil ls gs://${GCS_BUCKET}/splats/chunks/${SITE_ID}/`
2. Check CORS configuration (see CLOUD_CONFIG.md)
3. Test direct chunk URL in browser
4. Verify manifest URLs match actual GCS paths

### Progress Jumps from 70% to 100%

**Symptoms**: No counting animation between 70-99%

**Solutions**:
1. Check browser console for JavaScript errors
2. Verify `superSplatManager.js` has `countUpProgressWithLoading()` method
3. Test with smaller splat file to isolate timing issues

### Concatenation Fails

**Symptoms**: Error after downloads complete, splat doesn't render

**Solutions**:
1. Verify all 100 chunks downloaded: Check browser Network tab
2. Check total downloaded size matches manifest `total_size`
3. Test chunk integrity: Download a chunk and verify size
4. Check browser console for Blob API errors

### SuperSplat Won't Load File

**Symptoms**: Progress reaches 100% but splat doesn't render

**Solutions**:
1. Verify original PLY file is valid (test in SuperSplat desktop app)
2. Check that concatenated file size matches original
3. Verify SuperSplat scene initialized: `window.scene` should exist
4. Check for memory issues (large files require sufficient RAM)
5. Review browser console for SuperSplat errors

## File Reference

### Required Files per Site

```
digitaltwin/
├── data/
│   └── ${SITE_ID}/
│       ├── ${SITE_ID}_manifest.json      # Chunk locations and metadata
│       ├── site-bounds.json              # Coordinate transformation config
│       └── plantable-areas.geojson       # Plantable areas (optional)
└── js/
    ├── core/
    │   └── progressivePlyLoader.js       # Download and concatenation logic
    └── rendering/
        └── superSplatManager.js          # SuperSplat integration
```

### GCS Storage Structure

```
gs://${GCS_BUCKET}/splats/chunks/
├── site-1/
│   ├── chunk_000.bin
│   ├── chunk_001.bin
│   └── ...
└── site-2/
    ├── chunk_000.bin
    ├── chunk_001.bin
    └── ...
```

## Performance Metrics

### Typical Example

- **Original PLY size**: 100-150 MB
- **Chunk count**: 100
- **Average chunk size**: 1-1.5 MB
- **Concurrent downloads**: 5
- **Total download time**: 15-30 seconds (varies by connection)
- **Progress accuracy**: ±2%
- **Assembly time**: <1 second
- **SuperSplat load time**: 5-10 seconds

### Optimization Guidelines

- **Chunk count**: 100 is optimal for 100-150MB files
- **Concurrent downloads**: 5 prevents browser throttling
- **Chunk size range**: 1-2 MB per chunk is ideal
- **CDN**: Consider CloudFlare or GCS CDN for global users

## Advanced Configuration

### Custom Chunk Count

For different file sizes, adjust chunk count:

```bash
# Small files (20-50 MB): 50 chunks
/tmp/binary_split.sh splat.ply /tmp/chunks 50

# Medium files (100-150 MB): 100 chunks
/tmp/binary_split.sh splat.ply /tmp/chunks 100

# Large files (200+ MB): 150 chunks
/tmp/binary_split.sh splat.ply /tmp/chunks 150
```

### Concurrent Download Tuning

Edit `js/core/progressivePlyLoader.js`:

```javascript
constructor() {
    this.concurrentDownloads = 5;  // Adjust between 3-10
}
```

**Guidelines**:
- **3 concurrent**: Conservative, better for slow connections
- **5 concurrent**: Balanced, default setting
- **10 concurrent**: Aggressive, risk of browser throttling

## Environment Variables

This guide uses environment variables for sensitive configuration:
- `GCS_BUCKET`: Your Google Cloud Storage bucket name
- `GCS_PROJECT`: Your Google Cloud project ID

See CLOUD_CONFIG.md for complete environment setup instructions.

## License

This deployment system is part of the digital twin platform project. See repository LICENSE for details.
