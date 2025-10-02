import {
    BLENDMODE_ONE,
    BLENDMODE_ONE_MINUS_SRC_ALPHA,
    BLENDMODE_SRC_ALPHA,
    BLENDEQUATION_ADD,
    CULLFACE_NONE,
    FUNC_LESSEQUAL,
    SEMANTIC_POSITION,
    createShaderFromCode,
    BlendState,
    DepthState,
    Layer,
    QuadRender,
    Shader,
    Vec3
} from 'playcanvas';

import { Element, ElementType } from './element';
import { Serializer } from './serializer';
import { vertexShader, fragmentShader } from './shaders/point-overlay-shader';

interface TriangleData {
    v0: Vec3;
    v1: Vec3;
    v2: Vec3;
    color: Vec3;
    fillAlpha: number;
    outlineColor: Vec3;
    outlineThickness: number;
    name?: string;
    // Edge visibility flags - true means edge should show outline
    edge01Visible?: boolean; // Edge from v0 to v1
    edge12Visible?: boolean; // Edge from v1 to v2
    edge20Visible?: boolean; // Edge from v2 to v0
}

interface PolygonData {
    vertices: Vec3[];
    color: Vec3;
    fillAlpha: number;
    outlineColor: Vec3;
    outlineThickness: number;
    name?: string;
    visible?: boolean;
    group?: string; // Group name for PA/NPA grouping
}

class Polygon {
    vertices: Vec3[];
    color: Vec3;
    fillAlpha: number;
    outlineColor: Vec3;
    outlineThickness: number;
    name?: string;
    visible: boolean;
    selected: boolean;
    baseOutlineThickness: number; // Store original thickness for selection changes
    baseFillColor: Vec3; // Store original fill color for selection changes
    baseFillAlpha: number; // Store original fill alpha for selection changes
    group?: string; // Group name for PA/NPA grouping
    triangles: TriangleData[] = [];
    private exteriorEdges?: Set<string>;

    constructor(data: PolygonData) {
        this.vertices = data.vertices.map(v => v.clone());
        this.color = data.color.clone();
        this.fillAlpha = data.fillAlpha;
        this.outlineColor = data.outlineColor.clone();
        this.outlineThickness = data.outlineThickness;
        this.baseOutlineThickness = data.outlineThickness; // Store original thickness
        this.baseFillColor = data.color.clone(); // Store original fill color
        this.baseFillAlpha = data.fillAlpha; // Store original fill alpha
        this.name = data.name;
        this.visible = data.visible !== false; // Default to true
        this.selected = false; // Default to not selected
        this.group = data.group; // Store group information

        // Automatically triangulate the polygon
        this.triangulate();
    }

    /**
     * Triangulate the polygon into triangles using fan triangulation
     * Marks polygon perimeter edges as visible, internal edges as invisible
     */
    private triangulate() {
        this.triangles = [];
        this.exteriorEdges = undefined; // Reset exterior edge set for re-triangulation
        this.polygonWindingClockwise = undefined; // Reset winding determination

        if (this.vertices.length < 3) {
            console.warn(`⚠️ Polygon "${this.name}" has less than 3 vertices - cannot triangulate`);
            return;
        }

        if (this.vertices.length === 3) {
            // Already a triangle - all edges are perimeter edges
            this.triangles.push({
                v0: this.vertices[0].clone(),
                v1: this.vertices[1].clone(),
                v2: this.vertices[2].clone(),
                color: this.color.clone(),
                fillAlpha: this.fillAlpha,
                outlineColor: this.outlineColor.clone(),
                outlineThickness: this.outlineThickness,
                name: `${this.name}_tri_0`,
                edge01Visible: true, // v0 → v1 (perimeter edge)
                edge12Visible: true, // v1 → v2 (perimeter edge)
                edge20Visible: true  // v2 → v0 (perimeter edge)
            });
            return;
        }

        // Choose triangulation method based on polygon complexity
        if (this.vertices.length <= 6) {
            // Simple polygon: use fast fan triangulation
            this.triangulateWithFan();
        } else {
            // Complex polygon: use ear clipping for accurate triangulation
            this.triangulateWithEarClipping();
        }

        // Triangle coordinate logging removed to reduce console spam

    }

