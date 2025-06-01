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

## Architecture

The application is built with vanilla JavaScript (no framework) and uses a manager-based architecture:

- **CesiumManager.js**: Controls the 3D globe viewer using Cesium with Google Photorealistic 3D Tiles
- **GoogleMaps2DManager.js**: Controls the 2D satellite map view using Google Maps API
- **UserManager.js**: Handles device detection (smartphone/laptop/desktop) and geolocation
- **navigation.js**: Manages guided tour sequences with camera movements and contextual messages
- **viewTransform.js**: Handles seamless switching between 2D/3D views while maintaining position

## Development Commands

This is a static JavaScript application with no build system. Development workflow:

1. Edit JavaScript files directly
2. Test by opening `app.html` in a browser
3. All assets are served statically

No npm/yarn commands, webpack, or build steps required.

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
2. **Gaussian Splat integration** (future phase): Advanced photorealistic rendering
3. **Ecological model overlay**: Scientific data visualization on 3D twins
4. **Commercial platform features**: Native plant marketplace integration

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