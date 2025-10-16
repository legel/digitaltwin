# Terrain 3D

**Ecological Digital Twin Platform for Landscape Design**

Terrain 3D is a sophisticated 3D visualization platform that enables landscape designers to create photorealistic digital twins of landscapes and design native plant-based solutions that maximize ecosystem services. Part of Ecodash's computational ecology mission.

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
**Requirements**: Node.js 18+ and npm

```bash
git clone https://github.com/legel/terrain-3d.git
cd terrain-3d
pip install -r requirements.txt
```

### 2. Build SuperSplat Dependencies
SuperSplat is fully integrated as local files in the `supersplat-build/` directory:

```bash
# One-command setup for SuperSplat (installs dependencies, builds, and deploys)
npm run setup:supersplat
```

Or run individual steps:
```bash
# Install SuperSplat dependencies
npm run install:supersplat

# Build SuperSplat
npm run build:supersplat  

# Deploy built files to serving directory
npm run deploy:supersplat
```

**Fully Decoupled**: All SuperSplat source code is maintained locally in the `supersplat-build/` directory. The SuperSplat application files are built in `supersplat-build/dist/` and copied to `supersplat/` where they are served by the terrain-3d server. No external repositories or complex dependency management required.

### 3. Server File Serving (Already Configured)
The terrain-3d `server.py` serves SuperSplat files through its generic static file route:

```python
# Serve static files (CSS, JS, images) - includes SuperSplat files in supersplat/ directory
@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)
```

This automatically serves SuperSplat files from the `supersplat/` directory, allowing the terrain-3d interface to load SuperSplat in iframe mode at `/supersplat/index.html`.

### 4. Start Development Server
```bash
python server.py
# Open http://localhost:5001
```

**No build system** - Edit files, refresh browser. API keys hardcoded (security issue for production).

### Troubleshooting

**SuperSplat Build Issues:**
- Requires Node.js 18+ and npm for building from source
- **Cross-Platform Compatible**: Windows-specific dependencies have been removed - `npm install` works on Linux/macOS/Windows
- **Integrated Build**: Use `npm run setup:supersplat` for complete one-command setup
- If `npm install` shows vulnerabilities, they can be ignored for development
- **TypeScript Warnings**: Build may show TS2345/TS2769 warnings about ArrayBuffer types - these can be ignored, build will complete successfully
- **Missing CSS/HTML Files**: The rollup config has been fixed to automatically copy `index.css` and `index.html` to the `dist/` directory during build. If you encounter build errors about missing files in `dist/`, the build system now handles this automatically.
- **File Serving**: Files are served from `supersplat/` directory via the generic static file route in `server.py`
- **Update Workflow**: Use `npm run build:supersplat && npm run deploy:supersplat` to rebuild and deploy changes

## 🏗 Architecture

**Key Files** (see TECHNICAL.md for details):
- `utilities.js` - Core logic (1500+ lines, handle with care)
- `layerControls.js` - Complex UI state management
- `SuperSplatBridge.js` - SuperSplat polygon rendering + event bridge
- `SuperSplatManager.js` - SuperSplat iframe lifecycle management
- `focusPanel.js` - Ecological metrics display
- Everything on `window` object (no modules)

## 🔬 Technical Specifications

- **Rendering Engine**: SuperSplat with native 3D Gaussian Splatting support
- **Data Sources**: .spz files, GIS layers, GeoJSON polygon data
- **Coordinate System**: WGS84 (EPSG:4326) transformed to SuperSplat world space
- **Performance**: Optimized SuperSplat rendering with custom polygon overlays
- **Compatibility**: Chrome 80+, Firefox 75+, Safari 13+, Edge 80+

### 🚀 Performance Optimizations

**SuperSplat Integration**: The platform leverages SuperSplat's native performance optimizations with additional enhancements:

- **Polygon Geometry Caching**: Static geometry cached to avoid redundant GPU uploads during camera movement
- **Shader-Based Overlays**: Polygon rendering uses efficient fragment shaders instead of 3D mesh geometry
- **Transparent Pass Rendering**: Polygons rendered in transparent pass to avoid depth conflicts with ground grid
- **Ray Casting**: Efficient polygon click detection using SuperSplat's coordinate system
- **Event Bridge Optimization**: Minimal overhead bridge between terrain-3d UI and SuperSplat rendering

**Key Performance Features**:
- **Native SuperSplat rendering** for optimal Gaussian splat performance
- **Custom polygon overlay system** with minimal impact on splat rendering
- **Efficient coordinate transformation** from geographic to SuperSplat world space
- **Cached polygon geometry** prevents redundant uploads during interaction

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

- **[SuperSplat](https://github.com/playcanvas/supersplat)**: Advanced 3D Gaussian Splat rendering and visualization
- **Native Plant Community**: Growers, researchers, and designers preserving genetic heritage
- **Landscape Professionals**: Practitioners shaping millions of acres annually for ecological function