/**
 * Web Worker for completely decoupled loading animation
 * Runs independently of main thread and Cesium processes
 */

// Immediately send ready signal to main thread
try {
    self.postMessage({ type: 'ready', message: 'Web Worker script loaded and ready' });
} catch (error) {
    // Worker context might not be ready yet
}

let currentProgress = 0;
let startTime = null;
let isActive = false;
let exponentialSlowdownStartTime = null;
let currentDelayMultiplier = 1;

// Message handler
self.onmessage = function(e) {
    const { type, data } = e.data;
    
    switch (type) {
        case 'start':
            self.postMessage({ type: 'started', message: 'Animation started' });
            startLoading();
            break;
        case 'complete':
            completeLoading();
            break;
        case 'stop':
            stopLoading();
            break;
        default:
            console.error(`WEB WORKER: Unknown message type:`, type);
    }
};

function startLoading() {
    if (isActive) {
        return;
    }
    
    isActive = true;
    currentProgress = 0;
    startTime = Date.now();
    exponentialSlowdownStartTime = null;
    currentDelayMultiplier = 1;
    
    // Send initial progress
    try {
        self.postMessage({ type: 'progress', progress: 0 });
    } catch (error) {
        console.error('WEB WORKER: Failed to send initial progress:', error);
    }
    
    // Start animation
    if (typeof setTimeout === 'undefined') {
        // Fallback: use setInterval instead
        const interval = setInterval(() => {
            animateProgress();
            if (!isActive) clearInterval(interval);
        }, 1000 / 60);
    } else {
        animateProgress();
    }
}

function animateProgress() {
    try {
        const currentTime = Date.now();
    
    if (!startTime || !isActive) {
        return;
    }
    
    const totalElapsedTime = (currentTime - startTime) / 1000;
    
    let newProgress;
    
    if (currentProgress < 80) {
        // Phase 1: 0-80% over 35 seconds (2.3% per second) - extended for remote loading
        newProgress = Math.min(80, (totalElapsedTime / 35) * 80);
    } else {
        // Phase 2: 80-99% with exponential slowdown
        if (!exponentialSlowdownStartTime) {
            exponentialSlowdownStartTime = currentTime;
        }
        
        const slowdownElapsed = (currentTime - exponentialSlowdownStartTime) / 1000;
        const secondsInSlowdown = Math.floor(slowdownElapsed);
        
        // Double the delay each second: 1s, 2s, 4s, 8s, etc.
        currentDelayMultiplier = Math.pow(2, secondsInSlowdown);
        
        // Progress very slowly with exponential delay
        const baseProgressPerSecond = 1; // 1% per second base rate
        const effectiveProgressPerSecond = baseProgressPerSecond / currentDelayMultiplier;
        
        const progressIncrease = (1000 / 60) / 1000 * effectiveProgressPerSecond; // 60fps update rate
        newProgress = Math.min(99, currentProgress + progressIncrease);
    }
    
    currentProgress = newProgress;
    
    // Send progress update to main thread
    try {
        self.postMessage({
            type: 'progress',
            progress: Math.round(currentProgress * 10) / 10
        });
    } catch (error) {
        console.error('WEB WORKER: Error sending message:', error);
        isActive = false;
        return;
    }
    
    // Schedule next update
    if (isActive) {
        try {
            setTimeout(animateProgress, 1000 / 60);
        } catch (error) {
            console.error('WEB WORKER: Failed to schedule next update:', error);
            isActive = false;
        }
    }
    
    } catch (globalError) {
        console.error('WEB WORKER: FATAL ERROR in animateProgress:', globalError);
        isActive = false;
    }
}

function completeLoading() {
    if (!isActive) return;
    
    console.log('Web Worker: Loading completion triggered');
    
    // Quick acceleration to 100%
    const startProgress = currentProgress;
    const accelerationStartTime = Date.now();
    const duration = 500; // 500ms acceleration
    
    const animateCompletion = () => {
        const elapsed = Date.now() - accelerationStartTime;
        const progress = Math.min(1, elapsed / duration);
        
        // Smooth ease-out curve
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        currentProgress = startProgress + ((100 - startProgress) * easedProgress);
        
        // Send progress update without message
        self.postMessage({
            type: 'progress',
            progress: Math.round(currentProgress * 10) / 10
        });
        
        if (elapsed < duration) {
            setTimeout(animateCompletion, 1000 / 60);
        } else {
            // Send completion signal
            self.postMessage({
                type: 'finished',
                progress: 100
            });
            stopLoading();
        }
    };
    
    animateCompletion();
}

function stopLoading() {
    isActive = false;
    console.log('Web Worker: Loading animation stopped');
}