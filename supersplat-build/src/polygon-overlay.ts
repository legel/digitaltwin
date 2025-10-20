import {
    BLEND_NORMAL,
    BUFFER_STATIC,
    CULLFACE_NONE,
    PRIMITIVE_TRIANGLES,
    PRIMITIVE_LINES,
    SEMANTIC_POSITION,
    TYPE_FLOAT32,
    TYPE_UINT16,
    BoundingBox,
    Color,
    Entity,
    IndexBuffer,
    Material,
    Mesh,
    MeshInstance,
    StandardMaterial,
    Vec3,
    VertexBuffer,
    VertexFormat
} from 'playcanvas';

import { Element, ElementType } from './element';
import { Events } from './events';

interface GeoJSONFeature {
    type: string;
    properties: {
        name: string;
        description?: string;
        [key: string]: any;
    };
    geometry: {
        type: string;
        coordinates: number[][][];
    };
}

interface GeoJSONData {
    type: string;
    features: GeoJSONFeature[];
}

interface LayerState {
    showPlantableAreas?: boolean;
    showNonPlantableAreas?: boolean;
    selectedGroup?: string;
    selectedGroupType?: 'PA' | 'NPA' | 'METRIC';
    selectedPolygons?: string[];
}

/**
 * PolygonOverlay Element for rendering terrain polygons in SuperSplat
 * Provides native SuperSplat integration for GeoJSON polygon visualization
 */
class PolygonOverlay extends Element {
    private polygonMeshInstances: MeshInstance[] = [];
    private outlineMeshInstances: MeshInstance[] = [];
    private testPointMeshInstance: MeshInstance | null = null;
    private currentGeoJsonData: GeoJSONData | null = null;
    private currentLayerState: LayerState = {};

    // Materials for different polygon types
    private plantableMaterial: StandardMaterial;
    private nonPlantableMaterial: StandardMaterial;
    private selectedMaterial: StandardMaterial;
    private outlineMaterial: StandardMaterial;

    // Coordinate transformation parameters
    private worldBounds: {
        minLat: number;
        maxLat: number;
        minLon: number;
        maxLon: number;
    } | null = null;

    // World scale factor for coordinate conversion
    private readonly WORLD_SCALE = 100; // Adjust based on SuperSplat scene scale

    constructor() {
        super(ElementType.other);
    }

    /**
     * Creates materials for different polygon types and states
     */
    private createMaterials(): void {
        const device = this.scene?.app?.graphicsDevice;
        if (!device) {
            console.error('❌ GraphicsDevice not available for material creation');
            return;
        }


        // Plantable area material (transparent blue)
        this.plantableMaterial = new StandardMaterial();
        this.plantableMaterial.name = 'PolygonOverlay-Plantable';
        this.plantableMaterial.diffuse = new Color(0.03, 0.17, 0.18, 1.0); // Solid color first
        this.plantableMaterial.opacity = 0.3; // Set opacity separately
        this.plantableMaterial.blendType = BLEND_NORMAL;
        this.plantableMaterial.cull = CULLFACE_NONE; // Double-sided
        this.plantableMaterial.update();

        // Non-plantable area material (transparent red)
        this.nonPlantableMaterial = new StandardMaterial();
        this.nonPlantableMaterial.name = 'PolygonOverlay-NonPlantable';
        this.nonPlantableMaterial.diffuse = new Color(1.0, 0.0, 0.0, 1.0);
        this.nonPlantableMaterial.opacity = 0.2;
        this.nonPlantableMaterial.blendType = BLEND_NORMAL;
        this.nonPlantableMaterial.cull = CULLFACE_NONE;
        this.nonPlantableMaterial.update();

        // Selected polygon material (more opaque)
        this.selectedMaterial = new StandardMaterial();
        this.selectedMaterial.name = 'PolygonOverlay-Selected';
        this.selectedMaterial.diffuse = new Color(0.03, 0.17, 0.18, 1.0);
        this.selectedMaterial.opacity = 0.6;
        this.selectedMaterial.blendType = BLEND_NORMAL;
        this.selectedMaterial.cull = CULLFACE_NONE;
        this.selectedMaterial.update();

        // Outline material (solid color lines)
        this.outlineMaterial = new StandardMaterial();
        this.outlineMaterial.name = 'PolygonOverlay-Outline';
        this.outlineMaterial.diffuse = new Color(0.03, 0.17, 0.18, 1.0); // Solid Ecodash blue
        this.outlineMaterial.update();

    }

