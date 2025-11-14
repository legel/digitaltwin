// Configuration for Terrain 3D application
// Handles differences between local development, staging, and production deployment

(function() {
    'use strict';

    // Detect environment
    const isLocal = window.location.hostname === 'localhost' ||
                   window.location.hostname === '127.0.0.1' ||
                   window.location.port === '5001';

    const isStaging = window.location.hostname === 'staging.ecodash.ai';
    const isProd = window.location.hostname === 'digitaltwin.ecodash.ai';

    // Determine environment name
    let environment = 'local';
    if (isProd) environment = 'production';
    else if (isStaging) environment = 'staging';

    // Configuration object
    window.TerrainConfig = {
        // Environment detection
        environment: environment,
        isLocal: isLocal,
        isStaging: isStaging,
        isProd: isProd,

        // Get URL for data files
        getDataUrl: function(path) {
            // All environments use their own local data
            return `/data/${path}`;
        },

        // Get URL for SuperSplat
        getSuperSplatUrl: function(path = '') {
            // All environments use their own local SuperSplat
            return `/supersplat/${path}`;
        },

        // Get URL for API endpoints
        getApiUrl: function(endpoint) {
            // All environments use their own local API
            return `/api/${endpoint}`;
        },

    };

    // Log configuration on load
    console.log('Terrain 3D Configuration:', {
        environment: window.TerrainConfig.environment,
        isLocal: window.TerrainConfig.isLocal,
        isStaging: window.TerrainConfig.isStaging,
        isProd: window.TerrainConfig.isProd
    });
})();