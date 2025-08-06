/**
 * Advanced 2D Transition Animation System
 * Handles sophisticated visual transitions from 3D Cesium to 2D Fabric canvas
 * Features: vertex circles, white overlay fade, logo transitions, screenshot timing
 */

class TransitionAnimationManager {
    constructor() {
        this.animationCanvas = null;
        this.animationContext = null;
        this.whiteOverlay = null;
        this.screenshotPromise = null;
        this.isAnimating = false;
    }

    /**
     * Initialize the transition animation system
     */
    initialize() {
        console.log('TransitionAnimationManager initialized');
    }

    /**
     * Creates an overlay canvas for vertex circle animation
     */
    createAnimationCanvas() {
        // Check if canvas already exists
        if (document.getElementById('transitionAnimationCanvas')) {
            return;
        }

        const canvas = document.createElement('canvas');
        canvas.id = 'transitionAnimationCanvas';
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100vw';
        canvas.style.height = '100vh';
        canvas.style.zIndex = '1001'; // Above Cesium (999) and Fabric (999)
        canvas.style.pointerEvents = 'none'; // Don't interfere with interactions
        canvas.style.opacity = '0'; // Start hidden
        
        // Set canvas to viewport size
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        document.body.appendChild(canvas);
        
        this.animationCanvas = canvas;
        this.animationContext = canvas.getContext('2d');
        
        console.log('🎨 Animation canvas created');
    }

    /**
     * Creates white overlay for Cesium fade effect
     */
    createWhiteOverlay() {
        // Check if overlay already exists
        if (document.getElementById('cesiumWhiteOverlay')) {
            return;
        }

        const overlay = document.createElement('div');
        overlay.id = 'cesiumWhiteOverlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        overlay.style.zIndex = '1000'; // Above Cesium container (no z-index)
        overlay.style.pointerEvents = 'none'; // Don't interfere with interactions
        overlay.style.opacity = '0'; // Start hidden
        overlay.style.transition = 'opacity 0.5s ease-in-out';
        
        document.body.appendChild(overlay);
        
        this.whiteOverlay = overlay;
        
        console.log('🎨 White overlay created');
    }

    /**
     * Draws vertex circles at all GeoJSON polygon coordinates
     */
    drawVertexCircles() {
        if (!this.animationContext) return;
        if (!window.currentSiteData || !window.currentSiteData.features) {
            console.warn('Cannot draw vertex circles - no GeoJSON data available');
            return;
        }

        const ctx = this.animationContext;
        
        // Clear canvas
        ctx.clearRect(0, 0, this.animationCanvas.width, this.animationCanvas.height);
        
        // Get current Cesium camera for coordinate conversion
        if (!window.map3D || !window.map3D.viewer) {
            console.warn('Cannot draw vertex circles - no Cesium viewer available');
            return;
        }

        const viewer = window.map3D.viewer;
        const camera = viewer.camera;
        
        // Calculate screen bounds using Cesium's perspective projection
        const viewRectangle = camera.computeViewRectangle();
        if (!viewRectangle) {
            console.warn('Cannot calculate view rectangle for vertex circles');
            return;
        }

        const bounds = {
            west: Cesium.Math.toDegrees(viewRectangle.west),
            east: Cesium.Math.toDegrees(viewRectangle.east),
            south: Cesium.Math.toDegrees(viewRectangle.south),
            north: Cesium.Math.toDegrees(viewRectangle.north)
        };

        console.log('🔵 Drawing vertex circles with perspective bounds:', bounds);

        // Detect coordinate format (same logic as Cesium/Fabric)
        const geoJsonData = window.currentSiteData;
        const format = geoJsonData.features.length > 0 ? window.detectGeoJsonFormat(geoJsonData.features[0]) : 'legacy';
        let isGeographic = false;
        
        if (geoJsonData.features.length > 0) {
            const firstCoord = geoJsonData.features[0].geometry.coordinates[0][0];
            isGeographic = window.detectCoordinateFormat(firstCoord) === 'geographic';
        }

        let totalVertices = 0;
        let drawnCircles = 0;

        // Set circle style
        ctx.fillStyle = '#072b2e'; // Ecodash blue
        
        // Loop through all GeoJSON features (same logic as utilities.js)
        geoJsonData.features.forEach((feature, featureIndex) => {
            if (feature.geometry.type === 'Polygon') {
                
                // Loop through all vertices in the polygon (same logic as utilities.js and fabric2D.js)
                for (let i = 0; i < feature.geometry.coordinates[0].length; i++) {
                    const coord = feature.geometry.coordinates[0][i];
                    const [x, y, z] = coord;
                    totalVertices++;
                    
                    let latLng;
                    if (isGeographic) {
                        // Already in geographic coordinates [lng, lat]
                        latLng = { lat: y, lng: x };
                    } else {
                        // UTM coordinates - need conversion
                        latLng = window.utmToLatLng(x, y);
                    }
                    
                    // Convert lat/lng to screen pixel using same logic as fabric2D.js
                    const screenPos = this.latLonToScreenPixel(latLng.lng, latLng.lat, bounds);
                    if (screenPos) {
                        // Draw 5px radius circle at this vertex position
                        ctx.beginPath();
                        ctx.arc(screenPos.x, screenPos.y, 5, 0, 2 * Math.PI);
                        ctx.fill();
                        drawnCircles++;
                    }
                }
            }
        });
        
        console.log(`🔵 Vertex circles drawn: ${drawnCircles}/${totalVertices} vertices`);
    }

