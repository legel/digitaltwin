/**
 * SuperSplat View Manager - Handles SuperSplat interface and button positioning
 * Integrates SuperSplat editor for advanced Gaussian splat editing
 */

class SuperSplatManager {
    constructor() {
        this.superSplatButton = null;
        this.superSplatContainer = null;
        this.superSplatIframe = null;
        this.currentSiteId = null;
    }

    /**
     * Initializes the SuperSplat manager and sets up event listeners
     */
    initialize() {
        this.superSplatButton = document.getElementById('superSplatButton');
        this.superSplatContainer = document.getElementById('superSplatContainer');

        if (this.superSplatButton) {
            // SuperSplat button is now purely cosmetic/informational
            // Remove any existing event listeners to avoid conflicts
            this.superSplatButton.replaceWith(this.superSplatButton.cloneNode(true));
            this.superSplatButton = document.getElementById('superSplatButton');
        }

        console.log('✅ SuperSplatManager initialized');
    }

    // Toggle logic removed - SuperSplat-only mode

    // switchToSuperSplat method removed - SuperSplat is now the base state

    // switchToCesium method removed - SuperSplat-only mode

    // initializeCesiumSiteVisualization method removed - SuperSplat-only mode

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
            
            // Button positioning removed - SuperSplat-only mode
            // Only set initial view
            setTimeout(() => {
                this.setInitialSuperSplatView();
            }, 2000); // Allow time for SuperSplat to fully initialize
            
            // Initialize SuperSplat Bridge after iframe loads
            setTimeout(() => {
                if (window.initializeSuperSplatBridge) {
                    console.log('🌉 Initializing SuperSplat Bridge after iframe load');
                    window.initializeSuperSplatBridge();
                }
            }, 2500); // Allow time for SuperSplat scene to initialize

            // Loading acceleration now handled by SuperSplatBridge when splat is actually loaded
            // No longer triggering on iframe ready - wait for actual splat loading
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
     * Updates button states - SuperSplat button is always hidden
     */
    updateButtonStates() {
        // Hide SuperSplat button since we're SuperSplat-only
        if (this.superSplatButton) {
            this.superSplatButton.style.display = 'none';
        }

        console.log('Button states updated');
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
     * Updates SuperSplat button visibility - always hidden since we're SuperSplat-only
     */
    async updateSuperSplatAvailability() {
        if (!this.superSplatButton) return;

        // Always hide button since we're SuperSplat-only
        this.superSplatButton.style.display = 'none';
        console.log('SuperSplat button hidden');
    }

    /**
     * Configures UI elements
     */
    configureUI() {
        console.log('🎨 configureUI() called - configuring UI...');

        // Show layer controls for Boyd format sites
        const layerControls = document.getElementById('layerControls');
        if (layerControls && window.currentSiteData) {
            // Check if current site is Boyd format (which supports layer controls)
            const format = window.detectGeoJsonFormat ?
                window.detectGeoJsonFormat(window.currentSiteData.features?.[0]) : 'legacy';

            console.log('🔍 Site data format detected:', format);
            console.log('🔍 Site data features count:', window.currentSiteData.features?.length || 0);

            if (format === 'boyd') {
                layerControls.style.display = 'block';
                console.log('✅ Layer controls shown for Boyd format site');

                // Initialize layer controls with current site data
                if (window.initializeLayerControls) {
                    console.log('🎯 Initializing layer controls...');
                    window.initializeLayerControls();
                } else {
                    console.warn('❌ initializeLayerControls function not available');
                }
            } else {
                console.log('⚠️ Non-Boyd format site - layer controls remain hidden');
            }
        } else if (!window.currentSiteData) {
            console.warn('⚠️ No currentSiteData available');

            // Auto-load site data if not already loaded
            if (window.autoLoadSiteData) {
                console.log('🏠 Attempting to auto-load site data...');
                window.autoLoadSiteData().then(success => {
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
                        console.log('❌ Failed to auto-load site data');
                    }
                });
            }
        } else if (!layerControls) {
            console.error('❌ layerControls element not found in DOM');
        }

        // Make Ecodash logo visible
        const logo = document.getElementById('logo');
        if (logo) {
            logo.style.opacity = '1';
            logo.style.visibility = 'visible';
            logo.style.display = 'block';
            logo.style.zIndex = '1000'; // Ensure it's on top
        }

        // Hide SuperSplat button (no longer needed)
        const superSplatButton = document.getElementById('superSplatButton');
        if (superSplatButton) {
            superSplatButton.style.display = 'none';
        }

        console.log('🎨 UI configured');
    }

    // showUIForCesiumMode method removed - SuperSplat-only mode

    // applyFallbackPositioning method removed - SuperSplat button no longer needed
    
    // positionButtonRelativeToViewCube method removed - SuperSplat button no longer needed

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
        // Update availability for new site
        setTimeout(() => {
            window.superSplatManager.updateSuperSplatAvailability();
        }, 500);
    }
});

// Resize listener removed - SuperSplat button positioning no longer needed