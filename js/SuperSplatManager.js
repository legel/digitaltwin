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
        this.wasInSuperSplatMode = true; // Set flag for cleanup when returning to Cesium
        this.updateButtonStates();

        // Add CSS class to body for SuperSplat mode styling
        document.body.classList.add('supersplat-mode');

        // Configure UI elements for Lab mode
        this.hideUIForLabMode();

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

        // Restore Cesium rendering settings with error handling
        if (viewer && viewer.scene && !viewer.isDestroyed()) {
            try {
                if (this.cesiumWasRequestRenderMode !== undefined) {
                    viewer.scene.requestRenderMode = this.cesiumWasRequestRenderMode;
                }
                viewer.clock.shouldAnimate = true; // Resume animation loop
                
                // Add a small delay before requesting render to let cleanup complete
                setTimeout(() => {
                    if (viewer && !viewer.isDestroyed() && viewer.scene) {
                        viewer.scene.requestRender(); // Trigger a render to refresh scene
                        console.log('▶️ Cesium rendering resumed');
                    }
                }, 100);
                
            } catch (error) {
                console.warn('Error restoring Cesium rendering:', error);
                // Try to reinitialize if there's an error
                setTimeout(() => {
                    if (viewer && !viewer.isDestroyed() && viewer.scene) {
                        viewer.scene.requestRender();
                    }
                }, 500);
            }
        }

        // Restore camera position with error handling
        if (viewer && !viewer.isDestroyed() && this.saved3DView) {
            try {
                viewer.camera.flyTo({
                    destination: this.saved3DView.position,
                    orientation: this.saved3DView.orientation,
                    duration: 2.0,
                    complete: () => {
                        console.log('✅ Camera position restored');
                    },
                    cancel: () => {
                        console.log('⚠️ Camera flyTo cancelled');
                    }
                });
            } catch (error) {
                console.warn('Error restoring camera position:', error);
                // Fallback: set camera position directly
                try {
                    if (viewer.camera && this.saved3DView.position) {
                        viewer.camera.setView({
                            destination: this.saved3DView.position,
                            orientation: this.saved3DView.orientation
                        });
                        console.log('✅ Camera position set directly as fallback');
                    }
                } catch (fallbackError) {
                    console.warn('Fallback camera positioning also failed:', fallbackError);
                }
            }
        }

        // Update mode state and UI
        this.isSuperSplatMode = false;
        this.updateButtonStates();

        // Remove CSS class for SuperSplat mode styling
        document.body.classList.remove('supersplat-mode');

        // Show UI elements that should be visible in Cesium mode
        this.showUIForCesiumMode();

        // Trigger site loading in Cesium mode (GeoJSON and Gaussian splat) 
        // but skip if switching from SuperSplat mode as site data is already loaded
        if (!this.wasInSuperSplatMode) {
            this.initializeCesiumSiteVisualization();
        } else {
            console.log('⚡ Skipping site re-initialization - returning from SuperSplat mode');
            this.wasInSuperSplatMode = false; // Reset flag
        }

        console.log('✅ Cesium 3D mode restored');
    }

    /**
     * Initializes site visualization when switching from Lab mode to Cesium mode
     */
    initializeCesiumSiteVisualization() {
        console.log('🌍 Initializing Cesium site visualization...');
        
        // Don't initialize layer controls if we're currently in SuperSplat mode
        if (this.isSuperSplatMode) {
            console.log('⚠️ Skipping layer controls initialization - currently in SuperSplat mode');
            return;
        }
        
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
            
            // Initialize layer controls only when switching to Cesium mode
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
            // Check Gaussian splat loading conditions
            
            if (window.gaussianSplatManager && siteDropdown.value === 'Boyd_Residence_Aerial_and_Ground.geojson') {
                console.log('🎯 Loading digital twin...');
                setTimeout(() => {
                    // Load Gaussian splat digital twin
                    try {
                        window.gaussianSplatManager.loadGaussianSplat('scott-boyd-residence', bounds);
                    } catch (error) {
                        console.error('❌ Error loading Gaussian splat:', error);
                    }
                }, 500); // Delay to ensure camera is positioned
            } else {
                // Enhanced debugging for failed conditions
                if (!window.gaussianSplatManager) {
                    console.warn('❌ GaussianSplatManager not available for splat loading');
                } else if (siteDropdown.value !== 'Boyd_Residence_Aerial_and_Ground.geojson') {
                    console.warn(`❌ Dropdown value mismatch: "${siteDropdown.value}" !== "Boyd_Residence_Aerial_and_Ground.geojson"`);
                }
                
                // Fallback: wait for gaussianSplatManager and retry
                if (!window.gaussianSplatManager) {
                    // Wait for GaussianSplatManager initialization
                    const waitForManager = () => {
                        if (window.gaussianSplatManager && siteDropdown.value === 'Boyd_Residence_Aerial_and_Ground.geojson') {
                            // Retry digital twin loading
                            window.gaussianSplatManager.loadGaussianSplat('scott-boyd-residence', bounds);
                        } else if (window.gaussianSplatManager) {
                            console.warn(`❌ Manager available but dropdown still wrong: "${siteDropdown.value}"`);
                        } else {
                            setTimeout(waitForManager, 200);
                        }
                    };
                    setTimeout(waitForManager, 200);
                }
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

        // Construct URL for SuperSplat with auto-load parameter using Google Cloud Storage
        const splatUrl = window.TerrainConfig ? 
            window.TerrainConfig.getGcsUrl(siteId, 'splat.ply') :
            `https://storage.googleapis.com/terrain-3d-assets/${siteId}/splat.ply`;
        
        // For local development, try to use local SuperSplat if available
        // Use the built SuperSplat editor
        const editorUrl = `/supersplat/index.html?load=${encodeURIComponent(splatUrl)}`;

        console.log('Loading SuperSplat editor:', editorUrl);
        console.log('PLY URL to load:', splatUrl);
        
        // Test if PLY is accessible
        fetch(splatUrl, { method: 'HEAD' })
            .then(response => {
                if (response.ok) {
                    console.log('✅ PLY file is accessible from:', splatUrl);
                } else {
                    console.error('❌ PLY file not accessible:', response.status, response.statusText);
                }
            })
            .catch(error => {
                console.error('❌ Failed to check PLY accessibility:', error);
            });

        // Create iframe for SuperSplat
        this.superSplatIframe = document.createElement('iframe');
        this.superSplatIframe.src = editorUrl;
        this.superSplatIframe.style.width = '100%';
        this.superSplatIframe.style.height = '100%';
        this.superSplatIframe.style.border = 'none';
        this.superSplatIframe.style.position = 'absolute';
        this.superSplatIframe.style.top = '0';
        this.superSplatIframe.style.left = '0';

        // Add error handler for iframe loading issues
        this.superSplatIframe.onerror = () => {
            console.error('Failed to load SuperSplat editor');
        };
        
        // Add loading handler
        this.superSplatIframe.onload = () => {
            console.log('✅ SuperSplat editor loaded successfully');
            console.log('SuperSplat should now load PLY from:', splatUrl);
            console.log('If PLY is not loading, check browser console for CORS or network errors');
            
            // Check if we're in a cross-origin situation
            const isCrossOrigin = editorUrl.includes('testing.ecodash.ai');
            
            // Only try to position button if not cross-origin
            if (!isCrossOrigin) {
                // Position button relative to view-cube once iframe is loaded
                setTimeout(() => {
                    this.positionButtonRelativeToViewCube();
                    this.setInitialSuperSplatView();
                }, 2000); // Allow time for SuperSplat to fully initialize
            } else {
                console.log('Cross-origin iframe detected, skipping DOM manipulation');
                // Use fallback positioning
                this.applyFallbackPositioning();
            }
            
            // Notify loading system that SuperSplat is ready (for Lab mode)
            if (window.independentLoadingState?.isActive) {
                // Add small delay to ensure PLY file starts loading inside iframe
                setTimeout(() => {
                    console.log('🎬 SuperSplat iframe ready - completing loading screen');
                    window.independentLoadingState.complete();
                }, 1500); // 1.5 second delay for PLY to start loading
            }
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
                // In Lab mode - hide SuperSplat button (user should use 2D button for navigation)
                this.superSplatButton.style.display = 'none';
            } else {
                // In Cesium mode - show lab icon to enter Lab mode
                this.superSplatButton.style.display = 'inline-block';
                this.superSplatButton.textContent = '';
                this.superSplatButton.className = 'control-button icon-button lab-icon-button';
                this.superSplatButton.title = 'Switch to Lab mode (SuperSplat editing)';
            }
        }

        // Show/hide buttons based on SuperSplat mode state
        const view2DButton = document.getElementById('viewSwitchButton');
        if (view2DButton) {
            // Show 2D button in Lab mode, hide in Cesium mode (opposite of previous logic)
            view2DButton.style.display = this.isSuperSplatMode ? 'inline-block' : 'none';
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
            const dataUrl = window.TerrainConfig ? 
                window.TerrainConfig.getDataUrl(`${siteId}/splat.ply`) :
                `/data/${siteId}/splat.ply`;
            const response = await fetch(dataUrl, { method: 'HEAD' });
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

    /**
     * Configures UI elements for Lab mode (shows layer controls, hides site selector)
     */
    hideUIForLabMode() {
        console.log('🎨 hideUIForLabMode() called - configuring UI for Lab mode...');

        // Hide site selector dropdown
        const siteSelector = document.getElementById('siteSelector');
        if (siteSelector) {
            siteSelector.style.display = 'none';
            console.log('✅ Site selector hidden for Lab mode');
        }

        // Show layer controls in Lab mode for Boyd format sites (previously hidden)
        const layerControls = document.getElementById('layerControls');
        if (layerControls && window.currentSiteData) {
            // Check if current site is Boyd format (which supports layer controls)
            const format = window.detectGeoJsonFormat ?
                window.detectGeoJsonFormat(window.currentSiteData.features?.[0]) : 'legacy';

            console.log('🔍 Site data format detected:', format);
            console.log('🔍 Site data features count:', window.currentSiteData.features?.length || 0);

            if (format === 'boyd') {
                layerControls.style.display = 'block';
                console.log('✅ Layer controls shown for Boyd format site in Lab mode');

                // Initialize layer controls with current site data
                if (window.initializeLayerControls) {
                    console.log('🎯 Initializing layer controls for Lab mode...');
                    window.initializeLayerControls();
                } else {
                    console.warn('❌ initializeLayerControls function not available');
                }
            } else {
                console.log('⚠️ Non-Boyd format site - layer controls remain hidden');
            }
        } else if (!window.currentSiteData) {
            console.warn('⚠️ No currentSiteData available during hideUIForLabMode()');

            // Auto-load site data for lab mode if not already loaded
            if (window.autoLoadSiteDataForLabMode) {
                console.log('🏠 Attempting to auto-load site data for Lab mode...');
                window.autoLoadSiteDataForLabMode().then(success => {
                    if (success) {
                        console.log('✅ Site data auto-loaded, re-checking layer controls...');
                        // Retry showing layer controls now that data is loaded
                        const format = window.detectGeoJsonFormat ?
                            window.detectGeoJsonFormat(window.currentSiteData.features?.[0]) : 'legacy';

                        if (format === 'boyd') {
                            layerControls.style.display = 'block';
                            console.log('✅ Layer controls shown after auto-load');

                            if (window.initializeLayerControls) {
                                console.log('🎯 Initializing layer controls after auto-load...');
                                window.initializeLayerControls();
                            }
                        }
                    } else {
                        console.error('❌ Failed to auto-load site data for Lab mode');
                    }
                });
            }
        } else if (!layerControls) {
            console.error('❌ layerControls element not found in DOM');
        }

        // Hide focus panel if open
        const focusPanel = document.getElementById('focusPanel');
        if (focusPanel) {
            focusPanel.style.display = 'none';
        }

        // Make Ecodash logo visible (white color for Lab mode)
        const logo = document.getElementById('logo');
        if (logo) {
            logo.style.opacity = '1';
            logo.style.visibility = 'visible';
            logo.style.display = 'block';
            logo.style.zIndex = '1000'; // Ensure it's on top
        }

        // Hide SuperSplat button initially to avoid flash during positioning
        const superSplatButton = document.getElementById('superSplatButton');
        if (superSplatButton) {
            superSplatButton.style.visibility = 'hidden';
        }

        // Position SuperSplat button relative to the view-cube-container
        this.positionButtonRelativeToViewCube();

        // Hide environmental metrics bar (color legend) if visible
        const colorLegend = document.getElementById('colorLegend');
        if (colorLegend) {
            colorLegend.style.display = 'none';
        }

        console.log('🎨 UI hidden for Lab mode');
    }

    /**
     * Shows UI elements that should be visible in Cesium mode
     */
    showUIForCesiumMode() {
        // Show site selector dropdown
        const siteSelector = document.getElementById('siteSelector');
        if (siteSelector) {
            siteSelector.style.display = 'block';
        }

        // Show layer controls if they were visible before
        // (visibility is managed by layerControls.js based on site format)
        const layerControls = document.getElementById('layerControls');
        if (layerControls && window.currentSiteData) {
            // Let layerControls.js determine visibility based on site format
            const format = window.detectGeoJsonFormat ? 
                window.detectGeoJsonFormat(window.currentSiteData.features?.[0]) : 'legacy';
            if (format === 'boyd') {
                layerControls.style.display = 'block';
            }
        }

        // Logo visibility in Cesium mode (handled by CSS - may be less visible)
        const logo = document.getElementById('logo');
        if (logo) {
            logo.style.opacity = ''; // Reset to CSS default
            logo.style.visibility = ''; // Reset to CSS default
        }

        // Reset SuperSplat button positioning to normal for Cesium mode
        const superSplatButton = document.getElementById('superSplatButton');
        if (superSplatButton) {
            // Clear all custom positioning styles
            superSplatButton.style.position = '';
            superSplatButton.style.left = '';
            superSplatButton.style.top = '';
            superSplatButton.style.right = '';
            superSplatButton.style.marginRight = '';
            superSplatButton.style.zIndex = '';
            superSplatButton.style.visibility = ''; // Reset visibility to CSS default
        }

        // Show environmental metrics bar (color legend) if it exists
        const colorLegend = document.getElementById('colorLegend');
        if (colorLegend) {
            colorLegend.style.display = ''; // Reset to CSS default (should be 'flex')
        }

        console.log('🌍 UI shown for Cesium mode');
    }

    /**
     * Apply fallback positioning for cross-origin situations
     */
    applyFallbackPositioning() {
        // Don't show button if in Lab mode
        if (this.isSuperSplatMode) {
            return;
        }

        const superSplatButton = document.getElementById('superSplatButton');
        if (superSplatButton) {
            superSplatButton.style.marginRight = '20px';
            superSplatButton.style.visibility = 'visible';
            console.log('✅ Globe button visible with fallback positioning (cross-origin)');
        }
    }
    
    /**
     * Position the SuperSplat button relative to the view-cube-container in SuperSplat mode
     * Aligns button horizontally with view-cube center and positions it 25px below
     */
    positionButtonRelativeToViewCube() {
        const superSplatButton = document.getElementById('superSplatButton');
        if (!superSplatButton) return;

        // Don't position or show button if in Lab mode (should be hidden)
        if (this.isSuperSplatMode) {
            superSplatButton.style.display = 'none';
            return;
        }

        // Set up positioning with a delay to allow SuperSplat iframe to load
        const positionButton = () => {
            // Try to find the view-cube-container in the SuperSplat iframe
            const iframe = this.superSplatIframe;
            if (!iframe || !iframe.contentWindow) {
                console.log('⚠️ SuperSplat iframe not ready for view-cube positioning');
                return false;
            }

            try {
                const iframeDoc = iframe.contentWindow.document;
                const viewCubeContainer = iframeDoc.getElementById('view-cube-container');
                
                if (!viewCubeContainer) {
                    console.log('⚠️ view-cube-container not found in SuperSplat iframe');
                    return false;
                }

                // Get the view-cube-container position relative to the viewport
                const viewCubeRect = viewCubeContainer.getBoundingClientRect();
                const iframeRect = iframe.getBoundingClientRect();
                
                // Calculate the view-cube position in the main window coordinates
                const viewCubeAbsoluteRect = {
                    left: iframeRect.left + viewCubeRect.left,
                    top: iframeRect.top + viewCubeRect.top,
                    right: iframeRect.left + viewCubeRect.right,
                    bottom: iframeRect.top + viewCubeRect.bottom,
                    width: viewCubeRect.width,
                    height: viewCubeRect.height
                };

                // Calculate horizontal center of view-cube
                const viewCubeHorizontalCenter = viewCubeAbsoluteRect.left + (viewCubeAbsoluteRect.width / 2);
                
                // Calculate position for button: 25px below view-cube bottom, centered horizontally
                const buttonLeft = viewCubeHorizontalCenter - 25; // 25px = half of 50px button width
                const buttonTop = viewCubeAbsoluteRect.bottom + 25; // 25px gap below view-cube

                // Apply positioning
                superSplatButton.style.position = 'fixed';
                superSplatButton.style.left = buttonLeft + 'px';
                superSplatButton.style.top = buttonTop + 'px';
                superSplatButton.style.marginRight = ''; // Clear any existing margin
                superSplatButton.style.right = 'auto'; // Override any right positioning
                superSplatButton.style.zIndex = '1001'; // Ensure it's above SuperSplat content
                superSplatButton.style.visibility = 'visible'; // Show button now that positioning is complete

                console.log(`✅ SuperSplat button positioned relative to view-cube: left=${buttonLeft}px, top=${buttonTop}px`);
                return true;
                
            } catch (error) {
                console.warn('Error positioning button relative to view-cube:', error);
                return false;
            }
        };

        // Try positioning with progressive delays, only show button when done
        let attemptCount = 0;
        const maxAttempts = 3;
        
        const attemptPositioning = () => {
            attemptCount++;
            console.log(`📍 Positioning attempt ${attemptCount}/${maxAttempts}`);
            
            if (positionButton()) {
                // Success - button is now visible
                return;
            }
            
            if (attemptCount < maxAttempts) {
                // Try again with longer delay
                setTimeout(() => attemptPositioning(), attemptCount * 1000);
            } else {
                // Final fallback - show button with margin positioning (only if not in Lab mode)
                if (!this.isSuperSplatMode) {
                    console.log('⚠️ Failed to position button relative to view-cube after multiple attempts');
                    superSplatButton.style.marginRight = '20px';
                    superSplatButton.style.visibility = 'visible';
                    console.log('✅ Globe button visible with fallback positioning');
                }
            }
        };
        
        // Start the positioning attempts
        attemptPositioning();
    }

    /**
     * Set the initial camera view in SuperSplat to top-down +Y orthographic, zoomed out
     * Uses the SuperSplat event system and proper camera API calls from source code analysis
     */
    setInitialSuperSplatView() {
        const iframe = this.superSplatIframe;
        if (!iframe || !iframe.contentWindow) {
            console.log('⚠️ SuperSplat iframe not ready for setting initial view');
            return;
        }

        const iframeWindow = iframe.contentWindow;
        
        // Direct polling approach - check immediately and continuously until scene is ready
        const pollForSceneReady = () => {
            let pollAttempts = 0;
            const maxPollAttempts = 50; // 25 seconds max
            let cameraViewApplied = false;
            
            console.log('🎬 Starting immediate polling for SuperSplat scene readiness...');
            
            const checkScene = () => {
                pollAttempts++;
                
                try {
                    // Check if scene and camera are available
                    const scene = iframeWindow.scene;
                    if (scene && scene.camera && scene.camera.setAzimElev) {
                        
                        // Additional check: make sure there's actual content (distance > 0)
                        const distance = scene.camera.distance;
                        if (distance && distance > 0) {
                            
                            if (!cameraViewApplied) {
                                cameraViewApplied = true;
                                console.log(`✅ SuperSplat scene ready after ${pollAttempts} polls (${pollAttempts * 0.5}s)!`);
                                console.log('🚀 Applying camera view IMMEDIATELY...');
                                
                                // Apply camera view with no delay
                                this.applyCameraView();
                                return;
                            }
                        }
                    }
                    
                    // Continue polling if not ready yet
                    if (pollAttempts < maxPollAttempts && !cameraViewApplied) {
                        setTimeout(checkScene, 500); // Poll every 500ms
                    } else if (!cameraViewApplied) {
                        console.log('⚠️ Polling timed out, trying fallback approach...');
                        this.applyCameraView();
                    }
                    
                } catch (error) {
                    // Continue polling even if there's an error
                    if (pollAttempts < maxPollAttempts && !cameraViewApplied) {
                        setTimeout(checkScene, 500);
                    }
                }
            };
            
            // Start polling immediately
            checkScene();
            
            return true;
        };
        
        // Use the immediate polling approach
        if (!pollForSceneReady()) {
            // Retry after brief delay if initial setup fails
            setTimeout(() => {
                pollForSceneReady();
            }, 1000);
        }
    }

    /**
     * Apply the camera view change using SuperSplat's proper API
     */
    applyCameraView() {
        const iframe = this.superSplatIframe;
        if (!iframe || !iframe.contentWindow) return;
        
        console.log('🎯 Starting camera view application...');
        
        try {
            const iframeWindow = iframe.contentWindow;
            
            // Debug: log available global objects
            console.log('Available iframe globals:', Object.keys(iframeWindow).filter(key => 
                typeof iframeWindow[key] === 'object' && iframeWindow[key] !== null
            ));
            
            // Method 1: Direct scene.camera access - IMMEDIATE execution
            const scene = iframeWindow.scene;
            if (scene && scene.camera && scene.camera.setAzimElev) {
                console.log('🎯 IMMEDIATE camera view change - setAzimElev(0, -90) + 3x zoom out');
                
                // Current camera state for debugging
                const beforeAzim = scene.camera.azim;
                const beforeElev = scene.camera.elevation; 
                const beforeDist = scene.camera.distance;
                
                // Step 1: Apply the orthographic top-down view IMMEDIATELY
                scene.camera.setAzimElev(0, -90);
                
                // Step 2: Zoom out 3x (move 3x higher in Y-axis) 
                if (beforeDist && scene.camera.setDistance) {
                    const newDistance = beforeDist * 3.0; // 3x zoom out for aerial view
                    scene.camera.setDistance(newDistance);
                    console.log(`📏 Distance: ${beforeDist} → ${newDistance} (3x zoom out)`);
                }
                
                // Step 3: Enable orthographic mode if available
                if (scene.camera.hasOwnProperty('ortho')) {
                    scene.camera.ortho = true;
                    console.log('📐 Orthographic projection enabled');
                }
                
                // Verify the changes took effect
                const afterAzim = scene.camera.azim;
                const afterElev = scene.camera.elevation;
                const afterDist = scene.camera.distance;
                
                console.log(`✅ IMMEDIATE camera transformation complete:`);
                console.log(`   Azimuth:   ${beforeAzim}° → ${afterAzim}°`);
                console.log(`   Elevation: ${beforeElev}° → ${afterElev}°`); 
                console.log(`   Distance:  ${beforeDist} → ${afterDist} (3x zoom)`);
                
                // Force a render update if available
                if (scene.update) {
                    scene.update();
                }
                
                return;
            }
            
            // Method 2: Try events system to fire camera.align
            const events = iframeWindow.events || iframeWindow.app?.events || iframeWindow.scene?.events;
            if (events && events.fire) {
                console.log('🎯 Using SuperSplat events system to fire camera.align + zoom out...');
                
                // Fire the +Y axis alignment event
                events.fire('camera.align', 'py'); // +Y axis alignment
                console.log('✅ Fired camera.align event for +Y view');
                
                // Try to zoom out 3x after a short delay to let the view change settle
                setTimeout(() => {
                    const scene = iframeWindow.scene;
                    if (scene && scene.camera && scene.camera.setDistance) {
                        const currentDist = scene.camera.distance;
                        if (currentDist) {
                            const newDistance = currentDist * 3.0;
                            scene.camera.setDistance(newDistance);
                            console.log(`📏 Event-based zoom: ${currentDist} → ${newDistance} (3x zoom out)`);
                        }
                    }
                }, 100); // Brief delay to let view change settle
                
                // Also try to trigger orthographic mode via events if possible
                if (events.fire && iframeWindow.document) {
                    // Try to find and click the orthographic button or similar
                    const orthoElements = iframeWindow.document.querySelectorAll('[title*="ortho"], [title*="Ortho"], .ortho, #ortho');
                    if (orthoElements.length > 0) {
                        orthoElements[0].click();
                        console.log('✅ Clicked potential orthographic mode button');
                    }
                }
                
                return;
            }
            
            // Method 3: Try to find and click the +Y face in the view cube
            const iframeDoc = iframeWindow.document;
            if (iframeDoc) {
                const viewCubeContainer = iframeDoc.getElementById('view-cube-container');
                if (viewCubeContainer) {
                    // Look for the Y circle/text element
                    const yElement = viewCubeContainer.querySelector('text[content="Y"], text[textContent="Y"]') ||
                                     Array.from(viewCubeContainer.querySelectorAll('text')).find(el => el.textContent === 'Y');
                    
                    if (yElement && yElement.parentElement) {
                        console.log('🎯 Found Y element in view-cube, simulating click...');
                        yElement.parentElement.click();
                        console.log('✅ Clicked +Y face in view-cube');
                        return;
                    }
                }
            }
            
            console.log('❌ Could not find any SuperSplat camera control method');

        } catch (error) {
            console.warn('Error applying SuperSplat camera view:', error);
        }
    }

}

// Initialize the SuperSplat manager when the page loads
window.superSplatManager = new SuperSplatManager();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.superSplatManager.initialize();
    
    // Check SuperSplat availability multiple times to catch when site selector is ready
    setTimeout(() => window.superSplatManager.updateSuperSplatAvailability(), 500);
    setTimeout(() => window.superSplatManager.updateSuperSplatAvailability(), 2000);
    setTimeout(() => window.superSplatManager.updateSuperSplatAvailability(), 5000);
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

// Listen for window resize to reposition SuperSplat button in Lab mode
window.addEventListener('resize', () => {
    if (window.superSplatManager && window.superSplatManager.isSuperSplatMode) {
        // Debounce resize events to avoid excessive repositioning
        clearTimeout(window.superSplatManager.resizeTimeout);
        window.superSplatManager.resizeTimeout = setTimeout(() => {
            window.superSplatManager.positionButtonRelativeToViewCube();
        }, 250);
    }
});