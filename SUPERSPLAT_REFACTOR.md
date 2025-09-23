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
- `index.html` - Cesium container and scripts

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