# JavaScript Technical Documentation

## Overview
Terrain 3D is a web-based ecological visualization platform that renders survey data as interactive 3D landscapes. Built with vanilla JavaScript and a manager pattern, it visualizes plantable/non-plantable areas with scientific parameters (M1-M10) for landscape designers.

## Architecture

### Core Pattern
The application uses a manager-based architecture where specialized classes handle distinct responsibilities. All managers are instantiated globally on the `window` object for inter-module communication. No framework or build process - direct ES6+ JavaScript execution.

### Module Structure
```
main.js                 → Entry point, calls allSystemsGo()
utilities.js            → Central hub: GeoJSON visualization + shared functions
CesiumManager.js        → 3D globe with Google Photorealistic tiles
GoogleMaps2DManager.js  → 2D satellite view (hidden until activated)
UserManager.js          → Device detection + geolocation
navigation.js           → Tour system with waypoint sequences
narratives.js           → Tour content definitions
```

### Initialization Flow
```javascript
// main.js
document.addEventListener('DOMContentLoaded', async function() {
    await allSystemsGo();  // Initialize all managers
    
    // Start default tour after 2 seconds
    if (window.map3D && window.map3D.viewer) {
        window.setTimeout(() => startDixHiteIntroduction(), 2000);
    }
});

// utilities.js - allSystemsGo()
async function allSystemsGo() {
    window.map3D = new CesiumManager('cesiumContainer');
    window.map2D = await new GoogleMaps2DManager('map2D');
    window.user = new UserManager(window.map3D);
    
    await initializeSiteSelector();  // Populate site dropdown
    initializeLayerControls();       // Setup layer-based visualization controls
}
```

## GeoJSON Visualization System

### Data Formats
The system supports two GeoJSON formats:
1. **Legacy Format**: Parameters embedded in feature names (e.g., "PA=1_SoilMoisture=Wet_Light=4-6")
2. **Boyd Format**: Structured M1-M10 parameters in description field with ecological model data

### Format Detection
```javascript
function detectGeoJsonFormat(feature) {
    if (feature.properties.description && 
        feature.properties.description.includes('Ecodash.ai Ecological Niche Model')) {
        return 'boyd';
    }
    if (feature.properties.Layer) {
        return 'legacy';
    }
    return 'legacy';
}
```

### Visualization Pipeline
1. **Site Selection** → User picks from dropdown
2. **Data Loading** → Fetch GeoJSON from `/data/` directory
3. **Format Detection** → Determine Boyd vs Legacy
4. **Coordinate Conversion** → UTM to WGS84 via proj4js
5. **Entity Creation** → Cesium polygons with height separation:
   - Plantable areas: 5.5-6m height (white outlines by default)
   - Non-plantable: 6.5-7m height (red outlines)
6. **Layer-Based Filtering** → Dynamic visualization based on selected layer:
   - PA/NPA categorization with radio button selection
   - M1-M10 parameter visualization with gradient colors
   - Mutual exclusion between layers (one active at a time)

### M1-M10 Parameter System
Scientific ecological parameters with specific color gradients:
```
M1: Moisture Level     (brown → blue)      Dry to wet conditions
M2: Light Hours        (yellow → green)    Shade to full sun
M3: pH Level          (red → blue)        Acidic to basic
M4-M6: Nutrients NPK  (purple → green)    Low to high concentration
M7: Organic Matter    (light → dark brown) Low to high content
M8-M9: Risk Factors   (green → red)       Low to high risk
M10: Wind Exposure    (light → dark blue)  Protected to exposed
```

### Key Visualization Functions
```javascript
visualizeGeoJsonPolygons(geoJsonData) {
    // 1. Clear existing entities
    // 2. Detect format (Boyd/Legacy)
    // 3. Check active layer selection
    // 4. Calculate parameter ranges if parameter layer active
    // 5. Process each feature:
    //    - Convert coordinates (UTM→WGS84)
    //    - Determine plantable/non-plantable category
    //    - Apply visualization based on active layer:
    //      * Default: White (PA) or Red (NPA) outlines
    //      * PA/NPA layers: Highlight matching polygons
    //      * M1-M10 layers: Apply gradient colors
    //    - Create Cesium entities with proper heights
    //    - Add click handlers for zoom-to-feature
}

getParameterColor(value, minVal, maxVal, paramType) {
    // Normalize value to 0-1
    // Select color gradient based on parameter type
    // Interpolate RGB values
    // Return Cesium.Color with 0.7 alpha
}

handlePolygonClick(entity) {
    // Zoom to polygon with 30m minimum height
    // Center polygon in view
    // Maintain current heading/pitch
}
```

## State Management

