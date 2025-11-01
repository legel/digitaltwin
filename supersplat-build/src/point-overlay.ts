import {
    BLEND_NORMAL,
    CULLFACE_NONE,
    FUNC_LESSEQUAL,
    SEMANTIC_POSITION,
    SEMANTIC_COLOR,
    PRIMITIVE_TRIANGLES,
    createShaderFromCode,
    DepthState,
    Entity,
    Layer,
    Material,
    Mesh,
    MeshInstance,
    StandardMaterial,
    VertexBuffer,
    IndexBuffer,
    VertexFormat,
    TYPE_FLOAT32,
    TYPE_UINT16,
    Vec3,
    Color,
    calculateNormals
} from 'playcanvas';

import { Element, ElementType } from './element';

/**
 * Triangle data structure for rendering
 */
interface TriangleData {
    vertices: [number[], number[], number[]]; // 3 vertices, each [x, y, z]
    color: {r: number, g: number, b: number, a: number};
}

/**
 * New mesh-based triangle overlay system for efficient rendering
 * Runs independently alongside the backup system for testing
 */
class MeshTriangleOverlay extends Element {
    visible = true;
    private triangleMesh: Mesh | null = null;
    private triangleEntity: Entity | null = null;
    private material: StandardMaterial | null = null;
    private meshInstance: MeshInstance | null = null;
    yPlane: number = 3.5; // Default Y plane - raised off ground

    constructor() {
        super(ElementType.debug);
    }

    add() {
        console.log('🚀 TriangleOverlay.add() called - starting mesh-based system initialization');

        const device = this.scene.app.graphicsDevice;
        console.log('📱 Graphics device obtained:', device ? 'SUCCESS' : 'FAILED');

        try {
            // Create test triangle at center, raised 3.5 units above ground
            // this.createTestTriangle(); // Commented out - using real polygon data now

            // Register event functions for terrain-3d bridge compatibility
            this.registerEventFunctions();

            // Set up automatic Y-plane adjustment when splats are loaded
            this.scene.events.on('scene.elementAdded', (element: any) => {
                // Check if a splat was added
                if (element.type === ElementType.splat) {
                    // Small delay to ensure splat data is fully initialized
                    setTimeout(() => {
                        this.updateYPlaneFromSplats();
                    }, 100);
                }
            });

            // Check for existing splats on initialization
            setTimeout(() => {
                this.updateYPlaneFromSplats();
            }, 500);

            console.log('✅ TriangleOverlay initialization complete');
        } catch (error) {
            console.error('❌ TriangleOverlay initialization failed:', error);
        }
    }

    remove() {
        // Clean up mesh instance from layer
        if (this.meshInstance) {
            this.scene.debugLayer.removeMeshInstances([this.meshInstance]);
            this.meshInstance = null;
        }

        // Clean up entity
        if (this.triangleEntity) {
            if (this.scene.root && this.triangleEntity.parent === this.scene.root) {
                this.scene.root.removeChild(this.triangleEntity);
            }
            this.triangleEntity.destroy();
            this.triangleEntity = null;
        }

        // Clean up mesh
        if (this.triangleMesh) {
            this.triangleMesh.destroy();
            this.triangleMesh = null;
        }

        // Clean up material
        if (this.material) {
            this.material.destroy();
            this.material = null;
        }
    }

    /**
     * Generic function to render an array of triangles as a mesh
     */
    private renderTriangles(triangles: TriangleData[]) {
        console.log(`🔺 Rendering ${triangles.length} triangles as mesh...`);

        const device = this.scene.app.graphicsDevice;
        if (!device) {
            console.error('❌ Graphics device not available');
            return;
        }

        try {
            // Clean up existing mesh if any
            this.remove();

            // Create new mesh
            this.triangleMesh = new Mesh(device);

            const totalTriangles = triangles.length;
            const positions = new Float32Array(totalTriangles * 9);  // 3 vertices * 3 components
            const colors = new Float32Array(totalTriangles * 12);    // 3 vertices * 4 components
            const indices = new Uint16Array(totalTriangles * 3);     // 3 indices per triangle

            // Process each triangle
            triangles.forEach((triangle, triangleIndex) => {
                for (let v = 0; v < 3; v++) {
                    const vertex = triangle.vertices[v];
                    const posOffset = (triangleIndex * 3 + v) * 3;
                    const colorOffset = (triangleIndex * 3 + v) * 4;

                    // Set position with Y-plane applied
                    positions[posOffset + 0] = vertex[0]; // X
                    positions[posOffset + 1] = this.yPlane; // Y - use the calculated Y-plane
                    positions[posOffset + 2] = vertex[2]; // Z

                    // Set color (same for all 3 vertices of this triangle)
                    colors[colorOffset + 0] = triangle.color.r;
                    colors[colorOffset + 1] = triangle.color.g;
                    colors[colorOffset + 2] = triangle.color.b;
                    colors[colorOffset + 3] = triangle.color.a;

                    // Set index
                    indices[triangleIndex * 3 + v] = triangleIndex * 3 + v;
                }
            });

            // Set mesh data
            this.triangleMesh.setPositions(positions, 3);
            this.triangleMesh.setColors(colors);
            this.triangleMesh.setIndices(indices);

            // Calculate normals
            const normals = calculateNormals(positions, indices);
            this.triangleMesh.setNormals(normals, 3);
            this.triangleMesh.update();

            // Create material
            this.material = new StandardMaterial();
            this.material.useLighting = false;
            this.material.emissiveVertexColor = true;
            this.material.emissive = new Color(1, 1, 1);
            //this.material.cull = CULLFACE_NONE;
            this.material.blendType = BLEND_NORMAL;
            this.material.opacityVertexColor = true;
            this.material.update();

            // Create entity and mesh instance
            this.triangleEntity = new Entity('triangle-mesh');
            this.triangleEntity.addComponent("render", {
                type: 'box',
            });

            const meshInstance = new MeshInstance(this.triangleMesh, this.material);
            this.triangleEntity.render.meshInstances = [meshInstance];

            // Add to scene
            if (this.scene.app.root) {
                this.scene.app.root.addChild(this.triangleEntity);
            }

            this.meshInstance = meshInstance;

            // Force immediate render update so triangles appear without camera movement
            if (this.scene) {
                this.scene.forceRender = true;
            }

            console.log(`✅ Successfully rendered ${totalTriangles} triangles`);

        } catch (error) {
            console.error('❌ Error in renderTriangles:', error);
        }
    }

