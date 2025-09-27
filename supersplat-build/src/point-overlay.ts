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

        console.log(`🔹 Polygon "${this.name}" triangulated: ${this.vertices.length} vertices → ${this.triangles.length} triangles (with edge classification)`);

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
                        console.log(`🔺 Rendering batch ${batchCount}: triangles ${triangleIndex}-${triangleIndex + currentBatchSize - 1}`);
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
            return this.addPolygon(
                vertices.map(v => new Vec3(v.x, v.y, v.z)),
                new Vec3(color.x, color.y, color.z),
                fillAlpha,
                new Vec3(outlineColor.x, outlineColor.y, outlineColor.z),
                outlineThickness,
                name
            );
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

        // Add 2 triangles using DYNAMIC coordinates for stress testing
        this.addDynamicTriangles();

        // Add polygon demo - create quadrilateral
        this.addPolygonDemo();

        // STRESS TEST: Add many triangles to exceed 32 triangle limit
        this.addStressTestTriangles();

        // VERIFICATION TEST: Pass same coordinates through triangulation system
        // Delay to ensure SuperSplatBridge is available
        setTimeout(() => {
            this.verifyTriangulationSystem();
        }, 2000);

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
        console.log(`🔺 Triangle added: v0(${vertex0.x.toFixed(2)}, ${vertex0.z.toFixed(2)}), v1(${vertex1.x.toFixed(2)}, ${vertex1.z.toFixed(2)}), v2(${vertex2.x.toFixed(2)}, ${vertex2.z.toFixed(2)}), fillAlpha=${fillAlpha}, thickness=${outlineThickness}${edgeInfo}${nameStr}`);
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
        const polygon = new Polygon({
            vertices,
            color,
            fillAlpha,
            outlineColor,
            outlineThickness,
            name
        });

        this.polygons.push(polygon);

        const nameStr = name ? ` (${name})` : '';
        console.log(`🔹 Polygon added: ${vertices.length} vertices → ${polygon.triangles.length} triangles, fillAlpha=${fillAlpha}, thickness=${outlineThickness}${nameStr}`);

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
     * Add 3 triangles using dynamic coordinates for stress testing multi-triangle shader
     * Includes one hollow triangle to demonstrate transparent fills
     */
    addDynamicTriangles() {
        console.log('🔺🔺🔺 Adding 3 dynamic triangles for stress testing (including hollow triangle)...');

        // First triangle - Orange irregular triangle (original)
        const triangle1Vertices = [
            {x: 0.0, y: 0, z: 3.0},    // Top vertex (pointed up)
            {x: -2.5, y: 0, z: 0.0},  // Bottom left (wider base)
            {x: 1.0, y: 0, z: 0.0}    // Bottom right (asymmetric)
        ];

        // Second triangle - Blue triangle at different position
        const triangle2Vertices = [
            {x: 5.0, y: 0, z: 1.0},    // Top vertex
            {x: 3.0, y: 0, z: -1.0},   // Bottom left
            {x: 7.0, y: 0, z: -1.0}    // Bottom right
        ];

        // Third triangle - Hollow triangle (purple outline only)
        const triangle3Vertices = [
            {x: -1.0, y: 0, z: -3.0},   // Top vertex
            {x: -3.0, y: 0, z: -5.0},   // Bottom left
            {x: 1.0, y: 0, z: -5.0}     // Bottom right
        ];

        console.log('📐 Triangle 1 vertices (Orange):');
        triangle1Vertices.forEach((vertex, i) => {
            console.log(`  v${i}: x=${vertex.x.toFixed(3)}, z=${vertex.z.toFixed(3)}`);
        });

        console.log('📐 Triangle 2 vertices (Blue):');
        triangle2Vertices.forEach((vertex, i) => {
            console.log(`  v${i}: x=${vertex.x.toFixed(3)}, z=${vertex.z.toFixed(3)}`);
        });

        console.log('📐 Triangle 3 vertices (Hollow):');
        triangle3Vertices.forEach((vertex, i) => {
            console.log(`  v${i}: x=${vertex.x.toFixed(3)}, z=${vertex.z.toFixed(3)}`);
        });

        // Process all triangles through triangulation system
        const triangulated1 = this.localTriangulatePolygon(triangle1Vertices);
        const triangulated2 = this.localTriangulatePolygon(triangle2Vertices);
        const triangulated3 = this.localTriangulatePolygon(triangle3Vertices);

        // Add first triangle (Orange) with thin RED outline
        if (triangulated1.length === 1) {
            const triangle = triangulated1[0];
            const orangeColor = {x: 1, y: 0.5, z: 0};  // Orange fill
            const fillAlpha1 = 1.0;  // Solid fill
            const redOutlineColor = {x: 1, y: 0, z: 0}; // Red outline
            const thinOutline = 0.05; // Thin outline
            this.addTriangle(
                triangle[0], triangle[1], triangle[2],
                orangeColor,
                fillAlpha1,
                redOutlineColor,
                thinOutline,
                'Triangle 1 (Orange Fill - Thin Red Outline)'
            );
            console.log(`✅ Triangle 1 added: Orange fill RGB(${orangeColor.x}, ${orangeColor.y}, ${orangeColor.z}), fillAlpha=${fillAlpha1}, Red outline RGB(${redOutlineColor.x}, ${redOutlineColor.y}, ${redOutlineColor.z}), thickness=${thinOutline}`);
        } else {
            console.error(`❌ Triangle 1 triangulation failed: expected 1 triangle, got ${triangulated1.length}`);
        }

        // Add second triangle (Blue) with thick GREEN outline
        if (triangulated2.length === 1) {
            const triangle = triangulated2[0];
            const blueColor = {x: 0, y: 0.3, z: 1};  // Blue fill
            const fillAlpha2 = 1.0;  // Solid fill
            const greenOutlineColor = {x: 0, y: 1, z: 0}; // Green outline
            const thickOutline = 0.2; // Thick outline
            this.addTriangle(
                triangle[0], triangle[1], triangle[2],
                blueColor,
                fillAlpha2,
                greenOutlineColor,
                thickOutline,
                'Triangle 2 (Blue Fill - Thick Green Outline)'
            );
            console.log(`✅ Triangle 2 added: Blue fill RGB(${blueColor.x}, ${blueColor.y}, ${blueColor.z}), fillAlpha=${fillAlpha2}, Green outline RGB(${greenOutlineColor.x}, ${greenOutlineColor.y}, ${greenOutlineColor.z}), thickness=${thickOutline}`);
        } else {
            console.error(`❌ Triangle 2 triangulation failed: expected 1 triangle, got ${triangulated2.length}`);
        }

        // Add third triangle (HOLLOW) with purple outline only
        if (triangulated3.length === 1) {
            const triangle = triangulated3[0];
            const hollowColor = {x: 0.5, y: 0, z: 0.5};  // Purple color (won't be visible due to fillAlpha=0)
            const fillAlpha3 = 0.0;  // Completely transparent fill (hollow)
            const purpleOutlineColor = {x: 0.8, y: 0, z: 0.8}; // Purple outline
            const mediumOutline = 0.12; // Medium outline
            this.addTriangle(
                triangle[0], triangle[1], triangle[2],
                hollowColor,
                fillAlpha3,
                purpleOutlineColor,
                mediumOutline,
                'Triangle 3 (HOLLOW - Purple Outline Only)'
            );
            console.log(`✅ Triangle 3 added: HOLLOW triangle with fillAlpha=${fillAlpha3}, Purple outline RGB(${purpleOutlineColor.x}, ${purpleOutlineColor.y}, ${purpleOutlineColor.z}), thickness=${mediumOutline}`);
        } else {
            console.error(`❌ Triangle 3 triangulation failed: expected 1 triangle, got ${triangulated3.length}`);
        }

        console.log('🎯 STRESS TEST: 3 triangles added to multi-triangle shader system (including hollow triangle)');
    }

    /**
     * Verify triangulation system using local implementation of the same logic
     */
    verifyTriangulationSystem() {
        console.log('🔍 TRIANGULATION VERIFICATION TEST');
        console.log('====================================');

        // Define the same irregular triangle coordinates as used in addDynamicTriangle
        const testVertices = [
            {x: 0.0, y: 0, z: 3.0},    // Top vertex (pointed up)
            {x: -2.5, y: 0, z: 0.0},  // Bottom left (wider base)
            {x: 1.0, y: 0, z: 0.0}    // Bottom right (asymmetric)
        ];

        console.log('📐 Input triangle vertices (irregular triangle test):');
        testVertices.forEach((vertex, i) => {
            console.log(`  v${i}: x=${vertex.x.toFixed(3)}, z=${vertex.z.toFixed(3)} (y=${vertex.y} - will be ignored)`);
        });

        // Local triangulation implementation (same logic as SuperSplatBridge)
        const triangulated = this.localTriangulatePolygon(testVertices);

        console.log('🔺 Local triangulation system output:');
        console.log(`  Number of triangles: ${triangulated.length}`);

        if (triangulated.length > 0) {
            triangulated.forEach((triangle: any, triangleIndex: number) => {
                console.log(`  Triangle ${triangleIndex}:`);
                triangle.forEach((vertex: any, vertexIndex: number) => {
                    console.log(`    v${vertexIndex}: x=${vertex.x.toFixed(3)}, z=${vertex.z.toFixed(3)}`);
                });
            });

            // Verify the output matches input for a 3-vertex input
            if (triangulated.length === 1 && triangulated[0].length === 3) {
                const outputTriangle = triangulated[0];
                let allMatch = true;

                console.log('✅ VERIFICATION COMPARISON:');
                for (let i = 0; i < 3; i++) {
                    const inputVertex = testVertices[i];
                    const outputVertex = outputTriangle[i];
                    const xMatch = Math.abs(inputVertex.x - outputVertex.x) < 0.001;
                    const zMatch = Math.abs(inputVertex.z - outputVertex.z) < 0.001;
                    const matches = xMatch && zMatch;

                    console.log(`  v${i}: Input(${inputVertex.x.toFixed(3)}, ${inputVertex.z.toFixed(3)}) → Output(${outputVertex.x.toFixed(3)}, ${outputVertex.z.toFixed(3)}) ${matches ? '✅ MATCH' : '❌ MISMATCH'}`);

                    if (!matches) allMatch = false;
                }

                console.log(`🎯 TRIANGULATION VERIFICATION: ${allMatch ? '✅ PASSED - Coordinates match perfectly' : '❌ FAILED - Coordinate mismatch detected'}`);

                // Additional test: verify fan triangulation for larger polygons
                this.testFanTriangulation();

            } else {
                console.log(`⚠️ Unexpected triangulation result: expected 1 triangle with 3 vertices, got ${triangulated.length} triangles`);
            }
        } else {
            console.log('❌ Triangulation returned no triangles');
        }

        console.log('====================================');
        console.log('🔍 TRIANGULATION VERIFICATION COMPLETE');
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

        console.log(`🔺 Local triangulated ${vertices.length}-sided polygon into ${triangles.length} triangles`);
        return triangles;
    }

    /**
     * Test fan triangulation with a larger polygon
     */
    testFanTriangulation() {
        console.log('🔸 TESTING FAN TRIANGULATION FOR 4-SIDED POLYGON:');

        // Test with a square (4 vertices)
        const squareVertices = [
            {x: 0, y: 0, z: 0},     // Bottom left
            {x: 2, y: 0, z: 0},     // Bottom right
            {x: 2, y: 0, z: 2},     // Top right
            {x: 0, y: 0, z: 2}      // Top left
        ];

        console.log('📐 Square input vertices:');
        squareVertices.forEach((vertex, i) => {
            console.log(`  v${i}: x=${vertex.x.toFixed(3)}, z=${vertex.z.toFixed(3)}`);
        });

        const triangulated = this.localTriangulatePolygon(squareVertices);

        console.log(`🔺 Expected: 2 triangles from 4-sided polygon`);
        console.log(`🔺 Actual: ${triangulated.length} triangles`);

        if (triangulated.length === 2) {
            console.log('✅ Fan triangulation working correctly for squares');

            // Verify triangles share the first vertex
            const firstVertex = squareVertices[0];
            let fanCorrect = true;

            triangulated.forEach((triangle: any, index: number) => {
                const firstTriangleVertex = triangle[0];
                const matches = Math.abs(firstVertex.x - firstTriangleVertex.x) < 0.001 &&
                               Math.abs(firstVertex.z - firstTriangleVertex.z) < 0.001;

                console.log(`  Triangle ${index}: First vertex matches fan center: ${matches ? '✅' : '❌'}`);
                if (!matches) fanCorrect = false;
            });

            console.log(`🎯 FAN TRIANGULATION: ${fanCorrect ? '✅ PASSED' : '❌ FAILED'}`);
        } else {
            console.log('❌ Fan triangulation failed for 4-sided polygon');
        }
    }

    /**
     * Add polygon demonstration - create various polygons including a quadrilateral
     */
    addPolygonDemo() {
        console.log('🔹🔹 Adding polygon demonstration with quadrilateral...');

        // Quadrilateral (4-sided polygon) - Red with thick blue outline
        const quadVertices = [
            new Vec3(-8.0, 0, 2.0),   // Top left
            new Vec3(-4.0, 0, 4.0),   // Top right
            new Vec3(-3.0, 0, -1.0),  // Bottom right
            new Vec3(-9.0, 0, -2.0)   // Bottom left
        ];

        console.log('📐 Quadrilateral vertices:');
        quadVertices.forEach((vertex, i) => {
            console.log(`  v${i}: x=${vertex.x.toFixed(3)}, z=${vertex.z.toFixed(3)}`);
        });

        const redColor = new Vec3(1, 0, 0);  // Red fill
        const blueOutlineColor = new Vec3(0, 0.2, 1);  // Blue outline
        const fillAlpha = 0.8;  // Semi-transparent
        const thickOutline = 0.15;

        const quadrilateral = this.addPolygon(
            quadVertices,
            redColor,
            fillAlpha,
            blueOutlineColor,
            thickOutline,
            'Quadrilateral Demo'
        );

        console.log(`✅ Quadrilateral added: ${quadVertices.length} vertices → ${quadrilateral.triangles.length} triangles (red fill, blue outline)`);

        // Pentagon (5-sided polygon) - Green with yellow outline
        const pentagonVertices = [
            new Vec3(8.0, 0, 3.0),    // Top
            new Vec3(10.5, 0, 1.0),   // Top right
            new Vec3(9.5, 0, -2.0),   // Bottom right
            new Vec3(6.5, 0, -2.0),   // Bottom left
            new Vec3(5.5, 0, 1.0)     // Top left
        ];

        console.log('📐 Pentagon vertices:');
        pentagonVertices.forEach((vertex, i) => {
            console.log(`  v${i}: x=${vertex.x.toFixed(3)}, z=${vertex.z.toFixed(3)}`);
        });

        const greenColor = new Vec3(0, 0.8, 0.2);  // Green fill
        const yellowOutlineColor = new Vec3(1, 1, 0);  // Yellow outline
        const pentagonFillAlpha = 1.0;  // Solid
        const mediumOutline = 0.08;

        const pentagon = this.addPolygon(
            pentagonVertices,
            greenColor,
            pentagonFillAlpha,
            yellowOutlineColor,
            mediumOutline,
            'Pentagon Demo'
        );

        console.log(`✅ Pentagon added: ${pentagonVertices.length} vertices → ${pentagon.triangles.length} triangles (green fill, yellow outline)`);

        // Hexagon (6-sided polygon) - HOLLOW with purple outline
        const hexagonVertices = [
            new Vec3(0.0, 0, -8.0),   // Top
            new Vec3(2.0, 0, -6.5),   // Top right
            new Vec3(2.0, 0, -9.5),   // Bottom right
            new Vec3(0.0, 0, -11.0),  // Bottom
            new Vec3(-2.0, 0, -9.5),  // Bottom left
            new Vec3(-2.0, 0, -6.5)   // Top left
        ];

        console.log('📐 Hexagon vertices (HOLLOW):');
        hexagonVertices.forEach((vertex, i) => {
            console.log(`  v${i}: x=${vertex.x.toFixed(3)}, z=${vertex.z.toFixed(3)}`);
        });

        const invisibleColor = new Vec3(0.3, 0, 0.3);  // Won't be visible due to fillAlpha=0
        const purpleOutlineColor = new Vec3(0.7, 0, 0.9);  // Purple outline
        const hollowFillAlpha = 0.0;  // Completely transparent (hollow)
        const thinOutline = 0.06;

        const hexagon = this.addPolygon(
            hexagonVertices,
            invisibleColor,
            hollowFillAlpha,
            purpleOutlineColor,
            thinOutline,
            'Hexagon Demo (HOLLOW)'
        );

        console.log(`✅ Hexagon added: ${hexagonVertices.length} vertices → ${hexagon.triangles.length} triangles (HOLLOW with purple outline)`);

        console.log('🎯 POLYGON DEMO: 3 polygons created (Quadrilateral, Pentagon, Hollow Hexagon)');
        console.log(`🔹 Total polygons: ${this.polygons.length}`);
        console.log(`🔺 Total triangles from polygons: ${this.polygons.reduce((sum, poly) => sum + poly.triangles.length, 0)}`);
    }

    /**
     * STRESS TEST: Add many triangles and polygons to exceed 32 triangle limit
     * This tests the batched rendering system's ability to handle large quantities
     */
    addStressTestTriangles() {
        console.log('🚀🚀🚀 STRESS TEST: Adding many triangles to exceed 32 triangle limit...');

        const initialTriangleCount = this.getAllTriangles().length;
        console.log(`📊 Starting triangle count: ${initialTriangleCount}`);

        // Add 15 individual triangles to reach beyond 32 total (current ~12 + 15 = ~27, need more)
        console.log('🔺 Adding 15 individual stress test triangles...');
        for (let i = 0; i < 15; i++) {
            // Generate triangles in a grid pattern
            const baseX = -20 + (i % 5) * 4; // 5 columns, 4 units apart
            const baseZ = -20 + Math.floor(i / 5) * 4; // 3 rows, 4 units apart

            // Create small triangles with unique colors
            const hue = (i / 15) * 360; // Different hue for each triangle
            const color = this.hslToRgb(hue, 1.0, 0.6);
            const outlineColor = this.hslToRgb(hue, 1.0, 0.3); // Darker outline

            this.addTriangle(
                new Vec3(baseX, 0, baseZ + 1),     // Top vertex
                new Vec3(baseX - 0.8, 0, baseZ),  // Bottom left
                new Vec3(baseX + 0.8, 0, baseZ),  // Bottom right
                new Vec3(color.r, color.g, color.b),
                0.7, // Semi-transparent
                new Vec3(outlineColor.r, outlineColor.g, outlineColor.b),
                0.08, // Thin outline
                `StressTest_Triangle_${i + 1}`
            );
        }

        // Add 5 complex polygons (octagons) to generate many triangles
        console.log('🔹 Adding 5 octagon polygons (6 triangles each = 30 more triangles)...');
        for (let i = 0; i < 5; i++) {
            const centerX = 15 + (i % 3) * 6; // 3 columns
            const centerZ = -15 + Math.floor(i / 3) * 6; // 2 rows
            const radius = 2;

            // Create octagon vertices (8-sided polygon = 6 triangles via fan triangulation)
            const octagonVertices: Vec3[] = [];
            for (let j = 0; j < 8; j++) {
                const angle = (j / 8) * Math.PI * 2;
                octagonVertices.push(new Vec3(
                    centerX + Math.cos(angle) * radius,
                    0,
                    centerZ + Math.sin(angle) * radius
                ));
            }

            // Generate unique colors for each octagon
            const hue = (i / 5) * 360;
            const color = this.hslToRgb(hue, 0.8, 0.5);
            const outlineColor = this.hslToRgb(hue, 1.0, 0.2);

            this.addPolygon(
                octagonVertices,
                new Vec3(color.r, color.g, color.b),
                0.6, // Semi-transparent
                new Vec3(outlineColor.r, outlineColor.g, outlineColor.b),
                0.1, // Medium outline
                `StressTest_Octagon_${i + 1}`
            );
        }

        const finalTriangleCount = this.getAllTriangles().length;
        const addedTriangles = finalTriangleCount - initialTriangleCount;

        console.log(`📊 STRESS TEST COMPLETE:`);
        console.log(`  • Initial triangles: ${initialTriangleCount}`);
        console.log(`  • Added triangles: ${addedTriangles}`);
        console.log(`  • Final triangle count: ${finalTriangleCount}`);
        console.log(`  • Expected batches: ${Math.ceil(finalTriangleCount / 8)}`);

        if (finalTriangleCount > 32) {
            console.log(`🎯 SUCCESS: Triangle count (${finalTriangleCount}) exceeds 32 - batched rendering will be tested!`);
            console.log(`⚡ System will render ${Math.ceil(finalTriangleCount / 8)} batches of up to 8 triangles each`);
        } else {
            console.log(`⚠️ Need more triangles: Only ${finalTriangleCount} total (target: >32)`);
        }

        console.log('🚀 STRESS TEST TRIANGLES ADDED - Check console for batch rendering logs during render');
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