### Global State Variables
```javascript
window.map3D                  // CesiumManager instance
window.map2D                  // GoogleMaps2DManager instance  
window.user                   // UserManager instance
window.currentLayerSelection  // Active layer (null, 'pa', 'npa', 'moisture', 'pH', etc.)
window.currentSiteData        // Loaded GeoJSON for re-rendering
window.stopFlyThrough         // Tour interruption flag
window.currentFlyThroughActive // Tour active state
```

### Event Flow
1. **Site Selection**: Dropdown change → Load GeoJSON → Detect format → Show/hide layer controls → Navigate camera → Render entities
2. **Layer Selection**: Radio button click → Store active layer → Re-render with appropriate visualization:
   - PA/NPA: Highlight matching polygons
   - M1-M10: Apply parameter gradient colors
3. **Polygon Interaction**: Click polygon → Zoom to feature with 30m minimum height → Center in view
4. **Tour Interruption**: Mouse click → Set stopFlyThrough → Show continue button → Cancel camera animation

## Manager Classes

### CesiumManager
Initializes Cesium 3D viewer with Google Photorealistic 3D Tiles. Minimal UI, no default controls.
```javascript
class CesiumManager {
    constructor(containerId) {
        Cesium.Ion.defaultAccessToken = 'eyJhbG...' // Hardcoded - security issue
        this.viewer = new Cesium.Viewer(containerId, {
            terrainProvider: Cesium.createWorldTerrain(),
            timeline: false,
            animation: false,
            // ... all controls disabled
        });
        this.addPhotorealistic3DTiles();
    }
}
```

### UserManager
Detects device type and fetches location via IP geolocation API.
```javascript
detectDevice() {
    // Returns: 'smartphone', 'laptop', or 'desktop'
    // Used for device-specific tour instructions
}

fetchUserLocation() {
    // IP geolocation API call
    // Falls back to NYC if fails
}
```

### Tour System
Waypoint-based camera flights with contextual messages. Interruptible via mouse interaction.
```javascript
flyToSequence(cesiumManager, flyTos, callback) {
    // Creates event handler for interruption
    // Shows continue button if interrupted
    // Processes waypoints sequentially
    // Displays messages with timing
}
```

## Performance Optimizations
- **Entity Cleanup**: Remove existing before re-rendering
- **Distance Visibility**: 2000m depth test distance
- **Single-Pass Calculation**: Collect all parameter values, then calculate min/max once
- **Height Separation**: Prevents z-fighting between layers

## Layer Control System

### Layer Categories
The application organizes visualization layers into two main categories:
1. **Base Layers** (PA/NPA)
   - PA (Plantable Areas): White outline visualization
   - NPA (Non-Plantable Areas): Red outline visualization
   - Headers act as implicit "All" selection (no explicit "All" option)

2. **Parameter Layers** (M1-M10)
   - Each parameter visualized with specific gradient colors
   - Scientific ecological data visualization
   - Only available for Boyd format sites

### Radio Button Implementation
```javascript
initializeLayerControls() {
    // Create radio buttons for each layer
    // Group by category (PA/NPA vs M1-M10)
    // Implement mutual exclusion
    // Add click handlers for layer activation
}

handleLayerSelection(layerType) {
    window.currentLayerSelection = layerType;
    if (window.currentSiteData) {
        visualizeGeoJsonPolygons(window.currentSiteData);
    }
}
```

### Zoom-to-Feature
```javascript
// Polygon click handler with 30m minimum height
entity.polygon.outline = true;
entity.polygon.outlineWidth = 3;
entity.onClick = () => {
    const boundingSphere = Cesium.BoundingSphere.fromPoints(positions);
    const radius = boundingSphere.radius;
    const height = Math.max(radius * 2, 30); // 30m minimum
    
    viewer.camera.flyToBoundingSphere(boundingSphere, {
        offset: new Cesium.HeadingPitchRange(
            viewer.camera.heading,
            viewer.camera.pitch,
            height
        ),
        duration: 1.5
    });
};
```

## Critical Issues
1. **Security**: API keys exposed in client code
2. **Performance**: No bundling, 15MB initial load
3. **Architecture**: Global namespace pollution
4. **Quality**: No tests, no error tracking
5. **Scalability**: All visualization in one function

## Development Notes
- Tour starts automatically - can conflict with user interaction
- Site selector interrupts active tours via `stopActiveTutorial()`
- Layer controls only show for Boyd format sites
- Coordinate conversion has hardcoded fallback for Florida area
- Radio buttons ensure only one layer active at a time
- Polygon click interaction works in 3D scene with zoom functionality
- Headers in layer controls act as category separators (no "All" option needed)