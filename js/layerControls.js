/**
 * Layer control system for managing plantable and non-plantable area visualization
 */

// Layer state management
window.layerState = {
    showPlantableAreas: false,
    showEcologicalMetrics: false,
    selectedMetric: null,
    showNonPlantableAreas: false,
    selectedPA: null, // Single selected PA
    selectedNPA: null, // Single selected NPA
    npaCategories: new Map(), // Map of NPA category name to metadata
    paCategories: new Map(), // Map of PA name to {number, category}
    categorizedPAs: new Map() // Map of category -> array of PAs
};

// Default visualization settings for different layer types
const layerSettings = {
    plantableAreas: {
        polygonAlpha: 0,
        outlineWidth: 2,
        selectedOutlineWidth: 10,
        outlineColor: Cesium.Color.WHITE
    },
    ecologicalMetrics: {
        polygonAlpha: 0.7,
        outlineWidth: 2,
        selectedOutlineWidth: 5
    },
    nonPlantableAreas: {
        polygonAlpha: 0,
        outlineWidth: 2,
        selectedOutlineWidth: 10,
        outlineColor: Cesium.Color.RED
    }
};

// NPA category colors
const npaCategoryColors = [
    '#FF6B6B', // Red
    '#4ECDC4', // Teal
    '#45B7D1', // Blue
    '#96CEB4', // Green
    '#FECA57', // Yellow
    '#DDA0DD', // Plum
    '#FFA500', // Orange
    '#98D8C8', // Mint
    '#F7DC6F', // Light Yellow
    '#BB8FCE'  // Purple
];

// PA (plantable area) colors - different palette
const paCategoryColors = [
    '#00FF00', // Lime
    '#00CED1', // Dark Turquoise
    '#FFD700', // Gold
    '#FF69B4', // Hot Pink
    '#8A2BE2', // Blue Violet
    '#00FA9A', // Medium Spring Green
    '#FF4500', // Orange Red
    '#1E90FF', // Dodger Blue
    '#ADFF2F', // Green Yellow
    '#FF1493', // Deep Pink
    '#00FFFF', // Cyan
    '#FF00FF', // Magenta
    '#7FFF00', // Chartreuse
    '#DC143C', // Crimson
    '#00BFFF'  // Deep Sky Blue
];

/**
 * Initializes the layer control system
 */
function initializeLayerControls() {
    console.log('Initializing layer controls...');
    
    const layerControls = document.getElementById('layerControls');
    if (!layerControls) {
        console.error('Layer controls element not found!');
        return;
    }
    
    // Prevent duplicate initialization
    if (layerControls.dataset.initialized === 'true') {
        console.log('Layer controls already initialized, skipping...');
        return;
    }
    layerControls.dataset.initialized = 'true';
    
    // Initialize layer state if not already initialized
    if (!window.layerState) {
        window.layerState = {
            showPlantableAreas: true,
            showEcologicalMetrics: false,
            selectedMetric: null,
            showNonPlantableAreas: false,
            selectedPA: null,
            selectedNPA: null,
            npaCategories: new Map(),
            paCategories: new Map(),
            categorizedPAs: new Map()
        };
    }
    
    // Set up controls and initialize state after a brief delay to ensure DOM is ready
    setTimeout(() => {
        console.log('Layer controls initialization - currentSiteData:', window.currentSiteData);
        // First, analyze the data if Boyd format
        if (window.currentSiteData) {
            console.log('Checking format of first feature:', window.currentSiteData.features[0]);
            const format = detectGeoJsonFormat(window.currentSiteData.features[0]);
            console.log('Detected format:', format);
            if (format === 'boyd') {
                document.getElementById('layerControls').style.display = 'block';
                console.log('Analyzing Boyd format data...');
                analyzeNPACategories(window.currentSiteData);
                analyzePACategories(window.currentSiteData);
            }
        } else {
            console.log('No currentSiteData available during initialization');
        }
        
        // Then set up the controls
        setupPlantableAreaControls();
        setupNonPlantableAreaControls();
        setupEcologicalMetricsControls();
        
        // Finally, set initial state for plantable areas
        const plantableToggle = document.getElementById('plantableAreasToggle');
        const plantableSubOptions = document.getElementById('plantableSubOptions');
        if (plantableToggle && plantableSubOptions) {
            plantableToggle.classList.add('expanded');
            plantableSubOptions.style.display = 'block';
            window.layerState.showPlantableAreas = true;
            window.layerState.selectedPA = null; // null means "All"
            
            // Check the "All" radio button if it exists
            const allRadio = document.querySelector('input[name="plantableArea"][value="all"]');
            if (allRadio) {
                allRadio.checked = true;
            }
        }
        
        // Trigger initial visualization
        if (window.currentSiteData) {
            updateVisualization();
        }
    }, 100);
}

