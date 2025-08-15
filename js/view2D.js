/**
 * 2D View Manager - Handles switching between 3D and 2D top-down views
 * Calculates optimal camera positioning for viewing all plantable areas
 */

class View2DManager {
    constructor() {
        this.is2DMode = false;
        this.saved3DView = null;
        this.viewSwitchButton = null;
        this.screenshotInProgress = false; // Prevent multiple screenshot captures
        this.screenshotBounds = null; // Geographic bounds of the screenshot
    }

    /**
     * Initializes the 2D view manager and sets up event listeners
     */
    initialize() {
        this.viewSwitchButton = document.getElementById('viewSwitchButton');
        if (this.viewSwitchButton) {
            // Remove any existing event listeners to avoid conflicts
            this.viewSwitchButton.replaceWith(this.viewSwitchButton.cloneNode(true));
            this.viewSwitchButton = document.getElementById('viewSwitchButton');
            this.viewSwitchButton.addEventListener('click', () => this.toggleView());
        }
    }


    /**
     * Toggles between 3D and 2D view modes
     */
    toggleView() {
        if (this.is2DMode) {
            this.switchTo3D();
        } else {
            this.switchTo2D();
        }
    }

    /**
     * Switches to 2D top-down view mode
     */
    switchTo2D() {
        if (!window.map3D || !window.currentSiteData) {
            console.warn('CesiumManager or site data not available');
            return;
        }

        const viewer = window.map3D.viewer;
        
        // Save current 3D camera position
        this.saved3DView = {
            position: viewer.camera.position.clone(),
            orientation: {
                heading: viewer.camera.heading,
                pitch: viewer.camera.pitch,
                roll: viewer.camera.roll
            }
        };

        // Calculate optimal 2D camera position
        const optimalView = this.calculateOptimal2DView();
        if (!optimalView) {
            console.warn('Could not calculate optimal 2D view');
            return;
        }

        console.log('📷 Switching to 2D view...');

        // Animate to initial 2D position
        viewer.camera.flyTo({
            destination: optimalView.position,
            orientation: optimalView.orientation,
            duration: 3.0, // 3 second animation as requested
            complete: () => {
                this.is2DMode = true;
                this.updateButtonState();
                
                // Wait for Gaussian splat quality to restore, THEN start sophisticated transition
                console.log('⏳ Camera positioned, waiting for splat quality restoration...');
                setTimeout(() => {
                    console.log('🎬 Starting sophisticated transition animation...');
                    
                    // Initialize transition animation manager if not already done
                    if (window.transitionAnimationManager) {
                        window.transitionAnimationManager.initialize();
                        
                        // Start the sophisticated transition animation sequence
                        window.transitionAnimationManager.startTransition();
                    } else {
                        // Fallback to simple transition if animation manager not available
                        console.warn('⚠️ TransitionAnimationManager not available, falling back to simple transition');
                        this.fallbackSimpleTransition();
                    }
                }, 500); // Wait for motion mode to complete
            }
        });
    }

    /**
     * Fallback to simple transition if animation manager not available
     */
    fallbackSimpleTransition() {
        console.log('🎯 Starting fallback simple transition...');
        this.capture2DBackgroundScreenshot().then((screenshotData) => {
            console.log('🎯 Screenshot capture completed, activating Two.js canvas...');
            // After screenshot is captured, activate Two.js 2D canvas
            if (window.two2DManager) {
                window.two2DManager.activate();
            }
        }).catch((error) => {
            console.error('❌ Screenshot capture failed:', error);
            console.log('🔄 Activating Two.js canvas without background image...');
            // Still activate Two.js canvas even if screenshot fails
            if (window.two2DManager) {
                window.two2DManager.activate();
            }
        });
    }

