/**
 * SuperSplat View Manager - Handles SuperSplat interface integration
 * Integrates SuperSplat editor for advanced Gaussian splat editing
 */

class SuperSplatManager {
    constructor() {
        this.superSplatContainer = null;
        this.superSplatIframe = null;
        this.currentSiteId = null;
        // Track camera state for smooth transitions
        this.lastKnownCameraDistance = null;
        this.lastKnownFocalPoint = null;
    }

    /**
     * Initializes the SuperSplat manager and sets up event listeners
     */
    initialize() {
        this.superSplatContainer = document.getElementById('superSplatContainer');

    }

    /**
     * Loads SuperSplat editor in an iframe with the current site's splat file
     */
    loadSuperSplatEditor(siteId) {
        if (!this.superSplatContainer) {
            console.error('SuperSplat container not found');
            return;
        }

        // Construct URL for SuperSplat with auto-load parameter using local proxy
        const splatUrl = `/data/${siteId}/splat.ply`;

        // Use the built SuperSplat editor
        const editorUrl = `/supersplat/index.html?load=${encodeURIComponent(splatUrl)}`;

        // Test if PLY is accessible
        fetch(splatUrl, { method: 'HEAD' })
            .then(response => {
                if (!response.ok) {
                    console.error('PLY file not accessible:', response.status, response.statusText);
                }
            })
            .catch(error => {
                console.error('Failed to check PLY accessibility:', error);
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
            // Set initial view
            setTimeout(() => {
                this.setInitialSuperSplatView();
            }, 2000);

            // Initialize SuperSplat Bridge after iframe loads
            setTimeout(() => {
                if (window.initializeSuperSplatBridge) {
                    window.initializeSuperSplatBridge();
                }
            }, 2500);
        };

        this.superSplatIframe.onerror = (error) => {
            console.error('Failed to load SuperSplat editor:', error);
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
     * Configures UI elements
     */
    configureUI() {
        // Show layer controls for Boyd format sites
        const layerControls = document.getElementById('layerControls');
        if (layerControls && window.currentSiteData) {
            // Check if current site is Boyd format (which supports layer controls)
            const geoJsonFormat = window.detectGeoJsonFormat ?
                window.detectGeoJsonFormat(window.currentSiteData.features?.[0]) : 'legacy';

            if (geoJsonFormat === 'boyd') {
                layerControls.style.display = 'block';

                // Initialize layer controls with current site data
                if (window.initializeLayerControls) {
                    window.initializeLayerControls();
                } else {
                    console.warn('initializeLayerControls function not available');
                }
            }
        } else if (!window.currentSiteData) {
            // Auto-load site data if not already loaded
            if (window.autoLoadSiteData) {
                window.autoLoadSiteData().then(success => {
                    if (success) {
                        // Retry showing layer controls now that data is loaded
                        const geoJsonFormat = window.detectGeoJsonFormat ?
                            window.detectGeoJsonFormat(window.currentSiteData.features?.[0]) : 'legacy';

                        if (geoJsonFormat === 'boyd') {
                            layerControls.style.display = 'block';

                            if (window.initializeLayerControls) {
                                window.initializeLayerControls();
                            }
                        }
                    }
                });
            }
        } else if (!layerControls) {
            console.error('layerControls element not found in DOM');
        }

        // Make Ecodash logo visible
        const logo = document.getElementById('logo');
        if (logo) {
            logo.style.opacity = '1';
            logo.style.visibility = 'visible';
            logo.style.display = 'block';
            logo.style.zIndex = '1000';
        }
    }

    /**
     * Set the initial camera view in SuperSplat to top-down +Y orthographic, zoomed out
     * Uses the SuperSplat event system and proper camera API calls from source code analysis
     */
    setInitialSuperSplatView() {
        const iframe = this.superSplatIframe;
        if (!iframe || !iframe.contentWindow) {
            return;
        }

        const iframeWindow = iframe.contentWindow;

        // Poll until scene is ready
        const pollForSceneReady = () => {
            let pollAttempts = 0;
            const maxPollAttempts = 50;
            let cameraViewApplied = false;

            const checkScene = () => {
                pollAttempts++;

                try {
                    // Check if scene and camera are available
                    const scene = iframeWindow.scene;
                    if (scene && scene.camera && scene.camera.setAzimElev) {
                        const distance = scene.camera.distance;
                        if (distance && distance > 0) {
                            if (!cameraViewApplied) {
                                cameraViewApplied = true;
                                this.applyCameraView();
                                return;
                            }
                        }
                    }

                    // Continue polling if not ready yet
                    if (pollAttempts < maxPollAttempts && !cameraViewApplied) {
                        setTimeout(checkScene, 500);
                    } else if (!cameraViewApplied) {
                        this.applyCameraView();
                    }

                } catch (error) {
                    // Continue polling even if there's an error
                    if (pollAttempts < maxPollAttempts && !cameraViewApplied) {
                        setTimeout(checkScene, 500);
                    }
                }
            };

            checkScene();
            return true;
        };

        if (!pollForSceneReady()) {
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

            // Method 1: Direct scene.camera access
            const scene = iframeWindow.scene;
            if (scene && scene.camera && scene.camera.setAzimElev) {
                const beforeDist = scene.camera.distance;

                // Apply orthographic top-down view
                scene.camera.setAzimElev(0, -90);

                // Zoom out 3x for aerial view
                if (beforeDist && scene.camera.setDistance) {
                    const newDistance = beforeDist * 3.0;
                    scene.camera.setDistance(newDistance);
                }

                // Enable orthographic mode if available
                if (scene.camera.hasOwnProperty('ortho')) {
                    scene.camera.ortho = true;
                }

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
                events.fire('camera.align', 'py');

                // Zoom out 3x after a short delay
                setTimeout(() => {
                    const scene = iframeWindow.scene;
                    if (scene && scene.camera && scene.camera.setDistance) {
                        const currentDist = scene.camera.distance;
                        if (currentDist) {
                            const newDistance = currentDist * 3.0;
                            scene.camera.setDistance(newDistance);
                        }
                    }
                }, 100);

                return;
            }

            // Method 3: Try to find and click the +Y face in the view cube
            const iframeDoc = iframeWindow.document;
            if (iframeDoc) {
                const viewCubeContainer = iframeDoc.getElementById('view-cube-container');
                if (viewCubeContainer) {
                    const yElement = viewCubeContainer.querySelector('text[content="Y"], text[textContent="Y"]') ||
                                     Array.from(viewCubeContainer.querySelectorAll('text')).find(el => el.textContent === 'Y');

                    if (yElement && yElement.parentElement) {
                        yElement.parentElement.click();
                        return;
                    }
                }
            }

        } catch (error) {
            console.warn('Error applying SuperSplat camera view:', error);
        }
    }

    /**
     * Set camera to top-down view if not already in one
     * This is used by the auto zoom-to feature for dropdown buttons
     * @param {boolean} animate - Whether to animate the transition (default: true)
     */
    setTopDownView(animate = true) {
        const iframe = this.superSplatIframe;
        if (!iframe || !iframe.contentWindow) {
            return false;
        }

        try {
            const iframeWindow = iframe.contentWindow;
            const scene = iframeWindow.scene;

            if (!scene || !scene.camera) {
                return false;
            }

            // Check if camera is already in top-down view (elevation near -90 degrees)
            const currentElevation = scene.camera.elevation || 0;
            const isAlreadyTopDown = Math.abs(currentElevation + 90) < 5;

            if (isAlreadyTopDown) {
                return true;
            }

            // Method 1: Direct camera control for immediate rotation
            if (scene.camera.setAzimElev) {
                // Set to top-down view: azimuth 0, elevation -90 (looking down Y-axis)
                scene.camera.setAzimElev(0, -90);

                // Enable orthographic mode if available for better architectural viewing
                if (scene.camera.hasOwnProperty('ortho')) {
                    scene.camera.ortho = true;
                }

                // Force a render update if available
                if (scene.update) {
                    scene.update();
                }

                return true;
            }

            // Method 2: Try events system as fallback
            const events = iframeWindow.events || iframeWindow.app?.events || scene.events;
            if (events && events.fire) {
                events.fire('camera.align', 'py'); // +Y axis alignment (top-down)
                return true;
            }

            return false;

        } catch (error) {
            console.error('Error setting top-down view:', error);
            return false;
        }
    }

    /**
     * Check if camera is currently in top-down view
     * @returns {boolean} True if camera is in top-down view
     */
    isTopDownView() {
        const iframe = this.superSplatIframe;
        if (!iframe || !iframe.contentWindow) {
            return false;
        }

        try {
            const scene = iframe.contentWindow.scene;
            if (!scene || !scene.camera) {
                return false;
            }

            const currentElevation = scene.camera.elevation || 0;
            return Math.abs(currentElevation + 90) < 5;
        } catch (error) {
            return false;
        }
    }

    /**
     * Calculate the center point and extents of multiple polygons for camera positioning
     * @param {Array} polygonNames - Array of polygon names from selectedPolygons
     * @returns {Object|null} - {center: {x, y, z}, extents: {minX, maxX, minZ, maxZ, width, height}} or null if no polygons found
     */
    calculatePolygonGroupBounds(polygonNames) {
        if (!polygonNames || polygonNames.length === 0) {
            return null;
        }

        // Get polygon manager
        const polygonManager = window.superSplatBridge?.polygonManager;
        if (!polygonManager) {
            return null;
        }

        const validPolygons = [];
        let minX = Infinity, maxX = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        let totalY = 0, yCount = 0;

        // Collect all vertices from all selected polygons to find true extents
        for (const polygonName of polygonNames) {
            const polygon = polygonManager.findPolygon(polygonName);
            if (polygon && polygon.vertices && polygon.vertices.length >= 3) {
                validPolygons.push(polygon);

                // Check all vertices to find min/max extents
                for (const vertex of polygon.vertices) {
                    if (vertex.x < minX) minX = vertex.x;
                    if (vertex.x > maxX) maxX = vertex.x;
                    if (vertex.z < minZ) minZ = vertex.z;
                    if (vertex.z > maxZ) maxZ = vertex.z;

                    // Accumulate Y values for average height
                    totalY += vertex.y || 0;
                    yCount++;
                }
            }
        }

        if (validPolygons.length === 0) {
            return null;
        }

        // Calculate center point and extents
        const center = {
            x: (minX + maxX) / 2,
            y: totalY / yCount,
            z: (minZ + maxZ) / 2
        };

        const extents = {
            minX, maxX, minZ, maxZ,
            width: maxX - minX,
            height: maxZ - minZ
        };

        return { center, extents };
    }

    /**
     * Calculate optimal camera distance for polygon group based on screen coverage requirements
     * @param {Object} extents - Polygon extents {width, height}
     * @param {number} verticalCoverage - Desired vertical screen coverage (0.0 to 1.0)
     * @param {number} leftHalfCoverage - Desired coverage of left 50% of screen (0.0 to 1.0)
     * @returns {number} - Optimal camera distance (Y-axis offset)
     */
    calculateOptimalZoom(extents, verticalCoverage = 1.0, leftHalfCoverage = 0.60) {
        if (!extents || extents.width <= 0 || extents.height <= 0) {
            return 10;
        }

        // Get actual screen dimensions from SuperSplat canvas
        const iframe = this.superSplatIframe;
        if (!iframe || !iframe.contentWindow) {
            return 10;
        }

        let screenWidth, screenHeight;
        try {
            const canvas = iframe.contentWindow.document.querySelector('canvas');
            if (canvas) {
                screenWidth = canvas.clientWidth || canvas.width;
                screenHeight = canvas.clientHeight || canvas.height;
            } else {
                screenWidth = iframe.contentWindow.innerWidth;
                screenHeight = iframe.contentWindow.innerHeight;
            }
        } catch (error) {
            screenWidth = window.innerWidth;
            screenHeight = window.innerHeight;
        }

        if (!screenWidth || !screenHeight) {
            return 10;
        }

        const aspectRatio = screenWidth / screenHeight;

        // Get camera info to understand the projection scaling
        let cameraFOV = 45;
        try {
            const scene = iframe.contentWindow.scene;
            if (scene && scene.camera) {
                cameraFOV = scene.camera.fov || scene.camera.fieldOfView || 45;
            }
        } catch (error) {
            // Use default FOV
        }

        // Convert FOV to radians for calculation
        const fovRadians = (cameraFOV * Math.PI) / 180;

        // Calculate world space dimensions that would be visible at distance = 1
        const baseVisibleHeight = 2 * Math.tan(fovRadians / 2);
        const baseVisibleWidth = baseVisibleHeight * aspectRatio;

        // Calculate required distance for vertical constraint (100% screen height)
        const requiredDistanceForHeight = (extents.height / verticalCoverage) / baseVisibleHeight;

        // Calculate required distance for horizontal constraint (left 50% of screen)
        const leftHalfScreenWidth = baseVisibleWidth * 0.5;
        const availableHorizontalSpace = leftHalfScreenWidth * leftHalfCoverage;
        const requiredDistanceForWidth = (extents.width / availableHorizontalSpace);

        // Use the larger distance to ensure both constraints are satisfied
        const optimalDistance = Math.max(requiredDistanceForHeight, requiredDistanceForWidth);

        // Add minimum distance to prevent camera getting too close
        const minDistance = 2.0;
        const finalDistance = Math.max(optimalDistance, minDistance);

        return finalDistance;
    }

    /**
     * Position camera to focus on polygon group center with left offset and optimal zoom
     * @param {Array} polygonNames - Array of polygon names to focus on
     * @returns {boolean} - Success/failure of positioning
     */
    positionCameraOnPolygons(polygonNames) {
        const bounds = this.calculatePolygonGroupBounds(polygonNames);
        if (!bounds) {
            return false;
        }

        const { center: groupCenter, extents } = bounds;
        var optimalDistance;
        if (polygonNames && polygonNames[0].includes("NPA")) {
            optimalDistance = this.calculateOptimalZoom(extents, 1.0, 1.8); // NPAs can be zoomed in further
        } else {
            optimalDistance = this.calculateOptimalZoom(extents);
        }

        const iframe = this.superSplatIframe;
        if (!iframe || !iframe.contentWindow) {
            return false;
        }

        try {
            const iframeWindow = iframe.contentWindow;
            const scene = iframeWindow.scene;

            if (!scene || !scene.camera) {
                return false;
            }

            // Calculate proper screen-space offset for close to left edge
            const viewportWorldWidth = optimalDistance * 2;
            var offsetFactor = 0.6;
            if (polygonNames && polygonNames[0].includes("NPA")) { //NPAs are more centered
                offsetFactor = 0.1;
            }
            const worldOffsetX = viewportWorldWidth * offsetFactor;

            const offsetFocalPoint = {
                x: groupCenter.x + worldOffsetX,
                y: groupCenter.y,
                z: groupCenter.z
            };

            // Try to create smooth transition using custom animation approach
            if (this.animateCameraToPosition(scene.camera, offsetFocalPoint, optimalDistance)) {
                return true;
            } else if (scene.camera.focus && typeof scene.camera.focus === 'function') {
                // Fallback to instant positioning
                scene.camera.focus({
                    focalPoint: offsetFocalPoint,
                    radius: optimalDistance
                });
                return true;
            } else {
                return false;
            }

        } catch (error) {
            console.error('Error positioning camera on polygons:', error);
            return false;
        }
    }

    /**
     * Create smooth camera animation to target position using requestAnimationFrame
     * @param {Object} camera - SuperSplat camera object
     * @param {Object} targetFocalPoint - Target focal point {x, y, z}
     * @param {number} targetDistance - Target camera distance
     * @returns {boolean} - Success/failure of animation start
     */
    animateCameraToPosition(camera, targetFocalPoint, targetDistance) {
        if (!camera || !camera.focus || typeof camera.focus !== 'function') {
            return false;
        }

        try {
            // Use SuperSplat's built-in focus method with speed parameter for smooth animation
            const speed = 2;

            camera.focus({
                focalPoint: targetFocalPoint,
                radius: targetDistance,
                speed: speed
            });

            return true;

        } catch (error) {
            console.error('Error starting camera focus animation:', error);
            return false;
        }
    }

}

// Initialize the SuperSplat manager when the page loads
window.superSplatManager = new SuperSplatManager();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.superSplatManager.initialize();
    
});


