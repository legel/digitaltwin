# Terrain 3D

A sophisticated 3D/2D Earth visualization application that delivers an immersive, interactive globe experience with seamless transitions between photorealistic 3D terrain and high-resolution satellite imagery.

## Features

### 🌍 Dual Visualization Modes
- **3D Globe View**: Photorealistic Earth visualization powered by Cesium with Google Photorealistic 3D Tiles
- **2D Satellite View**: High-resolution satellite imagery using Google Maps API
- **Seamless Switching**: Maintain camera position and orientation when transitioning between views

### 🎯 Interactive Navigation
- **Guided Tours**: Predefined sequences with smooth camera movements and contextual messaging
- **Intuitive Controls**: Device-adaptive interface supporting touch, trackpad, and mouse interactions
- **Camera Controls**: Tilt, rotate, and home positioning with precision controls
- **Geolocation**: Automatic user location detection and positioning

### 📱 Cross-Platform Compatibility
- **Responsive Design**: Optimized for smartphones, tablets, laptops, and desktop computers
- **Device Detection**: Automatic detection and adaptive UI instructions
- **Touch-First**: Native support for touch gestures and multi-touch interactions

### 🛠 Developer-Friendly
- **Vanilla JavaScript**: No framework dependencies, lightweight and fast
- **Modular Architecture**: Clean separation of concerns with manager-based design
- **Hot Reload**: Direct file editing with instant browser refresh
- **Debug Tools**: Built-in camera position logging and view configuration tools

## Architecture

The application uses a manager-based architecture built with vanilla JavaScript:

```
├── CesiumManager.js      # 3D globe rendering and controls
├── GoogleMaps2DManager.js # 2D satellite map interface  
├── UserManager.js        # Device detection and geolocation
├── navigation.js         # Guided tour system
├── viewTransform.js      # Seamless 2D/3D view switching
├── narratives.js         # Tour content and waypoints
└── utilities.js          # Shared functions and UI components
```

## Quick Start

### Prerequisites
- Modern web browser with WebGL support
- API keys for:
  - Cesium Ion (embedded)
  - Google Maps API (configured in GoogleMaps2DManager.js)
  - IP Geolocation service (configured in UserManager.js)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/legel/terrain-3d.git
   cd terrain-3d
   ```

2. **Open in browser**
   ```bash
   # Simply open app.html in your browser
   open app.html
   ```

   Or serve locally:
   ```bash
   python3 -m http.server 8000
   # Navigate to http://localhost:8000/app.html
   ```

### Development Workflow

No build system required! Edit files directly and refresh your browser:

1. **Edit JavaScript files** - Changes are reflected immediately
2. **Test in browser** - Open `app.html` 
3. **Debug with tools** - Use built-in camera position logger

## Usage

### Basic Navigation
- **3D Mode**: Click and drag to rotate, scroll to zoom, right-click drag to pan
- **2D Mode**: Standard Google Maps controls
- **View Switch**: Click the "2D"/"3D" button to toggle between modes
- **Home**: Click home button to return to default view
- **Camera Controls**: Use tilt and rotation buttons for precise positioning

### Guided Tours
Tours are automatically available and provide contextual information about locations with smooth camera transitions.

### Developer Tools
- Press `debug()` in console to enable view configuration logging
- Camera positions are logged in the format: `longitude, latitude, height, heading, pitch, roll`

## API Configuration

### Cesium Ion
Update the access token in `js/CesiumManager.js`:
```javascript
Cesium.Ion.defaultAccessToken = 'your_cesium_token_here';
```

### Google Maps
Configure your API key in `js/GoogleMaps2DManager.js`:
```javascript
const API_KEY = 'your_google_maps_key_here';
```

### IP Geolocation
Set your API key in `js/UserManager.js`:
```javascript
const API_KEY = 'your_ipgeolocation_key_here';
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Test thoroughly across different devices
5. Commit with descriptive messages
6. Push and create a Pull Request

## Technical Specifications

- **Rendering Engine**: Cesium.js 1.121
- **2D Maps**: Google Maps JavaScript API
- **Coordinate System**: WGS84 (EPSG:4326)
- **Supported Browsers**: Chrome 80+, Firefox 75+, Safari 13+, Edge 80+
- **Performance**: Optimized for 60fps on modern hardware

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Cesium](https://cesium.com/) for 3D globe rendering capabilities
- [Google Maps Platform](https://developers.google.com/maps) for satellite imagery
- Community contributors and testers