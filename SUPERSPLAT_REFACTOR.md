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

### UI Functionality Implementation (IN PROGRESS)
- [ ] **2D mode button functionality**
  - Currently relies on Cesium mode code (`view2D.js` and `View2DManager`)
  - Need to implement SuperSplat-compatible 2D view switching
  - May require alternative approach since SuperSplat handles its own camera
- [ ] **Layer controls functionality - PRIORITY**
  - ✅ Investigation completed: SuperSplat Element system chosen as best approach
  - ✅ Architecture planned: PolygonOverlay Element with native PlayCanvas integration
  - ✅ Implementation: Create PolygonOverlay.ts in SuperSplat source
  - ✅ **NEW APPROACH: 2D Shader-Based Overlay System**
    - ✅ Created PointOverlay Element using 2D grid-like shader system
    - ✅ Avoids 3D mesh GL_INVALID_ENUM errors that plagued PolygonOverlay
    - ✅ Uses same pattern as InfiniteGrid (quad render + fragment shader)
    - ✅ Successfully renders 2D squares above splat data
  - [ ] Integration: Bridge terrain-3d layer controls to SuperSplat events
  - [ ] Testing: Verify polygon positioning matches GeoJSON coordinates
- [ ] **Focus panel integration**
  - Focus panel animations may need SuperSplat coordinate system
  - Metric visualization should work independently of 3D engine

## Phase 2.5: SuperSplat PolygonOverlay Implementation

### Architecture Decision: 2D Shader-Based Overlay System
After encountering persistent GL_INVALID_ENUM errors with 3D mesh-based approaches, a **2D shader-based overlay system** was implemented following SuperSplat's grid pattern:

**Why 2D Shader Overlays:**
- **Proven Pattern**: Uses same architecture as SuperSplat's InfiniteGrid
- **GL Error-Free**: Avoids complex 3D mesh creation that caused rendering issues
- **Performance**: QuadRender + fragment shader is highly optimized
- **Camera-Aware**: Automatically adjusts to different viewing angles
- **Native Integration**: Full SuperSplat Element system integration

**Architecture Pattern:**
1. **QuadRender**: Full-screen quad (no 3D geometry)
2. **Fragment Shader**: Ray-plane intersection to find world positions
3. **World Space Rendering**: Direct 2D shapes on world planes
4. **Distance Fading**: Performance optimization for far objects

**Approaches Tried:**
- ❌ **3D Meshes**: GL_INVALID_ENUM errors, AABB issues, complex geometry
- ❌ **DOM Overlays**: External, limited performance and integration
- ✅ **2D Shader Overlays**: Robust, performant, follows SuperSplat patterns

### Implementation: 2D Point Overlay System (COMPLETED)

#### ✅ PointOverlay Element - Proof of Concept
- **Files**:
  - `supersplat-build/src/point-overlay.ts` - Element implementation
  - `supersplat-build/src/shaders/point-overlay-shader.ts` - Fragment shader
- **Base Class**: `Element` (ElementType.debug)
- **Rendering**: QuadRender + fragment shader (follows InfiniteGrid pattern)
- **Features**: Multiple points, configurable size/color, distance fading
- **Integration**: Event system bridge with terrain-3d (`pointOverlay.addPoint`)

#### ✅ Polygon Rendering Pipeline - FUNCTIONING
**Status**: Core rendering pipeline successfully implemented and tested

**Working Components**:
- ✅ **Render Loop**: Multiple polygon render calls working correctly
- ✅ **Uniform Passing**: `polygonIndex`, `renderMode`, vertex data correctly passed to shader
- ✅ **Y-Plane Intersection**: Ray-plane intersection working, polygons appear on landscape surface
- ✅ **Color Differentiation**: Different polygons render with distinct colors
- ✅ **Event System**: terrain-3d → SuperSplat event bridge functioning
- ✅ **Build/Deploy Pipeline**: SuperSplat build and deployment process working

**Current Challenge**: **Polygon Shape Rendering**
- **Issue**: Complex polygon geometry logic (point-in-polygon, distance-to-edge) not rendering correct shapes
- **Evidence**: Polygons render as simple circles instead of triangle/square shapes matching vertex data
- **Root Cause**: GLSL loop bounds and coordinate transformation issues

