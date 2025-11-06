/**
 * Metric Chart Renderer
 * Handles Gaussian curve rendering and Viridis color mapping
 */

class MetricChart {
    constructor() {
        // Uses centralized viridisColormap from ecologicalMetrics.js
    }
    
    /**
     * Draw a Gaussian distribution curve on canvas
     * @param {HTMLCanvasElement} canvas - The canvas element
     * @param {Object} metricData - Contains min, max, mean, range
     * @param {Object} projectRange - Project-wide min/max for scaling
     */
    drawGaussian(canvas, metricData, projectRange) {
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Add subtle background gradient for better visibility
        const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
        bgGradient.addColorStop(0, 'rgba(255, 255, 255, 0.02)');
        bgGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, width, height);
        
        // Calculate Gaussian parameters
        const mean = metricData.mean;
        const range = metricData.range || 0.1; // Prevent zero range
        // Use range/1.5 for standard deviation so the min-max range represents 1.5 standard deviations total
        let stdDev = Math.max(range / 1.5, (projectRange.max - projectRange.min) / 50); // Ensure visible curve
        
        // Adjust for truncation if necessary
        stdDev = this.adjustForTruncation(mean, stdDev, projectRange);
        
        // Calculate the actual peak probability for display
        // For visualization, we want the curve to be normalized between 0 and 1
        // The peak height should be 1.0 (100%) at the mean
        // Peak probability will be calculated from bins below
        
        // Draw axis
        this.drawAxis(ctx, width, height, projectRange);
        
        // Draw Gaussian curve
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 3;
        
        let firstPoint = true;
        const paddingX = 35; // Match axis padding
        const paddingRight = 20;
        const drawWidth = width - paddingX - paddingRight;
        const paddingTop = 25; // Space for value labels
        const paddingBottom = 20; // Space for axis
        const chartHeight = height - paddingTop - paddingBottom; // Actual drawing area
        
        // Calculate the exact peak Y position (at the mean)
        // The Gaussian peak is always at the mean with value = 1.0
        const peakY = paddingTop; // Peak is at top of chart area since gaussValue = 1
        
        // First, create the curve path for both stroke and fill
        const curvePath = new Path2D();
        
        // Start from bottom left
        curvePath.moveTo(paddingX, paddingTop + chartHeight);
        
        for (let px = 0; px <= drawWidth; px++) {
            // Convert pixel position to value
            const value = projectRange.min + (px / drawWidth) * (projectRange.max - projectRange.min);
            
            // Calculate normalized Gaussian probability (0 to 1)
            const exponent = -0.5 * Math.pow((value - mean) / stdDev, 2);
            const gaussValue = Math.exp(exponent);
            
            // Scale to canvas coordinates - invert Y since canvas Y increases downward
            const x = paddingX + px;
            const y = paddingTop + (1 - gaussValue) * chartHeight;
            
            curvePath.lineTo(x, y);
        }
        
        // Complete the path by going to bottom right
        curvePath.lineTo(paddingX + drawWidth, paddingTop + chartHeight);
        curvePath.closePath();
        
        // Draw the curve outline
        ctx.stroke(curvePath);
        
        // Fill under curve with gradient
        const normalizedMean = (mean - projectRange.min) / (projectRange.max - projectRange.min);
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
        gradient.addColorStop(normalizedMean, 'rgba(255, 255, 255, 0.08)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = gradient;
        ctx.fill(curvePath);
        ctx.globalAlpha = 1.0;
        
        // Calculate actual peak probability using proper binning
        // Split the range into 100 bins and compute probability for each
        const numBins = 100;
        const binWidth = (projectRange.max - projectRange.min) / numBins;
        
        // Calculate probabilities for all bins
        const binProbabilities = [];
        let totalProbability = 0;
        
        for (let i = 0; i < numBins; i++) {
            const binCenter = projectRange.min + (i + 0.5) * binWidth;
            const exponent = -0.5 * Math.pow((binCenter - mean) / stdDev, 2);
            const probability = Math.exp(exponent) / (stdDev * Math.sqrt(2 * Math.PI));
            binProbabilities.push(probability * binWidth);
            totalProbability += probability * binWidth;
        }
        
        // Normalize probabilities
        const normalizedBinProbs = binProbabilities.map(p => p / totalProbability);
        
        // Find the bin containing the mean
        const meanBinIndex = Math.floor((mean - projectRange.min) / binWidth);
        
        // Sum the 5 bins nearest to the peak (2 on each side + center)
        let peakProbability = 0;
        for (let offset = -2; offset <= 2; offset++) {
            const binIndex = meanBinIndex + offset;
            if (binIndex >= 0 && binIndex < numBins) {
                peakProbability += normalizedBinProbs[binIndex];
            }
        }
        
        // Ensure the probability is between 0 and 1
        const displayProbability = Math.max(0.01, Math.min(0.99, peakProbability));
        
        
        // Debug log (commented out for production)
        // console.log(`Drew Gaussian: mean=${mean}, stdDev=${stdDev}, peakProb=${(displayProbability * 100).toFixed(0)}%, range=[${projectRange.min}, ${projectRange.max}], binWidth=${binWidth.toFixed(3)}`);
        
        // Return peak information
        return {
            peakY: peakY,
            peakProbability: displayProbability
        };
    }
    
