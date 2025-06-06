function flyToSequence(cesiumManager, flyTos, callback) {
    console.log("Starting flyToSequence");

    // Initialize stop flag at the start of each sequence and make it globally accessible
    window.stopFlyThrough = false;
    window.currentFlyThroughActive = true;  // Track if a flythrough is currently active
    let currentIndex = 0;  // Track the current index in the flyTo sequence
    const viewer = cesiumManager.getViewer();

    // Create the continuation button using the reusable button function
    const continueButton = createReusableButton("Continue discovery experience", () => {
        window.stopFlyThrough = false;  // Reset the stop flag
        handler = addEventHandlers();  // Re-add event handlers for future interruptions
        continueFlythrough();  // Resume the flythrough
    }, {
        id: "continueFlythroughButton",
        bottom: "110px",
        left: "50%",
        transform: "translateX(-50%)"
    });

    // Initially hide the continue button
    continueButton.style.display = "none";

    function addEventHandlers() {
        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

        handler.setInputAction(() => {
            window.stopFlyThrough = true;
            console.log("Mouse interaction detected - stopping flythrough.");
            handler.destroy();  // Remove all handlers when stopping the flythrough

            // Show the continue button
            continueButton.style.display = "flex";
        }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

        handler.setInputAction(() => {
            if (window.stopFlyThrough) {
                handler.destroy();  // Clean up if the flythrough was stopped
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        return handler;
    }

    let handler = addEventHandlers();  // Initialize the event handler for the first time

    // Function to continue the flythrough sequence
    async function continueFlythrough() {
        console.log("Continuing flythrough from index:", currentIndex);
        continueButton.style.display = "none";  // Hide the button when resuming

        while (currentIndex < flyTos.length) {
            if (window.stopFlyThrough) {
                console.log("Flythrough stopped early by user.");
                break;
            }

            // Destructure the current flyTo parameters, ensuring correct lat/lon order
            const [
                lon, lat, height, heading, pitch, roll, duration,
                message = "", messageDelayStartTime = 0.5, fadeInTime = 0.5,
                displayTime = 3, fadeOutTime = 0.5, postMessageDelay = 0.0
            ] = flyTos[currentIndex];

            console.log("Flying to:", { lat, lon, height, heading, pitch, roll });

            // Update the final destination for the home button override
            cesiumManager.setFinalDestination(lat, lon, height, heading, pitch, roll);

            // Start the flyTo action
            viewer.scene.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(lon, lat, height),  // Corrected order: lon first, then lat
                orientation: {
                    heading: heading,
                    pitch: pitch,
                    roll: roll,
                },
                duration: duration,
            });

            // Display the message after the specified delay
            if (message) {
                setTimeout(() => {
                    if (!window.stopFlyThrough) {
                        displayMessage(message, fadeInTime, displayTime, fadeOutTime);
                    }
                }, messageDelayStartTime * 1000);
            }

            // Wait for the flyTo to complete before moving to the next step
            await new Promise(resolve => setTimeout(resolve, duration * 1000));

            // Implement post-message delay if specified
            if (postMessageDelay > 0.0) {
                await new Promise(resolve => setTimeout(resolve, postMessageDelay * 1000));
            }

            currentIndex++;  // Move to the next waypoint in the sequence
        }

        if (!window.stopFlyThrough) {
            handler.destroy();  // Clean up after the sequence completes without interruption
            if (callback) {
                callback();  // Run the callback if provided
            }
        }
        
        window.currentFlyThroughActive = false;  // Mark flythrough as no longer active
    }

    // Start the flythrough sequence
    continueFlythrough();
}




// Function to print the current view configuration to the console
function printViewConfiguration(viewer) {
    const camera = viewer.scene.camera;
    const cartographic = Cesium.Cartographic.fromCartesian(camera.position);

    const latitude = Cesium.Math.toDegrees(cartographic.latitude);
    const longitude = Cesium.Math.toDegrees(cartographic.longitude);
    const height = cartographic.height;

    const heading = camera.heading;
    const pitch = camera.pitch;
    const roll = camera.roll;

    console.log(`${longitude.toFixed(8)}, ${latitude.toFixed(8)}, ${height.toFixed(2)}, ${heading.toFixed(8)}, ${pitch.toFixed(8)}, ${roll.toFixed(8)}, 0,`);
}
