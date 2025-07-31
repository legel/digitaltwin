/**
 * UnifiedLODManager - Consolidates all Level of Detail management into a single efficient system
 * Replaces multiple overlapping LOD systems that were causing property thrashing
 */
class UnifiedLODManager {
    constructor(viewer) {
        this.viewer = viewer;
        this.tilesets = new Map(); // Both Gaussian Splats and Google Photorealistic
        this.lastUpdateTime = 0;
        this.updateInterval = 5000; // Reduced frequency - LOD decisions every 5 seconds instead of 1
        this.isUpdating = false;
        
        // Cache frequently accessed values to reduce recalculation
        this.lastCameraPosition = null;
        this.lastCameraHeight = null;
        this.cacheValidTime = 0;
        this.cacheTimeout = 200; // Cache camera data for 200ms
        
        // Quality tiers for consistent LOD decisions
        this.qualityTiers = {
            ULTRA: { sse: 4, maxDistance: 50 },
            HIGH: { sse: 8, maxDistance: 150 },
            MEDIUM: { sse: 16, maxDistance: 500 },
            LOW: { sse: 32, maxDistance: Infinity }
        };
        
        // CRITICAL OPTIMIZATION: Disable continuous LOD loop since tilesets are pre-configured optimally
        // this.startUpdateLoop(); // Disabled to eliminate background processing overhead
        
        console.log('UnifiedLODManager initialized - consolidating all LOD systems');
    }
    
    /**
     * Registers a tileset for unified LOD management
     * @param {string} id - Unique identifier (siteId for Gaussian, 'google-photorealistic' for Google)
     * @param {Cesium.Cesium3DTileset} tileset - The tileset to manage
     * @param {string} type - Type: 'gaussian' or 'google'
     */
    registerTileset(id, tileset, type) {
        this.tilesets.set(id, {
            tileset: tileset,
            type: type,
            lastSSE: tileset.maximumScreenSpaceError,
            loadActivity: 0, // Track loading activity for dynamic adjustment
            distance: 0,
            height: 0
        });
        
        // Set up load progress monitoring for dynamic adjustment
        if (type === 'gaussian') {
            this.setupLoadProgressMonitoring(id, tileset);
        }
        
        console.log(`Tileset registered with UnifiedLODManager: ${id} (${type})`);
    }
    
    /**
     * Unregisters a tileset from LOD management
     * @param {string} id - Tileset identifier
     */
    unregisterTileset(id) {
        if (this.tilesets.has(id)) {
            this.tilesets.delete(id);
            console.log(`Tileset unregistered from UnifiedLODManager: ${id}`);
        }
    }
    
    /**
     * Sets up lightweight load progress monitoring for dynamic quality adjustment
     * @param {string} id - Tileset identifier  
     * @param {Cesium.Cesium3DTileset} tileset - The tileset
     */
    setupLoadProgressMonitoring(id, tileset) {
        let lastUpdateTime = 0;
        
        tileset.loadProgress.addEventListener((pending, processing) => {
            const now = Date.now();
            
            // Throttle to prevent excessive updates
            if (now - lastUpdateTime < 1000) return;
            lastUpdateTime = now;
            
            const tilesetData = this.tilesets.get(id);
            if (tilesetData) {
                tilesetData.loadActivity = pending + processing;
            }
        });
    }
    
    /**
     * Starts the unified update loop
     */
    startUpdateLoop() {
        const updateLOD = () => {
            const now = performance.now();
            
            // Respect update interval to prevent thrashing
            if (now - this.lastUpdateTime < this.updateInterval || this.isUpdating) {
                requestAnimationFrame(updateLOD);
                return;
            }
            
            this.isUpdating = true;
            this.lastUpdateTime = now;
            
            try {
                this.updateAllTilesets();
            } catch (error) {
                console.error('Error in UnifiedLODManager update:', error);
            }
            
            this.isUpdating = false;
            requestAnimationFrame(updateLOD);
        };
        
        requestAnimationFrame(updateLOD);
    }
    
    /**
     * Updates LOD for all registered tilesets in a single pass
     */
    updateAllTilesets() {
        if (this.tilesets.size === 0) return;
        
        // Update cached camera data if needed
        this.updateCameraCache();
        
        const batchUpdates = new Map(); // Batch property changes
        
        for (const [id, tilesetData] of this.tilesets.entries()) {
            const { tileset, type } = tilesetData;
            
            if (tileset.isDestroyed?.()) {
                this.unregisterTileset(id);
                continue;
            }
            
            // Calculate appropriate SSE based on type and conditions
            let targetSSE;
            
            if (type === 'gaussian') {
                targetSSE = this.calculateGaussianSSE(id, tilesetData);
            } else if (type === 'google') {
                targetSSE = this.calculateGoogleSSE(tilesetData);
            }
            
            // Only update if significantly different to prevent thrashing
            if (Math.abs(tileset.maximumScreenSpaceError - targetSSE) >= 4) {
                batchUpdates.set(tileset, { maximumScreenSpaceError: targetSSE });
                tilesetData.lastSSE = targetSSE;
            }
        }
        
        // Apply all property changes in a single batch
        for (const [tileset, properties] of batchUpdates) {
            Object.assign(tileset, properties);
        }
        
        if (batchUpdates.size > 0) {
            console.log(`UnifiedLODManager: Updated ${batchUpdates.size} tilesets`);
        }
    }
    