    /**
     * Iteratively adjusts camera height using computeViewRectangle until target bounds fit
     * @param {Object} debugInfo - Debug information with target bounds and buffered bounds
     */
    iterativelyAdjustCameraHeight(debugInfo) {
        const viewer = window.map3D.viewer;
        const camera = viewer.camera;
        const maxAttempts = 10;
        let attempt = 0;
        
        // Target bounds we want to fit (with 40% buffer)
        const targetRectangle = new Cesium.Rectangle(
            Cesium.Math.toRadians(debugInfo.bufferedBounds.west),
            Cesium.Math.toRadians(debugInfo.bufferedBounds.south),
            Cesium.Math.toRadians(debugInfo.bufferedBounds.east),
            Cesium.Math.toRadians(debugInfo.bufferedBounds.north)
        );
        
        console.log(`🔄 Starting iterative camera adjustment...`);
        console.log(`  Target rectangle (buffered):`, debugInfo.bufferedBounds);
        
        const adjustStep = () => {
            attempt++;
            
            // Get current camera position and view rectangle
            const currentPos = camera.positionCartographic;
            const currentHeight = currentPos.height;
            const currentLon = Cesium.Math.toDegrees(currentPos.longitude);
            const currentLat = Cesium.Math.toDegrees(currentPos.latitude);
            
            // Get current view rectangle using Cesium's computeViewRectangle
            const viewRectangle = camera.computeViewRectangle();
            
            if (viewRectangle) {
                const viewBounds = {
                    west: Cesium.Math.toDegrees(viewRectangle.west),
                    east: Cesium.Math.toDegrees(viewRectangle.east),
                    south: Cesium.Math.toDegrees(viewRectangle.south),
                    north: Cesium.Math.toDegrees(viewRectangle.north)
                };
                
                console.log(`🔄 Attempt ${attempt}: Height ${currentHeight.toFixed(1)}m`);
                console.log(`  Camera: ${currentLon.toFixed(6)}, ${currentLat.toFixed(6)}`);
                console.log(`  View bounds:`, viewBounds);
                
                // Check if target rectangle fits within view rectangle
                const targetFitsInView = (
                    viewBounds.west <= debugInfo.bufferedBounds.west &&
                    viewBounds.east >= debugInfo.bufferedBounds.east &&
                    viewBounds.south <= debugInfo.bufferedBounds.south &&
                    viewBounds.north >= debugInfo.bufferedBounds.north
                );
                
                // Calculate how much the view spans vs target spans
                const viewLatSpan = viewBounds.north - viewBounds.south;
                const viewLonSpan = viewBounds.east - viewBounds.west;
                const targetLatSpan = debugInfo.bufferedBounds.north - debugInfo.bufferedBounds.south;
                const targetLonSpan = debugInfo.bufferedBounds.east - debugInfo.bufferedBounds.west;
                
                const latRatio = viewLatSpan / targetLatSpan;
                const lonRatio = viewLonSpan / targetLonSpan;
                
                console.log(`  Span ratios: lat ${latRatio.toFixed(2)}x, lon ${lonRatio.toFixed(2)}x (target: ~1.0x)`);
                console.log(`  Target fits in view: ${targetFitsInView}`);
                
                // If target fits and we're reasonably close to 1.0x ratio, we're done
                if (targetFitsInView && Math.min(latRatio, lonRatio) >= 0.8 && Math.max(latRatio, lonRatio) <= 1.5) {
                    console.log(`✅ Camera adjustment complete after ${attempt} attempts`);
                    this.verifyViewCoverage(debugInfo.bounds);
                    this.addVisualDebugOverlays(debugInfo);
                    return;
                }
                
                // Simple incremental approach: move up 50m each attempt
                const newHeight = currentHeight + 50;
                
                console.log(`  Moving camera up 50m → ${newHeight.toFixed(1)}m`);
                
                // Move camera to new height
                const newPosition = Cesium.Cartesian3.fromDegrees(currentLon, currentLat, newHeight);
                camera.setView({
                    destination: newPosition,
                    orientation: {
                        heading: 0.0,
                        pitch: -Math.PI / 2,
                        roll: 0.0
                    }
                });
                
                // Continue adjusting after a short delay
                if (attempt < maxAttempts) {
                    setTimeout(adjustStep, 200);
                } else {
                    console.log(`⚠️ Max attempts (${maxAttempts}) reached`);
                    this.verifyViewCoverage(debugInfo.bounds);
                    this.addVisualDebugOverlays(debugInfo);
                }
            } else {
                console.warn(`⚠️ Could not compute view rectangle for attempt ${attempt}`);
                if (attempt < maxAttempts) {
                    setTimeout(adjustStep, 200);
                } else {
                    this.verifyViewCoverage(debugInfo.bounds);
                    this.addVisualDebugOverlays(debugInfo);
                }
            }
        };
        
        // Start the adjustment process
        adjustStep();
    }

