/**
 * Site Data Manager
 * Handles site data loading, management, and navigation
 */

/**
 * Loads site data from GeoJSON files
 * @returns {Array} Array of site objects with bounds and GeoJSON data
 */
async function loadSiteData() {
    const sites = [];

    // Define the GeoJSON files to load
    const files = [
        { filename: 'plantable-area-data.geojson', name: 'Winter Garden Residence' }
    ];

    for (const file of files) {
        try {
            const dataUrl = window.TerrainConfig ?
                window.TerrainConfig.getDataUrl(`sites/demo-site/${file.filename}`) :
                `/data/sites/demo-site/${file.filename}`;
            const response = await fetch(dataUrl);
            const geoJsonData = await response.json();

            // Calculate bounds from the GeoJSON features
            const bounds = window.calculateBounds(geoJsonData);

            sites.push({
                name: file.name,
                filename: file.filename,
                bounds: bounds,
                geoJson: geoJsonData
            });
        } catch (error) {
            console.error(`Error loading ${file.filename}:`, error);
        }
    }

    return sites;
}

/**
 * Initializes the site selector dropdown
 */
async function initializeSiteSelector() {
    const siteDropdown = document.getElementById('siteDropdown');
    if (!siteDropdown) {
        console.error('Site dropdown not found');
        return;
    }

    // Load site data
    const sites = await loadSiteData();

    // Populate dropdown
    sites.forEach(site => {
        const option = document.createElement('option');
        option.value = site.filename;
        option.textContent = site.name;
        option.dataset.bounds = JSON.stringify(site.bounds);
        siteDropdown.appendChild(option);
    });

    // Set default selection to Winter Garden Residence
    const winterGardenOption = Array.from(siteDropdown.options).find(option =>
        option.textContent === 'Winter Garden Residence'
    );
    if (winterGardenOption) {
        siteDropdown.value = winterGardenOption.value;

        // Since this site uses ecological data format, show the layer controls immediately
        const layerControls = document.getElementById('layerControls');
        if (layerControls) {
            layerControls.style.display = 'block';
        }

        // Parse bounds and store data
        try {
            const bounds = JSON.parse(winterGardenOption.dataset.bounds);
            const winterGardenSite = sites.find(site => site.name === 'Winter Garden Residence');

            window.currentSiteData = winterGardenSite.geoJson;

            // Call navigateToSite without visualization
            navigateToSite(bounds, false);

            // Detect format and initialize parameter filter
            const geoJsonFormat = winterGardenSite.geoJson.features.length > 0 ?
                window.detectGeoJsonFormat(winterGardenSite.geoJson.features[0]) : 'legacy';

            // Initialize layer controls after site is loaded
            if (window.initializeLayerControls) {
                window.initializeLayerControls();
            }

            // Initialize layer controls to analyze PA/NPA categories
            if (window.initializeLayerControlsForSite) {
                window.initializeLayerControlsForSite(geoJsonFormat);
            } else {
                console.warn('⚠️ initializeLayerControlsForSite not available');
            }
        } catch (error) {
            console.error('Error parsing Winter Garden site bounds:', error);
        }
    }

    // Handle site selection changes
    siteDropdown.addEventListener('change', function(event) {
        const selectedOption = event.target.selectedOptions[0];
        if (selectedOption && selectedOption.dataset.bounds) {
            try {
                const bounds = JSON.parse(selectedOption.dataset.bounds);

                // Load and store the selected site's data
                loadSiteData().then(sites => {
                    const selectedSite = sites.find(site => site.filename === selectedOption.value);
                    if (selectedSite) {
                        // Store current site data globally
                        window.currentSiteData = selectedSite.geoJson;

                        const geoJsonFormat = selectedSite.geoJson.features.length > 0 ?
                            window.detectGeoJsonFormat(selectedSite.geoJson.features[0]) : 'legacy';

                        // Initialize layer controls based on format
                        if (window.initializeLayerControlsForSite) {
                            window.initializeLayerControlsForSite(geoJsonFormat);
                        }

                        // Load Gaussian Splat if available for this site
                        if (window.gaussianSplatManager) {
                            // Unload any existing splats first
                            window.gaussianSplatManager.unloadAllSplats();

                            // Load new splat for selected site
                            window.gaussianSplatManager.loadSplat(selectedSite.name);
                        }
                    }
                });

                // Navigate to the selected site
                navigateToSite(bounds);
            } catch (error) {
                console.error('Error navigating to selected site:', error);
            }
        }
    });
}