    /**
     * Fan triangulation (original method) - fast but only works for convex polygons
     */
    private triangulateWithFan() {
        const firstVertex = this.vertices[0];
        const numVertices = this.vertices.length;

        for (let i = 1; i < numVertices - 1; i++) {
            const v0 = firstVertex.clone();          // Fan center (first vertex)
            const v1 = this.vertices[i].clone();     // Current vertex
            const v2 = this.vertices[i + 1].clone(); // Next vertex

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
                v0,
                v1,
                v2,
                color: this.color.clone(),
                fillAlpha: this.fillAlpha,
                outlineColor: this.outlineColor.clone(),
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
    private triangulateWithEarClipping() {
        // Create working copy of vertices with indices
        const workingVertices = this.vertices.map((v, i) => ({
            vertex: v.clone(),
            originalIndex: i
        }));

        let triangleIndex = 0;
        let maxIterations = workingVertices.length * 3; // Prevent infinite loops
        let iterationCount = 0;

        // Starting ear clipping triangulation

        while (workingVertices.length > 3 && iterationCount < maxIterations) {
            let earFound = false;
            iterationCount++;

            // Verbose ear clipping logging removed to reduce console spam

            // Look for an ear (a convex vertex where the triangle contains no other vertices)
            for (let i = 0; i < workingVertices.length; i++) {
                const prevI = (i - 1 + workingVertices.length) % workingVertices.length;
                const nextI = (i + 1) % workingVertices.length;

                const prev = workingVertices[prevI];
                const curr = workingVertices[i];
                const next = workingVertices[nextI];

                const isConvex = this.isConvex(prev.vertex, curr.vertex, next.vertex);
                // Vertex testing logging removed to reduce console spam

                if (this.isEar(prev, curr, next, workingVertices)) {
                    // Found ear logging removed to reduce console spam
                    earFound = true;
                    // Found an ear! Create triangle and remove the ear vertex
                    const triangle = {
                        v0: prev.vertex.clone(),
                        v1: curr.vertex.clone(),
                        v2: next.vertex.clone(),
                        color: this.color.clone(),
                        fillAlpha: this.fillAlpha,
                        outlineColor: this.outlineColor.clone(),
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
            const triangle = {
                v0: workingVertices[0].vertex.clone(),
                v1: workingVertices[1].vertex.clone(),
                v2: workingVertices[2].vertex.clone(),
                color: this.color.clone(),
                fillAlpha: this.fillAlpha,
                outlineColor: this.outlineColor.clone(),
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
    private triangulateRemainingWithFan(workingVertices: any[], startIndex: number) {
        if (workingVertices.length < 3) return;

        const firstVertex = workingVertices[0];
        for (let i = 1; i < workingVertices.length - 1; i++) {
            const triangle = {
                v0: firstVertex.vertex.clone(),
                v1: workingVertices[i].vertex.clone(),
                v2: workingVertices[i + 1].vertex.clone(),
                color: this.color.clone(),
                fillAlpha: this.fillAlpha,
                outlineColor: this.outlineColor.clone(),
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
    private isEar(prev: any, curr: any, next: any, allVertices: any[]): boolean {
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
        // Use a slightly more tolerant check for complex polygons
        let pointsInside = 0;
        for (const other of allVertices) {
            if (other === prev || other === curr || other === next) {
                continue;
            }

            if (this.pointInTriangle(other.vertex, prev.vertex, curr.vertex, next.vertex)) {
                pointsInside++;
            }
        }

        // Allow ears with fewer interior points for complex polygons
        return pointsInside === 0;
    }

    /**
     * Check if vertex B forms a convex angle in triangle ABC
     * Works with both clockwise and counter-clockwise winding
     */
    private isConvex(a: Vec3, b: Vec3, c: Vec3): boolean {
        // Calculate cross product in 2D (using x,z coordinates)
        const cross = (c.x - b.x) * (a.z - b.z) - (c.z - b.z) * (a.x - b.x);

        // Determine polygon winding by checking the first few vertices
        // If we haven't determined winding yet, do it now
        if (this.polygonWindingClockwise === undefined) {
            this.determinePolygonWinding();
        }

        // For clockwise polygons: cross < 0 means convex
        // For counter-clockwise polygons: cross > 0 means convex
        const isConvex = this.polygonWindingClockwise ? cross < 0 : cross > 0;

        // isConvex logging removed to reduce console spam
        return isConvex;
    }

    private polygonWindingClockwise?: boolean;

    /**
     * Determine if the polygon has clockwise or counter-clockwise winding
     */
    private determinePolygonWinding(): void {
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
        // Polygon winding determined
    }

    /**
     * Check if point P is inside triangle ABC
     */
    private pointInTriangle(p: Vec3, a: Vec3, b: Vec3, c: Vec3): boolean {
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
     * Only edges between consecutive vertices in the original polygon should be visible
     */
    private buildExteriorEdgeSet(): Set<string> {
        const exteriorEdges = new Set<string>();
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
    private createEdgeKey(idx1: number, idx2: number): string {
        // Always put smaller index first for consistent keys
        const [a, b] = idx1 < idx2 ? [idx1, idx2] : [idx2, idx1];
        return `${a}-${b}`;
    }

    /**
     * Simple edge visibility: only edges between adjacent polygon vertices are visible
     */
    private classifyEarEdges(idx0: number, idx1: number, idx2: number): any {
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

        // Log first few triangles to verify logic
        // Edge visibility logging removed to reduce console spam

        return {
            edge01Visible,
            edge12Visible,
            edge20Visible
        };
    }


    /**
     * Update polygon properties and re-triangulate
     */
    updateProperties(data: Partial<PolygonData>) {
        if (data.vertices) this.vertices = data.vertices.map(v => v.clone());
        if (data.color) {
            this.color = data.color.clone();
            this.baseFillColor = data.color.clone(); // Update base fill color too
        }
        if (data.fillAlpha !== undefined) {
            this.fillAlpha = data.fillAlpha;
            this.baseFillAlpha = data.fillAlpha; // Update base fill alpha too
        }
        if (data.outlineColor) this.outlineColor = data.outlineColor.clone();
        if (data.outlineThickness !== undefined) {
            this.outlineThickness = data.outlineThickness;
            this.baseOutlineThickness = data.outlineThickness; // Update base thickness too
        }
        if (data.name) this.name = data.name;
        if (data.visible !== undefined) this.visible = data.visible;

        // Re-triangulate with new properties
        this.triangulate();
    }

    /**
     * Select this polygon (doubles outline thickness)
     */
    select() {
        if (!this.selected) {
            this.selected = true;
            this.outlineThickness = this.baseOutlineThickness * 2.0; // Double the thickness
            this.triangulate(); // Re-triangulate with new thickness
            console.log(`🔹 Polygon "${this.name}" SELECTED (thickness: ${this.baseOutlineThickness} → ${this.outlineThickness})`);
        }
    }

    /**
     * Deselect this polygon (restores original outline thickness)
     */
    deselect() {
        if (this.selected) {
            this.selected = false;
            this.outlineThickness = this.baseOutlineThickness; // Restore original thickness
            this.triangulate(); // Re-triangulate with original thickness
            console.log(`🔹 Polygon "${this.name}" DESELECTED (thickness: ${this.outlineThickness})`);
        }
    }

    /**
     * Toggle selection state
     */
    toggleSelection() {
        if (this.selected) {
            this.deselect();
        } else {
            this.select();
        }
    }

    /**
     * Get all triangles for rendering
     */
    getTriangles(): TriangleData[] {
        return this.triangles;
    }
}

class TriangleOverlay extends Element {
    shader: Shader;
    quadRender: QuadRender;
    blendState = new BlendState(false);
    depthState = new DepthState(FUNC_LESSEQUAL, true);

    visible = true;
    triangles: TriangleData[] = [];
    polygons: Polygon[] = [];
    yPlane: number = 3.2; // Default Y plane for all triangles

    constructor() {
        super(ElementType.debug);
    }

    add() {
        console.log('🔺 TriangleOverlay.add() called - setting up triangle rendering system');
        const device = this.scene.app.graphicsDevice;

        this.shader = createShaderFromCode(device, vertexShader, fragmentShader, 'triangle-overlay', {
            vertex_position: SEMANTIC_POSITION
        });

        this.quadRender = new QuadRender(this.shader);
        console.log('🎨 Triangle shader and QuadRender created successfully');

        const blendState = new BlendState(
            true,
            BLENDEQUATION_ADD, BLENDMODE_SRC_ALPHA, BLENDMODE_ONE_MINUS_SRC_ALPHA,
            BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE_MINUS_SRC_ALPHA
        );

        console.log('🔺 Registering triangle rendering event handler');
        this.scene.camera.entity.camera.on('preRenderLayer', (layer: Layer, transparent: boolean) => {
            // Combine triangles from direct triangles and polygons
            const allTriangles = this.getAllTriangles();

            const shouldRender = this.visible && layer === this.scene.debugLayer && !transparent &&
                this.scene.camera.renderOverlays && allTriangles.length > 0;

            if (shouldRender) {
                device.setBlendState(blendState);
                device.setCullMode(CULLFACE_NONE);
                device.setDepthState(DepthState.WRITEDEPTH);
                device.setStencilState(null, null);

                // Pack triangle data into vec4 uniforms (max 8 triangles with outline colors)
                const TRIANGLES_PER_BATCH = 8; // Conservative start: 8 triangles * 4 vec4 = 32 uniforms
                const VEC4_PER_BATCH = TRIANGLES_PER_BATCH * 4; // 32 vec4 uniforms per batch

                // Only log batching info once per render cycle, not every frame
                if (allTriangles.length > TRIANGLES_PER_BATCH && Math.random() < 0.01) {
                    console.log(`ℹ️ BATCHED RENDERING: ${allTriangles.length} triangles in ${Math.ceil(allTriangles.length / TRIANGLES_PER_BATCH)} batches`);
                }

                // Render triangles in batches
                let triangleIndex = 0;
                let batchCount = 0;

                while (triangleIndex < allTriangles.length) {
                    const remainingTriangles = allTriangles.length - triangleIndex;
                    const currentBatchSize = Math.min(remainingTriangles, TRIANGLES_PER_BATCH);
                    batchCount++;

                    // Removed excessive batch logging to reduce console spam

                    // Initialize all vec4 uniforms with zeros for this batch
                    const vec4Data: number[][] = [];
                    for (let i = 0; i < VEC4_PER_BATCH; i++) {
                    vec4Data[i] = [0, 0, 0, 0];
                }

                // Pack triangle data into vec4 uniforms (4 vec4 per triangle) for current batch
                for (let i = 0; i < currentBatchSize; i++) {
                    const triangle = allTriangles[triangleIndex + i];
                    const dataIndex = i * 4; // Each triangle uses 4 vec4 uniforms

                    // First vec4: v0.x, v0.z, v1.x, v1.z
                    vec4Data[dataIndex] = [
                        triangle.v0.x, triangle.v0.z,
                        triangle.v1.x, triangle.v1.z
                    ];

                    // Second vec4: v2.x, v2.z, color.r, color.g
                    vec4Data[dataIndex + 1] = [
                        triangle.v2.x, triangle.v2.z,
                        triangle.color.x, triangle.color.y
                    ];

                    // Third vec4: color.b, outlineThickness, outlineColor.r, outlineColor.g
                    vec4Data[dataIndex + 2] = [
                        triangle.color.z, triangle.outlineThickness,
                        triangle.outlineColor.x, triangle.outlineColor.y
                    ];

                    // Fourth vec4: outlineColor.b, fillAlpha, edgeVisibility packed, unused
                    // Pack edge visibility flags into single float:
                    // bits 0-2: edge01Visible, edge12Visible, edge20Visible
                    // FIXED: Use explicit boolean comparison to avoid undefined issues
                    const edgeFlags = (triangle.edge01Visible === true ? 1.0 : 0.0) +
                                     (triangle.edge12Visible === true ? 2.0 : 0.0) +
                                     (triangle.edge20Visible === true ? 4.0 : 0.0);

                    vec4Data[dataIndex + 3] = [
                        triangle.outlineColor.z, triangle.fillAlpha,
                        edgeFlags, 0.0
                    ];
                }

                    // Debug removed due to scope issue - key fix is boolean comparison change above

                    // Set shared uniforms
                    device.scope.resolve('triangleYPlane').setValue(this.yPlane);
                    device.scope.resolve('triangleCount').setValue(currentBatchSize);

                    // Set vec4 uniforms for triangle data (up to 128 uniforms for 32 triangles)
                    for (let i = 0; i < VEC4_PER_BATCH; i++) {
                        device.scope.resolve(`triangleData${i}`).setValue(vec4Data[i]);
                    }

                    // Render this batch
                    this.quadRender.render();

                    triangleIndex += currentBatchSize;
                }

                // Only log render completion occasionally to reduce spam
                if (Math.random() < 0.005) {
                    console.log(`🔺 Rendered ${allTriangles.length} triangles in ${batchCount} batch(es) at Y-plane ${this.yPlane}`);
                }
            }
        });

        // Register event functions for terrain-3d bridge
        this.scene.events.function('triangleOverlay.addTriangle', (v0: any, v1: any, v2: any, color: any = {x: 0, y: 1, z: 0}, fillAlpha: number = 1.0, outlineColor: any = {x: 1, y: 1, z: 1}, outlineThickness: number = 0.1, name?: string) => {
            this.addTriangle(v0, v1, v2, color, fillAlpha, outlineColor, outlineThickness, name);
        });

        this.scene.events.function('triangleOverlay.setYPlane', (yPlane: number) => {
            this.setYPlane(yPlane);
        });

        this.scene.events.function('triangleOverlay.clearTriangles', () => {
            this.clearTriangles();
        });

        this.scene.events.function('triangleOverlay.updateYPlaneFromSplats', () => {
            this.updateYPlaneFromSplats();
        });

        this.scene.events.function('triangleOverlay.calculateSplatYStatistics', () => {
            return this.calculateSplatYStatistics();
        });

        // Polygon event functions
        this.scene.events.function('triangleOverlay.addPolygon', (vertices: any[], color: any = {x: 0, y: 1, z: 0}, fillAlpha: number = 1.0, outlineColor: any = {x: 1, y: 1, z: 1}, outlineThickness: number = 0.1, name?: string, group?: string) => {
            const result = this.addPolygon(
                vertices.map(v => new Vec3(v.x, v.y, v.z)),
                new Vec3(color.x, color.y, color.z),
                fillAlpha,
                new Vec3(outlineColor.x, outlineColor.y, outlineColor.z),
                outlineThickness,
                name,
                group
            );
            return result;
        });

        this.scene.events.function('triangleOverlay.clearPolygons', () => {
            this.clearPolygons();
        });

        this.scene.events.function('triangleOverlay.updatePolygon', (name: string, updates: any) => {
            this.updatePolygon(name, updates);
        });

        this.scene.events.function('triangleOverlay.setPolygonVisibility', (name: string, visible: boolean) => {
            this.setPolygonVisibility(name, visible);
        });

        this.scene.events.function('triangleOverlay.setAllPolygonsVisibility', (visible: boolean) => {
            this.setAllPolygonsVisibility(visible);
        });

        this.scene.events.function('triangleOverlay.selectPolygon', (name: string) => {
            return this.selectPolygon(name);
        });

        this.scene.events.function('triangleOverlay.deselectPolygon', (name: string) => {
            return this.deselectPolygon(name);
        });

        this.scene.events.function('triangleOverlay.deselectAllPolygons', () => {
            return this.deselectAllPolygons();
        });

        this.scene.events.function('triangleOverlay.getSelectedPolygon', () => {
            return this.getSelectedPolygon();
        });

        this.scene.events.function('triangleOverlay.setGroupVisibility', (groupName: string, visible: boolean) => {
            return this.setGroupVisibility(groupName, visible);
        });

        this.scene.events.function('triangleOverlay.getGroups', () => {
            return this.getGroups();
        });

        this.scene.events.function('triangleOverlay.isGroupVisible', (groupName: string) => {
            return this.isGroupVisible(groupName);
        });

        // Set up automatic Y-plane adjustment when splats are loaded
        this.scene.events.on('scene.elementAdded', (element: any) => {
            // Check if a splat was added
            if (element.type === ElementType.splat) {
                console.log(`🔺 Splat "${element.name || 'unnamed'}" loaded - updating Y-plane automatically`);

                // Small delay to ensure splat data is fully initialized
                setTimeout(() => {
                    this.updateYPlaneFromSplats();
                }, 100);
            }
        });

        // Also check for existing splats when triangle overlay initializes
        setTimeout(() => {
            console.log('🔺 Checking for existing splats on triangle overlay initialization...');
            this.updateYPlaneFromSplats();
        }, 500);

        // Demo polygons removed - ready for GeoJSON data

        console.log('✅ TriangleOverlay initialized with dynamic irregular triangle and dynamic color');
    }

    remove() {
        this.shader?.destroy();
        this.quadRender?.destroy();
    }

    addTriangle(v0: Vec3 | {x: number, y: number, z: number}, v1: Vec3 | {x: number, y: number, z: number}, v2: Vec3 | {x: number, y: number, z: number}, color: Vec3 | {x: number, y: number, z: number} = {x: 0, y: 1, z: 0}, fillAlpha: number = 1.0, outlineColor: Vec3 | {x: number, y: number, z: number} = {x: 1, y: 1, z: 1}, outlineThickness: number = 0.1, name?: string, edge01Visible: boolean = true, edge12Visible: boolean = true, edge20Visible: boolean = true) {
        // Convert plain objects to Vec3 if needed
        const vertex0 = v0 instanceof Vec3 ? v0.clone() : new Vec3(v0.x, v0.y, v0.z);
        const vertex1 = v1 instanceof Vec3 ? v1.clone() : new Vec3(v1.x, v1.y, v1.z);
        const vertex2 = v2 instanceof Vec3 ? v2.clone() : new Vec3(v2.x, v2.y, v2.z);
        const col = color instanceof Vec3 ? color.clone() : new Vec3(color.x, color.y, color.z);
        const outCol = outlineColor instanceof Vec3 ? outlineColor.clone() : new Vec3(outlineColor.x, outlineColor.y, outlineColor.z);

        this.triangles.push({
            v0: vertex0,
            v1: vertex1,
            v2: vertex2,
            color: col,
            fillAlpha,
            outlineColor: outCol,
            outlineThickness,
            name,
            edge01Visible,
            edge12Visible,
            edge20Visible
        });

        const nameStr = name ? ` (${name})` : '';
        const edgeInfo = edge01Visible && edge12Visible && edge20Visible ? '' : ` edges:[${edge01Visible ? '01' : ''}${edge12Visible ? '12' : ''}${edge20Visible ? '20' : ''}]`;
        // Triangle added successfully
    }

    setYPlane(yPlane: number) {
        this.yPlane = yPlane;
        console.log(`🔺 Y-plane set to ${yPlane}`);
    }

    /**
     * Get all triangles from both direct triangles and visible polygons
     */
    getAllTriangles(): TriangleData[] {
        const allTriangles: TriangleData[] = [];

        // Add direct triangles (always visible if overlay is visible)
        allTriangles.push(...this.triangles);

        // Add triangles from visible polygons only
        for (const polygon of this.polygons) {
            if (polygon.visible) {
                allTriangles.push(...polygon.getTriangles());
            }
        }

        return allTriangles;
    }

    /**
     * Add a polygon to the overlay
     */
    addPolygon(vertices: Vec3[], color: Vec3 = new Vec3(0, 1, 0), fillAlpha: number = 1.0, outlineColor: Vec3 = new Vec3(1, 1, 1), outlineThickness: number = 0.1, name?: string, group?: string) {

        const polygon = new Polygon({
            vertices,
            color,
            fillAlpha,
            outlineColor,
            outlineThickness,
            name,
            group
        });

        this.polygons.push(polygon);
        return polygon;
    }

    /**
     * Remove all polygons
     */
    clearPolygons() {
        this.polygons = [];
        console.log('🧹 All polygons cleared from overlay');
    }

    /**
     * Update polygon properties by name
     */
    updatePolygon(name: string, updates: Partial<PolygonData>) {
        const polygon = this.polygons.find(p => p.name === name);
        if (polygon) {
            polygon.updateProperties(updates);
            console.log(`🔹 Polygon "${name}" updated and re-triangulated`);
        } else {
            console.warn(`⚠️ Polygon "${name}" not found`);
        }
    }

    /**
     * Show/hide polygon by name
     */
    setPolygonVisibility(name: string, visible: boolean) {
        const polygon = this.polygons.find(p => p.name === name);
        if (polygon) {
            polygon.visible = visible;
            console.log(`👁️ Polygon "${name}" ${visible ? 'shown' : 'hidden'}`);
        } else {
            console.warn(`⚠️ Polygon "${name}" not found`);
        }
    }

    /**
     * Show/hide all polygons
     */
    setAllPolygonsVisibility(visible: boolean) {
        this.polygons.forEach(polygon => {
            polygon.visible = visible;
        });
        console.log(`👁️ All polygons ${visible ? 'shown' : 'hidden'} (${this.polygons.length} polygons)`);
    }

    /**
     * Select a polygon by name (deselects all other polygons first)
     */
    selectPolygon(name: string) {
        // First deselect all polygons
        this.polygons.forEach(polygon => {
            if (polygon.selected) {
                polygon.deselect();
            }
        });

        // Then select the specified polygon
        const polygon = this.polygons.find(p => p.name === name);
        if (polygon) {
            polygon.select();
            this.scene.forceRender = true; // Trigger SuperSplat view update
            console.log(`🎯 Polygon "${name}" selected (all others deselected)`);
            return true;
        } else {
            console.warn(`⚠️ Polygon "${name}" not found for selection`);
            return false;
        }
    }

    /**
     * Deselect a polygon by name
     */
    deselectPolygon(name: string) {
        const polygon = this.polygons.find(p => p.name === name);
        if (polygon) {
            polygon.deselect();
            this.scene.forceRender = true; // Trigger SuperSplat view update
            console.log(`🎯 Polygon "${name}" deselected`);
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
                polygon.deselect();
                deselectedCount++;
            }
        });
        console.log(`🎯 ${deselectedCount} polygons deselected`);
        return deselectedCount;
    }

    /**
     * Get the currently selected polygon (if any)
     */
    getSelectedPolygon(): string | null {
        const selected = this.polygons.find(p => p.selected);
        return selected ? selected.name || null : null;
    }

    /**
     * Set visibility for all polygons in a group
     */
    setGroupVisibility(groupName: string, visible: boolean) {
        let affectedCount = 0;
        this.polygons.forEach(polygon => {
            if (polygon.group === groupName) {
                polygon.visible = visible;
                // If hiding the group, also deselect any selected polygons in this group
                if (!visible && polygon.selected) {
                    polygon.deselect();
                }
                affectedCount++;
            }
        });
        if (affectedCount > 0) {
            this.scene.forceRender = true; // Trigger SuperSplat view update
        }
        console.log(`👁️ Group "${groupName}" ${visible ? 'shown' : 'hidden'} (${affectedCount} polygons affected)`);
        return affectedCount;
    }

    /**
     * Get all available groups
     */
    getGroups(): string[] {
        const groups = new Set<string>();
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
    isGroupVisible(groupName: string): boolean {
        const groupPolygons = this.polygons.filter(p => p.group === groupName);
        if (groupPolygons.length === 0) return false;
        // Group is visible if any polygon in the group is visible
        return groupPolygons.some(p => p.visible);
    }

    /**
     * Calculate Y-plane statistics from all loaded splats
     * Returns highest Y-value, 90th percentile, and 75th percentile
     */
    calculateSplatYStatistics(): { highest: number, percentile90: number, percentile75: number } | null {
        const splats = this.scene.getElementsByType(ElementType.splat) as any[];

        if (!splats || splats.length === 0) {
            console.log('📊 No splats found in scene');
            return null;
        }

        const allYValues: number[] = [];

        // Collect all Y-values from all splats using world coordinates
        const tempVec = new Vec3();

        for (const splat of splats) {
            if (!splat.entity?.gsplat?.instance?.sorter?.centers) {
                console.log(`⚠️  Splat "${splat.name}" has no centers data - skipping`);
                continue;
            }

            const numSplats = splat.splatData.numSplats;

            // Use the splat's calcSplatWorldPosition method to get proper world coordinates
            for (let i = 0; i < numSplats; i++) {
                if (splat.calcSplatWorldPosition(i, tempVec)) {
                    allYValues.push(tempVec.y); // Use world Y coordinate
                }
            }

            // Collected Y-values from splat
        }

        if (allYValues.length === 0) {
            console.log('📊 No Y-values collected from splats');
            return null;
        }

        // Sort Y-values in ascending order
        allYValues.sort((a, b) => a - b);

        // Calculate statistics
        const highest = allYValues[allYValues.length - 1];
        const percentile90Index = Math.floor(allYValues.length * 0.90);
        const percentile75Index = Math.floor(allYValues.length * 0.75);

        const percentile90 = allYValues[percentile90Index];
        const percentile75 = allYValues[percentile75Index];

        // Log key statistics
        console.log(`📊 Analyzed ${allYValues.length} splat points - Highest Y-value: ${highest.toFixed(3)}`);

        return { highest, percentile90, percentile75 };
    }

    /**
     * Automatically set Y-plane based on loaded splat data
     * Uses highest Y-value as default, with fallback to current value
     */
    updateYPlaneFromSplats() {
        const stats = this.calculateSplatYStatistics();

        if (!stats) {
            console.log(`🔺 No splat data available - keeping current Y-plane: ${this.yPlane}`);
            return;
        }

        // Use the highest Y-value plus a small safety margin to ensure triangles render clearly above all splats
        const safetyMargin = 0.1; // 10cm above highest splat
        const newYPlane = stats.highest + safetyMargin;

        console.log(`🔺 Automatically setting Y-plane to highest splat Y-value + margin: ${stats.highest.toFixed(3)} + ${safetyMargin} = ${newYPlane.toFixed(3)}`);
        this.setYPlane(newYPlane);
    }

    clearTriangles() {
        this.triangles = [];
        console.log('🧹 All triangles cleared from overlay');
    }



    /**
     * Local implementation of triangulation logic (same as SuperSplatBridge)
     */
    localTriangulatePolygon(vertices: any[]) {
        if (vertices.length < 3) return [];
        if (vertices.length === 3) return [vertices]; // Already a triangle

        // Fan triangulation from first vertex (same as SuperSplatBridge)
        const triangles = [];
        const firstVertex = vertices[0];

        for (let i = 1; i < vertices.length - 1; i++) {
            const triangle = [
                firstVertex,
                vertices[i],
                vertices[i + 1]
            ];
            triangles.push(triangle);
        }

        // Polygon triangulated locally
        return triangles;
    }

    /**
     * Convert HSL to RGB color values
     */
    hslToRgb(h: number, s: number, l: number): {r: number, g: number, b: number} {
        h /= 360;
        const a = s * Math.min(l, 1 - l);
        const f = (n: number) => {
            const k = (n + h * 12) % 12;
            return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        };
        return {r: f(0), g: f(8), b: f(4)};
    }

    serialize(serializer: Serializer): void {
        serializer.pack(this.visible);
        serializer.pack(this.triangles.length);
        serializer.pack(this.yPlane);
        for (const triangle of this.triangles) {
            serializer.pack(triangle.v0.x, triangle.v0.y, triangle.v0.z);
            serializer.pack(triangle.v1.x, triangle.v1.y, triangle.v1.z);
            serializer.pack(triangle.v2.x, triangle.v2.y, triangle.v2.z);
            serializer.pack(triangle.color.x, triangle.color.y, triangle.color.z);
            serializer.pack(triangle.fillAlpha);
            serializer.pack(triangle.outlineColor.x, triangle.outlineColor.y, triangle.outlineColor.z);
            serializer.pack(triangle.outlineThickness);
        }
    }
}

export { TriangleOverlay };
