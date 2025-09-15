# Terrain 3D

**Ecological Digital Twin Platform for Landscape Design**

Terrain 3D is a sophisticated 3D visualization platform that enables landscape designers to create photorealistic digital twins of landscapes and design native plant-based solutions that maximize ecosystem services. Part of [Ecodash](docs/ecodash-company-manifesto.md)'s computational ecology mission.

## 🦋 Platform Overview

### Ecological Focus
- **Native Plant Emphasis**: Prioritizes native species for maximum ecosystem function
- **Scientific Integration**: Visualizes soil chemistry, microclimates, and ecological models as interactive 3D layers
- **Pollinator Habitat**: Optimizes designs for bee and butterfly habitat across seasons
- **Ecosystem Services**: Quantifies environmental benefits like carbon sequestration and stormwater management

### Photorealistic Precision
- **"Enter the Matrix"**: Minimal visual difference between digital interface and reality
- **3D Gaussian Splatting**: Advanced neural network reconstruction for lifelike rendering
- **RTK Photography & LiDAR**: Geospatially accurate capture from drone and ground surveys
- **Real-time Performance**: Zero-lag interaction for immersive design experience

## 🌺 Core Capabilities

### 3D Digital Twin Visualization
- **Existing Landscapes**: Photorealistic 3D models of current site conditions
- **Design Scenarios**: Interactive simulation of proposed landscape changes
- **Plant Placement**: 3D models of native plants with seasonal growth simulation
- **Export Tools**: High-resolution renders and technical documentation for implementation

### Scientific Model Integration
- **Soil Analysis**: pH, nitrogen, phosphorus, potassium mapping
- **Microclimate**: Sunlight hours, moisture, wind exposure analysis  
- **Risk Assessment**: Drought, flood, and extreme weather probability zones
- **Habitat Quality**: Native plant compatibility and ecosystem service potential

### Commercial Integration
- **Native Plant Explorer**: Connect with local nursery inventory and availability
- **Growth Contracting**: Custom plant production timelines and volumes
- **One-Click Ordering**: Streamlined purchasing from native plant growers
- **Supply Chain**: Logistics coordination for planting schedules

## 📁 Documentation

- **[TECHNICAL.md](TECHNICAL.md)**: Architecture, implementation details, and AI agent guide
- **[CLAUDE.md](CLAUDE.md)**: AI development guidelines with critical gotchas
- **[REQUIREMENTS.md](REQUIREMENTS.md)**: Functional specifications and future roadmap
- **[KNOWN_ISSUES.md](KNOWN_ISSUES.md)**: Active bugs and limitations

## 🛠 Quick Start

### 1. Clone and Setup Terrain 3D
```bash
git clone https://github.com/legel/terrain-3d.git
cd terrain-3d
pip install -r requirements.txt
```

### 2. Build Cesium Dependencies
```bash
# Clone Cesium repository
git clone https://github.com/CesiumGS/cesium.git
cd cesium

# Use tested version (optional - can use latest)
git checkout 7103190

# Build Cesium
npm install
npm run build

# Copy build to terrain-3d (create directory first)
mkdir -p ../terrain-3d/cesium
cp -r Build/CesiumUnminified/* ../terrain-3d/cesium/
cd ../terrain-3d
```

### 3. Build SuperSplat Dependencies
```bash
# Clone custom SuperSplat repository (in terrain-3d directory)
git clone https://github.com/TASallin/supersplat-terrain-3d.git
cd supersplat-terrain-3d

# Initialize submodules and install dependencies
git submodule update --init
npm install  # Cross-platform compatible (Windows-specific deps removed)

# Build SuperSplat
npm run build

# Copy built files to terrain-3d root for serving
cp -r dist/* ../supersplat/
cd ..
```

The SuperSplat application files are built in `supersplat-terrain-3d/dist/` and copied to `supersplat/` where they are served by the terrain-3d server.

### 4. Server File Serving (Already Configured)
The terrain-3d `server.py` serves SuperSplat files through its generic static file route:

```python
# Serve static files (CSS, JS, images) - includes SuperSplat files in supersplat/ directory
@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)
```

This automatically serves SuperSplat files from the `supersplat/` directory, allowing the terrain-3d interface to load SuperSplat in iframe mode at `/supersplat/index.html`.

### 5. Start Development Server
```bash
python server.py
# Open http://localhost:5001
```

**No build system** - Edit files, refresh browser. API keys hardcoded (security issue for production).

### Troubleshooting