    /**
     * Initialize the PolygonOverlay element
     */
    add(): void {
        if (!this.scene) return;


        // Create materials now that scene is available
        this.createMaterials();

        // Register terrain-3d bridge functions in SuperSplat event system
        this.registerTerrainBridgeFunctions();

        // Listen for terrain-3d events
        this.setupEventListeners();

        // Initial render if data is already available
        this.tryInitialRender();
    }

    /**
     * Register functions to bridge terrain-3d data to SuperSplat
     */
    private registerTerrainBridgeFunctions(): void {
        const events = this.scene.events;

        // Function to update polygons from terrain-3d
        events.function('polygonOverlay.updateFromTerrain', (geoJsonData: GeoJSONData, layerState: LayerState) => {
            this.updateFromGeoJSON(geoJsonData, layerState);
        });

        // Function to update layer visibility
        events.function('polygonOverlay.updateLayers', (layerState: LayerState) => {
            this.updateLayerState(layerState);
        });

        // Function to clear all polygons
        events.function('polygonOverlay.clear', () => {
            this.clearPolygons();
        });

        // Function to render a test point at fixed location
        events.function('polygonOverlay.renderTestPoint', (worldPosition: Vec3) => {
            this.renderTestPoint(worldPosition);
        });

    }

    /**
     * Set up event listeners for SuperSplat events
     */
    private setupEventListeners(): void {
        const events = this.scene.events;

        // Listen for camera changes to potentially adjust polygon positioning
        events.on('camera.changed', () => {
            // Future: Update polygon LOD or visibility based on camera distance
        });

        // Listen for scene bounds changes
        events.on('scene.boundChanged', () => {
            // Future: Reposition polygons if scene bounds change
        });
    }

    /**
     * Try to render polygons if terrain-3d data is already available
     */
    private tryInitialRender(): void {
        // Check if terrain-3d data is available in global scope
        if (typeof window !== 'undefined') {
            const terrainData = (window as any).currentSiteData;
            const layerState = (window as any).layerState;

            if (terrainData && layerState) {
                console.log('🎯 Found existing terrain-3d data, rendering polygons');
                this.updateFromGeoJSON(terrainData, layerState);
            }
        }
    }

    /**
     * Update polygons from GeoJSON data
     */
    updateFromGeoJSON(geoJsonData: GeoJSONData, layerState: LayerState = {}): void {
        // Add safety checks
        if (!this.scene || !this.scene.app || !this.scene.overlayLayer) {
            console.warn('⚠️ PolygonOverlay scene not properly initialized, skipping update');
            return;
        }

        if (!this.plantableMaterial || !this.outlineMaterial) {
            console.warn('⚠️ PolygonOverlay materials not ready, skipping update');
            return;
        }

        console.log('🎨 PolygonOverlay updating from GeoJSON data', {
            features: geoJsonData.features.length,
            layerState
        });

        this.currentGeoJsonData = geoJsonData;
        this.currentLayerState = { ...layerState };

        // Clear existing polygons
        this.clearPolygons();

        // Calculate world bounds from GeoJSON data
        this.calculateWorldBounds(geoJsonData);

        // Render polygons based on current layer state
        this.renderPolygons(geoJsonData, layerState);
    }

    /**
     * Update layer visibility state
     */
    updateLayerState(layerState: LayerState): void {
        this.currentLayerState = { ...layerState };

        if (this.currentGeoJsonData) {
            this.renderPolygons(this.currentGeoJsonData, layerState);
        }
    }

