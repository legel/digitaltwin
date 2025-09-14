/**
 * Integration script for loading pre-computed splat clipping polygons
 * This script extends GaussianSplatManager to load clipping data from JSON files
 * 
 * PURPOSE: This is a core part of the terrain-3d web application that enhances
 * the existing GaussianSplatManager with support for precise, pre-computed 
 * clipping polygons generated from actual splat point data analysis.
 * 
 * INTEGRATION: This file should be loaded after GaussianSplatManager.js in main.js
 * It extends the existing manager with new methods while maintaining backward compatibility.
 * 
 * WORKFLOW:
 * 1. Generate clipping polygons using splat_bounds_processor.py
 * 2. Place JSON files in /data/site-id/site-id_clipping.json
 * 3. This script automatically loads precise clipping when available
 * 4. Falls back to bounds-based clipping if no precise data exists
 */

// Extend GaussianSplatManager with clipping polygon loading
window.GaussianSplatManager.prototype.loadPrecomputedClipping = async function(siteId, tileset) {
    try {
        // Try to load pre-computed clipping polygon
        const clippingUrl = window.TerrainConfig ? 
            window.TerrainConfig.getDataUrl(`${siteId}/clipping-polygon.json`) :
            `/data/${siteId}/clipping-polygon.json`;
        const response = await fetch(clippingUrl);
        
        if (!response.ok) {
            return false;
        }
        
        const clippingData = await response.json();
        
        // Check if this is the new 3D bounding box format
        if ((clippingData.type === "3d_bounding_box" || clippingData.type === "polygonal_prism") && clippingData.vertices_3d) {
            
            // First, visualize the raw 3D bounding box before transformation
            const rawVertices = [];
            for (let i = 0; i < clippingData.vertices_3d.length; i += 3) {
                const localX = clippingData.vertices_3d[i];
                const localY = clippingData.vertices_3d[i + 1];
                const localZ = clippingData.vertices_3d[i + 2];
                rawVertices.push(new Cesium.Cartesian3(localX, localY, localZ));
            }
            
            // Get tileset transformation matrix
            const tilesetTransform = tileset.root.transform;
            const transformMatrix = Cesium.Matrix4.fromArray(tilesetTransform);
            
            // Get splat center and visualize raw prism using proper transformation (only in debug mode)
            const splatCenter = tileset.boundingSphere.center;
            if (this.debugMode) {
                this.visualizeRaw3DPrism(rawVertices, splatCenter, siteId, clippingData.type, clippingData.metadata, transformMatrix);
            }
            
            
            // Transform all 3D vertices to world coordinates
            const transformedVertices = [];
            for (let i = 0; i < clippingData.vertices_3d.length; i += 3) {
                const localX = clippingData.vertices_3d[i];
                const localY = clippingData.vertices_3d[i + 1];
                const localZ = clippingData.vertices_3d[i + 2];
                
                // Create local position as Cartesian4 (homogeneous coordinates)
                const localPosition = new Cesium.Cartesian4(localX, localY, localZ, 1.0);
                
                // Apply the tileset transformation matrix
                const transformedPosition = Cesium.Matrix4.multiplyByVector(transformMatrix, localPosition, new Cesium.Cartesian4());
                
                // Convert back to Cartesian3 (ignore w component)
                const worldPosition = new Cesium.Cartesian3(transformedPosition.x, transformedPosition.y, transformedPosition.z);
                
                transformedVertices.push(worldPosition);
            }
            
            // Project 3D vertices to 2D and find convex hull for clipping polygon
            var positions = this.project3DVerticesTo2D(transformedVertices, clippingData.type, clippingData.metadata);
            
        } else {
            // Legacy format - handle old 2D positions
            var positions = [];
            for (let i = 0; i < clippingData.positions.length; i += 3) {
                const x = clippingData.positions[i];
                const y = clippingData.positions[i + 1];
                const z = clippingData.positions[i + 2] || 0;
                
                positions.push(Cesium.Cartesian3.fromDegrees(x, y, z));
            }
        }
        
        // Create the clipping polygon
        const clippingPolygon = new Cesium.ClippingPolygon({
            positions: positions,
            extrudedHeight: clippingData.extrudedHeight || 0,
            height: clippingData.height || 1000
        });
        
        // Create clipping polygon collection
        const clippingPolygonCollection = new Cesium.ClippingPolygonCollection({
            polygons: [clippingPolygon],
            enabled: true,
            inverse: false  // Hide the area inside the polygon
        });
        
        // Store the clipping polygon for this site
        this.clippingPolygons.set(siteId, clippingPolygonCollection);
        
        // Apply clipping to the Google Photorealistic tileset
        this.applyTerrainClipping(siteId);
        
        // Automatically visualize the clipping polygon bounds (only in debug mode)
        if (this.debugMode) {
            console.log(`About to visualize clipping polygon for site: ${siteId}`);
            this.visualizeClippingPolygon(siteId);
        }
        
        return true;
        
    } catch (error) {
        console.error(`Error loading pre-computed clipping for ${siteId}:`, error);
        return false;
    }
};