/**
 * Sets up plantable area controls
 */
function setupPlantableAreaControls() {
    const plantableToggle = document.getElementById('plantableAreasToggle');
    const plantableSubOptions = document.getElementById('plantableSubOptions');
    
    if (!plantableToggle || !plantableSubOptions) {
        console.error('Plantable area controls not found in DOM');
        return;
    }
    
    // Remove any existing listeners first by cloning
    const newToggle = plantableToggle.cloneNode(true);
    plantableToggle.parentNode.replaceChild(newToggle, plantableToggle);
    
    // Re-get the plantableSubOptions reference since the DOM structure might have changed
    const updatedSubOptions = document.getElementById('plantableSubOptions');
    
    // Toggle expand/collapse
    newToggle.addEventListener('click', function(e) {
        e.stopPropagation();
        console.log('Plantable Areas toggle clicked');
        const isExpanded = updatedSubOptions.style.display === 'block';
        console.log('Current expanded state:', isExpanded);
        
        updatedSubOptions.style.display = isExpanded ? 'none' : 'block';
        this.classList.toggle('expanded', !isExpanded);
        
        if (!isExpanded) {
            // Opening dropdown - show all plantable areas by default
            window.layerState.showPlantableAreas = true;
            window.layerState.selectedPA = null;
            
            // Deselect ecological metrics
            if (window.layerState.showEcologicalMetrics) {
                window.layerState.showEcologicalMetrics = false;
                window.layerState.selectedMetric = null;
                document.querySelectorAll('input[name="metric"]').forEach(r => r.checked = false);
            }
            
            // Reset any selected radio
            document.querySelectorAll('input[name="plantableArea"]').forEach(r => r.checked = false);
        } else {
            // Closing dropdown - hide plantable areas only if no specific PA is selected
            if (!window.layerState.selectedPA) {
                window.layerState.showPlantableAreas = false;
            }
        }
        
        // Small delay to ensure state is properly set
        setTimeout(() => updateVisualization(), 50);
    });
}

/**
 * Sets up non-plantable area controls
 */
function setupNonPlantableAreaControls() {
    const nonPlantableToggle = document.getElementById('nonPlantableAreasToggle');
    const nonPlantableSubOptions = document.getElementById('nonPlantableSubOptions');
    
    if (!nonPlantableToggle || !nonPlantableSubOptions) {
        console.error('Non-plantable area controls not found in DOM');
        return;
    }
    
    // Remove any existing listeners first by cloning
    const newToggle = nonPlantableToggle.cloneNode(true);
    nonPlantableToggle.parentNode.replaceChild(newToggle, nonPlantableToggle);
    
    // Re-get the nonPlantableSubOptions reference since the DOM structure might have changed
    const updatedSubOptions = document.getElementById('nonPlantableSubOptions');
    
    // Toggle expand/collapse
    newToggle.addEventListener('click', function(e) {
        e.stopPropagation();
        console.log('Non-Plantable Areas toggle clicked');
        const isExpanded = updatedSubOptions.style.display === 'block';
        console.log('Current expanded state:', isExpanded);
        
        updatedSubOptions.style.display = isExpanded ? 'none' : 'block';
        this.classList.toggle('expanded', !isExpanded);
        
        if (!isExpanded) {
            // Opening dropdown - show all non-plantable areas by default
            window.layerState.showNonPlantableAreas = true;
            window.layerState.selectedNPA = null;
            
            // Deselect ecological metrics
            if (window.layerState.showEcologicalMetrics) {
                window.layerState.showEcologicalMetrics = false;
                window.layerState.selectedMetric = null;
                document.querySelectorAll('input[name="metric"]').forEach(r => r.checked = false);
            }
            
            // Reset any selected radio
            document.querySelectorAll('input[name="nonPlantableArea"]').forEach(r => r.checked = false);
        } else {
            // Closing dropdown - hide non-plantable areas only if no specific NPA is selected
            if (!window.layerState.selectedNPA) {
                window.layerState.showNonPlantableAreas = false;
            }
        }
        
        // Small delay to ensure state is properly set
        setTimeout(() => updateVisualization(), 50);
    });
}

