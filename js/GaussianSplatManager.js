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
        console.log('GaussianSplatManager initialized');
        console.log('Cesium version:', Cesium.VERSION);
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
                tilesetUrl: `/data/${siteId}/tileset.json`,
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
                // Reload the tileset
                console.log(`Reloading tileset from: ${splatData.tilesetUrl}`);
                const tileset = await Cesium.Cesium3DTileset.fromUrl(splatData.tilesetUrl);
                
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
     * Checks if current Cesium version supports Gaussian Splats
     */
    checkGaussianSplatSupport() {
        // Check if 3D Tiles extension support exists
        const has3DTilesContentGltf = Cesium.Cesium3DTileset.prototype.hasOwnProperty('_extensionsUsed');
        const cesiumVersion = Cesium.VERSION;
        
        console.log('Cesium 3D Tiles support check:');
        console.log('- Cesium version:', cesiumVersion);
        console.log('- Has 3D Tiles content GLTF support:', has3DTilesContentGltf);
        
        // Gaussian Splats are supported in Cesium 1.110+ with experimental flag
        const versionParts = cesiumVersion.split('.').map(Number);
        const majorVersion = versionParts[0];
        const minorVersion = versionParts[1];
        
        const supportsGaussianSplats = majorVersion > 1 || (majorVersion === 1 && minorVersion >= 110);
        console.log('- Estimated Gaussian Splat support:', supportsGaussianSplats);
        
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
            const tilesetUrl = `/data/${siteId}/tileset.json`;
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
        console.log(`Loading indicator created for site: ${siteId}`);
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
                console.log(`Loading indicator removed for site: ${siteId}`);
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
            return null;
        }
        
        this.isLoading = true;
        
        // Show loading indicator
        this.createLoadingIndicator(siteId, bounds);
        
        try {
            const tilesetUrl = `/data/${siteId}/tileset.json`;
            console.log(`Loading Gaussian Splat from: ${tilesetUrl}`);
            
            // First, validate the tileset.json content
            const tilesetResponse = await fetch(tilesetUrl);
            const tilesetJson = await tilesetResponse.json();
            console.log('Tileset JSON content:', tilesetJson);
            
            // Check for Gaussian Splat extensions
            const hasGaussianSplatExt = tilesetJson.extensions && 
                tilesetJson.extensions['3DTILES_content_gltf'] &&
                tilesetJson.extensions['3DTILES_content_gltf'].extensionsRequired &&
                tilesetJson.extensions['3DTILES_content_gltf'].extensionsRequired.includes('KHR_spz_gaussian_splats_compression');
            
            console.log('Has Gaussian Splat extensions:', hasGaussianSplatExt);
            
            // Use fromUrl method as shown in reference - much simpler and more reliable
            console.log('Loading tileset using fromUrl method...');
            const tileset = await Cesium.Cesium3DTileset.fromUrl(tilesetUrl);
            
            // Add tileset to scene
            this.viewer.scene.primitives.add(tileset);
            
            // Add event listeners for debugging
            tileset.tileLoad.addEventListener((tile) => {
                console.log('Tile loaded:', tile);
            });
            
            tileset.tileFailed.addEventListener((error) => {
                console.error('Tile failed to load:', error);
            });
            
            tileset.loadProgress.addEventListener((numberOfPendingRequests, numberOfTilesProcessing) => {
                console.log(`Loading progress: ${numberOfPendingRequests} pending, ${numberOfTilesProcessing} processing`);
            });
            
            // Log transform information for debugging
            console.log('Tileset modelMatrix:', tileset.modelMatrix);
            console.log('Tileset root.transform:', tileset.root.transform);
            if (tileset.root.computedTransform) {
                console.log('Tileset root.computedTransform:', tileset.root.computedTransform);
            }
            
            // Store the loaded tileset
            this.loadedTilesets.set(siteId, tileset);
            
            // Remove loading indicator
            this.removeLoadingIndicator(siteId);
            
            this.isLoading = false;
            
            console.log(`Gaussian Splat loaded successfully for site: ${siteId}`);
            console.log(`Tileset bounds:`, tileset.boundingSphere);
            console.log(`Tileset root:`, tileset.root);
            console.log(`Tileset root boundingVolume:`, tileset.root.boundingVolume);
            
            // Calculate bounds and volume
            this.calculateSplatBounds(tileset, siteId);
            
            // Optionally position camera for optimal viewing
            // Note: Only do this if not in the middle of a tour or other camera animation
            if (!window.stopFlyThrough && !window.currentFlyThroughActive) {
                try {
                    // Position camera similar to reference example
                    await this.viewer.zoomTo(tileset, new Cesium.HeadingPitchRange(
                        0,                               // heading (north)
                        Cesium.Math.toRadians(-30),      // pitch (look down 30 degrees)
                        Math.max(tileset.boundingSphere.radius * 2.5, 150)  // distance (minimum 150m)
                    ));
                    console.log('Camera positioned for optimal splat viewing');
                } catch (cameraError) {
                    console.warn('Could not position camera automatically:', cameraError);
                    // Don't fail the entire loading process if camera positioning fails
                }
            }
            
            // Ensure toggle button exists and update state (only in debug mode)
            if (this.debugMode) {
                this.createSplatToggleButton();
                this.updateToggleButtonState();
            }
            
            // Display success message
            if (window.displayMessage) {
                window.displayMessage('Loading Digital Twin', 0.5, 2, 0.5);
            }
            
            return tileset;
            
        } catch (error) {
            console.error(`Failed to load Gaussian Splat for site ${siteId}:`, error);
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
            
            // Try to determine the specific issue
            let errorMessage = 'Failed to load digital twin';
            if (error.message && error.message.includes('updateTransform')) {
                errorMessage = 'Gaussian Splat format not fully supported in this Cesium version';
                console.warn('Suggestion: This appears to be a Cesium/Gaussian Splat compatibility issue.');
                console.warn('Try using Cesium 1.115+ or check if the tileset uses supported extensions.');
            } else if (error.message && error.message.includes('timeout')) {
                errorMessage = 'Digital twin loading timed out';
            }
            
            // Remove loading indicator on error
            this.removeLoadingIndicator(siteId);
            this.isLoading = false;
            
            // Display error message
            if (window.displayMessage) {
                window.displayMessage(errorMessage, 0.5, 4, 0.5);
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
            isLoading: this.isLoading
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
            
            // Log all the bounds data
            console.log('=== GAUSSIAN SPLAT BOUNDS ANALYSIS ===');
            console.log(`Site ID: ${siteId}`);
            console.log(`Bounding Sphere Center (Cartesian):`, center);
            console.log(`Bounding Sphere Center (Degrees): ${longitude.toFixed(6)}, ${latitude.toFixed(6)}, ${height.toFixed(2)}m`);
            console.log(`Bounding Sphere Radius: ${radius.toFixed(2)} meters`);
            console.log(`Rectangular Prism (Cube) Side Length: ${sideLength.toFixed(2)} meters`);
            console.log(`Rectangular Prism Volume: ${volume.toFixed(2)} cubic meters`);
            console.log(`Sphere Volume (for comparison): ${sphereVolume.toFixed(2)} cubic meters`);
            console.log(`Volume Ratio (Cube/Sphere): ${(volume / sphereVolume).toFixed(2)}`);
            
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
            console.log(`Debug - Clipping collection for ${siteId}:`, {
                exists: !!clippingCollection,
                isDestroyed: clippingCollection ? clippingCollection.isDestroyed() : 'N/A',
                hasLength: clippingCollection ? clippingCollection.length : 'N/A',
                polygonCount: clippingCollection ? clippingCollection.length : 'N/A'
            });
            
            if (!clippingCollection) {
                console.warn(`No clipping polygon found for site: ${siteId}`);
                return;
            }
            
            // Find the Google Photorealistic tileset in the scene
            const primitives = this.viewer.scene.primitives;
            let googleTileset = null;
            
            console.log(`Searching for Google Photorealistic tileset (attempt ${retryCount + 1}), found ${primitives.length} primitives`);
            
            for (let i = 0; i < primitives.length; i++) {
                const primitive = primitives.get(i);
                console.log(`Primitive ${i}:`, {
                    type: primitive.constructor.name,
                    isCesium3DTileset: primitive instanceof Cesium.Cesium3DTileset,
                    hasUrl: !!primitive.url,
                    url: primitive.url
                });
                
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
                        console.log(`Found Google Photorealistic tileset:`, {
                            ready: googleTileset.ready,
                            hasClippingPolygons: !!googleTileset.clippingPolygons,
                            index: i,
                            isDestroyed: primitive.isDestroyed()
                        });
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
                        console.log(`Terrain clipping applied to Google Photorealistic tileset for site: ${siteId}`);
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