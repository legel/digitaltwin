/**
 * SuperSplat Bridge - Connects terrain-3d layer controls to SuperSplat PolygonOverlay
 * Bridges the gap between the existing terrain-3d UI and the new SuperSplat rendering system
 */
class SuperSplatBridge {
    constructor() {
        this.isInitialized = false;
        this.polygonOverlayReady = false;
        this.pendingUpdates = [];
        this.polygonClickHandlingSetup = false;

        // Cache for static polygon geometry to avoid re-uploading
        this.polygonGeometryCache = new Map();
        this.lastUploadedSiteId = null;

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
            const maxAttempts = 100; // 10 seconds max wait for SuperSplat scene to initialize

            const checkSuperSplat = () => {
                attempts++;

                // First check if SuperSplat is running directly in this window
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
        console.log('🌉 Setting up SuperSplat event bridging');

        // Bridge layer state changes
        this.setupLayerStateWatching();

        // Bridge site data changes
        this.setupSiteDataWatching();

        // Polygon click event handling will be setup after polygons are rendered
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

        // DOM mutation observer disabled to prevent interference with direct SuperSplat polygon selection
        // The observer was triggering unwanted re-renders that cleared selection state
        // const observer = new MutationObserver(() => {
        //     // Check if layer state has changed
        //     if (this.hasLayerStateChanged(originalLayerState)) {
        //         console.log('🔄 Layer state changed, updating SuperSplat');
        //         this.updateLayerStateInSuperSplat(window.layerState);
        //         Object.assign(originalLayerState, window.layerState);
        //     }
        // });

        // // Observe the layer controls panel for changes
        // const layerControls = document.getElementById('layerControls');
        // if (layerControls) {
        //     observer.observe(layerControls, {
        //         childList: true,
        //         subtree: true,
        //         attributes: true,
        //         attributeOldValue: true
        //     });
        // }

        // Periodic checking disabled to prevent interference with direct SuperSplat polygon selection
        // The periodic check was triggering unwanted re-renders that cleared selection state
        // setInterval(() => {
        //     if (this.hasLayerStateChanged(originalLayerState)) {
        //         console.log('🔄 Layer state changed (periodic check), updating SuperSplat');
        //         this.updateLayerStateInSuperSplat(window.layerState);
        //         Object.assign(originalLayerState, window.layerState);
        //     }
        // }, 1000);
    }

    /**
     * Check if layer state has changed
     */
    hasLayerStateChanged(previousState) {
        const current = window.layerState || {};
        const keys = ['showPlantableAreas', 'showNonPlantableAreas',
                      'selectedGroup', 'selectedGroupType'];

        // Also check unified polygon array for changes
        const arrayKeys = ['selectedPolygons'];

        // Check basic keys
        const basicChanged = keys.some(key => current[key] !== previousState[key]);

        // Check array keys by comparing their content
        const arrayChanged = arrayKeys.some(key => {
            const currentArray = current[key] || [];
            const previousArray = previousState[key] || [];

            if (currentArray.length !== previousArray.length) return true;

            return currentArray.some((item, index) => item !== previousArray[index]);
        });

        return basicChanged || arrayChanged;
    }

    /**
     * Set up watching for site data changes
     */
    setupSiteDataWatching() {
        // Override loadSiteData result processing
        const originalNavigateToSite = window.navigateToSite;
        if (originalNavigateToSite) {
            window.navigateToSite = (...args) => {
                // Clear polygon cache when switching sites for performance
                this.clearPolygonCache();

                const result = originalNavigateToSite.apply(this, args);

                // After site navigation, render GeoJSON polygons
                setTimeout(() => {
                    if (window.currentSiteData && this.isInitialized) {
                        console.log('🗺️ New site data loaded - rendering GeoJSON polygons');
                        this.renderGeoJSONPolygons(window.currentSiteData);
                    }
                }, 1000);

                return result;
            };
        }
    }

    /**
     * Perform initial sync with existing data
     */
    performInitialSync() {
        // Wait for loading screen to complete before rendering GeoJSON polygons
        this.waitForLoadingCompletion().then(() => {
            if (window.currentSiteData) {
                console.log('🎯 Loading complete - rendering GeoJSON polygons');
                this.renderGeoJSONPolygons(window.currentSiteData);
            } else {
                console.log('🎯 Loading complete but no site data - polygon rendering will run when site loads');
            }
        });
    }

    /**
     * Wait for loading screen to complete and splat to be accessible
     */
    async waitForLoadingCompletion() {
        return new Promise((resolve) => {
            // Check if loading is already complete
            if (!window.independentLoadingState?.isActive) {
                console.log('🎯 Loading already complete');
                resolve();
                return;
            }

            // Wait for loading completion
            console.log('⏳ Waiting for loading screen to complete...');
            const checkLoading = () => {
                if (!window.independentLoadingState?.isActive) {
                    console.log('✅ Loading screen complete - splat should be accessible');

                    // Add extra delay for splat data to be fully processed
                    setTimeout(() => {
                        resolve();
                    }, 2000);
                } else {
                    setTimeout(checkLoading, 500); // Check every 500ms
                }
            };

            checkLoading();
        });
    }

    /**
     * Render GeoJSON polygons in SuperSplat with coordinate transformation
     * Uses caching to avoid re-uploading static geometry on repeated calls
     */
    async renderGeoJSONPolygons(geoJsonData) {
        if (!geoJsonData || !geoJsonData.features) {
            console.error('❌ No GeoJSON data provided');
            return;
        }

        // Generate cache key based on GeoJSON content
        const cacheKey = this.generateGeoJSONCacheKey(geoJsonData);

        // Check if we already have this geometry uploaded and just need to update visibility
        if (this.polygonGeometryCache.has(cacheKey) && cacheKey === this.lastUploadedSiteId) {
            console.log('🚀 Using cached polygon geometry - updating visibility only');
            return this.updatePolygonVisibility();
        }

        try {
            await this.waitForLoadingCompletion();
            await window.coordinateTransform.ensureLoaded();

            const splatBounds = await this.waitForSplatBounds();
            if (!splatBounds) {
                console.error('❌ Could not get splat bounds for coordinate transformation');
                return;
            }

            console.log('🗺️ Starting GeoJSON polygon rendering:', {
                features: geoJsonData.features.length,
                splatBounds: {
                    width: splatBounds.width.toFixed(3),
                    height: splatBounds.height.toFixed(3)
                }
            });

            const geoBounds = window.coordinateTransform.calculateGeoJSONBounds(geoJsonData);
            const format = window.detectGeoJsonFormat ? window.detectGeoJsonFormat(geoJsonData.features[0]) : 'boyd';

            // Track polygons for UI controls
            this.polygonRegistry = this.polygonRegistry || [];

            // Clear existing polygons
            if (window.superSplatScene && window.superSplatScene.events) {
                window.superSplatScene.events.fire('triangleOverlay.clearPolygons');
            }

            let polygonsRendered = 0;
            const maxPolygons = 100; // Increased to 100 to show all plantable areas

            // Render all plantable area polygons
            geoJsonData.features.forEach((feature, index) => {
                if (polygonsRendered >= maxPolygons) {
                    return; // Skip remaining polygons
                }
                if (feature.geometry && feature.geometry.type === 'Polygon') {
                    const rawName = feature.properties.name || `polygon_${index}`;

                    // Skip reference points and test features
                    if (/^\d+$/.test(rawName) || rawName.includes('Test ID')) {
                        return;
                    }

                    // Always use the full GeoJSON name as unique identifier
                    // SuperSplat needs unique polygon names, even if display names are the same
                    let name = rawName;

                    // Determine if plantable or non-plantable
                    const isPlantable = this.isPlantableFeature(feature, format);

                    // Check visibility state for this polygon type
                    const layerState = window.layerState || {};
                    const shouldShowPlantable = layerState.showPlantableAreas !== false;
                    const shouldShowNonPlantable = layerState.showNonPlantableAreas !== false;

                    // Visibility logic implemented - polygons respect layer state

                    // Determine if this polygon should be visible
                    const shouldBeVisible = isPlantable ? shouldShowPlantable : shouldShowNonPlantable;

                    // Transform coordinates to SuperSplat world space
                    const vertices = this.transformPolygonCoordinates(feature, splatBounds, geoBounds);

                    // Debug: Log coordinate transformation and polygon complexity
                    if (polygonsRendered < 3) { // Only log first 3 for readability
                        console.log(`🗺️ COORDINATE DEBUG for "${name}" (${isPlantable ? 'PLANTABLE' : 'NON-PLANTABLE'}):`, {
                            totalOriginalCoords: feature.geometry.coordinates[0].length,
                            totalTransformedVertices: vertices.length,
                            firstOriginalCoords: feature.geometry.coordinates[0].slice(0, 3), // First 3 points for reference
                            firstTransformedVertices: vertices.slice(0, 3), // First 3 points for reference
                            lastTransformedVertices: vertices.slice(-3), // Last 3 points for verification
                            splatBounds: { width: splatBounds.width, height: splatBounds.height },
                            geoBounds: {
                                west: geoBounds.west.toFixed(8),
                                east: geoBounds.east.toFixed(8),
                                south: geoBounds.south.toFixed(8),
                                north: geoBounds.north.toFixed(8)
                            }
                        });

                        // Calculate bounds of transformed vertices for debugging
                        const bounds = {
                            minX: Math.min(...vertices.map(v => v.x)),
                            maxX: Math.max(...vertices.map(v => v.x)),
                            minZ: Math.min(...vertices.map(v => v.z)),
                            maxZ: Math.max(...vertices.map(v => v.z))
                        };

                        console.log(`🔺 TRIANGULATION ANALYSIS for "${name}":`, {
                            vertexCount: vertices.length,
                            expectedTriangles: vertices.length - 2, // Ear clipping creates n-2 triangles
                            triangulationMethod: 'Ear clipping (for complex polygons)',
                            bounds: {
                                minX: bounds.minX.toFixed(3),
                                maxX: bounds.maxX.toFixed(3),
                                minZ: bounds.minZ.toFixed(3),
                                maxZ: bounds.maxZ.toFixed(3),
                                width: (bounds.maxX - bounds.minX).toFixed(3),
                                height: (bounds.maxZ - bounds.minZ).toFixed(3)
                            },
                            potentialIssues: vertices.length > 10 ?
                                'Complex polygon - using ear clipping for accurate triangulation' :
                                'Simple polygon - should triangulate well'
                        });
                    }

                    if (vertices.length >= 3) {
                        // Style based on PA/NPA classification
                        const style = this.getPolygonStyle(isPlantable, polygonsRendered);

                        // Assign group based on PA/NPA classification
                        const group = isPlantable ? 'plantable-areas' : 'non-plantable-areas';

                        // Register polygon for tracking
                        this.polygonRegistry.push({
                            name: name,
                            isPlantable: isPlantable,
                            feature: feature,
                            vertices: vertices,
                            visible: shouldBeVisible, // Respect layer visibility state
                            group: group
                        });

                        // Render polygon in SuperSplat (verbose logging removed)

                        if (window.superSplatScene && window.superSplatScene.events) {

                            // Try multiple event methods to find the working one
                            try {
                                let success = false;

                                // Method 1: Try invoke (same as working bounds rectangle)
                                if (typeof window.superSplatScene.events.invoke === 'function') {
                                    window.superSplatScene.events.invoke('triangleOverlay.addPolygon',
                                        vertices, style.fillColor, style.fillAlpha,
                                        style.outlineColor, style.outlineThickness, name, group
                                    );
                                    success = true;
                                }

                                // Method 2: Try accessing function directly
                                else if (window.superSplatScene.events.functions &&
                                         window.superSplatScene.events.functions['triangleOverlay.addPolygon']) {
                                    const addPolygonFunc = window.superSplatScene.events.functions['triangleOverlay.addPolygon'];
                                    addPolygonFunc(vertices, style.fillColor, style.fillAlpha,
                                                  style.outlineColor, style.outlineThickness, name, group);
                                    success = true;
                                }

                                // Method 3: Try invoke (fallback)
                                else if (typeof window.superSplatScene.events.invoke === 'function') {
                                    window.superSplatScene.events.invoke('triangleOverlay.addPolygon',
                                        vertices, style.fillColor, style.fillAlpha,
                                        style.outlineColor, style.outlineThickness, name, group
                                    );
                                    success = true;
                                }

                                if (success) {
                                    polygonsRendered++;
                                } else {
                                    console.error('❌ No working event method found for polygon:', name);
                                }

                            } catch (error) {
                                console.error('❌ Error sending polygon event for', name, ':', error);
                            }
                        } else {
                            console.error('❌ SuperSplat scene or events not available');
                        }
                    }
                }
            });

            console.log('✅ GeoJSON polygon rendering complete:', {
                totalFeatures: geoJsonData.features.length,
                polygonsRendered: polygonsRendered,
                plantableAreas: this.polygonRegistry.filter(p => p.isPlantable).length,
                nonPlantableAreas: this.polygonRegistry.filter(p => !p.isPlantable).length
            });

            // Sort polygons by area for optimal nested click detection (smallest first)
            if (window.superSplatScene && polygonsRendered > 0) {
                try {
                    window.superSplatScene.events.invoke('triangleOverlay.sortPolygonsByArea');
                    console.log('🔄 Polygons sorted by area for nested click detection');
                } catch (error) {
                    console.warn('⚠️ Failed to sort polygons by area:', error);
                }
            }

            // Removed forced render to improve camera movement performance
            // SuperSplat will render polygons automatically as needed
            if (window.superSplatScene && polygonsRendered > 0) {
                console.log('🎨 Polygons loaded - SuperSplat will render automatically');
            }

            // Sync window.layerState with actual polygon visibility defaults
            // Both PA and NPA polygons default to visible in SuperSplat (using !== false logic means both show unless explicitly hidden)
            // Since polygons are being rendered for both types, set both to visible
            window.layerState.showPlantableAreas = true;
            window.layerState.showNonPlantableAreas = true;

            console.log('🔄 Synced layer state with actual polygon visibility:', {
                showPlantableAreas: window.layerState.showPlantableAreas,
                showNonPlantableAreas: window.layerState.showNonPlantableAreas
            });

            // Sync SuperSplat group visibility with layer state
            if (window.superSplatScene && window.superSplatScene.events) {
                console.log('🔄 Syncing SuperSplat group visibility with corrected layer state');
                window.superSplatScene.events.invoke('triangleOverlay.setGroupVisibility', 'plantable-areas', window.layerState.showPlantableAreas);
                window.superSplatScene.events.invoke('triangleOverlay.setGroupVisibility', 'non-plantable-areas', window.layerState.showNonPlantableAreas);
            }

            // Update visibility button icons to match actual polygon visibility
            if (window.updateVisibilityButtonIcons) {
                setTimeout(() => {
                    window.updateVisibilityButtonIcons();
                }, 100); // Small delay to ensure SuperSplat rendering is complete
            }

            // Setup polygon click handling now that polygons are rendered
            setTimeout(() => {
                console.log('🖱️ Setting up polygon click detection after rendering...');
                this.setupPolygonClickHandling();
            }, 200); // Small delay to ensure SuperSplat polygon overlay is fully ready

            // Cache this geometry for future use
            this.polygonGeometryCache.set(cacheKey, {
                features: geoJsonData.features.length,
                polygonsRendered: polygonsRendered,
                timestamp: Date.now()
            });
            this.lastUploadedSiteId = cacheKey;
            console.log(`💾 Cached polygon geometry with key: ${cacheKey}`);

        } catch (error) {
            console.error('❌ Failed to render GeoJSON polygons:', error);
        }
    }

    /**
     * Parse Boyd format feature names (same logic as layerControls.js)
     */
    parseBoydName(name) {
        if (!name) return { id: null, description: null, number: null };

        const match = name.match(/^(PA|NPA)(\d+)=?"?([^"]*)"?$/);
        if (match) {
            return {
                id: match[1], // PA or NPA
                number: match[2],
                description: match[3].trim() || null
            };
        }

        return { id: name, description: null, number: null };
    }