    /**
     * Switches back to 3D view mode
     */
    switchTo3D() {
        if (!window.map3D || !this.saved3DView) {
            console.warn('CesiumManager or saved 3D view not available');
            return;
        }

        const viewer = window.map3D.viewer;

        // Clean up transition animation and deactivate Two.js 2D canvas before switching
        if (window.transitionAnimationManager) {
            window.transitionAnimationManager.cleanupFor3D();
        }
        
        if (window.two2DManager) {
            window.two2DManager.deactivate();
        }

        // Change logo back to white version for 3D mode
        this.restoreLogoFor3DMode();

        // Animate back to saved 3D position
        viewer.camera.flyTo({
            destination: this.saved3DView.position,
            orientation: this.saved3DView.orientation,
            duration: 3.0,
            complete: () => {
                this.is2DMode = false;
                this.updateButtonState();
            }
        });
    }

    /**
     * Calculates optimal camera position for 2D top-down view of all plantable areas
     * @returns {Object} - Camera position and orientation for optimal 2D view
     */
    calculateOptimal2DView() {
        if (!window.currentSiteData || !window.currentSiteData.features) {
            return null;
        }

        // Get all visible polygons (matches what user sees visualized)
        const visiblePolygons = this.getAllVisiblePolygons();
        if (visiblePolygons.length === 0) {
            console.warn('No visible polygons found');
            return null;
        }

        // Calculate bounds of all visible polygons 
        const bounds = this.calculatePolygonBounds(visiblePolygons);
        
        // Calculate center point
        const centerLon = (bounds.west + bounds.east) / 2;
        const centerLat = (bounds.south + bounds.north) / 2;

        // Calculate required height to fit all areas with 20% buffer
        const requiredHeight = this.calculateRequiredHeight(bounds);

        return {
            position: Cesium.Cartesian3.fromDegrees(centerLon, centerLat, requiredHeight),
            orientation: {
                heading: 0.0, // North
                pitch: -Math.PI / 2, // Looking straight down
                roll: 0.0
            },
            debugInfo: {
                bounds: bounds,
                height: requiredHeight,
                center: { lon: centerLon, lat: centerLat }
            }
        };
    }