    /**
     * Create test data: quadrilaterals with borders using triangles
     * Blue quadrilateral with thick border, red quadrilateral with thin border
     */
    private createTestTriangle() {
        console.log('🔺 Generating test triangle data for bordered quadrilaterals...');

        const quadSize = 2.0;
        const blueBorderWidth = 0.15; // Thick border for blue quad
        const redBorderWidth = 0.08;  // Thin border for red quad

        const triangles: TriangleData[] = [];

        // Helper function to create triangle data
        const createTriangle = (v0: number[], v1: number[], v2: number[], color: {r: number, g: number, b: number, a: number}): TriangleData => {
            return {
                vertices: [v0, v1, v2],
                color: color
            };
        };

        // Helper function to create border quad (2 triangles)
        const createBorderQuad = (inner0: number[], inner1: number[], outer0: number[], outer1: number[], color: {r: number, g: number, b: number, a: number}) => {
            // First triangle: inner0, inner1, outer0
            triangles.push(createTriangle(inner0, inner1, outer0, color));
            // Second triangle: inner1, outer1, outer0
            triangles.push(createTriangle(inner1, outer1, outer0, color));
        };

        const blackColor = {r: 0.0, g: 0.0, b: 0.0, a: 0.8};
        const blueColor = {r: 0.0, g: 0.0, b: 1.0, a: 0.5};
        const redColor = {r: 1.0, g: 0.0, b: 0.0, a: 0.7};

        // === BLUE QUADRILATERAL (left side) ===
        const blueInner = [
            [-quadSize + blueBorderWidth, this.yPlane, -quadSize/2 + blueBorderWidth], // bottom-left
            [-quadSize + blueBorderWidth, this.yPlane,  quadSize/2 - blueBorderWidth], // top-left
            [-blueBorderWidth,            this.yPlane, -quadSize/2 + blueBorderWidth], // bottom-right
            [-blueBorderWidth,            this.yPlane,  quadSize/2 - blueBorderWidth]  // top-right
        ];

        const blueOuter = [
            [-quadSize, this.yPlane, -quadSize/2], // bottom-left
            [-quadSize, this.yPlane,  quadSize/2], // top-left
            [0,         this.yPlane, -quadSize/2], // bottom-right
            [0,         this.yPlane,  quadSize/2]  // top-right
        ];

        // Blue fill triangles
        triangles.push(createTriangle(blueInner[0], blueInner[1], blueInner[2], blueColor));
        triangles.push(createTriangle(blueInner[1], blueInner[3], blueInner[2], blueColor));

        // Blue border quads (4 sides, 2 triangles each = 8 triangles)
        createBorderQuad(blueInner[0], blueInner[1], blueOuter[0], blueOuter[1], blackColor); // left
        createBorderQuad(blueInner[1], blueInner[3], blueOuter[1], blueOuter[3], blackColor); // top
        createBorderQuad(blueInner[3], blueInner[2], blueOuter[3], blueOuter[2], blackColor); // right
        createBorderQuad(blueInner[2], blueInner[0], blueOuter[2], blueOuter[0], blackColor); // bottom

        // === RED QUADRILATERAL (right side) ===
        const redInner = [
            [redBorderWidth,              this.yPlane, -quadSize/2 + redBorderWidth], // bottom-left
            [redBorderWidth,              this.yPlane,  quadSize/2 - redBorderWidth], // top-left
            [quadSize - redBorderWidth,   this.yPlane, -quadSize/2 + redBorderWidth], // bottom-right
            [quadSize - redBorderWidth,   this.yPlane,  quadSize/2 - redBorderWidth]  // top-right
        ];

        const redOuter = [
            [0,        this.yPlane, -quadSize/2], // bottom-left (shared with blue)
            [0,        this.yPlane,  quadSize/2], // top-left (shared with blue)
            [quadSize, this.yPlane, -quadSize/2], // bottom-right
            [quadSize, this.yPlane,  quadSize/2]  // top-right
        ];

        // Red fill triangles
        triangles.push(createTriangle(redInner[0], redInner[1], redInner[2], redColor));
        triangles.push(createTriangle(redInner[1], redInner[3], redInner[2], redColor));

        // Red border quads (4 sides, 2 triangles each = 8 triangles)
        createBorderQuad(redInner[0], redInner[1], redOuter[0], redOuter[1], blackColor); // left
        createBorderQuad(redInner[1], redInner[3], redOuter[1], redOuter[3], blackColor); // top
        createBorderQuad(redInner[3], redInner[2], redOuter[3], redOuter[2], blackColor); // right
        createBorderQuad(redInner[2], redInner[0], redOuter[2], redOuter[0], blackColor); // bottom

        console.log(`📊 Generated ${triangles.length} triangles:`);
        console.log(`🔷 Blue quad: 2 fill + 8 border (${blueBorderWidth} width)`);
        console.log(`🔴 Red quad: 2 fill + 8 border (${redBorderWidth} width)`);

        // Render the triangles using the generic rendering function
        this.renderTriangles(triangles);

        console.log('✅ Test triangle data generated and rendered');
    }

