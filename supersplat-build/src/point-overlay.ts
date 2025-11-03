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
 * Supports multiple mesh layers to prevent Z-fighting between overlapping polygons
 */
class MeshTriangleOverlay extends Element {
    visible = true;
    private triangleMeshes: Mesh[] = [];
    private triangleEntities: Entity[] = [];
    private materials: StandardMaterial[] = [];
    private meshInstances: MeshInstance[] = [];
    yPlane: number = 3.5; // Default Y plane - raised off ground
    private readonly Y_PLANE_OFFSET = 0.01; // Small offset between mesh layers to prevent Z-fighting

    // Click detection properties
    private dragId: number | undefined;
    private dragMoved: boolean = false;
    private clickHandlers: { pointerdown: any, pointermove: any, pointerup: any } = { pointerdown: null, pointermove: null, pointerup: null };
    private dragStartX = 0;
    private dragStartY = 0;
    private readonly DRAG_THRESHOLD = 10; // pixels - threshold for distinguishing click from drag

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

            // Setup click detection for polygon interaction
            try {
                this.setupClickDetection();
            } catch (error) {
                console.error('❌ setupClickDetection() failed:', error);
            }

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

        } catch (error) {
            console.error('❌ TriangleOverlay initialization failed:', error);
        }
    }

    remove() {
        // Clean up click event listeners
        const canvas = this.scene.app.graphicsDevice.canvas;
        if (this.clickHandlers.pointerdown) {
            canvas.removeEventListener('pointerdown', this.clickHandlers.pointerdown);
        }
        if (this.clickHandlers.pointermove) {
            canvas.removeEventListener('pointermove', this.clickHandlers.pointermove);
        }
        if (this.clickHandlers.pointerup) {
            canvas.removeEventListener('pointerup', this.clickHandlers.pointerup);
            document.removeEventListener('pointermove', this.clickHandlers.pointermove);
            document.removeEventListener('pointerup', this.clickHandlers.pointerup);
        }

        // Clean up all mesh instances
        this.cleanupAllMeshes();
    }

    /**
     * Clean up all mesh instances, entities, meshes, and materials
     */
    private cleanupAllMeshes() {
        // Clean up mesh instances from layer
        if (this.meshInstances.length > 0) {
            this.scene.debugLayer.removeMeshInstances(this.meshInstances);
            this.meshInstances = [];
        }

        // Clean up entities
        this.triangleEntities.forEach(entity => {
            if (entity && this.scene.app.root && entity.parent === this.scene.app.root) {
                this.scene.app.root.removeChild(entity);
            }
            if (entity) {
                entity.destroy();
            }
        });
        this.triangleEntities = [];

        // Clean up meshes
        this.triangleMeshes.forEach(mesh => {
            if (mesh) {
                mesh.destroy();
            }
        });
        this.triangleMeshes = [];

        // Clean up materials
        this.materials.forEach(material => {
            if (material) {
                material.destroy();
            }
        });
        this.materials = [];
    }

    /**
     * Render multiple groups of triangles as separate meshes with Y-plane offsets
     * Groups are rendered at incrementally higher Y-planes to prevent Z-fighting
     * @param triangleGroups Array of triangle arrays - first group at base Y-plane, subsequent groups slightly higher
     */
    private renderTriangleGroups(triangleGroups: TriangleData[][]) {
        const device = this.scene.app.graphicsDevice;
        if (!device) {
            console.error('❌ Graphics device not available');
            return;
        }

        try {
            // Clean up existing meshes
            this.cleanupAllMeshes();

            // Handle empty groups case - just clear existing triangles and return
            if (triangleGroups.length === 0 || triangleGroups.every(group => group.length === 0)) {
                // Force immediate render update to clear triangles from view
                if (this.scene) {
                    this.scene.forceRender = true;
                }
                return;
            }

            // Create a separate mesh for each group
            triangleGroups.forEach((triangles, groupIndex) => {
                if (triangles.length === 0) {
                    return; // Skip empty groups
                }

                // Calculate Y-plane for this group (first group at base, subsequent groups slightly higher)
                const groupYPlane = this.yPlane + (groupIndex * this.Y_PLANE_OFFSET);

                // Create mesh for this group
                const mesh = new Mesh(device);
                const totalTriangles = triangles.length;
                const positions = new Float32Array(totalTriangles * 9);  // 3 vertices * 3 components
                const colors = new Float32Array(totalTriangles * 12);    // 3 vertices * 4 components
                const indices = new Uint16Array(totalTriangles * 3);     // 3 indices per triangle

                // Process each triangle in this group
                triangles.forEach((triangle, triangleIndex) => {
                    for (let v = 0; v < 3; v++) {
                        const vertex = triangle.vertices[v];
                        const posOffset = (triangleIndex * 3 + v) * 3;
                        const colorOffset = (triangleIndex * 3 + v) * 4;

                        // Set position with group-specific Y-plane
                        positions[posOffset + 0] = vertex[0]; // X
                        positions[posOffset + 1] = groupYPlane; // Y - use group-specific Y-plane
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
                mesh.setPositions(positions, 3);
                mesh.setColors(colors);
                mesh.setIndices(indices);

                // Calculate normals
                const normals = calculateNormals(positions, indices);
                mesh.setNormals(normals, 3);
                mesh.update();

                // Create material
                const material = new StandardMaterial();
                material.useLighting = false;
                material.emissiveVertexColor = true;
                material.emissive = new Color(1, 1, 1);
                material.blendType = BLEND_NORMAL;
                material.opacityVertexColor = true;
                material.update();

                // Create entity and mesh instance
                const entity = new Entity(`triangle-mesh-group-${groupIndex}`);
                entity.addComponent("render", {
                    type: 'box',
                });

                const meshInstance = new MeshInstance(mesh, material);
                entity.render.meshInstances = [meshInstance];

                // Add to scene
                if (this.scene.app.root) {
                    this.scene.app.root.addChild(entity);
                }

                // Store references for cleanup
                this.triangleMeshes.push(mesh);
                this.materials.push(material);
                this.triangleEntities.push(entity);
                this.meshInstances.push(meshInstance);
            });

            // Force immediate render update so triangles appear without camera movement
            if (this.scene) {
                this.scene.forceRender = true;
            }

        } catch (error) {
            console.error('❌ Error in renderTriangleGroups:', error);
        }
    }

    /**
     * Legacy function to render a single array of triangles as a mesh
     * Wraps the new renderTriangleGroups function for backward compatibility
     */
    private renderTriangles(triangles: TriangleData[]) {
        this.renderTriangleGroups([triangles]);
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
            // Convert and render the triangle data using the mesh system
            this.renderTriangles(triangles);
        });

        this.scene.events.function('meshTriangleOverlay.renderTriangleGroups', (triangleGroups: any[][]) => {
            // Convert and render multiple groups of triangle data using the layered mesh system
            this.renderTriangleGroups(triangleGroups);
        });

        this.scene.events.function('meshTriangleOverlay.updateYPlaneFromSplats', () => {
            this.updateYPlaneFromSplats();
        });

        this.scene.events.function('meshTriangleOverlay.calculateSplatYStatistics', () => {
            return this.calculateSplatYStatistics();
        });

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
        return this.visible && this.triangleEntities.length > 0;
    }

    /**
     * Get current triangle count across all mesh groups (for performance monitoring)
     */
    getTriangleCount(): number {
        let totalTriangles = 0;
        this.triangleMeshes.forEach(mesh => {
            if (mesh && mesh.indexBuffer) {
                totalTriangles += mesh.indexBuffer.getNumIndices() / 3;
            }
        });
        return totalTriangles;
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

    /**
     * Setup click detection for polygon interaction
     * Uses SuperSplat's proven click vs drag differentiation pattern
     */
    setupClickDetection() {
        const canvas = this.scene.app.graphicsDevice.canvas;

        if (!canvas) {
            console.error('❌ Canvas not available for click detection setup');
            return;
        }

        // Pointer down event - start tracking potential click
        this.clickHandlers.pointerdown = (e: PointerEvent) => {
            // SAFETY: If we have a stuck drag state, reset it (override mechanism)
            if (this.dragId !== undefined) {
                this.dragId = undefined;
                this.dragMoved = false;
            }

            // Only handle left mouse button clicks
            if (e.pointerType === 'mouse' && e.button === 0) {
                this.dragId = e.pointerId;
                this.dragMoved = false;
                this.dragStartX = e.offsetX;
                this.dragStartY = e.offsetY;
            }
        };

        // Pointer move event - detect if this is a drag using distance threshold
        this.clickHandlers.pointermove = (e: PointerEvent) => {
            if (e.pointerId === this.dragId && !this.dragMoved) {
                // Calculate distance from start position
                const deltaX = Math.abs(e.offsetX - this.dragStartX);
                const deltaY = Math.abs(e.offsetY - this.dragStartY);
                const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

                if (distance >= this.DRAG_THRESHOLD) {
                    // Drag detected
                    this.dragMoved = true;
                }
            }
        };

        // Pointer up event - process click if no drag occurred
        this.clickHandlers.pointerup = (e: PointerEvent) => {
            // Check if this is our tracked pointer
            if (e.pointerId === this.dragId) {
                // Fallback distance check in case pointermove events were missed
                if (!this.dragMoved) {
                    const deltaX = Math.abs(e.offsetX - this.dragStartX);
                    const deltaY = Math.abs(e.offsetY - this.dragStartY);
                    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

                    if (distance >= this.DRAG_THRESHOLD) {
                        this.dragMoved = true;
                    }
                }

                if (!this.dragMoved) {
                    // This is a single click - convert coordinates and pass to polygonManager
                    this.handlePolygonClick(e.offsetX, e.offsetY);
                }

                // Always reset state on pointerup
                this.dragId = undefined;
                this.dragMoved = false;
                this.dragStartX = 0;
                this.dragStartY = 0;
            }
        };

        // Add event listeners for click detection
        canvas.addEventListener('pointerdown', this.clickHandlers.pointerdown, true);
        canvas.addEventListener('pointermove', this.clickHandlers.pointermove, true);
        document.addEventListener('pointerup', this.clickHandlers.pointerup, true);
    }

    /**
     * Handle polygon click - convert screen coordinates to world coordinates and pass to polygonManager
     * This method only handles coordinate conversion, polygon finding and selection is handled by polygonManager
     */
    handlePolygonClick(screenX: number, screenY: number) {
        try {
            // Convert to world coordinates using camera ray casting
            const camera = this.scene.camera.entity.camera;
            const worldPoint = new Vec3();

            // Project screen point to world space at far clip distance
            camera.screenToWorld(screenX, screenY, camera.farClip * 0.5, worldPoint);

            // Create a ray from camera to the world point
            const cameraPos = this.scene.camera.entity.getPosition();
            const rayDirection = worldPoint.sub(cameraPos).normalize();

            // Intersect ray with Y-plane to get world coordinates
            if (Math.abs(rayDirection.y) < 0.0001) {
                console.warn('⚠️ Ray is nearly parallel to Y-plane, cannot intersect');
                return;
            }

            const t = (this.yPlane - cameraPos.y) / rayDirection.y;
            const worldIntersection = new Vec3(
                cameraPos.x + rayDirection.x * t,
                this.yPlane,
                cameraPos.z + rayDirection.z * t
            );

            // Check for SuperSplatBridge in current window first, then parent window (iframe context)
            let polygonManager = null;
            if (window.superSplatBridge && window.superSplatBridge.polygonManager) {
                polygonManager = window.superSplatBridge.polygonManager;
            } else if (window.parent && window.parent.superSplatBridge && window.parent.superSplatBridge.polygonManager) {
                polygonManager = window.parent.superSplatBridge.polygonManager;
            }

            if (polygonManager) {
                polygonManager.handlePolygonClickAtWorldPoint(worldIntersection, {
                    screenX,
                    screenY
                });
            } else {
                console.warn('⚠️ SuperSplatBridge or PolygonManager not available');
            }

        } catch (error) {
            console.error('❌ Error in handlePolygonClick:', error);
        }
    }
}

export { MeshTriangleOverlay };