/**
 * SuperSplat View Manager - Handles switching between Cesium 3D and SuperSplat mode
 * Integrates SuperSplat editor for advanced Gaussian splat editing
 */

class SuperSplatManager {
    constructor() {
        this.isSuperSplatMode = false;
        this.saved3DView = null;
        this.superSplatButton = null;
        this.superSplatContainer = null;
        this.superSplatIframe = null;
        this.currentSiteId = null;
        this.cesiumWasRequestRenderMode = null; // Track original Cesium render mode
    }

    /**
     * Initializes the SuperSplat manager and sets up event listeners
     */
    initialize() {
        this.superSplatButton = document.getElementById('superSplatButton');
        this.superSplatContainer = document.getElementById('superSplatContainer');
        
        if (this.superSplatButton) {
            // Remove any existing event listeners to avoid conflicts
            this.superSplatButton.replaceWith(this.superSplatButton.cloneNode(true));
            this.superSplatButton = document.getElementById('superSplatButton');
            this.superSplatButton.addEventListener('click', () => this.toggleView());
        }
        
        console.log('✅ SuperSplatManager initialized');
    }

    /**
     * Toggles between Cesium 3D and SuperSplat view modes
     */
    toggleView() {
        if (this.isSuperSplatMode) {
            this.switchToCesium();
        } else {
            this.switchToSuperSplat();
        }
    }

    /**
     * Switches to SuperSplat editing mode
     */
    switchToSuperSplat() {
        if (!window.map3D) {
            console.warn('CesiumManager not available');
            return;
        }

        // Check if current site has a splat file
        const currentSite = this.getCurrentSiteId();
        if (!currentSite) {
            console.warn('No current site selected');
            return;
        }

        console.log('🎨 Switching to SuperSplat mode for site:', currentSite);

        // Save current 3D camera position (similar to 2D mode)
        const viewer = window.map3D.viewer;
        this.saved3DView = {
            position: viewer.camera.position.clone(),
            orientation: {
                heading: viewer.camera.heading,
                pitch: viewer.camera.pitch,
                roll: viewer.camera.roll
            }
        };

        // Hide Cesium container and pause rendering to save resources
        const cesiumContainer = document.getElementById('cesiumContainer');
        if (cesiumContainer) {
            cesiumContainer.style.display = 'none';
            console.log('✅ Cesium container hidden');
        }

        // Pause Cesium rendering to conserve CPU/GPU resources
        if (viewer && viewer.scene) {
            this.cesiumWasRequestRenderMode = viewer.scene.requestRenderMode;
            viewer.scene.requestRenderMode = true; // Only render on demand
            viewer.clock.shouldAnimate = false; // Stop animation loop
            console.log('⏸️ Cesium rendering paused to conserve resources');
        }

        // Show SuperSplat container and load editor
        if (this.superSplatContainer) {
            this.superSplatContainer.style.display = 'block';
            this.loadSuperSplatEditor(currentSite);
        }

        // Update mode state and UI
        this.isSuperSplatMode = true;
        this.updateButtonStates();

        console.log('✅ SuperSplat mode activated');
    }

    /**
     * Switches back to Cesium 3D mode
     */
    switchToCesium() {
        if (!window.map3D) {
            console.warn('CesiumManager not available');
            return;
        }
        
        // If no saved 3D view (e.g., started in Lab mode), use default position
        if (!this.saved3DView) {
            console.log('⚠️ No saved 3D view found, using default position');
            // Use default position for scott-boyd-residence site
            this.saved3DView = {
                position: Cesium.Cartesian3.fromDegrees(-81.462, 28.592, 150), // Default position
                orientation: {
                    heading: 0.0,
                    pitch: -0.3,
                    roll: 0.0
                }
            };
        }

        console.log('🌍 Switching back to Cesium 3D mode...');

        // Get viewer reference once at the top
        const viewer = window.map3D.viewer;

        // Hide SuperSplat container
        if (this.superSplatContainer) {
            this.superSplatContainer.style.display = 'none';
        }

        // Clean up SuperSplat iframe and free resources
        if (this.superSplatIframe) {
            // Properly unload iframe content before removing
            this.superSplatIframe.src = 'about:blank';
            setTimeout(() => {
                if (this.superSplatIframe) {
                    this.superSplatIframe.remove();
                    this.superSplatIframe = null;
                }
            }, 100);
            console.log('🗑️ SuperSplat iframe cleaned up to free resources');
        }

        // Show Cesium container and restore rendering
        const cesiumContainer = document.getElementById('cesiumContainer');
        if (cesiumContainer) {
            cesiumContainer.style.display = 'block';
            console.log('✅ Cesium container shown');
        }

        // Restore Cesium rendering settings
        if (viewer && viewer.scene) {
            if (this.cesiumWasRequestRenderMode !== undefined) {
                viewer.scene.requestRenderMode = this.cesiumWasRequestRenderMode;
            }
            viewer.clock.shouldAnimate = true; // Resume animation loop
            viewer.scene.requestRender(); // Trigger a render to refresh scene
            console.log('▶️ Cesium rendering resumed');
        }

        // Restore camera position
        viewer.camera.flyTo({
            destination: this.saved3DView.position,
            orientation: this.saved3DView.orientation,
            duration: 2.0,
            complete: () => {
                console.log('✅ Camera position restored');
            }
        });

        // Update mode state and UI
        this.isSuperSplatMode = false;
        this.updateButtonStates();

        // Trigger site loading in Cesium mode (GeoJSON and Gaussian splat)
        this.initializeCesiumSiteVisualization();

        console.log('✅ Cesium 3D mode restored');
    }

