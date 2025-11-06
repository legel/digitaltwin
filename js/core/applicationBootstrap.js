/**
 * Application Bootstrap
 * Handles application initialization and startup sequence
 */

/**
 * Initializes the SuperSplat application
 */
async function initializeSupersplat() {

    // Wait for SuperSplat manager to be available
    let attempts = 0;
    const maxAttempts = 20; // 2 seconds max wait
    while (!window.superSplatManager && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }

    // Initialize SuperSplat manager
    if (window.superSplatManager) {

        // Ensure SuperSplat manager is initialized first
        if (!window.superSplatManager.superSplatContainer) {
            window.superSplatManager.initialize();
        }

        // Show SuperSplat container
        const superSplatContainer = document.getElementById('superSplatContainer');
        if (superSplatContainer) {
            superSplatContainer.style.display = 'block';

            // Load SuperSplat editor with default site (scott-boyd-residence has splat file)
            window.superSplatManager.loadSuperSplatEditor('scott-boyd-residence');

        } else {
            console.error('❌ SuperSplat container not found');
        }
    } else {
        console.error('❌ SuperSplat manager not available after timeout');
    }
}

/**
 * Main initialization function for the application
 */
async function initializeApplication() {
    if (window.independentLoadingState) {
        // Update loading message for initialization
    }

    await initializeSupersplat();

    // Initialize layer state early
    window.layerState = {
        showPlantableAreas: true,
        showNonPlantableAreas: false,

        // Unified selection structure
        selectedGroup: null,
        selectedGroupType: null,
        selectedPolygons: [],

        // Categorization data
        npaCategories: new Map(),
        paCategories: new Map(),
        categorizedPAs: new Map()
    };

    await window.initializeSupersplatSiteData();

}

// Expose functions globally for cross-file access
window.initializeSupersplat = initializeSupersplat;
window.initializeApplication = initializeApplication;