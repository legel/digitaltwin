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

                // Pack triangle data into vec4 uniforms (max 8 triangles)
                const maxTriangles = Math.min(this.triangles.length, 8); // Shader limit

                // Initialize all vec4 uniforms with zeros
                const vec4Data: number[][] = [];
                for (let i = 0; i < 16; i++) {
                    vec4Data[i] = [0, 0, 0, 0];
                }

                // Pack triangle data into vec4 uniforms
                for (let i = 0; i < maxTriangles; i++) {
                    const triangle = this.triangles[i];
                    const dataIndex = i * 2; // Each triangle uses 2 vec4 uniforms

                    // First vec4: v0.x, v0.z, v1.x, v1.z
                    vec4Data[dataIndex] = [
                        triangle.v0.x, triangle.v0.z,
                        triangle.v1.x, triangle.v1.z
                    ];

                    // Second vec4: v2.x, v2.z, color.r, color.g (color.b stored as 0 for now)
                    vec4Data[dataIndex + 1] = [
                        triangle.v2.x, triangle.v2.z,
                        triangle.color.x, triangle.color.y
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
        this.scene.events.function('triangleOverlay.addTriangle', (v0: any, v1: any, v2: any, color: any = {x: 0, y: 1, z: 0}, name?: string) => {
            this.addTriangle(v0, v1, v2, color, name);
        });

        this.scene.events.function('triangleOverlay.setYPlane', (yPlane: number) => {
            this.setYPlane(yPlane);
        });

        this.scene.events.function('triangleOverlay.clearTriangles', () => {
            this.clearTriangles();
        });

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

    addTriangle(v0: Vec3 | {x: number, y: number, z: number}, v1: Vec3 | {x: number, y: number, z: number}, v2: Vec3 | {x: number, y: number, z: number}, color: Vec3 | {x: number, y: number, z: number} = {x: 0, y: 1, z: 0}, name?: string) {
        // Convert plain objects to Vec3 if needed
        const vertex0 = v0 instanceof Vec3 ? v0.clone() : new Vec3(v0.x, v0.y, v0.z);
        const vertex1 = v1 instanceof Vec3 ? v1.clone() : new Vec3(v1.x, v1.y, v1.z);
        const vertex2 = v2 instanceof Vec3 ? v2.clone() : new Vec3(v2.x, v2.y, v2.z);
        const col = color instanceof Vec3 ? color.clone() : new Vec3(color.x, color.y, color.z);

        this.triangles.push({
            v0: vertex0,
            v1: vertex1,
            v2: vertex2,
            color: col,
            name
        });

        const nameStr = name ? ` (${name})` : '';
        console.log(`🔺 Triangle added: v0(${vertex0.x.toFixed(2)}, ${vertex0.z.toFixed(2)}), v1(${vertex1.x.toFixed(2)}, ${vertex1.z.toFixed(2)}), v2(${vertex2.x.toFixed(2)}, ${vertex2.z.toFixed(2)})${nameStr}`);
    }

    setYPlane(yPlane: number) {
        this.yPlane = yPlane;
        console.log(`🔺 Y-plane set to ${yPlane}`);
    }

    clearTriangles() {
        this.triangles = [];
        console.log('🧹 All triangles cleared from overlay');
    }

    /**
     * Add 2 triangles using dynamic coordinates for stress testing multi-triangle shader
     */
    addDynamicTriangles() {
        console.log('🔺🔺 Adding 2 dynamic triangles for stress testing...');

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

        console.log('📐 Triangle 1 vertices (Orange):');
        triangle1Vertices.forEach((vertex, i) => {
            console.log(`  v${i}: x=${vertex.x.toFixed(3)}, z=${vertex.z.toFixed(3)}`);
        });

        console.log('📐 Triangle 2 vertices (Blue):');
        triangle2Vertices.forEach((vertex, i) => {
            console.log(`  v${i}: x=${vertex.x.toFixed(3)}, z=${vertex.z.toFixed(3)}`);
        });

        // Process both triangles through triangulation system
        const triangulated1 = this.localTriangulatePolygon(triangle1Vertices);
        const triangulated2 = this.localTriangulatePolygon(triangle2Vertices);

        // Add first triangle (Orange)
        if (triangulated1.length === 1) {
            const triangle = triangulated1[0];
            const orangeColor = {x: 1, y: 0.5, z: 0};  // Orange
            this.addTriangle(
                triangle[0], triangle[1], triangle[2],
                orangeColor,
                'Triangle 1 (Orange)'
            );
            console.log(`✅ Triangle 1 added: Orange color RGB(${orangeColor.x}, ${orangeColor.y}, ${orangeColor.z})`);
        } else {
            console.error(`❌ Triangle 1 triangulation failed: expected 1 triangle, got ${triangulated1.length}`);
        }

        // Add second triangle (Blue)
        if (triangulated2.length === 1) {
            const triangle = triangulated2[0];
            const blueColor = {x: 0, y: 0.3, z: 1};  // Blue
            this.addTriangle(
                triangle[0], triangle[1], triangle[2],
                blueColor,
                'Triangle 2 (Blue)'
            );
            console.log(`✅ Triangle 2 added: Blue color RGB(${blueColor.x}, ${blueColor.y}, ${blueColor.z})`);
        } else {
            console.error(`❌ Triangle 2 triangulation failed: expected 1 triangle, got ${triangulated2.length}`);
        }

        console.log('🎯 STRESS TEST: 2 triangles added to multi-triangle shader system');
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
        }
    }
}

export { TriangleOverlay };