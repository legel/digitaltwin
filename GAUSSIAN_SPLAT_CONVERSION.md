# Gaussian Splat Conversion Pipeline

> **⚠️ DEPRECATED**: This guide is for the legacy Cesium-based workflow. The current Terrain 3D application uses SuperSplat with progressive binary chunk loading.
>
> **📖 See PLY_DEPLOYMENT_GUIDE.md** for the current deployment workflow using:
> - Binary chunk splitting (100 chunks)
> - Google Cloud Storage upload
> - Manifest creation
> - Progressive parallel loading (5 concurrent downloads)
>
> The workflow below is preserved for historical reference only.

This guide details the complete process for converting .ply Gaussian splat files into the Cesium-compatible format used by the legacy version of Terrain 3D. The pipeline transforms raw Gaussian splat data into optimized 3D tilesets with optional clipping geometry.

## Pipeline Overview

```
.ply file → .spz file → tileset.json + content.glb → data/[site-id]/
```

1. **PLY to SPZ Conversion** - Compress and optimize Gaussian splat data
2. **SPZ to Tileset Generation** - Create Cesium 3D Tiles format  
3. **Transform Configuration** - Set geospatial positioning
4. **Clipping Polygon Creation** - Define visible regions (optional)
5. **Integration** - Deploy to Terrain 3D data directory

## Prerequisites

- Linux environment (Ubuntu/Debian recommended)
- C++17 compiler and build tools
- Node.js for tileset generation
- Geospatial data (coordinates, clipping boundaries)

## Step 1: PLY to SPZ Conversion

### Tool: ply-to-spz Converter

Convert uncompressed PLY Gaussian splat files to compressed SPZ format for web optimization.

**Repository**: https://github.com/TASallin/ply-to-spz

### Installation

```bash
# Install build dependencies
sudo apt install build-essential zlib1g-dev

# Clone the converter
git clone https://github.com/TASallin/ply-to-spz.git
cd ply-to-spz

# Build the converter
make
```

### Usage

```bash
# Convert PLY to SPZ
./ply_to_spz_converter input.ply output.spz

# Example
./ply_to_spz_converter demo_site.ply demo_site.spz
```

### Performance Benefits

- **Compression**: ~91% size reduction (658MB PLY → 58MB SPZ)
- **Web Optimization**: SPZ format designed for efficient web streaming
- **Coordinate Conversion**: Automatic RDF to LUF coordinate system transformation
- **Preservation**: Original PLY files remain unchanged

### Troubleshooting

- Ensure PLY files are uncompressed format
- Verify zlib development headers are installed
- Confirm C++17 compiler support
- Check PLY file format compatibility

---

## Step 2: SPZ to Cesium Tileset

### Tool: JSpz Converter

Convert compressed SPZ files to Cesium 3D Tiles format (content.glb + tileset.json). Note that Cesium does not read .spz files directly - it requires the tileset format for proper rendering.

**Repository**: https://github.com/TASallin/JSpz

### Prerequisites

- Java 8 or higher (JDK required)
- Apache Maven 3.6 or higher
- Python 3.6+ (for Python wrapper)
- **JAVA_HOME environment variable must be set**
- SPZ file (output from Step 1)

### Installation

```bash
# Clone the JSpz converter
git clone https://github.com/TASallin/JSpz.git
cd JSpz

# Build the project (one-time setup)
mvn clean install

# Set JAVA_HOME if not already set
# Windows: Set environment variable JAVA_HOME to your JDK path
# Linux/Mac: export JAVA_HOME=/path/to/jdk
```

### Usage Options

#### Option 1: Python Wrapper (Recommended)

**GUI Mode** (easiest for beginners):
```bash
python spz_converter.py --gui
```
1. Click "Browse" to select your SPZ file
2. Click "Browse" to select output directory
3. Optionally change content filename (default: content.glb)
4. Click "Convert" and monitor progress

**Command Line Mode**:
```bash
# Basic usage
python spz_converter.py input.spz output_directory/

# With custom content filename
python spz_converter.py input.spz output_directory/ --content-name my_model.glb

# Examples
python spz_converter.py ./data/demo_site.spz ./output/
python spz_converter.py ./data/my_model.spz ./cesium_assets/ --content-name gaussian_splats.glb
```

#### Option 2: Direct Maven (Advanced)