// Override the createTerrainClipping method to try pre-computed clipping first
window.GaussianSplatManager.prototype.createTerrainClippingOriginal = 
    window.GaussianSplatManager.prototype.createTerrainClipping;

window.GaussianSplatManager.prototype.createTerrainClipping = async function(tileset, siteId) {
    try {
        // Try to load pre-computed clipping with tileset for coordinate transformation
        const precomputedLoaded = await this.loadPrecomputedClipping(siteId, tileset);
        
        if (precomputedLoaded) {
            return;
        }
        
        // No clipping polygon found - skip clipping entirely
        
    } catch (error) {
        console.error(`Error in createTerrainClipping for ${siteId}:`, error);
    }
};

// Utility function to visualize clipping polygon bounds (for debugging)
window.GaussianSplatManager.prototype.visualizeClippingPolygon = function(siteId) {
    const clippingCollection = this.clippingPolygons.get(siteId);
    if (!clippingCollection) {
        console.warn(`No clipping polygon found for site: ${siteId}`);
        return;
    }
    
    // Debug logging to understand the structure
    console.log('Clipping collection structure:', clippingCollection);
    
    // Check if collection has polygons using length property
    if (clippingCollection.length === 0) {
        console.warn(`Clipping collection exists but has no polygons for site: ${siteId}`);
        return;
    }
    
    // Access the first polygon using get() method
    const polygon = clippingCollection.get(0);
        
    if (!polygon) {
        console.warn(`Could not access polygon from collection for site: ${siteId}`);
        return;
    }
    
    const positions = polygon.positions;
    
    // Create a visual entity to show the clipping polygon outline
    const outlineEntity = this.viewer.entities.add({
        name: `Clipping_Outline_${siteId}`,
        polyline: {
            positions: [...positions, positions[0]], // Close the loop
            width: 3,
            material: Cesium.Color.YELLOW,
            clampToGround: true,
            zIndex: 1000
        },
        label: {
            text: `Clipping Polygon: ${siteId}`,
            font: '12pt monospace',
            fillColor: Cesium.Color.YELLOW,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -30),
            disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
    });
    
    // Store reference for cleanup (remove any existing outline first)
    if (!this.clippingOutlines) {
        this.clippingOutlines = new Map();
    }
    
    // Remove existing outline if it exists
    const existingOutline = this.clippingOutlines.get(siteId);
    if (existingOutline) {
        this.viewer.entities.remove(existingOutline);
    }
    
    this.clippingOutlines.set(siteId, outlineEntity);
    
    console.log(`Clipping polygon outline visualized for site: ${siteId}`);
};

// Remove clipping polygon outline
window.GaussianSplatManager.prototype.removeClippingVisualization = function(siteId) {
    if (this.clippingOutlines && this.clippingOutlines.has(siteId)) {
        const outlineEntity = this.clippingOutlines.get(siteId);
        if (this.viewer && this.viewer.entities && outlineEntity) {
            this.viewer.entities.remove(outlineEntity);
        }
        this.clippingOutlines.delete(siteId);
        console.log(`Clipping outline visualization removed for site: ${siteId}`);
    }
};

// Update the cleanup methods to include outline removal
const originalRemoveTerrainClipping = window.GaussianSplatManager.prototype.removeTerrainClipping;
window.GaussianSplatManager.prototype.removeTerrainClipping = function(siteId) {
    // Remove outline visualization
    this.removeClippingVisualization(siteId);
    
    // Remove raw prism visualization
    this.removeRawPrismVisualization(siteId);
    
    // Call original cleanup
    originalRemoveTerrainClipping.call(this, siteId);
};