    /**
     * Draw axis with tick marks and labels
     */
    drawAxis(ctx, width, height, range) {
        const paddingX = 35;
        const paddingRight = 20;
        const drawWidth = width - paddingX - paddingRight;
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        
        // Draw x-axis baseline
        const axisY = height - 20; // Adjusted to align with curve bottom
        ctx.beginPath();
        ctx.moveTo(paddingX, axisY);
        ctx.lineTo(width - paddingRight, axisY);
        ctx.stroke();
        
        // Draw y-axis
        ctx.beginPath();
        ctx.moveTo(paddingX, 25); // Match paddingTop
        ctx.lineTo(paddingX, axisY);
        ctx.stroke();
        
        // Calculate nice tick values for x-axis
        const tickValues = this.calculateNiceTicks(range.min, range.max);
        
        // Draw x-axis ticks and labels
        ctx.font = '10px Oxygen'; // Reduced from 11px
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.save(); // Save context to restore clipping later
        
        tickValues.forEach((value, index) => {
            const x = paddingX + ((value - range.min) / (range.max - range.min)) * drawWidth;
            
            // Draw tick
            ctx.beginPath();
            ctx.moveTo(x, axisY);
            ctx.lineTo(x, axisY + 4);
            ctx.stroke();
            
            // Format label based on value magnitude
            let label;
            if (Number.isInteger(value)) {
                label = value.toString();
            } else if (value < 1) {
                label = value.toFixed(2);
            } else if (value < 10) {
                label = value.toFixed(1);
            } else {
                label = value.toFixed(0);
            }
            
            // Draw label - allow it to extend beyond chart bounds if needed
            ctx.fillText(label, x, axisY + 6);
        });
        
        ctx.restore(); // Restore context after label drawing
        
    }
    
    calculateNiceTicks(min, max) {
        const range = max - min;
        let tickInterval;
        
        // Determine appropriate interval
        if (range <= 1) {
            tickInterval = 0.25;
        } else if (range <= 2) {
            tickInterval = 0.5;
        } else if (range <= 5) {
            tickInterval = 1;
        } else if (range <= 10) {
            tickInterval = 2;
        } else if (range <= 20) {
            tickInterval = 5;
        } else if (range <= 50) {
            tickInterval = 10;
        } else if (range <= 100) {
            tickInterval = 20;
        } else {
            tickInterval = Math.ceil(range / 5 / 10) * 10;
        }
        
        // Generate tick values
        const ticks = [];
        let currentTick = Math.ceil(min / tickInterval) * tickInterval;
        
        // Ensure we don't create too many ticks
        const maxTicks = 7;
        while (currentTick <= max && ticks.length < maxTicks) {
            ticks.push(currentTick);
            currentTick += tickInterval;
        }
        
        // Always include min and max if they're not already there
        // But only if they won't crowd the display
        const tolerance = tickInterval * 0.2;
        
        // Add min if it's not too close to first tick
        if (ticks.length === 0 || Math.abs(ticks[0] - min) > tolerance) {
            ticks.unshift(min);
        }
        
        // Add max if it's not too close to last tick
        if (ticks.length === 0 || Math.abs(ticks[ticks.length - 1] - max) > tolerance) {
            ticks.push(max);
        }
        
        // Limit total number of ticks to prevent crowding
        if (ticks.length > maxTicks) {
            // Keep first, last, and evenly spaced middle ticks
            const newTicks = [ticks[0]];
            const step = Math.floor((ticks.length - 2) / (maxTicks - 2));
            for (let i = step; i < ticks.length - 1; i += step) {
                newTicks.push(ticks[i]);
            }
            newTicks.push(ticks[ticks.length - 1]);
            return newTicks;
        }
        
        return ticks;
    }
    
    /**
     * Get Viridis color for normalized value
     * @param {number} value - Normalized value between 0 and 1
     * @returns {string} - RGB color string
     */
    getViridisColor(value) {
        // Use centralized viridis colormap from ecologicalMetrics.js
        const rgb = window.viridisColormap(value);
        const r = Math.round(rgb[0] * 255);
        const g = Math.round(rgb[1] * 255);
        const b = Math.round(rgb[2] * 255);
        return `rgb(${r}, ${g}, ${b})`;
    }
    
    /**
     * Create a gradient for the Gaussian curve
     */
    createGaussianGradient(ctx, width, height, normalizedPosition) {
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        const color = this.getViridisColor(normalizedPosition);
        
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
        gradient.addColorStop(normalizedPosition, color);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        return gradient;
    }
    
    /**
     * Check if distribution would be truncated and adjust standard deviation
     */
    adjustForTruncation(mean, stdDev, projectRange) {
        // Check if the Gaussian would extend beyond reasonable bounds
        const leftExtent = mean - 3 * stdDev;
        const rightExtent = mean + 3 * stdDev;
        
        // If distribution would go significantly negative for naturally positive values
        if (projectRange.min >= 0 && leftExtent < -projectRange.min * 0.1) {
            // Adjust standard deviation to prevent negative values
            // Use distance from mean to zero as a constraint
            const maxStdDev = mean / 2.5; // Ensure 2.5 sigma doesn't go negative
            return Math.min(stdDev, maxStdDev);
        }
        
        return stdDev;
    }
}

// Export for use in focusPanel.js
window.MetricChart = MetricChart;