    /**
     * Calculate world bounds from GeoJSON data for coordinate conversion
     */
    private calculateWorldBounds(geoJsonData: GeoJSONData): void {
        let minLat = Infinity, maxLat = -Infinity;
        let minLon = Infinity, maxLon = -Infinity;

        geoJsonData.features.forEach(feature => {
            if (feature.geometry.type === 'Polygon') {
                feature.geometry.coordinates[0].forEach(coord => {
                    const [lon, lat] = coord;
                    minLat = Math.min(minLat, lat);
                    maxLat = Math.max(maxLat, lat);
                    minLon = Math.min(minLon, lon);
                    maxLon = Math.max(maxLon, lon);
                });
            }
        });

        this.worldBounds = { minLat, maxLat, minLon, maxLon };

        console.log('🗺️ PolygonOverlay calculated world bounds:', this.worldBounds);
    }

    /**
     * Convert geographic coordinates (lat/lon) to PlayCanvas world coordinates
     */
    private geoToWorld(lon: number, lat: number, elevation: number = 0): Vec3 {
        if (!this.worldBounds) {
            return new Vec3(0, elevation, 0);
        }

        const bounds = this.worldBounds;

        // Normalize coordinates to 0-1 range
        const normalizedX = (lon - bounds.minLon) / (bounds.maxLon - bounds.minLon);
        const normalizedZ = (lat - bounds.minLat) / (bounds.maxLat - bounds.minLat);

        // Convert to world coordinates (center around origin)
        const worldX = (normalizedX - 0.5) * this.WORLD_SCALE;
        const worldZ = (normalizedZ - 0.5) * this.WORLD_SCALE;

        return new Vec3(worldX, elevation, worldZ);
    }

    /**
     * Render polygons based on GeoJSON data and layer state
     */
    private renderPolygons(geoJsonData: GeoJSONData, layerState: LayerState): void {
        if (!this.scene?.app?.graphicsDevice) return;

        const device = this.scene.app.graphicsDevice;
        let renderedCount = 0;

        geoJsonData.features.forEach((feature, index) => {
            if (feature.geometry.type !== 'Polygon') return;

            // Determine polygon type and visibility
            const isPlantable = this.isPlantableFeature(feature);
            const shouldRender = this.shouldRenderFeature(feature, layerState, isPlantable);

            if (!shouldRender) return;

            try {
                // Create polygon mesh and outline
                const polygonMesh = this.createPolygonMesh(feature, device);
                const outlineMesh = this.createOutlineMesh(feature, device);

                // Validate meshes before creating instances
                if (polygonMesh && polygonMesh.vertexBuffer && outlineMesh && outlineMesh.vertexBuffer) {
                    // Determine material based on selection state
                    const material = this.getMaterialForFeature(feature, layerState, isPlantable);

                    // Validate materials
                    if (!material || !this.outlineMaterial) {
                        console.warn('⚠️ Materials not ready, skipping polygon:', feature.properties.name);
                        return; // Use return instead of continue in forEach
                    }

                    // Create mesh instances with validation
                    const polygonInstance = new MeshInstance(polygonMesh, material);
                    const outlineInstance = new MeshInstance(outlineMesh, this.outlineMaterial);

                    // Validate mesh instances before adding
                    if (polygonInstance && outlineInstance && polygonInstance.aabb && outlineInstance.aabb) {
                        // Store references for cleanup
                        this.polygonMeshInstances.push(polygonInstance);
                        this.outlineMeshInstances.push(outlineInstance);

                        // Add to scene
                        this.scene.overlayLayer.addMeshInstances([polygonInstance, outlineInstance]);

                        renderedCount++;
                    } else {
                        console.warn('⚠️ Invalid mesh instances created, skipping polygon:', feature.properties.name);
                        // Clean up invalid meshes
                        polygonMesh?.destroy?.();
                        outlineMesh?.destroy?.();
                    }
                } else {
                    console.warn('⚠️ Invalid meshes created, skipping polygon:', feature.properties.name);
                }
            } catch (error) {
                console.error('❌ Error creating polygon meshes:', error, feature.properties.name);
            }
        });

        console.log(`✅ PolygonOverlay rendered ${renderedCount} polygons on overlayLayer`);
    }

