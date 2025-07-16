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
 * Closes other dropdowns and any focus views
 * @param {string} currentDropdown - The dropdown being opened ('plantable', 'nonplantable', 'metrics')
 */
function closeOtherDropdowns(currentDropdown) {
    // Close plantable areas if not current
    if (currentDropdown !== 'plantable') {
        const plantableToggle = document.getElementById('plantableAreasToggle');
        const plantableSubOptions = document.getElementById('plantableSubOptions');
        if (plantableToggle && plantableSubOptions) {
            plantableSubOptions.style.display = 'none';
            plantableToggle.classList.remove('expanded');
            
            // Clear any focus view and connection
            if (window.clearPAConnection) {
                window.clearPAConnection();
            }
            
            // Reset plantable state if no specific PA selected
            if (!window.layerState.selectedPA) {
                window.layerState.showPlantableAreas = false;
            }
        }
    }
    
    // Close non-plantable areas if not current
    if (currentDropdown !== 'nonplantable') {
        const nonPlantableToggle = document.getElementById('nonPlantableAreasToggle');
        const nonPlantableSubOptions = document.getElementById('nonPlantableSubOptions');
        if (nonPlantableToggle && nonPlantableSubOptions) {
            nonPlantableSubOptions.style.display = 'none';
            nonPlantableToggle.classList.remove('expanded');
            
            // Reset non-plantable state if no specific NPA selected
            if (!window.layerState.selectedNPA) {
                window.layerState.showNonPlantableAreas = false;
            }
        }
    }
    
    // Close ecological metrics if not current
    if (currentDropdown !== 'metrics') {
        const ecologicalToggle = document.getElementById('ecologicalMetricsToggle');
        const metricsOptions = document.getElementById('metricsOptions');
        if (ecologicalToggle && metricsOptions) {
            metricsOptions.style.display = 'none';
            ecologicalToggle.classList.remove('expanded');
            
            // Reset metrics state
            if (window.layerState.showEcologicalMetrics) {
                window.layerState.showEcologicalMetrics = false;
                window.layerState.selectedMetric = null;
                document.querySelectorAll('input[name="metric"]').forEach(r => r.checked = false);
            }
        }
    }
}

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
        
        if (!isExpanded) {
            // Opening dropdown - close other dropdowns first
            closeOtherDropdowns('plantable');
            
            // Show this dropdown
            updatedSubOptions.style.display = 'block';
            this.classList.add('expanded');
            
            // Show all plantable areas by default
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
            // Closing dropdown
            updatedSubOptions.style.display = 'none';
            this.classList.remove('expanded');
            
            // Hide plantable areas only if no specific PA is selected
            if (!window.layerState.selectedPA) {
                window.layerState.showPlantableAreas = false;
            }
            // Hide focus panel and clear connection when closing dropdown
            if (window.clearPAConnection) {
                window.clearPAConnection();
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
        
        if (!isExpanded) {
            // Opening dropdown - close other dropdowns first
            closeOtherDropdowns('nonplantable');
            
            // Show this dropdown
            updatedSubOptions.style.display = 'block';
            this.classList.add('expanded');
            
            // Show all non-plantable areas by default
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
            // Closing dropdown
            updatedSubOptions.style.display = 'none';
            this.classList.remove('expanded');
            
            // Hide non-plantable areas only if no specific NPA is selected
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
        
        if (!isExpanded) {
            // Opening dropdown - close other dropdowns first
            closeOtherDropdowns('metrics');
            
            // Show this dropdown
            metricsOptions.style.display = 'block';
            newToggle.classList.add('expanded');
        } else {
            // Closing dropdown
            metricsOptions.style.display = 'none';
            newToggle.classList.remove('expanded');
        }
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
                    
                    // Orchestrate the focus panel animation sequence
                    if (window.focusPanel && window.currentSiteData) {
                        const paFeature = window.currentSiteData.features.find(f => {
                            const parsed = parseBoydName(f.properties.name);
                            return (parsed.description || parsed.id) === name;
                        });
                        if (paFeature) {
                            // Update highlighting is now done inside the animation
                            updateSelectedPAHighlight(name);
                            orchestrateFocusAnimation(label, name, paFeature);
                        }
                    }
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
    // Handle both single and double quotes
    const match = name.match(/((?:N)?PA)(\d+)(?:=[\"']([^\"']+)[\"'])?/);
    if (match) {
        const prefix = match[1];
        const number = match[2];
        let description = match[3] || '';
        
        // If no description in quotes, check if there's an equals sign without quotes
        if (!description && name.includes('=')) {
            const parts = name.split('=');
            if (parts.length > 1) {
                description = parts[1].trim();
            }
        }
        
        // If still no description, use the full name
        if (!description) {
            description = name;
        }
        
        return {
            id: `${prefix}${number}`,
            description: description,
            number: parseInt(number)
        };
    }
    
    // For names that don't match the pattern (like "Southeast Front Door Entrance"),
    // return the name as both id and description
    return { id: name, description: name, number: 0 };
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
    
    // Calculate polygon center
    let sumLat = 0, sumLng = 0;
    const coords = feature.geometry.coordinates[0];
    coords.forEach(coord => {
        const [lng, lat] = coord;
        sumLat += lat;
        sumLng += lng;
    });
    const centerLat = sumLat / coords.length;
    const centerLng = sumLng / coords.length;
    
    // Calculate maximum distance between any two vertices (radius)
    let maxDistance = 0;
    for (let i = 0; i < coords.length; i++) {
        for (let j = i + 1; j < coords.length; j++) {
            const [lng1, lat1] = coords[i];
            const [lng2, lat2] = coords[j];
            
            // Haversine formula for distance between two points
            const R = 6371000; // Earth's radius in meters
            const φ1 = lat1 * Math.PI / 180;
            const φ2 = lat2 * Math.PI / 180;
            const Δφ = (lat2 - lat1) * Math.PI / 180;
            const Δλ = (lng2 - lng1) * Math.PI / 180;
            
            const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                      Math.cos(φ1) * Math.cos(φ2) *
                      Math.sin(Δλ/2) * Math.sin(Δλ/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            const distance = R * c;
            
            maxDistance = Math.max(maxDistance, distance);
        }
    }
    const radius = maxDistance / 2;
    
    // Calculate height where radius appears as 50% of screen height
    const fov = viewer.camera.frustum.fov; // Vertical FOV in radians
    const targetCoverage = 0.5; // 50% of screen height
    const height = radius / (targetCoverage * Math.tan(fov / 2));
    
    // Apply minimum height constraint
    const minHeight = 100; // 100 meters minimum
    const finalHeight = Math.max(height, minHeight);
    
    console.log('Camera positioning:', {
        center: { lat: centerLat, lng: centerLng },
        radius: radius,
        calculatedHeight: height,
        finalHeight: finalHeight
    });
    
    // Animate to position with camera facing straight down
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(centerLng, centerLat, finalHeight),
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
    
    // Calculate combined polygon center (average of all vertices)
    let sumLat = 0, sumLng = 0, vertexCount = 0;
    const allCoords = [];
    
    npaFeatures.forEach(feature => {
        if (feature.geometry.type === 'Polygon') {
            feature.geometry.coordinates[0].forEach(coord => {
                const [lng, lat] = coord;
                sumLat += lat;
                sumLng += lng;
                vertexCount++;
                allCoords.push(coord);
            });
        }
    });
    
    const centerLat = sumLat / vertexCount;
    const centerLng = sumLng / vertexCount;
    
    // Calculate maximum distance between any two vertices (radius)
    let maxDistance = 0;
    for (let i = 0; i < allCoords.length; i++) {
        for (let j = i + 1; j < allCoords.length; j++) {
            const [lng1, lat1] = allCoords[i];
            const [lng2, lat2] = allCoords[j];
            
            // Haversine formula for distance between two points
            const R = 6371000; // Earth's radius in meters
            const φ1 = lat1 * Math.PI / 180;
            const φ2 = lat2 * Math.PI / 180;
            const Δφ = (lat2 - lat1) * Math.PI / 180;
            const Δλ = (lng2 - lng1) * Math.PI / 180;
            
            const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                      Math.cos(φ1) * Math.cos(φ2) *
                      Math.sin(Δλ/2) * Math.sin(Δλ/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            const distance = R * c;
            
            maxDistance = Math.max(maxDistance, distance);
        }
    }
    const radius = maxDistance / 2;
    
    // Calculate height where radius appears as 50% of screen height
    const fov = viewer.camera.frustum.fov; // Vertical FOV in radians
    const targetCoverage = 0.5; // 50% of screen height
    const height = radius / (targetCoverage * Math.tan(fov / 2));
    
    // Apply minimum height constraint
    const minHeight = 100; // 100 meters minimum
    const finalHeight = Math.max(height, minHeight);
    
    console.log('NPA Camera positioning:', {
        category: categoryName,
        center: { lat: centerLat, lng: centerLng },
        radius: radius,
        calculatedHeight: height,
        finalHeight: finalHeight
    });
    
    // Animate to position with camera facing straight down
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(centerLng, centerLat, finalHeight),
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

/**
 * Updates the selected PA visual highlight
 * @param {string} selectedName - Name of selected PA
 */
function updateSelectedPAHighlight(selectedName) {
    // Remove previous selections and dynamic styles
    document.querySelectorAll('.pa-category.selected').forEach(el => {
        el.classList.remove('selected');
    });
    
    // Remove any existing dynamic style
    const existingStyle = document.getElementById('selected-pa-style');
    if (existingStyle) {
        existingStyle.remove();
    }
    
    // Add selection to current PA
    const labels = document.querySelectorAll('.pa-category');
    labels.forEach(label => {
        const radio = label.querySelector('input[type="radio"]');
        if (radio && radio.value === selectedName) {
            label.classList.add('selected');
            
            // Create dynamic style for the oval border positioning
            const rect = label.getBoundingClientRect();
            const style = document.createElement('style');
            style.id = 'selected-pa-style';
            style.textContent = `
                .pa-category.selected::before {
                    left: ${rect.left - 4}px;
                    top: ${rect.top - 4}px;
                    width: ${rect.width + 8}px;
                    height: ${rect.height + 8}px;
                }
            `;
            document.head.appendChild(style);
        }
    });
}

// Global state for animation management
let currentAnimationState = {
    selectedLabel: null,
    selectedPA: null,
    isAnimating: false,
    animationTimeline: null
};

/**
 * Orchestrates the complete focus panel animation sequence
 * @param {HTMLElement} label - The PA label that was clicked
 * @param {string} paName - The name of the PA
 * @param {Object} paFeature - The GeoJSON feature data
 */
function orchestrateFocusAnimation(label, paName, paFeature) {
    // If currently animating, queue this after current animation
    if (currentAnimationState.isAnimating) {
        // First reverse current animation
        reverseCurrentAnimation(() => {
            // Then start new animation
            startFocusAnimation(label, paName, paFeature);
        });
    } else if (currentAnimationState.selectedLabel && currentAnimationState.selectedLabel !== label) {
        // If different PA selected, reverse current then start new
        reverseCurrentAnimation(() => {
            startFocusAnimation(label, paName, paFeature);
        });
    } else {
        // Fresh start
        startFocusAnimation(label, paName, paFeature);
    }
}

/**
 * Starts the focus animation sequence
 */
function startFocusAnimation(label, paName, paFeature) {
    currentAnimationState.isAnimating = true;
    currentAnimationState.selectedLabel = label;
    currentAnimationState.selectedPA = paName;
    
    // Ensure the label has the selected class for the oval to appear
    label.classList.add('selected');
    
    // Wait for oval to render (CSS transition time)
    setTimeout(() => {
        // Phase 1: Extend connection line
        createAnimatedConnectionLine(label, () => {
            // Phase 2: Create vertical edge line
            createVerticalEdge(() => {
                // Phase 3: Expand edge to oval and reveal content
                expandToFocusPanel(paName, paFeature, () => {
                    currentAnimationState.isAnimating = false;
                });
            });
        });
    }, 100); // Small delay to ensure oval CSS has rendered
}

/**
 * Reverses the current animation
 */
function reverseCurrentAnimation(callback) {
    if (!currentAnimationState.selectedLabel) {
        if (callback) callback();
        return;
    }
    
    currentAnimationState.isAnimating = true;
    
    // Phase 1: Collapse focus panel to edge
    collapseFocusPanel(() => {
        // Phase 2: Collapse vertical edge
        collapseVerticalEdge(() => {
            // Phase 3: Retract connection line
            retractConnectionLine(() => {
                currentAnimationState.selectedLabel = null;
                currentAnimationState.selectedPA = null;
                currentAnimationState.isAnimating = false;
                if (callback) callback();
            });
        });
    });
}

/**
 * Creates animated connection line extending from PA label
 */
function createAnimatedConnectionLine(paLabel, callback) {
    const paRect = paLabel.getBoundingClientRect();
    const layerControlsPanel = document.getElementById('layerControls');
    const panelRect = layerControlsPanel.getBoundingClientRect();
    
    // The oval extends 4px outside the label bounds
    const ovalPadding = 4;
    const startY = paRect.top + paRect.height / 2;
    
    // The selected::before pseudo-element creates an oval that's 4px outside the PA label
    // For precise alignment, get the actual PA label position within the panel
    const labelOffsetFromPanel = paRect.left - panelRect.left;
    const ovalLeftEdge = paRect.left - ovalPadding;
    
    // Fixed connection line length - shorter for cleaner look
    const connectionLineLength = 40; // Reduced to 40px for better visual balance
    
    // Line position and dimensions
    const lineLeft = ovalLeftEdge - connectionLineLength;
    const lineWidth = connectionLineLength;
    
    // Create line element
    const line = document.createElement('div');
    line.className = 'connection-line animated';
    line.style.left = `${lineLeft}px`;
    line.style.top = `${startY - 1}px`; // Center on 2px height
    line.style.width = '0px';
    line.style.transition = 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    line.style.transformOrigin = 'right center'; // Grow from right edge (oval side)
    line.style.opacity = '1'; // Make sure it's visible
    line.style.background = 'white'; // Ensure white color
    line.style.height = '2px'; // Ensure height
    line.style.zIndex = '1002'; // Ensure it's above other elements
    
    document.body.appendChild(line);
    
    // Store reference for later phases
    currentAnimationState.connectionLine = line;
    currentAnimationState.lineEndX = lineLeft; // Where the line ends (left side)
    currentAnimationState.lineStartX = ovalLeftEdge; // Where the line starts (oval side)
    currentAnimationState.lineY = startY;
    
    console.log('Creating connection line:', {
        ovalLeftEdge,
        lineY: startY,
        lineLeft,
        lineWidth: connectionLineLength,
        lineEndX: lineLeft
    });
    
    // Animate line extension
    requestAnimationFrame(() => {
        line.style.width = `${lineWidth}px`;
        setTimeout(callback, 300);
    });
}

/**
 * Creates vertical edge at the end of connection line
 */
function createVerticalEdge(callback) {
    const edge = document.createElement('div');
    edge.className = 'focus-edge animated';
    edge.style.position = 'fixed';
    edge.style.left = `${currentAnimationState.lineEndX}px`; // Left end of connection line
    edge.style.top = `${currentAnimationState.lineY}px`;
    edge.style.width = '2px';
    edge.style.height = '0px';
    edge.style.background = 'white';
    edge.style.transition = 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1), top 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    edge.style.zIndex = '999';
    
    document.body.appendChild(edge);
    currentAnimationState.verticalEdge = edge;
    
    // Animate edge expansion (from center outward)
    requestAnimationFrame(() => {
        const targetHeight = window.innerHeight - 200; // 100px margins
        edge.style.height = `${targetHeight}px`;
        edge.style.top = '100px';
        setTimeout(callback, 300);
    });
}

/**
 * Expands vertical edge into full focus panel
 */
function expandToFocusPanel(paName, paFeature, callback) {
    // Remove the vertical edge
    if (currentAnimationState.verticalEdge) {
        currentAnimationState.verticalEdge.remove();
    }
    
    // Ensure focus panel exists (recreate if it was removed)
    if (!window.focusPanel.panel || !document.body.contains(window.focusPanel.panel)) {
        window.focusPanel.init();
    }
    
    // Get focus panel reference
    const panel = window.focusPanel.panel;
    
    // Temporarily remove visible class to prevent ghost appearance
    panel.classList.remove('visible');
    panel.classList.add('animating-in');
    
    // Position panel at the connection line end point
    // Panel width is 420px, so its right edge should be at lineEndX
    const panelWidth = 420;
    const panelLeft = currentAnimationState.lineEndX - panelWidth;
    
    // Hide panel initially to prevent position jump
    panel.style.visibility = 'hidden';
    panel.style.opacity = '1'; // Keep opacity for the scale animation
    
    // Override default CSS position temporarily
    panel.style.left = `${panelLeft}px`;
    panel.style.right = 'auto';
    panel.style.transform = 'scaleX(0)';
    panel.style.transformOrigin = 'right center';
    
    // Populate panel content without triggering visibility
    window.focusPanel.currentPA = paName;
    window.focusPanel.displayMetrics(paFeature);
    window.focusPanel.isVisible = true;
    
    // Update header
    const headerHTML = `
        <div>
            <h3 class="pa-name">${paName.toUpperCase()}</h3>
            <p class="pa-subtitle">Ecological Niche Metrics</p>
        </div>
        <button class="close-button" aria-label="Close panel">×</button>
    `;
    panel.querySelector('.focus-panel-header').innerHTML = headerHTML;
    
    // Re-attach close button listener to trigger full animation
    const closeBtn = panel.querySelector('.close-button');
    closeBtn.addEventListener('click', () => {
        if (window.clearPAConnection) {
            window.clearPAConnection();
        }
    });
    
    // Make panel visible and animate expansion in next frame
    requestAnimationFrame(() => {
        panel.style.visibility = 'visible';
        panel.classList.add('visible'); // Add visible class now that positioning is set
        panel.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
        
        requestAnimationFrame(() => {
            panel.style.transform = 'scaleX(1)';
        });
        
        setTimeout(() => {
            panel.classList.remove('animating-in');
            // Reset to default CSS positioning
            panel.style.left = '';
            panel.style.right = '';
            panel.style.transform = '';
            panel.style.transformOrigin = '';
            panel.style.transition = '';
            panel.style.visibility = '';
            if (callback) callback();
        }, 400);
    });
}

/**
 * Collapses focus panel back to edge
 */
function collapseFocusPanel(callback) {
    const panel = window.focusPanel.panel;
    if (!panel || (!panel.classList.contains('visible') && !panel.classList.contains('animating-in'))) {
        if (callback) callback();
        return;
    }
    
    // Remove visible class immediately to prevent ghost
    panel.classList.remove('visible');
    
    // Position panel at the connection line end point for collapse
    if (currentAnimationState.lineEndX) {
        const panelWidth = 420;
        const panelLeft = currentAnimationState.lineEndX - panelWidth;
        panel.style.left = `${panelLeft}px`;
        panel.style.right = 'auto';
    }
    
    panel.classList.add('animating-out');
    panel.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    panel.style.transformOrigin = 'right center';
    panel.style.transform = 'scaleX(0)';
    
    setTimeout(() => {
        // Call hide to update state
        window.focusPanel.hide();
        
        // Remove the panel element completely to prevent ghost
        if (panel && panel.parentNode) {
            panel.parentNode.removeChild(panel);
            window.focusPanel.panel = null; // Clear the reference
        }
        
        // Create vertical edge in its place
        createVerticalEdgeForCollapse(callback);
    }, 300);
}

/**
 * Creates vertical edge during collapse animation
 */
function createVerticalEdgeForCollapse(callback) {
    const edge = document.createElement('div');
    edge.className = 'focus-edge animated';
    edge.style.position = 'fixed';
    edge.style.left = `${currentAnimationState.lineEndX}px`; // Same position as expansion
    edge.style.top = '100px';
    edge.style.width = '2px';
    edge.style.height = `${window.innerHeight - 200}px`;
    edge.style.background = 'white';
    edge.style.transition = 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1), top 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    edge.style.zIndex = '999';
    
    document.body.appendChild(edge);
    
    // Animate collapse
    requestAnimationFrame(() => {
        edge.style.height = '0px';
        edge.style.top = `${currentAnimationState.lineY}px`;
        
        setTimeout(() => {
            edge.remove();
            if (callback) callback();
        }, 300);
    });
}

/**
 * Collapses vertical edge (called from reverseCurrentAnimation)
 */
function collapseVerticalEdge(callback) {
    // Since we create the edge during collapse, we just call the callback
    // The actual edge collapse happens in createVerticalEdgeForCollapse
    if (callback) callback();
}

/**
 * Retracts connection line
 */
function retractConnectionLine(callback) {
    const line = currentAnimationState.connectionLine;
    if (!line) {
        if (callback) callback();
        return;
    }
    
    line.style.transition = 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease';
    line.style.width = '0px';
    line.style.opacity = '0';
    
    setTimeout(() => {
        line.remove();
        currentAnimationState.connectionLine = null;
        
        // Clear PA selection highlight
        document.querySelectorAll('.pa-category.selected').forEach(el => {
            el.classList.remove('selected');
        });
        
        if (callback) callback();
    }, 300);
}

/**
 * Creates visual connection between selected PA and focus panel (simplified for non-animated use)
 */
function createPAConnection(paLabel) {
    // This function is now replaced by the animation orchestrator
    // Kept for backwards compatibility but does nothing
}

// Clean up connection when closing dropdown or deselecting
function clearPAConnection() {
    // Use the animation system if there's an active connection
    if (currentAnimationState.selectedLabel) {
        reverseCurrentAnimation();
    } else {
        // Fallback for direct cleanup
        const line = document.querySelector('.connection-line');
        if (line) {
            line.classList.remove('visible');
            setTimeout(() => line.remove(), 500);
        }
        
        // Remove selected class
        document.querySelectorAll('.pa-category.selected').forEach(el => {
            el.classList.remove('selected');
        });
    }
}

// Expose functions globally
window.initializeLayerControls = initializeLayerControls;
window.updateVisualization = updateVisualization;
window.visualizeGeoJsonPolygonsWithLayers = visualizeGeoJsonPolygonsWithLayers;
window.layerSettings = layerSettings;
window.parseBoydName = parseBoydName;
window.extractNPACategory = extractNPACategory;
window.updateSelectedPAHighlight = updateSelectedPAHighlight;
window.createPAConnection = createPAConnection;
window.clearPAConnection = clearPAConnection;
window.orchestrateFocusAnimation = orchestrateFocusAnimation;