const originalRemoveAllTerrainClipping = window.GaussianSplatManager.prototype.removeAllTerrainClipping;
window.GaussianSplatManager.prototype.removeAllTerrainClipping = function() {
    // Remove all outline visualizations
    if (this.clippingOutlines) {
        for (const siteId of this.clippingOutlines.keys()) {
            this.removeClippingVisualization(siteId);
        }
    }
    
    // Remove all raw prism visualizations
    if (this.rawPrismVisualizations) {
        for (const siteId of this.rawPrismVisualizations.keys()) {
            this.removeRawPrismVisualization(siteId);
        }
    }
    
    // Call original cleanup
    originalRemoveAllTerrainClipping.call(this);
};

// Utility method to project 3D vertices to 2D and find convex hull
window.GaussianSplatManager.prototype.project3DVerticesTo2D = function(vertices3d, prismType, metadata) {
    
    // For polygonal prisms, use only the bottom polygon vertices
    let verticesToProject = vertices3d;
    if (prismType === "polygonal_prism" && metadata && metadata.base_vertices) {
        // Take only the first N vertices (bottom polygon)
        verticesToProject = vertices3d.slice(0, metadata.base_vertices);
    }
    
    // Convert vertices to geographic coordinates for 2D projection
    const geoPoints = [];
    for (const vertex of verticesToProject) {
        const cartographic = Cesium.Cartographic.fromCartesian(vertex);
        const longitude = Cesium.Math.toDegrees(cartographic.longitude);
        const latitude = Cesium.Math.toDegrees(cartographic.latitude);
        geoPoints.push([longitude, latitude]);
    }
    
    
    // For polygonal prisms, the vertices are already in the correct order, so we can use them directly
    // For rectangular prisms, we need to calculate the convex hull
    let finalPoints;
    if (prismType === "polygonal_prism") {
        // Use the polygon vertices directly (they're already in correct order)
        finalPoints = geoPoints;
    } else {
        // Calculate 2D convex hull using a simple algorithm
        finalPoints = this.calculateConvexHull2D(geoPoints);
    }
    
    // Convert final points back to Cartesian3 positions
    const positions = [];
    for (const point of finalPoints) {
        const cartesian = Cesium.Cartesian3.fromDegrees(point[0], point[1], 0);
        positions.push(cartesian);
    }
    
    return positions;
};

// Simple 2D convex hull calculation (Graham scan algorithm)
window.GaussianSplatManager.prototype.calculateConvexHull2D = function(points) {
    if (points.length < 3) return points;
    
    // Find the bottom-most point (and leftmost in case of tie)
    let start = 0;
    for (let i = 1; i < points.length; i++) {
        if (points[i][1] < points[start][1] || 
            (points[i][1] === points[start][1] && points[i][0] < points[start][0])) {
            start = i;
        }
    }
    
    // Sort points by polar angle with respect to start point
    const startPoint = points[start];
    const sortedPoints = points.filter((_, i) => i !== start);
    
    sortedPoints.sort((a, b) => {
        const angleA = Math.atan2(a[1] - startPoint[1], a[0] - startPoint[0]);
        const angleB = Math.atan2(b[1] - startPoint[1], b[0] - startPoint[0]);
        return angleA - angleB;
    });
    
    // Build convex hull
    const hull = [startPoint];
    
    for (const point of sortedPoints) {
        // Remove points that create right turns
        while (hull.length > 1 && this.crossProduct(hull[hull.length-2], hull[hull.length-1], point) <= 0) {
            hull.pop();
        }
        hull.push(point);
    }
    
    return hull;
};

// Calculate cross product for convex hull algorithm
window.GaussianSplatManager.prototype.crossProduct = function(O, A, B) {
    return (A[0] - O[0]) * (B[1] - O[1]) - (A[1] - O[1]) * (B[0] - O[0]);
};

