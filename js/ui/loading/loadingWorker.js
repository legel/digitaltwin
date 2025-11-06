/**
 * Web Worker for completely decoupled loading animation
 * Runs independently of main thread and Cesium processes
 * May freeze temporarily while Supersplat main thread is using compute
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
let loadingConfig = {
    expectedTime: 8, // Default 8 seconds for SuperSplat startup
    progressUntil: 80
};
let messageIndex = 0;
let shuffledMessages = [];
let messageIntervalId = null;

// Message handler
self.onmessage = function(e) {
    const { type, data } = e.data;
    
    switch (type) {
        case 'start':
            if (data && data.config) {
                loadingConfig = { ...loadingConfig, ...data.config };
            }
            if (data && data.messages) {
                shuffledMessages = [...data.messages].sort(() => Math.random() - 0.5);
                startMessageCycling();
            }
            self.postMessage({ type: 'started', message: 'Animation started' });
            startLoading();
            break;
        case 'complete':
            completeLoading();
            break;
        case 'accelerate':
            // Accelerate to completion if we're ready early
            accelerateToCompletion();
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
    
    if (currentProgress < loadingConfig.progressUntil) {
        // Phase 1: 0-progressUntil% over expectedTime seconds for steady progression
        const progressPercentage = Math.min(loadingConfig.progressUntil, (totalElapsedTime / loadingConfig.expectedTime) * loadingConfig.progressUntil);
        newProgress = progressPercentage;
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

function accelerateToCompletion() {
    if (!isActive) return;
    
    // Accelerate to 95% quickly if we're below 60%
    if (currentProgress < 60) {
        const startProgress = currentProgress;
        const accelerationStartTime = Date.now();
        const duration = 2000; // 2 seconds to reach 95%
        
        const animateAcceleration = () => {
            const elapsed = Date.now() - accelerationStartTime;
            const progress = Math.min(1, elapsed / duration);
            
            // Smooth acceleration to 95%
            const easedProgress = 1 - Math.pow(1 - progress, 2);
            currentProgress = startProgress + ((95 - startProgress) * easedProgress);
            
            // Send progress update
            self.postMessage({
                type: 'progress',
                progress: Math.round(currentProgress * 10) / 10
            });
            
            if (elapsed < duration && isActive) {
                setTimeout(animateAcceleration, 1000 / 60);
            }
        };
        
        animateAcceleration();
    }
}

function completeLoading() {
    if (!isActive) return;
    
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
    if (messageIntervalId) {
        clearInterval(messageIntervalId);
        messageIntervalId = null;
    }
    console.log('Web Worker: Loading animation stopped');
}

function startMessageCycling() {
    if (shuffledMessages.length === 0) return;
    
    // Send first message immediately
    self.postMessage({
        type: 'message',
        message: shuffledMessages[0]
    });
    messageIndex = 1;
    
    // Set up cycling every 2 seconds
    messageIntervalId = setInterval(() => {
        if (!isActive) {
            clearInterval(messageIntervalId);
            messageIntervalId = null;
            return;
        }
        
        const message = shuffledMessages[messageIndex];
        self.postMessage({
            type: 'message', 
            message: message
        });
        
        messageIndex++;
        if (messageIndex >= shuffledMessages.length) {
            messageIndex = 0;
            // Re-shuffle for variety
            shuffledMessages.sort(() => Math.random() - 0.5);
        }
    }, 2000);
}