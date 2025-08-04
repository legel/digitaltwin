/**
 * Fabric.js 2D Mode Integration
 * Manages 2D polygon rendering and interaction using Fabric.js canvas
 * Integrates with existing 3D visualization system and UI controls
 */

class Fabric2DManager {
    constructor() {
        this.canvas = null;
        this.fabricCanvas = null;
        this.isActive = false;
    }

    /**
     * Initializes the 2D Fabric.js canvas system (lightweight initialization)
     */
    initialize() {
        // DO NOT create canvas during initialization
        // Canvas will be created only when switching to 2D mode
        console.log('Fabric2DManager initialized (canvas will be created on demand)');
    }

    /**
     * Creates the HTML canvas element for 2D mode
     */
    createCanvasElement() {
        // Check if canvas already exists
        if (document.getElementById('fabric2DCanvas')) {
            return;
        }

        const canvas = document.createElement('canvas');
        canvas.id = 'fabric2DCanvas';
        canvas.style.position = 'fixed'; // Use fixed instead of absolute
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100vw'; // Use viewport units
        canvas.style.height = '100vh'; // Use viewport units
        canvas.style.zIndex = '500'; // Above Cesium but below UI controls (UI controls are 1000+)
        canvas.style.display = 'none'; // Hidden by default
        canvas.style.pointerEvents = 'auto';
        canvas.style.margin = '0'; // Ensure no margins
        canvas.style.padding = '0'; // Ensure no padding
        canvas.style.overflow = 'hidden'; // Prevent any overflow issues

        // Insert into body directly to avoid affecting cesiumContainer layout
        document.body.appendChild(canvas);

        this.canvas = canvas;
    }

    /**
     * Initializes the Fabric.js canvas (called on demand)
     */
    initializeFabricCanvas() {
        if (!this.canvas || this.fabricCanvas) return;

        // Initialize Fabric.js canvas
        this.fabricCanvas = new fabric.Canvas('fabric2DCanvas', {
            selection: false, // Disable group selection
            preserveObjectStacking: true,
            renderOnAddRemove: false, // Manual rendering control
            skipTargetFind: false, // Enable object interaction
            enableRetinaScaling: false, // Prevent scaling issues
            allowTouchScrolling: false // Prevent scrolling conflicts
        });

        // Set up event handlers
        this.setupEventHandlers();

        console.log('✅ Fabric.js canvas created on demand');
    }

    /**
     * Sets up event handlers for canvas interaction (placeholder for future use)
     */
    setupEventHandlers() {
        if (!this.fabricCanvas) return;
        
        // Event handlers will be added here when polygon interaction is implemented
        console.log('✅ Event handlers initialized');
    }


    /**
     * Activates 2D mode by hiding Cesium and showing Fabric canvas
     */
    activate() {
        if (this.isActive) return;

        console.log('🔄 Transitioning to 2D Fabric canvas mode...');

        // STEP 1: Create canvas and Fabric.js instance if not exists
        if (!this.canvas || !this.fabricCanvas) {
            this.createCanvasElement();
            this.initializeFabricCanvas();
        }

        // STEP 2: Get dimensions BEFORE hiding Cesium
        this.updateCanvasDimensions();

        // STEP 3: Hide Cesium container
        const cesiumContainer = document.getElementById('cesiumContainer');
        if (cesiumContainer) {
            cesiumContainer.style.display = 'none';
            console.log('✅ Cesium container hidden');
        }

        // STEP 4: Show the Fabric canvas
        if (this.canvas) {
            this.canvas.style.display = 'block';
            console.log('✅ Fabric canvas shown');
        }

        // STEP 5: Clear any existing content
        this.fabricCanvas.clear();

        // STEP 6: Set background image from screenshot if available
        this.setBackgroundImage();

        // STEP 7: Test coordinate mapping with first GeoJSON point
        this.testCoordinateMapping();

        this.isActive = true;
        console.log('🎯 2D Fabric canvas mode activated successfully!');
    }

