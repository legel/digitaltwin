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
        
        // State tracking for hover and click interactions
        this.currentHoveredObject = null;
        this.currentClickedObject = null;
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
        canvas.style.zIndex = '999'; // Higher z-index to ensure it's on top
        canvas.style.display = 'none'; // Hidden by default
        canvas.style.pointerEvents = 'auto'; // Ensure pointer events are enabled
        canvas.style.margin = '0'; // Ensure no margins
        canvas.style.padding = '0'; // Ensure no padding
        canvas.style.overflow = 'hidden'; // Prevent any overflow issues
        canvas.style.backgroundColor = 'transparent'; // Ensure transparency
        canvas.style.cursor = 'default'; // Default cursor
        
        console.log('🔧 Canvas created with z-index:', canvas.style.zIndex);

        // Insert into body directly to avoid affecting cesiumContainer layout
        document.body.appendChild(canvas);

        this.canvas = canvas;
    }

    /**
     * Initializes the Fabric.js canvas (called on demand)
     */
    initializeFabricCanvas() {
        if (!this.canvas || this.fabricCanvas) return;

        // Set canvas to full viewport size for pan/zoom functionality
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        console.log(`📐 Preparing canvas for viewport: ${viewportWidth}x${viewportHeight}`);
        
        // Initialize Fabric.js canvas with performance optimizations
        this.fabricCanvas = new fabric.Canvas('fabric2DCanvas', {
            width: viewportWidth,
            height: viewportHeight,
            selection: false, // Disable selection box but keep object interaction
            preserveObjectStacking: true,
            renderOnAddRemove: false, // Critical: Prevent re-render on each object add/remove
            skipTargetFind: false, // Critical: Enable object interaction
            enableRetinaScaling: false, // Prevent scaling issues
            allowTouchScrolling: false, // Disable to prevent event conflicts
            targetFindTolerance: 15, // Higher tolerance for easier clicking
            interactive: true, // Ensure interactivity is enabled
            moveCursor: 'default', // Default cursor (will change during pan)
            hoverCursor: 'pointer', // Pointer on hover
            defaultCursor: 'default', // Default cursor
            fireRightClick: true, // Enable right-click events
            fireMiddleClick: true, // Enable middle-click events
            stopContextMenu: false, // Allow context menu
            imageSmoothingEnabled: false, // Disable smoothing for crisp edges
            // Performance optimizations
            backgroundColor: '#000000', // Black background for blue logo visibility
            controlsAboveOverlay: false,
            centeredScaling: false,
            centeredRotation: false
        });
        
        // CRITICAL: Force canvas to exact viewport dimensions using Fabric's API
        this.fabricCanvas.setDimensions({
            width: viewportWidth,
            height: viewportHeight
        });
        
        // Also set the wrapper element size
        const canvasContainer = this.fabricCanvas.getElement().parentNode;
        if (canvasContainer) {
            canvasContainer.style.width = viewportWidth + 'px';
            canvasContainer.style.height = viewportHeight + 'px';
        }
        
        console.log(`📐 Canvas forced to viewport: ${viewportWidth}x${viewportHeight}`);
        
        // Handle window resize to keep canvas full-screen
        window.addEventListener('resize', () => {
            if (this.fabricCanvas) {
                const newWidth = window.innerWidth;
                const newHeight = window.innerHeight;
                
                // Use only Fabric's proper dimension setting method
                this.fabricCanvas.setDimensions({
                    width: newWidth,
                    height: newHeight
                });
                this.fabricCanvas.renderAll();
                console.log(`📐 Canvas resized to: ${newWidth}x${newHeight}`);
            }
        });

        // Force enable pointer events on both canvas elements that Fabric creates
        setTimeout(() => {
            const lowerCanvas = this.fabricCanvas.lowerCanvasEl;
            const upperCanvas = this.fabricCanvas.upperCanvasEl;
            
            if (lowerCanvas) {
                lowerCanvas.style.pointerEvents = 'auto';
                console.log('🔧 Lower canvas pointer events enabled');
            }
            if (upperCanvas) {
                upperCanvas.style.pointerEvents = 'auto';
                console.log('🔧 Upper canvas pointer events enabled');
            }
            
            // Force dimensions one more time after Fabric.js finishes initializing
            this.fabricCanvas.setDimensions({
                width: viewportWidth,
                height: viewportHeight
            });
            console.log(`🔧 Final dimension enforcement: ${viewportWidth}x${viewportHeight}`);
        }, 100);

        // Set up event handlers
        this.setupEventHandlers();

        console.log('✅ Fabric.js canvas created on demand');
    }

    /**
     * Sets up event handlers for canvas interaction
     */
    setupEventHandlers() {
        if (!this.fabricCanvas) return;
        
        console.log('🔧 Setting up Fabric.js event handlers...');
        
        // Note: currentHoveredObject and currentClickedObject are initialized in constructor
        
        // Modified polygon click detection that respects pan/zoom drag detection
        // We'll check if this was a drag or click in the existing mouseup handler
        // Remove the separate click listener to avoid conflicts
        
        this.canvas.addEventListener('mousemove', (e) => {
            // Log occasional mouse moves to verify native events work
            if (Math.random() < 0.01) {
                console.log('🖱️ Native canvas mousemove detected');
            }
            
            // Find object at current mouse position for hover effects
            const pointer = this.fabricCanvas.getPointer(e);
            const target = this.fabricCanvas.findTarget(e, false);
            
            // Handle hover state changes - but skip if target is currently clicked
            if (target && target.featureData && target !== this.currentHoveredObject && target !== this.currentClickedObject) {
                // Mouse entered a new polygon (that isn't clicked)
                console.log('🎯 Hovering over:', target.featureData.entityName);
                
                // Remove hover from previous object (only if it's not clicked)
                if (this.currentHoveredObject && 
                    this.currentHoveredObject !== this.currentClickedObject && 
                    this.currentHoveredObject.originalFill !== undefined &&
                    this.currentHoveredObject.originalStrokeWidth !== undefined) {
                    this.currentHoveredObject.set({
                        strokeWidth: this.currentHoveredObject.originalStrokeWidth,
                        fill: this.currentHoveredObject.originalFill
                    });
                }
                
                // Store original values if not already stored
                if (target.originalStrokeWidth === undefined) {
                    target.originalStrokeWidth = target.strokeWidth;
                    target.originalFill = target.fill;
                }
                
                // Apply hover styling (thinner than clicked state)
                target.set({
                    strokeWidth: target.originalStrokeWidth * 2, // 2x for hover, 3x for clicked
                    fill: 'rgba(0, 0, 0, 0.15)' // 0.15 opacity on hover
                });
                
                this.currentHoveredObject = target;
                this.fabricCanvas.renderAll();
                console.log('✅ Hover effect applied via native mousemove');
                
            } else if (target && target === this.currentClickedObject) {
                // Hovering over clicked polygon - don't change its styling but clear hover state
                if (this.currentHoveredObject && 
                    this.currentHoveredObject !== this.currentClickedObject && 
                    this.currentHoveredObject.originalFill !== undefined &&
                    this.currentHoveredObject.originalStrokeWidth !== undefined) {
                    // Clear hover from previous non-clicked polygon
                    this.currentHoveredObject.set({
                        strokeWidth: this.currentHoveredObject.originalStrokeWidth,
                        fill: this.currentHoveredObject.originalFill
                    });
                    this.fabricCanvas.renderAll();
                    console.log('✅ Cleared hover from non-clicked polygon');
                }
                this.currentHoveredObject = null;
                console.log('🎯 Hovering over clicked polygon - maintaining clicked styling');
                
            } else if (!target && this.currentHoveredObject && this.currentHoveredObject !== this.currentClickedObject) {
                // Mouse left all polygons - restore styling only if not clicked
                console.log('🎯 Mouse left polygon:', this.currentHoveredObject.featureData?.entityName);
                
                if (this.currentHoveredObject.originalFill !== undefined && 
                    this.currentHoveredObject.originalStrokeWidth !== undefined) {
                    this.currentHoveredObject.set({
                        strokeWidth: this.currentHoveredObject.originalStrokeWidth,
                        fill: this.currentHoveredObject.originalFill
                    });
                    this.fabricCanvas.renderAll();
                    console.log('✅ Hover effect removed via native mousemove');
                }
                
                this.currentHoveredObject = null;
            }
        });
        
        // Add pan and zoom functionality
        this.setupPanAndZoom();
        
        // Debug element stack (disabled for now due to errors)
        // this.debugElementStack();
        
        // Simplified Fabric.js event setup - avoid duplicates
        console.log('🔧 Binding Fabric.js mouse:down event');
        this.fabricCanvas.on('mouse:down', (options) => {
            console.log('🖱️ Fabric canvas mouse down event triggered');
            if (options.target) {
                console.log('🎯 Target found:', options.target.type, options.target.featureData?.entityName);
                if (options.target.featureData) {
                    const featureData = options.target.featureData;
                    console.log('🖱️ Polygon clicked:', featureData.entityName);
                    
                    // Trigger the same PA/NPA selection logic as Cesium
                    this.handlePolygonClick(featureData);
                } else {
                    console.log('⚠️ Target has no featureData');
                }
            } else {
                console.log('⚠️ No target found on click');
            }
        });

        // Handle hover effects with proper state management
        console.log('🔧 Binding Fabric.js mouse:over event');
        this.fabricCanvas.on('mouse:over', (options) => {
            console.log('🎯 Mouse over event triggered');
            if (options.target && options.target.featureData) {
                console.log('🎨 Applying hover effect to:', options.target.featureData.entityName);
                
                // Store original values if not already stored
                if (!options.target.originalStrokeWidth) {
                    options.target.originalStrokeWidth = options.target.strokeWidth;
                    options.target.originalFill = options.target.fill;
                }
                
                // Apply hover styling - bolder stroke and visible fill
                options.target.set({
                    strokeWidth: options.target.originalStrokeWidth * 2,
                    fill: 'rgba(0, 0, 0, 0.15)' // 0.15 opacity on hover
                });
                this.fabricCanvas.renderAll();
                console.log('✅ Hover effect applied');
            } else {
                console.log('⚠️ Mouse over with no target or featureData');
            }
        });

        console.log('🔧 Binding Fabric.js mouse:out event');
        this.fabricCanvas.on('mouse:out', (options) => {
            console.log('🎯 Mouse out event triggered');
            if (options.target && options.target.featureData && options.target.originalStrokeWidth) {
                console.log('🎨 Removing hover effect from:', options.target.featureData.entityName);
                
                // Reset to original styling
                options.target.set({
                    strokeWidth: options.target.originalStrokeWidth,
                    fill: options.target.originalFill
                });
                this.fabricCanvas.renderAll();
                console.log('✅ Hover effect removed');
            }
        });
        
        console.log('✅ Enhanced polygon event handlers initialized with debug logging');
        
        // Add a method to check if canvas is properly positioned and visible
        setTimeout(() => {
            this.debugCanvasVisibility();
        }, 1000);
    }

    /**
     * Debug method to check canvas visibility and positioning
     */
    debugCanvasVisibility() {
        if (!this.canvas) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(this.canvas);
        
        console.log('🔍 Canvas debug info:');
        console.log('  - Position:', computedStyle.position);
        console.log('  - Z-index:', computedStyle.zIndex);
        console.log('  - Display:', computedStyle.display);
        console.log('  - Pointer events:', computedStyle.pointerEvents);
        console.log('  - Dimensions:', rect.width, 'x', rect.height);
        console.log('  - Canvas element:', this.canvas);
        
        // Check what element is actually at the center of the screen
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const elementAtCenter = document.elementFromPoint(centerX, centerY);
        console.log('  - Element at screen center:', elementAtCenter);
        console.log('  - Is canvas at center?', elementAtCenter === this.canvas);
    }

    /**
     * Debug method to check for conflicting elements that might intercept mouse events
     */
    debugElementStack() {
        console.log('🔍 Checking element stack for conflicts...');
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        
        const allElementsAtCenter = [];
        let element = document.elementFromPoint(centerX, centerY);
        
        // Walk through all elements in the stack at center point
        while (element) {
            allElementsAtCenter.push({
                tagName: element.tagName,
                id: element.id,
                className: element.className,
                zIndex: window.getComputedStyle(element).zIndex,
                pointerEvents: window.getComputedStyle(element).pointerEvents
            });
            
            // Temporarily disable pointer events to see element behind
            const originalPointerEvents = element.style.pointerEvents;
            element.style.pointerEvents = 'none';
            element = document.elementFromPoint(centerX, centerY);
            
            // Store the element for later restoration
            if (allElementsAtCenter.length > 0) {
                const lastElementInfo = allElementsAtCenter[allElementsAtCenter.length - 1];
                lastElementInfo.originalPointerEvents = originalPointerEvents;
            }
        }
        
        // Restore all pointer events properly
        allElementsAtCenter.forEach((elementInfo, index) => {
            const actualElement = document.getElementById(elementInfo.id) || 
                                 (elementInfo.className ? document.getElementsByClassName(elementInfo.className)[0] : null);
            if (actualElement) {
                actualElement.style.pointerEvents = elementInfo.originalPointerEvents || 'auto';
            }
        });
        
        console.log('🔍 Element stack at center (top to bottom):', allElementsAtCenter);
    }

    /**
     * Sets up pan and zoom functionality for the 2D canvas
     */
    setupPanAndZoom() {
        if (!this.fabricCanvas) return;
        
        console.log('🔧 Setting up pan and zoom functionality...');
        
        // Track dragging state for panning
        let isDragging = false;
        let dragStarted = false;
        let startX = null;
        let startY = null;
        let lastPosX = 0;
        let lastPosY = 0;
        const dragThreshold = 10; // Increased threshold to make clicking easier
        
        // Set initial zoom constraints - allow zooming out to 50% for better overview
        const minZoom = 0.5; // 50% - allows seeing beyond splat boundaries  
        const maxZoom = 5.0; // 500% - detailed view
        
        // Optimized Fabric.js native zoom with performance improvements
        this.canvas.addEventListener('wheel', (e) => {
            const delta = e.deltaY;
            let zoom = this.fabricCanvas.getZoom();
            
            // Use standard zoom calculation
            zoom *= 0.999 ** delta;
            
            // Enforce zoom limits: 100% minimum (screenshot fits perfectly), 500% maximum
            zoom = Math.max(minZoom, Math.min(maxZoom, zoom));
            
            // Get pointer position relative to canvas
            const rect = this.canvas.getBoundingClientRect();
            const pointer = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
            
            // Use Fabric.js native zoomToPoint to maintain coordinate system
            this.fabricCanvas.zoomToPoint(pointer, zoom);
            
            // No clamping - allow free panning
            
            console.log(`🔍 Zoom level: ${(zoom * 100).toFixed(1)}%`);
            
            // Prevent default scroll behavior
            e.preventDefault();
            e.stopPropagation();
        }, { passive: false });
        
        // Universal pan functionality using native events (works everywhere on canvas)
        this.canvas.addEventListener('mousedown', (e) => {
            // Start tracking potential drag
            dragStarted = false;
            isDragging = false;
            startX = e.clientX;
            startY = e.clientY;
            lastPosX = e.clientX;
            lastPosY = e.clientY;
            console.log('🖱️ Mouse down - tracking potential drag at:', startX, startY);
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            if (startX !== null && startY !== null) {
                const deltaX = Math.abs(e.clientX - startX);
                const deltaY = Math.abs(e.clientY - startY);
                
                // Check if we've moved enough to start dragging
                if (!dragStarted && (deltaX > dragThreshold || deltaY > dragThreshold)) {
                    dragStarted = true;
                    isDragging = true;
                    this.canvas.style.cursor = 'grabbing';
                    console.log(`🖱️ Started panning (drag threshold exceeded: ${deltaX}, ${deltaY})`);
                }
                
                // If we're dragging, pan the viewport
                if (isDragging) {
                    const vpt = this.fabricCanvas.viewportTransform.slice(); // Create copy
                    const deltaXMove = e.clientX - lastPosX;
                    const deltaYMove = e.clientY - lastPosY;
                    
                    vpt[4] += deltaXMove;
                    vpt[5] += deltaYMove;
                    
                    // Apply panning transform - no clamping, allow free movement
                    this.fabricCanvas.setViewportTransform(vpt);
                    
                    // Critical: Update object coordinates after pan
                    this.fabricCanvas.forEachObject((obj) => {
                        obj.setCoords();
                    });
                    
                    console.log(`📍 Panning by: ${deltaXMove}, ${deltaYMove}`);
                    
                    this.fabricCanvas.requestRenderAll();
                    lastPosX = e.clientX;
                    lastPosY = e.clientY;
                }
            }
        });
        
        this.canvas.addEventListener('mouseup', (e) => {
            if (isDragging) {
                console.log('🖱️ Stopped panning');
                this.canvas.style.cursor = 'default';
            } else {
                // This was a click (or very small movement) - handle polygon interaction
                const deltaX = Math.abs(e.clientX - startX);
                const deltaY = Math.abs(e.clientY - startY);
                console.log(`🖱️ Mouse up - movement: ${deltaX}, ${deltaY} (threshold: ${dragThreshold})`);
                
                if (deltaX <= dragThreshold && deltaY <= dragThreshold) {
                    console.log('🖱️ Click detected - checking for polygon interaction');
                    this.handleCanvasClick(e);
                } else {
                    console.log('🖱️ Large movement detected but no panning occurred - checking polygon click anyway');
                    this.handleCanvasClick(e);
                }
            }
            
            // Reset drag tracking
            isDragging = false;
            dragStarted = false;
            startX = null;
            startY = null;
        });
        
        // Add method to reset zoom and pan (Fabric.js native approach) - kept for debugging
        this.resetViewport = () => {
            this.fabricCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
            this.fabricCanvas.setZoom(1);
            console.log('🔄 Reset viewport to default');
        };
        
        // No clamping functions needed - allow free pan and zoom
        
        console.log('✅ Pan and zoom functionality initialized');
        console.log(`  - Zoom range: ${minZoom * 100}% to ${maxZoom * 100}%`);
        console.log('  - Mouse wheel: zoom in/out');
        console.log('  - Click and drag anywhere: pan around canvas');
        console.log(`  - Drag threshold: ${dragThreshold}px to distinguish click from drag`);
    }

    /**
     * Handles canvas clicks (not drags) for polygon interaction
     */
    handleCanvasClick(e) {
        console.log('🖱️ Processing canvas click for polygon detection');
        
        // Try to find object at click position using Fabric.js methods
        const pointer = this.fabricCanvas.getPointer(e);
        console.log('📍 Click position:', pointer);
        
        const target = this.fabricCanvas.findTarget(e, false);
        console.log('🎯 Fabric.js findTarget result:', target);
        
        if (target && target.featureData) {
            console.log('✅ Found polygon via click:', target.featureData.entityName);
            
            // Reset previous clicked object to normal styling
            if (this.currentClickedObject && this.currentClickedObject !== target) {
                console.log('🔄 Resetting previous clicked polygon:', this.currentClickedObject.featureData?.entityName);
                if (this.currentClickedObject.originalStrokeWidth !== undefined) {
                    this.currentClickedObject.set({
                        strokeWidth: this.currentClickedObject.originalStrokeWidth,
                        fill: this.currentClickedObject.originalFill
                    });
                }
            }
            
            // Store original values if not already stored
            if (target.originalStrokeWidth === undefined) {
                target.originalStrokeWidth = target.strokeWidth;
                target.originalFill = target.fill;
            }
            
            // Apply clicked styling (thick stroke, slight fill)
            target.set({
                strokeWidth: target.originalStrokeWidth * 3, // Thicker than hover (3x vs 2x)
                fill: 'rgba(0, 0, 0, 0.1)' // Slightly more visible than hover
            });
            
            // Update clicked state
            this.currentClickedObject = target;
            
            // Remove from hover state if it was hovered
            if (this.currentHoveredObject === target) {
                this.currentHoveredObject = null;
            }
            
            this.fabricCanvas.renderAll();
            console.log('✅ Applied clicked styling to:', target.featureData.entityName);
            
            // Handle the polygon click logic
            this.handlePolygonClick(target.featureData);
        } else {
            // Clicked outside any polygon - deactivate currently clicked polygon
            console.log('❌ No polygon found at click position - deactivating clicked polygon');
            
            if (this.currentClickedObject) {
                console.log('🔄 Deactivating clicked polygon:', this.currentClickedObject.featureData?.entityName);
                
                // Restore original styling
                if (this.currentClickedObject.originalStrokeWidth !== undefined) {
                    this.currentClickedObject.set({
                        strokeWidth: this.currentClickedObject.originalStrokeWidth,
                        fill: this.currentClickedObject.originalFill
                    });
                    this.fabricCanvas.renderAll();
                    console.log('✅ Clicked polygon deactivated');
                }
                
                this.currentClickedObject = null;
            }
        }
    }

    /**
     * Handles polygon click events and integrates with existing PA/NPA selection system
     */
    handlePolygonClick(featureData) {
        const { originalFeature, format, isPlantable, entityName } = featureData;
        
        console.log(`🎯 Processing click for ${isPlantable ? 'plantable' : 'non-plantable'} area: ${entityName}`);
        
        if (isPlantable) {
            // Handle plantable area selection
            if (format === 'boyd') {
                const parsed = window.parseBoydName(originalFeature.properties.name);
                const paName = parsed.description || parsed.id;
                
                // Update layer state (same as UI button behavior)
                window.layerState.selectedPA = paName;
                window.layerState.showPlantableAreas = true;
                
                console.log(`🌱 Selected plantable area: ${paName}`);
                
                // Trigger focus panel if available
                if (window.showFocusPanel) {
                    const boydData = window.parseBoydEcologicalData(originalFeature.properties.description || '');
                    window.showFocusPanel(paName, boydData);
                }
                
                // Update UI controls
                if (window.updatePlantableAreasUI) {
                    window.updatePlantableAreasUI();
                }
            }
        } else {
            // Handle non-plantable area selection
            if (format === 'boyd') {
                const npaCategory = window.extractNPACategory(originalFeature.properties.name);
                if (npaCategory) {
                    window.layerState.selectedNPA = npaCategory;
                    window.layerState.showNonPlantableAreas = true;
                    
                    console.log(`🚫 Selected non-plantable area: ${npaCategory}`);
                    
                    // Update UI controls
                    if (window.updateNonPlantableAreasUI) {
                        window.updateNonPlantableAreasUI();
                    }
                }
            }
        }
        
        // Re-render polygons to update selection styling (bold outlines for selected)
        console.log('🔄 Refreshing polygon styling after selection...');
        this.refreshPolygonStyling();
    }

    /**
     * Refreshes polygon styling based on current selection state
     */
    refreshPolygonStyling() {
        if (!this.fabricCanvas) return;
        
        this.fabricCanvas.forEachObject((obj) => {
            if (obj.featureData) {
                const { originalFeature, format, isPlantable } = obj.featureData;
                
                // Update styling based on current selection
                let strokeColor, strokeWidth;
                
                if (isPlantable) {
                    if (format === 'boyd') {
                        const parsed = window.parseBoydName(originalFeature.properties.name);
                        const paName = parsed.description || parsed.id;
                        
                        // Handle ecological metrics coloring in refresh
                        if (window.layerState?.showEcologicalMetrics && window.layerState?.selectedMetric) {
                            // Re-apply ecological metrics colors (would need to recalculate min/max)
                            // For now, just indicate metrics mode with different styling
                            strokeColor = '#4a90e2'; // Different blue for metrics mode
                            strokeWidth = 2;
                        } else {
                            // Regular PA styling
                            if (paName === window.layerState?.selectedPA) {
                                strokeColor = '#072b2e';
                                strokeWidth = 10;
                            } else {
                                strokeColor = '#072b2e';
                                strokeWidth = 2;
                            }
                        }
                    }
                } else {
                    if (format === 'boyd') {
                        const npaCategory = window.extractNPACategory(originalFeature.properties.name);
                        
                        if (npaCategory === window.layerState?.selectedNPA) {
                            strokeColor = '#FF0000';
                            strokeWidth = 10;
                        } else {
                            strokeColor = '#FF0000';
                            strokeWidth = 2;
                        }
                    }
                }
                
                if (strokeColor && strokeWidth) {
                    obj.set({
                        stroke: strokeColor,
                        strokeWidth: strokeWidth
                    });
                }
            }
        });
        
        this.fabricCanvas.renderAll();
    }

    /**
     * Updates polygon visibility based on current layer state
     * Call this when layer controls change (PA/NPA visibility toggles)
     */
    updatePolygonVisibility() {
        if (!this.fabricCanvas || !this.isActive) return;
        
        console.log('🔄 Updating 2D polygon visibility based on layer state');
        
        // Clear current polygons and re-render with current layer state
        this.fabricCanvas.clear();
        
        // Set background image again
        this.setBackgroundImage();
        
        // Re-render polygons with current filtering (this will also update the legend)
        this.renderGeoJsonPolygons();
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

        // STEP 3: Hide Cesium container (keep control panel visible)
        const cesiumContainer = document.getElementById('cesiumContainer');
        if (cesiumContainer) {
            cesiumContainer.style.display = 'none';
            console.log('✅ Cesium container hidden');
        }

        // STEP 4: Hide scrollbars and show the Fabric canvas
        document.body.style.overflow = 'hidden'; // Prevent scrollbars for full-screen experience
        
        if (this.canvas) {
            this.canvas.style.display = 'block';
            console.log('✅ Fabric canvas shown');
        }

        // STEP 5: Clear any existing content
        this.fabricCanvas.clear();

        // STEP 6: Set background image from screenshot if available
        this.setBackgroundImage();
        
        // STEP 6.5: Ensure black background is set (shows when panning/zooming out)
        setTimeout(() => {
            this.fabricCanvas.setBackgroundColor('#000000', () => {
                console.log('🎨 Black background color applied after image load');
                this.fabricCanvas.renderAll();
            });
        }, 100); // Small delay to ensure background image is loaded first

        // STEP 7: Render GeoJSON polygons on canvas
        this.renderGeoJsonPolygons();

        this.isActive = true;
        console.log('🎯 2D Fabric canvas mode activated successfully!');
    }

    /**
     * Deactivates 2D mode by showing Cesium and completely removing Fabric canvas
     */
    deactivate() {
        if (!this.isActive) return;

        console.log('🔄 Transitioning back to 3D Cesium mode...');

        // STEP 1: Restore scrollbars
        document.body.style.overflow = ''; // Restore default scroll behavior

        // STEP 2: Clean up color legend if it exists
        if (window.createColorLegend) {
            window.createColorLegend(null, 0, 0); // Remove legend
            console.log('✅ Color legend cleaned up');
        }

        // STEP 3: Clean up Fabric.js instance FIRST (before DOM removal)
        if (this.fabricCanvas) {
            try {
                this.fabricCanvas.dispose();
                console.log('✅ Fabric.js instance disposed');
            } catch (fabricError) {
                console.warn('⚠️ Error disposing Fabric.js instance:', fabricError);
            }
            this.fabricCanvas = null;
        }

        // STEP 3: Now safely remove canvas from DOM
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

        // STEP 4: Reset canvas reference
        this.canvas = null;

        // STEP 5: Show Cesium container
        const cesiumContainer = document.getElementById('cesiumContainer');
        if (cesiumContainer) {
            cesiumContainer.style.display = 'block';
            console.log('✅ Cesium container shown');
        }

        // STEP 6: Sync 3D visualization with any changes made in 2D mode
        if (window.currentSiteData && window.visualizeGeoJsonPolygonsWithLayers) {
            console.log('🔄 Syncing 3D visualization with 2D changes...');
            
            // Ensure proper parameter filter state for ecological metrics
            if (window.layerState?.showEcologicalMetrics && window.layerState?.selectedMetric) {
                window.currentParameterFilter = window.layerState.selectedMetric;
                console.log('🔄 Restored parameter filter:', window.currentParameterFilter);
            } else {
                window.currentParameterFilter = null;
                console.log('🔄 Cleared parameter filter');
            }
            
            try {
                window.visualizeGeoJsonPolygonsWithLayers(window.currentSiteData);
                console.log('✅ 3D visualization sync completed successfully');
            } catch (error) {
                console.error('❌ Error syncing 3D visualization:', error);
                // Fallback: try direct visualization
                if (window.visualizeGeoJsonPolygons) {
                    console.log('🔄 Attempting fallback visualization...');
                    window.visualizeGeoJsonPolygons(window.currentSiteData);
                }
            }
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
     * Sets the background image from the screenshot capture system with perfect alignment
     */
    setBackgroundImage() {
        if (!this.fabricCanvas) return;

        const backgroundImage = window.view2DManager?.background2DImage;
        console.log('🔍 Checking for background image:', backgroundImage ? 'Found' : 'Not found');
        
        if (backgroundImage && backgroundImage.length > 100) { // Basic validation
            console.log('📸 Setting background image from screenshot...');
            
            // Create a temporary image to get its actual dimensions
            const img = new Image();
            img.onload = () => {
                const canvasWidth = this.fabricCanvas.width;
                const canvasHeight = this.fabricCanvas.height;
                const imgWidth = img.width;
                const imgHeight = img.height;
                
                console.log(`📐 Image dimensions: ${imgWidth}x${imgHeight}`);
                console.log(`📐 Canvas dimensions: ${canvasWidth}x${canvasHeight}`);
                
                // CRITICAL FIX: Ensure screenshot fills canvas exactly with no scaling distortion
                // The screenshot should map 1:1 to screen coordinates for perfect alignment
                
                // Method 1: If screenshot size matches canvas size exactly
                if (imgWidth === canvasWidth && imgHeight === canvasHeight) {
                    console.log('🎯 Perfect size match - using 1:1 scaling');
                    this.fabricCanvas.setBackgroundImage(backgroundImage, 
                        () => {
                            this.fabricCanvas.setBackgroundColor('#000000', this.fabricCanvas.renderAll.bind(this.fabricCanvas));
                            console.log('✅ 2D background image set with perfect 1:1 alignment');
                            // Ensure proper viewport alignment after image is loaded
                            setTimeout(() => {
                                this.alignViewportToScreenshot();
                                this.debugViewportAlignment();
                            }, 50);
                        }, {
                            scaleX: 1,
                            scaleY: 1,
                            originX: 'left',
                            originY: 'top'
                        });
                } else {
                    // Method 2: Force screenshot to fit canvas exactly (may cause slight distortion but ensures alignment)
                    const scaleX = canvasWidth / imgWidth;
                    const scaleY = canvasHeight / imgHeight;
                    
                    console.log(`📏 Forcing perfect fit - Scale factors: X=${scaleX.toFixed(3)}, Y=${scaleY.toFixed(3)}`);
                    console.log('⚠️ This may cause slight distortion but ensures coordinate alignment');
                    
                    this.fabricCanvas.setBackgroundImage(backgroundImage, 
                        () => {
                            this.fabricCanvas.setBackgroundColor('#000000', this.fabricCanvas.renderAll.bind(this.fabricCanvas));
                            console.log('✅ 2D background image set with forced perfect alignment');
                            // Ensure proper viewport alignment after image is loaded
                            setTimeout(() => {
                                this.alignViewportToScreenshot();
                                this.debugViewportAlignment();
                            }, 50);
                        }, {
                            scaleX: scaleX,
                            scaleY: scaleY,
                            originX: 'left',
                            originY: 'top'
                        });
                }
            };
            img.src = backgroundImage;
        } else {
            console.warn('⚠️ No valid background image available - using placeholder color');
            console.warn('   Background image data:', backgroundImage ? `${backgroundImage.length} chars` : 'null/undefined');
            // Set black background color using recommended method
            this.fabricCanvas.setBackgroundColor('#000000', this.fabricCanvas.renderAll.bind(this.fabricCanvas));
        }
    }

    /**
     * Gets the current visible bounds of the canvas in canvas coordinates
     * @returns {Object} {left, top, right, bottom} in canvas coordinate space
     */
    getCurrentViewportBounds() {
        if (!this.fabricCanvas) return null;
        
        const vpt = this.fabricCanvas.viewportTransform;
        const zoom = this.fabricCanvas.getZoom();
        
        // Screen corners in canvas coordinates
        const left = -vpt[4] / zoom;
        const top = -vpt[5] / zoom;
        const right = left + (this.fabricCanvas.width / zoom);
        const bottom = top + (this.fabricCanvas.height / zoom);
        
        return { left, top, right, bottom };
    }

    /**
     * Gets the canvas coordinates where the screenshot corners are positioned
     * Based on the screenshot's geographic bounds and current coordinate mapping
     * @returns {Object} {left, top, right, bottom} in canvas coordinate space
     */
    getScreenshotCanvasBounds() {
        const bounds = window.view2DManager?.screenshotBounds;
        if (!bounds || !this.fabricCanvas) {
            console.warn('Cannot get screenshot bounds - no bounds available');
            return null;
        }
        
        // Convert screenshot geographic bounds to canvas coordinates using existing mapping
        const topLeft = this.latLonToScreenPixel(bounds.west, bounds.north);
        const bottomRight = this.latLonToScreenPixel(bounds.east, bounds.south);
        
        if (!topLeft || !bottomRight) {
            console.warn('Cannot convert screenshot bounds to canvas coordinates');
            return null;
        }
        
        const canvasBounds = {
            left: topLeft.x,
            top: topLeft.y, 
            right: bottomRight.x,
            bottom: bottomRight.y
        };
        
        console.log(`📐 Screenshot canvas bounds: ${canvasBounds.left.toFixed(1)},${canvasBounds.top.toFixed(1)} to ${canvasBounds.right.toFixed(1)},${canvasBounds.bottom.toFixed(1)}`);
        return canvasBounds;
    }

    /**
     * Aligns viewport so that screenshot bounds match screen bounds perfectly
     */
    alignViewportToScreenshot() {
        if (!this.fabricCanvas) return;
        
        const screenshotCanvasBounds = this.getScreenshotCanvasBounds();
        
        if (!screenshotCanvasBounds) {
            console.warn('Cannot align viewport - missing screenshot bounds');
            return;
        }
        
        console.log('🎯 Screenshot bounds in canvas coordinates:', screenshotCanvasBounds);
        
        // We want the screenshot to fill the screen exactly
        // So screenshot canvas bounds should map to screen bounds (0,0) to (width,height)
        const screenWidth = this.fabricCanvas.width;
        const screenHeight = this.fabricCanvas.height;
        
        const screenshotWidth = screenshotCanvasBounds.right - screenshotCanvasBounds.left;
        const screenshotHeight = screenshotCanvasBounds.bottom - screenshotCanvasBounds.top;
        
        // Calculate zoom needed to make screenshot fit screen exactly
        const zoomX = screenWidth / screenshotWidth;
        const zoomY = screenHeight / screenshotHeight;
        const zoom = Math.min(zoomX, zoomY); // Use smaller zoom to fit entirely
        
        // Calculate pan needed to position screenshot at screen origin
        // We want screenshot's left,top to be at screen's 0,0
        const panX = -screenshotCanvasBounds.left * zoom;
        const panY = -screenshotCanvasBounds.top * zoom;
        
        console.log(`🎯 Screen size: ${screenWidth}x${screenHeight}`);
        console.log(`🎯 Screenshot size in canvas: ${screenshotWidth.toFixed(1)}x${screenshotHeight.toFixed(1)}`);
        console.log(`🎯 Calculated zoom: ${zoom.toFixed(3)}`);
        console.log(`🎯 Calculated pan: (${panX.toFixed(1)}, ${panY.toFixed(1)})`);
        
        // Apply the transformation
        this.fabricCanvas.setViewportTransform([zoom, 0, 0, zoom, panX, panY]);
        
        // Update all object coordinates
        this.fabricCanvas.forEachObject((obj) => {
            obj.setCoords();
        });
        
        // Verify the result
        const newViewportBounds = this.getCurrentViewportBounds();
        console.log('✅ New viewport bounds after alignment:', newViewportBounds);
        console.log(`✅ Alignment complete - screenshot should now fill screen from (0,0) to (${screenWidth},${screenHeight})`);
        
        // Calculate proper zoom based on content density  
        // The screenshot bounds span suggests we need to zoom out more to see the full context
        const screenshotBounds = window.view2DManager?.screenshotBounds;
        if (!screenshotBounds) {
            console.warn('No screenshot bounds available for zoom calculation');
            return;
        }
        
        const boundsSpanDegrees = (screenshotBounds.east - screenshotBounds.west) * (screenshotBounds.north - screenshotBounds.south);
        console.log(`📏 Screenshot bounds area: ${boundsSpanDegrees.toFixed(8)} square degrees`);
        
        // The screenshot shows we need to ZOOM IN to fill the screen
        // At 50% zoom, there's black space - so we need MORE than 100% zoom
        
        // Get the actual screenshot image dimensions vs canvas dimensions to calculate needed zoom
        const backgroundImage = window.view2DManager?.background2DImage;
        if (backgroundImage) {
            const img = new Image();
            img.onload = () => {
                const imageWidth = img.width;
                const imageHeight = img.height;
                const canvasWidth = this.fabricCanvas.width;
                const canvasHeight = this.fabricCanvas.height;
                
                // Calculate zoom needed to make screenshot fill entire screen
                const zoomX = canvasWidth / imageWidth;
                const zoomY = canvasHeight / imageHeight;
                const fillScreenZoom = Math.max(zoomX, zoomY); // Use larger zoom to fill completely
                
                console.log(`📏 Screenshot image: ${imageWidth}x${imageHeight}`);
                console.log(`📏 Canvas: ${canvasWidth}x${canvasHeight}`);
                console.log(`🔧 Zoom needed to fill screen: ${fillScreenZoom.toFixed(3)}`);
                
                this.fabricCanvas.setZoom(fillScreenZoom);
                this.fabricCanvas.renderAll();
            };
            img.src = backgroundImage;
        } else {
            console.log(`🔧 No background image available, keeping calculated zoom: ${zoom.toFixed(3)}`);
        }
        
        this.fabricCanvas.renderAll();
    }


    /**
     * Debug method to verify viewport alignment
     */
    debugViewportAlignment() {
        if (!this.fabricCanvas) return;
        
        const currentViewport = this.getCurrentViewportBounds();
        const screenshotBounds = this.getScreenshotCanvasBounds();
        const screenSize = { width: this.fabricCanvas.width, height: this.fabricCanvas.height };
        
        console.log('🔍 VIEWPORT ALIGNMENT DEBUG:');
        console.log('  Current viewport bounds:', currentViewport);
        console.log('  Screenshot canvas bounds:', screenshotBounds);
        console.log('  Screen size:', screenSize);
        
        if (currentViewport && screenshotBounds) {
            console.log('  Viewport size:', {
                width: currentViewport.right - currentViewport.left,
                height: currentViewport.bottom - currentViewport.top
            });
            console.log('  Screenshot size in canvas:', {
                width: screenshotBounds.right - screenshotBounds.left,
                height: screenshotBounds.bottom - screenshotBounds.top
            });
        }
        
        const vpt = this.fabricCanvas.viewportTransform;
        console.log('  ViewportTransform:', vpt);
        console.log('  Zoom:', this.fabricCanvas.getZoom());
    }



    /**
     * Renders all GeoJSON polygons on the Fabric.js canvas
     * Uses the same logic as visualizeGeoJsonPolygons but renders on 2D canvas
     */
    renderGeoJsonPolygons() {
        if (!this.fabricCanvas || !window.currentSiteData || !window.currentSiteData.features) {
            console.warn('Cannot render polygons - missing canvas or site data');
            return;
        }

        console.log('🎨 Rendering GeoJSON polygons on 2D canvas...');

        const geoJsonData = window.currentSiteData;
        
        // Detect format from first feature (same as Cesium implementation)
        const format = geoJsonData.features.length > 0 ? window.detectGeoJsonFormat(geoJsonData.features[0]) : 'legacy';
        
        // Detect coordinate system
        let isGeographic = false;
        if (geoJsonData.features.length > 0) {
            const firstFeature = geoJsonData.features[0];
            if (firstFeature.geometry.type === 'Point') {
                isGeographic = window.detectCoordinateFormat(firstFeature.geometry.coordinates) === 'geographic';
            } else if (firstFeature.geometry.type === 'Polygon') {
                isGeographic = window.detectCoordinateFormat(firstFeature.geometry.coordinates[0][0]) === 'geographic';
            }
        }

        console.log(`📋 Detected format: ${format}, geographic coordinates: ${isGeographic}`);

        // Collect parameter values for ecological metrics color mapping (same as Cesium)
        let parameterValues = [];
        let minParamValue = 0, maxParamValue = 1;
        
        if (window.layerState?.showEcologicalMetrics && window.layerState?.selectedMetric && format === 'boyd') {
            console.log(`🎨 Applying ecological metrics filter: ${window.layerState.selectedMetric}`);
            
            // Collect all parameter values from plantable features
            geoJsonData.features.forEach(feature => {
                const category = window.getBoydFeatureCategory(feature);
                if (category === 'plantable') {
                    const boydData = window.parseBoydEcologicalData(feature.properties.description || '');
                    const paramValue = boydData[window.layerState.selectedMetric];
                    if (paramValue) {
                        const numericValue = window.parseParameterValue(paramValue, window.layerState.selectedMetric);
                        parameterValues.push(numericValue);
                    }
                }
            });
            
            // Calculate min/max for color scaling
            if (parameterValues.length > 0) {
                minParamValue = Math.min(...parameterValues);
                maxParamValue = Math.max(...parameterValues);
            }
            
            console.log(`🎨 Parameter range: ${minParamValue} - ${maxParamValue}`);
            
            // Create color legend for the current parameter (same as Cesium)
            if (window.createColorLegend) {
                window.createColorLegend(window.layerState.selectedMetric, minParamValue, maxParamValue);
            }
        } else {
            // Remove legend when no ecological metrics are active
            if (window.createColorLegend) {
                window.createColorLegend(null, 0, 0);
            }
        }

        // Process each feature
        let renderedCount = 0;
        geoJsonData.features.forEach((feature, index) => {
            // Apply same filtering logic as Cesium implementation
            if (format === 'boyd') {
                const category = window.getBoydFeatureCategory(feature);
                if (category === 'data-point') {
                    return; // Skip data points
                }
                
                // Apply layer filtering
                const isPlantable = category === 'plantable';
                const isNonPlantable = category === 'non-plantable';
                
                if (isPlantable && !window.layerState?.showPlantableAreas && !window.layerState?.temporaryShowPlantable && !window.layerState?.showEcologicalMetrics) {
                    return; // Skip plantable areas if not showing them (unless showing metrics)
                }
                
                if (isNonPlantable && !window.layerState?.showNonPlantableAreas) {
                    return; // Skip non-plantable areas if not showing them
                }
            }

            // Only render polygon features
            if (feature.geometry.type === 'Polygon') {
                const polygon = this.createFabricPolygon(feature, format, isGeographic, index, {
                    minParamValue,
                    maxParamValue,
                    showEcologicalMetrics: window.layerState?.showEcologicalMetrics,
                    selectedMetric: window.layerState?.selectedMetric
                });
                if (polygon) {
                    this.fabricCanvas.add(polygon);
                    renderedCount++;
                }
            }
        });

        // Force recalculation of object bounds for proper hit detection
        this.fabricCanvas.getObjects().forEach(obj => {
            obj.setCoords(); // Critical for mouse interaction
        });
        
        // Render everything at once with proper bounds
        this.fabricCanvas.renderAll();
        console.log(`✅ Rendered ${renderedCount} polygons on 2D canvas with bounds recalculated`);
        
        // Debug: Check if polygons are actually in the canvas
        console.log(`🔍 Canvas objects count: ${this.fabricCanvas.getObjects().length}`);
        
        // Test if we can manually find objects at a specific point
        setTimeout(() => {
            const centerX = this.fabricCanvas.width / 2;
            const centerY = this.fabricCanvas.height / 2;
            const objectsAtCenter = this.fabricCanvas.getObjects().filter(obj => {
                return obj.containsPoint(new fabric.Point(centerX, centerY));
            });
            console.log(`🔍 Objects at canvas center (${centerX}, ${centerY}):`, objectsAtCenter.length);
            
            // Try to manually fire a click on the first polygon
            const firstPolygon = this.fabricCanvas.getObjects()[0];
            if (firstPolygon) {
                console.log('🧪 Testing manual polygon interaction...');
                console.log('🧪 First polygon:', firstPolygon.featureData?.entityName);
                console.log('🧪 First polygon selectable:', firstPolygon.selectable);
                console.log('🧪 First polygon evented:', firstPolygon.evented);
            }
        }, 1000);
    }

    /**
     * Creates a Fabric.js polygon from a GeoJSON feature
     */
    createFabricPolygon(feature, format, isGeographic, index, metricsData = {}) {
        // Convert coordinates to screen pixels
        const screenPoints = [];
        
        for (let i = 0; i < feature.geometry.coordinates[0].length - 1; i++) { // Skip last point (duplicate of first)
            const coord = feature.geometry.coordinates[0][i];
            const [x, y] = coord;
            let latLng;
            
            if (isGeographic) {
                latLng = { lat: y, lng: x };
            } else {
                latLng = window.utmToLatLng(x, y);
            }
            
            const screenPos = this.latLonToScreenPixel(latLng.lng, latLng.lat);
            if (screenPos) {
                screenPoints.push({ x: screenPos.x, y: screenPos.y });
            }
        }

        if (screenPoints.length < 3) {
            console.warn(`Polygon ${index} has insufficient valid points:`, screenPoints.length);
            return null;
        }

        // Determine styling based on feature type (same logic as Cesium)
        const isPlantable = window.isPlantableFeature(feature, format);
        let fillColor, strokeColor, strokeWidth;
        let entityName = `Site_Polygon_${index}`;

        if (isPlantable) {
            // Plantable area styling
            if (format === 'boyd') {
                const parsed = window.parseBoydName(feature.properties.name);
                entityName = parsed.description || parsed.id;
                
                // Handle ecological metrics coloring (same as Cesium implementation)
                if (metricsData.showEcologicalMetrics && metricsData.selectedMetric) {
                    const boydData = window.parseBoydEcologicalData(feature.properties.description || '');
                    const paramValue = boydData[metricsData.selectedMetric];
                    if (paramValue) {
                        const numericValue = window.parseParameterValue(paramValue, metricsData.selectedMetric);
                        const cesiumColor = window.getParameterColor(numericValue, metricsData.minParamValue, metricsData.maxParamValue, metricsData.selectedMetric);
                        
                        // Convert Cesium color to CSS for Fabric.js
                        fillColor = `rgba(${Math.round(cesiumColor.red * 255)}, ${Math.round(cesiumColor.green * 255)}, ${Math.round(cesiumColor.blue * 255)}, 0.7)`;
                        strokeColor = `rgba(${Math.round(cesiumColor.red * 0.7 * 255)}, ${Math.round(cesiumColor.green * 0.7 * 255)}, ${Math.round(cesiumColor.blue * 0.7 * 255)}, 1.0)`;
                        strokeWidth = 2;
                        
                        console.log(`🎨 Applied ecological metrics color for ${entityName}: ${fillColor}`);
                    } else {
                        // No data for this parameter - don't render (same as Cesium)
                        console.log(`⚠️ No data for ${metricsData.selectedMetric} in ${entityName}, skipping`);
                        return null;
                    }
                } else {
                    // Regular PA styling
                    const paName = parsed.description || parsed.id;
                    if (paName && paName === window.layerState?.selectedPA) {
                        strokeColor = '#072b2e'; // Ecodash blue outline for selected
                        strokeWidth = 10;
                    } else {
                        strokeColor = '#072b2e'; // Ecodash blue outline for unselected
                        strokeWidth = 2;
                    }
                    fillColor = 'rgba(0, 0, 0, 0.001)'; // Nearly transparent but detectable for hover
                }
            } else {
                // Legacy format
                const measurements = window.parsePlantableMeasurements(feature.properties.name);
                entityName = measurements.id;
                const lightLevel = window.extractLightLevel(feature.properties.name);
                strokeColor = window.getOutlineColorByLight ? window.getOutlineColorByLight(lightLevel).toCssColorString() : '#FFFFFF';
                strokeWidth = 2;
                fillColor = 'rgba(0, 0, 0, 0.001)'; // Nearly transparent but detectable for hover
            }
            
        } else {
            // Non-plantable area styling
            if (format === 'boyd') {
                const parsed = window.parseBoydName(feature.properties.name);
                entityName = parsed.description || parsed.id;
                
                // Check if this NPA is selected
                const npaCategory = window.extractNPACategory(feature.properties.name);
                if (npaCategory && npaCategory === window.layerState?.selectedNPA) {
                    strokeColor = '#FF0000'; // Red outline for selected
                    strokeWidth = 10;
                } else {
                    strokeColor = '#FF0000'; // Red outline for unselected
                    strokeWidth = 2;
                }
            } else {
                // Legacy format
                const parsed = window.parseNonPlantableName(feature.properties.name);
                entityName = parsed.description || parsed.id;
                strokeColor = '#8B0000'; // Dark red
                strokeWidth = 3;
            }
            
            fillColor = 'rgba(0, 0, 0, 0.1)'; // More visible for better click detection
        }

        // Create Fabric.js polygon with performance optimizations
        const fabricPolygon = new fabric.Polygon(screenPoints, {
            fill: fillColor,
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            selectable: false, // Disable selection for performance
            evented: true, // Keep events for interaction
            hoverCursor: 'pointer',
            moveCursor: 'pointer',
            hasControls: false,
            hasBorders: false,
            lockMovementX: true,
            lockMovementY: true,
            lockRotation: true,
            lockScalingX: true,
            lockScalingY: true,
            // Performance optimizations
            objectCaching: true, // Enable caching for better performance
            statefullCache: true, // Enable stateful caching
            noScaleCache: false, // Allow scale caching
            // Store original feature data for interaction
            featureData: {
                originalFeature: feature,
                format: format,
                isPlantable: isPlantable,
                entityName: entityName,
                index: index
            }
        });

        console.log(`🔧 Created polygon: ${entityName}, selectable: ${fabricPolygon.selectable}, evented: ${fabricPolygon.evented}`);

        return fabricPolygon;
    }

    /**
     * Converts geographic coordinates (lat/lon) to screen pixel coordinates
     * Uses the exact same bounds as the screenshot for perfect alignment
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

        // DEBUG: Log bounds on first few conversions to diagnose polygon positioning
        if (!this._boundsLogged) {
            console.log('🗺️ Using screenshot bounds for polygon conversion:', bounds);
            console.log(`   Bounds span: ${(bounds.east - bounds.west).toFixed(6)}° x ${(bounds.north - bounds.south).toFixed(6)}°`);
            this._boundsLogged = true;
        }

        // Check if point is within screenshot bounds
        if (longitude < bounds.west || longitude > bounds.east ||
            latitude < bounds.south || latitude > bounds.north) {
            // DEBUG: Log points that are outside bounds
            if (!this._outsideBoundsLogged) {
                console.log(`⚠️ Point outside bounds: ${longitude.toFixed(6)}, ${latitude.toFixed(6)}`);
                console.log(`   Bounds: ${bounds.west.toFixed(6)} to ${bounds.east.toFixed(6)}, ${bounds.south.toFixed(6)} to ${bounds.north.toFixed(6)}`);
                this._outsideBoundsLogged = true;
            }
            return null;
        }

        // CRITICAL: Convert to normalized coordinates (0-1) using EXACT same bounds as screenshot
        const normalizedX = (longitude - bounds.west) / (bounds.east - bounds.west);
        const normalizedY = (bounds.north - latitude) / (bounds.north - bounds.south); // Flip Y for screen coordinates

        // CRITICAL: Convert to screen pixels using EXACT canvas dimensions
        // This ensures 1:1 correspondence with screenshot pixels
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