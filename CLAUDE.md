# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Application Overview

Terrain 3D is a 3D/2D Earth visualization application that provides an interactive globe experience. It uses Cesium for 3D photorealistic Earth visualization and Google Maps API for 2D satellite imagery, with seamless switching between views.

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