    /**
     * Determine if feature is plantable area based on format and properties
     */
    isPlantableFeature(feature, format) {
        if (format === 'boyd') {
            const name = feature.properties.name;
            if (!name) return false;

            // Check for PA designation (but not NPA)
            if (name.startsWith('PA') && name.includes('=') && !name.includes('NPA')) {
                return true;
            }

            // NPA features are explicitly non-plantable
            if (name.includes('NPA')) {
                return false;
            }

            return false; // Default to non-plantable for safety
        } else {
            // Legacy format: check Layer property
            return feature.properties.Layer === 'Plantable_Layers';
        }
    }

    /**
     * Get polygon styling based on plantable/non-plantable classification
     */
    getPolygonStyle(isPlantable, polygonIndex = -1) {
        if (isPlantable) {
            // All plantable areas: Hollow, black border
            return {
                fillColor: { x: 0.0, y: 0.0, z: 0.0 },    // black (not visible due to alpha 0)
                fillAlpha: 0.0,                             // hollow
                outlineColor: { x: 0.0, y: 0.0, z: 0.0 },  // black border
                outlineThickness: 0.04                      // doubled thickness for better visibility
            };
        } else {
            // Non-plantable areas: Hollow, red border
            return {
                fillColor: { x: 1.0, y: 0.0, z: 0.0 },    // red (not visible due to alpha 0)
                fillAlpha: 0.0,                             // hollow
                outlineColor: { x: 1.0, y: 0.0, z: 0.0 },  // red border
                outlineThickness: 0.04                      // doubled thickness for better visibility
            };
        }
    }

