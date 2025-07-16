document.addEventListener("DOMContentLoaded", function () {
    // Inject custom CSS to hide Google Maps rotate and tilt controls
    const style = document.createElement('style');
    style.innerHTML = `
        /* Hide the entire control container */
        .gm-bundled-control {
            display: none !important;
            opacity: 0 !important;
            pointer-events: none !important;
            position: absolute !important;
            top: -9999px !important;
        }

        /* Hide individual buttons in case they are managed separately */
        .gm-bundled-control-on-bottom button[aria-label^="Rotate map"],
        .gm-bundled-control-on-bottom .gm-tilt,
        .gm-bundled-control-on-bottom {
            display: none !important;
            opacity: 0 !important;
            pointer-events: none !important;
            position: absolute !important;
            top: -9999px !important;
        }
    `;
    document.head.appendChild(style);

    const tilt0Button = document.getElementById("tilt0Button");
    const tilt45Button = document.getElementById("tilt45Button");

    /**
     * Handles the "tilt 0 degrees" button click.
     * 3D: Tilts the camera to face directly downward.
     * 2D: Sets the map tilt to 0 degrees.
     */
    tilt0Button.addEventListener("click", function () {
        if (window.is3DView) {
            const cesiumViewer = window.map3D.getViewer();
            const cesiumCamera = cesiumViewer.scene.camera;
            const { latitude, longitude, height } = getSafeCartographicPosition(cesiumCamera);

            cesiumCamera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
                orientation: {
                    heading: cesiumCamera.heading,
                    pitch: -Cesium.Math.PI_OVER_TWO, // Face directly downward
                    roll: cesiumCamera.roll,
                },
                duration: 1.0
            });
        } else {
            const map2D = window.map2D.getMap();
            map2D.setTilt(0); // Set tilt to 0 degrees
        }
    });

    /**
     * Handles the "tilt 45 degrees" button click.
     * 3D: Tilts the camera to a 45-degree angle from the ground.
     * 2D: Sets the map tilt to 45 degrees.
     */
    tilt45Button.addEventListener("click", function () {
        if (window.is3DView) {
            const cesiumViewer = window.map3D.getViewer();
            const cesiumCamera = cesiumViewer.scene.camera;
            const { latitude, longitude, height } = getSafeCartographicPosition(cesiumCamera);

            cesiumCamera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
                orientation: {
                    heading: cesiumCamera.heading,
                    pitch: -Cesium.Math.PI_OVER_FOUR, // Tilt to 45 degrees
                    roll: cesiumCamera.roll,
                },
                duration: 1.0
            });
        } else {
            const map2D = window.map2D.getMap();
            map2D.setTilt(45); // Set tilt to 45 degrees
        }
    });

    // Initial hide call if the buttons are already present
    //window.hideRotateControlButtons = function () {
    //    document.head.appendChild(style);
    //};
    
    //window.hideRotateControlButtons();
});