    /**
     * Render a simple test point at the specified world position
     */
    private renderTestPoint(worldPosition: Vec3): void {
        if (!this.scene?.app?.graphicsDevice || !this.scene.overlayLayer) {
            console.warn('⚠️ PolygonOverlay scene not properly initialized for test point');
            return;
        }

        console.log('🎯 Rendering test point at:', worldPosition);

        // Clear existing test point
        this.clearTestPoint();

        // Create a simple sphere mesh for the test point
        const device = this.scene.app.graphicsDevice;
        const testPointMesh = this.createSphereMesh(device, 2.0); // Much larger - 2.0 unit radius

        if (!testPointMesh) {
            console.error('❌ Failed to create test point mesh');
            return;
        }

        // Create bright red material for visibility
        const testPointMaterial = new StandardMaterial();
        testPointMaterial.name = 'PolygonOverlay-TestPoint';
        testPointMaterial.diffuse = new Color(1.0, 0.0, 0.0, 1.0); // Bright red
        testPointMaterial.emissive = new Color(0.2, 0.0, 0.0, 1.0); // Slight glow
        testPointMaterial.update();

        // Create entity to hold the mesh instance for proper positioning
        const testPointEntity = new Entity('test-point');
        testPointEntity.setLocalPosition(worldPosition.x, worldPosition.y, worldPosition.z);

        // Create mesh instance
        this.testPointMeshInstance = new MeshInstance(testPointMesh, testPointMaterial);

        // Set the entity's transform matrix for the mesh instance
        this.testPointMeshInstance.node = testPointEntity;

        // Add to overlay layer
        this.scene.overlayLayer.addMeshInstances([this.testPointMeshInstance]);

        console.log('✅ Test point rendered successfully on overlay layer');
    }

    /**
     * Create a simple cube mesh for test point rendering (easier than sphere)
     */
    private createSphereMesh(device: any, radius: number): Mesh | null {
        try {
            // Create a simple cube instead of sphere to avoid complex geometry issues
            const size = radius;
            const vertices = new Float32Array([
                // Front face
                -size, -size,  size,
                 size, -size,  size,
                 size,  size,  size,
                -size,  size,  size,

                // Back face
                -size, -size, -size,
                -size,  size, -size,
                 size,  size, -size,
                 size, -size, -size,

                // Top face
                -size,  size, -size,
                -size,  size,  size,
                 size,  size,  size,
                 size,  size, -size,

                // Bottom face
                -size, -size, -size,
                 size, -size, -size,
                 size, -size,  size,
                -size, -size,  size,

                // Right face
                 size, -size, -size,
                 size,  size, -size,
                 size,  size,  size,
                 size, -size,  size,

                // Left face
                -size, -size, -size,
                -size, -size,  size,
                -size,  size,  size,
                -size,  size, -size
            ]);

            const indices = new Uint16Array([
                0,  1,  2,    0,  2,  3,    // front
                4,  5,  6,    4,  6,  7,    // back
                8,  9, 10,    8, 10, 11,    // top
               12, 13, 14,   12, 14, 15,    // bottom
               16, 17, 18,   16, 18, 19,    // right
               20, 21, 22,   20, 22, 23     // left
            ]);

            // Create vertex format
            const vertexFormat = new VertexFormat(device, [{
                semantic: SEMANTIC_POSITION,
                components: 3,
                type: TYPE_FLOAT32
            }]);

            // Create vertex buffer
            const vertexBuffer = new VertexBuffer(device, vertexFormat, vertices.length / 3, {
                usage: BUFFER_STATIC,
                data: vertices.buffer
            });

            // Create index buffer
            const indexBuffer = new IndexBuffer(device, TYPE_UINT16, indices.length, BUFFER_STATIC, indices.buffer);

            // Create mesh
            const mesh = new Mesh(device);
            mesh.vertexBuffer = vertexBuffer;
            mesh.indexBuffer = [indexBuffer];
            mesh.primitive[0] = {
                type: PRIMITIVE_TRIANGLES,
                base: 0,
                baseVertex: 0,
                count: indices.length,
                indexed: true
            };

            // Set AABB
            const aabb = new BoundingBox();
            aabb.setMinMax(
                new Vec3(-size, -size, -size),
                new Vec3(size, size, size)
            );
            mesh.aabb = aabb;

            return mesh;
        } catch (error) {
            console.error('❌ Error creating cube mesh:', error);
            return null;
        }
    }

