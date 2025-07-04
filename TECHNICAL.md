# Terrain 3D: Technical Documentation

## Quick Reference for AI Agents
- **No build system**: Direct file editing, browser refresh to test
- **Global state**: Everything on `window` object (e.g., `window.map3D`, `window.layerState`)
- **Key entry point**: `main.js` → `allSystemsGo()` → manager initialization
- **Data flow**: Site selection → GeoJSON load → Format detection → Layer controls → Visualization
- **Critical files**: `utilities.js` (1700+ lines core logic), `layerControls.js` (UI state), `focusPanel.js` (metrics)

## Project Overview

Terrain 3D is a web-based 3D ecological visualization platform that transforms landscape survey data into interactive digital twins. Built with vanilla JavaScript and a manager-based architecture, it visualizes plantable/non-plantable areas with scientific parameters (M1-M10) for landscape designers.

## Technology Stack

### Frontend
- **Core**: Vanilla JavaScript (ES6+), no framework or build process
- **3D Engine**: Cesium 1.131 with Google Photorealistic 3D Tiles and Gaussian Splat support
- **2D Maps**: Google Maps JavaScript API v3 (satellite view)
- **Coordinates**: Proj4js 2.9.0 for UTM→WGS84 conversion
- **Styling**: Plain CSS with Oxygen font family
- **3D Content**: Gaussian Splat digital twins (.spz compression)

### Backend
- **Server**: Flask 3.0.0 (Python) - development server only
- **CORS**: flask-cors 4.0.0 - currently allows all origins
- **Data**: Static GeoJSON files served from `/data/` directory

### Server Implementation

#### Overview
Simple Flask development server for serving the Terrain 3D application and static assets.

#### Routes
- `/` → Serves app.html
- `/<path>` → Serves any static file from project root
- `/api/health` → Returns server health status
- `/api/locations` → Returns example location data (Vizcaya, Dix.Hite)

#### Running the Server
```bash
# Install dependencies
pip install -r requirements.txt

# Start server (default port 5001)
python server.py

# Or specify custom port
PORT=8000 python server.py
```

#### Configuration
- **Port**: Set via `PORT` environment variable (default: 5001)
- **Host**: Binds to 0.0.0.0 (all interfaces)
- **Debug**: Enabled for development (auto-reload on file changes)

### External APIs
- **Cesium Ion**: 3D terrain and imagery tiles (token hardcoded)
- **Google Maps**: 2D satellite imagery (key in code)
- **ipgeolocation.io**: User location by IP (key exposed)

## Architecture

### Manager-Based Pattern
The application uses specialized classes to handle distinct domains:

```
Window Object (Global State)
├── map3D (CesiumManager)        → 3D visualization
├── map2D (GoogleMaps2DManager)  → 2D satellite view  
├── user (UserManager)           → Device/location info
├── gaussianSplatManager         → Gaussian splat loading/management
├── currentLayerSelection        → Active layer (PA/NPA/M1-M10)
├── currentSiteData              → Loaded GeoJSON
└── Tour flags                   → stopFlyThrough, etc.
```

### Key Files & Responsibilities
| File | Purpose | Key Functions | Global Vars |
|------|---------|---------------|-------------|
| `utilities.js` | Core logic, GeoJSON viz | `visualizeGeoJsonPolygons()`, `initializeSiteSelector()` | `currentSiteData`, `currentHeightOffset` |
| `layerControls.js` | Layer UI & state | `initializeLayerControls()`, `updateVisualization()` | `layerState` |
| `CesiumManager.js` | 3D rendering | Cesium setup, polygon click handling | `map3D` |
| `GaussianSplatManager.js` | 3D digital twins | `loadGaussianSplat()`, `removeAllSplats()` | `gaussianSplatManager` |
| `focusPanel.js` | Metrics display | `show()`, creates DOM dynamically | `focusPanel` |
| `main.js` | Bootstrap | `allSystemsGo()` | - |

### Critical Flows

#### 1. Initialization Sequence
```javascript
DOMContentLoaded → allSystemsGo() → {
  1. Create managers (map3D, map2D, user)
  2. initializeSiteSelector() → Load Scott Boyd by default
  3. initializeLayerControls() → Set up PA/NPA/metrics UI
  4. Start tour after 2s (can conflict with user actions)
}
```