    /**
     * Deactivates 2D mode by showing Cesium and completely removing Fabric canvas
     */
    deactivate() {
        if (!this.isActive) return;

        console.log('🔄 Transitioning back to 3D Cesium mode...');

        // STEP 1: Clean up Fabric.js instance FIRST (before DOM removal)
        if (this.fabricCanvas) {
            try {
                this.fabricCanvas.dispose();
                console.log('✅ Fabric.js instance disposed');
            } catch (fabricError) {
                console.warn('⚠️ Error disposing Fabric.js instance:', fabricError);
            }
            this.fabricCanvas = null;
        }

        // STEP 2: Now safely remove canvas from DOM
        if (this.canvas) {
            try {
                if (this.canvas.parentNode) {
                    this.canvas.parentNode.removeChild(this.canvas);
                    console.log('✅ Fabric canvas removed from DOM');
                } else {
                    console.log('⚠️ Canvas has no parent node - may already be removed');
                }
            } catch (error) {
                console.warn('⚠️ Error removing canvas from DOM:', error);
                // Try alternative removal method
                if (document.getElementById('fabric2DCanvas')) {
                    try {
                        document.getElementById('fabric2DCanvas').remove();
                        console.log('✅ Canvas removed using alternative method');
                    } catch (altError) {
                        console.warn('⚠️ Alternative removal also failed:', altError);
                    }
                }
            }
        }

        // STEP 3: Reset canvas reference
        this.canvas = null;

        // STEP 4: Show Cesium container
        const cesiumContainer = document.getElementById('cesiumContainer');
        if (cesiumContainer) {
            cesiumContainer.style.display = 'block';
            console.log('✅ Cesium container shown');
        }

        this.isActive = false;
        console.log('🎯 3D Cesium mode restored - Fabric completely removed!');
    }

    /**
     * Updates canvas dimensions to match current viewport
     */
    updateCanvasDimensions() {
        if (!this.canvas || !this.fabricCanvas) return;

        // Get dimensions from window size instead of hidden Cesium canvas
        let width = window.innerWidth;
        let height = window.innerHeight;

        // Try to get from Cesium canvas if available and valid
        const viewer = window.map3D?.viewer;
        if (viewer && viewer.scene.canvas) {
            const cesiumWidth = viewer.scene.canvas.width || viewer.scene.canvas.clientWidth;
            const cesiumHeight = viewer.scene.canvas.height || viewer.scene.canvas.clientHeight;
            
            if (cesiumWidth > 0 && cesiumHeight > 0) {
                width = cesiumWidth;
                height = cesiumHeight;
            }
        }

        // Ensure we have valid dimensions
        const finalWidth = width > 0 ? width : 1920; // Fallback
        const finalHeight = height > 0 ? height : 1080; // Fallback

        // Update HTML canvas size
        this.canvas.width = finalWidth;
        this.canvas.height = finalHeight;
        this.canvas.style.width = finalWidth + 'px';
        this.canvas.style.height = finalHeight + 'px';

        // Update Fabric canvas dimensions
        this.fabricCanvas.setDimensions({
            width: finalWidth,
            height: finalHeight
        });

        console.log(`2D canvas dimensions updated: ${finalWidth}x${finalHeight}`);
    }

    /**
     * Sets the background image from the screenshot capture system
     */
    setBackgroundImage() {
        if (!this.fabricCanvas) return;

        const backgroundImage = window.view2DManager?.background2DImage;
        console.log('🔍 Checking for background image:', backgroundImage ? 'Found' : 'Not found');
        
        if (backgroundImage && backgroundImage.length > 100) { // Basic validation
            console.log('📸 Setting background image from screenshot...');
            this.fabricCanvas.setBackgroundImage(backgroundImage, 
                this.fabricCanvas.renderAll.bind(this.fabricCanvas), {
                    scaleX: 1,
                    scaleY: 1,
                    originX: 'left',
                    originY: 'top'
                });
            console.log('✅ 2D background image set from screenshot');
        } else {
            console.warn('⚠️ No valid background image available - using placeholder color');
            console.warn('   Background image data:', backgroundImage ? `${backgroundImage.length} chars` : 'null/undefined');
            // Set a placeholder background color
            this.fabricCanvas.backgroundColor = '#072b2e'; // Terrain 3D dark teal
            this.fabricCanvas.renderAll();
        }
    }