// Visualize raw 3D prism before transformation (for debugging)
window.GaussianSplatManager.prototype.visualizeRaw3DPrism = function(rawVertices, splatCenter, siteId, prismType, metadata, transformMatrix) {
    console.log(`Visualizing raw 3D ${prismType} before transformation`);
    console.log('Raw vertices:', rawVertices);
    console.log('Splat center:', splatCenter);
    console.log('Metadata:', metadata);
    
    // Convert raw local vertices to world coordinates using tileset transformation
    const worldVertices = [];
    for (const vertex of rawVertices) {
        // Create local position as Cartesian4 (homogeneous coordinates)
        const localPosition = new Cesium.Cartesian4(vertex.x, vertex.y, vertex.z, 1.0);
        
        // Apply the tileset transformation matrix
        const transformedPosition = Cesium.Matrix4.multiplyByVector(transformMatrix, localPosition, new Cesium.Cartesian4());
        
        // Convert back to Cartesian3 (ignore w component)
        const worldPosition = new Cesium.Cartesian3(transformedPosition.x, transformedPosition.y, transformedPosition.z);
        worldVertices.push(worldPosition);
        
        console.log(`Raw vertex: (${vertex.x}, ${vertex.y}, ${vertex.z}) -> World:`, worldPosition);
    }
    
    // Create wireframe visualization based on prism type
    let prismEdges;
    
    if (prismType === "polygonal_prism") {
        // For polygonal prism: first N vertices are bottom polygon, next N are top polygon
        const baseVertices = metadata.base_vertices || (rawVertices.length / 2);
        prismEdges = this.createPolygonalPrismEdges(baseVertices);
    } else {
        // Legacy rectangular prism: 8 vertices forming a box
        prismEdges = this.createRectangularPrismEdges();
    }
    
    // Create polyline entities for each edge
    const rawPrismEntities = [];
    
    for (let i = 0; i < prismEdges.length; i++) {
        const [startIdx, endIdx] = prismEdges[i];
        const startPos = worldVertices[startIdx];
        const endPos = worldVertices[endIdx];
        
        const lineEntity = this.viewer.entities.add({
            name: `Raw_Prism_Edge_${siteId}_${i}`,
            polyline: {
                positions: [startPos, endPos],
                width: 2,
                material: Cesium.Color.CYAN,
                clampToGround: false, // Keep 3D positioning for debug wireframe
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            }
        });
        
        rawPrismEntities.push(lineEntity);
    }
    
    // Add vertex markers for debugging
    for (let i = 0; i < worldVertices.length; i++) {
        const pointEntity = this.viewer.entities.add({
            name: `Raw_Prism_Vertex_${siteId}_${i}`,
            position: worldVertices[i],
            point: {
                pixelSize: 8,
                color: Cesium.Color.CYAN,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 1,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            },
            label: {
                text: `V${i}`,
                font: '10pt monospace',
                fillColor: Cesium.Color.CYAN,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 1,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                pixelOffset: new Cesium.Cartesian2(10, 0),
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            }
        });
        
        rawPrismEntities.push(pointEntity);
    }
    
    // Store for cleanup
    if (!this.rawPrismVisualizations) {
        this.rawPrismVisualizations = new Map();
    }
    this.rawPrismVisualizations.set(siteId, rawPrismEntities);
    
    console.log(`Raw 3D prism visualized with ${rawPrismEntities.length} entities for site: ${siteId}`);
};

// Helper function to create rectangular prism edges (legacy format)
window.GaussianSplatManager.prototype.createRectangularPrismEdges = function() {
    // The 8 vertices form a box: indices 0-3 bottom face, 4-7 top face
    // Box edges: bottom square, top square, vertical edges
    return [
        // Bottom face (z-min)
        [0, 1], [1, 2], [2, 3], [3, 0],
        // Top face (z-max) 
        [4, 5], [5, 6], [6, 7], [7, 4],
        // Vertical edges
        [0, 4], [1, 5], [2, 6], [3, 7]
    ];
};

// Helper function to create polygonal prism edges
window.GaussianSplatManager.prototype.createPolygonalPrismEdges = function(baseVertices) {
    const edges = [];
    
    // Bottom polygon edges (indices 0 to baseVertices-1)
    for (let i = 0; i < baseVertices; i++) {
        const nextI = (i + 1) % baseVertices;
        edges.push([i, nextI]);
    }
    
    // Top polygon edges (indices baseVertices to 2*baseVertices-1)
    for (let i = 0; i < baseVertices; i++) {
        const nextI = (i + 1) % baseVertices;
        edges.push([baseVertices + i, baseVertices + nextI]);
    }
    
    // Vertical edges connecting bottom to top
    for (let i = 0; i < baseVertices; i++) {
        edges.push([i, baseVertices + i]);
    }
    
    return edges;
};

// Remove raw prism visualization
window.GaussianSplatManager.prototype.removeRawPrismVisualization = function(siteId) {
    if (this.rawPrismVisualizations && this.rawPrismVisualizations.has(siteId)) {
        const entities = this.rawPrismVisualizations.get(siteId);
        for (const entity of entities) {
            if (this.viewer && this.viewer.entities && entity) {
                this.viewer.entities.remove(entity);
            }
        }
        this.rawPrismVisualizations.delete(siteId);
        console.log(`Raw prism visualization removed for site: ${siteId}`);
    }
};

// Splat clipping integration loaded