/**
 * Sets up ecological metrics controls
 */
function setupEcologicalMetricsControls() {
    const ecologicalToggle = document.getElementById('ecologicalMetricsToggle');
    const metricsOptions = document.getElementById('metricsOptions');
    
    if (!ecologicalToggle || !metricsOptions) {
        console.error('Ecological metrics controls not found in DOM');
        return;
    }
    
    // Remove any existing listeners first
    const newToggle = ecologicalToggle.cloneNode(true);
    ecologicalToggle.parentNode.replaceChild(newToggle, ecologicalToggle);
    
    // Toggle expand/collapse
    newToggle.addEventListener('click', function(e) {
        e.stopPropagation();
        const isExpanded = metricsOptions.style.display === 'block';
        metricsOptions.style.display = isExpanded ? 'none' : 'block';
        newToggle.classList.toggle('expanded', !isExpanded);
    });
    
    // Metric radio buttons
    document.querySelectorAll('input[name="metric"]').forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.checked) {
                window.layerState.selectedMetric = this.value;
                window.layerState.showEcologicalMetrics = true;
                
                // Deselect all PA and NPA selections
                window.layerState.selectedPA = null;
                window.layerState.selectedNPA = null;
                window.layerState.showPlantableAreas = false;
                window.layerState.showNonPlantableAreas = false;
                
                // Update UI to reflect deselection
                const allPARadio = document.querySelector('input[name="plantableArea"][value="all"]');
                if (allPARadio) allPARadio.click();
                const allNPARadio = document.querySelector('input[name="nonPlantableArea"][value="all"]');
                if (allNPARadio) allNPARadio.click();
                
                updateVisualization();
            }
        });
    });
}

/**
 * Analyzes GeoJSON to extract PA categories
 */
function analyzePACategories(geoJsonData) {
    console.log('analyzePACategories called with', geoJsonData?.features?.length, 'features');
    const categories = new Map();
    const categorizedPAs = new Map(); // Map of category -> array of PAs
    
    geoJsonData.features.forEach(feature => {
        if (feature.properties.name && feature.properties.name.includes('PA') && !feature.properties.name.includes('NPA')) {
            console.log('Found PA feature:', feature.properties.name);
            const parsed = parseBoydName(feature.properties.name);
            const name = parsed.description || parsed.id;
            if (name && !categories.has(name)) {
                categories.set(name, {
                    number: parsed.number,
                    category: categorizePADescription(parsed.description)
                });
            }
        }
    });
    
    console.log('Found', categories.size, 'PA categories');
    
    // Group by category
    categories.forEach((data, name) => {
        const category = data.category;
        if (!categorizedPAs.has(category)) {
            categorizedPAs.set(category, []);
        }
        categorizedPAs.get(category).push({ name, data });
    });
    
    // Sort PAs within each category by number
    categorizedPAs.forEach((pas, category) => {
        pas.sort((a, b) => a.data.number - b.data.number);
    });
    
    window.layerState.paCategories = categories;
    window.layerState.categorizedPAs = categorizedPAs;
    console.log('Calling populatePACategories with', categories.size, 'categories');
    populatePACategories(categories, categorizedPAs);
}

/**
 * Populates PA category checkboxes
 */