**Debug Results** (September 25, 2025):
- **Test Setup**: 3 test polygons (triangle, square filled, square outline) with known coordinates
- **Rendering Outcome**: 3 separate colored circles confirming pipeline works
- **Coordinates**: Vertex data passed correctly (logged: triangle vertices at (-5,-5), (5,-5), (0,5))
- **Missing**: Actual polygon shape rendering from vertex coordinates

### Polygon Shape Rendering Implementation (COMPLETED)

#### ✅ Triangulation-Based Approach - BREAKTHROUGH
**Status**: Triangle rendering successfully implemented and verified working

**Final Solution**: **CPU-Side Triangulation + Simple Triangle Rendering**
- ❌ **Complex Fragment Shader Polygons**: Fragment shader-based polygon rendering proved unreliable due to GLSL constraints, coordinate mapping issues, and GPU architecture conflicts
- ✅ **CPU Triangulation + GPU Triangle Rendering**: Decompose polygons into triangles on CPU, render triangles individually with simple barycentric/cross-product tests

**Architecture Decision**:
1. **CPU-Side Triangulation**: Convert all polygons into triangles using fan triangulation algorithm
2. **Edge Triangle Generation**: Create thin triangular strips for polygon outlines
3. **GPU Triangle Rendering**: Use proven triangle rendering with cross-product bounds testing
4. **Hardcoded Proof-of-Concept**: Fixed-position triangle successfully renders with proper bounds

**Key Technical Breakthrough**:
- **Working Triangle Renderer**: Fixed-position green triangle (3m equilateral at world position (10, 0)) successfully renders
- **RenderMode Routing Fixed**: Critical bug discovered where triangles sent with `renderMode = 1` (filled) were not handled by fragment shader
- **Red Square Pattern Applied**: Triangle rendering follows exact same structure as working red square points

#### September 25, 2025 - Debug Session Results

**Problem Discovery**: Multiple architectural issues identified and resolved
1. **RenderMode Gap**: Fragment shader had `renderMode == 0` (points) and `else` clause, but triangles sent with `renderMode == 1` fell through to non-existent handler
2. **Coordinate System Issues**: Complex polygon vertex arrays and world-space coordinate mapping causing rendering anomalies
3. **Fragment Shader Complexity**: Barycentric coordinates, Y-plane intersection fallbacks, and polygon bounds testing created unstable rendering pipeline

**Solution Path**:
1. **Debug Rendering**: Bright magenta plane confirmed fragment shader execution but revealed bounds testing failures
2. **Orange Circle Issue**: Large orange shape with camera-following behavior indicated incorrect coordinate mapping
3. **Back to Basics**: Implemented hardcoded triangle using exact red square pattern with fixed world coordinates
4. **Success**: Green triangle with white border now renders correctly at fixed position

**Current State**: **Functional Triangle Renderer**
- ✅ Triangle rendering works with hardcoded coordinates
- ✅ Cross-product bounds testing implemented correctly
- ✅ Same visual quality as red square points (distance fading, view-based opacity, border effects)
- ✅ Proper world-space positioning and camera-independent behavior

#### Step 2: Terrain-3D Bridge
- **Integration**: Connect existing layer controls to SuperSplat event system
- **Event Mapping**: Bridge `window.layerState` changes to SuperSplat events
- **Data Flow**: GeoJSON → PolygonOverlay → PlayCanvas meshes

#### Step 3: Coordinate Transformation
- **Challenge**: Convert GeoJSON geographic coordinates to SuperSplat 3D space
- **Solution**: Use SuperSplat's existing coordinate system (already geospatially aligned)
- **Height Handling**: Position polygons at appropriate Z-level relative to splat data

#### Step 4: Layer Controls Integration
- **Event Bridge**: `terrain-3d` layer state → SuperSplat events → PolygonOverlay updates
- **Filtering**: PA/NPA visibility, ecological metrics coloring
- **Selection**: Polygon click detection and focus panel integration

