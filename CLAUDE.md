# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Application Overview

Terrain 3D is a sophisticated 3D ecological digital twin platform designed to revolutionize landscape design through computational ecology. This application serves as the visualization and interaction layer for Ecodash's mission to maximize ecosystem services through native plant-based landscape design.

### Core Mission
Support landscape designers in creating ecologically functional and beautiful landscapes by providing:
- Photorealistic 3D digital twins of existing landscapes
- Interactive simulation of proposed design scenarios
- Integration with scientific ecological models
- Seamless connection to native plant supply chains

### Primary Use Cases
1. **3D Digital Twin Visualization**: Display geospatially-accurate 3D reconstructions from drone aerial surveys, ground LiDAR, and RTK photography
2. **Ecological Modeling Interface**: Visualize scientific models (soil conditions, microclimates, pollinator habitat potential) as interactive 3D/GIS layers
3. **Design Simulation**: Enable landscape designers to place and visualize native plants in realistic 3D environments
4. **Commercial Integration**: Connect design decisions with native plant nursery inventory and availability

## Architecture - AI Agent Guide

### Critical Understanding
1. **No build system** - Edit files directly, refresh browser to test
2. **Global state on window** - All managers and state accessible via `window.X`
3. **Manager pattern** - Each domain has a dedicated manager class
4. **Event-driven UI** - Layer controls drive visualization through state changes

### File Hierarchy (by importance)
1. **utilities.js** (1700+ lines) - Core visualization logic, do NOT refactor without understanding all dependencies
2. **layerControls.js** - UI state management, complex event handling for PA/NPA/metrics
3. **CesiumManager.js** - 3D rendering, includes polygon click → PA selection logic
4. **focusPanel.js** + **metricChart.js** - Work together for ecological metrics display
5. **main.js** - Simple but critical bootstrap sequence

### Common Pitfalls
- Tour auto-starts and conflicts with user actions
- Layer controls only show for Boyd format sites
- Polygon alpha must be ≥ 0.01 for Cesium picking
- Height adjustment system uses global `currentHeightOffset`
- All visualization re-renders through `visualizeGeoJsonPolygons()`

### CSS Gotchas
- **Z-index hierarchy**: Focus panel (998) < Layer controls (1000) < Connection line (1002)
- **Glass effect**: Uses `backdrop-filter` - check browser support
- **Dropdown width**: Should be 170px (3 buttons), not 230px
- **Unused styles**: styles.css has dead Cesium UI styles
- **Mobile**: Controls relocate to bottom at 767px breakpoint

### Critical Data Flow
```
Site Selection (dropdown) 
→ loadSiteData() 
→ detectGeoJsonFormat() ['boyd'|'legacy']
→ if boyd: toggleParameterFilter() → analyzePA/NPACategories()
→ visualizeGeoJsonPolygons() [main rendering function]
→ Layer controls become interactive
→ User clicks PA/layer → updateVisualization() → visualizeGeoJsonPolygons() again
```

## Development Commands

1. Start server: `python server.py`
2. Open browser: `http://localhost:5001`
3. Edit any JS/CSS file
4. Refresh browser (no build needed)

## Key Implementation Details

### API Keys and Services
- Cesium Ion access token is embedded in CesiumManager.js
- Google Maps API key is loaded dynamically in GoogleMaps2DManager.js
- IP geolocation service (ipgeolocation.io) requires API key in UserManager.js

### Tour System
Tours are defined in `narratives.js` as sequences of waypoints with:
- Camera positions (longitude, latitude, height)
- View angles (heading, pitch, roll)
- Duration and messages to display

### Device-Specific Instructions
The app adapts instructions based on detected device:
- Smartphone: touch gestures
- Laptop with trackpad: two-finger gestures
- Desktop with mouse: click and drag

### Coordinate System
All positions use:
- Longitude/Latitude in degrees
- Height in meters above ground
- Heading/Pitch/Roll in radians for camera orientation

## Essential Development Principles

### Visual Fidelity & Immersion
- **"Enter the Matrix"**: Achieve minimal visual difference between the 3D interface and reality
- **Photorealistic Rendering**: Support for 3D Gaussian Splatting (.spz files) and high-quality mesh tiles from PIX4Dmatic
- **Geospatial Accuracy**: All 3D models must maintain precise Earth coordinates through ground control points

### User Experience Philosophy
- **Minimal UI Footprint**: Get out of the way of designers' creative visualization process
- **Natural User Interface**: Fastest, most intuitive interaction patterns for 3D manipulation
- **Zero Lag Tolerance**: Prioritize performance to maintain immersive experience
- **Scientific Transparency**: Always expose accuracy and precision metadata for all models
- **Glass Morphism Design**: Light greenhouse glass aesthetic with soft diffuse lighting for data visualization
- **Viridis Color Science**: Consistent scientific color mapping for ecological metrics
- **Focus Panel Integration**: Slide-out detailed metrics panel with visual connection to selected areas
- **Smart Camera Positioning**: Automatically frames selected areas at 25% from left edge of screen

### Ecological Integration Requirements
- **Native Plant Focus**: All plant selection and placement tools must prioritize native species
- **Ecosystem Services Metrics**: Integrate quantifiable measures of ecological function
- **Scientific Model Validation**: Implement automatic checks to prevent scientifically invalid data
- **Actionable Intelligence**: Bias towards tools that directly improve landscape design execution

