/**
 * CoordinateTransform - Handles conversion between geographic coordinates and SuperSplat local coordinates
 * Uses site-bounds.json for coordinate reference system without Cesium dependency
 */
class CoordinateTransform {
    constructor() {
        this.siteBounds = null;
        this.isLoaded = false;
        this.loadPromise = this.loadSiteBounds();
    }

    /**
     * Load site bounds data from JSON file
     */
    async loadSiteBounds(siteId = 'scott-boyd-residence') {
        try {
            const response = await fetch(`/data/${siteId}/site-bounds.json`);
            if (!response.ok) {
                throw new Error(`Failed to load site-bounds.json: ${response.status}`);
            }

            this.siteBounds = await response.json();
            this.isLoaded = true;


            return this.siteBounds;
        } catch (error) {
            console.error('❌ Failed to load site bounds:', error);
            throw error;
        }
    }

    /**
     * Ensure site bounds are loaded before transforming coordinates
     */
    async ensureLoaded() {
        if (!this.isLoaded) {
            await this.loadPromise;
        }
        return this.siteBounds;
    }

    /**
     * Transform geographic coordinates (lon, lat) to SuperSplat local coordinates
     * Uses dynamic scaling based on actual splat bounds
     * @param {number} longitude - Longitude in degrees
     * @param {number} latitude - Latitude in degrees
     * @param {number} elevation - Elevation in meters (optional, not used for Y coordinate)
     * @param {Object} splatBounds - SuperSplat bounds for dynamic scaling (optional)
     * @param {Object} geoBounds - Geographic bounds for reference (optional)
     * @returns {Object} SuperSplat coordinates {x, y, z}
     */
    geoToSuperSplat(longitude, latitude, elevation = 0, splatBounds = null, geoBounds = null) {
        if (!this.isLoaded || !this.siteBounds) {
            throw new Error('Site bounds not loaded. Call ensureLoaded() first.');
        }

        const center = this.siteBounds.center;

        // Calculate deltas from site center in geographic coordinates
        const deltaLon = longitude - center.longitude;
        const deltaLat = latitude - center.latitude;

        if (splatBounds && geoBounds) {
            // Dynamic scaling based on actual splat and geographic bounds
            const geoWidth = geoBounds.east - geoBounds.west;
            const geoHeight = geoBounds.north - geoBounds.south;

            // Calculate scale factors to map geographic deltas to SuperSplat deltas
            const scaleX = splatBounds.width / geoWidth;
            const scaleZ = splatBounds.height / geoHeight;

            // Apply scale correction factor from site bounds
            const scaleCorrectionFactor = this.siteBounds.scale_correction_factor || 1.0;

            // Transform to SuperSplat coordinates
            const superSplatX = deltaLon * scaleX * scaleCorrectionFactor;
            const superSplatY = 0; // Fixed Y-plane handled by SuperSplat triangle overlay
            const superSplatZ = -deltaLat * scaleZ * scaleCorrectionFactor; // Negate Z to fix north-south orientation

            return {
                x: superSplatX,
                y: superSplatY,
                z: superSplatZ
            };
        } else {
            // FALLBACK WARNING: This should not happen when splat bounds are available
            console.error('❌ COORDINATE TRANSFORM FALLBACK: Using inaccurate static scaling');
            console.error('❌ This indicates splatBounds or geoBounds were not provided');
            console.error('❌ Expected: geoToSuperSplat(lon, lat, elevation, splatBounds, geoBounds)');
            console.error(`❌ Received: geoToSuperSplat(${longitude}, ${latitude}, ${elevation}, ${splatBounds ? 'PROVIDED' : 'NULL'}, ${geoBounds ? 'PROVIDED' : 'NULL'})`);

            // For this site, splat bounds should always be available - this fallback indicates a bug
            console.trace('❌ Stack trace for static fallback usage:');

            // Still provide fallback to prevent crashes, but with clear warnings
            const scaleFactor = 100.0; // Default scale factor

            // Convert degrees to meters using standard conversion
            const centerLatRad = center.latitude * Math.PI / 180;
            const lonToMeters = deltaLon * 111320 * Math.cos(centerLatRad);
            const latToMeters = deltaLat * 111320;

            // Apply scale correction factor from site bounds
            const scaleCorrectionFactor = this.siteBounds.scale_correction_factor || 1.0;

            // Apply scale factor to fit SuperSplat coordinate system
            const superSplatX = lonToMeters * (scaleFactor / 111320) * scaleCorrectionFactor; // East-West
            const superSplatY = 0; // Fixed Y-plane handled by SuperSplat triangle overlay
            const superSplatZ = -latToMeters * (scaleFactor / 111320) * scaleCorrectionFactor; // North-South (negated for SuperSplat orientation)

            console.warn(`⚠️ FALLBACK RESULT: (${longitude}, ${latitude}) → (${superSplatX.toFixed(3)}, ${superSplatZ.toFixed(3)}) - POTENTIALLY INACCURATE`);

            return {
                x: superSplatX,
                y: superSplatY,
                z: superSplatZ
            };
        }
    }

