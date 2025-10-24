# Fragment Shader Optimization for Triangle Rendering

## Problem Statement

The current fragment shader in `supersplat-build/src/shaders/point-overlay-shader.ts` has a critical performance bottleneck: **every pixel loops through ALL triangles** (lines 225-290). This creates O(triangles × pixels) complexity, where each rendered pixel performs up to 8 point-in-triangle tests regardless of whether any triangles are actually present at that pixel location.

**Performance Impact:** With the current limit of 8 triangles maximum, every pixel processes all 8 triangles. This severely limits scalability and causes frame rate drops when multiple triangles are visible simultaneously.

**Additional Context:** All triangles are rendered on the same Y-plane with static geometry (position, scale, rotation never change). Only dynamic properties (fill color, border color, visibility, border thickness) change occasionally. The system uses PlayCanvas which may have specific uniform and shader limitations.

## Root Cause Analysis

### Current Fragment Shader Flow (Lines 225-290)
```glsl
for (int i = 0; i < 8; i++) {
    if (i >= triangleCount) break;

    // Get triangle data from uniforms (expensive function call)
    getTriangleData(i, v0, v1, v2, triangleColor, triangleFillAlpha, triangleOutlineColor, outlineThickness, edgeFlags);

    // Cross product calculations for EVERY triangle for EVERY pixel
    float d0 = e0.x * c0.y - e0.y * c0.x;
    float d1 = e1.x * c1.y - e1.y * c1.x;
    float d2 = e2.x * c2.y - e2.y * c2.x;

    // Point-in-triangle test
    bool insideTriangle = (d0 >= 0.0 && d1 >= 0.0 && d2 >= 0.0) || (d0 <= 0.0 && d1 <= 0.0 && d2 <= 0.0);

    // Additional edge distance calculations...
}
```

### Key Performance Issues
1. **No early exit optimization**: Loop continues even after finding a triangle match
2. **Expensive getTriangleData() calls**: Complex uniform data extraction for every triangle
3. **Redundant cross product math**: Performed for triangles that don't contain the pixel
4. **Branch-heavy code**: Multiple conditional checks reduce GPU parallelism

## Solution: Optimized Fragment Shader Architecture

### 1. Add Proper Early Exit Strategy
Replace the current loop with immediate exit on triangle detection:

```glsl
for (int i = 0; i < 8; i++) {
    if (i >= triangleCount) break;

    // Simplified triangle data access
    vec2 v0, v1, v2;
    getTriangleDataFast(i, v0, v1, v2);

    // Fast point-in-triangle test with immediate exit
    if (pointInTriangleFast(currentPos, v0, v1, v2)) {
        // Process this triangle and EXIT immediately
        processTriangleHit(i, currentPos, v0, v1, v2);
        break; // CRITICAL: Exit loop immediately on first hit
    }
}
```

### 2. Optimize Point-in-Triangle Algorithm
Replace expensive cross products with barycentric coordinates for better GPU performance:

```glsl
bool pointInTriangleFast(vec2 p, vec2 v0, vec2 v1, vec2 v2) {
    // Barycentric coordinate method - more GPU-friendly than cross products
    vec2 v0v1 = v1 - v0;
    vec2 v0v2 = v2 - v0;
    vec2 v0p = p - v0;

    float dot00 = dot(v0v2, v0v2);
    float dot01 = dot(v0v2, v0v1);
    float dot02 = dot(v0v2, v0p);
    float dot11 = dot(v0v1, v0v1);
    float dot12 = dot(v0v1, v0p);

    float invDenom = 1.0 / (dot00 * dot11 - dot01 * dot01);
    float u = (dot11 * dot02 - dot01 * dot12) * invDenom;
    float v = (dot00 * dot12 - dot01 * dot02) * invDenom;

    return (u >= 0.0) && (v >= 0.0) && (u + v <= 1.0);
}
```

### 3. Separate Static and Dynamic Data
Leverage the fact that triangle geometry is static while styling is dynamic:

```glsl
// STATIC geometry uniforms (uploaded once, never change)
uniform vec4 staticTriangleGeo0; // Triangle 0: v0.x, v0.z, v1.x, v1.z
uniform vec4 staticTriangleGeo1; // Triangle 0: v2.x, v2.z, unused, unused
// ... continue for all triangles

// DYNAMIC styling uniforms (updated only when properties change)
uniform vec4 dynamicTriangleStyle0; // Triangle 0: color.r, color.g, color.b, fillAlpha
uniform vec4 dynamicTriangleStyle1; // Triangle 0: outlineColor.r, outlineColor.g, outlineColor.b, outlineThickness
// ... continue for all triangles

void getTriangleDataFast(int index, out vec2 v0, out vec2 v1, out vec2 v2) {
    // Access static geometry data only (much faster than current getTriangleData)
    if (index == 0) {
        v0 = staticTriangleGeo0.xy;
        v1 = staticTriangleGeo0.zw;
        v2 = staticTriangleGeo1.xy;
    } else if (index == 1) {
        v0 = staticTriangleGeo2.xy;
        v1 = staticTriangleGeo2.zw;
        v2 = staticTriangleGeo3.xy;
    }
    // ... continue for remaining triangles (much simpler than current 195-line function)
}
```

### 4. Optimize for Y-Plane Rendering
Since all triangles are on the same Y-plane, eliminate 3D intersection complexity:

