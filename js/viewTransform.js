document.addEventListener("DOMContentLoaded", function () {
    const viewSwitchButton = document.getElementById("viewSwitchButton");
    const cesiumContainer = document.getElementById("cesiumContainer");
    const map2DContainer = document.getElementById("map2D");

    // Initialize is3DView as true
    window.is3DView = true;

    // Zoom level lookup table
    const zoomHeightLookup = {
        0: 591657550.5, 1: 295828775.3, 2: 147914387.6, 3: 73957193.82, 4: 36978596.91, 
        5: 18489298.45, 6: 9244649.227, 7: 4622324.614, 8: 2311162.307, 9: 1155581.153, 
        10: 577790.5767, 11: 288895.2884, 12: 144447.6442, 13: 72223.82209, 14: 36111.91104, 
        15: 18055.95552, 16: 9027.977761, 17: 4513.98888, 18: 2256.99444, 19: 1128.49722, 
        20: 564.24861, 21: 282.124305, 22: 141.0621525, 23: 70.53107625
    };

    /**
     * Helper function to safely get the camera's cartographic position.
     * Falls back to the center of the scene if necessary.
     */
    function getSafeCartographicPositionForViewSwitch(camera) {
        const cartographic = Cesium.Cartographic.fromCartesian(camera.position);

        let latitude = Cesium.Math.toDegrees(cartographic.latitude);
        let longitude = Cesium.Math.toDegrees(cartographic.longitude);
        let height = cartographic.height;

        if (!isFinite(latitude) || !isFinite(longitude)) {
            console.warn("Invalid latitude or longitude, using scene center as fallback.");
            const sceneCenter = Cesium.Rectangle.center(camera.computeViewRectangle());
            latitude = Cesium.Math.toDegrees(sceneCenter.latitude);
            longitude = Cesium.Math.toDegrees(sceneCenter.longitude);
            height = height || 1000; // Default to 1000 meters if height is also invalid
        }

        return { latitude, longitude, height };
    }

   
    /**
     * Maps the given height in meters to the closest zoom level using the zoomHeightLookup table.
     * @param {number} height - The height in meters.
     * @returns {number} - The closest zoom level.
     */
    function mapHeightToZoomLevel(height) {
        const zoomLevels = Object.keys(zoomHeightLookup).map(Number);
        let closestZoomLevel = zoomLevels[0];
        let smallestDifference = Math.abs(zoomHeightLookup[closestZoomLevel] - height);

        for (let i = 1; i < zoomLevels.length; i++) {
            const currentZoomLevel = zoomLevels[i];
            const difference = Math.abs(zoomHeightLookup[currentZoomLevel] - height);

            if (difference < smallestDifference) {
                closestZoomLevel = currentZoomLevel;
                smallestDifference = difference;
            }
        }

        return closestZoomLevel;
    }

    /**
     * Handles the "2D/3D view switch" button click.
     * Switches between 2D and 3D views, maintaining the current camera position and settings.
     */
    // DISABLED: This functionality is now handled by view2D.js
    if (false && viewSwitchButton) {
        viewSwitchButton.addEventListener("click", async function () {
        if (window.is3DView) {
            // Switch from 3D to 2D
            const cesiumViewer = window.map3D.getViewer();
            const cesiumCamera = cesiumViewer.scene.camera;
            const { latitude, longitude, height } = getSafeCartographicPositionForViewSwitch(cesiumCamera);

            const closestZoomLevel = mapHeightToZoomLevel(height);

            cesiumViewer.scene.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, zoomHeightLookup[closestZoomLevel]),
                orientation: {
                    heading: cesiumCamera.heading,
                    pitch: -Cesium.Math.PI_OVER_TWO,
                    roll: cesiumCamera.roll,
                },
                duration: 1.0,
                complete: () => {
                    map2DContainer.style.display = "block";
                    cesiumContainer.style.display = "none";
                    const map2D = window.map2D.getMap();
                    map2D.setCenter({ lat: latitude, lng: longitude });
                    map2D.setZoom(parseInt(closestZoomLevel));
                    viewSwitchButton.textContent = "3D";
                }
            });
        } else {
            // Switch from 2D to 3D
            const map2D = window.map2D.getMap();
            const center = map2D.getCenter();
            const latitude = center.lat();
            const longitude = center.lng();
            const zoom = map2D.getZoom();

            const height = zoomHeightLookup[zoom] || 1000;

            const cesiumViewer = window.map3D.getViewer();
            cesiumViewer.scene.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
                orientation: {
                    heading: 0.0,
                    pitch: -Cesium.Math.PI_OVER_TWO,
                    roll: 0.0,
                },
                duration: 0.0,
            });

            map2DContainer.style.display = "none";
            cesiumContainer.style.display = "block";
            viewSwitchButton.textContent = "2D";
        }

        window.is3DView = !window.is3DView; // Toggle the view state
        });
    }
});