    /**
     * Transform polygon coordinates from geographic to SuperSplat world space
     */
    transformPolygonCoordinates(feature, splatBounds, geoBounds) {
        const coordinates = feature.geometry.coordinates[0]; // exterior ring
        const vertices = [];

        coordinates.forEach(coord => {
            if (coord.length >= 2) {
                const [lon, lat] = coord;
                const superSplatCoord = window.coordinateTransform.geoToSuperSplat(
                    lon, lat, 0, splatBounds, geoBounds
                );

                // Create 3D vertices for SuperSplat (x, y, z coordinates)
                // Y coordinate will be set by the triangle overlay system
                vertices.push({
                    x: superSplatCoord.x,
                    y: superSplatCoord.y, // Usually 0
                    z: superSplatCoord.z
                });
            }
        });

        // Remove duplicate last vertex if it matches the first (common in GeoJSON)
        if (vertices.length > 3) {
            const first = vertices[0];
            const last = vertices[vertices.length - 1];
            if (first.x === last.x && first.z === last.z) {
                vertices.pop();
            }
        }

        return vertices;
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
     * Get comprehensive splat bounds in SuperSplat coordinates
     * Returns both center and full bounding box dimensions
     */
    getSplatBoundsInSuperSplatCoordinates() {
        if (!this.polygonOverlayReady) return null;

        try {
            const scene = window.superSplatScene;
            const elements = scene?.elements;

            if (elements && elements.length > 0) {
                // Find the first splat element
                for (const element of elements) {
                    if (element.elementType === 'splat' || element.type === 'splat') {
                        const worldBound = element.worldBound;

                        if (worldBound && worldBound.center && worldBound.halfExtents) {
                            const bounds = {
                                center: {
                                    x: worldBound.center.x,
                                    y: worldBound.center.y,
                                    z: worldBound.center.z
                                },
                                halfExtents: {
                                    x: worldBound.halfExtents.x,
                                    y: worldBound.halfExtents.y,
                                    z: worldBound.halfExtents.z
                                },
                                min: {
                                    x: worldBound.center.x - worldBound.halfExtents.x,
                                    y: worldBound.center.y - worldBound.halfExtents.y,
                                    z: worldBound.center.z - worldBound.halfExtents.z
                                },
                                max: {
                                    x: worldBound.center.x + worldBound.halfExtents.x,
                                    y: worldBound.center.y + worldBound.halfExtents.y,
                                    z: worldBound.center.z + worldBound.halfExtents.z
                                },
                                width: worldBound.halfExtents.x * 2,
                                height: worldBound.halfExtents.z * 2, // Z is typically the "height" in top-down view
                                depth: worldBound.halfExtents.y * 2
                            };

                            console.log('🎨 Extracted SuperSplat bounds:', bounds);
                            return bounds;
                        }
                    }
                }
            }

            console.warn('⚠️ No splat found or splat lacks proper bounds');
            return null;
        } catch (error) {
            console.error('❌ Failed to get splat bounds:', error);
            return null;
        }
    }

    /**
     * Wait for splats to load and return bounds information
     * Uses progressive checking intervals to reduce CPU load
     */
    async waitForSplatBounds(maxWaitTime = 10000) {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            let currentInterval = 500; // Start with 500ms intervals
            const maxInterval = 2000; // Max 2 second intervals
            let totalWaitTime = 0;

            const checkSplatBounds = () => {
                attempts++;
                totalWaitTime += currentInterval;

                const bounds = this.getSplatBoundsInSuperSplatCoordinates();

                if (bounds) {
                    console.log(`✅ Splat bounds detected after ${totalWaitTime}ms (${attempts} attempts)`);
                    resolve(bounds);
                    return;
                }

                if (totalWaitTime >= maxWaitTime) {
                    console.warn(`⚠️ Timeout waiting for splat bounds after ${totalWaitTime}ms (${attempts} attempts)`);
                    reject(new Error('Timeout waiting for splat bounds'));
                    return;
                }

                // Increase interval progressively to reduce checking frequency
                if (currentInterval < maxInterval && attempts > 3) {
                    currentInterval = Math.min(currentInterval * 1.5, maxInterval);
                    console.log(`📊 Increasing splat bounds check interval to ${currentInterval}ms`);
                }

                setTimeout(checkSplatBounds, currentInterval);
            };

            // First check immediately
            checkSplatBounds();
        });
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

