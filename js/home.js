document.addEventListener("DOMContentLoaded", function () {
    const homeButton = document.getElementById("homeButton");

    /**
     * Handles the "home" button click.
     * If in 3D mode, flies to the user's location using the Cesium viewer.
     * If in 2D mode, pans the Google Maps 2D viewer to the user's location.
     */
    homeButton.addEventListener("click", function () {
        if (window.is3DView) {
            if (window.user) {
                window.user.flyToUser();
            } else {
                console.error("UserManager instance not found.");
            }
        } else {
            if (window.user && window.user.geoData.latitude && window.user.geoData.longitude) {
                const map2D = window.map2D.getMap();
                map2D.panTo({
                    lat: parseFloat(window.user.geoData.latitude),
                    lng: parseFloat(window.user.geoData.longitude)
                });
            } else {
                console.error("UserManager instance or geolocation data not found.");
            }
        }
    });
});