#### Step 5: Future Enhancements (Post-MVP)
- **Interactivity**: Click/hover detection through SuperSplat's picker system
- **Animations**: Focus panel connections using SuperSplat coordinates
- **Advanced Materials**: Ecological metrics visualization with custom shaders

### Technical Implementation Details

#### PolygonOverlay Class Structure
```typescript
class PolygonOverlay extends Element {
    constructor() {
        super(ElementType.other); // or custom ElementType.terrain
    }

    add() {
        // Initialize on scene.overlayLayer
        // Set up terrain-3d event listeners
        // Create initial polygon meshes from GeoJSON
    }

    onPreRender() {
        // Update polygon visibility based on layer state
        // Handle hover/selection highlighting
        // Apply ecological metrics coloring
    }

    updateFromGeoJSON(geoJsonData: any) {
        // Convert GeoJSON features to PlayCanvas meshes
        // Handle Boyd format ecological data
        // Apply current layer filtering
    }
}
```

#### Integration Points
- **Scene**: Add PolygonOverlay to SuperSplat scene elements
- **Events**: Register terrain-3d bridge functions in SuperSplat event system
- **Coordinates**: Use existing splat coordinate system (geospatially aligned)
- **Layer Controls**: Maintain existing terrain-3d UI, bridge state changes

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

### Technical Challenges and Solutions

#### ✅ GLSL Fragment Shader Architecture - RESOLVED
**Challenge**: Complex polygon rendering in fragment shaders proved unreliable
**Root Issues**:
- **RenderMode Routing**: Missing handler for `renderMode == 1` triangles caused silent failures
- **Coordinate System Complexity**: Y-plane intersection fallbacks and world-space coordinate mapping created instabilities
- **GPU Architecture Mismatch**: Fragment shader-based polygon testing fights against GPU parallel processing strengths

**Solution**: **CPU Triangulation + Simple GPU Triangle Rendering**
- **CPU-Side Preprocessing**: Convert all polygons to triangles before GPU processing
- **Simple GPU Logic**: Use proven cross-product triangle bounds testing (same pattern as working red squares)
- **Hardcoded Proof-of-Concept**: Fixed-position triangle renderer validates approach

#### ✅ WebGL Rendering Pipeline - ESTABLISHED
- **Build Process**: SuperSplat requires `npm run build:supersplat && npm run deploy:supersplat` for changes
- **Deployment**: Built files from `supersplat-build/dist/` must be copied to `supersplat/` directory
- **Development Cycle**: Shader changes need full build/deploy cycle for testing
- **Status**: Development workflow established and functioning reliably

#### Coordinate System Integration - IN PROGRESS
- **Challenge**: Mapping GeoJSON geographic coordinates to SuperSplat 3D world space
- **Current State**: Hardcoded triangle at world position (10, 0) renders correctly
- **Next Step**: Connect CPU triangulation system coordinates to hardcoded triangle renderer
- **Future Requirement**: Geographic → SuperSplat coordinate transformation system

#### ✅ PlayCanvas Uniform Array Limitations - CRITICAL KNOWLEDGE
**Issue**: PlayCanvas has significant limitations with GLSL uniform arrays that cause rendering failures
**Research Date**: September 26, 2025

**Problems Discovered**:
- **Uniform Arrays Fail**: Attempting to use `uniform vec2 triangleV0s[32]` results in all values being 0.0
- **setValue() with Arrays**: `device.scope.resolve('uniformArray').setValue([...])` doesn't work correctly
- **Community Confirmed**: PlayCanvas forum discussions confirm this is a known limitation

**Working Solution**: **Vec4 Packing Approach**
```glsl
// ❌ DON'T DO THIS (fails in PlayCanvas)
uniform vec2 triangleV0s[32];
uniform vec3 triangleColors[32];

// ✅ DO THIS (works reliably)
uniform vec4 triangleData0;  // Pack: v0.x, v0.z, v1.x, v1.z
uniform vec4 triangleData1;  // Pack: v2.x, v2.z, color.r, color.g
// ... up to triangleData15 for 8 triangles
```

