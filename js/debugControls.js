/**
 * Debug controls for polygon visualization
 */

// Global debug settings - updated defaults
window.debugSettings = {
    polygonAlpha: 0.05,
    outlineWidth: 7,
    selectedOutlineWidth: 14,
    heightOffset: 2,
    showDebugPanel: false,
    visualizationMode: 'both', // 'filled', 'outline', 'both'
    showFill: true,
    showOutline: true
};

/**
 * Creates the debug control panel
 */
function createDebugPanel() {
    // Check if panel already exists
    if (document.getElementById('debugPanel')) {
        return;
    }
    
    const panel = document.createElement('div');
    panel.id = 'debugPanel';
    panel.className = 'debug-panel';
    panel.innerHTML = `
        <div class="debug-header">
            <h3>Debug Controls</h3>
            <button class="debug-close" onclick="toggleDebugPanel()">×</button>
        </div>
        
        <div class="debug-section">
            <label>Polygon Alpha</label>
            <div class="slider-container">
                <input type="range" id="alphaSlider" min="0" max="100" value="10" step="5">
                <span id="alphaValue">0.10</span>
            </div>
        </div>
        
        <div class="debug-section">
            <label>Outline Width</label>
            <div class="slider-container">
                <input type="range" id="outlineSlider" min="1" max="10" value="2" step="1">
                <span id="outlineValue">2px</span>
            </div>
        </div>
        
        <div class="debug-section">
            <label>Selected Outline Width</label>
            <div class="slider-container">
                <input type="range" id="selectedOutlineSlider" min="1" max="20" value="5" step="1">
                <span id="selectedOutlineValue">5px</span>
            </div>
        </div>
        
        <div class="debug-section">
            <label>Height Offset</label>
            <div class="slider-container">
                <input type="range" id="heightSlider" min="-50" max="50" value="0" step="1">
                <span id="heightValue">0m</span>
            </div>
            <div class="button-group">
                <button class="debug-button" onclick="adjustHeightOffset(-5)">-5m</button>
                <button class="debug-button" onclick="adjustHeightOffset(-1)">-1m</button>
                <button class="debug-button" onclick="adjustHeightOffset(1)">+1m</button>
                <button class="debug-button" onclick="adjustHeightOffset(5)">+5m</button>
            </div>
        </div>
        
        <div class="debug-section">
            <label>Visualization Mode</label>
            <div class="button-group">
                <button class="debug-button" onclick="setVisualizationMode('filled')">Filled</button>
                <button class="debug-button" onclick="setVisualizationMode('outline')">Outline Only</button>
                <button class="debug-button" onclick="setVisualizationMode('both')">Both</button>
            </div>
        </div>
        
        <div class="debug-section">
            <label>Quick Presets</label>
            <div class="button-group">
                <button class="debug-button" onclick="applyPreset('subtle')">Subtle</button>
                <button class="debug-button" onclick="applyPreset('bold')">Bold</button>
                <button class="debug-button" onclick="applyPreset('outline')">Outline</button>
            </div>
        </div>
        
        <div class="debug-section">
            <label>Gaussian Splat GPS Translation (0.2m increments)</label>
            <div class="button-group">
                <button class="debug-button" onclick="adjustGPSTranslation('x', 0.2)">X +0.2m</button>
                <button class="debug-button" onclick="adjustGPSTranslation('x', -0.2)">X -0.2m</button>
            </div>
            <div class="button-group">
                <button class="debug-button" onclick="adjustGPSTranslation('y', 0.2)">Y +0.2m</button>
                <button class="debug-button" onclick="adjustGPSTranslation('y', -0.2)">Y -0.2m</button>
            </div>
            <div class="button-group">
                <button class="debug-button" onclick="adjustGPSTranslation('z', 0.2)">Z +0.2m</button>
                <button class="debug-button" onclick="adjustGPSTranslation('z', -0.2)">Z -0.2m</button>
            </div>
            <div class="button-group">
                <button class="debug-button" onclick="resetGPSTranslation()">Reset GPS</button>
                <button class="debug-button" onclick="logCurrentGPSTranslation()">Log GPS</button>
            </div>
        </div>
        
        <div class="debug-section">
            <label>Actions</label>
            <div class="button-group">
                <button class="debug-button" onclick="resetDebugSettings()">Reset All</button>
                <button class="debug-button" onclick="applyDebugSettings()">Apply Changes</button>
                <button class="debug-button" onclick="exportDebugSettings()">Export</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Add event listeners
    setupDebugEventListeners();
}

/**
 * Sets up event listeners for debug controls
 */
function setupDebugEventListeners() {
    // Alpha slider
    const alphaSlider = document.getElementById('alphaSlider');
    const alphaValue = document.getElementById('alphaValue');
    alphaSlider.addEventListener('input', function() {
        const alpha = this.value / 100;
        alphaValue.textContent = alpha.toFixed(2);
        window.debugSettings.polygonAlpha = alpha;
    });
    
    // Outline width slider
    const outlineSlider = document.getElementById('outlineSlider');
    const outlineValue = document.getElementById('outlineValue');
    outlineSlider.addEventListener('input', function() {
        outlineValue.textContent = this.value + 'px';
        window.debugSettings.outlineWidth = parseInt(this.value);
    });
    
    // Selected outline width slider
    const selectedOutlineSlider = document.getElementById('selectedOutlineSlider');
    const selectedOutlineValue = document.getElementById('selectedOutlineValue');
    selectedOutlineSlider.addEventListener('input', function() {
        selectedOutlineValue.textContent = this.value + 'px';
        window.debugSettings.selectedOutlineWidth = parseInt(this.value);
    });
    
    // Height offset slider
    const heightSlider = document.getElementById('heightSlider');
    const heightValue = document.getElementById('heightValue');
    heightSlider.addEventListener('input', function() {
        const offset = parseInt(this.value);
        heightValue.textContent = (offset > 0 ? '+' : '') + offset + 'm';
        window.debugSettings.heightOffset = offset;
    });
}

/**
 * Toggles the debug panel visibility
 */
function toggleDebugPanel() {
    const panel = document.getElementById('debugPanel');
    if (!panel) {
        createDebugPanel();
        window.debugSettings.showDebugPanel = true;
    } else {
        panel.classList.toggle('hidden');
        window.debugSettings.showDebugPanel = !panel.classList.contains('hidden');
    }
}

/**
 * Creates the debug toggle button
 */
function createDebugToggleButton() {
    if (document.getElementById('debugToggleButton')) {
        return;
    }
    
    // Create a simple button since createReusableButton might not be available yet
    const button = document.createElement('button');
    button.id = 'debugToggleButton';
    button.textContent = 'Debug Controls';
    button.style.cssText = `
        position: fixed;
        bottom: 120px;
        right: 20px;
        background-color: #072b2eff;
        color: white;
        border: none;
        border-radius: 25px;
        padding: 12px 24px;
        font-size: 14px;
        font-weight: 700;
        font-family: 'Oxygen', sans-serif;
        cursor: pointer;
        z-index: 999;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        transition: background-color 0.2s;
    `;
    
    button.addEventListener('click', toggleDebugPanel);
    button.addEventListener('mouseover', () => {
        button.style.backgroundColor = '#0a3d40';
    });
    button.addEventListener('mouseout', () => {
        button.style.backgroundColor = '#072b2eff';
    });
    
    document.body.appendChild(button);
}

/**
 * Resets all debug settings to defaults
 */
function resetDebugSettings() {
    window.debugSettings = {
        polygonAlpha: 0.05,
        outlineWidth: 7,
        selectedOutlineWidth: 14,
        heightOffset: 2,
        showDebugPanel: window.debugSettings.showDebugPanel,
        visualizationMode: 'both',
        showFill: true,
        showOutline: true
    };
    
    // Update sliders
    document.getElementById('alphaSlider').value = 5;
    document.getElementById('alphaValue').textContent = '0.05';
    
    document.getElementById('outlineSlider').value = 7;
    document.getElementById('outlineValue').textContent = '7px';
    
    document.getElementById('selectedOutlineSlider').value = 14;
    document.getElementById('selectedOutlineValue').textContent = '14px';
    
    document.getElementById('heightSlider').value = 2;
    document.getElementById('heightValue').textContent = '+2m';
    
    // Reset the actual height offset
    window.currentHeightOffset = undefined;
    
    // Apply changes
    applyDebugSettings();
}

/**
 * Applies current debug settings
 */
function applyDebugSettings() {
    // Update height offset if changed
    if (window.debugSettings.heightOffset !== 0) {
        const currentOffset = window.currentHeightOffset || 0;
        const adjustment = window.debugSettings.heightOffset - currentOffset;
        if (adjustment !== 0) {
            window.adjustHeightOffset(adjustment);
        }
    }
    
    // Re-visualize with new settings
    if (window.currentSiteData) {
        window.visualizeGeoJsonPolygons(window.currentSiteData);
    }
}

/**
 * Sets visualization mode
 * @param {string} mode - 'filled', 'outline', or 'both'
 */
function setVisualizationMode(mode) {
    window.debugSettings.visualizationMode = mode;
    window.debugSettings.showFill = (mode === 'filled' || mode === 'both');
    window.debugSettings.showOutline = (mode === 'outline' || mode === 'both');
    applyDebugSettings();
}

/**
 * Applies a preset configuration
 * @param {string} preset - 'subtle', 'bold', or 'outline'
 */
function applyPreset(preset) {
    switch (preset) {
        case 'subtle':
            window.debugSettings.polygonAlpha = 0.05;
            window.debugSettings.outlineWidth = 1;
            window.debugSettings.selectedOutlineWidth = 3;
            break;
            
        case 'bold':
            window.debugSettings.polygonAlpha = 0.3;
            window.debugSettings.outlineWidth = 3;
            window.debugSettings.selectedOutlineWidth = 8;
            break;
            
        case 'outline':
            window.debugSettings.polygonAlpha = 0;
            window.debugSettings.outlineWidth = 2;
            window.debugSettings.selectedOutlineWidth = 5;
            setVisualizationMode('outline');
            break;
    }
    
    // Update UI
    updateDebugUI();
    applyDebugSettings();
}

/**
 * Updates the debug UI to reflect current settings
 */
function updateDebugUI() {
    if (!document.getElementById('debugPanel')) return;
    
    document.getElementById('alphaSlider').value = window.debugSettings.polygonAlpha * 100;
    document.getElementById('alphaValue').textContent = window.debugSettings.polygonAlpha.toFixed(2);
    
    document.getElementById('outlineSlider').value = window.debugSettings.outlineWidth;
    document.getElementById('outlineValue').textContent = window.debugSettings.outlineWidth + 'px';
    
    document.getElementById('selectedOutlineSlider').value = window.debugSettings.selectedOutlineWidth;
    document.getElementById('selectedOutlineValue').textContent = window.debugSettings.selectedOutlineWidth + 'px';
}

/**
 * Exports current debug settings to console
 */
function exportDebugSettings() {
    console.log('Debug Settings:', JSON.stringify(window.debugSettings, null, 2));
    alert('Debug settings exported to console');
}

/**
 * Initialize GPS translation tracking
 */
if (!window.gpsTranslationOffset) {
    window.gpsTranslationOffset = { x: 0, y: 0, z: 0 };
}

/**
 * Adjusts GPS translation for Gaussian Splats by modifying their transform matrix
 * @param {string} axis - 'x', 'y', or 'z'
 * @param {number} increment - Amount to adjust (in meters)
 */
function adjustGPSTranslation(axis, increment) {
    // Update our tracking offset
    window.gpsTranslationOffset[axis] += increment;
    
    console.log(`=== GPS Translation Adjustment ===`);
    console.log(`Axis: ${axis.toUpperCase()}, Increment: ${increment}m`);
    console.log(`Total offset: X=${window.gpsTranslationOffset.x}m, Y=${window.gpsTranslationOffset.y}m, Z=${window.gpsTranslationOffset.z}m`);
    
    // Apply to all loaded Gaussian Splats
    if (window.gaussianSplatManager && window.gaussianSplatManager.loadedTilesets) {
        let updatedCount = 0;
        
        for (const [siteId, tileset] of window.gaussianSplatManager.loadedTilesets.entries()) {
            if (tileset && !tileset.isDestroyed?.()) {
                // Get current transform matrix (4x4 matrix in column-major order)
                const currentMatrix = tileset.modelMatrix.clone();
                
                // Create translation adjustment matrix
                const translationMatrix = new Cesium.Matrix4();
                const translation = new Cesium.Cartesian3();
                
                // Set translation based on axis (in ECEF coordinate system)
                switch(axis) {
                    case 'x':
                        translation.x = increment;
                        break;
                    case 'y': 
                        translation.y = increment;
                        break;
                    case 'z':
                        translation.z = increment;
                        break;
                }
                
                // Create translation matrix
                Cesium.Matrix4.fromTranslation(translation, translationMatrix);
                
                // Apply translation by multiplying current matrix with translation
                const newMatrix = new Cesium.Matrix4();
                Cesium.Matrix4.multiply(translationMatrix, currentMatrix, newMatrix);
                
                // Update the tileset's transform
                tileset.modelMatrix = newMatrix;
                
                console.log(`Updated GPS translation for site: ${siteId}`);
                console.log(`New translation (ECEF): X=${newMatrix[12]}, Y=${newMatrix[13]}, Z=${newMatrix[14]}`);
                
                updatedCount++;
            }
        }
        
        console.log(`Updated ${updatedCount} loaded Gaussian Splat(s)`);
        
        if (updatedCount === 0) {
            console.warn('No Gaussian Splats found to update. Load a splat first.');
        }
    } else {
        console.warn('GaussianSplatManager not available or no splats loaded');
    }
    
    console.log(`==============================`);
}

/**
 * Resets GPS translation to original position
 */
function resetGPSTranslation() {
    console.log(`=== Resetting GPS Translation ===`);
    console.log(`Current offset: X=${window.gpsTranslationOffset.x}m, Y=${window.gpsTranslationOffset.y}m, Z=${window.gpsTranslationOffset.z}m`);
    
    // Apply reverse translation to get back to original position
    adjustGPSTranslation('x', -window.gpsTranslationOffset.x);
    adjustGPSTranslation('y', -window.gpsTranslationOffset.y);
    adjustGPSTranslation('z', -window.gpsTranslationOffset.z);
    
    // Reset tracking
    window.gpsTranslationOffset = { x: 0, y: 0, z: 0 };
    
    console.log('GPS translation reset to original position');
    console.log(`===============================`);
}

/**
 * Logs current GPS translation information to console
 */
function logCurrentGPSTranslation() {
    console.log(`=== Current GPS Translation Status ===`);
    console.log(`Cumulative offset: X=${window.gpsTranslationOffset.x}m, Y=${window.gpsTranslationOffset.y}m, Z=${window.gpsTranslationOffset.z}m`);
    
    if (window.gaussianSplatManager && window.gaussianSplatManager.loadedTilesets) {
        for (const [siteId, tileset] of window.gaussianSplatManager.loadedTilesets.entries()) {
            if (tileset && !tileset.isDestroyed?.()) {
                const matrix = tileset.modelMatrix;
                console.log(`Site: ${siteId}`);
                console.log(`  Current ECEF translation: X=${matrix[12]}, Y=${matrix[13]}, Z=${matrix[14]}`);
                console.log(`  Full transform matrix:`, matrix);
            }
        }
    } else {
        console.log('No Gaussian Splats currently loaded');
    }
    console.log(`====================================`);
}

/**
 * Initializes debug controls
 */
function initializeDebugControls() {
    // Only show in debug mode or if explicitly enabled
    if (window.location.hash === '#debug' || window.debugMode) {
        createDebugToggleButton();
        
        // Create panel if it was previously open
        if (window.debugSettings.showDebugPanel) {
            createDebugPanel();
        }
    }
    
    // Add keyboard shortcut (Ctrl/Cmd + D) - always available
    document.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
            e.preventDefault();
            
            // Create button if it doesn't exist
            if (!document.getElementById('debugToggleButton')) {
                createDebugToggleButton();
            }
            
            toggleDebugPanel();
        }
    });
    
    console.log('Debug controls available. Press Ctrl+D to toggle debug panel.');
}

// Expose functions globally
window.createDebugPanel = createDebugPanel;
window.toggleDebugPanel = toggleDebugPanel;
window.createDebugToggleButton = createDebugToggleButton;
window.resetDebugSettings = resetDebugSettings;
window.applyDebugSettings = applyDebugSettings;
window.initializeDebugControls = initializeDebugControls;
window.setVisualizationMode = setVisualizationMode;
window.applyPreset = applyPreset;
window.updateDebugUI = updateDebugUI;
window.exportDebugSettings = exportDebugSettings;
window.adjustGPSTranslation = adjustGPSTranslation;
window.resetGPSTranslation = resetGPSTranslation;
window.logCurrentGPSTranslation = logCurrentGPSTranslation;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDebugControls);
} else {
    // Add a small delay to ensure all other scripts are loaded
    setTimeout(initializeDebugControls, 100);
}

// Also try to initialize after window load as a fallback
window.addEventListener('load', function() {
    if (!document.getElementById('debugToggleButton')) {
        initializeDebugControls();
    }
});