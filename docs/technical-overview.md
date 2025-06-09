# Terrain 3D Technical Overview

## Project Purpose
Terrain 3D is a web-based 3D ecological visualization platform that transforms landscape survey data into interactive digital twins. It enables landscape designers to visualize plantable areas, analyze ecological parameters (M1-M10), and make data-driven decisions about native plant placement.

## Technology Stack

### Frontend
- **Core**: Vanilla JavaScript (ES6+), no framework or build process
- **3D Engine**: Cesium 1.121 with Google Photorealistic 3D Tiles
- **2D Maps**: Google Maps JavaScript API v3 (satellite view)
- **Coordinates**: Proj4js 2.9.0 for UTM→WGS84 conversion
- **Styling**: Plain CSS with Oxygen font family

### Backend
- **Server**: Flask 3.0.0 (Python) - development server only
- **CORS**: flask-cors 4.0.0 - currently allows all origins
- **Data**: Static GeoJSON files served from `/data/` directory

### External APIs
- **Cesium Ion**: 3D terrain and imagery tiles (token hardcoded)
- **Google Maps**: 2D satellite imagery (key in code)
- **ipgeolocation.io**: User location by IP (key exposed)

## Architecture Pattern

The application uses a **manager-based architecture** where specialized classes handle distinct domains:

```
Window Object (Global State)
├── map3D (CesiumManager)      → 3D visualization
├── map2D (GoogleMaps2DManager) → 2D satellite view  
├── user (UserManager)          → Device/location info
├── currentLayerSelection      → Active layer (PA/NPA/M1-M10)
├── currentSiteData            → Loaded GeoJSON
└── Tour flags                 → stopFlyThrough, etc.
```

No dependency injection or module system - managers communicate through the global window object.

## Application Flow

### 1. Initialization
```
app.html loads
→ External libraries (Cesium, Proj4js)
→ CSS files (styles, menu, GoogleMaps2D)
→ JavaScript modules in order
→ main.js DOMContentLoaded
→ allSystemsGo() creates managers
→ Site selector populated
→ Layer controls initialized
→ Default tour starts after 2s
```

### 2. User Interaction Flows

**Site Selection:**
```
Dropdown change
→ loadSiteData() fetches GeoJSON
→ detectGeoJsonFormat() (Boyd vs Legacy)
→ Show/hide layer controls (Boyd only)
→ stopActiveTutorial() cancels tours
→ navigateToSite() flies camera
→ visualizeGeoJsonPolygons() renders
```

**Layer Selection:**
```
Radio button click
→ Store in window.currentLayerSelection
→ Re-run visualizeGeoJsonPolygons()
→ Apply layer-specific visualization:
  - PA/NPA: Highlight matching areas
  - M1-M10: Calculate ranges & gradient colors
→ Update all entities
```

**Polygon Interaction:**
```
Click polygon in 3D view
→ Calculate bounding sphere
→ Ensure 30m minimum height
→ Fly camera to center polygon
→ Maintain current view angles
```

## Data System

### GeoJSON Formats

**Legacy Format:**
- Parameters embedded in feature names
- Example: `"PA=1_SoilMoisture=Wet_Light=4-6_pH=6.5-7"`
- Layer property indicates type

**Boyd Format:**
- Structured M1-M10 in description field
- Contains "Ecodash.ai Ecological Niche Model"
- Rich ecological data with standardized parameters

### M1-M10 Parameters
```
M1:  Moisture Level    - Soil water availability
M2:  Light Hours       - Daily sunlight exposure  
M3:  pH Level         - Soil acidity/alkalinity
M4:  Nitrogen (N)     - Primary nutrient
M5:  Phosphorus (P)   - Root/flower nutrient
M6:  Potassium (K)    - Overall plant health
M7:  Organic Matter   - Soil organic content
M8:  Drought Risk     - Water stress probability
M9:  Flood Risk       - Inundation probability
M10: Wind Exposure    - Wind stress level
```

### Visualization Rules
- **Plantable Areas (PA)**: White outlines (default), 5.5-6m height
- **Non-Plantable (NPA)**: Red outlines, 6.5-7m height
- **Points**: Green dots (plantable) or red cylinders (obstacles)
- **Layer-Based Colors**:
  - PA/NPA selection: Highlights matching polygons
  - M1-M10 selection: Gradient interpolation based on value range
- **Interactive**: All polygons clickable with zoom-to-feature

## UI System

### Control Panel Layout
- **Desktop**: Top-right corner (10px offset)
- **Mobile**: Bottom-center with transform
- **Structure**: 6 buttons + site dropdown + layer controls
- **Buttons**: Tilt (2), Rotate (2), Home, 2D/3D toggle
- **Site Dropdown**: Location selector
- **Layer Controls** (Boyd format only):
  - Radio buttons grouped by category
  - PA/NPA section with header
  - M1-M10 parameters section with header
  - Mutual exclusion between all layers

### Responsive Behavior
- 1024px+: Full desktop layout
- 768-1024px: Desktop layout maintained
- 480-767px: Mobile layout, smaller controls
- <480px: Compact mobile, minimum sizing

## Critical Implementation Details

### Coordinate Conversion
```javascript
// UTM Zone 17N to WGS84
const utmProj = '+proj=utm +zone=17 +datum=WGS84 +units=m +no_defs';
const wgs84Proj = '+proj=longlat +datum=WGS84 +no_defs';
// Fallback hardcoded for Florida area if proj4 fails
```

### Performance Optimizations
1. Entity cleanup before re-rendering
2. 2000m distance for depth test
3. Single-pass min/max calculation
4. Height separation prevents z-fighting

### Security Issues
1. **API Keys**: All hardcoded in client JavaScript
2. **CORS**: Allows any origin to access
3. **Path Traversal**: Server serves any file
4. **No Auth**: All data publicly accessible

## File Structure
```
terrain-3d/
├── app.html              # Single page entry
├── server.py             # Flask dev server
├── requirements.txt      # Flask, flask-cors
├── css/
│   ├── styles.css        # Base layout
│   ├── menu.css          # Control panel
│   └── GoogleMaps2D.css  # Map overrides
├── js/
│   ├── main.js           # Entry point
│   ├── utilities.js      # Core logic + viz
│   ├── *Manager.js       # Domain managers
│   └── navigation.js     # Tour system
├── data/                 # GeoJSON files
│   ├── *.geojson         # Survey data
└── images/               # UI assets
```

## Development Gotchas
1. Tour auto-starts and can conflict with user interaction
2. Layer controls only appear for Boyd format sites
3. Coordinate conversion has Florida-specific fallback
4. No error boundaries - crashes stop everything
5. Global state makes testing difficult
6. Radio buttons require manual mutual exclusion handling
7. Polygon click events need proper 3D scene integration
8. 30m minimum zoom height prevents too-close views

## Future Requirements (from CLAUDE.md)
1. **3D Gaussian Splatting**: Support .spz photorealistic files
2. **Ecological Models**: Expand beyond M1-M10 parameters
3. **Plant Database**: Native species selection tools
4. **Commercial Features**: User accounts, purchases
5. **Performance**: Handle larger datasets, optimize loading

## Immediate Priorities
1. **Security**: Move API keys server-side
2. **Build System**: Bundle and minify (15MB initial load)
3. **Error Handling**: Add try-catch blocks
4. **Testing**: No tests currently exist
5. **State Management**: Replace global variables