    /**
     * Create and render a test rectangle showing the outer bounds of GeoJSON data
     * Waits for splat bounds and uses dynamic coordinate scaling
     */
    async renderGeoJSONBoundsRectangle(geoJsonData) {
        if (!this.polygonOverlayReady) {
            console.warn('⚠️ SuperSplat not ready for bounds rectangle test');
            return false;
        }

        if (!window.coordinateTransform) {
            console.error('❌ CoordinateTransform not available - make sure CoordinateTransform.js is loaded');
            return false;
        }

        try {
            console.log('🔬 === GEOJSON BOUNDS RECTANGLE TEST (DYNAMIC SCALING) ===');

            // Ensure coordinate transform is loaded
            await window.coordinateTransform.ensureLoaded();

            // Wait for splat bounds to be available
            console.log('⏳ Waiting for splat bounds to load...');
            let splatBounds = null;

            try {
                splatBounds = await this.waitForSplatBounds(15000); // Wait up to 15 seconds
            } catch (error) {
                console.warn('⚠️ Could not get splat bounds - proceeding with fallback scaling:', error.message);
            }

            // Create bounds rectangle with dynamic scaling if splat bounds available
            const rectangleVertices = await window.coordinateTransform.createBoundsRectangle(geoJsonData, splatBounds);

            if (rectangleVertices.length !== 4) {
                console.error('❌ Invalid rectangle vertices:', rectangleVertices);
                return false;
            }

            // Get additional splat information
            const sceneBounds = this.getSceneBounds();
            const splatCenter = this.getSplatCenter();

            console.log('🎨 Splat Scene Information:', {
                splat_center: splatCenter || 'Not available',
                scene_bounds: sceneBounds || 'Not available',
                splat_bounds_extracted: splatBounds ? 'Yes (used for dynamic scaling)' : 'No (using fallback scaling)',
                note: 'These coordinates are in SuperSplat local coordinate system'
            });

            // Clear existing polygons and triangles
            this.clearTriangles();

            // Create polygon using SuperSplat polygon system
            const events = window.superSplatScene.events;

            // Convert vertices to Vec3 format expected by SuperSplat
            const vec3Vertices = rectangleVertices.map(v => ({
                x: v.x,
                y: v.y,
                z: v.z
            }));

            // Add polygon with distinctive styling for testing
            const polygonColor = { x: 0.2, y: 0.8, z: 0.2 }; // Green
            const fillAlpha = 0.3; // Semi-transparent
            const outlineColor = { x: 1.0, y: 1.0, z: 0.0 }; // Yellow outline
            const outlineThickness = splatBounds ? 0.05 : 0.15; // Thinner outline if we have proper scaling
            const polygonName = `GeoJSON_Bounds_Rectangle_${splatBounds ? 'Dynamic' : 'Fallback'}`;

            console.log('🔹 Creating bounds rectangle polygon:', {
                vertices: vec3Vertices,
                color: polygonColor,
                fillAlpha: fillAlpha,
                outlineColor: outlineColor,
                outlineThickness: outlineThickness,
                name: polygonName,
                scaling_method: splatBounds ? 'Dynamic (based on splat)' : 'Fallback (static)'
            });

            // Send polygon to SuperSplat
            events.invoke('triangleOverlay.addPolygon',
                vec3Vertices,
                polygonColor,
                fillAlpha,
                outlineColor,
                outlineThickness,
                polygonName
            );

            console.log('✅ GeoJSON bounds rectangle sent to SuperSplat successfully');

            if (splatBounds) {
                console.log('🎯 Dynamic scaling used - rectangle should cover the entire splat extent');
            } else {
                console.log('⚠️ Fallback scaling used - rectangle may be incorrectly sized');
            }

            console.log('👁️ Look for a semi-transparent green rectangle with yellow outline covering the GeoJSON bounds');
            console.log('🔬 === BOUNDS RECTANGLE TEST COMPLETE ===');

            return true;

        } catch (error) {
            console.error('❌ Failed to render GeoJSON bounds rectangle:', error);
            return false;
        }
    }