**TypeScript Implementation**:
```typescript
// ❌ DON'T DO THIS
device.scope.resolve('triangleColors').setValue(colorArray);

// ✅ DO THIS
for (let i = 0; i < 16; i++) {
    device.scope.resolve(`triangleData${i}`).setValue([x, y, z, w]);
}
```

**Architecture Impact**:
- **Max Triangles**: Limited by number of vec4 uniforms (8 triangles = 16 vec4 uniforms)
- **Data Packing**: Each triangle requires 2 vec4 uniforms for vertices + color
- **Shader Helper**: Use `getTriangleData(int index)` function to unpack vec4 data
- **Performance**: Actually better than arrays - single render call for all triangles

**Key Research Sources**:
- PlayCanvas Forum: "Shader Problems Setting a Uniform Array" - uniform arrays set to 0.0
- PlayCanvas Forum: "Sending Array of vec2 Values" - vec4 packing recommended
- PlayCanvas Docs: "Uniform system supports only simple types" - no array support mentioned

**Critical Learning**: **ALWAYS use vec4 packing for multi-object data in PlayCanvas shaders**

#### Performance & Integration - PLANNED
**Remaining Challenges**:
- Scientific data visualization integration
- Performance optimization for large polygon counts (now limited to 8 triangles per render call)
- API compatibility with existing GeoJSON data sources
- Layer controls integration with SuperSplat event system

**Architecture Foundation**: With working triangle renderer and PlayCanvas uniform limitations solved, these challenges are now addressable through iterative development

## Progress Tracking

**Current Status**: Active Implementation - Polygon Rendering Development
**Branch**: `supersplat-only-refactor`
**Started**: 2025-09-23
**Last Updated**: 2025-09-25

### Major Milestones Achieved
- ✅ **UI Component Migration** (2025-09-23): Successfully migrated UI components to Lab mode
- ✅ **SuperSplat Element System** (2025-09-24): Implemented 2D shader-based overlay architecture
- ✅ **Core Rendering Pipeline** (2025-09-25): Polygon render loop, uniform passing, event system working
- ✅ **Build/Deploy Process** (2025-09-25): SuperSplat development workflow established and functioning

### ✅ Completed Sprint: Triangle Rendering Foundation (September 25, 2025)
**Objective**: Establish working triangle rendering in SuperSplat ✅ COMPLETED
**Outcome**: Successfully implemented hardcoded triangle renderer using red square pattern
**Key Achievement**: Proved triangle rendering is possible in SuperSplat with correct approach

### ✅ Completed Sprint: Multi-Triangle Shader Architecture (September 26, 2025)
**Objective**: Enable variable number of triangles in single render call ✅ COMPLETED
**Challenge Faced**: PlayCanvas uniform arrays completely fail - all values become 0.0
**Solution Implemented**: Vec4 packing approach with individual uniform variables
**Key Achievements**:
- ✅ **Deep Research**: Investigated PlayCanvas forums, docs, and community solutions
- ✅ **Vec4 Packing**: Successfully implemented data packing system (2 vec4 per triangle)
- ✅ **Shader Helper**: Created `getTriangleData()` function for efficient unpacking
- ✅ **Single Render Call**: All triangles (max 8) rendered in one GPU call
- ✅ **Verified Working**: Same orange irregular triangle renders through new multi-triangle system

### Current Sprint: Dynamic Coordinate Integration
**Objective**: Connect triangulation system coordinates to multi-triangle renderer
**Status**: Ready to implement - both systems are complete and tested
**Current State**:
- ✅ Multi-triangle shader working with vec4 packing (max 8 triangles)
- ✅ Triangulation system tested and coordinates verified
- ✅ Single triangle test case working in new architecture
**Next Steps**:
1. Replace single triangle with multiple triangles from triangulation
2. Test with 2-3 triangles to verify multiple triangle rendering
3. Verify triangulated shapes render correctly (not as circles)

### Next Sprint: GeoJSON Coordinate Mapping
**Objective**: Connect real GeoJSON geographic coordinates to triangulation system
**Dependencies**: Complete triangulation system integration
**Requirements**: Coordinate transformation system for geographic → SuperSplat world space

---

*This document will be updated as the refactor progresses. Each completed item should be checked off and notes added as needed.*