#### 2. Site → Layer → Visualization Pipeline
```javascript
Site Selection → {
  detectGeoJsonFormat() → 'boyd' | 'legacy'
  if (boyd) → Show layer controls, analyze PA/NPA categories
  visualizeGeoJsonPolygons() → Clear entities, create new ones
}

Layer Selection → {
  Update window.layerState
  Call visualizeGeoJsonPolygons() again
  Apply filters/colors based on selection
}
```

## HTML Structure

### Document Structure
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Terrain 3D</title>
    
    <!-- Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Oxygen:wght@300;400;700&display=swap" rel="stylesheet">
    
    <!-- Cesium CSS -->
    <link href="https://cesium.com/downloads/cesiumjs/releases/1.121/Build/Cesium/Widgets/widgets.css" rel="stylesheet">
    
    <!-- Application CSS -->
    <link href="/css/styles.css" rel="stylesheet">
    <link href="/css/GoogleMaps2D.css" rel="stylesheet">
    <link href="/css/menu.css" rel="stylesheet">
    <link href="/css/focusPanel.css" rel="stylesheet">
</head>
<body>
    <!-- Viewer Containers -->
    <div id="cesiumContainer"></div>
    <div id="map2D" style="display: none;"></div>
    
    <!-- UI Elements -->
    <img id="logo" src="/images/ecodash_white_cropped.webp" alt="Terrain 3D Logo">
    <div id="messageBox"></div>
    
    <!-- Unified Control Panel -->
    <div id="controlPanel" class="control-panel">
        <!-- View controls and data controls -->
    </div>
    
    <!-- Focus Panel -->
    <div id="focusPanel" class="focus-panel hidden">
        <!-- Ecological metrics visualization -->
    </div>
</body>
</html>
```

### Script Loading Order
1. External libraries (Cesium, Proj4js)
2. Core managers and utilities
3. Additional managers
4. Tour content
5. UI interaction handlers

### Key Elements and IDs
- **Containers**: cesiumContainer, map2D, messageBox, controlPanel, focusPanel
- **Control Buttons**: tilt0Button, tilt45Button, rotateLeftButton, rotateRightButton, homeButton, viewSwitchButton
- **Data Controls**: siteDropdown, layerControls

## CSS Architecture

### File Organization
```
styles.css         → Core layout, containers, base styles
menu.css          → Unified control panel (buttons + dropdowns + layer controls)
GoogleMaps2D.css  → Hides default Google Maps controls
focusPanel.css    → Focus panel styling
```

## CSS Architecture

### File Structure & Purpose
| File | Lines | Purpose | Issues |
|------|-------|---------|--------|
| `styles.css` | 361 | Base layout, containers, Cesium overrides | Has unused styles (#saveViewButton, Cesium UI) |
| `menu.css` | 694 | Control panel, buttons, layer controls | Dropdown width incorrect (230px vs 170px) |
| `focusPanel.css` | 498 | Focus panel with glass effect | Well organized, no issues |
| `GoogleMaps2D.css` | 18 | 2D map container | Could be merged into styles.css |

### Design System
- **Brand Color**: `#072b2e` (Ecodash blue), hover: `#0a3c46`
- **Typography**: Oxygen 300/400/700
- **Spacing**: 10px gaps, 20px padding
- **Border Radius**: 40px (circular buttons), 25px (dropdowns), 20px (panels)
- **Glass Effect**: `backdrop-filter: blur(20px)` with low opacity white

### Z-Index Layers
```
998   → Focus panel (behind layer controls)
1000  → Control panel & layer controls
1001  → Selected PA oval outline
1002  → Connection line (PA to focus panel)
2000  → Message overlay
```

### Mobile Breakpoints
- `767px`: Controls move to bottom, smaller sizes
- `480px`: Further size reduction
- Focus panel: Full width on mobile

### Responsive Design
```
Desktop:    > 1024px  → Full-size controls, top-right position
Tablet:     768-1024px → Same as desktop
Mobile:     480-767px  → Bottom position, smaller controls (44px)
Small:      < 480px    → Further reduced (40px), tighter spacing
```

### Focus Panel Styling
```css
.focus-panel {
    background: rgba(7, 43, 46, 0.85); /* Ecodash blue-tinted dark glass */
    backdrop-filter: blur(24px) saturate(1.5);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 20px;
    box-shadow: 
        0 8px 32px rgba(0, 0, 0, 0.3),
        0 2px 8px rgba(0, 0, 0, 0.2);
}
```

## JavaScript Implementation

### Layer Control System (Critical for UI State)