    /**
     * Converts geographic coordinates (lat/lon) to screen pixel coordinates
     * @param {number} longitude - Longitude in degrees
     * @param {number} latitude - Latitude in degrees
     * @returns {Object|null} - {x, y} screen coordinates or null if outside bounds
     */
    latLonToScreenPixel(longitude, latitude) {
        const bounds = window.view2DManager?.screenshotBounds;
        if (!bounds || !this.fabricCanvas) {
            console.warn('Cannot convert coordinates - no screenshot bounds available');
            return null;
        }

        // Check if point is within screenshot bounds
        if (longitude < bounds.west || longitude > bounds.east ||
            latitude < bounds.south || latitude > bounds.north) {
            console.warn(`Point (${longitude}, ${latitude}) is outside screenshot bounds:`, bounds);
            return null;
        }

        // Convert to normalized coordinates (0-1)
        const normalizedX = (longitude - bounds.west) / (bounds.east - bounds.west);
        const normalizedY = (bounds.north - latitude) / (bounds.north - bounds.south); // Flip Y for screen coordinates

        // Convert to screen pixels
        const screenX = normalizedX * this.fabricCanvas.width;
        const screenY = normalizedY * this.fabricCanvas.height;

        return { x: screenX, y: screenY };
    }

    /**
     * Tests the coordinate mapping by placing a dot at the first GeoJSON point
     */
    testCoordinateMapping() {
        if (!this.fabricCanvas) return;

        console.log('🧪 Testing coordinate mapping with first GeoJSON point...');

        // Get the first point from the current site data
        const firstPoint = this.getFirstGeoJsonPoint();
        if (!firstPoint) {
            console.warn('No GeoJSON point found for testing');
            return;
        }

        console.log('📍 First GeoJSON point:', firstPoint);

        // Convert to screen coordinates
        const screenPos = this.latLonToScreenPixel(firstPoint.longitude, firstPoint.latitude);
        if (!screenPos) {
            console.warn('❌ Point is outside screenshot bounds or conversion failed');
            return;
        }

        console.log('🎯 Screen position:', screenPos);
        console.log(`   Within bounds: ${screenPos.x >= 0 && screenPos.x <= this.fabricCanvas.width && screenPos.y >= 0 && screenPos.y <= this.fabricCanvas.height}`);

        // Draw a test dot at this position
        const testDot = new fabric.Circle({
            left: screenPos.x,
            top: screenPos.y,
            radius: 8,
            fill: '#ff0000', // Red dot
            stroke: '#ffffff',
            strokeWidth: 2,
            originX: 'center',
            originY: 'center',
            selectable: false
        });

        this.fabricCanvas.add(testDot);
        this.fabricCanvas.renderAll();

        console.log('✅ Test dot placed on canvas at screen position');
    }

    /**
     * Gets the first coordinate point from the current GeoJSON data
     * @returns {Object|null} - {longitude, latitude} or null if not found
     */
    getFirstGeoJsonPoint() {
        if (!window.currentSiteData || !window.currentSiteData.features) {
            return null;
        }

        // Find the first feature with coordinates
        for (const feature of window.currentSiteData.features) {
            if (feature.geometry && feature.geometry.coordinates) {
                let coords = null;

                if (feature.geometry.type === 'Polygon') {
                    // Get first coordinate of outer ring
                    coords = feature.geometry.coordinates[0][0];
                } else if (feature.geometry.type === 'MultiPolygon') {
                    // Get first coordinate of first polygon's outer ring
                    coords = feature.geometry.coordinates[0][0][0];
                } else if (feature.geometry.type === 'Point') {
                    // Direct point coordinates
                    coords = feature.geometry.coordinates;
                }

                if (coords && coords.length >= 2) {
                    return {
                        longitude: coords[0],
                        latitude: coords[1],
                        featureName: feature.properties?.name || 'Unknown'
                    };
                }
            }
        }

        return null;
    }

}

// Initialize the Fabric 2D manager and make it globally available
window.fabric2DManager = new Fabric2DManager();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Wait for Fabric.js to be fully loaded
    if (typeof fabric !== 'undefined') {
        window.fabric2DManager.initialize();
    } else {
        console.error('Fabric.js not loaded - 2D mode will not work');
    }
});