    /**
     * Initializes site visualization when switching from Lab mode to Cesium mode
     */
    initializeCesiumSiteVisualization() {
        console.log('🌍 Initializing Cesium site visualization...');
        
        // Ensure we have current site data
        if (!window.currentSiteData) {
            console.warn('No current site data available for Cesium visualization');
            return;
        }
        
        // Get current site selection from dropdown
        const siteDropdown = document.getElementById('siteDropdown');
        if (!siteDropdown || !siteDropdown.value) {
            console.warn('No site selected in dropdown');
            return;
        }
        
        const selectedOption = siteDropdown.options[siteDropdown.selectedIndex];
        if (!selectedOption || !selectedOption.dataset.bounds) {
            console.warn('Selected option missing bounds data');
            return;
        }
        
        try {
            const bounds = JSON.parse(selectedOption.dataset.bounds);
            
            // Navigate to the site
            if (window.navigateToSite) {
                window.navigateToSite(bounds, false);
            }
            
            // Initialize layer controls
            if (window.initializeLayerControls) {
                window.initializeLayerControls();
            }
            
            // Show layer controls for Boyd format sites
            const layerControls = document.getElementById('layerControls');
            if (layerControls) {
                layerControls.style.display = 'block';
            }
            
            // Detect format and initialize parameter filter
            const format = window.currentSiteData.features.length > 0 ? 
                window.detectGeoJsonFormat(window.currentSiteData.features[0]) : 'legacy';
            
            if (window.toggleParameterFilter) {
                window.toggleParameterFilter(format);
            }
            
            // Trigger visualization with current site data
            if (window.visualizeGeoJsonPolygonsWithLayers) {
                window.visualizeGeoJsonPolygonsWithLayers(window.currentSiteData);
            }
            
            // Auto-load Gaussian Splat for Scott Boyd site
            if (window.gaussianSplatManager && siteDropdown.value === 'Boyd_Residence_Aerial_and_Ground.geojson') {
                setTimeout(() => {
                    console.log('🎯 Loading Gaussian splat for Scott Boyd site...');
                    window.gaussianSplatManager.loadGaussianSplat('scott-boyd-residence', bounds);
                }, 500); // Longer delay to ensure camera is positioned
            }
            
            console.log('✅ Cesium site visualization initialized');
        } catch (error) {
            console.error('Error initializing Cesium site visualization:', error);
        }
    }

    /**
     * Loads SuperSplat editor in an iframe with the current site's splat file
     */
    loadSuperSplatEditor(siteId) {
        if (!this.superSplatContainer) {
            console.error('SuperSplat container not found');
            return;
        }

        // Construct URL for SuperSplat with auto-load parameter
        const splatUrl = `/data/${siteId}/splat.ply`;
        const editorUrl = `/supersplat/index.html?load=${encodeURIComponent(window.location.origin + splatUrl)}`;

        console.log('Loading SuperSplat editor:', editorUrl);

        // Create iframe for SuperSplat
        this.superSplatIframe = document.createElement('iframe');
        this.superSplatIframe.src = editorUrl;
        this.superSplatIframe.style.width = '100%';
        this.superSplatIframe.style.height = '100%';
        this.superSplatIframe.style.border = 'none';
        this.superSplatIframe.style.position = 'absolute';
        this.superSplatIframe.style.top = '0';
        this.superSplatIframe.style.left = '0';

        // Add loading handler
        this.superSplatIframe.onload = () => {
            console.log('✅ SuperSplat editor loaded successfully');
        };

        this.superSplatIframe.onerror = (error) => {
            console.error('❌ Failed to load SuperSplat editor:', error);
        };

        // Clear container and add iframe
        this.superSplatContainer.innerHTML = '';
        this.superSplatContainer.appendChild(this.superSplatIframe);
    }

