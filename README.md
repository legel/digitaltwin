# Terrain 3D

**Ecological Digital Twin Platform for Landscape Design**

Terrain 3D is a sophisticated 3D visualization platform that enables landscape designers to create photorealistic digital twins of landscapes and design native plant-based solutions that maximize ecosystem services. Part of [Ecodash](docs/ecodash-company-manifesto.md)'s computational ecology mission.

## 🦋 Key Differentiators

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

- **[Terrain3D.md](Terrain3D.md)**: Comprehensive technical specifications and implementation details
- **[CLAUDE.md](CLAUDE.md)**: Development principles and essential values for AI-assisted coding
- **[docs/ecodash-company-manifesto.md](docs/ecodash-company-manifesto.md)**: Company mission and ecological vision

## 🛠 Quick Start

### Prerequisites
- Modern web browser with WebGL support
- API keys for Cesium Ion, Google Maps, and IP Geolocation services

### Installation
```bash
git clone https://github.com/legel/terrain-3d.git
cd terrain-3d
```

### Run Locally
```bash
# Install Python dependencies
pip install -r requirements.txt

# Start Python server
python3 server.py
# Navigate to http://localhost:8000/app.html
```

### Development Workflow
No build system required! Edit JavaScript files directly and refresh browser:
1. **Edit** - Modify files in `/js`, `/css`, or `app.html`
2. **Test** - Refresh browser to see changes
3. **Debug** - Use `debug()` in console for camera position logging

## 🏗 Architecture

**Vanilla JavaScript** with manager-based architecture:

```
├── CesiumManager.js      # 3D globe rendering and controls
├── GoogleMaps2DManager.js # 2D satellite map interface  
├── UserManager.js        # Device detection and geolocation
├── navigation.js         # Guided tour system
├── viewTransform.js      # Seamless 2D/3D view switching
├── narratives.js         # Tour content and waypoints
└── utilities.js          # Shared functions and UI components
```

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