    /**
     * Clear the test point mesh instance
     */
    private clearTestPoint(): void {
        if (this.testPointMeshInstance && this.scene?.overlayLayer) {
            this.scene.overlayLayer.removeMeshInstances([this.testPointMeshInstance]);

            if (this.testPointMeshInstance.mesh) {
                this.testPointMeshInstance.mesh.destroy();
            }

            this.testPointMeshInstance = null;
        }
    }

    /**
     * Create a triangulated mesh for polygon fill
     */
    private createPolygonMesh(feature: GeoJSONFeature, device: any): Mesh | null {
        try {
            const coordinates = feature.geometry.coordinates[0];
            if (!coordinates || coordinates.length < 3) {
                console.warn('⚠️ Insufficient coordinates for polygon:', feature.properties.name);
                return null;
            }

            // Convert geographic coordinates to world positions
            const vertices: Vec3[] = [];
            coordinates.forEach(coord => {
                if (coord.length >= 2) {
                    const [lon, lat, elevation = 0] = coord;
                    const worldPos = this.geoToWorld(lon, lat, elevation);
                    vertices.push(worldPos);
                }
            });

            if (vertices.length < 3) {
                console.warn('⚠️ Insufficient vertices for polygon:', feature.properties.name);
                return null;
            }

            // Create vertex data for triangulated polygon
            const vertexData = this.triangulatePolygon(vertices);
            if (!vertexData || vertexData.length === 0 || vertexData.length < 9) {
                console.warn('⚠️ Invalid triangulation data for polygon:', feature.properties.name);
                return null;
            }

            // Create vertex buffer
            const vertexFormat = new VertexFormat(device, [{
                semantic: SEMANTIC_POSITION,
                components: 3,
                type: TYPE_FLOAT32
            }]);

            const vertexCount = vertexData.length / 3;
            if (vertexCount <= 0) {
                console.warn('⚠️ Invalid vertex count for polygon:', feature.properties.name);
                return null;
            }

            const vertexBuffer = new VertexBuffer(device, vertexFormat, vertexCount, {
                usage: BUFFER_STATIC,
                data: new Float32Array(vertexData).buffer
            });

            // Create mesh
            const mesh = new Mesh(device);
            mesh.vertexBuffer = vertexBuffer;
            mesh.primitive[0] = {
                type: PRIMITIVE_TRIANGLES,
                base: 0,
                baseVertex: 0,
                count: vertexCount
            };

            return mesh;
        } catch (error) {
            console.error('❌ Error creating polygon mesh:', error, feature.properties.name);
            return null;
        }
    }

    /**
     * Create a line mesh for polygon outline
     */
    private createOutlineMesh(feature: GeoJSONFeature, device: any): Mesh | null {
        try {
            const coordinates = feature.geometry.coordinates[0];
            if (!coordinates || coordinates.length < 3) {
                console.warn('⚠️ Insufficient coordinates for outline:', feature.properties.name);
                return null;
            }

            // Convert geographic coordinates to world positions
            const vertices: number[] = [];
            coordinates.forEach(coord => {
                if (coord.length >= 2) {
                    const [lon, lat, elevation = 0] = coord;
                    const worldPos = this.geoToWorld(lon, lat, elevation);
                    vertices.push(worldPos.x, worldPos.y, worldPos.z);
                }
            });

            if (vertices.length < 9) {
                console.warn('⚠️ Insufficient vertices for outline:', feature.properties.name);
                return null; // Need at least 3 vertices
            }

            // Create line indices (connect each vertex to the next, and last to first)
            const indices: number[] = [];
            const numVertices = vertices.length / 3;
            for (let i = 0; i < numVertices - 1; i++) {
                indices.push(i, i + 1);
            }
            // Close the polygon
            if (numVertices > 2) {
                indices.push(numVertices - 1, 0);
            }

            if (indices.length === 0) {
                console.warn('⚠️ No indices generated for outline:', feature.properties.name);
                return null;
            }

            // Create vertex buffer
            const vertexFormat = new VertexFormat(device, [{
                semantic: SEMANTIC_POSITION,
                components: 3,
                type: TYPE_FLOAT32
            }]);

            const vertexBuffer = new VertexBuffer(device, vertexFormat, numVertices, {
                usage: BUFFER_STATIC,
                data: new Float32Array(vertices).buffer
            });

            // Create mesh
            const mesh = new Mesh(device);
            mesh.vertexBuffer = vertexBuffer;

            // Create index buffer
            const indexBuffer = new IndexBuffer(device, TYPE_UINT16, indices.length, BUFFER_STATIC, new Uint16Array(indices).buffer);

            mesh.indexBuffer = [indexBuffer];
            mesh.primitive[0] = {
                type: PRIMITIVE_LINES,
                base: 0,
                baseVertex: 0,
                count: indices.length,
                indexed: true
            };

            return mesh;
        } catch (error) {
            console.error('❌ Error creating outline mesh:', error, feature.properties.name);
            return null;
        }
    }