    /**
     * Setup polygon click event handling
     * Listens for polygon.clicked events from SuperSplat and triggers terrain-3d UI actions
     */
    setupPolygonClickHandling() {
        if (!window.superSplatScene || !window.superSplatScene.events) {
            console.warn('⚠️ SuperSplat scene not ready for polygon click handling');
            return;
        }

        // Prevent setting up multiple times
        if (this.polygonClickHandlingSetup) {
            console.log('🖱️ Polygon click handling already setup, skipping...');
            return;
        }

        console.log('🖱️ Setting up polygon click event bridge');
        this.polygonClickHandlingSetup = true;

        // Listen for polygon click events from SuperSplat
        window.superSplatScene.events.on('polygon.clicked', (data) => {
            console.log('🎯 Polygon click received from SuperSplat:', data);

            const { polygonName, polygonGroup, worldPosition, screenPosition } = data;

            // Determine if this is a PA or NPA polygon based on the polygon name (same logic as elsewhere in codebase)
            if (polygonName && polygonName.startsWith('PA') && polygonName.includes('=') && !polygonName.includes('NPA')) {
                // This is a plantable area - trigger PA selection
                console.log('🌱 Detected plantable area:', polygonName);
                this.handlePlantableAreaClick(polygonName, polygonGroup);
            } else if (polygonName && polygonName.startsWith('NPA')) {
                // This is a non-plantable area - trigger NPA selection
                console.log('🚫 Detected non-plantable area:', polygonName);
                this.handleNonPlantableAreaClick(polygonName, polygonGroup);
            } else {
                console.log('🤷 Unknown polygon type, treating as general polygon click. Name:', polygonName);
                // Generic polygon click - could trigger focus panel or other behavior
                this.handleGenericPolygonClick(polygonName, polygonGroup);
            }
        });

        console.log('✅ Polygon click event bridge established');
    }

