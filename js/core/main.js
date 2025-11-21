// Global loading configuration
window.TERRAIN_LOADING_CONFIG = {
    // Loading timing configuration - DISABLED, now using real progress
    useRealProgress: true,  // Flag to indicate we're using real download progress
    minTimeBeforeCompletion: 1 // Minimum 1 second before allowing completion
};

document.addEventListener("DOMContentLoaded", async function() {
    // Initialize loading screen with real progress tracking (no fake animation)
    initializeRealLoadingScreen();

    // Wait for utilities.js to load
    if (typeof initializeApplication === 'undefined') {
        await new Promise(resolve => {
            const checkForInitializeApplication = () => {
                if (typeof initializeApplication !== 'undefined') {
                    resolve();
                } else {
                    setTimeout(checkForInitializeApplication, 50);
                }
            };
            checkForInitializeApplication();
        });
    }
    await initializeApplication();
});

/**
 * Initialize loading screen with real progress tracking
 * No fake animations - progress is driven by actual download events
 */
function initializeRealLoadingScreen() {
    // Store loading state globally for access by progressive loader
    window.independentLoadingState = {
        isActive: true,
        currentProgress: 0,
        currentMessage: 'Initializing...',
        startTime: Date.now(),
        complete: () => {
            completeLoadingScreen();
        }
    };


    // Set up safety timeout (60 seconds) - keeps trying, doesn't give up
    setTimeout(() => {
        if (window.independentLoadingState?.isActive) {
            console.warn('⚠️ Loading timeout after 60 seconds - still waiting for completion');
            // Don't force completion - keep waiting for real data
        }
    }, 60000);
}

/**
 * Complete and hide the loading screen
 */
function completeLoadingScreen() {
    if (!window.independentLoadingState?.isActive) {
        return;
    }


    // Update to 100%
    const progressBar = document.getElementById('loadingProgress');
    const loadingMessage = document.getElementById('loadingMessage');
    const loadingPercentage = document.getElementById('loadingPercentage');

    if (progressBar) {
        progressBar.style.transform = 'scaleX(1)';
    }
    if (loadingMessage) {
        loadingMessage.textContent = 'Complete!';
    }
    if (loadingPercentage) {
        loadingPercentage.textContent = '100%';
    }

    window.independentLoadingState.currentProgress = 100;

    // Hide loading screen with smooth fade
    setTimeout(() => {
        const loadingScreen = document.getElementById('loadingScreen');

        if (loadingScreen) {
            // Fade out animation
            loadingScreen.style.transition = 'opacity 0.3s ease-out';
            loadingScreen.style.opacity = '0';

            // Complete removal after fade
            setTimeout(() => {
                if (loadingScreen.parentNode) {
                    loadingScreen.parentNode.removeChild(loadingScreen);
                }
                window.independentLoadingState.isActive = false;
                console.log('✅ Loading screen removed');
            }, 300);
        }
    }, 500);
}
