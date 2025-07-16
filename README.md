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

```bash
git clone https://github.com/legel/terrain-3d.git
cd terrain-3d
pip install -r requirements.txt
python server.py
# Open http://localhost:5001
```

**No build system** - Edit files, refresh browser. API keys hardcoded (security issue for production).

## 🏗 Architecture

**Key Files** (see TECHNICAL.md for details):
- `utilities.js` - Core logic (1700+ lines, handle with care)
- `layerControls.js` - Complex UI state management
- `CesiumManager.js` - 3D rendering + polygon clicks
- `focusPanel.js` - Ecological metrics display
- Everything on `window` object (no modules)

## 🔬 Technical Specifications

- **Rendering Engine**: Cesium.js 1.121 with 3D Gaussian Splatting support
- **Data Sources**: PIX4Dmatic mesh tiles, .spz files, GIS layers
- **Coordinate System**: WGS84 (EPSG:4326) with RTK precision
- **Performance**: Optimized for 60fps on modern hardware
- **Compatibility**: Chrome 80+, Firefox 75+, Safari 13+, Edge 80+

## 🌍 Mission Alignment

Terrain 3D directly supports Ecodash's mission to **"Cultivate thriving ecosystems across the planet through computational ecology and human creativity"** by providing:

- **Design Intelligence**: Tools that translate ecological science into actionable landscape design
- **3D Ecological Digital Twins**: Photorealistic simulations showing landscapes across seasons
- **Native Plant Network**: Connections between ecological knowledge and commercial availability

## 🤝 Contributing

1. **Read Documentation**: Start with [Terrain3D.md](Terrain3D.md) for technical details
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