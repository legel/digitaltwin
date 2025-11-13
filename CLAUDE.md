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
1. **SuperSplat-Only Application** - Uses SuperSplat for all 3D rendering (no Cesium)
2. **No build system** - Edit files directly, refresh browser to test
3. **Global state on window** - All managers and state accessible via `window.X`
4. **Manager pattern** - Each domain has a dedicated manager class
5. **Event-driven UI** - Layer controls drive visualization through state changes

### File Hierarchy (by importance)
1. **utilities.js** - Core initialization and application logic
2. **layerControls.js** - UI state management, complex event handling for PA/NPA/metrics
3. **ecologicalMetrics.js** - Centralized ecological data processing, Viridis color mapping, parameter parsing
4. **SuperSplatBridge.js** - SuperSplat polygon rendering and event bridging system
5. **SuperSplatManager.js** - SuperSplat iframe initialization and management
6. **focusPanel.js** + **metricChart.js** - Work together for ecological metrics display (use ecologicalMetrics.js)
7. **main.js** - Simple but critical bootstrap sequence

### Common Pitfalls
- Layer controls only show for Boyd format sites
- Polygon rendering requires SuperSplat initialization completion
- Height adjustment system uses global `currentHeightOffset`
- **Direct Calls**: Polygon rendering uses direct `window.superSplatBridge.renderGeoJSONPolygons()` calls
- **Centralized Functions**: Ecological metrics functions are centralized in `ecologicalMetrics.js`, accessed via `window.viridisColormap()`, etc.

### CSS Gotchas
- **Z-index hierarchy**: SuperSplat container (1000) < Focus panel (1001) < Connection line (1003)
- **Glass effect**: Uses `backdrop-filter` - check browser support
- **Dropdown width**: Should be 170px (3 buttons), not 230px
- **SuperSplat positioning**: UI elements positioned with `top: 120px` to avoid rotation cube
- **Mobile**: Controls relocate to bottom at 767px breakpoint

### Critical Data Flow (SuperSplat-Only)
```
Site Selection (dropdown)
→ loadSiteData()
→ detectGeoJsonFormat() ['boyd'|'legacy']
→ if boyd: initializeLayerControlsForSite() → analyzePA/NPACategories()
→ SuperSplatBridge.renderGeoJSONPolygons() [main rendering function]
→ Layer controls become interactive
→ User clicks PA/layer OR polygon → SuperSplat polygon selection
```

## Development Commands

1. Start server: `python server.py`
2. Open browser: `http://localhost:5001`
3. Edit any JS/CSS file
4. Refresh browser (no build needed)

## Key Implementation Details

### API Keys and Services
- Google Cloud Storage serves large Gaussian splat files (.glb assets)

### SuperSplat Integration
- **Gaussian Splat Rendering**: 3D digital twins loaded via SuperSplat (.ply files with progressive loading)
- **Progressive Loading System**: Binary chunk approach (100 chunks, 5 concurrent downloads) - see PLY_DEPLOYMENT_GUIDE.md
- **Polygon Overlay System**: Custom shader-based polygon rendering on top of splat data
- **Event Bridge**: SuperSplatBridge.js connects terrain-3d UI to SuperSplat polygon system
- **Coordinate Transformation**: Geographic coordinates converted to SuperSplat world space

### Coordinate System
- **Geographic Input**: GeoJSON features use longitude/latitude in degrees
- **SuperSplat Space**: Converted to SuperSplat 3D world coordinates (x, y, z)
- **Polygon Positioning**: Y-plane intersection places polygons on landscape surface
- **Site Configuration**: site-bounds.json defines coordinate transformation parameters

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

### Code Quality Standards
When refactoring or creating new code, maintain clean and professional code standards:

#### Comment Guidelines
- **NEVER add "Note:", "BUT:", "DISABLED", or similar explanatory comments**
- **Avoid comments explaining previous behavior** (e.g., "logging removed for cleaner output")
- **No implementation detail explanations** that add no functional value
- **Use JSDoc for function documentation** with proper @param and @returns tags
- **Keep comments concise and function-focused**

#### Formatting Standards
- **Single blank line** between functions only
- **No excessive newlines** (never more than one blank line)
- **Remove orphaned code** from incomplete edits
- **Consistent indentation** and spacing throughout files

#### Code Organization
- **Remove unused functions completely** rather than commenting them out
- **Extract related functions** into focused modules when appropriate
- **Maintain single responsibility** for each file and function
- **Use descriptive function and variable names** that eliminate need for explanatory comments

## Recent Implementations

### Gaussian Splat Integration (3D Digital Twins)
A comprehensive system for loading and managing 3D Gaussian Splat digital twins via SuperSplat:

#### Core Implementation
- **SuperSplatManager.js**: SuperSplat iframe initialization, lifecycle management, and progress tracking
- **ProgressivePlyLoader.js**: Binary chunk downloading with staggered queue (5 concurrent)
- **Loading Indicators**: Multi-stage progress (10-70% downloads, 70-99% assembly, 99-100% rendering)
- **Ecological Messages**: 300+ rotating messages during load (3-second intervals)

#### Progressive Loading System
- **Binary Chunks**: PLY files split into 100 binary chunks (~1.2MB each for 120MB file)
- **Staggered Downloads**: Queue-based system maintains exactly 5 concurrent downloads
- **Parallel Assembly**: Chunks concatenated in-browser using Blob API
- **Single File Load**: Prevents race conditions and rendering artifacts from multiple splat files
- **See PLY_DEPLOYMENT_GUIDE.md** for complete deployment workflow

#### Technical Details
- **SuperSplat Integration**: Uses SuperSplat's native Gaussian splat rendering via .ply files
- **Performance Optimization**: Binary chunk approach enables fast parallel downloads
- **DeepEarth Integration**: Chunks stored at `gs://deepearth/datasets/splats/chunks/`
- **Manifest System**: JSON manifests define chunk locations and assembly order
- **Camera Positioning**: Automatic optimal viewpoint when splat loads

#### DeepEarth Storage Integration
- **GCS Direct Access**: Browser downloads chunks directly from Google Cloud Storage
- **CORS Configuration**: DeepEarth bucket configured for browser access
- **CDN-Ready**: Small chunks cache efficiently for improved performance
- **No Proxy Needed**: Direct GCS URLs in manifest eliminate server bottleneck

#### Polygon Overlay System
- **Shader-Based Rendering**: Custom fragment shaders render polygons above splat data
- **Coordinate Transformation**: Geographic coordinates converted to SuperSplat world space
- **Click Detection**: Ray casting system enables direct polygon interaction
- **Visual Integration**: Polygons render on landscape surface with proper depth handling

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

### SuperSplat Camera Integration
Camera control is handled natively by SuperSplat with terrain-3d providing minimal integration:
- **Native Controls**: SuperSplat handles all camera movement and positioning
- **Polygon Focus**: Focus panel integration works independently of camera system
- **Tour System**: Currently disabled with SuperSplat

### UI Interaction Rules
- **Single dropdown rule**: Only one dropdown open at a time
- **Auto-close behavior**: Opening any dropdown closes others and focus panel
- **Focus panel persistence**: Remains open while exploring 3D scene
- **Multiple close methods**: X button, Escape key, dropdown switching

### Polygon Click Integration
- **Direct interaction**: Click polygons in SuperSplat 3D scene to trigger UI selections
- **Automatic synchronization**: SuperSplatBridge updates layer controls UI
- **Ray Casting**: Uses SuperSplat's coordinate system for accurate polygon detection

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