**Cesium Build Issues:**
- If `npm install` shows vulnerabilities, they can be ignored for development
- If `git checkout 7103190` fails, ensure you're in the cesium directory
- If Cesium files return 404 errors, verify the `cesium/` directory exists and contains `Cesium.js` and `Widgets/widgets.css`
- Build size warnings (⚠️) are normal and can be ignored

**SuperSplat Build Issues:**
- Requires Node.js and npm for building from source
- **Cross-Platform Compatible**: Windows-specific dependencies have been removed from package.json - `npm install` works on Linux/macOS/Windows
- If `git submodule update --init` fails, ensure you have git installed and configured
- If `npm install` shows vulnerabilities, they can be ignored for development
- **TypeScript Warnings**: Build may show TS2345/TS2769 warnings about ArrayBuffer types - these can be ignored, build will complete successfully
- If build fails, try `npm run develop` first to test the development environment
- **Build and Copy**: SuperSplat builds to `supersplat-terrain-3d/dist/` and must be copied to `supersplat/` for serving
- **Repository**: Use the custom fork `https://github.com/TASallin/supersplat-terrain-3d.git`, not the original PlayCanvas repository  
- **File Serving**: Files are served from `supersplat/` directory via the generic static file route in `server.py`
- **Copy Command**: After building, run `cp -r supersplat-terrain-3d/dist/* supersplat/` to deploy changes

## 🏗 Architecture

**Key Files** (see TECHNICAL.md for details):
- `utilities.js` - Core logic (1700+ lines, handle with care)
- `layerControls.js` - Complex UI state management
- `CesiumManager.js` - 3D rendering + polygon clicks
- `focusPanel.js` - Ecological metrics display
- Everything on `window` object (no modules)

## 🔬 Technical Specifications

- **Rendering Engine**: Cesium.js (local build from commit 7103190) with 3D Gaussian Splatting support
- **Data Sources**: PIX4Dmatic mesh tiles, .spz files, GIS layers
- **Coordinate System**: WGS84 (EPSG:4326) with RTK precision
- **Performance**: Optimized for 60+fps with **advanced Gaussian Splat prioritization**
- **Compatibility**: Chrome 80+, Firefox 75+, Safari 13+, Edge 80+

### 🚀 Performance Optimizations

**Gaussian Splat Rendering Performance**: The platform implements advanced performance optimizations specifically targeting smooth 60+fps Gaussian Splat rendering during camera transformations:

- **Adaptive Motion Mode**: Dynamic quality reduction during camera movement with progressive restoration
- **Resource Prioritization**: Google Photorealistic tiles heavily deprioritized to maximize Gaussian Splat resources
- **High-Frequency Rendering**: 120fps render pipeline during camera movement
- **GPU Optimization**: WebGL context optimized for high-performance rendering with dynamic resolution scaling
- **Zero-Allocation Processing**: Memory-optimized camera movement detection to prevent garbage collection pauses

**Key Performance Results**:
- **Maximum Gaussian Splat render frequency** during camera transformations
- **8ms response time** for mouse interactions (improved from 100ms)
- **16-21 SSE quality maintained** during motion (vs 32-96 SSE before optimization)
- **Ultra-sensitive motion detection** with 0.5m/0.05 radian thresholds
- **0.25s quality restoration** when movement stops (4x faster than before)

See `PERFORMANCE.md` for detailed technical implementation of these optimizations.

## 🌍 Mission Alignment

Terrain 3D directly supports Ecodash's mission to **"Cultivate thriving ecosystems across the planet through computational ecology and human creativity"** by providing:

- **Design Intelligence**: Tools that translate ecological science into actionable landscape design
- **3D Ecological Digital Twins**: Photorealistic simulations showing landscapes across seasons
- **Native Plant Network**: Connections between ecological knowledge and commercial availability

## 🤝 Contributing

1. **Read Documentation**: Start with [TECHNICAL.md](TECHNICAL.md) for technical details
2. **Fork Repository**: Create your feature branch
3. **Follow Principles**: Maintain ecological focus and visual fidelity standards
4. **Test Thoroughly**: Verify across different devices and use cases
5. **Submit PR**: Include clear description of ecological benefits

## 📄 License

Copyright Ecological Intelligence, Inc.

## 🙏 Acknowledgments

- **[Cesium](https://cesium.com/)**: 3D globe rendering and geospatial accuracy
- **[Google Maps Platform](https://developers.google.com/maps)**: Satellite imagery and mapping
- **Native Plant Community**: Growers, researchers, and designers preserving genetic heritage
- **Landscape Professionals**: Practitioners shaping millions of acres annually for ecological function