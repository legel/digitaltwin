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
}

class Polygon {
    vertices: Vec3[];
    color: Vec3;
    fillAlpha: number;
    outlineColor: Vec3;
    outlineThickness: number;
    name?: string;
    visible: boolean;
    triangles: TriangleData[] = [];

    constructor(data: PolygonData) {
        this.vertices = data.vertices.map(v => v.clone());
        this.color = data.color.clone();
        this.fillAlpha = data.fillAlpha;
        this.outlineColor = data.outlineColor.clone();
        this.outlineThickness = data.outlineThickness;
        this.name = data.name;
        this.visible = data.visible !== false; // Default to true

        // Automatically triangulate the polygon
        this.triangulate();
    }

    /**
     * Triangulate the polygon into triangles using fan triangulation
     * Marks polygon perimeter edges as visible, internal edges as invisible
     */
    private triangulate() {
        this.triangles = [];

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

        // Fan triangulation from first vertex with edge classification
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
            // (i.e., this is the first triangle in fan)
            if (i === 1) {
                edge01Visible = true; // First perimeter edge from center
            }

            // Edge v2 → v0: Only visible if v2 is the last polygon vertex before v0
            // (i.e., this is the last triangle in fan)
            if (i === numVertices - 2) {
                edge20Visible = true; // Last perimeter edge back to center
            }

            this.triangles.push({
                v0,
                v1,
                v2,
                color: this.color.clone(),
                fillAlpha: this.fillAlpha,
                outlineColor: this.outlineColor.clone(),
                outlineThickness: this.outlineThickness,
                name: `${this.name}_tri_${i - 1}`,
                edge01Visible,
                edge12Visible,
                edge20Visible
            });
        }

        // Polygon triangulated successfully

        // Debug: Log edge visibility for complex polygons
        if (this.vertices.length > 4) {
            console.log(`🔍 Edge visibility for "${this.name}":`);
            this.triangles.forEach((tri, idx) => {
                const edges = [tri.edge01Visible ? 'v0→v1' : '', tri.edge12Visible ? 'v1→v2' : '', tri.edge20Visible ? 'v2→v0' : ''].filter(e => e);
                console.log(`  Triangle ${idx}: visible edges = [${edges.join(', ')}]`);
            });
        }
    }

    /**
     * Update polygon properties and re-triangulate
     */
    updateProperties(data: Partial<PolygonData>) {
        if (data.vertices) this.vertices = data.vertices.map(v => v.clone());
        if (data.color) this.color = data.color.clone();
        if (data.fillAlpha !== undefined) this.fillAlpha = data.fillAlpha;
        if (data.outlineColor) this.outlineColor = data.outlineColor.clone();
        if (data.outlineThickness !== undefined) this.outlineThickness = data.outlineThickness;
        if (data.name) this.name = data.name;
        if (data.visible !== undefined) this.visible = data.visible;

        // Re-triangulate with new properties
        this.triangulate();
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
            console.log(`🐛 RENDER DEBUG: Direct triangles: ${this.triangles.length}, Polygon triangles: ${allTriangles.length - this.triangles.length}, Total: ${allTriangles.length}`);

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

                if (allTriangles.length > TRIANGLES_PER_BATCH) {
                    console.log(`ℹ️ BATCHED RENDERING: ${allTriangles.length} triangles will be rendered in ${Math.ceil(allTriangles.length / TRIANGLES_PER_BATCH)} batches of ${TRIANGLES_PER_BATCH}`);
                }

                // Render triangles in batches
                let triangleIndex = 0;
                let batchCount = 0;

                while (triangleIndex < allTriangles.length) {
                    const remainingTriangles = allTriangles.length - triangleIndex;
                    const currentBatchSize = Math.min(remainingTriangles, TRIANGLES_PER_BATCH);
                    batchCount++;

                    if (batchCount > 1) {
                        // Rendering triangle batch
                    }

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
                    const edgeFlags = (triangle.edge01Visible !== false ? 1.0 : 0.0) +
                                     (triangle.edge12Visible !== false ? 2.0 : 0.0) +
                                     (triangle.edge20Visible !== false ? 4.0 : 0.0);

                    vec4Data[dataIndex + 3] = [
                        triangle.outlineColor.z, triangle.fillAlpha,
                        edgeFlags, 0.0
                    ];
                }

                    if (batchCount === 1) {
                        console.log(`🐛 DEBUG: Vec4 packed triangle data for batch ${batchCount} (${currentBatchSize} triangles):`);
                        for (let i = 0; i < Math.min(4, vec4Data.length); i++) {
                            console.log(`  triangleData${i}: [${vec4Data[i].map(v => v.toFixed(3)).join(', ')}]`);
                        }
                    }

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

                console.log(`🔺 Rendered ${allTriangles.length} triangles in ${batchCount} batch(es) at Y-plane ${this.yPlane}`);
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
        this.scene.events.function('triangleOverlay.addPolygon', (vertices: any[], color: any = {x: 0, y: 1, z: 0}, fillAlpha: number = 1.0, outlineColor: any = {x: 1, y: 1, z: 1}, outlineThickness: number = 0.1, name?: string) => {
            console.log(`🔺 EVENT RECEIVED: triangleOverlay.addPolygon - ${name} with ${vertices.length} vertices`);
            const result = this.addPolygon(
                vertices.map(v => new Vec3(v.x, v.y, v.z)),
                new Vec3(color.x, color.y, color.z),
                fillAlpha,
                new Vec3(outlineColor.x, outlineColor.y, outlineColor.z),
                outlineThickness,
                name
            );
            console.log(`📊 Total polygons in overlay: ${this.polygons.length}`);
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
    addPolygon(vertices: Vec3[], color: Vec3 = new Vec3(0, 1, 0), fillAlpha: number = 1.0, outlineColor: Vec3 = new Vec3(1, 1, 1), outlineThickness: number = 0.1, name?: string) {
        console.log(`🔺 ADDING POLYGON: ${name} with ${vertices.length} vertices, fillAlpha: ${fillAlpha}`);

        const polygon = new Polygon({
            vertices,
            color,
            fillAlpha,
            outlineColor,
            outlineThickness,
            name
        });

        this.polygons.push(polygon);
        console.log(`📊 Polygon "${name}" added successfully. Triangulated into ${polygon.triangles.length} triangles`);

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