function populatePACategories(categories, categorizedPAs) {
    console.log('populatePACategories called with', categories.size, 'categories');
    const container = document.getElementById('plantableSubOptions');
    if (!container) {
        console.error('plantableSubOptions container not found!');
        return;
    }
    container.innerHTML = '';
    
    // Define category order
    const categoryOrder = [
        'Foundations',
        'Perimeter Areas',
        'Forested & Semi-Forested',
        'Garden & Landscaped Areas',
        'Other Areas'
    ];
    
    let paIndex = 1; // Start numbering from 1
    
    // Create groups for each category
    categoryOrder.forEach(categoryName => {
        if (!categorizedPAs.has(categoryName)) return;
        
        const group = document.createElement('div');
        group.className = 'pa-category-group';
        
        const title = document.createElement('div');
        title.className = 'pa-category-group-title';
        title.textContent = categoryName;
        group.appendChild(title);
        
        const pas = categorizedPAs.get(categoryName);
        pas.forEach(({ name, data }) => {
            const label = document.createElement('label');
            label.className = 'pa-category';
            
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'plantableArea';
            radio.value = name;
            
            // No need for hidden radio anymore since we have "All" option
            
            const number = document.createElement('span');
            number.className = 'pa-number';
            number.textContent = `#${paIndex}`;
            paIndex++;
            
            const text = document.createElement('span');
            text.textContent = name;
            text.title = name; // Show full text on hover if truncated
            
            label.appendChild(radio);
            label.appendChild(number);
            label.appendChild(text);
            
            radio.addEventListener('change', function() {
                if (this.checked) {
                    window.layerState.selectedPA = name;
                    window.layerState.showPlantableAreas = true;
                    
                    // Deselect ecological metrics and NPAs
                    if (window.layerState.showEcologicalMetrics) {
                        window.layerState.showEcologicalMetrics = false;
                        window.layerState.selectedMetric = null;
                        document.querySelectorAll('input[name="metric"]').forEach(r => r.checked = false);
                    }
                    
                    // Deselect any NPA
                    if (window.layerState.selectedNPA) {
                        window.layerState.selectedNPA = null;
                        window.layerState.showNonPlantableAreas = false;
                        document.querySelectorAll('input[name="nonPlantableArea"]').forEach(r => r.checked = false);
                    }
                    
                    updateVisualization();
                    // Zoom to the selected PA
                    zoomToFeature(name, 'PA');
                }
            });
            
            group.appendChild(label);
        });
        
        container.appendChild(group);
    });
}

/**
 * Analyzes GeoJSON to extract NPA categories
 */
function analyzeNPACategories(geoJsonData) {
    console.log('analyzeNPACategories called with', geoJsonData?.features?.length, 'features');
    const categories = new Map();
    
    geoJsonData.features.forEach(feature => {
        if (feature.properties.name && feature.properties.name.includes('NPA')) {
            console.log('Found NPA feature:', feature.properties.name);
            const category = extractNPACategory(feature.properties.name);
            console.log('Extracted category:', category);
            if (category && !categories.has(category)) {
                categories.set(category, npaCategoryColors[categories.size % npaCategoryColors.length]);
            }
        }
    });
    
    console.log('Found', categories.size, 'NPA categories');
    window.layerState.npaCategories = categories;
    populateNPACategories(categories);
}

/**
 * Parses Boyd format name to extract ID and description
 * @param {string} name - Feature name like 'PA1="Southeast Front Door Entrance"'
 * @returns {Object} - {id, description, number}
 */