    /**
     * Converts lat/lng to screen pixels (same logic as fabric2D.js)
     */
    latLonToScreenPixel(longitude, latitude, bounds) {
        // Check if point is within bounds
        if (longitude < bounds.west || longitude > bounds.east ||
            latitude < bounds.south || latitude > bounds.north) {
            return null;
        }

        // Convert to normalized coordinates (0-1)
        const normalizedX = (longitude - bounds.west) / (bounds.east - bounds.west);
        const normalizedY = (bounds.north - latitude) / (bounds.north - bounds.south); // Flip Y for screen coordinates

        // Convert to screen pixels
        const screenX = normalizedX * window.innerWidth;
        const screenY = normalizedY * window.innerHeight;

        return { x: screenX, y: screenY };
    }

    /**
     * Animates logo from white to blue version
     */
    animateLogoTransition() {
        const logo = document.querySelector('#logo, #ecodashLogo, .ecodash-logo, [src*="logo"], [src*="ecodash"]');
        if (logo) {
            // Change logo source to blue version with 1.5s gradual transition
            const currentSrc = logo.src;
            if (currentSrc.includes('white') || !currentSrc.includes('ecodash.webp')) {
                // Use local blue logo file if available, fallback to remote
                const blueLogoSrc = '/images/ecodash.webp';
                
                console.log('🎨 Starting 1.5s logo transition from white to blue...');
                logo.style.transition = 'opacity 0.75s ease-in-out';
                logo.style.opacity = '0';
                
                setTimeout(() => {
                    logo.src = blueLogoSrc;
                    logo.style.opacity = '1';
                    console.log('🎨 Logo source changed to blue, fading back in...');
                }, 750); // Middle of 1.5s transition
            }
        } else {
            console.warn('⚠️ Logo element not found for transition');
        }
    }

    /**
     * Ensures logo stays visible in Fabric mode with proper z-index
     */
    ensureLogoVisibility() {
        const logo = document.querySelector('#logo, #ecodashLogo, .ecodash-logo, [src*="logo"], [src*="ecodash"]');
        if (logo) {
            // Ensure logo has high z-index and is visible (keep original absolute positioning)
            logo.style.zIndex = '1003'; // Above all canvases
            // Don't change position - keep original absolute positioning from CSS
            logo.style.pointerEvents = 'auto';
            
            // Make sure logo is blue version (use local file)
            if (logo.src.includes('white') || !logo.src.includes('ecodash.webp')) {
                logo.src = '/images/ecodash.webp';
            }
            
            console.log('🎨 Logo visibility ensured for Fabric mode');
        }
    }

