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
            this.createSplatToggleButton();
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
        
        // Create the remove button as a simple button
        const button = document.createElement('button');
        button.id = 'splatToggleButton';
        button.className = 'control-button text-button';
        button.textContent = 'DEBUG: remove splat';
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
        
        // Add click handler to remove splat
        button.addEventListener('click', () => {
            this.removeAllSplats();
        });
        
        splatContainer.appendChild(button);
        layerControls.appendChild(splatContainer);
        
        console.log('Splat remove button added to control panel');
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
        
        // Remove the button since splats are gone
        const button = document.getElementById('splatToggleButton');
        const container = document.getElementById('splatToggleSection');
        if (button && container) {
            container.remove();
        }
        
        console.log('All Gaussian Splats removed successfully');
        
        // Display message
        if (window.displayMessage) {
            window.displayMessage('Digital twin removed', 0.3, 2, 0.3);
        }
    }
    
    /**
     * Updates the toggle button state based on current splat visibility
     */
    updateToggleButtonState() {
        const button = document.getElementById('splatToggleButton');
        if (!button || this.loadedTilesets.size === 0) {
            return;
        }
        
        let allVisible = true;
        for (const tileset of this.loadedTilesets.values()) {
            if (!tileset.show) {
                allVisible = false;
                break;
            }
        }
        
        const checkbox = button.querySelector('input[type="checkbox"]');
        if (checkbox) {
            checkbox.checked = allVisible;
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
            
            // Ensure toggle button exists and update state
            this.createSplatToggleButton();
            this.updateToggleButtonState();
            
            // Display success message
            if (window.displayMessage) {
                window.displayMessage('Digital twin loaded successfully', 0.5, 2, 0.5);
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
}

// Export the class to global scope
window.GaussianSplatManager = GaussianSplatManager;