    /**
     * Simple ear clipping triangulation for polygon
     */
    private triangulatePolygon(vertices: Vec3[]): number[] {
        if (vertices.length < 3) return [];

        // For now, use simple fan triangulation (works for convex polygons)
        // TODO: Implement proper ear clipping for concave polygons
        const triangleData: number[] = [];

        for (let i = 1; i < vertices.length - 1; i++) {
            const v0 = vertices[0];
            const v1 = vertices[i];
            const v2 = vertices[i + 1];

            // Add triangle vertices
            triangleData.push(v0.x, v0.y, v0.z);
            triangleData.push(v1.x, v1.y, v1.z);
            triangleData.push(v2.x, v2.y, v2.z);
        }

        return triangleData;
    }

    /**
     * Determine if feature is a plantable area
     */
    private isPlantableFeature(feature: GeoJSONFeature): boolean {
        // Boyd format detection
        const name = feature.properties.name || '';
        if (name.includes('PA') && name.includes('=')) {
            return true; // Boyd plantable area
        }

        // Legacy format detection
        if (name.includes('plantable') || name.includes('Plantable')) {
            return true;
        }

        return false;
    }

    /**
     * Determine if feature should be rendered based on layer state
     */
    private shouldRenderFeature(feature: GeoJSONFeature, layerState: LayerState, isPlantable: boolean): boolean {
        if (isPlantable) {
            return layerState.showPlantableAreas || layerState.selectedGroupType === 'METRIC';
        } else {
            return layerState.showNonPlantableAreas;
        }
    }

    /**
     * Get appropriate material for feature based on state
     */
    private getMaterialForFeature(feature: GeoJSONFeature, layerState: LayerState, isPlantable: boolean): StandardMaterial {
        // Check if this feature is selected
        const name = feature.properties.name || '';
        const isSelected = (isPlantable && name.includes(layerState.selectedPA || '')) ||
                          (!isPlantable && name.includes(layerState.selectedNPA || ''));

        if (isSelected) {
            return this.selectedMaterial;
        }

        return isPlantable ? this.plantableMaterial : this.nonPlantableMaterial;
    }

    /**
     * Clear all existing polygon mesh instances
     */
    private clearPolygons(): void {
        if (!this.scene?.overlayLayer) return;

        // Remove mesh instances from layer
        this.scene.overlayLayer.removeMeshInstances([
            ...this.polygonMeshInstances,
            ...this.outlineMeshInstances
        ]);

        // Destroy meshes to free memory
        [...this.polygonMeshInstances, ...this.outlineMeshInstances].forEach(instance => {
            if (instance.mesh) {
                instance.mesh.destroy();
            }
        });

        // Clear arrays
        this.polygonMeshInstances = [];
        this.outlineMeshInstances = [];
    }

    /**
     * Clean up when element is removed
     */
    remove(): void {
        console.log('🔄 Cleaning up PolygonOverlay element');
        this.clearPolygons();
        this.clearTestPoint();
    }

    /**
     * Destroy the element and clean up resources
     */
    destroy(): void {
        this.clearPolygons();

        // Destroy materials
        [this.plantableMaterial, this.nonPlantableMaterial, this.selectedMaterial, this.outlineMaterial]
            .forEach(material => material?.destroy());

        super.destroy();
    }

    /**
     * Update called each frame
     */
    onPreRender(): void {
        // Future: Handle per-frame updates like animations or LOD
    }
}

export { PolygonOverlay };