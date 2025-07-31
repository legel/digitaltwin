/**
 * Independent Web Worker for message cycling
 * Runs completely separate from main thread
 */

let isActive = false;
let messageIndex = 1;
let intervalId = null;

self.onmessage = function(e) {
    console.log('Message Worker received:', e.data.type);
    
    switch (e.data.type) {
        case 'start':
            if (isActive) return; // Already running
            
            isActive = true;
            messageIndex = e.data.messageIndex || 1;
            
            console.log('Message Worker starting with index:', messageIndex);
            
            // Start the cycling immediately, then every 1.8 seconds
            const cycle = () => {
                if (isActive) {
                    console.log('Message Worker cycling - index:', messageIndex);
                    self.postMessage({ 
                        type: 'cycle', 
                        messageIndex: messageIndex,
                        timestamp: Date.now()
                    });
                    messageIndex++;
                }
            };
            
            // First cycle after 2.7 seconds  
            setTimeout(() => {
                if (isActive) {
                    cycle();
                    // Then continue every 2.7 seconds (1.5x slower for better readability)
                    intervalId = setInterval(() => {
                        if (isActive) {
                            cycle();
                        } else {
                            clearInterval(intervalId);
                        }
                    }, 2700);
                }
            }, 2700);
            break;
            
        case 'stop':
            console.log('Message Worker stopping');
            isActive = false;
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
            break;
            
        default:
            console.warn('Message Worker unknown message type:', e.data.type);
    }
};

// Send ready signal
self.postMessage({ type: 'ready' });