    /**
     * Handle plantable area polygon clicks
     * Opens the PA dropdown and selects the corresponding button
     */
    handlePlantableAreaClick(polygonName, polygonGroup) {
        console.log(`🌱 Handling plantable area click: ${polygonName} (group: ${polygonGroup})`);

        try {
            // Ensure plantable areas dropdown is open
            this.ensureDropdownOpen('plantableAreasToggle');

            // Find and click the corresponding PA button
            const paName = this.extractPANameFromPolygon(polygonName);
            if (paName) {
                const paButton = this.findPAButton(paName);
                if (paButton) {
                    console.log(`🎯 Triggering PA button click for: ${paName}`);
                    console.log('🔍 PA button before click:', paButton, 'checked:', paButton.checked);

                    // Set flag to indicate this click is from polygon, not direct UI interaction
                    window.isPolygonTriggeredClick = true;
                    paButton.click();
                    // Clear flag after click
                    window.isPolygonTriggeredClick = false;

                    console.log('🔍 PA button after click:', paButton.checked);
                } else {
                    console.warn(`⚠️ Could not find PA button for: ${paName}`);
                    // Debug: List all available PA buttons
                    const allButtons = document.querySelectorAll('input[type="radio"][name="plantableArea"]');
                    console.log(`🔍 Available PA buttons (${allButtons.length}):`, Array.from(allButtons).map(b => b.value));
                }
            } else {
                console.warn(`⚠️ Could not extract PA name from polygon: ${polygonName}`);
            }
        } catch (error) {
            console.error('❌ Error handling plantable area click:', error);
        }
    }

    /**
     * Handle non-plantable area polygon clicks
     * Opens the NPA dropdown and selects the corresponding button
     */
    handleNonPlantableAreaClick(polygonName, polygonGroup) {
        console.log(`🚫 Handling non-plantable area click: ${polygonName} (group: ${polygonGroup})`);

        try {
            // Ensure non-plantable areas dropdown is open
            this.ensureDropdownOpen('nonPlantableAreasToggle');

            // Find and click the corresponding NPA button
            const npaName = this.extractNPANameFromPolygon(polygonName);
            if (npaName) {
                const npaButton = this.findNPAButton(npaName);
                if (npaButton) {
                    console.log(`🎯 Triggering NPA button click for: ${npaName}`);

                    // Set flag to indicate this click is from polygon, not direct UI interaction
                    window.isPolygonTriggeredClick = true;
                    npaButton.click();
                    // Clear flag after click
                    window.isPolygonTriggeredClick = false;
                } else {
                    console.warn(`⚠️ Could not find NPA button for: ${npaName}`);
                }
            } else {
                console.warn(`⚠️ Could not extract NPA name from polygon: ${polygonName}`);
            }
        } catch (error) {
            console.error('❌ Error handling non-plantable area click:', error);
        }
    }

