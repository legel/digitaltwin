/**
 * SuperSplat Bridge - Connects terrain-3d layer controls to SuperSplat PolygonOverlay
 * Bridges the gap between the existing terrain-3d UI and the new SuperSplat rendering system
 */
class SuperSplatBridge {
    constructor() {
        this.isInitialized = false;
        this.polygonOverlayReady = false;
        this.pendingUpdates = [];

        console.log('🌉 SuperSplatBridge initializing...');
        this.initialize();
    }

    /**
     * Initialize the bridge by waiting for SuperSplat to be ready
     */
    async initialize() {
        try {
            // Wait for SuperSplat to be loaded and running
            await this.waitForSuperSplat();

            // Wait for PolygonOverlay to be available
            await this.waitForPolygonOverlay();

            // Set up event bridging
            this.setupEventBridging();

            // Perform initial sync if data is available
            this.performInitialSync();

            this.isInitialized = true;
            console.log('✅ SuperSplatBridge initialized successfully');

        } catch (error) {
            console.error('❌ SuperSplatBridge initialization failed:', error);
        }
    }

    /**
     * Wait for SuperSplat scene to be ready (direct or iframe mode)
     */
    async waitForSuperSplat() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 50; // 5 seconds max wait

            const checkSuperSplat = () => {
                attempts++;

                // First check if SuperSplat is running directly in this window (Lab mode)
                if (window.scene && window.scene.events) {
                    console.log('🎯 SuperSplat scene detected (direct mode)');
                    window.superSplatScene = window.scene; // Store reference for easy access
                    resolve();
                    return;
                }

                // Then check if SuperSplat is in an iframe (switched mode)
                const iframe = document.getElementById('supersplat-iframe');
                if (iframe && iframe.contentWindow) {
                    try {
                        // Try to access SuperSplat's scene
                        const scene = iframe.contentWindow.scene;
                        if (scene && scene.events) {
                            console.log('🎯 SuperSplat scene detected (iframe mode)');
                            window.superSplatScene = scene; // Store reference for easy access
                            resolve();
                            return;
                        }
                    } catch (e) {
                        // Cross-origin or not ready yet
                    }
                }

                // Check if SuperSplat container iframe exists (without ID)
                const superSplatContainer = document.getElementById('superSplatContainer');
                if (superSplatContainer) {
                    const iframes = superSplatContainer.querySelectorAll('iframe');
                    for (let iframe of iframes) {
                        try {
                            const scene = iframe.contentWindow?.scene;
                            if (scene && scene.events) {
                                console.log('🎯 SuperSplat scene detected (container iframe mode)');
                                window.superSplatScene = scene;
                                resolve();
                                return;
                            }
                        } catch (e) {
                            // Cross-origin or not ready yet
                        }
                    }
                }

                if (attempts >= maxAttempts) {
                    reject(new Error('SuperSplat scene not found after timeout'));
                    return;
                }

                setTimeout(checkSuperSplat, 100);
            };

