# HTML Technical Documentation

## Overview
The application is a single-page app served via `app.html`. It loads external libraries, defines containers for 3D/2D views, creates the unified control panel, and bootstraps the JavaScript application. No templating or build process - raw HTML with inline structure.

## Document Structure

### Head Section
```html
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Terrain 3D</title>
    
    <!-- Google Fonts (loaded first for CSS) -->
    <link href="https://fonts.googleapis.com/css2?family=Oxygen:wght@300;400;700&display=swap" rel="stylesheet">
    
    <!-- Cesium CSS must load before Cesium JS -->
    <link href="https://cesium.com/downloads/cesiumjs/releases/1.121/Build/Cesium/Widgets/widgets.css" rel="stylesheet">
    
    <!-- Application CSS in dependency order -->
    <link href="/css/styles.css" rel="stylesheet">       <!-- Base layout -->
    <link href="/css/GoogleMaps2D.css" rel="stylesheet"> <!-- Map overrides -->
    <link href="/css/menu.css" rel="stylesheet">         <!-- Control panel -->
</head>
```

### Body Structure
```html
<body>
    <!-- 3D/2D Viewer Containers (full screen, absolute positioned) -->
    <div id="cesiumContainer"></div>
    <div id="map2D" style="display: none;"></div>
    
    <!-- Branding -->
    <img id="logo" src="/images/ecodash_white_cropped.webp" alt="Terrain 3D Logo">
    
    <!-- Message Overlay (tour instructions, notifications) -->
    <div id="messageBox"></div>
    
    <!-- Unified Control Panel -->
    <div id="controlPanel" class="control-panel">
        <!-- View controls (buttons) -->
        <div class="control-group view-controls">
            <button id="tilt0Button" class="control-button icon-button tilt-0-button" title="Top-down view"></button>
            <button id="tilt45Button" class="control-button icon-button tilt-45-button" title="Angled view"></button>
            <button id="rotateLeftButton" class="control-button icon-button rotate-left-button" title="Rotate left 90°"></button>
            <button id="rotateRightButton" class="control-button icon-button rotate-right-button" title="Rotate right 90°"></button>
            <button id="homeButton" class="control-button icon-button home-button" title="Go to my location"></button>
            <button id="viewSwitchButton" class="control-button text-button view-switch">2D</button>
        </div>
        
        <!-- Data controls (dropdowns) -->
        <div class="control-group data-controls">
            <div id="siteSelector" class="control-item site-selector">
                <select id="siteDropdown">
                    <option value="">Select a site...</option>
                </select>
            </div>
            
            <div id="parameterFilter" class="control-item parameter-filter" style="display: none;">
                <select id="parameterDropdown">
                    <option value="">Filter by parameter...</option>
                    <option value="moisture">M1: Moisture Level</option>
                    <!-- M2-M10 options... -->
                </select>
            </div>
        </div>
    </div>
    
    <!-- Script loading order is critical -->
</body>
```

## Script Loading Order

The application requires specific loading sequence due to dependencies:

```html
<!-- 1. External libraries (must be first) -->
<script src="https://cesium.com/downloads/cesiumjs/releases/1.121/Build/Cesium/Cesium.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.9.0/proj4.min.js"></script>

<!-- 2. Core managers and utilities -->
<script src="/js/CesiumManager.js"></script>
<script src="/js/utilities.js"></script>      <!-- Must load before main.js -->
<script src="/js/navigation.js"></script>
<script src="/js/main.js"></script>          <!-- Entry point, starts app -->

<!-- 3. Additional managers -->
<script src="/js/GoogleMaps2DManager.js"></script>
<script src="/js/UserManager.js"></script>

<!-- 4. Tour content -->
<script src="/js/narratives.js"></script>

<!-- 5. UI interaction handlers -->
<script src="/js/tilt.js"></script>
<script src="/js/orbit.js"></script>
<script src="/js/home.js"></script>
<script src="/js/viewTransform.js"></script>
```

## Key Elements and IDs

### Containers
- `cesiumContainer` - 3D viewer mount point
- `map2D` - Google Maps mount point (hidden initially)
- `messageBox` - Tour messages and notifications
- `controlPanel` - Unified control panel container

### Control Buttons
- `tilt0Button` - Top-down camera view
- `tilt45Button` - Angled camera view
- `rotateLeftButton` - Rotate 90° counter-clockwise
- `rotateRightButton` - Rotate 90° clockwise
- `homeButton` - Return to user location
- `viewSwitchButton` - Toggle 2D/3D (text changes)

### Data Controls
- `siteDropdown` - Select survey location
- `parameterDropdown` - Filter by M1-M10 (Boyd format only)

## Dynamic Behavior

### Site Dropdown Population
```javascript
// Populated by initializeSiteSelector() in utilities.js
sites.forEach(site => {
    const option = document.createElement('option');
    option.value = site.filename;
    option.textContent = site.name;
    option.dataset.bounds = JSON.stringify(site.bounds);
    siteDropdown.appendChild(option);
});
```

### Parameter Filter Visibility
- Hidden by default
- Shown only when Boyd format site is selected
- Hidden when switching back to Legacy format site

### View Switch Button
- Shows "2D" when in 3D mode
- Shows "3D" when in 2D mode
- Toggles container visibility

## Performance Issues

### Current Problems
1. **Blocking Scripts**: All scripts load synchronously
2. **Large Payload**: Cesium alone is ~5MB
3. **No Lazy Loading**: Everything loads upfront
4. **Missing Hints**: No preload/prefetch directives

### Recommended Improvements
```html
<!-- Add resource hints -->
<link rel="preconnect" href="https://cesium.com">
<link rel="preconnect" href="https://maps.googleapis.com">
<link rel="dns-prefetch" href="//cdnjs.cloudflare.com">

<!-- Async where possible -->
<script async src="/js/non-critical.js"></script>

<!-- Preload critical resources -->
<link rel="preload" href="/js/CesiumManager.js" as="script">
<link rel="preload" href="/data/sites.json" as="fetch">
```

## Accessibility Gaps

### Missing Features
- No `<label>` elements for dropdowns
- Missing ARIA labels on icon buttons
- No keyboard navigation indicators
- No screen reader announcements
- No skip navigation links

### Required Additions
```html
<!-- Label dropdowns -->
<label for="siteDropdown" class="sr-only">Select survey site</label>

<!-- ARIA for buttons -->
<button aria-label="Top-down view" id="tilt0Button">

<!-- Landmarks -->
<main role="main" aria-label="3D visualization">
<nav role="navigation" aria-label="View controls">
```

## Security Considerations

### Current Issues
- No Content Security Policy
- API keys visible in loaded scripts
- No iframe restrictions
- Missing security headers

### Needed Headers (via server)
```html
<meta http-equiv="Content-Security-Policy" content="...">
<meta http-equiv="X-Frame-Options" content="SAMEORIGIN">
<meta http-equiv="X-Content-Type-Options" content="nosniff">
```

## Future Enhancements

1. **Progressive Web App**
   - Add manifest.json
   - Implement service worker
   - Enable offline functionality

2. **Loading States**
   - Show progress during Cesium load
   - Skeleton screens for UI elements
   - Loading indicators for data fetches

3. **Error Handling**
   - Fallback UI for script failures
   - User-friendly error messages
   - Retry mechanisms

4. **Modern Features**
   - Web Components for controls
   - CSS custom properties
   - Dynamic imports for code splitting