    /**
     * Handle generic polygon clicks (fallback behavior)
     */
    handleGenericPolygonClick(polygonName, polygonGroup) {
        console.log(`🔍 Handling generic polygon click: ${polygonName} (group: ${polygonGroup})`);

        // For now, just log the click - could extend with additional behavior
        console.log('ℹ️ Generic polygon click processed, no specific action taken');
    }

    /**
     * Ensure a dropdown is open by clicking its toggle button
     */
    ensureDropdownOpen(toggleId) {
        const toggle = document.getElementById(toggleId);
        if (!toggle) {
            console.warn(`⚠️ Could not find dropdown toggle: ${toggleId}`);
            return;
        }

        // Check if dropdown is already open
        const dropdownContent = toggle.nextElementSibling;
        if (dropdownContent && (!dropdownContent.style.display || dropdownContent.style.display === 'none')) {
            console.log(`📋 Opening dropdown: ${toggleId}`);
            toggle.click();
        } else {
            console.log(`📋 Dropdown already open: ${toggleId}`);
        }
    }

    /**
     * Extract PA name from polygon name
     * Handles polygons that may have numerical suffixes or other variations
     */
    extractPANameFromPolygon(polygonName) {
        // Extract description from formats like PA22="Backyard" or PA1="Southeast Front Door Entrance"
        console.log(`🔍 PA name extraction input: "${polygonName}"`);

        // Check if it's in the format PA##="Description"
        const quotedMatch = polygonName.match(/PA\d+="([^"]+)"/);
        if (quotedMatch) {
            const description = quotedMatch[1];
            console.log(`🔍 PA name extraction: "${polygonName}" -> "${description}" (quoted format)`);
            return description;
        }

