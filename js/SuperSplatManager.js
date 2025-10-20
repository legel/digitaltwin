/**
 * SuperSplat View Manager - Handles SuperSplat interface integration
 * Integrates SuperSplat editor for advanced Gaussian splat editing
 */

class SuperSplatManager {
    constructor() {
        this.superSplatContainer = null;
        this.superSplatIframe = null;
        this.currentSiteId = null;
    }

    /**
     * Initializes the SuperSplat manager and sets up event listeners
     */
    initialize() {
        this.superSplatContainer = document.getElementById('superSplatContainer');

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

        
        // Test if PLY is accessible
        fetch(splatUrl, { method: 'HEAD' })
            .then(response => {
                if (response.ok) {
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
     * Configures UI elements
     */
    configureUI() {

        // Show layer controls for Boyd format sites
        const layerControls = document.getElementById('layerControls');
        if (layerControls && window.currentSiteData) {
            // Check if current site is Boyd format (which supports layer controls)
            const format = window.detectGeoJsonFormat ?
                window.detectGeoJsonFormat(window.currentSiteData.features?.[0]) : 'legacy';


            if (format === 'boyd') {
                layerControls.style.display = 'block';

                // Initialize layer controls with current site data
                if (window.initializeLayerControls) {
                    window.initializeLayerControls();
                } else {
                    console.warn('❌ initializeLayerControls function not available');
                }
            } else {
            }
        } else if (!window.currentSiteData) {
            console.warn('⚠️ No currentSiteData available');

            // Auto-load site data if not already loaded
            if (window.autoLoadSiteData) {
                window.autoLoadSiteData().then(success => {
                    if (success) {
                        // Retry showing layer controls now that data is loaded
                        const format = window.detectGeoJsonFormat ?
                            window.detectGeoJsonFormat(window.currentSiteData.features?.[0]) : 'legacy';

                        if (format === 'boyd') {
                            layerControls.style.display = 'block';

                            if (window.initializeLayerControls) {
                                window.initializeLayerControls();
                            }
                        }
                    } else {
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
        
        
        try {
            const iframeWindow = iframe.contentWindow;
            
            // Debug: log available global objects
            
            // Method 1: Direct scene.camera access - IMMEDIATE execution
            const scene = iframeWindow.scene;
            if (scene && scene.camera && scene.camera.setAzimElev) {
                    
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
                }
                
                // Step 3: Enable orthographic mode if available
                if (scene.camera.hasOwnProperty('ortho')) {
                    scene.camera.ortho = true;
                }
                
                // Verify the changes took effect
                const afterAzim = scene.camera.azim;
                const afterElev = scene.camera.elevation;
                const afterDist = scene.camera.distance;
                
                
                // Force a render update if available
                if (scene.update) {
                    scene.update();
                }
                
                return;
            }
            
            // Method 2: Try events system to fire camera.align
            const events = iframeWindow.events || iframeWindow.app?.events || iframeWindow.scene?.events;
            if (events && events.fire) {
                
                // Fire the +Y axis alignment event
                events.fire('camera.align', 'py'); // +Y axis alignment
                
                // Try to zoom out 3x after a short delay to let the view change settle
                setTimeout(() => {
                    const scene = iframeWindow.scene;
                    if (scene && scene.camera && scene.camera.setDistance) {
                        const currentDist = scene.camera.distance;
                        if (currentDist) {
                            const newDistance = currentDist * 3.0;
                            scene.camera.setDistance(newDistance);
                        }
                    }
                }, 100); // Brief delay to let view change settle
                
                // Also try to trigger orthographic mode via events if possible
                if (events.fire && iframeWindow.document) {
                    // Try to find and click the orthographic button or similar
                    const orthoElements = iframeWindow.document.querySelectorAll('[title*="ortho"], [title*="Ortho"], .ortho, #ortho');
                    if (orthoElements.length > 0) {
                        orthoElements[0].click();
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
                        yElement.parentElement.click();
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
    
});


// Resize listener removed - SuperSplat button positioning no longer needed