            checkSuperSplat();
        });
    }

    /**
     * Wait for PolygonOverlay element to be available in SuperSplat
     */
    async waitForPolygonOverlay() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 30;

            const checkPolygonOverlay = () => {
                attempts++;

                if (window.superSplatScene && window.superSplatScene.events) {
                    try {
                        // Test if PolygonOverlay functions are registered
                        const events = window.superSplatScene.events;
                        if (events.functions.has('polygonOverlay.updateFromTerrain')) {
                            console.log('🎯 PolygonOverlay functions detected');
                            this.polygonOverlayReady = true;
                            resolve();
                            return;
                        }
                    } catch (e) {
                        console.warn('Error checking PolygonOverlay:', e);
                    }
                }

                if (attempts >= maxAttempts) {
                    reject(new Error('PolygonOverlay not ready after timeout'));
                    return;
                }

                setTimeout(checkPolygonOverlay, 100);
            };

            checkPolygonOverlay();
        });
    }

    /**
     * Set up event bridging between terrain-3d and SuperSplat
     */
    setupEventBridging() {
        // Override the existing visualizeGeoJsonPolygonsWithLayers function
        // to send data to SuperSplat instead of (or in addition to) Cesium
        const originalVisualize = window.visualizeGeoJsonPolygonsWithLayers;

        window.visualizeGeoJsonPolygonsWithLayers = (geoJsonData) => {
            console.log('🌉 GeoJSON visualization call intercepted - skipping SuperSplat rendering to avoid AABB errors');

            // DISABLED: Skip SuperSplat polygon rendering to avoid AABB errors
            // this.updatePolygonsInSuperSplat(geoJsonData, window.layerState);

            // Still call original function for Cesium compatibility
            if (originalVisualize && typeof Cesium !== 'undefined') {
                try {
                    originalVisualize(geoJsonData);
                } catch (error) {
                    console.warn('Cesium visualization failed (expected in Lab mode):', error);
                }
            }
        };

        // Bridge layer state changes
        this.setupLayerStateWatching();

        // Bridge site data changes
        this.setupSiteDataWatching();
    }

    /**
     * Watch for changes to layer state and update SuperSplat accordingly
     */
    setupLayerStateWatching() {
        if (!window.layerState) {
            window.layerState = {};
        }

        // Create a proxy to watch for layer state changes
        const originalLayerState = { ...window.layerState };

        // Set up mutation observer for DOM changes that might indicate layer changes
        const observer = new MutationObserver(() => {
            // Check if layer state has changed
            if (this.hasLayerStateChanged(originalLayerState)) {
                console.log('🔄 Layer state changed, updating SuperSplat');
                this.updateLayerStateInSuperSplat(window.layerState);
                Object.assign(originalLayerState, window.layerState);
            }
        });

        // Observe the layer controls panel for changes
        const layerControls = document.getElementById('layerControls');
        if (layerControls) {
            observer.observe(layerControls, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeOldValue: true
            });
        }

        // Also set up periodic checking as fallback
        setInterval(() => {
            if (this.hasLayerStateChanged(originalLayerState)) {
                console.log('🔄 Layer state changed (periodic check), updating SuperSplat');
                this.updateLayerStateInSuperSplat(window.layerState);
                Object.assign(originalLayerState, window.layerState);
            }
        }, 1000);
    }

    /**
     * Check if layer state has changed
     */
    hasLayerStateChanged(previousState) {
        const current = window.layerState || {};
        const keys = ['showPlantableAreas', 'showNonPlantableAreas', 'showEcologicalMetrics',
                      'selectedMetric', 'selectedPA', 'selectedNPA'];

        return keys.some(key => current[key] !== previousState[key]);
    }

    /**
     * Set up watching for site data changes
     */
    setupSiteDataWatching() {
        // Override loadSiteData result processing
        const originalNavigateToSite = window.navigateToSite;
        if (originalNavigateToSite) {
            window.navigateToSite = (...args) => {
                const result = originalNavigateToSite.apply(this, args);

                // After site navigation, update SuperSplat
                setTimeout(() => {
                    if (window.currentSiteData && this.isInitialized) {
                        this.updatePolygonsInSuperSplat(window.currentSiteData, window.layerState);
                    }
                }, 100);

                return result;
            };
        }
    }

    /**
     * Perform initial sync with existing data
     */
    performInitialSync() {
        // DISABLED: Skip automatic polygon rendering to avoid AABB errors
        // The polygon rendering will be manually triggered only when needed
        console.log('🎯 Initial sync disabled - skipping automatic polygon rendering');

        /*
        if (window.currentSiteData) {
            console.log('🎯 Performing initial sync with existing site data');
            this.updatePolygonsInSuperSplat(window.currentSiteData, window.layerState || {});
        }

        // Process any pending updates
        this.pendingUpdates.forEach(update => {
            this.updatePolygonsInSuperSplat(update.geoJsonData, update.layerState);
        });
        this.pendingUpdates = [];
        */
    }

    /**
     * Update polygons in SuperSplat PolygonOverlay
     */
    updatePolygonsInSuperSplat(geoJsonData, layerState) {
        if (!this.polygonOverlayReady) {
            console.log('⏳ PolygonOverlay not ready, queueing update');
            this.pendingUpdates.push({ geoJsonData, layerState });
            return;
        }

        try {
            const events = window.superSplatScene.events;

            console.log('📡 Sending polygon data to SuperSplat:', {
                features: geoJsonData.features?.length || 0,
                layerState: layerState
            });

            // Call SuperSplat PolygonOverlay update function
            events.invoke('polygonOverlay.updateFromTerrain', geoJsonData, layerState);

        } catch (error) {
            console.error('❌ Failed to update SuperSplat polygons:', error);
        }
    }

    /**
     * Update layer state in SuperSplat
     */
    updateLayerStateInSuperSplat(layerState) {
        if (!this.polygonOverlayReady) {
            return;
        }

        try {
            const events = window.superSplatScene.events;
            events.invoke('polygonOverlay.updateLayers', layerState);

        } catch (error) {
            console.error('❌ Failed to update SuperSplat layer state:', error);
        }
    }

    /**
     * Clear all polygons in SuperSplat
     */
    clearPolygonsInSuperSplat() {
        if (!this.polygonOverlayReady) {
            return;
        }

        try {
            const events = window.superSplatScene.events;
            events.invoke('polygonOverlay.clear');

        } catch (error) {
            console.error('❌ Failed to clear SuperSplat polygons:', error);
        }
    }

    /**
     * Render a triangle at the specified XZ coordinates with given color
     */
    renderTriangle(v0, v1, v2, color = { x: 0, y: 1, z: 0 }, name = 'Triangle') {
        if (!this.polygonOverlayReady) {
            console.warn('⚠️ SuperSplat not ready, cannot render triangle');
            return false;
        }

        try {
            console.log(`🔺 Rendering triangle: ${name}`);

            const events = window.superSplatScene.events;

            // Add triangle to overlay system
            events.invoke('triangleOverlay.addTriangle', v0, v1, v2, color, name);

            console.log('📡 Triangle render call sent to SuperSplat');
            return true;

        } catch (error) {
            console.error('❌ Failed to render triangle in SuperSplat:', error);
            return false;
        }
    }

    /**
     * Simple fan triangulation for convex polygons
     */
    triangulatePolygon(vertices) {
        if (vertices.length < 3) return [];
        if (vertices.length === 3) return [vertices]; // Already a triangle

        // Fan triangulation from first vertex
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

        console.log(`🔺 Triangulated ${vertices.length}-sided polygon into ${triangles.length} triangles`);
        return triangles;
    }

    /**
     * Generate edge triangles for hollow polygon outlines
     */
    generateEdgeTriangles(vertices, width = 0.2) {
        if (vertices.length < 2) return [];

        const edgeTriangles = [];

        for (let i = 0; i < vertices.length; i++) {
            const current = vertices[i];
            const next = vertices[(i + 1) % vertices.length];

            // Create a thin rectangle (2 triangles) for each edge
            // Calculate perpendicular offset for width
            const dx = next.x - current.x;
            const dz = next.z - current.z;
            const length = Math.sqrt(dx * dx + dz * dz);

            if (length === 0) continue; // Skip zero-length edges

            // Perpendicular vector (rotated 90 degrees)
            const perpX = -dz / length * width * 0.5;
            const perpZ = dx / length * width * 0.5;

            // Four corners of the edge rectangle
            const v1 = { x: current.x - perpX, y: current.y, z: current.z - perpZ };
            const v2 = { x: current.x + perpX, y: current.y, z: current.z + perpZ };
            const v3 = { x: next.x + perpX, y: next.y, z: next.z + perpZ };
            const v4 = { x: next.x - perpX, y: next.y, z: next.z - perpZ };

            // Two triangles for this edge
            edgeTriangles.push([v1, v2, v3]);
            edgeTriangles.push([v1, v3, v4]);
        }

        console.log(`📐 Generated ${edgeTriangles.length} edge triangles for ${vertices.length} edges`);
        return edgeTriangles;
    }

    /**
     * Clear all triangles
     */
    clearTriangles() {
        if (!this.polygonOverlayReady) {
            console.warn('⚠️ SuperSplat not ready, cannot clear triangles');
            return false;
        }

        try {
            const events = window.superSplatScene.events;
            events.invoke('triangleOverlay.clearTriangles');
            console.log('🧹 All triangles cleared from SuperSplat');
            return true;
        } catch (error) {
            console.error('❌ Failed to clear triangles:', error);
            return false;
        }
    }

    /**
     * Set the Y-plane for all triangle rendering
     */
    setTriangleYPlane(yPlane) {
        if (!this.polygonOverlayReady) {
            console.warn('⚠️ SuperSplat not ready, cannot set Y-plane');
            return false;
        }

        try {
            const events = window.superSplatScene.events;
            events.invoke('triangleOverlay.setYPlane', yPlane);
            console.log(`🔺 Triangle Y-plane set to ${yPlane}`);
            return true;
        } catch (error) {
            console.error('❌ Failed to set triangle Y-plane:', error);
            return false;
        }
    }

    /**
     * Get information about the SuperSplat scene bounds
     */
    getSceneBounds() {
        if (!this.polygonOverlayReady) return null;

        try {
            const scene = window.superSplatScene;
            const bounds = scene?.bound || scene?.worldBound;

            if (bounds) {
                return {
                    center: bounds.center ? { x: bounds.center.x, y: bounds.center.y, z: bounds.center.z } : null,
                    halfExtents: bounds.halfExtents ? { x: bounds.halfExtents.x, y: bounds.halfExtents.y, z: bounds.halfExtents.z } : null,
                    min: bounds.min ? { x: bounds.min.x, y: bounds.min.y, z: bounds.min.z } : null,
                    max: bounds.max ? { x: bounds.max.x, y: bounds.max.y, z: bounds.max.z } : null
                };
            }

            return null;
        } catch (error) {
            console.error('❌ Failed to get scene bounds:', error);
            return null;
        }
    }

    /**
     * Get the center position of the first splat for reference positioning
     */
    getSplatCenter() {
        if (!this.polygonOverlayReady) return null;

        try {
            const scene = window.superSplatScene;
            const elements = scene?.elements;

            if (elements && elements.length > 0) {
                // Find the first splat element
                for (const element of elements) {
                    if (element.elementType === 'splat' || element.type === 'splat') {
                        const worldBound = element.worldBound;
                        if (worldBound && worldBound.center) {
                            return {
                                x: worldBound.center.x,
                                y: worldBound.center.y,
                                z: worldBound.center.z
                            };
                        }
                    }
                }
            }

            return null;
        } catch (error) {
            console.error('❌ Failed to get splat center:', error);
            return null;
        }
    }

    /**
     * Check if bridge is ready for use
     */
    isReady() {
        return this.isInitialized && this.polygonOverlayReady;
    }

    /**
     * Get debug information about the bridge
     */
    getDebugInfo() {
        return {
            isInitialized: this.isInitialized,
            polygonOverlayReady: this.polygonOverlayReady,
            pendingUpdates: this.pendingUpdates.length,
            superSplatScene: !!window.superSplatScene,
            currentSiteData: !!window.currentSiteData,
            layerState: window.layerState
        };
    }
}

