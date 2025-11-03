/**
 * Polygon Manager - Handles polygon representation, triangulation, and utility functions
 * Ported from point-overlay-backup.ts to handle polygon operations on the JS side
 */

/**
 * Change types for dirty polygon tracking system
 * Different change types require different levels of recalculation
 */
const ChangeType = {
    // Geometry changes - require full retriangulation and border recalculation
    GEOMETRY: 'geometry',

    // Visual changes - only require render data update (colors, alpha)
    VISUAL: 'visual',

    // Visibility changes - require render list update
    VISIBILITY: 'visibility'
};

/**
 * Dirty polygon entry to track what changed and when
 */
class DirtyPolygonEntry {
    constructor(polygon, changeTypes = new Set()) {
        this.polygon = polygon;
        this.changeTypes = new Set(changeTypes); // Set of ChangeType values
        this.timestamp = Date.now();
    }

    /**
     * Add additional change type to this dirty entry
     */
    addChangeType(changeType) {
        this.changeTypes.add(changeType);
        this.timestamp = Date.now(); // Update timestamp
    }

    /**
     * Check if this entry has a specific change type
     */
    hasChangeType(changeType) {
        return this.changeTypes.has(changeType);
    }

    /**
     * Get all change types as array
     */
    getChangeTypes() {
        return Array.from(this.changeTypes);
    }
}

/**
 * Triangle data structure for rendering (internal triangulation format)
 */
class TriangleData {
    constructor(vertices, color) {
        this.vertices = vertices || []; // 3 vertices, each [x, y, z]
        this.color = color || {r: 0, g: 0, b: 0};
    }
}

/**
 * Rendering triangle data structure (format sent to renderer)
 */
class RenderTriangleData {
    constructor(vertices, color) {
        this.vertices = vertices || []; // 3 vertices, each [x, y, z] array
        this.color = color || {r: 0, g: 0, b: 0, a: 1.0}; // RGBA color object
    }
}

/**
 * Polygon data structure
 */
class PolygonData {
    constructor(options = {}) {
        this.vertices = options.vertices || [];
        this.color = options.color || {r: 0, g: 1, b: 0};
        this.fillAlpha = options.fillAlpha !== undefined ? options.fillAlpha : 1.0;
        this.outlineColor = options.outlineColor || {r: 1, g: 1, b: 1};
        this.outlineThickness = options.outlineThickness || 0.1;
        this.name = options.name;
        this.visible = options.visible !== false; // Default to true
        this.group = options.group; // Group name for PA/NPA grouping
    }
}

/**
 * Polygon class with triangulation capabilities
 */
class Polygon {
    constructor(data) {
        this.vertices = data.vertices ? data.vertices.map(v => this.cloneVec3(v)) : [];
        this.color = this.cloneVec3(data.color || {x: 0, y: 1, z: 0});
        this.fillAlpha = data.fillAlpha !== undefined ? data.fillAlpha : 1.0;
        this.outlineColor = this.cloneVec3(data.outlineColor || {x: 1, y: 1, z: 1});
        this.outlineThickness = data.outlineThickness || 0.1;
        this.baseOutlineThickness = data.outlineThickness || 0.1; // Store original thickness
        this.baseFillColor = this.cloneVec3(data.color || {x: 0, y: 1, z: 0}); // Store original fill color
        this.baseFillAlpha = data.fillAlpha !== undefined ? data.fillAlpha : 1.0; // Store original fill alpha
        this.baseOutlineColor = this.cloneVec3(data.outlineColor || {x: 1, y: 1, z: 1}); // Store original outline color
        this.name = data.name;
        this.visible = data.visible !== false; // Default to true
        this.selected = false; // Default to not selected
        this.group = data.group; // Store group information

        // Calculate polygon area for nested click detection priority
        this.area = this.calculateArea();

        // Triangulation data
        this.triangles = [];
        this.exteriorEdges = undefined;
        this.polygonWindingClockwise = undefined;
        this.cachedTriangleCount = 0;

        // Inset polygon data for proper border rendering
        this.originalVertices = this.vertices.map(v => this.cloneVec3(v)); // Store original vertices
        this.shrunkVertices = []; // Inset vertices for fill triangulation
        this.shrunkPolygonValid = true; // Flag to track if shrinking was successful

        // Rendering data (format sent to renderer)
        this.renderTriangles = [];
        this.borderTriangles = [];

        // Dirty tracking for optimization
        this.isDirty = false;
        this.dirtyChangeTypes = new Set();
        this.manager = null; // Reference to parent manager for dirty notifications

        // Automatically shrink polygon, triangulate, and calculate rendering data
        this.shrinkPolygon();
        this.triangulate();
        this.generateBorderTriangles();
        this.calculateRenderingData();
    }

    /**
     * Helper to clone Vec3-like objects
     */
    cloneVec3(vec) {
        if (!vec) return {x: 0, y: 0, z: 0};
        return {x: vec.x || 0, y: vec.y || 0, z: vec.z || 0};
    }

    /**
     * Calculate polygon area using the shoelace formula (for 2D projection on Y-plane)
     * Used for nested polygon click detection priority - smaller polygons checked first
     */
    calculateArea() {
        if (this.vertices.length < 3) {
            return 0;
        }

        let area = 0;
        const n = this.vertices.length;

        // Use shoelace formula with X and Z coordinates (Y-plane projection)
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            area += this.vertices[i].x * this.vertices[j].z;
            area -= this.vertices[j].x * this.vertices[i].z;
        }