    /**
     * Starts the complete transition animation sequence
     */
    async startTransition() {
        if (this.isAnimating) {
            console.warn('⚠️ Transition animation already in progress');
            return;
        }
        
        this.isAnimating = true;
        console.log('🎬 Starting sophisticated 2D transition animation...');
        
        // Create animation elements
        this.createAnimationCanvas();
        this.createWhiteOverlay();
        
        // Phase 1: Vertex circles fade in (0-1.0s)
        console.log('🎬 Phase 1: Vertex circles fade in...');
        this.drawVertexCircles();
        this.animationCanvas.style.transition = 'opacity 1.0s ease-in-out';
        this.animationCanvas.style.opacity = '1';
        
        // Wait 1 second
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Phase 2: White overlay fade in + logo transition (1.0-2.5s total, 1.5s duration)
        console.log('🎬 Phase 2: White overlay fade in + logo transition...');
        this.whiteOverlay.style.opacity = '1';
        
        // Start logo transition immediately as overlay fades in
        this.animateLogoTransition();
        
        // Wait 0.5 seconds for overlay to complete
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Phase 3: Screenshot capture at 1.5s (while logo is still transitioning)
        console.log('🎬 Phase 3: Screenshot capture...');
        this.screenshotPromise = this.captureScreenshot();
        
        // Continue waiting for logo transition to complete (additional 1.0s)
        console.log('🎬 Phase 3.5: Completing logo transition...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Phase 4: Coordinate transformation (2.5-3.0s)
        console.log('🎬 Phase 4: Coordinate transformation...');
        
        // Simple placeholder animation - move circle slightly
        this.animateCircleTransformation();
        
        // Wait for remaining animation time (0.5s to reach 3.0s total)
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Phase 5: Wait for screenshot completion
        console.log('🎬 Phase 5: Waiting for screenshot completion...');
        try {
            await this.screenshotPromise;
            console.log('🎬 Screenshot ready, starting Fabric activation...');
            
            // Activate Fabric canvas first (this includes viewport adjustments)
            this.activateFabricCanvas();
            
            // Phase 6: After Fabric is ready, fade out white overlay and vertex circles
            console.log('🎬 Phase 6: Fading out white overlay and vertex circles...');
            
            // Check if elements still exist before trying to fade them
            if (this.whiteOverlay) {
                this.whiteOverlay.style.opacity = '0';
            }
            if (this.animationCanvas) {
                this.animationCanvas.style.opacity = '0';
            }
            
            // Wait for fade out to complete
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            console.log('🎬 Fade out complete!');
            
            // Now clean up the animation elements
            this.cleanup();
        } catch (error) {
            console.error('❌ Screenshot failed, activating Fabric without background:', error);
            this.activateFabricCanvas();
            // Still clean up even if screenshot failed
            this.cleanup();
        }
    }

    /**
     * Animates vertex circles from perspective to orthographic coordinates (placeholder)
     * Currently just redraws the circles - future enhancement will animate coordinate transformation
     */
    animateCircleTransformation() {
        console.log('🎬 Animating vertex circle coordinate transformation...');
        
        // For now, just redraw the vertex circles
        // Future: animate from perspective coordinates to orthographic coordinates
        this.drawVertexCircles();
        
        console.log('🎬 Vertex coordinate transformation animation complete');
    }

    /**
     * Captures screenshot using existing system
     */
    async captureScreenshot() {
        if (window.view2DManager && window.view2DManager.capture2DBackgroundScreenshot) {
            return await window.view2DManager.capture2DBackgroundScreenshot();
        } else {
            throw new Error('Screenshot capture system not available');
        }
    }

    /**
     * Activates Fabric canvas (without cleanup - that happens separately)
     */
    activateFabricCanvas() {
        console.log('🎬 Activating Fabric canvas...');
        
        // Ensure logo visibility in Fabric mode
        this.ensureLogoVisibility();
        
        // Activate Fabric.js 2D canvas
        if (window.fabric2DManager) {
            window.fabric2DManager.activate();
        }
        
        // Note: Cleanup happens separately after fade out completes
    }

    /**
     * Cleans up animation elements
     */
    cleanup() {
        console.log('🎬 Cleaning up transition animation...');
        
        // Remove animation canvas
        if (this.animationCanvas) {
            this.animationCanvas.remove();
            this.animationCanvas = null;
            this.animationContext = null;
        }
        
        // Remove white overlay
        if (this.whiteOverlay) {
            this.whiteOverlay.remove();
            this.whiteOverlay = null;
        }
        
        this.isAnimating = false;
        console.log('✅ Transition animation cleanup complete');
    }

    /**
     * Cleanup method for returning to 3D mode
     */
    cleanupFor3D() {
        if (this.isAnimating) {
            this.cleanup();
        }
    }
}

// Initialize global instance
window.transitionAnimationManager = new TransitionAnimationManager();