    /**
     * Gets all visible polygons (both plantable and non-plantable) that are currently visualized
     * This matches what the user actually sees on screen
     * @returns {Array} - Array of all visible features
     */
    getAllVisiblePolygons() {
        const allPolygons = [];
        
        if (!window.currentSiteData || !window.currentSiteData.features) {
            return allPolygons;
        }

        const format = window.detectGeoJsonFormat ? window.detectGeoJsonFormat(window.currentSiteData.features[0]) : 'boyd';

        // Include all features that would be visualized (both PA and NPA)
        window.currentSiteData.features.forEach(feature => {
            if (feature.geometry && (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon')) {
                // Include all polygon features that are not just reference points
                const name = feature.properties.name || '';
                
                // Skip pure numeric reference points and test features
                if (!/^\d+$/.test(name) && !name.includes('Test ID')) {
                    allPolygons.push(feature);
                }
            }
        });

        return allPolygons;
    }

    /**
     * Calculates the bounding box of all polygon features
     * @param {Array} polygons - Array of polygon features
     * @returns {Object} - Bounds object with north, south, east, west
     */
    calculatePolygonBounds(polygons) {
        let bounds = {
            north: -Infinity,
            south: Infinity,
            east: -Infinity,
            west: Infinity
        };

        polygons.forEach(feature => {
            if (feature.geometry.type === 'Polygon') {
                // Single polygon - process all coordinate rings (outer + holes)
                feature.geometry.coordinates.forEach(ring => {
                    this.updateBoundsWithCoordinates(bounds, ring);
                });
            } else if (feature.geometry.type === 'MultiPolygon') {
                // Multiple polygons - process each polygon's rings
                feature.geometry.coordinates.forEach(polygon => {
                    polygon.forEach(ring => {
                        this.updateBoundsWithCoordinates(bounds, ring);
                    });
                });
            }
        });

        return bounds;
    }

    /**
     * Updates bounds with coordinate array
     * @param {Object} bounds - Bounds object to update
     * @param {Array} coordinates - Array of [lon, lat] coordinates
     */
    updateBoundsWithCoordinates(bounds, coordinates) {
        coordinates.forEach(coord => {
            const [lon, lat] = coord;
            bounds.west = Math.min(bounds.west, lon);
            bounds.east = Math.max(bounds.east, lon);
            bounds.south = Math.min(bounds.south, lat);
            bounds.north = Math.max(bounds.north, lat);
        });
    }

    /**
     * Gets viewport dimensions in meters for a given camera height
     * @param {number} height - Camera height in meters
     * @param {number} screenAspectRatio - Screen width/height ratio
     * @returns {Object} - Half-distances in meters
     */
    getViewportDimensions(height, screenAspectRatio) {
        // DUAL-VARIABLE ASPECT RATIO FUNCTION:
        // Both lat and lon are affected by aspect ratio to different degrees
        // Based on empirical data from desktop (AR=2.10) and mobile (AR=0.62)
        
        // Coefficients derived from solving system of equations
        const latA = 2.02e-6; // base latitude coefficient  
        const latB = 3.31e-6; // inverse aspect ratio effect
        const lonC = 6.11e-6; // base longitude coefficient
        const lonD = 1.19e-6; // direct aspect ratio effect
        
        // Calculate spans using dual-variable formula
        const latSpanDegrees = height * (latA + latB / screenAspectRatio);
        const lonSpanDegrees = height * (lonC + lonD * screenAspectRatio);
        
        // Convert degrees to meters (using approximate world average for conversion)
        const centerLat = 30; // approximate global latitude for conversion
        const latSpanMeters = latSpanDegrees * 111320; // degrees to meters
        const lonSpanMeters = lonSpanDegrees * 111320 * Math.cos(Cesium.Math.toRadians(centerLat)); // longitude correction
        
        const halfVertical = latSpanMeters / 2;
        const halfHorizontal = lonSpanMeters / 2;
        
        // Minimal logging for viewport calculation
        console.log(`📐 Camera height: ${height.toFixed(1)}m (AR: ${screenAspectRatio.toFixed(2)})`);
        
        return {
            halfVertical: halfVertical,
            halfHorizontal: halfHorizontal
        };
    }

    /**
     * Calculates required camera height to fit target distances with proper framing
     * @param {number} targetLatDistance - Target latitude distance in meters
     * @param {number} targetLonDistance - Target longitude distance in meters  
     * @param {number} screenAspectRatio - Screen width/height ratio
     * @returns {number} - Required height in meters
     */
    calculateRequiredHeightFromDistances(targetLatDistance, targetLonDistance, screenAspectRatio, bounds) {
        const verticalHalfFOV = Math.PI / 6; // 30°
        
        // COORDINATE SYSTEM FIX: Based on actual results, the mapping is:
        // - Vertical FOV controls LONGITUDE (east-west) dimension
        // - Horizontal FOV controls LATITUDE (north-south) dimension
        
        // Height needed for longitude dimension (vertical FOV)
        const heightForLon = (targetLonDistance / 2) / Math.tan(verticalHalfFOV);
        
        // Height needed for latitude dimension (horizontal FOV)
        const heightForLat = (targetLatDistance / 2) / (Math.tan(verticalHalfFOV) * screenAspectRatio);
        
        // Use the larger height to ensure both dimensions fit  
        const baseHeight = Math.max(heightForLat, heightForLon);
        
        // DIRECT CALCULATION: Use actual polygon bounds to calculate exact height for 40% buffer
        
        // Get the original polygon spans directly from the bounds parameter
        const centerLat = (bounds.north + bounds.south) / 2;
        const originalLatSpan = bounds.north - bounds.south; // degrees
        const originalLonSpan = bounds.east - bounds.west; // degrees
        
        // For 40% buffer, we need: actualSpan = originalSpan * 1.4
        const targetActualLatSpan = originalLatSpan * 1.4;
        const targetActualLonSpan = originalLonSpan * 1.4;
        
        // Convert target spans to distances in meters
        const targetLatDistanceFor40 = targetActualLatSpan * 111320;
        const targetLonDistanceFor40 = targetActualLonSpan * 111320 * Math.cos(Cesium.Math.toRadians(centerLat));
        
        // Calculate height needed using dual-variable aspect ratio function
        // latSpanMeters = height × (latA + latB / aspectRatio) × 111320
        // lonSpanMeters = height × (lonC + lonD × aspectRatio) × 111320 × cos(centerLat)
        const latA = 2.02e-6;
        const latB = 3.31e-6; 
        const lonC = 6.11e-6;
        const lonD = 1.19e-6;
        // centerLat already declared earlier in this function
        
        // Reverse the formulas to solve for height
        const latCoeff = (latA + latB / screenAspectRatio) * 111320;
        const lonCoeff = (lonC + lonD * screenAspectRatio) * 111320 * Math.cos(Cesium.Math.toRadians(centerLat));
        
        const heightForLat40 = targetLatDistanceFor40 / latCoeff;
        const heightForLon40 = targetLonDistanceFor40 / lonCoeff;
        
        // Use the larger height so the constraining dimension gets exactly 40% buffer
        const calculatedHeight = Math.max(heightForLat40, heightForLon40);
        
        console.log(`🎯 2D camera height calculated: ${calculatedHeight.toFixed(1)}m`);
        
        return calculatedHeight;
    }

    /**
     * Calculates required camera height to fit bounds with 20% buffer
     * Uses screen dimensions to ensure proper framing
     * @param {Object} bounds - Bounds object
     * @returns {number} - Required height in meters
     */
    calculateRequiredHeight(bounds) {
        const viewer = window.map3D.viewer;
        const canvas = viewer.scene.canvas;
        
        // Get screen dimensions
        const screenWidth = canvas.clientWidth;
        const screenHeight = canvas.clientHeight;
        const aspectRatio = screenWidth / screenHeight;
        
        // Calculate dimensions of bounding box in degrees
        const latSpan = bounds.north - bounds.south;
        const lonSpan = bounds.east - bounds.west;
        
        // Convert to distances in meters with proper longitude correction
        const centerLat = (bounds.north + bounds.south) / 2;
        const latDistance = latSpan * 111320; // degrees to meters
        const lonDistance = lonSpan * 111320 * Math.cos(Cesium.Math.toRadians(centerLat));
        
        // Add 40% buffer (20% on each side)
        const bufferedLatDistance = latDistance * 1.4;
        const bufferedLonDistance = lonDistance * 1.4;
        
        // NEW APPROACH: Calculate height directly from the debug rectangle spans
        // The debug rectangle already includes the 40% buffer, so we just need to fit those exact spans
        
        // Get the buffered bounds (what the red debug rectangle shows)
        const debugRectangleLatSpan = (bounds.north - bounds.south) * 1.4; // degrees
        const debugRectangleLonSpan = (bounds.east - bounds.west) * 1.4; // degrees
        
        // Convert debug rectangle spans to distances in meters
        const debugRectangleLatDistance = debugRectangleLatSpan * 111320; // degrees to meters
        const debugRectangleLonDistance = debugRectangleLonSpan * 111320 * Math.cos(Cesium.Math.toRadians(centerLat));
        
        // Calculate height needed to fit the debug rectangle exactly
        const requiredHeight = this.calculateRequiredHeightFromDistances(
            debugRectangleLatDistance, 
            debugRectangleLonDistance, 
            aspectRatio,
            bounds
        );
        
        
        // Ensure reasonable bounds
        return Math.max(100, Math.min(20000, requiredHeight));
    }


    /**
     * Captures a screenshot of the Cesium scene with terrain and Gaussian splats only
     * Temporarily hides UI elements and GeoJSON visualizations for clean background
     * @returns {Promise<string>} Promise that resolves with the image data URL
     */
    async capture2DBackgroundScreenshot() {
        if (!window.map3D || !window.map3D.viewer) {
            console.warn('Cesium viewer not available for screenshot');
            return null;
        }

        // Prevent multiple simultaneous screenshot captures
        if (this.screenshotInProgress) {
            console.log('Screenshot already in progress, skipping...');
            return null;
        }

        this.screenshotInProgress = true;
        const viewer = window.map3D.viewer;
        console.log('📸 Capturing 2D background screenshot...');

        try {
            // Step 1: Hide UI elements
            const uiElements = this.hideUIElements();

            // Step 2: Hide GeoJSON polygons and points (save current entities)
            const savedEntities = this.hideGeoJsonEntities(viewer);
            
            // Step 3: Set up screenshot capture AFTER hiding entities
            const canvas = viewer.scene.canvas;
            const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
            
            if (!gl) {
                throw new Error('WebGL context not available');
            }

            // Get current WebGL context attributes for debugging
            const contextAttributes = gl.getContextAttributes();
            console.log('Current preserveDrawingBuffer:', contextAttributes.preserveDrawingBuffer);
            console.log('Canvas dimensions:', canvas.width, 'x', canvas.height);
            
            // Create a promise that resolves when screenshot is actually captured
            const screenshotPromise = new Promise((resolve, reject) => {
                let imageDataURL = null;
                let captureCompleted = false; // Flag to ensure callback only runs once
                
                // Add timeout as fallback in case postRender doesn't fire
                const timeoutId = setTimeout(() => {
                    if (!captureCompleted) {
                        console.warn('⚠️ Screenshot capture timed out - postRender callback may not have fired');
                        reject(new Error('Screenshot capture timeout'));
                    }
                }, 2000); // 2 second timeout
                
                const captureCallback = () => {
                    if (captureCompleted) return; // Prevent multiple executions
                    captureCompleted = true;
                    clearTimeout(timeoutId); // Clear the timeout
                    console.log('📸 Render complete, capturing screenshot...');
                
                // Try both methods and log results
                
                // Method 1: Standard toDataURL
                const standardCapture = canvas.toDataURL('image/png');
                console.log('Standard toDataURL result length:', standardCapture.length);
                
                // Method 2: WebGL readPixels
                const width = canvas.width;
                const height = canvas.height;
                const pixels = new Uint8Array(width * height * 4);
                
                try {
                    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
                    
                    // Log pixel buffer info for debugging
                    console.log('ReadPixels first 20 values:', Array.from(pixels.slice(0, 20)));
                    
                    // Check if image has any non-black pixels
                    let hasNonBlackPixels = false;
                    let nonBlackCount = 0;
                    for (let i = 0; i < pixels.length; i += 4) {
                        if (pixels[i] > 0 || pixels[i + 1] > 0 || pixels[i + 2] > 0) {
                            hasNonBlackPixels = true;
                            nonBlackCount++;
                        }
                    }
                    console.log('Has non-black pixels:', hasNonBlackPixels);
                    console.log('Non-black pixel count:', nonBlackCount, 'out of', width * height);
                    
                    // Create image from pixels if we have data
                    if (hasNonBlackPixels) {
                        const tempCanvas = document.createElement('canvas');
                        tempCanvas.width = width;
                        tempCanvas.height = height;
                        const tempCtx = tempCanvas.getContext('2d');
                        
                        const imageData = tempCtx.createImageData(width, height);
                        
                        // Flip vertically (WebGL is upside down)
                        for (let y = 0; y < height; y++) {
                            for (let x = 0; x < width; x++) {
                                const srcIndex = ((height - y - 1) * width + x) * 4;
                                const dstIndex = (y * width + x) * 4;
                                
                                imageData.data[dstIndex] = pixels[srcIndex];
                                imageData.data[dstIndex + 1] = pixels[srcIndex + 1];
                                imageData.data[dstIndex + 2] = pixels[srcIndex + 2];
                                imageData.data[dstIndex + 3] = pixels[srcIndex + 3];
                            }
                        }
                        
                        tempCtx.putImageData(imageData, 0, 0);
                        imageDataURL = tempCanvas.toDataURL('image/png');
                        console.log('WebGL readPixels result length:', imageDataURL.length);
                    } else {
                        console.warn('⚠️ All pixels are black - WebGL buffer may be cleared');
                    }
                    
                } catch (readPixelsError) {
                    console.error('ReadPixels failed:', readPixelsError);
                }
                
                // Use whichever method gave us a longer result (more data)
                if (standardCapture.length > imageDataURL?.length || !imageDataURL) {
                    imageDataURL = standardCapture;
                    console.log('Using standard toDataURL result');
                } else {
                    console.log('Using WebGL readPixels result');
                }
                
                    // Store the image data (this happens inside the callback now)
                    this.background2DImage = imageDataURL;
                    
                    console.log('✅ 2D background screenshot captured');
                    
                    // Calculate and store screenshot bounds for coordinate mapping
                    this.calculateScreenshotBounds();
                    
                    // Resolve the promise with the captured image data
                    resolve(imageDataURL);
                };
                
                // Set up callback for the NEXT render (after entities are removed)
                console.log('🎯 Setting up postRender callback for clean screenshot...');
                viewer.scene.postRender.addEventListener(captureCallback, { once: true });
                
                // NOW render with removed entities
                console.log('🔄 Rendering scene with removed entities...');
                viewer.render();
            });
            
            // Wait for the actual screenshot to complete
            console.log('⏳ Waiting for screenshot capture to complete...');
            let capturedImageData = null;
            try {
                capturedImageData = await screenshotPromise;
            } catch (timeoutError) {
                console.warn('⚠️ Screenshot capture failed, continuing without background image:', timeoutError.message);
                // Continue with null image data - Fabric will use placeholder
            }
            
            // Step 7: Restore UI elements and GeoJSON visualizations
            this.restoreUIElements(uiElements);
            this.restoreGeoJsonEntities(viewer, savedEntities);

            // Return the captured image data
            console.log('📤 Screenshot method returning:', capturedImageData ? 'Image data available' : 'No image data');
            return capturedImageData;

        } catch (error) {
            console.error('❌ Error capturing 2D background screenshot:', error);
            return null;
        } finally {
            this.screenshotInProgress = false;
        }
    }

    /**
     * Temporarily hides UI elements for clean screenshot
     * @returns {Array} - Array of elements with their original display styles
     */
    hideUIElements() {
        const elementsToHide = [
            '.layer-controls',
            '.focus-panel',
            '.connection-line',
            '#viewSwitchButton',
            '.reusable-button'
        ];

        const hiddenElements = [];

        elementsToHide.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                hiddenElements.push({
                    element: element,
                    originalDisplay: element.style.display
                });
                element.style.display = 'none';
            });
        });

        return hiddenElements;
    }

    /**
     * Restores UI elements after screenshot
     * @param {Array} hiddenElements - Array of elements to restore
     */
    restoreUIElements(hiddenElements) {
        hiddenElements.forEach(({ element, originalDisplay }) => {
            element.style.display = originalDisplay;
        });
    }

    /**
     * Temporarily hides GeoJSON entities for clean screenshot
     * Uses visibility toggling instead of removal for better performance
     * @param {Object} viewer - Cesium viewer
     * @returns {Array} - Array of hidden entities for restoration
     */
    hideGeoJsonEntities(viewer) {
        const savedEntities = [];
        
        console.log('🙈 Hiding entities for screenshot. Total entities:', viewer.entities.values.length);
        
        // Use COMPREHENSIVE logic to catch ALL entity types created by visualizeGeoJsonPolygons
        viewer.entities.values.forEach(entity => {
            const shouldHide = (
                // Original detection logic
                (entity.name && (
                    entity.name.startsWith('Site_') || 
                    entity.name.includes('PA') || 
                    entity.name.includes('NPA')
                )) ||
                // Geometry-based detection
                entity.polygon ||
                entity.point ||
                entity.cylinder ||
                entity.polyline ||
                // NEW: Outline entities (missed before!)
                (entity.name && entity.name.includes('_Outline'))
            );
            
            if (shouldHide) {
                savedEntities.push({
                    entity: entity,
                    wasVisible: entity.show !== false
                });
                entity.show = false; // Hide instead of removing
                
                const entityType = entity.polygon ? '(polygon)' : 
                                 entity.point ? '(point)' : 
                                 entity.cylinder ? '(cylinder)' :
                                 entity.polyline ? '(polyline)' : 
                                 '(other)';
                console.log('Hidden entity:', entity.name, entityType);
            }
        });

        console.log('Hidden', savedEntities.length, 'entities');
        
        // Verify hiding by checking how many are now invisible
        const hiddenCount = viewer.entities.values.filter(e => e.show === false).length;
        console.log('🔍 Total hidden entities:', hiddenCount);
        
        return savedEntities; // Return saved state for restoration
    }

    /**
     * Restores GeoJSON entities after screenshot by restoring visibility
     * @param {Object} viewer - Cesium viewer
     * @param {Array} savedEntities - Array of entities with saved visibility state
     */
    restoreGeoJsonEntities(viewer, savedEntities) {
        console.log('👁️ Restoring', savedEntities.length, 'entities after screenshot');
        
        savedEntities.forEach(({ entity, wasVisible }) => {
            if (wasVisible && !entity.isDestroyed) {
                entity.show = true;
            }
        });
        
        // Verify restoration
        const visibleCount = viewer.entities.values.filter(e => e.show !== false).length;
        console.log('✅ Entities restored, total visible:', visibleCount);
    }

    /**
     * Calculates and stores the geographic bounds of the current screenshot
     * Uses Cesium's computeViewRectangle to get exact lat/lon coordinates
     */
    calculateScreenshotBounds() {
        if (!window.map3D || !window.map3D.viewer) {
            console.warn('Cannot calculate screenshot bounds - no Cesium viewer available');
            return;
        }

        const viewer = window.map3D.viewer;
        const camera = viewer.camera;

        // Get current view rectangle using Cesium's computeViewRectangle
        const viewRectangle = camera.computeViewRectangle();

        if (viewRectangle) {
            this.screenshotBounds = {
                west: Cesium.Math.toDegrees(viewRectangle.west),
                east: Cesium.Math.toDegrees(viewRectangle.east),
                south: Cesium.Math.toDegrees(viewRectangle.south),
                north: Cesium.Math.toDegrees(viewRectangle.north)
            };

            console.log('📐 Screenshot bounds calculated:', this.screenshotBounds);
            console.log(`   Width: ${(this.screenshotBounds.east - this.screenshotBounds.west).toFixed(6)}°`);
            console.log(`   Height: ${(this.screenshotBounds.north - this.screenshotBounds.south).toFixed(6)}°`);
        } else {
            console.warn('⚠️ Could not compute view rectangle for screenshot bounds');
            this.screenshotBounds = null;
        }
    }

    /**
     * Changes logo back to white version when returning to 3D mode
     */
    restoreLogoFor3DMode() {
        const logo = document.querySelector('#logo, #ecodashLogo, .ecodash-logo, [src*="logo"], [src*="ecodash"]');
        if (logo) {
            const currentSrc = logo.src;
            // Change to white logo version if it's currently blue
            if (currentSrc.includes('ecodash.webp') || !currentSrc.includes('white')) {
                const whiteLogoSrc = '/images/ecodash_white_cropped.webp';
                
                console.log('🎨 Changing logo back to white version for 3D mode...');
                logo.style.transition = 'opacity 0.3s ease-in-out';
                logo.style.opacity = '0';
                
                setTimeout(() => {
                    logo.src = whiteLogoSrc;
                    logo.style.opacity = '1';
                    console.log('✅ Logo changed to white version');
                }, 150); // Half of transition time
            }
        } else {
            console.warn('⚠️ Logo element not found for 3D mode restoration');
        }
    }

    /**
     * Updates the button text and state based on current mode
     */
    updateButtonState() {
        if (this.viewSwitchButton) {
            this.viewSwitchButton.textContent = this.is2DMode ? '3D' : '2D';
            this.viewSwitchButton.title = this.is2DMode ? 
                'Switch to 3D perspective view' : 
                'Switch to 2D top-down view';
        }
        
        // Update SuperSplat button visibility through its manager
        if (window.superSplatManager) {
            window.superSplatManager.updateSuperSplatAvailability();
        }
    }
}

// Initialize the 2D view manager when the page loads
window.view2DManager = new View2DManager();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.view2DManager.initialize();
});