#### Layer State Structure
```javascript
window.layerState = {
  showPlantableAreas: boolean,     // PA visibility
  showNonPlantableAreas: boolean,  // NPA visibility
  showEcologicalMetrics: boolean,  // M1-M10 metrics active
  selectedMetric: string|null,     // 'moisture', 'pH', etc.
  selectedPA: string|null,         // Selected PA name
  selectedNPA: string|null,        // Selected NPA category
  paCategories: Map,               // PA name → {number, category}
  npaCategories: Map,              // NPA category → color
  categorizedPAs: Map              // Category → PA array
}
```

#### Key Functions
- `initializeLayerControls()`: Sets up all event handlers, analyzes categories
- `updateVisualization()`: Re-renders based on layerState
- `zoomToFeature()`: Positions polygon at 25% from left screen edge
- `createPAConnection()`: Visual line between PA and focus panel

### GeoJSON Data Formats

| Format | Detection | Coordinates | Parameters |
|--------|-----------|-------------|------------|
| Legacy | Has `Layer` property | UTM Zone 17N | Embedded in names: `PA=1_SoilMoisture=Wet_pH=7.6` |
| Boyd | Has ecological model in description | WGS84 | M1-M10 in description field |

#### Visualization Pipeline
1. Site Selection → User picks from dropdown
2. Data Loading → Fetch GeoJSON
3. Format Detection → Boyd vs Legacy
4. Coordinate Conversion → UTM to WGS84
5. Entity Creation → Cesium polygons with height separation
6. Layer-Based Filtering → Dynamic visualization

### State Management

#### Global State Variables
```javascript
window.map3D                  // CesiumManager instance
window.map2D                  // GoogleMaps2DManager instance  
window.user                   // UserManager instance
window.currentLayerSelection  // Active layer
window.currentSiteData        // Loaded GeoJSON
window.currentHeightOffset    // Polygon height adjustment
window.stopFlyThrough         // Tour interruption flag
```

### Manager Classes

#### CesiumManager
```javascript
class CesiumManager {
    constructor(containerId) {
        this.viewer = new Cesium.Viewer(containerId, {
            terrainProvider: Cesium.createWorldTerrain(),
            timeline: false,
            animation: false,
            // ... minimal UI
        });
        this.addPhotorealistic3DTiles();
    }
}
```

#### UserManager
```javascript
class UserManager {
    detectDevice() {
        // Returns: 'smartphone', 'laptop', or 'desktop'
    }
    
    fetchUserLocation() {
        // IP geolocation API call
    }
}
```

### Key Features

#### Polygon Click Integration
- Polygon Alpha: 0.01 for pickability
- Click Detection: scene.pick() and drillPick()
- PA Selection: Auto-selects radio button
- Event Flow: Click → Extract PA → Select radio → Show focus panel

#### Focus Panel System
- Glass-effect design with Gaussian distributions
- Viridis color mapping for ecological metrics
- Smart axis labels with project-wide ranges
- Simplified interpretations for landscape architects

#### Height Adjustment System
```javascript
// Manual height adjustment
adjustHeightOffset(5);   // Raise by 5m
adjustHeightOffset(-3);  // Lower by 3m

// Check current offset
console.log(window.currentHeightOffset);
```

## Data System

### GeoJSON Structure
- **Legacy Format**: Parameters in feature names
- **Boyd Format**: M1-M10 in description field

### Visualization Rules
- **Plantable Areas (PA)**: White outlines, 5.5-6m height
- **Non-Plantable (NPA)**: Red outlines, 6.5-7m height
- **Points**: Green dots (plantable) or red cylinders
- **Layer-Based Colors**: Gradient interpolation for M1-M10

### Coordinate Conversion
```javascript
// UTM Zone 17N to WGS84
const utmProj = '+proj=utm +zone=17 +datum=WGS84 +units=m +no_defs';
const wgs84Proj = '+proj=longlat +datum=WGS84 +no_defs';
```

## Development Workflow

### File Structure
```
terrain-3d/
├── app.html              # Single page entry
├── server.py             # Flask dev server
├── requirements.txt      # Flask, flask-cors
├── css/                  # Stylesheets
├── js/                   # JavaScript modules
├── data/                 # GeoJSON files
└── images/               # UI assets
```

### Development Process
1. Edit JavaScript/CSS files directly
2. Refresh browser to see changes
3. Use debug() in console for camera position
4. No build process required

### Debugging
- Console logging throughout
- Global state accessible via window object
- Camera position: `debug()` function
- Height adjustment: `adjustHeightOffset()`

## Performance Considerations

### Optimizations
- Entity cleanup before re-rendering
- 2000m distance for depth test
- Single-pass min/max calculation
- Height separation prevents z-fighting