### Data Integration Standards
- **3D Gaussian Splats**: Prepare for integration with .spz file format and new Cesium standards
- **GIS Layer Support**: Seamlessly blend scientific models (soil pH, moisture, sunlight) with 3D visualization
- **Real-time Plant Models**: Support for 3D plant models with seasonal growth simulation
- **Supply Chain Integration**: Connect design decisions with actual nursery inventory and availability

### Development Workflow Priorities
1. **Mesh-based rendering** (current phase): PIX4Dmatic integration with Cesium
2. **Gaussian Splat integration** (current phase): Advanced photorealistic rendering - IMPLEMENTED
3. **Ecological model overlay**: Scientific data visualization on 3D twins
4. **Commercial platform features**: Native plant marketplace integration

## Recent Implementations

### Gaussian Splat Integration (3D Digital Twins)
A comprehensive system for loading and managing 3D Gaussian Splat digital twins:

#### Core Implementation
- **GaussianSplatManager.js**: Complete management system for loading, displaying, and removing Gaussian splats
- **Tileset Loading**: Uses `Cesium.Cesium3DTileset.fromUrl()` method with proper error handling
- **Loading Indicators**: Visual feedback during splat loading with static canvas images
- **Debug Controls**: Development button for removing splats when testing

#### Technical Details
- **File Structure**: Expects `tileset.json` and `content.glb` files in `/data/[site-id]/` directory
- **Cesium Version**: Requires Cesium 1.131+ for proper Gaussian splat support
- **Extension Support**: Handles `KHR_spz_gaussian_splats_compression` extension
- **Camera Positioning**: Automatic optimal viewpoint when splat loads

#### Polygon Visibility Enhancement
- **Elevation Strategy**: All polygon outlines and fills elevated 3m above original position
- **Depth Testing**: Disabled depth testing with `disableDepthTestDistance: Number.POSITIVE_INFINITY`
- **Enhanced Materials**: Added `depthFailMaterial` and shadow disabling for better visibility
- **Consistent Rendering**: Polygons and outlines at same elevation for uniform appearance

### Advanced Focus Panel Animation System
A sophisticated animation sequence for the focus panel that provides smooth visual transitions:

#### Animation Sequence (Opening)
1. **Oval highlight** appears around selected PA row
2. **Connection line** extends leftward from the oval (40px, 300ms)
3. **Vertical edge** appears and expands at line end (300ms)
4. **Focus panel** expands from edge with content reveal (400ms)

#### Animation Sequence (Closing)
1. **Panel collapses** to vertical edge (300ms)
2. **Vertical edge shrinks** to connection point (300ms)
3. **Connection line retracts** to PA row (300ms)
4. **Panel DOM removed** to prevent ghost panels

#### Technical Implementation
- **Orchestrated animations** with callbacks ensure proper sequencing
- **Fixed positioning** ensures consistent animation regardless of screen size
- **DOM lifecycle management** - panels are destroyed and recreated
- **Smooth transitions** between different PA selections

### Camera Positioning System
Simplified zoom system for both PA and NPA selections:
- **Center calculation**: Average of all polygon vertices
- **Radius determination**: Maximum distance between any two vertices
- **Height calculation**: Radius fills 50% of screen height
- **Direct positioning**: Camera centered above polygon/category

### UI Interaction Rules
- **Single dropdown rule**: Only one dropdown open at a time
- **Auto-close behavior**: Opening any dropdown closes others and focus panel
- **Focus panel persistence**: Remains open while exploring 3D scene
- **Multiple close methods**: X button, Escape key, dropdown switching

### Polygon Click Integration
- **Direct interaction**: Click polygons in 3D scene to select
- **Automatic synchronization**: Updates layer controls UI
- **Alpha transparency**: 0.01 for picking while maintaining visuals

## Recent UI Enhancements

### Focus Panel Visual Design
- **Greenhouse Glass Effect**: Light, almost transparent white background with soft blur effect
- **Visual Connection**: White border around selected PA with connecting line to focus panel
- **Smart Positioning**: Panel slides in from right side, flush with layer controls
- **Typography Updates**: 
  - Metric interpretations: 20px, 300 weight, italic (matching metric names)
  - Increased x-axis labels and "probability" text for better readability
  - 5px additional spacing between chart and metric headers

### Camera Positioning Algorithm
- **25% Rule**: Selected polygons are positioned at 25% from left edge of screen
- **50% Width Constraint**: Automatically zooms out if polygon exceeds 50% of screen width
- **Smart Offset Calculation**: Dynamic adjustment based on polygon size and screen dimensions

## Data Sources & Scientific Models

### Environmental Data Layers
- Soil chemistry (pH, N, P, K levels)
- Microclimate conditions (sunlight hours, moisture, wind exposure)
- Ecological risk factors (drought, flood, extreme weather probabilities)
- Topographic analysis and water flow patterns

### 3D Reconstruction Pipeline
- RTK photography for precise positioning
- GeoFusion ground LiDAR surveying
- Drone aerial mapping
- 3D Gaussian Splatting neural networks
- Geospatially-tagged mesh tile export

### Plant Database Requirements
- Native species ecological niche data
- 3D plant models with growth stages
- Nursery inventory and availability
- Regional ecotype tracking
- Pollinator value and bloom timing data