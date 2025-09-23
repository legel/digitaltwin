# SuperSplat-Only Refactor Checklist

## Overview
This document tracks the migration from a dual Cesium/SuperSplat system to a SuperSplat-only architecture for the Terrain 3D platform.

## Goals
- [ ] Remove all Cesium dependencies and code
- [ ] Migrate essential features from Cesium to SuperSplat
- [ ] Maintain ecological visualization capabilities
- [ ] Preserve user experience and performance

## Phase 1: Analysis & Planning
- [ ] Audit all Cesium-dependent features
- [ ] Identify which features need SuperSplat equivalents
- [ ] Map out data flow dependencies
- [ ] Document API changes needed

## Phase 2: Feature Migration

### Core Visualization Features
- [ ] Polygon visualization and interaction
- [ ] Layer controls and filtering
- [ ] Focus panel integration
- [ ] Camera positioning system
- [ ] Height adjustment system

### UI Components Migration (Completed)
- [x] **Replace SuperSplat button with 2D mode button in Lab mode**
  - Removed `isSuperSplatMode ? 'none' : 'inline-block'` logic for viewSwitchButton
  - Show 2D mode button in Lab mode instead of SuperSplat->Cesium button
  - Updated positioning to avoid SuperSplat rotation cube
- [x] **Migrate right panel (layer controls) to Lab mode**
  - Show plantable areas panel in Lab mode (previously hidden by `hideUIForLabMode()`)
  - Show environmental metrics panel in Lab mode
  - Boyd format site data loading works in Lab mode
  - Positioned to avoid SuperSplat view-cube-container (top-right)
- [x] **UI positioning adjustments for SuperSplat compatibility**
  - Added `.supersplat-mode` CSS class with `top: 120px` for proper clearance
  - Removed globe button completely in Lab mode to eliminate overlap
  - All UI elements positioned below SuperSplat rotation cube

### UI Functionality Implementation (TODO)
- [ ] **2D mode button functionality**
  - Currently relies on Cesium mode code (`view2D.js` and `View2DManager`)
  - Need to implement SuperSplat-compatible 2D view switching
  - May require alternative approach since SuperSplat handles its own camera
- [ ] **Layer controls functionality**
  - Currently depends on Cesium for polygon visualization (`visualizeGeoJsonPolygons()`)
  - Need SuperSplat-compatible polygon overlay system
  - May require alternative visualization approach for ecological data
- [ ] **Focus panel integration**
  - Focus panel animations may need SuperSplat coordinate system
  - Metric visualization should work independently of 3D engine

### 3D Rendering Features
- [ ] Digital twin loading (Gaussian splats)
- [ ] Terrain and base layer rendering
- [ ] 3D scene navigation
- [ ] Picking/selection system
- [ ] Coordinate system handling

### UI Components
- [ ] Site selection dropdown
- [ ] Parameter filtering (PA/NPA)
- [ ] Metric visualization
- [ ] Tour system
- [ ] Navigation controls

### Data Management
- [ ] GeoJSON polygon handling
- [ ] Site data loading
- [ ] Scientific model overlays
- [ ] Export functionality

## Phase 3: Code Cleanup

### File Removal
- [ ] Remove CesiumManager.js
- [ ] Remove Cesium-specific utilities
- [ ] Clean up HTML references to Cesium
- [ ] Remove Cesium from dependencies

### Configuration Updates
- [ ] Update main.js initialization
- [ ] Modify loading configuration
- [ ] Update CLAUDE.md documentation
- [ ] Update server.py if needed

## Phase 4: Testing & Validation
- [ ] Test core functionality
- [ ] Validate ecological data visualization
- [ ] Performance testing
- [ ] User experience validation

## Current System Dependencies

### Files with Cesium Dependencies
- `js/CesiumManager.js` - Core Cesium integration
- `js/GaussianSplatManager.js` - Uses Cesium viewer for splat loading
- `js/utilities.js` - Polygon visualization with Cesium
- `js/layerControls.js` - Layer management UI
- `js/focusPanel.js` - Focus panel animations
- `js/main.js` - Initialization sequence
- `app.html` - Cesium container and scripts

### Current Lab Mode UI State
**Currently Hidden in Lab Mode (`hideUIForLabMode()`):**
- Site selector dropdown (`siteSelector`)
- Layer controls panel (`layerControls`) - **TARGET FOR MIGRATION**
- Color legend (`colorLegend`)

**Currently Shown in Lab Mode:**
- SuperSplat button (switches to Cesium mode) - **TARGET FOR REPLACEMENT**

**Currently Hidden in Lab Mode (but should be shown):**
- 2D mode button (`viewSwitchButton`) - **TARGET FOR MIGRATION**

### UI Positioning System
- Control panel: `position: fixed, top: 10px, right: 10px`
- SuperSplat view-cube-container: Top-right corner of iframe
- SuperSplat button positioning: Dynamically positioned below view-cube + 25px gap
- Layer controls: `width: 290px, z-index: 1000`

### Key Features to Preserve
1. **Polygon Interaction**: Click-to-select functionality
2. **Layer Controls**: PA/NPA filtering and visualization
3. **Focus Panel**: Metric display with animations
4. **Camera System**: Smart positioning and framing
5. **Loading System**: Progress indication and messaging
6. **Tour System**: Guided navigation
7. **Scientific Overlays**: Ecological model visualization

## Implementation Notes

### SuperSplat Capabilities to Leverage
- Built-in Gaussian splat rendering
- 3D scene management
- Camera controls
- Selection system
- Export functionality

### Challenges to Address
- SuperSplat's polygon overlay capabilities
- Scientific data visualization integration
- Performance optimization
- API compatibility with existing data sources

## Progress Tracking

**Current Status**: Planning Phase
**Branch**: `supersplat-only-refactor`
**Started**: 2025-09-23

---

*This document will be updated as the refactor progresses. Each completed item should be checked off and notes added as needed.*