```bash
# Convert using Maven directly
mvn exec:java -Dexec.mainClass="de.javagl.jspz.examples.SpzToTileset" \
  -Dexec.args="input.spz output_directory/ content.glb" \
  -pl jspz-main

# Example
mvn exec:java -Dexec.mainClass="de.javagl.jspz.examples.SpzToTileset" \
  -Dexec.args="demo_site.spz ./output/ content.glb" \
  -pl jspz-main
```

### Output Files

The conversion generates two files that Cesium can directly load:

1. **tileset.json**: Cesium 3D Tiles metadata containing:
   - Bounding volume information
   - Transform matrices
   - Content references
   - Level-of-detail information

2. **content.glb**: Binary glTF file containing:
   - Compressed Gaussian splat geometry
   - Web-optimized streaming format
   - Cesium-compatible rendering data

**Important**: Cesium cannot read .spz files directly. The tileset format is required for proper integration with Cesium's rendering pipeline.

### Coordinate System Conversion

The tool automatically converts from SPZ coordinate system (RUB) to glTF coordinate system (LUF) for proper display in Cesium.

### Troubleshooting

**Common Issues**:

- **"JAVA_HOME environment variable is not set"**
  - Set JAVA_HOME to your JDK installation directory
  - Restart terminal/command prompt after setting

- **"Maven not found in PATH"**
  - Install Apache Maven and add to system PATH
  - On Windows, use `mvn.cmd` instead of `mvn` if needed

- **Build fails**
  - Ensure Java 8+ JDK (not just JRE) and Maven are installed
  - Run `mvn clean install` from root directory first
  - Check that JAVA_HOME points to JDK, not JRE

- **Python wrapper fails**
  - Ensure Python 3.6+ is installed
  - Install tkinter for GUI mode: `pip install tk`
  - Verify Java project builds successfully first

- **Conversion fails**
  - Verify SPZ file is valid and not corrupted
  - Check file permissions on input/output directories
  - Ensure no spaces in input/output file paths
  - Look at detailed error messages in log

## Step 3: Transform Configuration

### Tool: Cesium SPZ Transform Editor

Interactive web application for positioning, scaling, and rotating Gaussian splat tilesets within Cesium's coordinate system.

**Repository**: https://github.com/TASallin/cesium-splat-transform-editor

### Installation

```bash
# Clone the transform editor
git clone https://github.com/TASallin/cesium-splat-transform-editor.git
cd cesium-splat-transform-editor

# Install Python dependencies
pip install -r requirements.txt

# Start the web server
python server.py

# Access via browser
# http://localhost:5002
```

### Usage

1. **Load Required Files**:
   - `tileset.json` (from Step 2)
   - `content.glb` (from Step 2)
   - `reference.geojson` (geospatial reference data)

2. **Interactive Transform Controls**:
   - **Position**: X/Y/Z sliders (-200 to 10,000 range)
   - **Scale**: 0-100 adjustable factor for sizing
   - **Rotation**: Configurable for proper orientation

3. **Real-time Preview**:
   - Live visualization of transform changes
   - Geographic coordinate conversion (Cartesian ↔ lat/lon)
   - Immediate feedback on positioning accuracy

4. **Export Configuration**:
   - Generates transform matrix for tileset.json
   - Saves positioning data for reuse
   - Preserves geospatial accuracy

### Transform Matrix

The tool generates a transformation matrix that positions the Gaussian splat correctly within the global coordinate system, ensuring proper alignment with terrain and other geospatial data.

## Step 4: Clipping Polygon Creation (Optional)

### Tool: Gaussian Splat Bounds Processor

Generate precise 3D clipping polygons from Gaussian splat data to define visible regions and optimize rendering performance.

**Repository**: https://github.com/TASallin/splat-bounds-processor

### Prerequisites

- Python 3.7 or higher
- SPZ or PLY file from previous steps

### Installation

```bash
# Clone the bounds processor
git clone https://github.com/TASallin/splat-bounds-processor.git
cd splat-bounds-processor

# Install dependencies
pip install numpy>=1.19.0 scikit-learn>=0.24.0 scipy>=1.6.0
```

### Usage