        // Fallback: remove numerical suffixes for other formats
        // Example: "PA1 Southeast Front Door Entrance 0" -> "PA1 Southeast Front Door Entrance"
        const cleanName = polygonName.replace(/\s+\d+$/, '').trim();
        console.log(`🔍 PA name extraction: "${polygonName}" -> "${cleanName}" (fallback)`);
        return cleanName;
    }

    /**
     * Extract NPA name from polygon name
     */
    extractNPANameFromPolygon(polygonName) {
        // Extract description from formats like NPA5="Utilities" or similar
        console.log(`🔍 NPA name extraction input: "${polygonName}"`);

        // Check if it's in the format NPA##="Description" or NPA##='Description'
        const quotedMatch = polygonName.match(/NPA\d+=['"]([^'"]+)['"]/);
        if (quotedMatch) {
            const description = quotedMatch[1];
            console.log(`🔍 NPA name extraction: "${polygonName}" -> "${description}" (quoted format)`);
            return description;
        }

        // Fallback: remove numerical suffixes for other formats
        const cleanName = polygonName.replace(/\s+\d+$/, '').trim();
        console.log(`🔍 NPA name extraction: "${polygonName}" -> "${cleanName}" (fallback)`);
        return cleanName;
    }

    /**
     * Find PA button in the UI by PA name
     */
    findPAButton(paName) {
        console.log(`🔍 Looking for PA button with name: "${paName}"`);

        // Look for buttons or radio inputs that correspond to this PA
        const buttons = document.querySelectorAll('input[type="radio"][name="plantableArea"], button[data-pa-name]');
        console.log(`🔍 Found ${buttons.length} potential PA buttons`);

        // Smart matching: exact match first, then longest match wins
        const candidates = [];
        for (const button of buttons) {
            const buttonValue = button.value || button.dataset.paName || button.textContent;
            console.log(`🔍 Checking button value: "${buttonValue}" against target: "${paName}"`);

            if (buttonValue) {
                // Exact match (highest priority)
                if (buttonValue.trim() === paName.trim()) {
                    console.log(`✅ Found EXACT match: "${buttonValue}"`);
                    return button;
                }
                // Substring match (store for sorting)
                if (buttonValue.includes(paName)) {
                    candidates.push({ button, buttonValue, length: buttonValue.length });
                }
            }
        }

        // Return longest matching candidate (prevents "Front Door Entrance" matching "Southeast Front Door Entrance")
        if (candidates.length > 0) {
            candidates.sort((a, b) => b.length - a.length); // Longest first
            const winner = candidates[0];
            console.log(`✅ Found LONGEST match: "${winner.buttonValue}" (${winner.length} chars)`);
            return winner.button;
        }

        console.log(`❌ No matching button found for: "${paName}"`);
        return null;

        // Try looking in the parent labels or nearby text
        const labels = document.querySelectorAll('label');
        for (const label of labels) {
            if (label.textContent.includes(paName)) {
                const input = label.querySelector('input[type="radio"]');
                if (input) return input;
            }
        }

        return null;
    }

    /**
     * Find NPA button in the UI by NPA name
     */
    findNPAButton(npaName) {
        console.log(`🔍 Looking for NPA button with name: "${npaName}"`);

        // Similar to PA button finding, but for NPAs
        const buttons = document.querySelectorAll('input[type="radio"][name="nonPlantableArea"], button[data-npa-name]');
        console.log(`🔍 Found ${buttons.length} potential NPA buttons`);

        // Smart matching: exact match first, then longest match wins
        const candidates = [];
        for (const button of buttons) {
            const buttonValue = button.value || button.dataset.npaName || button.textContent;
            console.log(`🔍 Checking button value: "${buttonValue}" against target: "${npaName}"`);

            if (buttonValue) {
                // Exact match (highest priority)
                if (buttonValue.trim() === npaName.trim()) {
                    console.log(`✅ Found EXACT match: "${buttonValue}"`);
                    return button;
                }
                // Substring match (store for sorting)
                if (buttonValue.includes(npaName)) {
                    candidates.push({ button, buttonValue, length: buttonValue.length });
                }
            }
        }

        // Return longest matching candidate
        if (candidates.length > 0) {
            candidates.sort((a, b) => b.length - a.length); // Longest first
            const winner = candidates[0];
            console.log(`✅ Found LONGEST match: "${winner.buttonValue}" (${winner.length} chars)`);
            return winner.button;
        }

        // Try looking in the parent labels or nearby text
        console.log(`🔍 No direct button match, trying labels...`);
        const labels = document.querySelectorAll('label');
        for (const label of labels) {
            const labelText = label.textContent;
            console.log(`🔍 Checking label text: "${labelText}" against target: "${npaName}"`);

            if (labelText && labelText.includes(npaName)) {
                const input = label.querySelector('input[type="radio"]');
                if (input) {
                    console.log(`✅ Found matching label with text: "${labelText}"`);
                    return input;
                }
            }
        }

        console.log(`❌ No matching NPA button found for: "${npaName}"`);
        return null;
    }

    /**
     * Generate a cache key for GeoJSON data to identify unique polygon sets
     */
    generateGeoJSONCacheKey(geoJsonData) {
        // Use feature count and first few feature names as cache key
        const featureCount = geoJsonData.features.length;
        const featureNames = geoJsonData.features
            .slice(0, 5) // Use first 5 features for key
            .map(f => f.properties.name || 'unnamed')
            .join(',');

        return `polygons_${featureCount}_${featureNames.substring(0, 50)}`;
    }

    /**
     * Update polygon visibility without re-uploading geometry
     */
    updatePolygonVisibility() {
        try {
            if (!window.superSplatScene || !window.superSplatScene.events) {
                console.warn('⚠️ SuperSplat scene not available for visibility update');
                return;
            }

            // Get current layer state
            const layerState = window.layerState || {};

            console.log('🔄 Updating polygon visibility without geometry upload:', {
                showPlantableAreas: layerState.showPlantableAreas,
                showNonPlantableAreas: layerState.showNonPlantableAreas
            });

            // Update group visibility in SuperSplat
            window.superSplatScene.events.invoke('triangleOverlay.setGroupVisibility',
                'plantable-areas', layerState.showPlantableAreas !== false);
            window.superSplatScene.events.invoke('triangleOverlay.setGroupVisibility',
                'non-plantable-areas', layerState.showNonPlantableAreas !== false);

            // Update UI buttons to match visibility state
            if (window.updateVisibilityButtonIcons) {
                setTimeout(() => {
                    window.updateVisibilityButtonIcons();
                }, 50); // Small delay for SuperSplat to process visibility changes
            }

            console.log('✅ Polygon visibility updated using cached geometry');
        } catch (error) {
            console.error('❌ Failed to update polygon visibility:', error);
        }
    }

    /**
     * Clear polygon geometry cache (useful when switching sites)
     */
    clearPolygonCache() {
        console.log('🧹 Clearing polygon geometry cache');
        this.polygonGeometryCache.clear();
        this.lastUploadedSiteId = null;
    }

}

// Initialize the bridge for SuperSplat application
function initializeSuperSplatBridge() {
    // Always initialize the SuperSplat bridge
    const hasSuperSplatScene = window.scene && window.scene.events;
    const mode = hasSuperSplatScene ? 'direct SuperSplat scene' : 'SuperSplat application';

    console.log(`🌉 Initializing SuperSplat bridge for ${mode}`);
    window.superSplatBridge = new SuperSplatBridge();
}

// Export for use in other files
window.SuperSplatBridge = SuperSplatBridge;
window.initializeSuperSplatBridge = initializeSuperSplatBridge;

// Auto-initialize only when called explicitly or when SuperSplat scene is ready
// Removed automatic DOM initialization to prevent timing issues

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

/**
 * Test function to manually trigger GeoJSON bounds rectangle rendering
 * Can be called from browser console for testing
 */
window.testGeoJSONBoundsRectangle = async function() {
    console.log('🧪 Manual test: GeoJSON bounds rectangle');

    if (!window.superSplatBridge) {
        console.error('❌ SuperSplat bridge not initialized');
        return false;
    }

    if (!window.currentSiteData) {
        console.error('❌ No site data loaded. Please load a site first.');
        return false;
    }

    return await window.superSplatBridge.renderGeoJSONBoundsRectangle(window.currentSiteData);
};

console.log('🌉 SuperSplat Bridge loaded. Use testGeoJSONBoundsRectangle() to test coordinate transformation.');