// Initialize the bridge when in Lab mode or when SuperSplat is available
function initializeSuperSplatBridge() {
    // Check if we're in Lab mode or if SuperSplat scene is already available
    const isLabMode = window.TERRAIN_LOADING_CONFIG?.initialMode === 'lab';
    const hasSuperSplatScene = window.scene && window.scene.events;

    if (isLabMode || hasSuperSplatScene) {
        const mode = hasSuperSplatScene ? 'direct SuperSplat' : 'Lab mode';
        console.log(`🌉 Initializing SuperSplat bridge for ${mode}`);
        window.superSplatBridge = new SuperSplatBridge();
    } else {
        console.log('⚠️ Not in Lab mode and no SuperSplat scene detected, skipping bridge initialization');
    }
}

// Export for use in other files
window.SuperSplatBridge = SuperSplatBridge;
window.initializeSuperSplatBridge = initializeSuperSplatBridge;

// Auto-initialize with multiple triggers for robustness
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSuperSplatBridge);
} else {
    // DOM already loaded, initialize now or wait for SuperSplat
    initializeSuperSplatBridge();
}

// Also try to initialize when SuperSplat scene becomes available
const checkForSuperSplatScene = () => {
    if (window.scene && window.scene.events && !window.superSplatBridge) {
        console.log('🎯 SuperSplat scene detected, initializing bridge');
        initializeSuperSplatBridge();
    }
};

// Check periodically for SuperSplat scene (in case it loads after DOM)
const sceneCheckInterval = setInterval(() => {
    if (window.superSplatBridge) {
        clearInterval(sceneCheckInterval); // Stop checking once bridge is initialized
    } else {
        checkForSuperSplatScene();
    }
}, 500); // Check every 500ms

// Stop checking after 30 seconds to avoid infinite checking
setTimeout(() => {
    clearInterval(sceneCheckInterval);
}, 30000);