function parseBoydName(name) {
    // Extract PA/NPA number and description
    const match = name.match(/((?:N)?PA)(\d+)(?:=\"([^\"]+)\")?/);
    if (match) {
        const prefix = match[1];
        const number = match[2];
        let description = match[3] || '';
        
        // Special case: rename "Unknown" to "Southeast Driveway Entrance"
        if (!description || description === 'Unknown') {
            description = 'Southeast Driveway Entrance';
        }
        
        return {
            id: `${prefix}${number}`,
            description: description,
            number: parseInt(number)
        };
    }
    return { id: name, description: 'Southeast Driveway Entrance', number: 0 };
}

/**
 * Categorizes plantable areas based on their descriptions
 * @param {string} description - PA description
 * @returns {string} - Category name
 */
function categorizePADescription(description) {
    const desc = description.toLowerCase();
    
    // Forested & Semi-Forested
    if (desc.includes('forest') || desc.includes('tree') || desc.includes('canopy') || 
        desc.includes('woods') || desc.includes('grove')) {
        return 'Forested & Semi-Forested';
    }
    
    // Foundations - includes building-related areas and specific locations
    if (desc.includes('foundation') || desc.includes('building') || desc.includes('house') || 
        desc.includes('structure') || desc.includes('wall') || desc.includes('door') || 
        desc.includes('entrance') || desc.includes('window') || desc.includes('northside') ||
        desc.includes('southside') || desc.includes('pool') || desc.includes('backyard')) {
        return 'Foundations';
    }
    
    // Perimeter Areas
    if (desc.includes('perimeter') || desc.includes('boundary') || desc.includes('edge') || 
        desc.includes('fence') || desc.includes('property line') || desc.includes('border')) {
        return 'Perimeter Areas';
    }
    
    // Garden & Landscaped Areas - now includes lawn areas
    if (desc.includes('garden') || desc.includes('bed') || desc.includes('planting') || 
        desc.includes('landscape') || desc.includes('ornamental') || desc.includes('lawn') || 
        desc.includes('grass') || desc.includes('turf')) {
        return 'Garden & Landscaped Areas';
    }
    
    // Default - includes driveway areas and other uncategorized areas
    return 'Other Areas';
}

/**
 * Extracts NPA category from name
 */
function extractNPACategory(name) {
    // Parse names like "NPA7='Utilities'" or "NPA15_Tree"
    const match = name.match(/NPA\d+[=_]['"]?([^'"]+)['"]?/);
    if (match) {
        let category = match[1];
        // Clean up category name
        category = category
            .replace(/_/g, ' ')
            .replace(/([A-Z])/g, ' $1')
            .trim();
        return category;
    }
    return null;
}

/**
 * Populates NPA category radio buttons
 */
function populateNPACategories(categories) {
    const container = document.getElementById('nonPlantableSubOptions');
    container.innerHTML = '';
    
    let npaIndex = 1;
    categories.forEach((metadata, category) => {
        const label = document.createElement('label');
        label.className = 'npa-category';
        
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'nonPlantableArea';
        radio.value = category;
        
        const number = document.createElement('span');
        number.className = 'pa-number';
        number.textContent = `#${npaIndex}`;
        npaIndex++;
        
        const text = document.createElement('span');
        text.textContent = category;
        
        label.appendChild(radio);
        label.appendChild(number);
        label.appendChild(text);
        
        radio.addEventListener('change', function() {
            if (this.checked) {
                window.layerState.selectedNPA = category;
                window.layerState.showNonPlantableAreas = true;
                
                // Deselect ecological metrics and PAs
                if (window.layerState.showEcologicalMetrics) {
                    window.layerState.showEcologicalMetrics = false;
                    window.layerState.selectedMetric = null;
                    document.querySelectorAll('input[name="metric"]').forEach(r => r.checked = false);
                }
                
                // Deselect any PA
                if (window.layerState.selectedPA) {
                    window.layerState.selectedPA = null;
                    window.layerState.showPlantableAreas = false;
                    document.querySelectorAll('input[name="plantableArea"]').forEach(r => r.checked = false);
                }
                
                updateVisualization();
                // Zoom to all features in this NPA category
                zoomToNPACategory(category);
            }
        });
        
        container.appendChild(label);
    });
}

/**
 * Updates visualization based on current layer state
 */
function updateVisualization() {
    // Apply appropriate settings based on active layers
    if (window.layerState.showEcologicalMetrics && window.layerState.selectedMetric) {
        // Use ecological metrics settings
        window.currentParameterFilter = window.layerState.selectedMetric;
        // Force show plantable areas for metrics visualization
        window.layerState.temporaryShowPlantable = true;
    } else {
        window.currentParameterFilter = null;
        window.layerState.temporaryShowPlantable = false;
    }
    
    // Re-visualize with current settings
    if (window.currentSiteData) {
        visualizeGeoJsonPolygonsWithLayers(window.currentSiteData);
    }
}

/**
 * Custom visualization function that respects layer settings
 */
function visualizeGeoJsonPolygonsWithLayers(geoJsonData) {
    if (!window.map3D || !window.map3D.viewer) {
        console.error('Cesium viewer not available');
        return;
    }
    
    const viewer = window.map3D.viewer;
    
    // Clear existing entities
    const entitiesToRemove = [];
    viewer.entities.values.forEach(entity => {
        if (entity.name && (entity.name.startsWith('Site_') || 
            entity.name.includes('PA') || 
            entity.name.includes('NPA') ||
            entity.polygon || 
            entity.point)) {
            entitiesToRemove.push(entity);
        }
    });
    
    entitiesToRemove.forEach(entity => {
        viewer.entities.remove(entity);
    });
    
    // Call the original visualization function
    window.visualizeGeoJsonPolygons(geoJsonData);
}

/**
 * Updates the old parameter filter system to work with new layer controls
 */
function toggleParameterFilter(format) {
    console.log('toggleParameterFilter called with format:', format);
    const layerControls = document.getElementById('layerControls');
    
    if (format === 'boyd') {
        layerControls.style.display = 'block';
        // Analyze PA and NPA categories for this site
        if (window.currentSiteData) {
            console.log('Analyzing site data in toggleParameterFilter...');
            analyzePACategories(window.currentSiteData);
            analyzeNPACategories(window.currentSiteData);
        } else {
            console.log('No currentSiteData available in toggleParameterFilter');
        }
        
        // Ensure plantable areas checkbox is checked
        const plantableToggle = document.getElementById('plantableAreasToggle');
        if (plantableToggle && !plantableToggle.checked) {
            plantableToggle.checked = true;
            document.getElementById('plantableSubOptions').style.display = 'block';
        }
    } else {
        layerControls.style.display = 'none';
        // Reset layer state
        window.layerState = {
            showPlantableAreas: false,
            showEcologicalMetrics: false,
            selectedMetric: null,
            showNonPlantableAreas: false,
            selectedNPACategories: new Set(),
            npaCategories: new Map()
        };
    }
}

/**
 * Zooms camera to a specific feature
 * @param {string} featureName - Name of the feature to zoom to
 * @param {string} featureType - 'PA' or 'NPA'
 */
function zoomToFeature(featureName, featureType) {
    if (!window.map3D || !window.map3D.viewer || !window.currentSiteData) {
        return;
    }
    
    const viewer = window.map3D.viewer;
    
    // Find the feature in the GeoJSON data
    const feature = window.currentSiteData.features.find(f => {
        if (!f.properties.name) return false;
        const parsed = parseBoydName(f.properties.name);
        const name = parsed.description || parsed.id;
        return name === featureName;
    });
    
    if (!feature || feature.geometry.type !== 'Polygon') {
        return;
    }
    
    // Calculate bounds of the polygon
    let minLat = 90, maxLat = -90;
    let minLng = 180, maxLng = -180;
    
    feature.geometry.coordinates[0].forEach(coord => {
        const [lng, lat] = coord;
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
    });
    
    // Calculate center
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    
    // Calculate the span in meters
    const latSpan = (maxLat - minLat) * 111320; // Approximate meters per degree latitude
    const lonSpan = (maxLng - minLng) * 111320 * Math.cos(centerLat * Math.PI / 180);
    
    // Get the viewport aspect ratio
    const aspectRatio = viewer.canvas.width / viewer.canvas.height;
    
    // Calculate height based on vertical constraint (50% of screen height)
    const fov = viewer.camera.frustum.fov;
    const verticalHeight = (latSpan * 2) / Math.tan(fov / 2); // *2 for 50% vertical
    
    // Check if horizontal span would exceed screen width at this height
    const horizontalFOV = 2 * Math.atan(Math.tan(fov / 2) * aspectRatio);
    const maxHorizontalSpan = 2 * verticalHeight * Math.tan(horizontalFOV / 2);
    
    // If horizontal span would exceed screen width, adjust height based on horizontal constraint
    let height = verticalHeight;
    if (lonSpan > maxHorizontalSpan) {
        height = lonSpan / (2 * Math.tan(horizontalFOV / 2));
    }
    
    // Add 20% padding for better framing
    height = height * 1.2;
    
    // Apply minimum height constraint
    const minHeight = 30; // 30 meters minimum
    height = Math.max(height, minHeight);
    
    // Animate to position with camera facing straight down
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(centerLng, centerLat, height),
        orientation: {
            heading: 0.0,  // North
            pitch: -Math.PI / 2,  // Looking straight down
            roll: 0.0
        },
        duration: 1.5,
        easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT
    });
}