    /**
     * Calculate bounding box of all features in GeoJSON data
     * @param {Object} geoJsonData - GeoJSON FeatureCollection
     * @returns {Object} Geographic bounds {west, east, south, north}
     */
    calculateGeoJSONBounds(geoJsonData) {
        if (!geoJsonData || !geoJsonData.features || geoJsonData.features.length === 0) {
            throw new Error('Invalid GeoJSON data provided');
        }

        let bounds = {
            west: Infinity,
            east: -Infinity,
            south: Infinity,
            north: -Infinity
        };

        geoJsonData.features.forEach(feature => {
            if (!feature.geometry) return;

            if (feature.geometry.type === 'Polygon') {
                // Single polygon - process all coordinate rings (outer + holes)
                feature.geometry.coordinates.forEach(ring => {
                    this.updateBoundsWithCoordinates(bounds, ring);
                });
            } else if (feature.geometry.type === 'MultiPolygon') {
                // Multiple polygons - process each polygon's rings
                feature.geometry.coordinates.forEach(polygon => {
                    polygon.forEach(ring => {
                        this.updateBoundsWithCoordinates(bounds, ring);
                    });
                });
            } else if (feature.geometry.type === 'Point') {
                // Single point
                const [lon, lat] = feature.geometry.coordinates;
                bounds.west = Math.min(bounds.west, lon);
                bounds.east = Math.max(bounds.east, lon);
                bounds.south = Math.min(bounds.south, lat);
                bounds.north = Math.max(bounds.north, lat);
            }
        });

        // Calculate center and dimensions
        const center = {
            longitude: (bounds.west + bounds.east) / 2,
            latitude: (bounds.south + bounds.north) / 2
        };

        const dimensions = {
            width_degrees: bounds.east - bounds.west,
            height_degrees: bounds.north - bounds.south,
            width_meters: (bounds.east - bounds.west) * 111320 * Math.cos(center.latitude * Math.PI / 180),
            height_meters: (bounds.north - bounds.south) * 111320
        };

        return {
            ...bounds,
            center,
            dimensions
        };
    }

    /**
     * Update bounds object with coordinate array
     * @param {Object} bounds - Bounds object to update
     * @param {Array} coordinates - Array of [lon, lat] or [lon, lat, elevation] coordinates
     */
    updateBoundsWithCoordinates(bounds, coordinates) {
        coordinates.forEach(coord => {
            const [lon, lat] = coord;
            bounds.west = Math.min(bounds.west, lon);
            bounds.east = Math.max(bounds.east, lon);
            bounds.south = Math.min(bounds.south, lat);
            bounds.north = Math.max(bounds.north, lat);
        });
    }