### Current Issues
- **Initial Load**: ~15MB (Cesium + libraries)
- **No Code Splitting**: Everything loads upfront
- **Global Namespace**: Pollution with window variables
- **No Build Process**: Missing minification/bundling

## Security Notes

### Current Vulnerabilities
1. **API Keys**: Hardcoded in client JavaScript
2. **CORS**: Allows any origin
3. **No Authentication**: All data publicly accessible
4. **Dev Server**: Not suitable for production

### Recommendations
- Move API keys to server-side proxy
- Implement proper CORS restrictions
- Add authentication for sensitive data
- Use production-grade server (nginx/gunicorn)

### Production Deployment
For production environments:
1. Use a production WSGI server (Gunicorn, uWSGI)
2. Restrict CORS to specific origins
3. Disable debug mode
4. Serve static files via nginx or CDN
5. Add authentication for sensitive endpoints

## Recent Updates (January 2025)

### Gaussian Splat Digital Twin Integration

#### Implementation Overview
Complete system for loading and managing 3D Gaussian Splat digital twins in Cesium 1.131:

```javascript
// GaussianSplatManager Class Structure
class GaussianSplatManager {
    constructor(viewer) {
        this.viewer = viewer;
        this.loadedTilesets = new Map();     // Track loaded splats by site
        this.loadingIndicators = new Map();  // Loading visual feedback
        this.setupErrorHandling();
        this.setupDevelopmentControls();
    }
}
```

#### Key Technical Features
- **Tileset Loading**: Uses `Cesium.Cesium3DTileset.fromUrl()` method for reliable loading
- **File Structure**: Expects `tileset.json` + `content.glb` in `/data/[site-id]/` directory
- **Extension Support**: Handles `KHR_spz_gaussian_splats_compression` for .spz files
- **Loading Indicators**: Static canvas-based visual feedback during load
- **Error Recovery**: Comprehensive error handling with emergency cleanup
- **Auto-initialization**: Checks for splat data and loads automatically per site

#### Polygon Visibility Enhancements
```javascript
// Elevation Strategy for Visibility Through Splats
const elevatedPositions = outlinePositions.map(pos => {
    const cartographic = Cesium.Cartographic.fromCartesian(pos);
    return Cesium.Cartesian3.fromRadians(
        cartographic.longitude,
        cartographic.latitude,
        cartographic.height + 3.0 // 3m elevation above splat
    );
});

// Enhanced Polyline Properties
polyline: {
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
    depthFailMaterial: outlineColor,
    heightReference: Cesium.HeightReference.NONE,
    shadows: Cesium.ShadowMode.DISABLED
}
```

#### Performance Considerations
- **Memory Impact**: Gaussian splats consume significant GPU memory
- **Rendering Load**: Severe framerate reduction during camera movement
- **Loading Time**: Large file sizes require loading indicators
- **Browser Compatibility**: Requires modern GPU support for optimal performance

#### Current Limitations
- **Visibility Conflicts**: Polygon outlines partially obscured by splat rendering
- **Toggle Reliability**: Hide/show functionality inconsistent - removal preferred
- **Performance Impact**: Significant slowdown when splat is active
- **Memory Usage**: High memory consumption on lower-end devices

### Focus Panel Animation System
- Sophisticated multi-phase animation sequence with connection lines
- DOM lifecycle management prevents ghost panels
- Fixed 40px connection line for consistent visual design
- Smooth transitions between PA selections

### Camera Positioning Enhancement
- Simplified zoom calculation based on polygon radius
- Consistent behavior for both PA and NPA selections
- Polygons centered with radius filling 50% of screen height

### UI Interaction Improvements
- Single dropdown rule enforces one open panel at a time
- Focus panel persists during 3D exploration (no click-away close)
- Multiple close methods: X button, Escape key, dropdown switching

## Known Issues

### Development Gotchas
1. Tour auto-starts and can conflict with interaction
2. Layer controls only appear for Boyd format sites
3. Coordinate conversion has Florida-specific fallback
4. No error boundaries - crashes stop everything
5. Global state makes testing difficult
6. Focus panel DOM is destroyed/recreated on each use

## Future Improvements
1. **Build System**: Webpack/Vite for bundling
2. **State Management**: Replace globals with proper state
3. **Testing**: Add unit and integration tests
4. **Error Handling**: Implement error boundaries
5. **Performance**: Code splitting and lazy loading
6. **Security**: Server-side API proxies
7. **Accessibility**: ARIA labels and keyboard navigation