```glsl
// SIMPLIFIED: No Y-plane intersection needed - currentPos is already calculated
// Current shader calculates worldPos from ray-plane intersection
// New approach: Use currentPos directly (already projected to Y-plane)

void processTriangleHit(int index, vec2 pos, vec2 v0, vec2 v1, vec2 v2) {
    // Get dynamic styling data only when needed
    vec3 color;
    float fillAlpha;
    vec3 outlineColor;
    float outlineThickness;
    float edgeFlags;
    getDynamicTriangleStyle(index, color, fillAlpha, outlineColor, outlineThickness, edgeFlags);

    // Perform edge detection only for hit triangles
    bool isOnEdge = checkEdgeDistance(pos, v0, v1, v2, outlineThickness, edgeFlags);

    // Set final pixel values
    if (isOnEdge) {
        finalColor = outlineColor;
        alpha = finalAlphaMultiplier;
    } else {
        finalColor = color;
        alpha = finalAlphaMultiplier * fillAlpha;
    }
}

void getDynamicTriangleStyle(int index, out vec3 color, out float fillAlpha, out vec3 outlineColor, out float outlineThickness, out float edgeFlags) {
    // Access only dynamic styling uniforms (faster than current mixed approach)
    if (index == 0) {
        color = dynamicTriangleStyle0.rgb;
        fillAlpha = dynamicTriangleStyle0.a;
        outlineColor = dynamicTriangleStyle1.rgb;
        outlineThickness = dynamicTriangleStyle1.a;
        edgeFlags = dynamicTriangleEdges0.x; // Separate uniform for edge flags if needed
    }
    // ... continue for remaining triangles
}
```

## Implementation Steps

### Step 1: Modify Fragment Shader Structure
Edit `supersplat-build/src/shaders/point-overlay-shader.ts`:

1. **Replace the main loop** (lines 225-290) with early-exit structure
2. **Implement `pointInTriangleFast()`** using barycentric coordinates
3. **Separate static geometry uniforms** from dynamic styling uniforms
4. **Create `getTriangleDataFast()`** for geometry-only access
5. **Create `getDynamicTriangleStyle()`** for styling-only access
6. **Add immediate break** after finding first triangle match

### Step 2: Optimize Point-Overlay.ts Data Management
Edit `supersplat-build/src/point-overlay.ts`:

1. **Split uniform uploads** into static (geometry) and dynamic (styling) categories
2. **Upload static geometry uniforms** only once when triangles are added/removed
3. **Upload dynamic styling uniforms** only when properties change (color, thickness, visibility)
4. **Cache static geometry data** to avoid recalculation on every frame
5. **Implement dirty flags** to track when dynamic properties need re-upload

### Step 3: PlayCanvas Compatibility Considerations
1. **Verify uniform count limits** - PlayCanvas may have restrictions on total uniforms
2. **Test uniform naming conventions** - ensure static/dynamic naming works with PlayCanvas scope resolution
3. **Validate shader compilation** - check that the optimized shader compiles correctly in PlayCanvas
4. **Profile memory usage** - monitor GPU memory with separated uniform approach

### Step 4: Test Performance Impact
1. **Measure frame rate** with current vs optimized shader
2. **Test with maximum triangles** (8 triangles visible simultaneously)
3. **Test dynamic property changes** (color changes, visibility toggles)
4. **Verify visual accuracy** matches original rendering
5. **Profile GPU performance** to confirm optimization gains

## Expected Performance Improvements

### Fragment Shader Optimizations
- **75-85% reduction** in per-pixel processing time for pixels outside triangles
- **50-70% reduction** in per-pixel processing time for pixels inside triangles
- **Immediate exit** eliminates unnecessary triangle tests after first hit
- **Better GPU parallelism** through reduced branching and simpler math

### Static/Dynamic Data Separation Benefits
- **Near-zero CPU overhead** for static geometry (uploaded once, never updated)
- **Minimal GPU uniform updates** - only when dynamic properties actually change
- **Reduced memory bandwidth** - static data stays in GPU cache, dynamic data updated sparingly
- **Better cache utilization** - static geometry uniforms remain hot in GPU cache

### Y-Plane Optimization Benefits
- **Simplified ray-plane intersection** - since all triangles are coplanar
- **Reduced 3D math complexity** - work directly in 2D space for triangle tests
- **Better numerical stability** - avoid potential floating-point errors from 3D projections

### Overall System Performance
- **Consistent 60+ FPS** with 8 visible triangles during camera movement
- **Immediate response** to dynamic property changes (color, visibility, thickness)
- **Reduced frame drops** during interactive operations
- **Foundation for future expansion** to support more triangles

## Files to Modify

**Primary files:**
- `supersplat-build/src/shaders/point-overlay-shader.ts` - Lines 225-290 (fragment shader main loop) + uniform declarations
- `supersplat-build/src/point-overlay.ts` - Uniform upload logic around lines 882-891 + data management

**Key Areas to Change:**
- **Shader uniforms**: Separate static geometry from dynamic styling uniforms
- **Fragment shader loop**: Add early exit and optimize point-in-triangle tests
- **Uniform upload logic**: Split into static (rare) and dynamic (occasional) uploads
- **Caching system**: Implement dirty flags for dynamic property tracking

**PlayCanvas Considerations:**
- **Uniform limits**: Monitor total uniform count (static + dynamic)
- **Scope resolution**: Ensure new uniform names work with `device.scope.resolve()`
- **Shader compilation**: Verify optimized shader compiles in PlayCanvas environment

## Success Criteria

✅ **Performance**: 60+ FPS maintained with 8 visible triangles during camera movement
✅ **Visual Fidelity**: Identical rendering output compared to original shader
✅ **Feature Parity**: All existing triangle interactions (selection, styling) work unchanged
✅ **Code Quality**: Cleaner, more maintainable shader code with better GPU optimization