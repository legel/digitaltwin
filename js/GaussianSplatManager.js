/**
 * GaussianSplatManager - Handles loading and management of Gaussian Splat 3D tilesets
 * Provides auto-loading for sites with splat data and loading indicators
 */
class GaussianSplatManager {
    constructor(viewer) {
        this.viewer = viewer;
        this.loadedTilesets = new Map(); // Track loaded splats by site ID
        this.loadingIndicators = new Map(); // Track loading indicators by site ID
        this.isLoading = false;
        this.loadingStartTime = null;
        this.isWaitingForCompletion = false;
        this.performanceStatsLogged = false;
        this.loadingResolver = null;
        this.clippingPolygons = new Map(); // Track clipping polygons by site ID
        
        // Toggle state management
        this.splatsHidden = false; // Track whether splats are currently hidden
        this.hiddenSplatData = new Map(); // Store splat data for re-loading
        
        // Debug mode controls visibility of debug features
        // Set to true to show: HQ/Perf Mode button, Hide/Show digital twin button, 
        // blue 3D prism visualization, yellow clipping polygon outline
        this.debugMode = false;
        
        // Set up error handling for Cesium rendering errors
        this.setupErrorHandling();
        
        // Set up development controls
        this.setupDevelopmentControls();
        
        // Check Cesium version and Gaussian Splat support
        // GaussianSplatManager initialized
        this.checkGaussianSplatSupport();
    }
    
    /**
     * Sets up error handling for Cesium rendering issues
     */
    setupErrorHandling() {
        // Listen for Cesium rendering errors
        if (this.viewer && this.viewer.scene) {
            this.viewer.scene.renderError.addEventListener((scene, error) => {
                console.error('Cesium rendering error:', error);
                
                // Try to recover by clearing problematic resources
                if (error && error.message && error.message.includes('destroy')) {
                    console.warn('Attempting to recover from destroy() error by cleaning up resources');
                    this.emergencyCleanup();
                }
            });
        }
    }
    
    /**
     * Emergency cleanup of all resources if rendering fails
     */
    emergencyCleanup() {
        try {
            // Clear all loading indicators
            for (const siteId of this.loadingIndicators.keys()) {
                this.removeLoadingIndicator(siteId);
            }
            
            // Remove all terrain clipping
            this.removeAllTerrainClipping();
            
            // Optionally clear all loaded splats if they're causing issues
            // (uncomment if needed)
            // this.unloadAllSplats();
            
            console.log('Emergency cleanup completed');
        } catch (cleanupError) {
            console.error('Error during emergency cleanup:', cleanupError);
        }
    }
    
    /**
     * Sets up development controls for Gaussian Splat management
     */
    setupDevelopmentControls() {
        // Create a toggle button for splat visibility after a short delay
        // to ensure layer controls are available
        setTimeout(() => {
            if (this.debugMode) {
                this.createSplatToggleButton();
            }
        }, 1000);
    }
    
    /**
     * Creates a remove button for Gaussian Splat deletion within the control panel
     */
    createSplatToggleButton() {
        // Check if button already exists
        if (document.getElementById('splatToggleButton')) {
            return;
        }
        
        // Find the layer controls container
        const layerControls = document.getElementById('layerControls');
        if (!layerControls) {
            console.warn('Layer controls not found, cannot add splat remove button');
            return;
        }
        
        // Create a container for the splat remove button
        const splatContainer = document.createElement('div');
        splatContainer.className = 'layer-section';
        splatContainer.id = 'splatToggleSection';
        
        // Create the toggle button
        const button = document.createElement('button');
        button.id = 'splatToggleButton';
        button.className = 'control-button text-button';
        button.style.cssText = `
            cursor: pointer;
            transition: all 0.3s ease;
            padding: 8px 12px;
            margin: 5px 0;
            background-color: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 4px;
            color: white;
            font-size: 12px;
            width: 100%;
        `;
        
        // Add hover effect
        button.addEventListener('mouseenter', () => {
            button.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        });
        
        // Add click handler to toggle splats
        button.addEventListener('click', () => {
            this.toggleSplats();
        });
        
        splatContainer.appendChild(button);
        layerControls.appendChild(splatContainer);
        
        // Update button state initially
        this.updateToggleButtonState();
        
        console.log('Splat toggle button added to control panel');
    }
    
    /**
     * Updates the toggle button text and state based on current splat visibility
     */
    updateToggleButtonState() {
        const button = document.getElementById('splatToggleButton');
        if (!button) return;
        
        // If no splats loaded and none hidden, disable the button
        if (this.loadedTilesets.size === 0 && this.hiddenSplatData.size === 0) {
            button.textContent = 'No Digital Twin';
            button.style.backgroundColor = 'rgba(128, 128, 128, 0.3)'; // Gray tint when disabled
            button.disabled = true;
            button.style.cursor = 'not-allowed';
            return;
        }
        
        // Enable button if we have loaded splats or hidden data
        button.disabled = false;
        button.style.cursor = 'pointer';
        
        if (this.splatsHidden) {
            button.textContent = 'Show Digital Twin';
            button.style.backgroundColor = 'rgba(0, 255, 0, 0.2)'; // Green tint when hidden
        } else {
            button.textContent = 'Hide Digital Twin';
            button.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'; // Default tint when shown
        }
    }
    
    /**
     * Toggles visibility of all Gaussian Splats
     */
    async toggleSplats() {
        if (this.splatsHidden) {
            // Show splats - restore from hidden state
            await this.showAllSplats();
        } else {
            // Hide splats - store current state
            this.hideAllSplats();
        }
    }
    
    /**
     * Hides all loaded Gaussian Splats but keeps their data for restoration
     */
    hideAllSplats() {
        if (this.loadedTilesets.size === 0) {
            console.log('No Gaussian Splats loaded to hide');
            if (window.displayMessage) {
                window.displayMessage('No digital twin loaded', 0.3, 2, 0.3);
            }
            return;
        }
        
        console.log('Hiding all Gaussian Splats...');
        
        // Store splat data for restoration
        for (const [siteId, tileset] of this.loadedTilesets.entries()) {
            console.log(`Storing splat data for site: ${siteId}`);
            
            // Store the tileset URL for reloading
            this.hiddenSplatData.set(siteId, {
                tilesetUrl: window.TerrainConfig ? 
                    window.TerrainConfig.getDataUrl(`${siteId}/tileset.json`) :
                    `/data/${siteId}/tileset.json`,
                bounds: tileset.boundingSphere,
                modelMatrix: tileset.modelMatrix,
                clippingEnabled: this.clippingPolygons.has(siteId)
            });
        }
        
        // Remove all loaded splats (similar to removeAllSplats but don't clear clipping)
        for (const [siteId, tileset] of this.loadedTilesets.entries()) {
            console.log(`Hiding tileset for site: ${siteId}`);
            
            try {
                // Clear clipping from tileset before removing to prevent collection destruction
                if (tileset.clippingPolygons) {
                    tileset.clippingPolygons = undefined;
                }
                
                // Remove from scene primitives
                if (this.viewer && this.viewer.scene && this.viewer.scene.primitives) {
                    this.viewer.scene.primitives.remove(tileset);
                }
                
                // Remove event listeners to prevent memory leaks
                if (tileset.tileLoad) {
                    tileset.tileLoad.removeEventListener();
                }
                if (tileset.tileFailed) {
                    tileset.tileFailed.removeEventListener();
                }
                if (tileset.loadProgress) {
                    tileset.loadProgress.removeEventListener();
                }
                
                // Remove bounds visualization if it exists
                this.removeBoundsVisualization(siteId);
                
                console.log(`Successfully hidden tileset for site: ${siteId}`);
            } catch (error) {
                console.warn(`Error hiding tileset for ${siteId}:`, error);
            }
        }
        
        // Clear the loaded tilesets map
        this.loadedTilesets.clear();
        
        // Remove all loading indicators
        for (const siteId of this.loadingIndicators.keys()) {
            this.removeLoadingIndicator(siteId);
        }
        
        this.splatsHidden = true;
        this.updateToggleButtonState();
        
        console.log('All Gaussian Splats hidden successfully');
        if (window.displayMessage) {
            window.displayMessage('Digital twin hidden', 0.3, 2, 0.3);
        }
    }
    
    /**
     * Shows all previously hidden Gaussian Splats
     */
    async showAllSplats() {
        if (this.hiddenSplatData.size === 0) {
            console.log('No hidden splat data to restore');
            if (window.displayMessage) {
                window.displayMessage('No digital twin to restore', 0.3, 2, 0.3);
            }
            return;
        }
        
        console.log('Restoring all hidden Gaussian Splats...');
        
        // Restore each hidden splat
        for (const [siteId, splatData] of this.hiddenSplatData.entries()) {
            console.log(`Restoring splat for site: ${siteId}`);
            
            try {
                // Reload the tileset with optimized settings
                console.log(`Reloading tileset from: ${splatData.tilesetUrl}`);
                
                let tilesetOptions = {
                    // UPDATED: Match enhanced Gaussian Splat prioritization settings
                    maximumScreenSpaceError: 6,              // Higher quality (8 -> 6)
                    maximumMemoryUsage: 512,                 // Double memory (256 -> 512MB)
                    cullRequestsWhileMoving: true,
                    cullRequestsWhileMovingMultiplier: 30.0, // Less aggressive (60 -> 30) for more splats
                    preloadWhenHidden: true,                 // NOW preload (false -> true)
                    preloadFlightDestinations: true,        // NOW preload destinations (false -> true)
                    immediatelyLoadDesiredLevelOfDetail: true, // Prioritize detail (false -> true)
                    skipLevelOfDetail: false,
                    dynamicScreenSpaceError: true,
                    dynamicScreenSpaceErrorDensity: 0.8,     // Less aggressive (0.5 -> 0.8)
                    dynamicScreenSpaceErrorFactor: 4.0,      // Lower factor (8 -> 4)
                    processingPriority: 1000,               // Maximum priority
                    enableShowOutline: false,
                    enableDebugWireframe: false,
                    cacheBytes: 536870912,
                    maximumCacheOverflowBytes: 134217728
                };
                
                // When running locally, override the base path to use GCS for content.glb
                if (window.TerrainConfig && window.TerrainConfig.isLocal) {
                    tilesetOptions.basePath = window.TerrainConfig.getGcsUrl(siteId, '');
                }
                
                const tileset = await Cesium.Cesium3DTileset.fromUrl(splatData.tilesetUrl, tilesetOptions);
                
                // Restore model matrix if it was modified
                if (splatData.modelMatrix) {
                    tileset.modelMatrix = splatData.modelMatrix;
                }
                
                // Add tileset to scene
                this.viewer.scene.primitives.add(tileset);
                
                // Add event listeners for debugging
                tileset.tileLoad.addEventListener((tile) => {
                    console.log(`Restored tile loaded for ${siteId}:`, tile);
                });
                
                tileset.tileFailed.addEventListener((error) => {
                    console.error(`Restored tile failed for ${siteId}:`, error);
                });
                
                tileset.loadProgress.addEventListener((numberOfPendingRequests, numberOfTilesProcessing) => {
                    console.log(`Restored loading progress for ${siteId}: ${numberOfPendingRequests} pending, ${numberOfTilesProcessing} processing`);
                });
                
                // Store the restored tileset
                this.loadedTilesets.set(siteId, tileset);
                
                console.log(`Splat restored successfully for site: ${siteId}`);
                
                // Restore clipping if it was enabled (similar to HQ/Perf mode pattern)
                if (splatData.clippingEnabled) {
                    setTimeout(() => {
                        console.log(`Restoring clipping for site: ${siteId}`);
                        if (window.GaussianSplatManager.prototype.loadPrecomputedClipping) {
                            window.gaussianSplatManager.loadPrecomputedClipping(siteId, tileset)
                                .catch(error => {
                                    console.error(`Failed to restore clipping for ${siteId}:`, error);
                                });
                        }
                    }, 1000); // Wait for tileset to load
                }
                
            } catch (error) {
                console.error(`Error restoring splat for ${siteId}:`, error);
            }
        }
        
        // Clear hidden data
        this.hiddenSplatData.clear();
        
        this.splatsHidden = false;
        this.updateToggleButtonState();
        
        console.log('All hidden Gaussian Splats restored successfully');
        if (window.displayMessage) {
            window.displayMessage('Digital twin restored, loading...', 0.3, 2, 0.3);
        }
    }
    
