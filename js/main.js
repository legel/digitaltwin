// Global loading mode configuration
window.TERRAIN_LOADING_CONFIG = {
    // Set to 'lab' for SuperSplat Lab mode first, 'cesium' for Cesium 3D mode first
    initialMode: 'cesium',
    
    // Loading timing configuration
    expectedLoadTime: {
        lab: 8,      // 8 seconds expected for Lab mode
        cesium: 20   // 20 seconds expected for Cesium mode
    },
    
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

    // Comment out old narratives
    // introductionTutorialToVizcaya();
    // introductionTutorialToDixHite();
    
    // DISABLED: Auto flythrough - camera now starts directly at site
    // Start the Scott Boyd site introduction after 2 seconds
    // if (window.map3D && window.map3D.viewer) {
    //     window.setTimeout(() => introductionToScottBoydSite(), 2000);
    // }

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
        messageQueue: [],
        messageTimer: null,
        startTime: Date.now(),
        worker: loadingWorker,
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
        updateMessage: (message, minDisplayTime = 3750) => {
            // Queue message with minimum display time
            window.independentLoadingState.messageQueue.push({ message, minDisplayTime });
            processMessageQueue();
        }
    };
    
    // Process message queue with proper timing
    const processMessageQueue = () => {
        if (window.independentLoadingState.messageQueue.length === 0) return;
        if (window.independentLoadingState.messageTimer) return; // Already processing
        
        const { message, minDisplayTime } = window.independentLoadingState.messageQueue.shift();
        window.independentLoadingState.currentMessage = message;
        updateLoadingText();
        
        // Set timer for minimum display time
        window.independentLoadingState.messageTimer = setTimeout(() => {
            window.independentLoadingState.messageTimer = null;
            processMessageQueue(); // Process next message
        }, minDisplayTime);
    };
    
    const updateLoadingProgress = (percentage) => {
        const progressBar = document.getElementById('loadingProgress');
        
        if (progressBar) {
            // Use transform for hardware-accelerated animation
            const cleanPercentage = Math.max(0, Math.min(100, percentage));
            // Ensure progress never goes backwards
            const currentProgress = window.independentLoadingState?.currentProgress || 0;
            const newPercentage = Math.max(currentProgress, cleanPercentage);
            
            progressBar.style.transform = `scaleX(${newPercentage / 100})`;
            if (window.independentLoadingState) {
                window.independentLoadingState.currentProgress = newPercentage;
            }
            updateLoadingText();
            
            // Progress logging removed for cleaner console output
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
                workerResponded = true;
                break;
                
            case 'started':
                workerResponded = true;
                break;
                
            case 'progress':
                updateLoadingProgress(progress);
                workerResponded = true;
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
    
    const completeIndependentLoading = () => {
        // Double-check we should actually complete
        if (!window.independentLoadingState.isActive) {
            return;
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
    // startFallbackAnimation(); // DISABLED
    
    // Web Worker is the single source of progress updates - pass configuration
    const currentMode = window.TERRAIN_LOADING_CONFIG.initialMode;
    const expectedTime = window.TERRAIN_LOADING_CONFIG.expectedLoadTime[currentMode];
    const progressUntil = window.TERRAIN_LOADING_CONFIG.steadyProgressUntil;
    
    loadingWorker.postMessage({ 
        type: 'start',
        data: {
            config: {
                expectedTime: expectedTime,
                progressUntil: progressUntil
            }
        }
    });
    
    // Start the message queue processing
    processMessageQueue();
    
    // Set up simple message cycling with direct DOM updates
    setupSimpleMessageCycling();
    
    // Aggressive fallback animation using requestAnimationFrame
    function startFallbackAnimation() {
        let progress = 0;
        const startTime = Date.now();
        
        const animateProgress = () => {
            if (!window.independentLoadingState?.isActive) {
                return;
            }
            
            const elapsed = (Date.now() - startTime) / 1000;
            
            if (progress < 80) {
                // 0-80% over 35 seconds - extended for remote loading
                progress = Math.min(80, (elapsed / 35) * 80);
            } else {
                // Slow exponential approach to 99%
                const slowdownTime = elapsed - 35; // Time since 80% (at 35 seconds)
                progress = Math.min(99, 80 + (19 * (1 - Math.exp(-slowdownTime / 10))));
            }
            
            updateLoadingProgress(progress);
            
            if (window.independentLoadingState?.isActive) {
                // Use requestAnimationFrame for higher priority
                requestAnimationFrame(animateProgress);
            }
        };
        
        // Also add a backup setInterval in case requestAnimationFrame gets blocked
        const backupInterval = setInterval(() => {
            if (!window.independentLoadingState?.isActive) {
                clearInterval(backupInterval);
                return;
            }
            
            const elapsed = (Date.now() - startTime) / 1000;
            let backupProgress = 0;
            
            if (elapsed < 35) {
                backupProgress = Math.min(80, (elapsed / 35) * 80);
            } else {
                const slowdownTime = elapsed - 35;
                backupProgress = Math.min(99, 80 + (19 * (1 - Math.exp(-slowdownTime / 10))));
            }
            
            // Only update if significantly different to avoid spam
            const currentProgress = window.independentLoadingState?.currentProgress || 0;
            if (Math.abs(backupProgress - currentProgress) > 0.5) {
                // Backup progress logging removed for cleaner console output
                updateLoadingProgress(backupProgress);
            }
        }, 500); // Every 500ms as backup
        
        animateProgress();
    }
    
    // Simple message cycling with basic setInterval
    function setupSimpleMessageCycling() {
        // Wait for messages to be available
        const checkForMessages = () => {
            if (window.ecoLoadingMessages) {
                startSimpleMessageCycling();
            } else {
                setTimeout(checkForMessages, 100);
            }
        };
        
        const startSimpleMessageCycling = () => {
            let messageIndex = 0;
            const shuffledMessages = [...window.ecoLoadingMessages].sort(() => Math.random() - 0.5);
            
            // Set first message immediately
            const firstMessage = shuffledMessages[0];
            // Message cycling start logging removed for cleaner console output
            
            window.independentLoadingState.currentMessage = firstMessage;
            const loadingMessage = document.getElementById('loadingMessage');
            const loadingPercentage = document.getElementById('loadingPercentage');
            if (loadingMessage) loadingMessage.textContent = firstMessage;
            if (loadingPercentage) loadingPercentage.textContent = '0%';
            
            messageIndex = 1;
            
            // Simple interval - may still get blocked but much simpler
            const messageInterval = setInterval(() => {
                if (!window.independentLoadingState?.isActive) {
                    clearInterval(messageInterval);
                    return;
                }
                
                const message = shuffledMessages[messageIndex];
                // Message cycling logging removed for cleaner console output
                
                window.independentLoadingState.currentMessage = message;
                const loadingMessage = document.getElementById('loadingMessage');
                if (loadingMessage) loadingMessage.textContent = message;
                
                messageIndex++;
                if (messageIndex >= shuffledMessages.length) {
                    messageIndex = 0;
                    shuffledMessages.sort(() => Math.random() - 0.5);
                }
            }, 3000); // Every 3 seconds (1.5x slower for better readability)
        };
        
        checkForMessages();
    }
}