/**
 * Navigates to a site based on bounds
 * @param {Object} bounds - Site bounds object
 * @param {boolean} visualize - Whether to show visualization (default: true)
 */
function navigateToSite(bounds, visualize = true) {

    const centerLat = (bounds.minLat + bounds.maxLat) / 2;
    const centerLng = (bounds.minLng + bounds.maxLng) / 2;

    loadSiteData().then(sites => {
        // Find the selected site by bounds
        const selectedSite = sites.find(site =>
            Math.abs(site.bounds.minLat - bounds.minLat) < 0.001 &&
            Math.abs(site.bounds.maxLat - bounds.maxLat) < 0.001 &&
            Math.abs(site.bounds.minLng - bounds.minLng) < 0.001 &&
            Math.abs(site.bounds.maxLng - bounds.maxLng) < 0.001
        );

        if (selectedSite && selectedSite.geoJson && visualize) {
            window.currentSiteData = selectedSite.geoJson;
        }
    });

    window.displayMessage(`Navigating to site: ${centerLat.toFixed(6)}, ${centerLng.toFixed(6)}`, 0.5, 2, 0.5);
}

/**
 * Initializes SuperSplat site data and configuration
 */
async function initializeSupersplatSiteData() {

    // Load site data
    const sites = await loadSiteData();

    // Find the default site (Winter Garden Residence / demo-site)
    const defaultSite = sites.find(site =>
        site.name === 'Winter Garden Residence' ||
        site.filename.includes('demo-site')
    );

    if (!defaultSite) {
        console.error('❌ Default site (Winter Garden Residence) not found');
        return;
    }

    // Show layer controls for ecological data format
    const layerControls = document.getElementById('layerControls');
    if (layerControls) {
        layerControls.style.display = 'block';
    }

    // Store the site data globally
    window.currentSiteData = defaultSite.geoJson;

    // Initialize layer state - SINGLE SOURCE OF TRUTH FOR VISIBILITY DEFAULTS
    window.layerState = {
        showPlantableAreas: true,        // PA visible by default
        showNonPlantableAreas: false,    // NPA hidden by default

        // Unified selection structure
        selectedGroup: null,        // PA name, NPA category, or metric name ('soilMoisture', 'pH', etc.)
        selectedGroupType: null,    // 'PA', 'NPA', or 'METRIC'
        selectedPolygons: [],       // Array of polygon names for current selection

        // Categorization data
        npaCategories: new Map(),   // Map of NPA category name to metadata
        paCategories: new Map(),    // Map of PA name to {number, category}
        categorizedPAs: new Map()   // Map of category -> array of PAs
    };

    // Detect format and initialize parameter filter
    const geoJsonFormat = defaultSite.geoJson.features.length > 0 ?
        window.detectGeoJsonFormat(defaultSite.geoJson.features[0]) : 'legacy';

    // Initialize layer controls after site is loaded
    if (window.initializeLayerControls) {
        window.initializeLayerControls();
    } else {
        console.warn('⚠️ initializeLayerControls not available, falling back to timeout-based init');
        // Fallback: wait 2 seconds then try again
        setTimeout(() => {
            if (window.initializeLayerControls) {
                console.log('✅ Late initialization of layer controls succeeded');
                window.initializeLayerControls();
            } else {
                console.error('❌ Layer controls initialization failed - function not available after timeout');
            }
        }, 2000);
    }

    // Initialize layer controls to analyze PA/NPA categories
    if (window.initializeLayerControlsForSite) {
        window.initializeLayerControlsForSite(geoJsonFormat);
    } else {
        console.warn('⚠️ initializeLayerControlsForSite not available');
    }
}

// Expose functions globally for cross-file access
window.loadSiteData = loadSiteData;
window.initializeSiteSelector = initializeSiteSelector;
window.navigateToSite = navigateToSite;
window.initializeSupersplatSiteData = initializeSupersplatSiteData;