    /**
     * Removes all loaded Gaussian Splats completely
     */
    removeAllSplats() {
        if (this.loadedTilesets.size === 0) {
            console.log('No Gaussian Splats loaded to remove');
            if (window.displayMessage) {
                window.displayMessage('No digital twin loaded', 0.3, 2, 0.3);
            }
            return;
        }
        
        console.log('Removing all Gaussian Splats...');
        
        // Remove all loaded splats
        for (const [siteId, tileset] of this.loadedTilesets.entries()) {
            console.log(`Removing tileset for site: ${siteId}`);
            
            try {
                // Remove from scene primitives
                if (this.viewer && this.viewer.scene && this.viewer.scene.primitives) {
                    this.viewer.scene.primitives.remove(tileset);
                }
                
                // Remove event listeners to prevent memory leaks
                if (tileset.tileLoad) {
                    tileset.tileLoad.removeEventListener();
                }
                if (tileset.tileFailed) {
                    tileset.tileFailed.removeEventListener();
                }
                if (tileset.loadProgress) {
                    tileset.loadProgress.removeEventListener();
                }
                
                // Remove bounds visualization if it exists
                this.removeBoundsVisualization(siteId);
                
                // Remove terrain clipping if it exists
                // this.removeTerrainClipping(siteId); // DISABLED for testing - keep clipping visible
                
                console.log(`Successfully removed tileset for site: ${siteId}`);
            } catch (error) {
                console.warn(`Error removing tileset for ${siteId}:`, error);
            }
        }
        
        // Clear the loaded tilesets map
        this.loadedTilesets.clear();
        
        // Remove all loading indicators
        for (const siteId of this.loadingIndicators.keys()) {
            this.removeLoadingIndicator(siteId);
        }
        
        // Reset toggle state
        this.splatsHidden = false;
        this.hiddenSplatData.clear();
        this.updateToggleButtonState();
        
        console.log('All Gaussian Splats removed successfully');
        
        // Display message
        if (window.displayMessage) {
            window.displayMessage('Digital twin and terrain clipping removed', 0.3, 2, 0.3);
        }
    }
    
    
    /**
     * Configures advanced performance optimizations for a loaded tileset
     * @param {Cesium.Cesium3DTileset} tileset - The loaded tileset
     * @param {string} siteId - Site identifier for debugging
     */
    configureTilesetPerformance(tileset, siteId) {
        try {
            // Configuring performance optimizations
            
            // Set up camera movement handler for dynamic performance adjustment
            // Use unified handler instead of separate handlers to prevent conflicts
            if (!window.unifiedCameraHandler) {
                this.createUnifiedCameraHandler();
            }
            
            // DISABLED: Individual handler replaced by unified system
            // Old individual handlers caused performance conflicts
            if (false && !this.cameraMovementHandler) {
                this.cameraMovementHandler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
                this.isCameraMoving = false;
                this.cameraMovementTimeout = null;
                
                // Track camera movement start
                this.cameraMovementHandler.setInputAction(() => {
                    const startTime = performance.now();
                    
                    if (!this.isCameraMoving) {
                        this.isCameraMoving = true;
                        const optimizeStart = performance.now();
                        this.optimizeForMovement(true);
                        const optimizeEnd = performance.now();
                        console.log(`🟡 Gaussian Camera Movement START - optimize took ${(optimizeEnd - optimizeStart).toFixed(2)}ms`);
                    }
                    
                    // Clear existing timeout
                    if (this.cameraMovementTimeout) {
                        clearTimeout(this.cameraMovementTimeout);
                    }
                    
                    // Set timeout to detect movement end
                    this.cameraMovementTimeout = setTimeout(() => {
                        const restoreStart = performance.now();
                        this.isCameraMoving = false;
                        this.optimizeForMovement(false);
                        const restoreEnd = performance.now();
                        console.log(`🟡 Gaussian Camera Movement END - restore took ${(restoreEnd - restoreStart).toFixed(2)}ms`);
                    }, 150); // 150ms delay before considering movement stopped
                    
                    const totalTime = performance.now() - startTime;
                    if (totalTime > 1) {
                        console.log(`🟡 Gaussian handleCameraMovement (mouse) total: ${totalTime.toFixed(2)}ms`);
                    }
                }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
                
                // Also track wheel events for zoom  
                this.cameraMovementHandler.setInputAction(() => {
                    const startTime = performance.now();
                    
                    if (!this.isCameraMoving) {
                        this.isCameraMoving = true;
                        const optimizeStart = performance.now();
                        this.optimizeForMovement(true);
                        const optimizeEnd = performance.now();
                        console.log(`🟡 Gaussian Camera WHEEL START - optimize took ${(optimizeEnd - optimizeStart).toFixed(2)}ms`);
                    }
                    if (this.cameraMovementTimeout) {
                        clearTimeout(this.cameraMovementTimeout);
                    }
                    this.cameraMovementTimeout = setTimeout(() => {
                        const restoreStart = performance.now();
                        this.isCameraMoving = false;
                        this.optimizeForMovement(false);
                        const restoreEnd = performance.now();
                        console.log(`🟡 Gaussian Camera WHEEL END - restore took ${(restoreEnd - restoreStart).toFixed(2)}ms`);
                    }, 300); // Longer delay for zoom
                    
                    const totalTime = performance.now() - startTime;
                    if (totalTime > 1) {
                        console.log(`🟡 Gaussian handleCameraMovement (wheel) total: ${totalTime.toFixed(2)}ms`);
                    }
                }, Cesium.ScreenSpaceEventType.WHEEL);
            }
            
            // DISABLED: Load progress SSE adjustment replaced by UnifiedLODManager
            // Dynamic SSE adjustment is now handled by the unified system to prevent conflicts
            // The UnifiedLODManager tracks load activity and adjusts quality accordingly
            
            // Optional: Lightweight logging for debugging (no SSE modification)
            tileset.loadProgress.addEventListener((numberOfPendingRequests, numberOfTilesProcessing) => {
                const totalActive = numberOfPendingRequests + numberOfTilesProcessing;
                // Minimal logging only for significant events
                if (totalActive === 0) {
                    console.log(`Gaussian Splat ${siteId}: Loading completed`);
                }
            });
            
            // Set up distance-based LOD adjustment
            this.setupDistanceBasedLOD(tileset, siteId);
            
            // Performance optimizations configured
            
        } catch (error) {
            console.error(`Error configuring performance for ${siteId}:`, error);
        }
    }
    
    /**
     * Optimizes all loaded tilesets based on camera movement state
     * @param {boolean} isMoving - Whether camera is currently moving
     */
    optimizeForMovement(isMoving) {
        const startTime = performance.now();
        let tilesetsProcessed = 0;
        
        for (const [siteId, tileset] of this.loadedTilesets.entries()) {
            if (tileset && !tileset.isDestroyed?.()) {
                const tilesetStart = performance.now();
                
                if (isMoving) {
                    // Reduce quality during movement for better FPS
                    tileset.maximumScreenSpaceError = 24;
                    tileset.cullRequestsWhileMoving = true;
                    tileset.cullRequestsWhileMovingMultiplier = 60.0;
                    tileset.immediatelyLoadDesiredLevelOfDetail = false;
                } else {
                    // Restore quality when camera stops
                    tileset.maximumScreenSpaceError = 8;
                    tileset.cullRequestsWhileMoving = false;
                    tileset.immediatelyLoadDesiredLevelOfDetail = true;
                }
                
                const tilesetEnd = performance.now();
                tilesetsProcessed++;
                
                if (tilesetEnd - tilesetStart > 0.5) {
                    console.log(`🟡 Gaussian tileset ${siteId} optimize ${isMoving ? 'START' : 'END'}: ${(tilesetEnd - tilesetStart).toFixed(2)}ms`);
                }
            }
        }
        
        const totalTime = performance.now() - startTime;
        if (totalTime > 1) {
            console.log(`🟡 Gaussian optimizeForMovement ${isMoving ? 'START' : 'END'}: processed ${tilesetsProcessed} tilesets in ${totalTime.toFixed(2)}ms`);
        }
    }
    
    /**
     * Registers tileset with unified LOD management system
     * @param {Cesium.Cesium3DTileset} tileset - The tileset to configure
     * @param {string} siteId - Site identifier
     */
    setupDistanceBasedLOD(tileset, siteId) {
        // Register with unified LOD manager instead of individual system
        if (window.unifiedLODManager) {
            window.unifiedLODManager.registerTileset(siteId, tileset, 'gaussian');
            console.log(`Gaussian Splat ${siteId} registered with UnifiedLODManager`);
        } else {
            console.warn(`UnifiedLODManager not available for ${siteId} - LOD management disabled`);
        }
    }
    
    /**
     * Creates a unified camera movement handler that coordinates all tileset optimizations
     * This prevents multiple competing handlers from causing performance issues
     */
    createUnifiedCameraHandler() {
        // CRITICAL FIX: Don't recreate if handler already exists (prevents exponential event listeners)
        if (window.unifiedCameraHandler) {
            console.log('UnifiedCameraHandler already exists - skipping creation to prevent duplicate event listeners');
            return;
        }
        
        // Creating unified camera movement handler
        console.log('Creating new UnifiedCameraHandler');
        
        window.unifiedCameraHandler = {
            handler: new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas),
            isMoving: false,
            timeout: null,
            lastCameraPosition: null,
            lastCameraOrientation: null,
            movementThreshold: 1.0, // Increased from 0.1 to 1.0 meters/radians for less sensitivity
            eventCount: 0,
            lastProcessTime: 0,
            minProcessInterval: 8, // Process at most every 8ms (120fps max for movement detection)
            timeoutActive: false, // Track if timeout is already set to avoid thrashing
            
            // CRITICAL GC OPTIMIZATION: Pre-allocated objects to avoid garbage collection during movement
            _tempCartographic: new Cesium.Cartographic(),
            _lastCameraSpeed: 0,
            _cameraSpeedSamples: [],
            
            // Check if camera has moved significantly with zero-allocation calculations
            hasSignificantMovement: () => {
                const camera = this.viewer.camera;
                
                // CRITICAL: Use pre-existing cartographic object to avoid GC pressure
                camera.positionCartographic.clone(window.unifiedCameraHandler._tempCartographic);
                const currentHeight = window.unifiedCameraHandler._tempCartographic.height;
                const currentHeading = camera.heading;
                const currentPitch = camera.pitch;
                
                if (!window.unifiedCameraHandler.lastCameraPosition) {
                    // Initialize with current values (one-time allocation)
                    window.unifiedCameraHandler.lastCameraPosition = { height: currentHeight };
                    window.unifiedCameraHandler.lastCameraOrientation = { 
                        heading: currentHeading, 
                        pitch: currentPitch 
                    };
                    return false;
                }
                
                // Check height change (much faster than 3D distance, no allocation)
                const heightDiff = Math.abs(currentHeight - window.unifiedCameraHandler.lastCameraPosition.height);
                
                // Check orientation change (only heading and pitch - roll is rarely used, no allocation)
                const headingDiff = Math.abs(currentHeading - window.unifiedCameraHandler.lastCameraOrientation.heading);
                const pitchDiff = Math.abs(currentPitch - window.unifiedCameraHandler.lastCameraOrientation.pitch);
                
                // PRIORITIZED: Ultra-sensitive thresholds for immediate Gaussian Splat optimization
                const hasMovement = heightDiff > (window.unifiedCameraHandler.movementThreshold * 0.5) || // HALVED: 0.5m height change (was 2m)
                                  headingDiff > (window.unifiedCameraHandler.movementThreshold * 0.05) || // HALVED: 0.05 radian heading (was 0.1)
                                  pitchDiff > (window.unifiedCameraHandler.movementThreshold * 0.05);    // HALVED: 0.05 radian pitch (was 0.1)
                
                if (hasMovement) {
                    // Calculate camera movement speed for adaptive quality
                    const totalMovement = heightDiff + (headingDiff * 100) + (pitchDiff * 100); // Scale orientation changes
                    window.unifiedCameraHandler._cameraSpeedSamples.push(totalMovement);
                    
                    // Keep only last 5 samples for speed calculation
                    if (window.unifiedCameraHandler._cameraSpeedSamples.length > 5) {
                        window.unifiedCameraHandler._cameraSpeedSamples.shift();
                    }
                    
                    // Calculate average speed
                    const avgSpeed = window.unifiedCameraHandler._cameraSpeedSamples.reduce((a, b) => a + b, 0) / window.unifiedCameraHandler._cameraSpeedSamples.length;
                    window.unifiedCameraHandler._lastCameraSpeed = avgSpeed;
                    
                    // Update cached values efficiently (no allocation)
                    window.unifiedCameraHandler.lastCameraPosition.height = currentHeight;
                    window.unifiedCameraHandler.lastCameraOrientation.heading = currentHeading;
                    window.unifiedCameraHandler.lastCameraOrientation.pitch = currentPitch;
                }
                
                return hasMovement;
            },
            
            // Intelligent movement handler with time-based debouncing
            startMovement: () => {
                const now = performance.now();
                
                // Time-based throttling: Process at most every 8ms for immediate response
                if (now - window.unifiedCameraHandler.lastProcessTime < window.unifiedCameraHandler.minProcessInterval) {
                    // Set timeout only once to avoid timeout thrashing
                    if (!window.unifiedCameraHandler.timeoutActive) {
                        window.unifiedCameraHandler.timeoutActive = true;
                        window.unifiedCameraHandler.timeout = setTimeout(() => {
                            window.unifiedCameraHandler.isMoving = false;
                            window.unifiedCameraHandler.timeoutActive = false;
                            // Camera movement ended efficiently
                        }, 300); // Longer timeout for smoother experience
                    }
                    return; // Skip processing but timeout is managed
                }
                
                window.unifiedCameraHandler.lastProcessTime = now;
                
                // Check if this is significant movement (only when we actually process)
                if (!window.unifiedCameraHandler.hasSignificantMovement()) {
                    return;
                }
                
                if (!window.unifiedCameraHandler.isMoving) {
                    const startTime = performance.now();
                    window.unifiedCameraHandler.isMoving = true;
                
                    // CRITICAL: Enable high frequency rendering during camera movement
                    if (window.renderManager) {
                        window.renderManager.enableHighFrequency();
                    }
                
                    // SMOKING GUN: Aggressively reduce Gaussian Splat quality during motion for 60+fps
                    if (window.gaussianSplatManager) {
                        const cameraSpeed = window.unifiedCameraHandler._lastCameraSpeed || 0;
                        window.gaussianSplatManager.enterMotionMode(cameraSpeed);
                    }
                
                    // Optimize all tilesets through unified LOD manager
                    if (window.unifiedLODManager) {
                        window.unifiedLODManager.optimizeForMovement(true);
                    } else {
                        // Fallback to individual optimization if unified manager not available
                        if (window.map3D && window.map3D.optimizePhotorealisticForMovement) {
                            window.map3D.optimizePhotorealisticForMovement(true);
                        }
                        if (window.gaussianSplatManager && window.gaussianSplatManager.optimizeForMovement) {
                            window.gaussianSplatManager.optimizeForMovement(true);
                        }
                    }
                    
                    const totalTime = performance.now() - startTime;
                    // Camera movement optimization started
                }
                
                // Efficiently manage restoration timeout (avoid thrashing)
                if (window.unifiedCameraHandler.timeoutActive) {
                    clearTimeout(window.unifiedCameraHandler.timeout);
                }
                
                // Set restoration timeout with proper state management
                window.unifiedCameraHandler.timeoutActive = true;
                window.unifiedCameraHandler.timeout = setTimeout(() => {
                    const startTime = performance.now();
                    window.unifiedCameraHandler.isMoving = false;
                    window.unifiedCameraHandler.timeoutActive = false;
                    
                    // CRITICAL: Disable high frequency rendering when movement ends
                    if (window.renderManager) {
                        window.renderManager.disableHighFrequency();
                    }
                    
                    // SMOKING GUN: Progressively restore Gaussian Splat quality after motion stops
                    if (window.gaussianSplatManager) {
                        window.gaussianSplatManager.exitMotionMode();
                    }
                    
                    // Restore all tilesets through unified LOD manager
                    if (window.unifiedLODManager) {
                        window.unifiedLODManager.optimizeForMovement(false);
                    } else {
                        // Fallback to individual restoration if unified manager not available
                        if (window.map3D && window.map3D.optimizePhotorealisticForMovement) {
                            window.map3D.optimizePhotorealisticForMovement(false);
                        }
                        if (window.gaussianSplatManager && window.gaussianSplatManager.optimizeForMovement) {
                            window.gaussianSplatManager.optimizeForMovement(false);
                        }
                    }
                    
                    const totalTime = performance.now() - startTime;
                    // Camera movement optimization restored efficiently
                }, 150); // FASTER timeout (300->150ms) to restore Gaussian Splat quality quicker
            }
        };
        
        // Bind to mouse movement
        window.unifiedCameraHandler.handler.setInputAction(() => {
            window.unifiedCameraHandler.startMovement();
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        
        // Bind to wheel events
        window.unifiedCameraHandler.handler.setInputAction(() => {
            window.unifiedCameraHandler.startMovement();
        }, Cesium.ScreenSpaceEventType.WHEEL);
        
        // Unified camera handler created
    }
    
    /**
     * Sets up performance monitoring for a tileset
     * @param {Cesium.Cesium3DTileset} tileset - The tileset to monitor
     * @param {string} siteId - Site identifier
     */
    setupPerformanceMonitoring(tileset, siteId) {
        if (!this.performanceStats) {
            this.performanceStats = new Map();
        }
        
        const stats = {
            siteId: siteId,
            loadStartTime: Date.now(),
            tilesLoaded: 0,
            tilesFailed: 0,
            memoryUsage: 0,
            averageLoadTime: 0,
            lastFrameTime: performance.now(),
            frameCount: 0,
            fps: 0,
            performanceInterval: null  // Store interval ID for cleanup
        };
        
        // Monitor tile loading
        tileset.tileLoad.addEventListener((tile) => {
            stats.tilesLoaded++;
            const loadTime = Date.now() - stats.loadStartTime;
            stats.averageLoadTime = loadTime / stats.tilesLoaded;
            
            // Estimate memory usage (rough calculation)
            if (tile._content && tile._content._geometryByteLength) {
                stats.memoryUsage += tile._content._geometryByteLength;
            }
            
            console.log(`Tile loaded for ${siteId}: Total=${stats.tilesLoaded}, Avg Load Time=${stats.averageLoadTime.toFixed(0)}ms`);
        });
        
        tileset.tileFailed.addEventListener((error) => {
            stats.tilesFailed++;
            console.warn(`Tile failed for ${siteId}: Total failed=${stats.tilesFailed}`, error);
        });
        
        // Monitor frame rate impact with lightweight 5-second sampling (no 60fps loops)
        const performanceSampler = () => {
            if (tileset.isDestroyed?.()) {
                clearInterval(stats.performanceInterval);
                return;
            }
            
            const now = performance.now();
            const deltaTime = now - stats.lastFrameTime;
            
            // Simple FPS estimation based on time delta (no frame counting)
            if (deltaTime > 0) {
                stats.fps = 1000 / deltaTime;
            }
            
            stats.lastFrameTime = now;
            
            // Minimal logging - only first time to reduce console spam
            if (!this.performanceStatsLogged) {
                this.performanceStatsLogged = true;
                console.log(`Performance monitoring enabled for ${siteId} with 5-second sampling`);
            }
        };
        
        // Use 5-second interval instead of 60fps animation frame
        stats.performanceInterval = setInterval(performanceSampler, 5000);
        this.performanceStats.set(siteId, stats);
    }
    
    /**
     * Gets performance statistics for a site
     * @param {string} siteId - Site identifier
     * @returns {Object|null} Performance stats or null if not found
     */
    getPerformanceStats(siteId) {
        return this.performanceStats?.get(siteId) || null;
    }
    
    /**
     * Gets performance statistics for all loaded sites
     * @returns {Object} Performance stats for all sites
     */
    getAllPerformanceStats() {
        const allStats = {};
        if (this.performanceStats) {
            for (const [siteId, stats] of this.performanceStats.entries()) {
                allStats[siteId] = {
                    fps: parseFloat(stats.fps.toFixed(1)),
                    tilesLoaded: stats.tilesLoaded,
                    tilesFailed: stats.tilesFailed,
                    memoryUsageMB: parseFloat((stats.memoryUsage / 1024 / 1024).toFixed(1)),
                    averageLoadTimeMs: parseInt(stats.averageLoadTime)
                };
            }
        }
        return allStats;
    }
    
    /**
     * Checks if current Cesium version supports Gaussian Splats
     */
    checkGaussianSplatSupport() {
        // Check if 3D Tiles extension support exists
        const has3DTilesContentGltf = Cesium.Cesium3DTileset.prototype.hasOwnProperty('_extensionsUsed');
        const cesiumVersion = Cesium.VERSION;
        
        // Check Cesium version for Gaussian Splat support
        const versionParts = cesiumVersion.split('.').map(Number);
        const majorVersion = versionParts[0];
        const minorVersion = versionParts[1];
        
        const supportsGaussianSplats = majorVersion > 1 || (majorVersion === 1 && minorVersion >= 110);
        
        if (!supportsGaussianSplats) {
            console.warn('This Cesium version may not fully support Gaussian Splats. Consider upgrading to 1.110+');
        }
        
        return supportsGaussianSplats;
    }
    
    /**
     * Checks if a site has Gaussian Splat data available
     * @param {string} siteId - Site identifier (e.g., 'scott-boyd-residence')
     * @returns {Promise<boolean>} - True if splat data exists
     */
    async hasSplatData(siteId) {
        try {
            const tilesetUrl = window.TerrainConfig ? 
                window.TerrainConfig.getDataUrl(`${siteId}/tileset.json`) :
                `/data/${siteId}/tileset.json`;
            const response = await fetch(tilesetUrl, { method: 'HEAD' });
            return response.ok;
        } catch (error) {
            console.log(`No Gaussian Splat data found for site: ${siteId}`);
            return false;
        }
    }
    
    /**
     * Creates and shows a loading indicator overlay
     * @param {string} siteId - Site identifier
     * @param {Object} bounds - Site bounds for positioning
     */
    createLoadingIndicator(siteId, bounds) {
        // Remove any existing indicator for this site
        this.removeLoadingIndicator(siteId);
        
        // Calculate center point for the loading indicator
        const centerLat = (bounds.minLat + bounds.maxLat) / 2;
        const centerLng = (bounds.minLng + bounds.maxLng) / 2;
        
        // Create a visual entity to show loading state
        const loadingEntity = this.viewer.entities.add({
            name: `Loading_Indicator_${siteId}`,
            position: Cesium.Cartesian3.fromDegrees(centerLng, centerLat, 50), // 50m above ground
            billboard: {
                image: this.createLoadingImage(),
                width: 200,
                height: 200,
                heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                scale: 1.0
            },
            label: {
                text: 'Loading Digital Twin...',
                font: '16pt Oxygen',
                fillColor: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                pixelOffset: new Cesium.Cartesian2(0, 120),
                heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            }
        });
        
        this.loadingIndicators.set(siteId, loadingEntity);
        // Loading indicator created
    }
    
    /**
     * Creates a static loading image instead of animated canvas to avoid rendering issues
     * @returns {string} - Data URL for a static loading image
     */
    createLoadingImage() {
        // Create a simple static loading image using canvas
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 200;
        const ctx = canvas.getContext('2d');
        
        // Draw static loading indicator
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw outer circle background
        ctx.beginPath();
        ctx.arc(100, 100, 80, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(7, 43, 46, 0.8)'; // Ecodash blue with transparency
        ctx.fill();
        
        // Draw inner circle
        ctx.beginPath();
        ctx.arc(100, 100, 60, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fill();
        
        // Draw static loading segments
        ctx.save();
        ctx.translate(100, 100);
        
        // Draw loading segments with varying opacity
        for (let i = 0; i < 8; i++) {
            ctx.save();
            ctx.rotate((i * Math.PI) / 4);
            ctx.beginPath();
            ctx.fillRect(-4, -50, 8, 20);
            ctx.fillStyle = `rgba(7, 43, 46, ${0.2 + (i / 8) * 0.8})`;
            ctx.fill();
            ctx.restore();
        }
        
        ctx.restore();
        
        // Convert to data URL and clean up
        const dataUrl = canvas.toDataURL();
        
        // Explicitly clean up canvas context
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        return dataUrl;
    }
    
    /**
     * Removes the loading indicator for a site with proper cleanup
     * @param {string} siteId - Site identifier
     */
    removeLoadingIndicator(siteId) {
        const indicator = this.loadingIndicators.get(siteId);
        if (indicator) {
            try {
                // Check if entities collection still exists
                if (this.viewer && this.viewer.entities && typeof this.viewer.entities.remove === 'function') {
                    this.viewer.entities.remove(indicator);
                }
                this.loadingIndicators.delete(siteId);
                // Loading indicator removed
            } catch (error) {
                console.warn(`Error removing loading indicator for ${siteId}:`, error);
                // Force remove from map even if entity removal failed
                this.loadingIndicators.delete(siteId);
            }
        }
    }
    
    /**
     * Loads a Gaussian Splat tileset for a site
     * @param {string} siteId - Site identifier (e.g., 'scott-boyd-residence')
     * @param {Object} bounds - Site bounds for loading indicator positioning
     * @returns {Promise<Cesium.Cesium3DTileset|null>} - Loaded tileset or null if failed
     */
    async loadGaussianSplat(siteId, bounds) {
        // Check if already loaded
        if (this.loadedTilesets.has(siteId)) {
            console.log(`Gaussian Splat already loaded for site: ${siteId}`);
            return this.loadedTilesets.get(siteId);
        }
        
        // Check if splat data exists
        const hasSplat = await this.hasSplatData(siteId);
        if (!hasSplat) {
            console.log(`No Gaussian Splat data available for site: ${siteId}`);
            // Complete independent loading since there's no splat to load
            if (window.independentLoadingState) {
                // Brief delay to let progress animation reach a reasonable point
                setTimeout(() => {
                    window.independentLoadingState.complete();
                }, 3000); // 3 second delay to show some progress
            }
            return null;
        }
        
        this.isLoading = true;
        this.loadingStartTime = Date.now();
        
        // Skip 3D scene loading indicator to avoid conflicts with main loading screen
        // this.createLoadingIndicator(siteId, bounds);
        
        try {
            const tilesetUrl = window.TerrainConfig ? 
                window.TerrainConfig.getDataUrl(`${siteId}/tileset.json`) :
                `/data/${siteId}/tileset.json`;
            // Gaussian Splat loading logging removed for cleaner console output
            
            // Update loading message for Gaussian Splat phase
            if (window.independentLoadingState) {
                // window.independentLoadingState.updateMessage('Growing native plant database...', 6000);
            }
            
            // Use a completely non-blocking approach with immediate promise resolution
            this.loadTilesetAsync(tilesetUrl, siteId, bounds);
            
            // Loading screen now runs independently with its own timing
            
            this.isLoading = false;
            
            // Return a promise that resolves when tileset is actually loaded
            return new Promise((resolve) => {
                // Check periodically if tileset has been loaded
                const checkLoaded = () => {
                    if (this.loadedTilesets.has(siteId)) {
                        resolve(this.loadedTilesets.get(siteId));
                    } else {
                        setTimeout(checkLoaded, 100);
                    }
                };
                setTimeout(checkLoaded, 100);
            });
            
        } catch (error) {
            console.error(`Failed to load Gaussian Splat for site ${siteId}:`, error);
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
            
            // Try to determine the specific issue and provide actionable feedback
            let errorMessage = 'Failed to load digital twin';
            let shouldRetry = false;
            
            if (error.message && error.message.includes('timeout')) {
                errorMessage = 'Digital twin loading timed out (15s limit exceeded)';
                console.warn('Large Gaussian Splat detected. File size: 56MB is causing slow loading.');
                console.warn('Recommendations:');
                console.warn('1. Consider splitting the splat into smaller tiles');
                console.warn('2. Use lower resolution splat for faster loading');
                console.warn('3. Implement progressive streaming');
                shouldRetry = true;
            } else if (error.message && error.message.includes('updateTransform')) {
                errorMessage = 'Gaussian Splat format not fully supported in this Cesium version';
                console.warn('Suggestion: This appears to be a Cesium/Gaussian Splat compatibility issue.');
                console.warn('Try using Cesium 1.115+ or check if the tileset uses supported extensions.');
            } else if (error.message && error.message.includes('network')) {
                errorMessage = 'Network error loading digital twin';
                shouldRetry = true;
            } else if (error.message && error.message.includes('memory')) {
                errorMessage = 'Insufficient memory to load digital twin';
                console.warn('Try reducing memory usage by:');
                console.warn('1. Closing other browser tabs');
                console.warn('2. Reducing Google Photorealistic tile quality');
                console.warn('3. Using a device with more RAM');
            }
            
            // Loading indicator skipped - using main loading screen instead
            this.isLoading = false;
            
            // Complete independent loading even on error
            if (window.independentLoadingState) {
                // Make sure we're not stuck waiting for trigger on error
                window.independentLoadingState.waitingForTrigger = false;
                window.independentLoadingState.complete();
            }
            
            // Offer retry option for timeout/network errors
            if (shouldRetry && window.displayMessage) {
                setTimeout(() => {
                    window.displayMessage(`${errorMessage}. Try reducing quality or refresh to retry.`, 0.5, 6, 0.5);
                }, 1000);
            } else if (window.displayMessage) {
                setTimeout(() => {
                    window.displayMessage(errorMessage, 0.5, 4, 0.5);
                }, 1000);
            }
            
            // Log performance recommendation
            if (error.message && error.message.includes('timeout')) {
                console.log('PERFORMANCE TIP: For 56MB Gaussian splats, consider:');
                console.log('- Using compressed formats (.spz with higher compression)');
                console.log('- Creating LOD pyramid with multiple resolution levels');
                console.log('- Implementing tile-based streaming instead of single large file');
            }
            
            return null;
        }
    }
    
    /**
     * Shows or hides a loaded Gaussian Splat
     * @param {string} siteId - Site identifier
     * @param {boolean} visible - Whether to show the splat
     */
    setSplatVisibility(siteId, visible) {
        const tileset = this.loadedTilesets.get(siteId);
        if (tileset) {
            tileset.show = visible;
            console.log(`Gaussian Splat visibility set to ${visible} for site: ${siteId}`);
        }
    }
    
    /**
     * Unloads a Gaussian Splat tileset with proper cleanup
     * @param {string} siteId - Site identifier
     */
    unloadSplat(siteId) {
        const tileset = this.loadedTilesets.get(siteId);
        if (tileset) {
            try {
                // Safely remove tileset from scene
                if (this.viewer && this.viewer.scene && this.viewer.scene.primitives) {
                    // Remove event listeners to prevent memory leaks
                    if (tileset.tileLoad) {
                        tileset.tileLoad.removeEventListener();
                    }
                    if (tileset.tileFailed) {
                        tileset.tileFailed.removeEventListener();
                    }
                    if (tileset.loadProgress) {
                        tileset.loadProgress.removeEventListener();
                    }
                    
                    this.viewer.scene.primitives.remove(tileset);
                }
                
                // Remove bounds visualization if it exists
                this.removeBoundsVisualization(siteId);
                
                // Remove terrain clipping if it exists
                this.removeTerrainClipping(siteId);
                
                // Unregister from unified LOD manager
                if (window.unifiedLODManager) {
                    window.unifiedLODManager.unregisterTileset(siteId);
                }
                
                // Clean up legacy distance-based LOD intervals (if any remain)
                if (this.distanceUpdateIntervals && this.distanceUpdateIntervals.has(siteId)) {
                    clearInterval(this.distanceUpdateIntervals.get(siteId));
                    this.distanceUpdateIntervals.delete(siteId);
                    console.log(`Legacy distance LOD monitoring stopped for site: ${siteId}`);
                }
                
                // Clean up performance monitoring intervals
                if (this.performanceStats && this.performanceStats.has(siteId)) {
                    const stats = this.performanceStats.get(siteId);
                    if (stats.performanceInterval) {
                        clearInterval(stats.performanceInterval);
                        console.log(`Performance monitoring stopped for site: ${siteId}`);
                    }
                    this.performanceStats.delete(siteId);
                }
                
                this.loadedTilesets.delete(siteId);
                console.log(`Gaussian Splat unloaded for site: ${siteId}`);
            } catch (error) {
                console.warn(`Error unloading Gaussian Splat for ${siteId}:`, error);
                // Force remove from map even if primitive removal failed
                this.loadedTilesets.delete(siteId);
            }
        }
        
        // Also remove any loading indicators
        this.removeLoadingIndicator(siteId);
    }
    
    /**
     * Unloads all Gaussian Splats
     */
    unloadAllSplats() {
        for (const [siteId, tileset] of this.loadedTilesets) {
            this.viewer.scene.primitives.remove(tileset);
            console.log(`Gaussian Splat unloaded for site: ${siteId}`);
        }
        this.loadedTilesets.clear();
        
        // Clean up all distance-based LOD intervals
        if (this.distanceUpdateIntervals) {
            for (const [siteId, intervalId] of this.distanceUpdateIntervals.entries()) {
                clearInterval(intervalId);
                console.log(`Distance LOD monitoring stopped for site: ${siteId}`);
            }
            this.distanceUpdateIntervals.clear();
        }
        
        // Clean up all performance monitoring intervals
        if (this.performanceStats) {
            for (const [siteId, stats] of this.performanceStats.entries()) {
                if (stats.performanceInterval) {
                    clearInterval(stats.performanceInterval);
                    console.log(`Performance monitoring stopped for site: ${siteId}`);
                }
            }
            this.performanceStats.clear();
        }
        
        // Clean up unified camera movement handler (only if this is the last splat manager)
        if (window.unifiedCameraHandler && this.loadedTilesets.size === 0) {
            if (window.unifiedCameraHandler.handler) {
                window.unifiedCameraHandler.handler.destroy();
            }
            if (window.unifiedCameraHandler.timeout) {
                clearTimeout(window.unifiedCameraHandler.timeout);
            }
            window.unifiedCameraHandler = null;
            console.log('Unified camera movement handler destroyed (all splats unloaded)');
        }
        
        // Clean up legacy camera movement handler
        if (this.cameraMovementHandler) {
            this.cameraMovementHandler.destroy();
            this.cameraMovementHandler = null;
            console.log('Legacy camera movement handler destroyed');
        }
        
        // Remove all loading indicators
        for (const siteId of this.loadingIndicators.keys()) {
            this.removeLoadingIndicator(siteId);
        }
        
        // Remove all terrain clipping
        this.removeAllTerrainClipping();
    }
    
    /**
     * Gets the currently loaded tileset for a site
     * @param {string} siteId - Site identifier
     * @returns {Cesium.Cesium3DTileset|null} - Loaded tileset or null
     */
    getSplat(siteId) {
        return this.loadedTilesets.get(siteId) || null;
    }
    
    /**
     * Checks if a splat is currently loading
     * @returns {boolean} - True if loading
     */
    isSplatLoading() {
        return this.isLoading;
    }
    
    /**
     * SMOKING GUN: Enters motion mode with speed-adaptive quality reduction for 60+fps
     * @param {number} cameraSpeed - Current camera movement speed for adaptive quality
     */
    enterMotionMode(cameraSpeed = 0) {
        if (this.motionModeActive) return; // Already in motion mode
        
        this.motionModeActive = true;
        const startTime = performance.now();
        
        // Store original quality settings for restoration
        this.originalQualitySettings = new Map();
        
        for (const [siteId, tileset] of this.loadedTilesets.entries()) {
            if (!tileset || tileset.isDestroyed?.()) continue;
            
            // Store original settings
            this.originalQualitySettings.set(siteId, {
                maximumScreenSpaceError: tileset.maximumScreenSpaceError,
                cullRequestsWhileMovingMultiplier: tileset.cullRequestsWhileMovingMultiplier,
                immediatelyLoadDesiredLevelOfDetail: tileset.immediatelyLoadDesiredLevelOfDetail
            });
            
            // PRIORITIZED: Speed-adaptive quality with MORE splats rendered during motion
            // Since Google tiles are heavily reduced, we can render more Gaussian Splats during movement
            const speedFactor = Math.min(cameraSpeed / 15, 2.0); // Reduced speed factor (10->15, 3->2) for less degradation
            const motionSSE = Math.max(16, 6 * (1.5 + speedFactor)); // HIGHER quality during motion (32->16, better than 6*1.5=9 to 6*3.5=21)
            const motionCulling = Math.max(60.0, 30 * (1.5 + speedFactor)); // LESS aggressive culling (120->60, 60->30) for MORE splats
            
            tileset.maximumScreenSpaceError = motionSSE;           // IMPROVED quality during motion (32-96 -> 16-21)  
            tileset.cullRequestsWhileMovingMultiplier = motionCulling; // LESS culling (120-300 -> 60-105) for MORE splats
            tileset.immediatelyLoadDesiredLevelOfDetail = true; // PRIORITIZE detailed LOD loading for splats
            
            // Additional motion optimizations
            if (tileset.pointCloudShading) {
                tileset.pointCloudShading.attenuation = true;     // Enable distance attenuation
                tileset.pointCloudShading.geometricErrorScale = 2.0; // Reduce detail further
            }
        }
        
        const totalTime = performance.now() - startTime;
        console.log(`🟡 Motion Mode ENABLED: ${this.loadedTilesets.size} splats optimized in ${totalTime.toFixed(2)}ms (speed: ${cameraSpeed.toFixed(2)})`);
    }
    
    /**
     * SMOKING GUN: Exits motion mode with progressive quality restoration
     */
    exitMotionMode() {
        if (!this.motionModeActive) return; // Not in motion mode
        
        this.motionModeActive = false;
        const startTime = performance.now();
        
        // FASTER: Progressive quality restoration over 0.5 seconds for quicker Gaussian Splat quality return
        const restoreQuality = (step = 0) => {
            const maxSteps = 2; // FASTER: Restore quality over 2 steps instead of 4
            const stepProgress = step / maxSteps;
            
            for (const [siteId, tileset] of this.loadedTilesets.entries()) {
                if (!tileset || tileset.isDestroyed?.()) continue;
                
                const originalSettings = this.originalQualitySettings.get(siteId);
                if (!originalSettings) continue;
                
                // Progressive interpolation from motion quality to full quality
                const motionSSE = 64;
                const targetSSE = originalSettings.maximumScreenSpaceError;
                const currentSSE = motionSSE + (targetSSE - motionSSE) * stepProgress;
                
                tileset.maximumScreenSpaceError = Math.round(currentSSE);
                
                // Restore other settings on final step
                if (step === maxSteps - 1) {
                    tileset.cullRequestsWhileMovingMultiplier = originalSettings.cullRequestsWhileMovingMultiplier;
                    tileset.immediatelyLoadDesiredLevelOfDetail = originalSettings.immediatelyLoadDesiredLevelOfDetail;
                    
                    // Restore point cloud shading
                    if (tileset.pointCloudShading) {
                        tileset.pointCloudShading.attenuation = false;
                        tileset.pointCloudShading.geometricErrorScale = 1.0;
                    }
                }
            }
            
            // Continue restoration or finish
            if (step < maxSteps - 1) {
                setTimeout(() => restoreQuality(step + 1), 125); // FASTER: 125ms between steps (was 250ms)
            } else {
                this.originalQualitySettings.clear();
                const totalTime = performance.now() - startTime;
                console.log(`🟢 Motion Mode DISABLED: Quality restored in ${totalTime.toFixed(2)}ms`);
            }
        };
        
        // Start progressive restoration
        restoreQuality(0);
    }
    
    /**
     * Gets statistics about loaded splats
     * @returns {Object} - Statistics object
     */
    getStats() {
        const loadedSites = Array.from(this.loadedTilesets.keys());
        const loadingSites = Array.from(this.loadingIndicators.keys());
        
        return {
            loadedCount: this.loadedTilesets.size,
            loadedSites: loadedSites,
            loadingCount: this.loadingIndicators.size,
            loadingSites: loadingSites,
            isLoading: this.isLoading,
            motionModeActive: this.motionModeActive || false
        };
    }
    
    /**
     * Calculates the bounds and volume of a Gaussian Splat and creates a rectangular prism visualization
     * @param {Cesium.Cesium3DTileset} tileset - The loaded tileset
     * @param {string} siteId - Site identifier
     */
    calculateSplatBounds(tileset, siteId) {
        try {
            // Get the bounding sphere from the tileset
            const boundingSphere = tileset.boundingSphere;
            
            if (!boundingSphere) {
                console.warn(`No bounding sphere found for tileset: ${siteId}`);
                return;
            }
            
            // Extract center and radius
            const center = boundingSphere.center;
            const radius = boundingSphere.radius;
            
            // Convert center to cartographic coordinates for logging
            const cartographic = Cesium.Cartographic.fromCartesian(center);
            const longitude = Cesium.Math.toDegrees(cartographic.longitude);
            const latitude = Cesium.Math.toDegrees(cartographic.latitude);
            const height = cartographic.height;
            
            // For a sphere, we'll create a cubic bounding box with side length = 2 * radius
            // This gives us a cube that fully contains the sphere
            const sideLength = 2 * radius;
            const volume = Math.pow(sideLength, 3); // Volume of cube = side^3
            
            // Alternative: Calculate volume of actual sphere for comparison
            const sphereVolume = (4/3) * Math.PI * Math.pow(radius, 3);
            
            // Bounds analysis completed
            
            // Try to create terrain clipping (will only succeed if clipping-polygon.json exists)
            this.createTerrainClipping(tileset, siteId);
            
        } catch (error) {
            console.error(`Error calculating bounds for ${siteId}:`, error);
        }
    }
    
    /**
     * Creates a rectangular prism visualization around the Gaussian Splat bounds
     * @param {Cesium.Cartesian3} center - Center point of the bounds
     * @param {number} radius - Radius of the bounding sphere
     * @param {string} siteId - Site identifier
     */
    createBoundsVisualization(center, radius, siteId) {
        try {
            // Create a cube entity with side length = 2 * radius
            const sideLength = 2 * radius;
            
            // Create the rectangular prism (box) entity
            const boundsEntity = this.viewer.entities.add({
                name: `Bounds_Prism_${siteId}`,
                position: center,
                box: {
                    dimensions: new Cesium.Cartesian3(sideLength, sideLength, sideLength),
                    material: Cesium.Color.CYAN.withAlpha(0.2), // Semi-transparent cyan
                    outline: true,
                    outlineColor: Cesium.Color.CYAN,
                    outlineWidth: 2.0,
                    fill: true
                },
                label: {
                    text: `Bounds: ${sideLength.toFixed(1)}m³`,
                    font: '14pt monospace',
                    fillColor: Cesium.Color.WHITE,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 2,
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    pixelOffset: new Cesium.Cartesian2(0, -50),
                    disableDepthTestDistance: Number.POSITIVE_INFINITY
                }
            });
            
            // Store reference to the bounds entity for potential cleanup
            if (!this.boundsEntities) {
                this.boundsEntities = new Map();
            }
            this.boundsEntities.set(siteId, boundsEntity);
            
            console.log(`Rectangular prism visualization created for site: ${siteId}`);
            console.log(`Prism dimensions: ${sideLength.toFixed(2)} x ${sideLength.toFixed(2)} x ${sideLength.toFixed(2)} meters`);
            
        } catch (error) {
            console.error(`Error creating bounds visualization for ${siteId}:`, error);
        }
    }
    
    /**
     * Removes the bounds visualization for a specific site
     * @param {string} siteId - Site identifier
     */
    removeBoundsVisualization(siteId) {
        try {
            if (this.boundsEntities && this.boundsEntities.has(siteId)) {
                const boundsEntity = this.boundsEntities.get(siteId);
                if (this.viewer && this.viewer.entities && boundsEntity) {
                    this.viewer.entities.remove(boundsEntity);
                }
                this.boundsEntities.delete(siteId);
                console.log(`Bounds visualization removed for site: ${siteId}`);
            }
        } catch (error) {
            console.warn(`Error removing bounds visualization for ${siteId}:`, error);
        }
    }
    
    /**
     * Updates the loading progress bar and text
     * @param {number} percentage - Progress percentage (0-100)
     * @param {string} message - Loading message
     */
    updateLoadingProgress(percentage, message) {
        // DISABLED: Let main.js handle all progress updates to avoid conflicts
        // Multiple progress handlers were causing oscillation
        console.log('GaussianSplatManager progress update disabled:', percentage, message);
    }
    
    /**
     * Completes the loading with a quick 500ms speedup to 100%
     */
    completeLoading() {
        // DISABLED: Let main.js Web Worker handle all progress updates
        console.log('GaussianSplatManager completeLoading disabled - main.js handles completion');
        this.isWaitingForCompletion = false;
        
        if (this.loadingResolver) {
            this.loadingResolver();
        }
    }
    
    /**
     * Loads tileset completely asynchronously without blocking main thread
     * @param {string} tilesetUrl - URL to the tileset
     * @param {string} siteId - Site identifier 
     * @param {Object} bounds - Site bounds for positioning
     */
    async loadTilesetAsync(tilesetUrl, siteId, bounds) {
        try {
            console.log(`Starting async tileset load for ${siteId}`);
            
            // Use setTimeout to yield control back to main thread immediately
            setTimeout(async () => {
                try {
                    // Tileset creation in background thread logging removed for cleaner console output
                    
                    // CRITICAL: Load tileset with performance-optimized settings for 60+fps
                    // When running locally, we need to handle content.glb specially
                    let tilesetOptions = {
                        // PERFORMANCE CRITICAL: Gaussian Splat rendering optimizations
                        // MAXIMIZED: Since Google tiles are deprioritized, we can be more generous with Gaussian Splats
                        maximumScreenSpaceError: 6,              // Even higher quality than before (8 -> 6)
                        maximumMemoryUsage: 512,                 // Double memory allocation (256 -> 512MB) from Google tiles
                        
                        // CAMERA MOVEMENT OPTIMIZATIONS - MAXIMIZED for Gaussian Splat priority
                        cullRequestsWhileMoving: true,           // Skip tile requests during camera movement
                        cullRequestsWhileMovingMultiplier: 30.0, // LESS aggressive than before to render MORE splats (60 -> 30)
                        
                        // LOADING OPTIMIZATIONS - PRIORITIZED for Gaussian Splats
                        preloadWhenHidden: true,                 // NOW preload Gaussian Splats (resources freed from Google)
                        preloadFlightDestinations: true,        // NOW preload destinations for Gaussian Splats
                        immediatelyLoadDesiredLevelOfDetail: true, // PRIORITIZE immediate high-detail loading for splats
                        
                        // RENDERING OPTIMIZATIONS - ENHANCED for Gaussian Splat priority
                        skipLevelOfDetail: false,                // Keep LOD but with priority
                        dynamicScreenSpaceError: true,          // Smart quality adjustment based on movement
                        dynamicScreenSpaceErrorDensity: 0.8,    // LESS aggressive dynamic adjustment (0.5 -> 0.8) for better quality
                        dynamicScreenSpaceErrorFactor: 4.0,     // LOWER factor (8 -> 4) to maintain more quality during movement
                        
                        // PRIORITY: Gaussian Splats get maximum processing priority
                        processingPriority: 1000,               // Highest possible priority (opposite of Google tiles)
                        
                        // GAUSSIAN SPLAT SPECIFIC OPTIMIZATIONS
                        enableShowOutline: false,               // Disable expensive outline rendering
                        enableDebugWireframe: false,            // Disable debug wireframe
                        
                        // MEMORY AND CACHE OPTIMIZATIONS
                        cacheBytes: 536870912,                  // 512MB cache for better streaming
                        maximumCacheOverflowBytes: 134217728    // 128MB overflow buffer
                    };
                    
                    // When running locally, override the base path to use GCS for content.glb
                    if (window.TerrainConfig && window.TerrainConfig.isLocal) {
                        // The tileset.json from testing.ecodash.ai will have relative URIs
                        // We need to override the base path to point to GCS for content.glb
                        tilesetOptions.basePath = window.TerrainConfig.getGcsUrl(siteId, '');
                    }
                    
                    const tileset = await Cesium.Cesium3DTileset.fromUrl(tilesetUrl, tilesetOptions);
                    
                    // Tileset creation logging removed for cleaner console output
                    
                    // Add to scene in next frame to prevent blocking
                    requestAnimationFrame(() => {
                        this.viewer.scene.primitives.add(tileset);
                        console.log('Gaussian Splat added to scene');
                        
                        
                        // Store the loaded tileset
                        this.loadedTilesets.set(siteId, tileset);
                        
                        // Start continuous clicking immediately
                        this.startContinuousClicking();
                        
                        // Set up monitoring for when the splat is truly ready
                        this.monitorTilesetCompletion(tileset, siteId);
                        
                        // Do post-processing in background
                        this.doPostProcessing(tileset, siteId);
                    });
                    
                } catch (asyncError) {
                    console.error(`Error in async tileset loading for ${siteId}:`, asyncError);
                    this.handleTilesetError(siteId, asyncError);
                }
            }, 10); // Very brief delay to yield control
            
        } catch (error) {
            console.error(`Error setting up async tileset load for ${siteId}:`, error);
            this.handleTilesetError(siteId, error);
        }
    }
    
    /**
     * Handles post-processing tasks after tileset is loaded
     * @param {Cesium.Cesium3DTileset} tileset - The loaded tileset
     * @param {string} siteId - Site identifier
     */
    doPostProcessing(tileset, siteId) {
        // Calculate bounds and volume (non-blocking)
        setTimeout(() => {
            this.calculateSplatBounds(tileset, siteId);
        }, 100);
        
        // Optionally position camera for optimal viewing (non-blocking)
        if (!window.stopFlyThrough && !window.currentFlyThroughActive) {
            setTimeout(async () => {
                try {
                    await this.viewer.zoomTo(tileset, new Cesium.HeadingPitchRange(
                        0,
                        Cesium.Math.toRadians(-30),
                        Math.max(tileset.boundingSphere.radius * 2.5, 150)
                    ));
                    console.log('Camera positioned for optimal splat viewing');
                } catch (cameraError) {
                    console.warn('Could not position camera automatically:', cameraError);
                }
            }, 200);
        }
        
        // Ensure toggle button exists and update state (only in debug mode)
        if (this.debugMode) {
            setTimeout(() => {
                this.createSplatToggleButton();
                this.updateToggleButtonState();
            }, 300);
        }
        
        // Display success message with performance info (delayed)
        setTimeout(() => {
            if (window.displayMessage) {
                window.displayMessage('Digital Twin loading in background...', 0.5, 2, 0.5);
            }
        }, 500);
    }
    
    /**
     * Perturbs the scene to force initial render of Gaussian Splats
     * This ensures the scene is properly rendered before completion
     */
    perturbSceneForInitialRender() {
        try {
            // Mouse click simulation logging removed for cleaner console output
            this.startContinuousClicking();
        } catch (error) {
            console.warn('Error starting continuous clicking:', error);
        }
    }
    
    /**
     * Clicks the center of the screen once every second for 10 seconds
     */
    async startContinuousClicking() {
        const canvas = this.viewer.scene.canvas;
        const rect = canvas.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        // Continuous clicking start logging removed for cleaner console output
        
        for (let i = 0; i < 10; i++) {
            try {
                // Create mouse events
                const mouseDownEvent = new MouseEvent('mousedown', {
                    bubbles: true,
                    cancelable: true,
                    clientX: centerX,
                    clientY: centerY,
                    button: 0
                });
                
                const mouseUpEvent = new MouseEvent('mouseup', {
                    bubbles: true,
                    cancelable: true,
                    clientX: centerX,
                    clientY: centerY,
                    button: 0
                });
                
                // Dispatch click
                canvas.dispatchEvent(mouseDownEvent);
                setTimeout(() => {
                    canvas.dispatchEvent(mouseUpEvent);
                    // Force multiple renders
                    this.viewer.scene.requestRender();
                    this.viewer.scene.requestRender();
                    this.viewer.scene.requestRender();
                }, 50);
                
                // Continuous click logging removed for cleaner console output
                
                // Wait 1 second before next click
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.warn(`Error on click ${i + 1}:`, error);
            }
        }
        
        // Continuous clicking completion logging removed for cleaner console output
    }
    
    /**
     * Handles tileset loading errors
     * @param {string} siteId - Site identifier
     * @param {Error} error - The error that occurred
     */
    handleTilesetError(siteId, error) {
        // Loading indicator skipped - using main loading screen instead
        this.isLoading = false;
        
        // Complete independent loading even on error
        if (window.independentLoadingState) {
            window.independentLoadingState.complete();
        }
        
        console.error(`Failed to load Gaussian Splat for site ${siteId}:`, error);
        
        // Show error message after delay
        setTimeout(() => {
            if (window.displayMessage) {
                window.displayMessage('Failed to load digital twin', 0.5, 4, 0.5);
            }
        }, 1000);
    }
    
    /**
     * Monitors tileset completion in the background without blocking
     * @param {Cesium.Cesium3DTileset} tileset - The tileset to monitor
     * @param {string} siteId - Site identifier
     */
    monitorTilesetCompletion(tileset, siteId) {
        // Background monitoring setup logging removed for cleaner console output
        
        // Set up performance monitoring (non-blocking)
        this.setupPerformanceMonitoring(tileset, siteId);
        
        // Configure tileset performance settings
        this.configureTilesetPerformance(tileset, siteId);
        
        // Monitor for actual completion in background
        let checkCount = 0;
        const maxChecks = 100; // Prevent infinite checking
        
        const backgroundMonitor = () => {
            checkCount++;
            
            try {
                // Loading indicator skipped - using main loading screen instead
                if (tileset.ready && checkCount === 1) {
                    console.log(`Tileset is ready for ${siteId}`);
                }
                
                // Log completion when tiles are actually loaded
                if (tileset.statistics) {
                    const stats = tileset.statistics;
                    
                    // Monitor tileset completion progress
                    
                    // Check for completion conditions: either tiles are ready OR we've waited long enough with failures
                    const hasContentReady = stats.numberOfTilesWithContentReady > 0;
                    const hasPendingStuck = checkCount > 10 && stats.numberOfPendingRequests > 0; // 5+ seconds stuck
                    const hasTimeoutCondition = checkCount > 40; // 20+ seconds total, force completion
                    const shouldComplete = hasContentReady || hasPendingStuck || hasTimeoutCondition;
                    
                    if (shouldComplete) {
                        if (this.loadingStartTime) {
                            const loadTime = Date.now() - this.loadingStartTime;
                            console.log(`Digital twin ${siteId}: Load Time=${loadTime}ms`);
                            this.loadingStartTime = null; // Only log once
                            
                            // Trigger loading completion when Gaussian splat is ready
                            console.log('🎯 Digital twin ready - completing loading sequence');
                            if (window.independentLoadingState && window.independentLoadingState.complete) {
                                // Perturb scene to ensure proper rendering
                                this.perturbSceneForInitialRender();
                                
                                // Final completion message and trigger
                                window.independentLoadingState.currentMessage = 'Digital twin materialized. Welcome to the ecosystem.';
                                const loadingMessage = document.getElementById('loadingMessage');
                                if (loadingMessage) loadingMessage.textContent = 'Digital twin materialized. Welcome to the ecosystem.';
                                
                                // Wait longer for tiles to fully render, then perturb
                                setTimeout(() => {
                                    this.perturbSceneForInitialRender();
                                    // Additional delay and second perturbation
                                    setTimeout(() => {
                                        this.perturbSceneForInitialRender();
                                        setTimeout(() => window.independentLoadingState.complete(), 500);
                                    }, 1000);
                                }, 2000); // Wait 2 seconds after tiles are ready
                            }
                        }
                    }
                }
                
                // Continue monitoring if not at max checks
                if (checkCount < maxChecks && (!tileset.ready || !tileset.statistics || tileset.statistics.numberOfPendingRequests > 0)) {
                    setTimeout(backgroundMonitor, 500); // Check every 500ms
                } else {
                    // Background monitoring completion logging removed for cleaner console output
                }
                
            } catch (error) {
                console.warn(`Error in background monitoring for ${siteId}:`, error);
                // Continue monitoring despite errors
                if (checkCount < maxChecks) {
                    setTimeout(backgroundMonitor, 1000);
                }
            }
        };
        
        // Start background monitoring
        setTimeout(backgroundMonitor, 500);
    }
    
    /**
     * Hides the loading screen
     */
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
    }
    
    /**
     * Creates a clipping polygon from the Gaussian Splat bounds to hide underlying terrain
     * @param {Cesium.Cesium3DTileset} tileset - The loaded tileset
     * @param {string} siteId - Site identifier
     */
    createTerrainClipping(tileset, siteId) {
        try {
            // Get the oriented bounding box if available, otherwise use bounding sphere
            let boundingVolume = tileset.root.boundingVolume;
            
            // Check if we have an oriented bounding box (more precise)
            if (boundingVolume.orientedBoundingBox) {
                this.createClippingFromOrientedBox(boundingVolume.orientedBoundingBox, siteId);
            } else if (boundingVolume.boundingBox) {
                this.createClippingFromBoundingBox(boundingVolume.boundingBox, siteId);
            } else if (tileset.boundingSphere) {
                // Fallback to bounding sphere but make it tighter
                this.createClippingFromBoundingSphere(tileset.boundingSphere, siteId);
            } else {
                console.warn(`No suitable bounding volume found for site: ${siteId}`);
                return;
            }
            
            // Apply clipping to the Google Photorealistic tileset
            this.applyTerrainClipping(siteId);
            
            console.log(`Terrain clipping created for site: ${siteId}`);
            
        } catch (error) {
            console.error(`Error creating terrain clipping for ${siteId}:`, error);
        }
    }
    
    /**
     * Creates clipping polygon from oriented bounding box (most precise)
     * @param {Cesium.OrientedBoundingBox} orientedBox - Oriented bounding box
     * @param {string} siteId - Site identifier
     */
    createClippingFromOrientedBox(orientedBox, siteId) {
        try {
            // Get the 8 corners of the oriented bounding box
            const corners = [];
            const center = orientedBox.center;
            const halfAxes = orientedBox.halfAxes;
            
            // Calculate the 8 corners of the box
            const xAxis = Cesium.Cartesian3.getColumn(halfAxes, 0, new Cesium.Cartesian3());
            const yAxis = Cesium.Cartesian3.getColumn(halfAxes, 1, new Cesium.Cartesian3());
            const zAxis = Cesium.Cartesian3.getColumn(halfAxes, 2, new Cesium.Cartesian3());
            
            // We only need the bottom 4 corners for ground-level clipping
            const temp = new Cesium.Cartesian3();
            
            // Bottom face corners (using -zAxis for bottom)
            corners.push(
                Cesium.Cartesian3.add(center, 
                    Cesium.Cartesian3.add(
                        Cesium.Cartesian3.subtract(Cesium.Cartesian3.negate(xAxis, temp), Cesium.Cartesian3.negate(yAxis, new Cesium.Cartesian3()), temp),
                        Cesium.Cartesian3.negate(zAxis, new Cesium.Cartesian3()), temp
                    ), new Cesium.Cartesian3())
                );
            corners.push(
                Cesium.Cartesian3.add(center,
                    Cesium.Cartesian3.add(
                        Cesium.Cartesian3.add(xAxis, Cesium.Cartesian3.negate(yAxis, new Cesium.Cartesian3()), temp),
                        Cesium.Cartesian3.negate(zAxis, new Cesium.Cartesian3()), temp
                    ), new Cesium.Cartesian3())
                );
            corners.push(
                Cesium.Cartesian3.add(center,
                    Cesium.Cartesian3.add(
                        Cesium.Cartesian3.add(xAxis, yAxis, temp),
                        Cesium.Cartesian3.negate(zAxis, new Cesium.Cartesian3()), temp
                    ), new Cesium.Cartesian3())
                );
            corners.push(
                Cesium.Cartesian3.add(center,
                    Cesium.Cartesian3.add(
                        Cesium.Cartesian3.subtract(Cesium.Cartesian3.negate(xAxis, temp), yAxis, temp),
                        Cesium.Cartesian3.negate(zAxis, new Cesium.Cartesian3()), temp
                    ), new Cesium.Cartesian3())
                );
                
            this.createClippingPolygonFromCorners(corners, siteId);
            
        } catch (error) {
            console.error(`Error creating clipping from oriented box:`, error);
            // Fallback to bounding sphere
            this.createClippingFromBoundingSphere(orientedBox.boundingSphere, siteId);
        }
    }
    
    /**
     * Creates clipping polygon from axis-aligned bounding box
     * @param {Cesium.BoundingBox} boundingBox - Axis-aligned bounding box
     * @param {string} siteId - Site identifier
     */
    createClippingFromBoundingBox(boundingBox, siteId) {
        try {
            const min = boundingBox.minimum;
            const max = boundingBox.maximum;
            
            // Create the 4 bottom corners of the bounding box
            const corners = [
                new Cesium.Cartesian3(min.x, min.y, min.z),
                new Cesium.Cartesian3(max.x, min.y, min.z),
                new Cesium.Cartesian3(max.x, max.y, min.z),
                new Cesium.Cartesian3(min.x, max.y, min.z)
            ];
            
            this.createClippingPolygonFromCorners(corners, siteId);
            
        } catch (error) {
            console.error(`Error creating clipping from bounding box:`, error);
            // Fallback to bounding sphere
            this.createClippingFromBoundingSphere(boundingBox.boundingSphere, siteId);
        }
    }
    
    /**
     * Creates clipping polygon from bounding sphere (fallback, but tighter than before)
     * @param {Cesium.BoundingSphere} boundingSphere - Bounding sphere
     * @param {string} siteId - Site identifier
     */
    createClippingFromBoundingSphere(boundingSphere, siteId) {
        try {
            const center = boundingSphere.center;
            const radius = boundingSphere.radius;
            
            // Convert center to cartographic coordinates
            const cartographic = Cesium.Cartographic.fromCartesian(center);
            const longitude = Cesium.Math.toDegrees(cartographic.longitude);
            const latitude = Cesium.Math.toDegrees(cartographic.latitude);
            
            // Use the radius to determine the size of the clipping area
            const metersPerDegreeLat = 111320;
            const metersPerDegreeLon = 111320 * Math.cos(latitude * Math.PI / 180);
            
            // Minimal buffer - just enough to ensure coverage without being too large
            const buffer = 1.05; // 5% buffer around the splat
            const latOffset = (radius * buffer) / metersPerDegreeLat;
            const lonOffset = (radius * buffer) / metersPerDegreeLon;
            
            // Define the clipping polygon corners (clockwise from bottom-left)
            const corners = [
                Cesium.Cartesian3.fromDegrees(longitude - lonOffset, latitude - latOffset),
                Cesium.Cartesian3.fromDegrees(longitude + lonOffset, latitude - latOffset),
                Cesium.Cartesian3.fromDegrees(longitude + lonOffset, latitude + latOffset),
                Cesium.Cartesian3.fromDegrees(longitude - lonOffset, latitude + latOffset)
            ];
            
            this.createClippingPolygonFromCorners(corners, siteId);
            
            console.log(`Clipping area (sphere): ${(radius * buffer * 2).toFixed(2)}m x ${(radius * buffer * 2).toFixed(2)}m`);
            
        } catch (error) {
            console.error(`Error creating clipping from bounding sphere:`, error);
        }
    }
    
    /**
     * Creates the actual clipping polygon from corner positions
     * @param {Cesium.Cartesian3[]} corners - Array of corner positions
     * @param {string} siteId - Site identifier
     */
    createClippingPolygonFromCorners(corners, siteId) {
        try {
            // Create the clipping polygon
            const clippingPolygon = new Cesium.ClippingPolygon({
                positions: corners,
                extrudedHeight: 0,  // Clip from ground level
                height: 1000        // Clip up to 1000m above ground
            });
            
            // Create clipping polygon collection
            const clippingPolygonCollection = new Cesium.ClippingPolygonCollection({
                polygons: [clippingPolygon],
                enabled: true,
                inverse: false  // Hide the area inside the polygon
            });
            
            // Store the clipping polygon for this site
            this.clippingPolygons.set(siteId, clippingPolygonCollection);
            
        } catch (error) {
            console.error(`Error creating clipping polygon from corners:`, error);
        }
    }
    
    /**
     * Applies terrain clipping to the appropriate base layer (Google Photorealistic tileset or terrain)
     * @param {string} siteId - Site identifier
     * @param {number} retryCount - Number of retry attempts (default: 0)
     */
    applyTerrainClipping(siteId, retryCount = 0) {
        try {
            const clippingCollection = this.clippingPolygons.get(siteId);
            // Clipping collection debug complete
            
            if (!clippingCollection) {
                console.warn(`No clipping polygon found for site: ${siteId}`);
                return;
            }
            
            // Find the Google Photorealistic tileset in the scene
            const primitives = this.viewer.scene.primitives;
            let googleTileset = null;
            
            // Searching for Google Photorealistic tileset
            
            for (let i = 0; i < primitives.length; i++) {
                const primitive = primitives.get(i);
                // Check primitive type
                
                if (primitive instanceof Cesium.Cesium3DTileset && !primitive.isDestroyed()) {
                    // Check if this is NOT one of our loaded gaussian splats
                    let isGaussianSplat = false;
                    for (const [_, loadedTileset] of this.loadedTilesets) {
                        if (primitive === loadedTileset) {
                            isGaussianSplat = true;
                            break;
                        }
                    }
                    
                    if (!isGaussianSplat) {
                        // This is likely the Google Photorealistic tileset
                        // Prefer the most recently added one (should be last in the list)
                        googleTileset = primitive;
                        // Found Google Photorealistic tileset
                        // Don't break - continue to find the last (most recent) one
                    }
                }
            }
            
            if (googleTileset) {
                // Apply clipping to the Google tileset
                try {
                    // Check if tileset already has clipping
                    if (googleTileset.clippingPolygons) {
                        console.log(`Google tileset already has clipping polygons - replacing for site: ${siteId}`);
                    }
                    
                    // Apply clipping collection - avoid creating fresh collections due to Cesium ownership issues
                    if (clippingCollection && !clippingCollection.isDestroyed()) {
                        googleTileset.clippingPolygons = clippingCollection;
                        // Terrain clipping applied to Google Photorealistic tileset
                    } else {
                        console.warn(`Clipping collection for site ${siteId} is destroyed or invalid - attempting to reload`);
                        // Try to reload the clipping data from the original source
                        if (window.gaussianSplatManager && window.gaussianSplatManager.loadPrecomputedClipping) {
                            console.log(`Attempting to reload clipping for site: ${siteId}`);
                            window.gaussianSplatManager.loadPrecomputedClipping(siteId, googleTileset)
                                .then(success => {
                                    if (success) {
                                        console.log(`Successfully reloaded clipping for site: ${siteId}`);
                                    } else {
                                        console.warn(`Failed to reload clipping for site: ${siteId}`);
                                    }
                                })
                                .catch(error => {
                                    console.error(`Error reloading clipping for site ${siteId}:`, error);
                                });
                        }
                    }
                } catch (error) {
                    console.error(`Error applying clipping to tileset for site ${siteId}:`, error);
                }
            } else {
                // Check if we're in terrain mode and apply clipping to the globe
                if (window.map3D && window.map3D.isUsingTerrain) {
                    const globe = this.viewer.scene.globe;
                    if (globe) {
                        globe.clippingPolygons = clippingCollection;
                        console.log(`Terrain clipping applied to Cesium globe for site: ${siteId}`);
                        return;
                    }
                }
                
                console.warn(`Could not find Google Photorealistic tileset to apply clipping (attempt ${retryCount + 1})`);
                
                // Retry up to 3 times with delays
                if (retryCount < 3) {
                    console.log(`Retrying terrain clipping in ${(retryCount + 1) * 1000}ms...`);
                    setTimeout(() => {
                        this.applyTerrainClipping(siteId, retryCount + 1);
                    }, (retryCount + 1) * 1000);
                } else {
                    console.error('Failed to apply terrain clipping after 3 attempts');
                }
            }
            
        } catch (error) {
            console.error(`Error applying terrain clipping for ${siteId}:`, error);
        }
    }
    
    /**
     * Removes terrain clipping for a specific site
     * @param {string} siteId - Site identifier
     */
    removeTerrainClipping(siteId) {
        try {
            if (this.clippingPolygons.has(siteId)) {
                const clippingCollection = this.clippingPolygons.get(siteId);
                
                // Find and update the Google Photorealistic tileset
                const primitives = this.viewer.scene.primitives;
                for (let i = 0; i < primitives.length; i++) {
                    const primitive = primitives.get(i);
                    if (primitive instanceof Cesium.Cesium3DTileset && primitive.clippingPolygons) {
                        // Remove our clipping polygon from the tileset
                        const currentPolygons = primitive.clippingPolygons.polygons;
                        const ourPolygons = clippingCollection.polygons;
                        
                        // Filter out our polygons
                        const filteredPolygons = currentPolygons.filter(polygon => 
                            !ourPolygons.includes(polygon)
                        );
                        
                        if (filteredPolygons.length > 0) {
                            primitive.clippingPolygons = new Cesium.ClippingPolygonCollection({
                                polygons: filteredPolygons,
                                enabled: true,
                                inverse: false
                            });
                        } else {
                            // No clipping polygons left, remove clipping entirely
                            primitive.clippingPolygons = undefined;
                        }
                        
                        break;
                    }
                }
                
                this.clippingPolygons.delete(siteId);
                console.log(`Terrain clipping removed for site: ${siteId}`);
            }
        } catch (error) {
            console.warn(`Error removing terrain clipping for ${siteId}:`, error);
        }
    }
    

    /**
     * Removes all terrain clipping
     */
    removeAllTerrainClipping() {
        try {
            // Remove clipping from all tilesets
            const primitives = this.viewer.scene.primitives;
            for (let i = 0; i < primitives.length; i++) {
                const primitive = primitives.get(i);
                if (primitive instanceof Cesium.Cesium3DTileset && primitive.clippingPolygons) {
                    primitive.clippingPolygons = undefined;
                }
            }
            
            // Clear our clipping polygons map
            this.clippingPolygons.clear();
            console.log('All terrain clipping removed');
        } catch (error) {
            console.error('Error removing all terrain clipping:', error);
        }
    }
    
    
}

// Export the class to global scope
window.GaussianSplatManager = GaussianSplatManager;

// Add global performance monitoring functions for development
window.gaussianSplatPerformance = {
    /**
     * Gets performance stats for all loaded Gaussian splats
     */
    getStats: () => {
        if (window.gaussianSplatManager) {
            return window.gaussianSplatManager.getAllPerformanceStats();
        }
        return {};
    },
    
    /**
     * Gets performance stats for a specific site
     * @param {string} siteId - Site identifier
     */
    getSiteStats: (siteId) => {
        if (window.gaussianSplatManager) {
            return window.gaussianSplatManager.getPerformanceStats(siteId);
        }
        return null;
    },
    
    /**
     * Logs current performance stats to console
     */
    logStats: () => {
        const stats = window.gaussianSplatPerformance.getStats();
        console.log('=== GAUSSIAN SPLAT PERFORMANCE STATS ===');
        if (Object.keys(stats).length === 0) {
            console.log('No Gaussian splats currently loaded');
        } else {
            for (const [siteId, siteStats] of Object.entries(stats)) {
                console.log(`Site: ${siteId}`);
                console.log(`  FPS: ${siteStats.fps}`);
                console.log(`  Tiles Loaded: ${siteStats.tilesLoaded}`);
                console.log(`  Tiles Failed: ${siteStats.tilesFailed}`);
                console.log(`  Memory Usage: ${siteStats.memoryUsageMB}MB`);
                console.log(`  Avg Load Time: ${siteStats.averageLoadTimeMs}ms`);
                console.log('---');
            }
        }
        console.log('==========================================');
    },
    
    /**
     * Optimizes all loaded splats for movement (reduces quality temporarily)
     */
    optimizeForMovement: () => {
        if (window.gaussianSplatManager) {
            window.gaussianSplatManager.optimizeForMovement(true);
            console.log('Optimized all splats for camera movement');
        }
    },
    
    /**
     * Restores quality after movement optimization
     */
    restoreQuality: () => {
        if (window.gaussianSplatManager) {
            window.gaussianSplatManager.optimizeForMovement(false);
            console.log('Restored quality for all splats');
        }
    }
};

// Gaussian Splat performance monitoring available