    /**
     * Updates cached camera data to reduce expensive calculations
     */
    updateCameraCache() {
        const now = performance.now();
        
        if (now - this.cacheValidTime < this.cacheTimeout) {
            return; // Cache still valid
        }
        
        this.lastCameraPosition = this.viewer.camera.position.clone();
        this.lastCameraHeight = this.viewer.camera.positionCartographic.height;
        this.cacheValidTime = now;
    }
    
    /**
     * Calculates appropriate SSE for Gaussian Splat tilesets
     * @param {string} id - Tileset identifier
     * @param {Object} tilesetData - Tileset data object
     * @returns {number} Target screen space error
     */
    calculateGaussianSSE(id, tilesetData) {
        const { tileset } = tilesetData;
        let baseSSE = 16; // Default quality
        
        // Distance-based quality (using cached camera position)
        if (tileset.boundingSphere?.center && this.lastCameraPosition) {
            const distance = Cesium.Cartesian3.distance(
                this.lastCameraPosition, 
                tileset.boundingSphere.center
            );
            
            tilesetData.distance = distance;
            
            // Use quality tiers for consistent decisions
            for (const [tierName, tier] of Object.entries(this.qualityTiers)) {
                if (distance <= tier.maxDistance) {
                    baseSSE = tier.sse;
                    break;
                }
            }
        }
        
        // Adjust for loading activity (higher SSE when busy loading)
        if (tilesetData.loadActivity > 8) {
            baseSSE = Math.max(baseSSE, 24); // Reduce quality when heavily loading
        } else if (tilesetData.loadActivity === 0) {
            baseSSE = Math.min(baseSSE, 12); // Increase quality when not loading
        }
        
        return baseSSE;
    }
    
    /**
     * Calculates appropriate SSE for Google Photorealistic tileset
     * @param {Object} tilesetData - Tileset data object
     * @returns {number} Target screen space error
     */
    calculateGoogleSSE(tilesetData) {
        // Google tiles work better with height-based LOD (using cached height)
        const height = this.lastCameraHeight;
        tilesetData.height = height;
        
        if (height < 100) {
            return 8;      // High quality when very close
        } else if (height < 300) {
            return 12;     // Medium quality
        } else if (height < 1000) {
            return 24;     // Lower quality at medium height
        } else if (height < 3000) {
            return 48;     // Low quality at high altitude
        } else {
            return 96;     // Very low quality when very high
        }
    }
    
    /**
     * Optimizes all tilesets for camera movement with minimal property changes
     * @param {boolean} isMoving - Whether camera is moving
     */
    optimizeForMovement(isMoving) {
        // CRITICAL OPTIMIZATION: Skip expensive property updates if tilesets are already properly configured
        // Since we now load tilesets with optimal settings, we only need to track movement state
        
        if (isMoving) {
            // Tilesets are already optimally configured at load time - just track state
            this.movementOptimized = true;
        } else {
            // On movement end, tilesets return to their natural optimized state automatically
            this.movementOptimized = false;
        }
        
        // Skip expensive property updates entirely - tilesets were configured optimally at load time
        // This eliminates a major performance bottleneck during camera movement
    }
    
    /**
     * Gets debug information about all managed tilesets
     * @returns {Object} Debug information
     */
    getDebugInfo() {
        const info = {
            totalTilesets: this.tilesets.size,
            updateInterval: this.updateInterval,
            lastUpdateTime: this.lastUpdateTime,
            cacheValidTime: this.cacheValidTime,
            tilesets: {}
        };
        
        for (const [id, data] of this.tilesets.entries()) {
            info.tilesets[id] = {
                type: data.type,
                currentSSE: data.tileset.maximumScreenSpaceError,
                lastSSE: data.lastSSE,
                distance: data.distance.toFixed(1),
                loadActivity: data.loadActivity
            };
        }
        
        return info;
    }
    
    /**
     * Cleanup method
     */
    destroy() {
        this.tilesets.clear();
        console.log('UnifiedLODManager destroyed');
    }
}

// Export to global scope
window.UnifiedLODManager = UnifiedLODManager;