    /**
     * Create a rectangle polygon for the outer bounds of GeoJSON data
     * Uses dynamic scaling based on actual splat bounds
     * @param {Object} geoJsonData - GeoJSON FeatureCollection
     * @param {Object} splatBounds - SuperSplat bounds for dynamic scaling (optional)
     * @returns {Array} Array of SuperSplat coordinate vertices for rectangle
     */
    async createBoundsRectangle(geoJsonData, splatBounds = null) {
        await this.ensureLoaded();

        const geoBounds = this.calculateGeoJSONBounds(geoJsonData);

        console.log('📐 GeoJSON Geographic Bounds:', {
            west: geoBounds.west.toFixed(8),
            east: geoBounds.east.toFixed(8),
            south: geoBounds.south.toFixed(8),
            north: geoBounds.north.toFixed(8),
            center: {
                lon: geoBounds.center.longitude.toFixed(8),
                lat: geoBounds.center.latitude.toFixed(8)
            },
            dimensions: {
                width_degrees: geoBounds.dimensions.width_degrees.toFixed(8),
                height_degrees: geoBounds.dimensions.height_degrees.toFixed(8),
                width_meters: geoBounds.dimensions.width_meters.toFixed(2),
                height_meters: geoBounds.dimensions.height_meters.toFixed(2)
            }
        });

        // Log splat bounds if available
        if (splatBounds) {
            console.log('🎨 SuperSplat Bounds (from loaded splat):', {
                center: splatBounds.center,
                width: splatBounds.width.toFixed(3),
                height: splatBounds.height.toFixed(3),
                depth: splatBounds.depth.toFixed(3)
            });

            // Calculate scale factors
            const scaleX = splatBounds.width / (geoBounds.east - geoBounds.west);
            const scaleZ = splatBounds.height / (geoBounds.north - geoBounds.south);

            console.log('⚖️ Dynamic Scale Factors:', {
                scaleX: scaleX.toFixed(6),
                scaleZ: scaleZ.toFixed(6),
                note: 'These scales map geographic degrees to SuperSplat units'
            });
        }

        // Create rectangle vertices using dynamic scaling if available
        const rectangleVertices = [
            this.geoToSuperSplat(geoBounds.west, geoBounds.south, 0, splatBounds, geoBounds),   // Bottom-left (SW)
            this.geoToSuperSplat(geoBounds.east, geoBounds.south, 0, splatBounds, geoBounds),   // Bottom-right (SE)
            this.geoToSuperSplat(geoBounds.east, geoBounds.north, 0, splatBounds, geoBounds),   // Top-right (NE)
            this.geoToSuperSplat(geoBounds.west, geoBounds.north, 0, splatBounds, geoBounds)    // Top-left (NW)
        ];

        // Calculate SuperSplat bounds
        const superSplatBounds = {
            minX: Math.min(...rectangleVertices.map(v => v.x)),
            maxX: Math.max(...rectangleVertices.map(v => v.x)),
            minZ: Math.min(...rectangleVertices.map(v => v.z)),
            maxZ: Math.max(...rectangleVertices.map(v => v.z))
        };

        const superSplatCenter = {
            x: (superSplatBounds.minX + superSplatBounds.maxX) / 2,
            y: 0,
            z: (superSplatBounds.minZ + superSplatBounds.maxZ) / 2
        };

        console.log('🎯 SuperSplat Coordinate System:', {
            bounds_rectangle_vertices: rectangleVertices.map((v, i) => ({
                corner: ['SW', 'SE', 'NE', 'NW'][i],
                x: v.x.toFixed(3),
                y: v.y.toFixed(3),
                z: v.z.toFixed(3)
            })),
            supersplat_bounds: {
                minX: superSplatBounds.minX.toFixed(3),
                maxX: superSplatBounds.maxX.toFixed(3),
                minZ: superSplatBounds.minZ.toFixed(3),
                maxZ: superSplatBounds.maxZ.toFixed(3),
                width: (superSplatBounds.maxX - superSplatBounds.minX).toFixed(3),
                height: (superSplatBounds.maxZ - superSplatBounds.minZ).toFixed(3)
            },
            supersplat_center: {
                x: superSplatCenter.x.toFixed(3),
                y: superSplatCenter.y.toFixed(3),
                z: superSplatCenter.z.toFixed(3)
            }
        });

        // Log comparison with splat bounds if available
        if (splatBounds) {
            console.log('🔄 Coordinate Mapping Validation:', {
                expected_rectangle_size: {
                    width: splatBounds.width.toFixed(3),
                    height: splatBounds.height.toFixed(3)
                },
                actual_rectangle_size: {
                    width: (superSplatBounds.maxX - superSplatBounds.minX).toFixed(3),
                    height: (superSplatBounds.maxZ - superSplatBounds.minZ).toFixed(3)
                },
                should_match: 'If scaling is correct, these should be very close'
            });
        }

        // Log splat reference information
        console.log('🗺️ Coordinate Reference Summary:', {
            geographic_center: this.siteBounds.center,
            supersplat_origin: { x: 0, y: 0, z: 0 },
            scaling_method: splatBounds ? 'Dynamic (based on actual splat)' : 'Static (from site-bounds.json)',
            scale_correction_factor: this.siteBounds.scale_correction_factor || 1.0
        });

        return rectangleVertices;
    }

}

// Create global instance
window.coordinateTransform = new CoordinateTransform();