    /**
     * Register test event functions for the new mesh system
     * Uses different function names to avoid collision with backup system
     */
    private registerEventFunctions() {
        // Use different function names to avoid collision with backup system
        this.scene.events.function('meshTriangleOverlay.addTriangle', (v0: any, v1: any, v2: any, color: any = {x: 0, y: 1, z: 0}, fillAlpha: number = 1.0, outlineColor: any = {x: 1, y: 1, z: 1}, outlineThickness: number = 0.1, name?: string) => {
            console.log('📡 meshTriangleOverlay.addTriangle called (mesh system)');
            // TODO: Implement mesh-based triangle addition
        });

        this.scene.events.function('meshTriangleOverlay.setYPlane', (yPlane: number) => {
            console.log(`📡 meshTriangleOverlay.setYPlane called: ${yPlane}`);
            this.yPlane = yPlane;
            // TODO: Update existing triangles to new Y plane
        });

        this.scene.events.function('meshTriangleOverlay.clearTriangles', () => {
            console.log('📡 meshTriangleOverlay.clearTriangles called');
            // TODO: Clear all triangles from mesh
        });

        this.scene.events.function('meshTriangleOverlay.renderTriangles', (triangles: any[]) => {
            console.log(`📡 meshTriangleOverlay.renderTriangles called with ${triangles.length} triangles`);
            // Convert and render the triangle data using the mesh system
            this.renderTriangles(triangles);
        });

        this.scene.events.function('meshTriangleOverlay.updateYPlaneFromSplats', () => {
            this.updateYPlaneFromSplats();
        });

        this.scene.events.function('meshTriangleOverlay.calculateSplatYStatistics', () => {
            return this.calculateSplatYStatistics();
        });

        console.log('✅ Event functions registered for mesh-based system (non-conflicting names)');
    }

    /**
     * Set the Y-plane for triangle rendering
     */
    setYPlane(yPlane: number) {
        this.yPlane = yPlane;
        console.log(`🔺 Y-plane updated to ${yPlane}`);
        // TODO: Update existing triangle positions
    }

    /**
     * Check if overlay is visible and has content
     */
    isVisible(): boolean {
        return this.visible && this.triangleEntity !== null;
    }

    /**
     * Get current triangle count (for performance monitoring)
     */
    getTriangleCount(): number {
        return this.triangleEntity ? 20 : 0; // 20 triangles: 2 bordered quadrilaterals (10 each)
    }

    /**
     * Calculate Y-plane statistics from all loaded splats
     * Returns highest Y-value, 90th percentile, and 75th percentile
     */
    calculateSplatYStatistics(): { highest: number, percentile90: number, percentile75: number } | null {
        const splats = this.scene.getElementsByType(ElementType.splat) as any[];

        if (!splats || splats.length === 0) {
            return null;
        }

        const allYValues: number[] = [];
        const tempVec = new Vec3();

        // Collect all Y-values from all splats using world coordinates
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

        return { highest, percentile90, percentile75 };
    }

    /**
     * Automatically set Y-plane based on loaded splat data
     * Uses highest Y-value as default, with fallback to current value
     */
    updateYPlaneFromSplats() {
        const stats = this.calculateSplatYStatistics();

        if (!stats) {
            return;
        }

        // Use the highest Y-value plus a small safety margin to ensure triangles render clearly above all splats
        const safetyMargin = 0.1; // 10cm above highest splat
        const newYPlane = stats.highest + safetyMargin;

        this.setYPlane(newYPlane);
    }

    /**
     * Convert HSL color to RGB for triangle coloring
     */
    private hslToRgb(h: number, s: number, l: number): {r: number, g: number, b: number} {
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
}

export { MeshTriangleOverlay };