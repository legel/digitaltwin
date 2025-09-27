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
}

class TriangleOverlay extends Element {
    shader: Shader;
    quadRender: QuadRender;
    blendState = new BlendState(false);
    depthState = new DepthState(FUNC_LESSEQUAL, true);

    visible = true;
    triangles: TriangleData[] = [];
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
            const shouldRender = this.visible && layer === this.scene.debugLayer && !transparent &&
                this.scene.camera.renderOverlays && this.triangles.length > 0;

            if (shouldRender) {
                device.setBlendState(blendState);
                device.setCullMode(CULLFACE_NONE);
                device.setDepthState(DepthState.WRITEDEPTH);
                device.setStencilState(null, null);

                // Pack triangle data into vec4 uniforms (max 4 triangles with outline colors)
                const maxTriangles = Math.min(this.triangles.length, 4); // New shader limit: 4 triangles * 4 vec4 = 16 uniforms

                // Initialize all vec4 uniforms with zeros
                const vec4Data: number[][] = [];
                for (let i = 0; i < 16; i++) {
                    vec4Data[i] = [0, 0, 0, 0];
                }

                // Pack triangle data into vec4 uniforms (4 vec4 per triangle)
                for (let i = 0; i < maxTriangles; i++) {
                    const triangle = this.triangles[i];
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

                    // Fourth vec4: outlineColor.b, fillAlpha, unused, unused
                    vec4Data[dataIndex + 3] = [
                        triangle.outlineColor.z, triangle.fillAlpha,
                        0.0, 0.0
                    ];
                }

                console.log(`🐛 DEBUG: Vec4 packed triangle data for ${maxTriangles} triangles:`);
                for (let i = 0; i < Math.min(4, vec4Data.length); i++) {
                    console.log(`  triangleData${i}: [${vec4Data[i].map(v => v.toFixed(3)).join(', ')}]`);
                }

                // Set shared uniforms
                device.scope.resolve('triangleYPlane').setValue(this.yPlane);
                device.scope.resolve('triangleCount').setValue(maxTriangles);

                // Set vec4 uniforms for triangle data
                for (let i = 0; i < 16; i++) {
                    device.scope.resolve(`triangleData${i}`).setValue(vec4Data[i]);
                }

                // Single render call for all triangles
                this.quadRender.render();

                console.log(`🔺 Rendered ${maxTriangles} triangles at Y-plane ${this.yPlane} (vec4 packed multi-triangle shader)`);
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

    addTriangle(v0: Vec3 | {x: number, y: number, z: number}, v1: Vec3 | {x: number, y: number, z: number}, v2: Vec3 | {x: number, y: number, z: number}, color: Vec3 | {x: number, y: number, z: number} = {x: 0, y: 1, z: 0}, fillAlpha: number = 1.0, outlineColor: Vec3 | {x: number, y: number, z: number} = {x: 1, y: 1, z: 1}, outlineThickness: number = 0.1, name?: string) {
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
            name
        });

        const nameStr = name ? ` (${name})` : '';
        console.log(`🔺 Triangle added: v0(${vertex0.x.toFixed(2)}, ${vertex0.z.toFixed(2)}), v1(${vertex1.x.toFixed(2)}, ${vertex1.z.toFixed(2)}), v2(${vertex2.x.toFixed(2)}, ${vertex2.z.toFixed(2)}), fillAlpha=${fillAlpha}, thickness=${outlineThickness}, outlineRGB(${outCol.x}, ${outCol.y}, ${outCol.z})${nameStr}`);
    }

    setYPlane(yPlane: number) {
        this.yPlane = yPlane;
        console.log(`🔺 Y-plane set to ${yPlane}`);
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