        return Math.abs(area) / 2; // Return positive area
    }

    /**
     * Shrink polygon inward by border thickness to create proper fill area
     * This prevents fill/border overlap and ensures seamless border connections
     */
    shrinkPolygon() {
        this.shrunkVertices = [];
        this.shrunkPolygonValid = true;

        if (this.vertices.length < 3 || this.outlineThickness <= 0) {
            // No shrinking needed for invalid polygons or zero thickness
            this.shrunkVertices = this.vertices.map(v => this.cloneVec3(v));
            return;
        }

        // Calculate polygon centroid for scaling fallback
        const centroid = this.calculateCentroid();
        const originalArea = this.calculateArea();

        // Calculate minimum area threshold (50% of original)
        const minAreaThreshold = originalArea * 0.5;

        try {
            // Method 1: Try inward normal displacement
            const insetVertices = this.calculateInsetVertices();

            if (insetVertices && insetVertices.length >= 3) {
                // Check if inset polygon is valid and not too small
                const insetArea = this.calculateAreaFromVertices(insetVertices);

                if (insetArea >= minAreaThreshold && this.isPolygonValid(insetVertices)) {
                    this.shrunkVertices = insetVertices;
                    return;
                }
            }

            // Method 2: Fallback to uniform scaling from centroid
            this.shrunkVertices = this.calculateScaledVertices(centroid, Math.sqrt(minAreaThreshold / originalArea));

        } catch (error) {
            console.warn(`⚠️ Polygon "${this.name}" shrinking failed: ${error.message}, using original vertices`);
            this.shrunkVertices = this.vertices.map(v => this.cloneVec3(v));
            this.shrunkPolygonValid = false;
        }
    }

    /**
     * Calculate polygon centroid (center point)
     */
    calculateCentroid() {
        let cx = 0, cz = 0;
        for (const vertex of this.vertices) {
            cx += vertex.x;
            cz += vertex.z;
        }
        return {
            x: cx / this.vertices.length,
            y: this.vertices[0].y || 0,
            z: cz / this.vertices.length
        };
    }

    /**
     * Calculate area from a given set of vertices
     */
    calculateAreaFromVertices(vertices) {
        if (vertices.length < 3) return 0;

        let area = 0;
        const n = vertices.length;

        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            area += vertices[i].x * vertices[j].z;
            area -= vertices[j].x * vertices[i].z;
        }

        return Math.abs(area) / 2;
    }

    /**
     * Calculate inset vertices by moving each vertex inward along its bisector normal
     */
    calculateInsetVertices() {
        const insetVertices = [];
        const n = this.vertices.length;

        if (n < 3) return null;

        // Determine polygon winding if not already done
        if (this.polygonWindingClockwise === undefined) {
            this.determinePolygonWinding();
        }

        for (let i = 0; i < n; i++) {
            const prev = this.vertices[(i - 1 + n) % n];
            const curr = this.vertices[i];
            const next = this.vertices[(i + 1) % n];

            // Calculate inward bisector normal for this vertex
            const bisectorNormal = this.calculateInwardBisectorNormal(prev, curr, next);

            if (!bisectorNormal) {
                // Fallback for degenerate cases
                console.warn(`⚠️ Could not calculate bisector for vertex ${i} in polygon "${this.name}"`);
                return null;
            }

            // Move vertex inward along bisector normal
            const insetVertex = {
                x: curr.x - bisectorNormal.x * this.outlineThickness,
                y: curr.y || 0,
                z: curr.z - bisectorNormal.z * this.outlineThickness
            };

            insetVertices.push(insetVertex);
        }

        // Clean up self-intersections if any
        return this.cleanupSelfIntersections(insetVertices);
    }

    /**
     * Calculate inward-pointing bisector normal for a vertex
     * Takes the angle bisector of the two adjacent edges and points it inward
     */
    calculateInwardBisectorNormal(prevVertex, currVertex, nextVertex) {
        // Calculate edge vectors
        const edge1X = prevVertex.x - currVertex.x;
        const edge1Z = prevVertex.z - currVertex.z;
        const edge2X = nextVertex.x - currVertex.x;
        const edge2Z = nextVertex.z - currVertex.z;

        // Normalize edge vectors
        const edge1Len = Math.sqrt(edge1X * edge1X + edge1Z * edge1Z);
        const edge2Len = Math.sqrt(edge2X * edge2X + edge2Z * edge2Z);

        if (edge1Len < 1e-10 || edge2Len < 1e-10) {
            return null; // Degenerate edge
        }

        const norm1X = edge1X / edge1Len;
        const norm1Z = edge1Z / edge1Len;
        const norm2X = edge2X / edge2Len;
        const norm2Z = edge2Z / edge2Len;

        // Calculate bisector direction (average of normalized edges)
        let bisectorX = (norm1X + norm2X) / 2;
        let bisectorZ = (norm1Z + norm2Z) / 2;

        // Handle parallel edges (bisector would be zero)
        const bisectorLen = Math.sqrt(bisectorX * bisectorX + bisectorZ * bisectorZ);
        if (bisectorLen < 1e-10) {
            // Use perpendicular to one of the edges
            bisectorX = -norm1Z;
            bisectorZ = norm1X;
        } else {
            // Normalize bisector
            bisectorX /= bisectorLen;
            bisectorZ /= bisectorLen;
        }

        // Determine if bisector points inward or outward using cross product
        const cross = edge1X * edge2Z - edge1Z * edge2X;
        const isConvexVertex = this.polygonWindingClockwise ? cross < 0 : cross > 0;

        // For convex vertices, bisector naturally points inward
        // For concave vertices, we need to flip it
        if (!isConvexVertex) {
            bisectorX = -bisectorX;
            bisectorZ = -bisectorZ;
        }

        // Calculate scaling factor to maintain consistent inset distance
        // This is needed because bisector length varies with vertex angle
        const dotProduct = norm1X * norm2X + norm1Z * norm2Z;
        const angle = Math.acos(Math.max(-1, Math.min(1, dotProduct)));
        const scaleFactor = 1 / Math.sin(angle / 2);

        // Clamp scale factor to prevent extreme values at sharp angles
        const clampedScaleFactor = Math.min(scaleFactor, 10);

        return {
            x: bisectorX * clampedScaleFactor,
            z: bisectorZ * clampedScaleFactor
        };
    }

    /**
     * Clean up self-intersections in the inset polygon
     * Detects when inward displacement causes vertices to cross and either reduces displacement or fails
     */
    cleanupSelfIntersections(vertices) {
        if (vertices.length < 3) return vertices;

        // Check for edge crossings in the inset polygon
        if (this.hasEdgeCrossings(vertices)) {

            // Try with reduced displacement (50% of original)
            const reducedVertices = this.calculateInsetVerticesWithReduction(0.5);
            if (reducedVertices && !this.hasEdgeCrossings(reducedVertices)) {
                return reducedVertices;
            }

            // Try with further reduced displacement (25% of original)
            const furtherReducedVertices = this.calculateInsetVerticesWithReduction(0.25);
            if (furtherReducedVertices && !this.hasEdgeCrossings(furtherReducedVertices)) {
                return furtherReducedVertices;
            }

            // If still problematic, return null to trigger fallback
            return null;
        }

        return vertices;
    }

    /**
     * Detect if any edges cross each other in the polygon (self-intersection detection)
     */
    hasEdgeCrossings(vertices) {
        const n = vertices.length;
        if (n < 4) return false; // Need at least 4 vertices to have crossing edges

        // Check each edge against every other non-adjacent edge
        for (let i = 0; i < n; i++) {
            const edge1Start = vertices[i];
            const edge1End = vertices[(i + 1) % n];

            // Check against non-adjacent edges (skip adjacent and next-adjacent)
            for (let j = i + 2; j < n; j++) {
                if (j === n - 1 && i === 0) continue; // Skip wrap-around adjacent edge

                const edge2Start = vertices[j];
                const edge2End = vertices[(j + 1) % n];

                if (this.edgesIntersect(edge1Start, edge1End, edge2Start, edge2End)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Check if two line segments intersect
     */
    edgesIntersect(p1, q1, p2, q2) {
        // Using orientation method for line segment intersection
        const o1 = this.orientation(p1, q1, p2);
        const o2 = this.orientation(p1, q1, q2);
        const o3 = this.orientation(p2, q2, p1);
        const o4 = this.orientation(p2, q2, q1);

        // General case - different orientations
        if (o1 !== o2 && o3 !== o4) {
            return true;
        }

        // Special cases for collinear points
        if (o1 === 0 && this.onSegment(p1, p2, q1)) return true;
        if (o2 === 0 && this.onSegment(p1, q2, q1)) return true;
        if (o3 === 0 && this.onSegment(p2, p1, q2)) return true;
        if (o4 === 0 && this.onSegment(p2, q1, q2)) return true;

        return false;
    }

    /**
     * Calculate orientation of ordered triplet (p, q, r)
     * Returns 0 if collinear, 1 if clockwise, 2 if counterclockwise
     */
    orientation(p, q, r) {
        const val = (q.z - p.z) * (r.x - q.x) - (q.x - p.x) * (r.z - q.z);
        if (Math.abs(val) < 1e-10) return 0; // Collinear
        return (val > 0) ? 1 : 2; // Clockwise or counterclockwise
    }

    /**
     * Check if point q lies on line segment pr
     */
    onSegment(p, q, r) {
        return (q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) &&
                q.z <= Math.max(p.z, r.z) && q.z >= Math.min(p.z, r.z));
    }

    /**
     * Calculate inset vertices with reduced displacement factor
     */
    calculateInsetVerticesWithReduction(reductionFactor) {
        const insetVertices = [];
        const n = this.vertices.length;

        if (n < 3) return null;

        // Determine polygon winding if not already done
        if (this.polygonWindingClockwise === undefined) {
            this.determinePolygonWinding();
        }

        for (let i = 0; i < n; i++) {
            const prev = this.vertices[(i - 1 + n) % n];
            const curr = this.vertices[i];
            const next = this.vertices[(i + 1) % n];

            // Calculate inward bisector normal for this vertex
            const bisectorNormal = this.calculateInwardBisectorNormal(prev, curr, next);

            if (!bisectorNormal) {
                return null;
            }

            // Move vertex inward along bisector normal with reduced displacement
            const reducedThickness = this.outlineThickness * reductionFactor;
            const insetVertex = {
                x: curr.x - bisectorNormal.x * reducedThickness,
                y: curr.y || 0,
                z: curr.z - bisectorNormal.z * reducedThickness
            };

            insetVertices.push(insetVertex);
        }

        return insetVertices;
    }

    /**
     * Calculate scaled vertices from centroid (fallback method)
     */
    calculateScaledVertices(centroid, scaleFactor) {
        return this.vertices.map(vertex => ({
            x: centroid.x + (vertex.x - centroid.x) * scaleFactor,
            y: vertex.y || 0,
            z: centroid.z + (vertex.z - centroid.z) * scaleFactor
        }));
    }

    /**
     * Check if a polygon is valid (no self-intersections, proper winding)
     */
    isPolygonValid(vertices) {
        if (vertices.length < 3) return false;

        // Simple validity check: ensure polygon area is positive
        const area = this.calculateAreaFromVertices(vertices);
        return area > 1e-10;
    }

    /**
     * Triangulate the polygon into triangles using the shrunk vertices for fill
     * This prevents fill/border overlap and ensures clean rendering
     */
    triangulate() {
        this.triangles = [];
        this.exteriorEdges = undefined; // Reset exterior edge set for re-triangulation
        this.polygonWindingClockwise = undefined; // Reset winding determination

        // Use shrunk vertices for triangulation if available and valid
        const triangulationVertices = (this.shrunkVertices && this.shrunkVertices.length >= 3 && this.shrunkPolygonValid)
            ? this.shrunkVertices
            : this.vertices;

        if (triangulationVertices.length < 3) {
            console.warn(`⚠️ Polygon "${this.name}" has less than 3 vertices - cannot triangulate`);
            this.cachedTriangleCount = 0;
            return;
        }

        if (triangulationVertices.length === 3) {
            // Already a triangle - all edges are perimeter edges
            this.triangles.push({
                v0: this.cloneVec3(triangulationVertices[0]),
                v1: this.cloneVec3(triangulationVertices[1]),
                v2: this.cloneVec3(triangulationVertices[2]),
                color: this.cloneVec3(this.color),
                fillAlpha: this.fillAlpha,
                outlineColor: this.cloneVec3(this.outlineColor),
                outlineThickness: this.outlineThickness,
                name: `${this.name}_tri_0`,
                edge01Visible: true, // v0 → v1 (perimeter edge)
                edge12Visible: true, // v1 → v2 (perimeter edge)
                edge20Visible: true  // v2 → v0 (perimeter edge)
            });
            this.cachedTriangleCount = 1;
            return;
        }

        // Choose triangulation method based on polygon complexity
        if (triangulationVertices.length <= 6) {
            // Simple polygon: use fast fan triangulation
            this.triangulateWithFan(triangulationVertices);
        } else {
            // Complex polygon: use ear clipping for accurate triangulation
            this.triangulateWithEarClipping(triangulationVertices);
        }

        // Cache triangle count for performance
        this.cachedTriangleCount = this.triangles.length;
    }

    /**
     * Fan triangulation (original method) - fast but only works for convex polygons
     */
    triangulateWithFan(vertices = this.vertices) {
        const firstVertex = vertices[0];
        const numVertices = vertices.length;

        for (let i = 1; i < numVertices - 1; i++) {
            const v0 = this.cloneVec3(firstVertex);          // Fan center (first vertex)
            const v1 = this.cloneVec3(vertices[i]);     // Current vertex
            const v2 = this.cloneVec3(vertices[i + 1]); // Next vertex

            // Ensure counterclockwise winding for PlayCanvas
            let finalV0, finalV1, finalV2;
            if (this.polygonWindingClockwise) {
                // Input is clockwise, reverse triangle winding to make it counterclockwise
                finalV0 = v0; finalV1 = v2; finalV2 = v1;
            } else {
                // Input is already counterclockwise, keep original order
                finalV0 = v0; finalV1 = v1; finalV2 = v2;
            }

            // Classify edges for this triangle
            let edge01Visible = false; // v0 → v1 (from center to current)
            let edge12Visible = false; // v1 → v2 (from current to next)
            let edge20Visible = false; // v2 → v0 (from next to center)

            // Edge v1 → v2: This is always a perimeter edge (consecutive polygon vertices)
            edge12Visible = true;

            // Edge v0 → v1: Only visible if v1 is the first polygon vertex after v0
            if (i === 1) {
                edge01Visible = true;
            }

            // Edge v2 → v0: Only visible if v2 is the last polygon vertex before v0
            if (i === numVertices - 2) {
                edge20Visible = true;
            }

            this.triangles.push({
                v0: finalV0,
                v1: finalV1,
                v2: finalV2,
                color: this.cloneVec3(this.color),
                fillAlpha: this.fillAlpha,
                outlineColor: this.cloneVec3(this.outlineColor),
                outlineThickness: this.outlineThickness,
                name: `${this.name}_fan_${i-1}`,
                edge01Visible,
                edge12Visible,
                edge20Visible
            });
        }
    }

    /**
     * Ear clipping triangulation - handles complex and concave polygons correctly
     */
    triangulateWithEarClipping(vertices = this.vertices) {
        // Create working copy of vertices with indices
        const workingVertices = vertices.map((v, i) => ({
            vertex: this.cloneVec3(v),
            originalIndex: i
        }));

        let triangleIndex = 0;
        let maxIterations = workingVertices.length * 3; // Prevent infinite loops
        let iterationCount = 0;

        while (workingVertices.length > 3 && iterationCount < maxIterations) {
            let earFound = false;
            iterationCount++;

            // Look for an ear (a convex vertex where the triangle contains no other vertices)
            for (let i = 0; i < workingVertices.length; i++) {
                const prevI = (i - 1 + workingVertices.length) % workingVertices.length;
                const nextI = (i + 1) % workingVertices.length;

                const prev = workingVertices[prevI];
                const curr = workingVertices[i];
                const next = workingVertices[nextI];

                if (this.isEar(prev, curr, next, workingVertices)) {
                    earFound = true;
                    // Found an ear! Create triangle and remove the ear vertex
                    // Ensure counterclockwise winding for PlayCanvas
                    let finalV0, finalV1, finalV2;
                    if (!this.polygonWindingClockwise) {
                        // Input is counterclockwise, reverse triangle winding to match fan triangulation
                        finalV0 = this.cloneVec3(prev.vertex);
                        finalV1 = this.cloneVec3(next.vertex);
                        finalV2 = this.cloneVec3(curr.vertex);
                    } else {
                        // Input is clockwise, keep original order to match fan triangulation
                        finalV0 = this.cloneVec3(prev.vertex);
                        finalV1 = this.cloneVec3(curr.vertex);
                        finalV2 = this.cloneVec3(next.vertex);
                    }

                    const triangle = {
                        v0: finalV0,
                        v1: finalV1,
                        v2: finalV2,
                        color: this.cloneVec3(this.color),
                        fillAlpha: this.fillAlpha,
                        outlineColor: this.cloneVec3(this.outlineColor),
                        outlineThickness: this.outlineThickness,
                        name: `${this.name}_ear_${triangleIndex}`,
                        ...this.classifyEarEdges(prev.originalIndex, curr.originalIndex, next.originalIndex)
                    };

                    this.triangles.push(triangle);

                    // Remove the ear vertex
                    workingVertices.splice(i, 1);
                    triangleIndex++;
                    earFound = true;
                    break;
                }
            }

            if (!earFound) {
                console.warn(`⚠️ EAR CLIPPING STUCK for polygon "${this.name}" after ${iterationCount} iterations`);
                console.warn(`⚠️ Falling back to fan triangulation for remaining ${workingVertices.length} vertices`);

                // Fallback to fan triangulation for remaining vertices
                this.triangulateRemainingWithFan(workingVertices, this.triangles.length);
                break;
            }
        }

        // Add final triangle
        if (workingVertices.length === 3) {
            // Ensure counterclockwise winding for PlayCanvas
            let finalV0, finalV1, finalV2;
            if (!this.polygonWindingClockwise) {
                // Input is counterclockwise, reverse triangle winding to match fan triangulation
                finalV0 = this.cloneVec3(workingVertices[0].vertex);
                finalV1 = this.cloneVec3(workingVertices[2].vertex);
                finalV2 = this.cloneVec3(workingVertices[1].vertex);
            } else {
                // Input is clockwise, keep original order to match fan triangulation
                finalV0 = this.cloneVec3(workingVertices[0].vertex);
                finalV1 = this.cloneVec3(workingVertices[1].vertex);
                finalV2 = this.cloneVec3(workingVertices[2].vertex);
            }

            const triangle = {
                v0: finalV0,
                v1: finalV1,
                v2: finalV2,
                color: this.cloneVec3(this.color),
                fillAlpha: this.fillAlpha,
                outlineColor: this.cloneVec3(this.outlineColor),
                outlineThickness: this.outlineThickness,
                name: `${this.name}_ear_final`,
                ...this.classifyEarEdges(workingVertices[0].originalIndex, workingVertices[1].originalIndex, workingVertices[2].originalIndex)
            };

            this.triangles.push(triangle);
        }
    }

    /**
     * Fallback fan triangulation for remaining vertices if ear clipping gets stuck
     */
    triangulateRemainingWithFan(workingVertices, startIndex) {
        if (workingVertices.length < 3) return;

        const firstVertex = workingVertices[0];
        for (let i = 1; i < workingVertices.length - 1; i++) {
            // Ensure counterclockwise winding for PlayCanvas
            let finalV0, finalV1, finalV2;
            if (!this.polygonWindingClockwise) {
                // Input is counterclockwise, reverse triangle winding to match fan triangulation
                finalV0 = this.cloneVec3(firstVertex.vertex);
                finalV1 = this.cloneVec3(workingVertices[i + 1].vertex);
                finalV2 = this.cloneVec3(workingVertices[i].vertex);
            } else {
                // Input is clockwise, keep original order to match fan triangulation
                finalV0 = this.cloneVec3(firstVertex.vertex);
                finalV1 = this.cloneVec3(workingVertices[i].vertex);
                finalV2 = this.cloneVec3(workingVertices[i + 1].vertex);
            }

            const triangle = {
                v0: finalV0,
                v1: finalV1,
                v2: finalV2,
                color: this.cloneVec3(this.color),
                fillAlpha: this.fillAlpha,
                outlineColor: this.cloneVec3(this.outlineColor),
                outlineThickness: this.outlineThickness,
                name: `${this.name}_fallback_${startIndex + i - 1}`,
                ...this.classifyEarEdges(firstVertex.originalIndex, workingVertices[i].originalIndex, workingVertices[i + 1].originalIndex)
            };

            this.triangles.push(triangle);
        }
    }

    /**
     * Check if a vertex forms a valid ear
     */
    isEar(prev, curr, next, allVertices) {
        // Check if the angle at curr is convex
        if (!this.isConvex(prev.vertex, curr.vertex, next.vertex)) {
            return false;
        }

        // Check triangle area - skip degenerate triangles
        const area = Math.abs(
            (prev.vertex.x * (curr.vertex.z - next.vertex.z) +
             curr.vertex.x * (next.vertex.z - prev.vertex.z) +
             next.vertex.x * (prev.vertex.z - curr.vertex.z)) / 2
        );

        if (area < 1e-10) {
            return false; // Skip degenerate triangle
        }

        // Check if any other vertex lies inside the triangle
        let pointsInside = 0;
        for (const other of allVertices) {
            if (other === prev || other === curr || other === next) {
                continue;
            }

            if (this.pointInTriangle(other.vertex, prev.vertex, curr.vertex, next.vertex)) {
                pointsInside++;
            }
        }

        return pointsInside === 0;
    }

    /**
     * Check if vertex B forms a convex angle in triangle ABC
     * Works with both clockwise and counter-clockwise winding
     */
    isConvex(a, b, c) {
        // Calculate cross product in 2D (using x,z coordinates)
        const cross = (c.x - b.x) * (a.z - b.z) - (c.z - b.z) * (a.x - b.x);

        // Determine polygon winding by checking the first few vertices
        if (this.polygonWindingClockwise === undefined) {
            this.determinePolygonWinding();
        }

        // For clockwise polygons: cross < 0 means convex
        // For counter-clockwise polygons: cross > 0 means convex
        const isConvex = this.polygonWindingClockwise ? cross < 0 : cross > 0;

        return isConvex;
    }

    /**
     * Determine if the polygon has clockwise or counter-clockwise winding
     */
    determinePolygonWinding() {
        if (this.vertices.length < 3) {
            this.polygonWindingClockwise = true; // Default
            return;
        }

        // Calculate signed area using shoelace formula
        let signedArea = 0;
        const n = this.vertices.length;

        for (let i = 0; i < n; i++) {
            const curr = this.vertices[i];
            const next = this.vertices[(i + 1) % n];
            signedArea += (next.x - curr.x) * (next.z + curr.z);
        }

        this.polygonWindingClockwise = signedArea > 0;
    }

    /**
     * Check if point P is inside triangle ABC
     */
    pointInTriangle(p, a, b, c) {
        // Use barycentric coordinates
        const v0x = c.x - a.x;
        const v0z = c.z - a.z;
        const v1x = b.x - a.x;
        const v1z = b.z - a.z;
        const v2x = p.x - a.x;
        const v2z = p.z - a.z;

        const dot00 = v0x * v0x + v0z * v0z;
        const dot01 = v0x * v1x + v0z * v1z;
        const dot02 = v0x * v2x + v0z * v2z;
        const dot11 = v1x * v1x + v1z * v1z;
        const dot12 = v1x * v2x + v1z * v2z;

        const denom = dot00 * dot11 - dot01 * dot01;
        if (Math.abs(denom) < 1e-10) return false; // Degenerate triangle

        const invDenom = 1 / denom;
        const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
        const v = (dot00 * dot12 - dot01 * dot02) * invDenom;

        return (u >= 0) && (v >= 0) && (u + v < 1);
    }

    /**
     * Build set of exterior edges using simple adjacent-vertex matching
     */
    buildExteriorEdgeSet() {
        const exteriorEdges = new Set();
        const vertexCount = this.vertices.length;

        // Add edges between consecutive vertices (including wrap-around)
        for (let i = 0; i < vertexCount; i++) {
            const nextIndex = (i + 1) % vertexCount;
            const edgeKey = this.createEdgeKey(i, nextIndex);
            exteriorEdges.add(edgeKey);
        }

        return exteriorEdges;
    }

    /**
     * Create normalized edge key for consistent lookup
     */
    createEdgeKey(idx1, idx2) {
        // Always put smaller index first for consistent keys
        const [a, b] = idx1 < idx2 ? [idx1, idx2] : [idx2, idx1];
        return `${a}-${b}`;
    }

    /**
     * Simple edge visibility: only edges between adjacent polygon vertices are visible
     */
    classifyEarEdges(idx0, idx1, idx2) {
        if (!this.exteriorEdges) {
            this.exteriorEdges = this.buildExteriorEdgeSet();
        }

        // Check if each triangle edge matches an exterior (adjacent-vertex) edge
        const edge01Key = this.createEdgeKey(idx0, idx1);
        const edge12Key = this.createEdgeKey(idx1, idx2);
        const edge20Key = this.createEdgeKey(idx2, idx0);

        const edge01Visible = this.exteriorEdges.has(edge01Key);
        const edge12Visible = this.exteriorEdges.has(edge12Key);
        const edge20Visible = this.exteriorEdges.has(edge20Key);

        return {
            edge01Visible,
            edge12Visible,
            edge20Visible
        };
    }

    /**
     * Mark polygon as dirty with specific change types
     */
    markDirty(changeType) {
        if (!this.isDirty) {
            this.isDirty = true;
            this.dirtyChangeTypes.clear();
        }
        this.dirtyChangeTypes.add(changeType);

        // Notify manager about dirty polygon
        if (this.manager && this.manager.markPolygonDirty) {
            this.manager.markPolygonDirty(this, changeType);
        }
    }

    /**
     * Clear dirty state (called after processing)
     */
    clearDirty() {
        this.isDirty = false;
        this.dirtyChangeTypes.clear();
    }

    /**
     * Check if polygon has specific change type
     */
    hasChangeType(changeType) {
        return this.dirtyChangeTypes.has(changeType);
    }

    /**
     * Set manager reference for dirty notifications
     */
    setManager(manager) {
        this.manager = manager;
    }

    /**
     * Update polygon properties with intelligent dirty tracking
     */
    updateProperties(data, manager) {
        const changeTypes = new Set();

        // Track geometry changes
        if (data.vertices) {
            this.vertices = data.vertices.map(v => this.cloneVec3(v));
            this.originalVertices = this.vertices.map(v => this.cloneVec3(v)); // Update original vertices too
            changeTypes.add(ChangeType.GEOMETRY);
        }

        // Track border-affecting changes
        if (data.outlineThickness !== undefined && data.outlineThickness !== this.outlineThickness) {
            this.outlineThickness = data.outlineThickness;
            changeTypes.add(ChangeType.GEOMETRY); // Treat as geometry change since shrunk vertices depend on thickness
        }

        // Track visual changes
        if (data.color && (data.color.x !== this.color.x || data.color.y !== this.color.y || data.color.z !== this.color.z)) {
            this.color = this.cloneVec3(data.color);
            changeTypes.add(ChangeType.VISUAL);
        }
        if (data.fillAlpha !== undefined && data.fillAlpha !== this.fillAlpha) {
            this.fillAlpha = data.fillAlpha;
            changeTypes.add(ChangeType.VISUAL);
        }
        if (data.outlineColor && (data.outlineColor.x !== this.outlineColor.x || data.outlineColor.y !== this.outlineColor.y || data.outlineColor.z !== this.outlineColor.z)) {
            this.outlineColor = this.cloneVec3(data.outlineColor);
            changeTypes.add(ChangeType.VISUAL);
        }

        // Track visibility changes
        if (data.visible !== undefined && data.visible !== this.visible) {
            this.visible = data.visible;
            changeTypes.add(ChangeType.VISIBILITY);
        }

        // Track name changes (rarely affects rendering)
        if (data.name && data.name !== this.name) {
            this.name = data.name;
        }

        // Mark dirty with appropriate change types
        changeTypes.forEach(changeType => this.markDirty(changeType));

        // Set manager reference if provided
        if (manager) {
            this.setManager(manager);
        }
    }

    /**
     * Process dirty changes and update rendering data as needed
     * Handles multiple change types correctly by processing in order of computational cost
     * Returns true if render data was updated
     */
    processDirtyChanges() {
        if (!this.isDirty) {
            return false;
        }

        let renderDataUpdated = false;

        // Process changes in order of computational cost (most expensive operations encompass cheaper ones)
        // If multiple change types are present, we only need to do the most expensive operation

        if (this.hasChangeType(ChangeType.GEOMETRY)) {
            // Geometry changes require polygon shrinking + full retriangulation + border recalculation + render data update
            this.shrinkPolygon();
            this.triangulate();
            this.generateBorderTriangles();
            this.calculateRenderingData();
            renderDataUpdated = true;
        }
        else if (this.hasChangeType(ChangeType.VISUAL)) {
            // Visual changes only require render data update (colors, alpha)
            this.calculateRenderingData();
            renderDataUpdated = true;
        }
        else if (this.hasChangeType(ChangeType.VISIBILITY)) {
            // Visibility changes don't require data recalculation, just render list update
            renderDataUpdated = true;
        }

        this.clearDirty();
        return renderDataUpdated;
    }

    /**
     * Select this polygon (doubles outline thickness, applies white border and semi-transparent white fill)
     */
    select(manager) {
        if (!this.selected) {
            this.selected = true;

            // Set manager reference
            if (manager) {
                this.setManager(manager);
            }

            // Apply selection visual properties using updateProperties for proper dirty tracking
            this.updateProperties({
                outlineThickness: this.baseOutlineThickness * 2.0, // Double the thickness
                outlineColor: {x: 1, y: 1, z: 1}, // White border
                color: {x: 1, y: 1, z: 1}, // White fill
                fillAlpha: 0.1 // Semi-transparent fill (0.1 alpha)
            }, manager);
        }
    }

    /**
     * Deselect this polygon (restores all original visual properties)
     */
    deselect(manager) {
        if (this.selected) {
            this.selected = false;

            // Set manager reference
            if (manager) {
                this.setManager(manager);
            }

            // Restore all original visual properties using updateProperties for proper dirty tracking
            this.updateProperties({
                outlineThickness: this.baseOutlineThickness,
                outlineColor: this.cloneVec3(this.baseOutlineColor),
                color: this.cloneVec3(this.baseFillColor),
                fillAlpha: this.baseFillAlpha
            }, manager);
        }
    }

    /**
     * Toggle selection state
     */
    toggleSelection(manager) {
        if (this.selected) {
            this.deselect(manager);
        } else {
            this.select(manager);
        }
    }

    /**
     * Get all triangles for rendering
     */
    getTriangles() {
        return this.triangles;
    }

    /**
     * Get cached triangle count for performance
     */
    getTriangleCount() {
        return this.cachedTriangleCount;
    }

    /**
     * Generate border triangles using original and shrunk polygon vertices
     * Creates seamless border quads (2 triangles each) between the original and inset edges
     * This prevents gaps and overlaps with the fill triangulation
     */
    generateBorderTriangles() {
        this.borderTriangles = [];

        if (this.originalVertices.length < 3 || this.outlineThickness <= 0) {
            return; // No border for invalid polygons or zero thickness
        }

        // Use shrunk vertices if available and valid, otherwise fall back to simple inward offset
        let innerVertices;
        if (this.shrunkVertices && this.shrunkVertices.length >= 3 && this.shrunkPolygonValid) {
            innerVertices = this.shrunkVertices;
        } else {
            // Fallback: create simple inward offset vertices
            innerVertices = this.createSimpleInwardOffset();
        }

        if (innerVertices.length !== this.originalVertices.length) {
            console.warn(`⚠️ Vertex count mismatch in polygon "${this.name}" - cannot generate seamless borders`);
            return;
        }

        // Convert outline color to RGBA format (borders are always opaque)
        const borderColor = {
            r: this.outlineColor.x !== undefined ? this.outlineColor.x : (this.outlineColor.r !== undefined ? this.outlineColor.r : 1),
            g: this.outlineColor.y !== undefined ? this.outlineColor.y : (this.outlineColor.g !== undefined ? this.outlineColor.g : 1),
            b: this.outlineColor.z !== undefined ? this.outlineColor.z : (this.outlineColor.b !== undefined ? this.outlineColor.b : 1),
            a: 1.0 // Borders are always opaque
        };

        const numVertices = this.originalVertices.length;

        // Generate border quad for each edge using original and inner vertices
        for (let i = 0; i < numVertices; i++) {
            const outerCurrent = this.originalVertices[i];
            const outerNext = this.originalVertices[(i + 1) % numVertices];
            const innerCurrent = innerVertices[i];
            const innerNext = innerVertices[(i + 1) % numVertices];

            // Create border quad using corresponding vertices from both polygons
            // This ensures perfect alignment and no gaps
            let tri1Vertices, tri2Vertices;

            // Determine triangle winding based on polygon orientation
            if (this.polygonWindingClockwise === undefined) {
                this.determinePolygonWinding();
            }

            if (this.polygonWindingClockwise) {
                // Clockwise winding: maintain order for upward-facing triangles
                tri1Vertices = [
                    [innerCurrent.x, innerCurrent.y || 0, innerCurrent.z],
                    [outerCurrent.x, outerCurrent.y || 0, outerCurrent.z],
                    [innerNext.x, innerNext.y || 0, innerNext.z]
                ];
                tri2Vertices = [
                    [innerNext.x, innerNext.y || 0, innerNext.z],
                    [outerCurrent.x, outerCurrent.y || 0, outerCurrent.z],
                    [outerNext.x, outerNext.y || 0, outerNext.z]
                ];
            } else {
                // Counterclockwise winding: reverse for upward-facing triangles
                tri1Vertices = [
                    [innerCurrent.x, innerCurrent.y || 0, innerCurrent.z],
                    [innerNext.x, innerNext.y || 0, innerNext.z],
                    [outerCurrent.x, outerCurrent.y || 0, outerCurrent.z]
                ];
                tri2Vertices = [
                    [innerNext.x, innerNext.y || 0, innerNext.z],
                    [outerNext.x, outerNext.y || 0, outerNext.z],
                    [outerCurrent.x, outerCurrent.y || 0, outerCurrent.z]
                ];
            }

            const borderTriangle1 = new RenderTriangleData(tri1Vertices, borderColor);
            const borderTriangle2 = new RenderTriangleData(tri2Vertices, borderColor);

            this.borderTriangles.push(borderTriangle1, borderTriangle2);
        }
    }

    /**
     * Create simple inward offset vertices as fallback when shrinking fails
     */
    createSimpleInwardOffset() {
        const centroid = this.calculateCentroid();
        const scaleFactor = Math.max(0.75, 1 - (this.outlineThickness / Math.sqrt(this.calculateArea())));

        return this.originalVertices.map(vertex => ({
            x: centroid.x + (vertex.x - centroid.x) * scaleFactor,
            y: vertex.y || 0,
            z: centroid.z + (vertex.z - centroid.z) * scaleFactor
        }));
    }

    /**
     * Calculate rendering data from triangulated polygon
     * Converts internal triangles to renderer format with vertices as [x,y,z] arrays and polygon fill color
     */
    calculateRenderingData() {
        this.renderTriangles = [];

        // Convert polygon fill color to RGBA format including fillAlpha
        const polygonColor = {
            r: this.color.x || this.color.r || 0,
            g: this.color.y || this.color.g || 0,
            b: this.color.z || this.color.b || 0,
            a: this.fillAlpha
        };

        // Add fill triangles from triangulation
        for (const triangle of this.triangles) {
            const renderTriangle = new RenderTriangleData(
                [
                    [triangle.v0.x, triangle.v0.y, triangle.v0.z],
                    [triangle.v1.x, triangle.v1.y, triangle.v1.z],
                    [triangle.v2.x, triangle.v2.y, triangle.v2.z]
                ],
                polygonColor
            );
            this.renderTriangles.push(renderTriangle);
        }

        // Add border triangles (already in RenderTriangleData format)
        for (const borderTriangle of this.borderTriangles) {
            this.renderTriangles.push(borderTriangle);
        }
    }

    /**
     * Get rendering triangles (format for renderer)
     */
    getRenderTriangles() {
        return this.renderTriangles;
    }
}

/**
 * Polygon Manager - Manages a collection of polygons with utility functions
 */
class PolygonManager {
    constructor() {
        this.polygons = [];
        this.onPolygonUpdated = null; // Callback for when polygons are updated

        // Dirty polygon tracking
        this.dirtyPolygons = new Map(); // Map of polygon -> DirtyPolygonEntry
        this.renderDataDirty = false; // Flag to indicate render data needs updating

        // Renderer callback for automatic updates
        this.autoRendererCallback = null;
    }

    /**
     * Set up automatic renderer callback for immediate visual updates
     * This should be called by the SuperSplatBridge or other renderer integrations
     */
    setAutoRendererCallback(callback) {
        this.autoRendererCallback = callback;
    }

    /**
     * Trigger automatic renderer update if callback is set
     */
    triggerAutoRendererUpdate() {
        if (this.autoRendererCallback) {
            this.sendToRenderer(this.autoRendererCallback);
        }
    }

    /**
     * Add a polygon to the manager
     */
    addPolygon(vertices, color = {x: 0, y: 1, z: 0}, fillAlpha = 1.0, outlineColor = {x: 1, y: 1, z: 1}, outlineThickness = 0.1, name, group) {
        const polygon = new Polygon({
            vertices,
            color,
            fillAlpha,
            outlineColor,
            outlineThickness,
            name,
            group
        });

        // Set manager reference for dirty tracking
        polygon.setManager(this);

        this.polygons.push(polygon);
        return polygon;
    }

    /**
     * Mark a polygon as dirty (called by polygon instances)
     */
    markPolygonDirty(polygon, changeType) {
        if (this.dirtyPolygons.has(polygon)) {
            // Add change type to existing dirty entry
            this.dirtyPolygons.get(polygon).addChangeType(changeType);
        } else {
            // Create new dirty entry
            this.dirtyPolygons.set(polygon, new DirtyPolygonEntry(polygon, [changeType]));
        }
        this.renderDataDirty = true;
    }

    /**
     * Process all dirty polygons and update their render data
     * Returns the number of polygons that were processed
     */
    processDirtyPolygons() {
        if (!this.renderDataDirty || this.dirtyPolygons.size === 0) {
            return 0;
        }

        let processedCount = 0;
        const geometryPolygons = [];
        const visualPolygons = [];
        const visibilityPolygons = [];

        // Categorize dirty polygons by change type for batch processing
        for (const [polygon, entry] of this.dirtyPolygons.entries()) {
            if (entry.hasChangeType(ChangeType.GEOMETRY)) {
                geometryPolygons.push(polygon);
            } else if (entry.hasChangeType(ChangeType.VISUAL)) {
                visualPolygons.push(polygon);
            } else if (entry.hasChangeType(ChangeType.VISIBILITY)) {
                visibilityPolygons.push(polygon);
            }
        }

        // Process polygons in order of computational cost (most expensive first)
        // This ensures we don't do redundant work if a polygon has multiple change types

        // Process geometry changes (most expensive)
        geometryPolygons.forEach(polygon => {
            if (polygon.processDirtyChanges()) {
                processedCount++;
            }
        });


        // Process visual changes
        visualPolygons.forEach(polygon => {
            if (polygon.processDirtyChanges()) {
                processedCount++;
            }
        });

        // Process visibility changes
        visibilityPolygons.forEach(polygon => {
            if (polygon.processDirtyChanges()) {
                processedCount++;
            }
        });

        // Clear dirty polygon list
        this.dirtyPolygons.clear();
        this.renderDataDirty = false;

        return processedCount;
    }

    /**
     * Check if there are any dirty polygons that need processing
     */
    hasDirtyPolygons() {
        return this.renderDataDirty && this.dirtyPolygons.size > 0;
    }

    /**
     * Get count of dirty polygons
     */
    getDirtyPolygonCount() {
        return this.dirtyPolygons.size;
    }

    /**
     * Get statistics about dirty polygon change types
     */
    getDirtyPolygonStats() {
        const stats = {
            total: this.dirtyPolygons.size,
            geometry: 0,
            visual: 0,
            visibility: 0
        };

        for (const entry of this.dirtyPolygons.values()) {
            if (entry.hasChangeType(ChangeType.GEOMETRY)) stats.geometry++;
            if (entry.hasChangeType(ChangeType.VISUAL)) stats.visual++;
            if (entry.hasChangeType(ChangeType.VISIBILITY)) stats.visibility++;
        }

        return stats;
    }

    /**
     * Remove all polygons
     */
    clearPolygons() {
        this.polygons = [];
    }

    /**
     * Sort polygons by area (smallest first) for nested click detection priority
     */
    sortPolygonsByArea() {
        this.polygons.sort((a, b) => a.area - b.area);
    }

    /**
     * Find polygon by name
     */
    findPolygon(name) {
        return this.polygons.find(p => p.name === name);
    }

    /**
     * Set visibility for all polygons in a group
     */
    setGroupVisibility(groupName, visible) {
        let affectedCount = 0;
        this.polygons.forEach(polygon => {
            if (polygon.group === groupName) {
                // If hiding the group, also deselect any selected polygons in this group
                if (!visible && polygon.selected) {
                    polygon.deselect(this);
                }
                polygon.updateProperties({ visible }, this);
                affectedCount++;
            }
        });
        return affectedCount;
    }

    /**
     * Get all available groups
     */
    getGroups() {
        const groups = new Set();
        this.polygons.forEach(polygon => {
            if (polygon.group) {
                groups.add(polygon.group);
            }
        });
        return Array.from(groups).sort();
    }

    /**
     * Get visibility status of a group
     */
    isGroupVisible(groupName) {
        const groupPolygons = this.polygons.filter(p => p.group === groupName);
        if (groupPolygons.length === 0) return false;
        // Group is visible if any polygon in the group is visible
        return groupPolygons.some(p => p.visible);
    }

    /**
     * Get all triangles from visible polygons (internal format)
     */
    getAllTriangles() {
        const allTriangles = [];
        for (const polygon of this.polygons) {
            if (polygon.visible) {
                allTriangles.push(...polygon.getTriangles());
            }
        }
        return allTriangles;
    }

    /**
     * Get all rendering triangles from visible polygons (format for renderer)
     */
    getAllRenderTriangles() {
        const allRenderTriangles = [];
        for (const polygon of this.polygons) {
            if (polygon.visible) {
                allRenderTriangles.push(...polygon.getRenderTriangles());
            }
        }
        return allRenderTriangles;
    }

    /**
     * Get total visible triangle count
     */
    getVisibleTriangleCount() {
        let count = 0;
        for (const polygon of this.polygons) {
            if (polygon.visible) {
                count += polygon.getTriangleCount();
            }
        }
        return count;
    }

    /**
     * Convert HSL color to RGB for triangle coloring
     */
    hslToRgb(h, s, l) {
        h = h / 360; // Normalize to [0, 1]

        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs((h * 6) % 2 - 1));
        const m = l - c / 2;

        let r = 0, g = 0, b = 0;

        if (0 <= h && h < 1/6) {
            r = c; g = x; b = 0;
        } else if (1/6 <= h && h < 2/6) {
            r = x; g = c; b = 0;
        } else if (2/6 <= h && h < 3/6) {
            r = 0; g = c; b = x;
        } else if (3/6 <= h && h < 4/6) {
            r = 0; g = x; b = c;
        } else if (4/6 <= h && h < 5/6) {
            r = x; g = 0; b = c;
        } else if (5/6 <= h && h < 1) {
            r = c; g = 0; b = x;
        }

        return {
            r: r + m,
            g: g + m,
            b: b + m
        };
    }

    /**
     * Find which polygon (if any) contains the given world point
     * Uses point-in-polygon algorithm for 2D polygons projected onto Y-plane
     */
    findPolygonAtWorldPoint(worldPoint) {
        // Only check visible polygons - they maintain smallest-first order
        const visiblePolygons = this.polygons.filter(polygon => polygon.visible);

        if (visiblePolygons.length === 0) {
            return null;
        }

        for (const polygon of visiblePolygons) {
            if (this.isPointInPolygon(worldPoint, polygon)) {
                return polygon;
            }
        }

        return null;
    }

    /**
     * Point-in-polygon test using ray casting algorithm
     * Tests if a 3D world point is inside a polygon when projected to the Y-plane
     */
    isPointInPolygon(worldPoint, polygon) {
        const vertices = polygon.vertices;
        const testX = worldPoint.x;
        const testZ = worldPoint.z;

        let isInside = false;
        let j = vertices.length - 1;

        for (let i = 0; i < vertices.length; i++) {
            const xi = vertices[i].x;
            const zi = vertices[i].z;
            const xj = vertices[j].x;
            const zj = vertices[j].z;

            // Check if ray crosses this edge
            if (((zi > testZ) !== (zj > testZ)) &&
                (testX < (xj - xi) * (testZ - zi) / (zj - zi) + xi)) {
                isInside = !isInside;
            }
            j = i;
        }

        return isInside;
    }

    /**
     * Handle polygon click at world point - find clicked polygon and trigger selection
     * Called by point-overlay.ts after screen-to-world coordinate conversion
     */
    handlePolygonClickAtWorldPoint(worldPoint, screenData) {
        try {
            // Find which polygon was clicked
            const clickedPolygon = this.findPolygonAtWorldPoint(worldPoint);

            if (clickedPolygon) {
                // Select the polygon (this will deselect others and select this one)
                this.selectPolygon(clickedPolygon.name);

                // Fire polygon.clicked event for superSplatBridge.js integration
                // This maintains compatibility with the existing bridge system
                if (window.superSplatScene && window.superSplatScene.events) {
                    window.superSplatScene.events.fire('polygon.clicked', {
                        polygonName: clickedPolygon.name,
                        polygonGroup: clickedPolygon.group,
                        worldPosition: {
                            x: worldPoint.x,
                            y: worldPoint.y,
                            z: worldPoint.z
                        },
                        screenPosition: {
                            x: screenData.screenX,
                            y: screenData.screenY
                        }
                    });
                } else {
                    console.warn('⚠️ SuperSplat scene not available for polygon.clicked event');
                }

                return clickedPolygon;
            } else {
                return null;
            }
        } catch (error) {
            console.error('❌ Error in handlePolygonClickAtWorldPoint:', error);
            return null;
        }
    }

    /**
     * Send all visible polygons' rendering data to the renderer
     * Processes dirty polygons first, then aggregates all triangles into a single array for efficient mesh rendering
     */
    sendToRenderer(rendererCallback) {
        if (!rendererCallback) {
            console.warn('⚠️ No renderer callback provided to sendToRenderer');
            return;
        }

        // Process dirty polygons before rendering
        this.processDirtyPolygons();

        const renderTriangles = this.getAllRenderTriangles();

        if (renderTriangles.length === 0) {
            rendererCallback([]);
            return;
        }

        rendererCallback(renderTriangles);
    }

    /**
     * Update renderer with current polygon data
     * Convenience method for when polygon visibility or properties change
     */
    updateRenderer(rendererCallback) {
        this.sendToRenderer(rendererCallback);
    }

    /**
     * Select a polygon by name (deselects all other polygons first)
     */
    selectPolygon(name) {
        // First deselect all polygons
        this.polygons.forEach(polygon => {
            if (polygon.selected) {
                polygon.deselect(this);
            }
        });

        // Then select the specified polygon
        const polygon = this.findPolygon(name);
        if (polygon) {
            polygon.select(this);
            this.triggerAutoRendererUpdate();
            return true;
        } else {
            console.warn(`⚠️ Polygon "${name}" not found for selection`);
            return false;
        }
    }

    /**
     * Select multiple polygons without deselecting others (for multi-polygon areas)
     */
    selectPolygons(polygonNames) {
        let selectedCount = 0;

        polygonNames.forEach(name => {
            const polygon = this.findPolygon(name);
            if (polygon) {
                if (!polygon.selected) {
                    polygon.select(this);
                    selectedCount++;
                }
            } else {
                console.warn(`⚠️ Polygon "${name}" not found for multi-selection`);
            }
        });

        return selectedCount;
    }

    /**
     * Clear all selections and then select multiple polygons (for area selection)
     * Automatically sends updated data to renderer after selection changes
     */
    selectPolygonArea(polygonNames) {
        // First deselect all polygons
        this.polygons.forEach(polygon => {
            if (polygon.selected) {
                polygon.deselect(this);
            }
        });

        // Then select all polygons in the area
        const selectedCount = this.selectPolygons(polygonNames);

        // Automatically update renderer with dirty polygon changes
        // This ensures the visual changes are applied immediately
        this.triggerAutoRendererUpdate();

        return selectedCount;
    }

    /**
     * Select multiple polygons with specific environmental metric colors
     */
    selectEnvironmentalMetricPolygons(polygonNames, colorType) {
        let selectedCount = 0;

        // Parse color type - support both named colors and hex colors
        let colorSet;

        if (colorType.startsWith('#')) {
            // Parse hex color
            const hex = colorType.substring(1);
            const r = parseInt(hex.substring(0, 2), 16) / 255;
            const g = parseInt(hex.substring(2, 4), 16) / 255;
            const b = parseInt(hex.substring(4, 6), 16) / 255;
            colorSet = {
                border: {x: r, y: g, z: b},
                fill: {x: r, y: g, z: b}
            };
        } else {
            // Use predefined named colors for backward compatibility
            const colors = {
                purple: { border: {x: 0.6, y: 0.2, z: 0.8}, fill: {x: 0.6, y: 0.2, z: 0.8} },
                yellow: { border: {x: 1.0, y: 0.9, z: 0.0}, fill: {x: 1.0, y: 0.9, z: 0.0} }
            };

            colorSet = colors[colorType];
            if (!colorSet) {
                console.warn(`⚠️ Unknown environmental metric color type: ${colorType}`);
                return 0;
            }
        }

        polygonNames.forEach(name => {
            const polygon = this.findPolygon(name);
            if (polygon) {
                if (!polygon.selected) {
                    // Apply environmental metric selection properties
                    polygon.selected = true;

                    // Use updateProperties method to properly apply changes and re-triangulate
                    polygon.updateProperties({
                        outlineThickness: polygon.baseOutlineThickness, // Use default thickness (not doubled)
                        outlineColor: colorSet.border, // Colored border
                        color: colorSet.fill, // Colored fill
                        fillAlpha: 0.5 // Semi-transparent fill (0.5 alpha as requested)
                    }, this);

                    selectedCount++;
                }
            } else {
                console.warn(`⚠️ Polygon "${name}" not found for environmental metric styling`);
            }
        });

        // Trigger automatic renderer update
        if (selectedCount > 0) {
            this.triggerAutoRendererUpdate();
        }

        return selectedCount;
    }

    /**
     * Deselect a polygon by name
     */
    deselectPolygon(name) {
        const polygon = this.findPolygon(name);
        if (polygon) {
            polygon.deselect(this);
            this.triggerAutoRendererUpdate();
            return true;
        } else {
            console.warn(`⚠️ Polygon "${name}" not found for deselection`);
            return false;
        }
    }

    /**
     * Deselect all polygons
     */
    deselectAllPolygons() {
        let deselectedCount = 0;
        this.polygons.forEach(polygon => {
            if (polygon.selected) {
                polygon.deselect(this);
                deselectedCount++;
            }
        });

        // Trigger automatic renderer update if any polygons were deselected
        if (deselectedCount > 0) {
            this.triggerAutoRendererUpdate();
        }

        return deselectedCount;
    }

    /**
     * Get the currently selected polygon (if any)
     */
    getSelectedPolygon() {
        const selected = this.polygons.find(p => p.selected);
        return selected ? selected.name || null : null;
    }

    /**
     * Set polygon visibility by name
     */
    setPolygonVisibility(name, visible) {
        const polygon = this.findPolygon(name);
        if (polygon) {
            polygon.updateProperties({ visible }, this);
        } else {
            console.warn(`⚠️ Polygon "${name}" not found for visibility change`);
        }
    }

    /**
     * Set visibility for all polygons
     */
    setAllPolygonsVisibility(visible) {
        this.polygons.forEach(polygon => {
            polygon.updateProperties({ visible }, this);
        });
    }

    /**
     * Update polygon properties by name
     */
    updatePolygon(name, updates) {
        const polygon = this.findPolygon(name);
        if (polygon) {
            polygon.updateProperties(updates, this);
        } else {
            console.warn(`⚠️ Polygon "${name}" not found for update`);
        }
    }

    /**
     * Force processing of dirty polygons (useful for debugging or manual optimization)
     * Returns detailed information about what was processed
     */
    forceDirtyProcessing() {
        if (!this.hasDirtyPolygons()) {
            return { processed: 0, message: 'No dirty polygons to process' };
        }

        const stats = this.getDirtyPolygonStats();
        const processedCount = this.processDirtyPolygons();

        return {
            processed: processedCount,
            stats: stats,
            message: `Processed ${processedCount} dirty polygons: ${stats.geometry} geometry, ${stats.border} border, ${stats.visual} visual, ${stats.visibility} visibility changes`
        };
    }

    /**
     * Get comprehensive status of the polygon manager including dirty polygon information
     */
    getStatus() {
        return {
            totalPolygons: this.polygons.length,
            visiblePolygons: this.polygons.filter(p => p.visible).length,
            selectedPolygons: this.polygons.filter(p => p.selected).length,
            dirtyPolygons: this.getDirtyPolygonCount(),
            dirtyStats: this.getDirtyPolygonStats(),
            renderDataDirty: this.renderDataDirty
        };
    }
}

// Export classes for use in other files
if (typeof window !== 'undefined') {
    window.ChangeType = ChangeType;
    window.DirtyPolygonEntry = DirtyPolygonEntry;
    window.TriangleData = TriangleData;
    window.RenderTriangleData = RenderTriangleData;
    window.PolygonData = PolygonData;
    window.Polygon = Polygon;
    window.PolygonManager = PolygonManager;
}

// Also support module exports if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ChangeType,
        DirtyPolygonEntry,
        TriangleData,
        RenderTriangleData,
        PolygonData,
        Polygon,
        PolygonManager
    };
}