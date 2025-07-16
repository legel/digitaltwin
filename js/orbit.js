document.addEventListener("DOMContentLoaded", function () {
    const rotateRightButton = document.getElementById("rotateRightButton");
    const rotateLeftButton = document.getElementById("rotateLeftButton");

	/**
	 * Helper function to ensure zoom level is sufficient for 45-degree tilt.
	 * @param {google.maps.Map} map - The Google Maps instance.
	 * @returns {boolean} - True if the zoom level is adequate, false otherwise.
	 */
	function isZoomLevelSufficient(map) {
	    const minTiltedZoom = 17; // Define a suitable zoom threshold
	    return map.getZoom() >= minTiltedZoom;
	}

    /**
     * Helper function to get the safe cartographic position.
     * @param {Cesium.Camera} camera - The Cesium camera instance.
     * @returns {Object} An object containing latitude, longitude, and height.
     */
    function getSafeCartographicPosition(camera) {
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

    window.getSafeCartographicPosition = getSafeCartographicPosition;

    /**
     * Handles the "rotate right 90 degrees" button click.
     */
    rotateRightButton.addEventListener("click", function () {
        if (window.is3DView) {
            // 3D rotation logic
            const cesiumViewer = window.map3D.getViewer();
            const cesiumCamera = cesiumViewer.scene.camera;
            const { latitude, longitude, height } = getSafeCartographicPosition(cesiumCamera);

            const newHeading = cesiumCamera.heading - Cesium.Math.PI_OVER_TWO;

            cesiumCamera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
                orientation: {
                    heading: newHeading, // Rotate right
                    pitch: cesiumCamera.pitch,
                    roll: cesiumCamera.roll,
                },
                duration: 1.0
            });
        } else {
            const map2D = window.map2D.getMap();

            if (isZoomLevelSufficient(map2D)) {
                // Simulate a click on the Google Maps rotate clockwise control
                const rotateControlButton = document.querySelector('button[aria-label="Rotate map clockwise"]');
                rotateControlButton.click();
            } else {
                const currentHeading = map2D.getHeading();
                const newHeading = currentHeading + 90;

                if (currentHeading !== newHeading) {
                    map2D.setHeading(newHeading);
                }
            }
        }
    });

    /**
     * Handles the "rotate left 90 degrees" button click.
     */
    rotateLeftButton.addEventListener("click", function () {
        if (window.is3DView) {
            // 3D rotation logic
            const cesiumViewer = window.map3D.getViewer();
            const cesiumCamera = cesiumViewer.scene.camera;
            const { latitude, longitude, height } = getSafeCartographicPosition(cesiumCamera);

            const newHeading = cesiumCamera.heading + Cesium.Math.PI_OVER_TWO;

            cesiumCamera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
                orientation: {
                    heading: newHeading, // Rotate left
                    pitch: cesiumCamera.pitch,
                    roll: cesiumCamera.roll,
                },
                duration: 1.0
            });
        } else {
            const map2D = window.map2D.getMap();

            if (isZoomLevelSufficient(map2D)) {
                // Simulate a click on the Google Maps rotate counterclockwise control
                const rotateControlButton = document.querySelector('button[aria-label="Rotate map counterclockwise"]');
                rotateControlButton.click();
            } else {
                const currentHeading = map2D.getHeading();
                const newHeading = currentHeading - 90;

                if (currentHeading !== newHeading) {
                    map2D.setHeading(newHeading);
                }
            }
        }
    });
});