/**
 * Zooms camera to all features in an NPA category
 * @param {string} categoryName - Name of the NPA category to zoom to
 */
function zoomToNPACategory(categoryName) {
    if (!window.map3D || !window.map3D.viewer || !window.currentSiteData) {
        return;
    }
    
    const viewer = window.map3D.viewer;
    
    // Find all features that belong to this NPA category
    const npaFeatures = window.currentSiteData.features.filter(f => {
        if (!f.properties.name || !f.properties.name.includes('NPA')) return false;
        const category = extractNPACategory(f.properties.name);
        return category === categoryName;
    });
    
    if (npaFeatures.length === 0) {
        console.log('No features found for NPA category:', categoryName);
        return;
    }
    
    // Calculate bounds of all NPAs in this category
    let minLat = 90, maxLat = -90;
    let minLng = 180, maxLng = -180;
    
    npaFeatures.forEach(feature => {
        if (feature.geometry.type === 'Polygon') {
            feature.geometry.coordinates[0].forEach(coord => {
                const [lng, lat] = coord;
                minLat = Math.min(minLat, lat);
                maxLat = Math.max(maxLat, lat);
                minLng = Math.min(minLng, lng);
                maxLng = Math.max(maxLng, lng);
            });
        }
    });
    
    // Calculate center
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    
    // Calculate the span in meters
    const latSpan = (maxLat - minLat) * 111320; // Approximate meters per degree latitude
    const lonSpan = (maxLng - minLng) * 111320 * Math.cos(centerLat * Math.PI / 180);
    
    // Get the viewport aspect ratio
    const aspectRatio = viewer.canvas.width / viewer.canvas.height;
    
    // Calculate height based on vertical constraint (50% of screen height)
    const fov = viewer.camera.frustum.fov;
    const verticalHeight = (latSpan * 2) / Math.tan(fov / 2); // *2 for 50% vertical
    
    // Check if horizontal span would exceed screen width at this height
    const horizontalFOV = 2 * Math.atan(Math.tan(fov / 2) * aspectRatio);
    const maxHorizontalSpan = 2 * verticalHeight * Math.tan(horizontalFOV / 2);
    
    // If horizontal span would exceed screen width, adjust height based on horizontal constraint
    let height = verticalHeight;
    if (lonSpan > maxHorizontalSpan) {
        height = lonSpan / (2 * Math.tan(horizontalFOV / 2));
    }
    
    // Add 20% padding for better framing
    height = height * 1.2;
    
    // Apply minimum height constraint
    const minHeight = 30; // 30 meters minimum
    height = Math.max(height, minHeight);
    
    // Animate to position with camera facing straight down
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(centerLng, centerLat, height),
        orientation: {
            heading: 0.0,  // North
            pitch: -Math.PI / 2,  // Looking straight down
            roll: 0.0
        },
        duration: 1.5,
        easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT
    });
}

// Override the original toggleParameterFilter
window.toggleParameterFilter = toggleParameterFilter;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeLayerControls);
} else {
    initializeLayerControls();
}

// Expose functions globally
window.initializeLayerControls = initializeLayerControls;
window.updateVisualization = updateVisualization;
window.visualizeGeoJsonPolygonsWithLayers = visualizeGeoJsonPolygonsWithLayers;
window.layerSettings = layerSettings;
window.parseBoydName = parseBoydName;
window.extractNPACategory = extractNPACategory;