    /**
     * Gets the current site ID from the site selector
     */
    getCurrentSiteId() {
        const siteSelector = document.getElementById('siteDropdown');
        if (siteSelector && siteSelector.value) {
            const filename = siteSelector.value;
            // Map the GeoJSON filename to the corresponding site directory
            if (filename === 'Boyd_Residence_Aerial_and_Ground.geojson') {
                return 'scott-boyd-residence';
            }
            // For other sites, extract the directory name from filename
            return filename.replace('.geojson', '');
        }
        
        // Fallback to default site
        return 'scott-boyd-residence';
    }

    /**
     * Updates button states and visibility based on current mode
     */
    updateButtonStates() {
        // Update SuperSplat button classes and titles
        if (this.superSplatButton) {
            if (this.isSuperSplatMode) {
                // In SuperSplat mode - show globe icon to return to Cesium
                this.superSplatButton.textContent = '';
                this.superSplatButton.className = 'control-button icon-button globe-icon-button';
                this.superSplatButton.title = 'Switch to Cesium 3D view';
            } else {
                // In Cesium mode - show lab icon to enter Lab mode
                this.superSplatButton.textContent = '';
                this.superSplatButton.className = 'control-button icon-button lab-icon-button';
                this.superSplatButton.title = 'Switch to Lab mode (SuperSplat editing)';
            }
        }

        // Hide/show 2D button based on SuperSplat mode state
        const view2DButton = document.getElementById('viewSwitchButton');
        if (view2DButton) {
            view2DButton.style.display = this.isSuperSplatMode ? 'none' : 'inline-block';
        }

        // Update SuperSplat button visibility
        this.updateSuperSplatAvailability();

        console.log(`Button states updated - SuperSplat mode: ${this.isSuperSplatMode}`);
    }

    /**
     * Checks if a splat file exists for the given site
     */
    async hasSplatFile(siteId) {
        try {
            const response = await fetch(`/data/${siteId}/splat.ply`, { method: 'HEAD' });
            return response.ok;
        } catch (error) {
            console.warn(`No splat file found for site: ${siteId}`);
            return false;
        }
    }

    /**
     * Updates SuperSplat button visibility based on current mode and site
     */
    async updateSuperSplatAvailability() {
        if (!this.superSplatButton) return;
        
        const currentSite = this.getCurrentSiteId();
        const is2DMode = window.view2DManager && window.view2DManager.is2DMode;
        
        // Show SuperSplat button for scott-boyd-residence (which has splat file)
        // and when not in 2D mode
        const hasSplatFile = currentSite === 'scott-boyd-residence';
        const shouldShow = hasSplatFile && !is2DMode;
        
        this.superSplatButton.style.display = shouldShow ? 'inline-block' : 'none';
        console.log(`SuperSplat button visibility - Site: ${currentSite}, 2D Mode: ${is2DMode}, Show: ${shouldShow}`);
    }
}

// Initialize the SuperSplat manager when the page loads
window.superSplatManager = new SuperSplatManager();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.superSplatManager.initialize();
    
    // Check SuperSplat availability multiple times to catch when site selector is ready
    setTimeout(() => {
        console.log('🔄 Initial SuperSplat availability check...');
        window.superSplatManager.updateSuperSplatAvailability();
    }, 500);
    
    setTimeout(() => {
        console.log('🔄 Secondary SuperSplat availability check...');
        window.superSplatManager.updateSuperSplatAvailability();
    }, 2000);
    
    setTimeout(() => {
        console.log('🔄 Final SuperSplat availability check...');
        window.superSplatManager.updateSuperSplatAvailability();
    }, 5000);
});

// Listen for site changes to update SuperSplat availability
document.addEventListener('siteChanged', (event) => {
    if (window.superSplatManager) {
        // If we're in SuperSplat mode when site changes, switch back to Cesium first
        if (window.superSplatManager.isSuperSplatMode) {
            window.superSplatManager.switchToCesium();
        }
        
        // Then update availability for new site
        setTimeout(() => {
            window.superSplatManager.updateSuperSplatAvailability();
        }, 500);
    }
});