// Configuration for Terrain 3D application
// Handles differences between local development and production deployment

(function() {
    'use strict';

    // Detect if running locally (localhost or 127.0.0.1 or port 5001/5002)
    const isLocal = window.location.hostname === 'localhost' || 
                   window.location.hostname === '127.0.0.1' ||
                   window.location.port === '5001' ||
                   window.location.port === '5002';

    // Configuration object
    window.TerrainConfig = {
        // Base URL for remote assets when running locally
        remoteBaseUrl: 'https://testing.ecodash.ai',
        
        // Whether we're running locally
        isLocal: isLocal,
        
        // Get the base URL for assets
        getAssetBaseUrl: function() {
            return isLocal ? this.remoteBaseUrl : '';
        },
        
        // Get URL for data files
        getDataUrl: function(path) {
            // For data files, always use remote when running locally
            if (isLocal) {
                return `${this.remoteBaseUrl}/data/${path}`;
            }
            return `/data/${path}`;
        },
        
        // Get URL for SuperSplat
        getSuperSplatUrl: function(path = '') {
            // When running locally, check if we have a local supersplat-build
            // If not, use the remote version to avoid cross-origin issues
            if (isLocal) {
                // For now, always use remote SuperSplat when running locally
                // This avoids cross-origin issues but requires the remote server
                return `${this.remoteBaseUrl}/supersplat/${path}`;
            }
            return `/supersplat/${path}`;
        },
        
        // Get URL for API endpoints
        getApiUrl: function(endpoint) {
            if (isLocal) {
                return `${this.remoteBaseUrl}/api/${endpoint}`;
            }
            return `/api/${endpoint}`;
        },
        
        // Google Cloud Storage base URL (always remote)
        gcsBaseUrl: 'https://storage.googleapis.com/terrain-3d-assets',
        
        // Get GCS URL for a site
        getGcsUrl: function(siteId, file) {
            return `${this.gcsBaseUrl}/${siteId}/${file}`;
        }
    };
    
    // Log configuration on load
    console.log('Terrain 3D Configuration:', {
        isLocal: window.TerrainConfig.isLocal,
        assetBaseUrl: window.TerrainConfig.getAssetBaseUrl(),
        remoteBaseUrl: window.TerrainConfig.remoteBaseUrl
    });
})();