```bash
# Basic usage with SPZ file
python splat_bounds_processor.py input.spz

# Recommended settings for Cesium integration
python splat_bounds_processor.py input.spz --bounds-method polygonal_prism

# Example with Demo Site
python splat_bounds_processor.py demo_site.spz --bounds-method polygonal_prism
```

### Output Format

The tool generates a `clipping-polygon.json` file with the following structure:

```json
{
  "vertices_3d": [
    x1, y1, z1,  // Bottom polygon vertices
    x2, y2, z2,
    ...
    x1, y1, z1_top,  // Top polygon vertices (extruded)
    x2, y2, z2_top,
    ...
  ],
  "type": "polygonal_prism",
  "polygon_method": "convex_hull",
  "vertex_count": 38,
  "metadata": {
    "description": "Generated polygonal prism from Gaussian splat bounds using convex_hull",
    "base_vertices": 19,
    "total_vertices": 38,
    "generated": true,
    "note": "3D vertices: first N are bottom polygon, next N are top polygon"
  }
}
```

### Configuration Options

- **Bounding Methods**:
  - `rectangular`: Simple bounding box
  - `polygonal_prism`: Polygonal boundary (recommended)
  - `convex_hull`: Convex hull approximation
  - `concave_hull`: Concave hull approximation

- **Polygon Processing**:
  - Outlier detection and filtering
  - Coordinate system transformations (Y-up to Z-up)
  - Configurable polygon complexity

### Benefits

- **Performance**: Reduces rendering load by clipping unnecessary areas
- **Precision**: Exact bounds from actual Gaussian splat data
- **Flexibility**: Multiple boundary methods for different use cases
- **Integration**: Direct compatibility with Cesium clipping planes

## Step 5: Integration with Terrain 3D

### Final Deployment

Move the generated files to the Terrain 3D data directory for use in the application.

### Directory Structure

Each site requires its own folder in the `data/` directory:

```
data/[site-id]/
├── tileset.json          # From Step 2 (JSpz conversion)
├── content.glb           # From Step 2 (JSpz conversion)
├── clipping-polygon.json # From Step 4 (optional, bounds processor)
└── [site-name].geojson   # Additional site data (optional)
```

### Deployment Steps

```bash
# 1. Create site directory
mkdir -p data/my-site-name

# 2. Copy tileset files from Step 2
cp output/tileset.json data/my-site-name/
cp output/content.glb data/my-site-name/

# 3. Copy clipping polygon from Step 4 (if created)
cp clipping-polygon.json data/my-site-name/

# 4. Add any additional site-specific GeoJSON data
cp site-data.geojson data/my-site-name/My_Site_Name.geojson
```

### Example: Demo Site

Reference implementation showing proper file organization:

```
data/sites/demo-site/
├── tileset.json                        # Cesium 3D Tiles metadata
├── content.glb                         # Compressed Gaussian splat data
├── clipping-polygon.json               # 3D boundary definition
└── plantable-area-data.geojson  # Additional site data
```

### Integration with Terrain 3D

1. **Site Detection**: Terrain 3D automatically scans the `data/` directory for available sites
2. **Tileset Loading**: `tileset.json` files are loaded by the GaussianSplatManager
3. **Clipping Integration**: `clipping-polygon.json` enables selective rendering
4. **GeoJSON Layers**: Additional `.geojson` files appear as overlay options

### File Naming Conventions

- **Directory names**: Use lowercase with hyphens (e.g., `demo-site`)
- **Required files**: `tileset.json` and `content.glb` must be present
- **Optional files**: `clipping-polygon.json` for clipping, `.geojson` for overlays
- **GeoJSON naming**: Can match site name or describe content purpose

### Testing Integration

1. Start the Terrain 3D development server: `python server.py`
2. Open http://localhost:5001
3. Check that your new site appears in the site selector dropdown
4. Verify the Gaussian splat loads correctly
5. Test clipping functionality if `clipping-polygon.json` is present

---

## File Structure

Final output structure for each site:

```
data/[site-id]/
├── tileset.json          # Cesium 3D Tiles metadata
├── content.glb           # Compressed 3D content
└── clipping-polygon.json # Optional clipping geometry
```

## Notes

- This pipeline optimizes Gaussian splats for real-time 3D rendering
- Each step builds upon the previous conversion
- Geospatial accuracy is preserved throughout the pipeline
- Clipping polygons enable selective rendering of large datasets