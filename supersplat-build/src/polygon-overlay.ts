import {
    BLEND_NORMAL,
    BUFFER_STATIC,
    CULLFACE_NONE,
    PRIMITIVE_TRIANGLES,
    PRIMITIVE_LINES,
    SEMANTIC_POSITION,
    TYPE_FLOAT32,
    TYPE_UINT16,
    Color,
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
    private currentGeoJsonData: GeoJSONData | null = null;
    private currentLayerState: LayerState = {};

    // Materials for different polygon types
    private plantableMaterial: StandardMaterial;
    private nonPlantableMaterial: StandardMaterial;
    private selectedMaterial: StandardMaterial;
    private outlineMaterial: StandardMaterial;


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


        this.currentGeoJsonData = geoJsonData;
        this.currentLayerState = { ...layerState };

        // Clear existing polygons
        this.clearPolygons();

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

            // NOTE: This polygon-overlay.ts is unused by terrain-3d
            // terrain-3d uses coordinateTransform.js and superSplatBridge.js instead
            // This method should not be called in the current architecture
            console.warn('⚠️ polygon-overlay.ts createPolygonMesh called - this should use coordinateTransform.js instead');
            return null;

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

            // NOTE: This polygon-overlay.ts is unused by terrain-3d
            // terrain-3d uses coordinateTransform.js and superSplatBridge.js instead
            console.warn('⚠️ polygon-overlay.ts createOutlineMesh called - this should use coordinateTransform.js instead');
            return null;

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
        // Check if this feature is in the selected polygons list
        const name = feature.properties.name || '';
        const isSelected = layerState.selectedPolygons?.includes(name) || false;

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
        this.clearPolygons();
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

}

export { PolygonOverlay };