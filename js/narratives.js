/**
 * Introduction tutorial for Vizcaya gardens. Executes a sequence of flyTo operations
 * to introduce the user to the area.
 */

function introductionTutorialToVizcaya() {
    // Define the sequence of flyTo operations
    const flyTos = [
        [-80.21270832, 25.73525567, 39307973.51, 0.03466175, -1.56851702, 0.00000000, 3, "Hello, World!", 0.0, 0.5, 2, 1],
        [-80.21285868, 25.73001613, 53948.20, 0.03021560, -1.54988417, 0.00000000, 4],
        [-80.14504644, 25.63678763, 2808.53, 5.92408891, -0.39930220, 0.00024207, 3, "Welcome to Miami!", 2.0, 0.5, 5, 1],
        [-80.21104660, 25.74188074, 194.69, 0.03691171, -0.80323003, 0.00000814, 6],
        [-80.21140294, 25.74380123, 174.30, 0.91436036, -1.54123018, 0.00000000, 5, "Enjoy the Italian gardens of __Vizcaya__, [[crafted over 100 years ago]](https://vizcaya.org/100-years-of-gardens/).", 0.0, 0.5, 4, 0.5],
    ];

    // Start the flyTo sequence with a callback to create the next button
    flyToSequence(window.map3D, flyTos, () => {
        // Create the "Learn more about user interface" button after the sequence completes
        const learnMoreButton = createReusableButton("Learn more about user interface", () => {
            // Remove the button when clicked
            document.body.removeChild(learnMoreButton);
            // Start the navigation tutorial
            navigationTutorial();
        }, {
            id: "learnMoreButton",
            bottom: "150px", // Position it appropriately
            left: "50%",
            transform: "translateX(-50%)"
        });

        document.body.appendChild(learnMoreButton); // Add the button to the DOM
    });
}

/**
 * Introduction tutorial for Dix.Hite + Partners in Orlando.
 */
function introductionTutorialToDixHite() {
    // Define the sequence of flyTo operations
    const flyTos = [
        [-80.21270832, 25.73525567, 39307973.51, 0.03466175, -1.56851702, 0.00000000, 12, "Hello, World!", 2.0, 3.0, 5.0, 2.0],
        // // Start zoomed out over Florida/Orlando
        // [-81.34, 28.70, 39000000, 0, -1.5, 0, 3],
        // Zoom into the Orlando area
        [-81.34, 28.70, 50000, 0, -1.5, 0, 60, "Welcome to Orlando!", 55.0, 2.0, 10.0, 2.0],
        // Fly to the specific coordinates and display the message
        [-81.34789612, 28.70151416, 14.30, 2.20525028, -0.36264495, 6.28318512, 60, "Welcome to the Barn of Dix.Hite + Partners Landscape Architects!", 55.0, 2.0, 10.0, 2.0],
    ];


    


    // Start the flyTo sequence (no callback specified for now)
    flyToSequence(window.map3D, flyTos);
}

function navigationTutorial() {
    // Define the sequence of flyTo operations
    const flyTos = [
        [-80.21273442, 25.74350871, 124.85, 1.47695507, -0.71515938, 6.28318298, 5, "Explore in 3D by {{\"smartphone_with_touchscreen\": \"__moving__ your finger on the **touchscreen**\", \"laptop_with_trackpad\": \"__clicking__ and __dragging__ your finger on the **trackpad**\", \"desktop_with_mouse\": \"__left-clicking__ and __dragging__ your **mouse**\"}}", 0.5, 0.5, 3.5, 0.5, 1.0],

        [-80.21153736, 25.74520582, 82.69, 3.08099801, -0.44258411, 6.28318434, 5, "See a new perspective: {{\"smartphone_with_touchscreen\": \"try __rotating__ two fingers on the **touchscreen**\", \"laptop_with_trackpad\": \"try __holding__ **ctrl** and __dragging__ the **trackpad**\", \"desktop_with_mouse\": \"__hold__ **ctrl** and __drag__ your **mouse**\"}}", 0.5, 0.5, 3.5, 0.5, 1.5],

        [-80.21191402, 25.75082829, 378.49, 3.08099514, -0.44268254, 6.28318438, 5, "Zoom out {{\"smartphone_with_touchscreen\": \"by __pinching__ two fingers\", \"laptop_with_trackpad\": \"by __dragging__ two fingers across the **trackpad**\", \"desktop_with_mouse\": \"simply via the **mouse scroll wheel**\"}}", 0.5, 0.5, 3.5, 0.5, 1.5],

        [-80.21085616, 25.74393026, 485.38, 0.94229633, -1.57079624, 0.00000000, 6, "Hit the **2D** button to view sharper renders.", 2.25, 0.5, 3.0, 0.25, 2.0],
        //[-80.21085616, 25.74393026, 485.38, 0.94229633, -1.57079624, 0.00000000, 6, "In **2D** view mode, try **down left ↙** button for a 45° angle, vs. **down arrow ↓** button for top-down view." , 2.25, 0.5, 3.0, 0.25, 2.0]

        //[-80.21085616, 25.74393026, 485.38, 0.94229633, -1.57079624, 0.00000000, 6, "Also try the rotation buttons, especially when viewing at a 45° in 2D satellite view mode -- stunning imagery." , 2.25, 0.5, 3.0, 0.25, 2.0]
    ];

    // Start the flyTo sequence
    flyToSequence(window.map3D, flyTos);
}

/**
 * Introduction to Scott Boyd's residence site in Winter Garden, Florida.
 * Simple 3-second zoom with welcome message.
 */
function introductionToScottBoydSite() {
    // Define the sequence - single flyTo operation
    // Center coordinates: -81.65699333, 28.52165138
    // Height of 300m for good overview of the property
    const flyTos = [
        // longitude, latitude, height, heading, pitch, roll, duration, message, messageDelay, fadeIn, displayTime, fadeOut
        [-81.65905485, 28.51935345, 400.0, 0.41942449, -0.66485765, 0.00000298, 3, "Welcome to Winter Garden, Florida!", 3.0, 0.5, 2.0, 0.5]
    ];
    
    // Start the flyTo sequence
    flyToSequence(window.map3D, flyTos);
}

// Expose the function globally
window.introductionTutorialToVizcaya = introductionTutorialToVizcaya;
window.navigationTutorial = navigationTutorial;
window.introductionTutorialToDixHite = introductionTutorialToDixHite;
window.introductionToScottBoydSite = introductionToScottBoydSite;
