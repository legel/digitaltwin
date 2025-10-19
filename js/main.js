// Global loading configuration
window.TERRAIN_LOADING_CONFIG = {
    // Loading timing configuration
    expectedLoadTime: 8,      // 8 seconds expected for SuperSplat startup

    // Progress thresholds
    steadyProgressUntil: 80,  // Progress steadily to 80%
    minTimeBeforeCompletion: 3 // Minimum 3 seconds before allowing completion
};

document.addEventListener("DOMContentLoaded", async function() {
    // DOM loading logging removed for cleaner console output
    //debug();

    // Start independent loading screen animation
    startIndependentLoadingAnimation();

    // Run all systems initialization in background (wait for utilities.js to load)
    if (typeof allSystemsGo === 'undefined') {
        // Wait for utilities.js module to load
        await new Promise(resolve => {
            const checkForAllSystemsGo = () => {
                if (typeof allSystemsGo !== 'undefined') {
                    resolve();
                } else {
                    setTimeout(checkForAllSystemsGo, 50);
                }
            };
            checkForAllSystemsGo();
        });
    }
    await allSystemsGo();


});

/**
 * Starts completely decoupled loading animation using Web Worker
 */
function startIndependentLoadingAnimation() {
    // Create Web Worker for completely decoupled animation
    const loadingWorker = new Worker('/js/loadingWorker.js');
    
    // Store animation state globally
    window.independentLoadingState = {
        isActive: true,
        currentProgress: 0,
        currentMessage: '',
        startTime: Date.now(),
        worker: loadingWorker,
        timeoutId: null,
        complete: () => {
            // Smart completion logic - accelerate or complete based on timing and progress
            const elapsedTime = (Date.now() - (window.independentLoadingState?.startTime || Date.now())) / 1000;
            const minTime = window.TERRAIN_LOADING_CONFIG.minTimeBeforeCompletion;
            const currentProgress = window.independentLoadingState?.currentProgress || 0;
            
            if (elapsedTime >= minTime) {
                // Enough time has passed, complete immediately
                loadingWorker.postMessage({ type: 'complete' });
            } else if (currentProgress < 60) {
                // We're ready but progress is low - accelerate first
                loadingWorker.postMessage({ type: 'accelerate' });
                // Then complete after acceleration
                setTimeout(() => {
                    loadingWorker.postMessage({ type: 'complete' });
                }, 2500); // Wait for acceleration to finish
            } else {
                // Good progress but need to wait for minimum time
                const remainingTime = (minTime - elapsedTime) * 1000;
                setTimeout(() => {
                    loadingWorker.postMessage({ type: 'complete' });
                }, remainingTime);
            }
        },
    };
    
    
    const updateLoadingProgress = (percentage) => {
        const progressBar = document.getElementById('loadingProgress');
        
        if (progressBar) {
            // Use transform for hardware-accelerated animation
            const cleanPercentage = Math.max(0, Math.min(100, percentage));

            progressBar.style.transform = `scaleX(${cleanPercentage / 100})`;
            if (window.independentLoadingState) {
                window.independentLoadingState.currentProgress = cleanPercentage;
            }
            updateLoadingText();
        }
    };
    
    const updateLoadingText = () => {
        const loadingMessage = document.getElementById('loadingMessage');
        const loadingPercentage = document.getElementById('loadingPercentage');
        
        if (loadingMessage && loadingPercentage) {
            const displayPercentage = Math.floor(window.independentLoadingState?.currentProgress || 0);
            const message = window.independentLoadingState?.currentMessage || '';
            loadingMessage.textContent = message;
            loadingPercentage.textContent = `${displayPercentage}%`;
        }
    };
    
    // Handle messages from Web Worker
    loadingWorker.onmessage = function(e) {
        const { type, progress, message } = e.data;
        
        switch (type) {
            case 'ready':
                // Worker is ready
                break;
                
            case 'started':
                // Worker has started
                break;
                
            case 'progress':
                updateLoadingProgress(progress);
                break;
                
            case 'message':
                if (window.independentLoadingState) {
                    window.independentLoadingState.currentMessage = message;
                    updateLoadingText();
                }
                break;
                
            case 'finished':
                window.independentLoadingState.currentMessage = 'Complete!';
                updateLoadingProgress(100);
                completeIndependentLoading();
                break;
        }
    };
    
    // Handle worker errors
    loadingWorker.onerror = function(error) {
        console.error('CRITICAL: Web Worker error:', error);
        console.error('Error details:', error.message, error.filename, error.lineno);
    };
    
    // Handle worker termination
    loadingWorker.onmessageerror = function(error) {
        console.error('CRITICAL: Web Worker message error:', error);
    };

    // Set up 60-second timeout fallback in case worker fails
    window.independentLoadingState.timeoutId = setTimeout(() => {
        console.warn('⚠️ Loading worker timeout after 60 seconds - forcing completion');
        if (window.independentLoadingState?.isActive) {
            window.independentLoadingState.currentMessage = 'Loading complete';
            updateLoadingProgress(100);
            completeIndependentLoading();
        }
    }, 60000); // 60 seconds
    
    const completeIndependentLoading = () => {
        // Double-check we should actually complete
        if (!window.independentLoadingState.isActive) {
            return;
        }

        // Clear timeout since we're completing normally
        if (window.independentLoadingState.timeoutId) {
            clearTimeout(window.independentLoadingState.timeoutId);
            window.independentLoadingState.timeoutId = null;
        }
        
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
                    
                    // Terminate worker safely
                    if (window.independentLoadingState.worker) {
                        window.independentLoadingState.worker.terminate();
                        window.independentLoadingState.worker = null;
                    }
                    window.independentLoadingState.isActive = false;
                }, 300);
            }
        }, 300);
    };
    
    // Use ONLY Web Worker for progress - disable fallback to avoid conflicts
    // Web Worker initialization logging removed for cleaner console output
    // startFallbackAnimation(); // DISABLED - Web Worker handles all progress
    
    // Web Worker is the single source of progress updates - pass configuration
    const expectedTime = window.TERRAIN_LOADING_CONFIG.expectedLoadTime;
    const progressUntil = window.TERRAIN_LOADING_CONFIG.steadyProgressUntil;
    
    // Wait for eco loading messages to be available before starting
    const startWorkerWithMessages = () => {
        if (window.ecoLoadingMessages) {
            loadingWorker.postMessage({ 
                type: 'start',
                data: {
                    config: {
                        expectedTime: expectedTime,
                        progressUntil: progressUntil
                    },
                    messages: window.ecoLoadingMessages
                }
            });
        } else {
            // Retry after 100ms if messages aren't loaded yet
            setTimeout(startWorkerWithMessages, 100);
        }
    };
    
    startWorkerWithMessages();
    
    
    // DISABLED: setupSimpleMessageCycling() - Web Worker now handles all message cycling
    // setupSimpleMessageCycling();
    
}

