/**
 * Creates a reusable button with an "x" sub-button for closing.
 * @param {string} buttonText - The text to display on the button.
 * @param {Function} onClick - The function to execute when the main button is clicked.
 * @param {Object} options - Additional options for the button (e.g., position, ID).
 */
function createReusableButton(text, onClick, options = {}) {
    const button = document.createElement("div");
    button.style.position = "absolute";
    button.style.backgroundColor = "#072b2eff";
    button.style.color = "white";
    button.style.borderRadius = "40px";
    button.style.fontSize = "14px";
    button.style.fontWeight = "700";
    button.style.display = "flex";
    button.style.alignItems = "center";
    button.style.cursor = "pointer";
    button.style.padding = "10px 20px 10px 30px"; // Padding around the content

    // Create a temporary span to measure text width and height
    const tempSpan = document.createElement("span");
    tempSpan.style.fontSize = "14px";
    tempSpan.style.fontWeight = "700";
    tempSpan.style.visibility = "hidden"; // Hide it from view
    tempSpan.style.whiteSpace = "nowrap"; // Prevent text from wrapping
    tempSpan.textContent = text;
    document.body.appendChild(tempSpan);

    const textWidth = tempSpan.offsetWidth;
    const textHeight = tempSpan.offsetHeight;
    document.body.removeChild(tempSpan); // Remove the temporary span

    // Calculate the button's height dynamically
    const buttonHeight = textHeight + 20 + "px"; // Add 10px padding above and below text

    // Calculate the button's width dynamically
    const xButtonWidth = 25 + 5 + 20; // Width of the x button (25px) + right padding (5px) + left padding (20px)
    const buttonWidth = textWidth + xButtonWidth + "px";

    button.style.height = buttonHeight;
    button.style.width = buttonWidth;

    // Add the close "x" button
    const closeButton = document.createElement("div");
    closeButton.style.width = "25px";
    closeButton.style.height = "25px";
    closeButton.style.backgroundImage = "url('/images/x.png')";
    closeButton.style.backgroundSize = "contain";
    closeButton.style.backgroundRepeat = "no-repeat";
    closeButton.style.border = "2px solid white"; // Circular white border
    closeButton.style.borderRadius = "50%"; // Ensuring it's a circle
    closeButton.style.cursor = "pointer";
    closeButton.style.position = "absolute";
    closeButton.style.right = "20px"; // 20px padding to the right of the "x" button
    closeButton.style.top = "50%"; // Center vertically
    closeButton.style.transform = "translateY(-50%)"; // Adjust positioning

    closeButton.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent triggering the main button's click event
        button.style.display = "none";
    });

    // Create a container for text and the "x" button to align them properly
    const container = document.createElement("div");
    container.style.display = "flex";
    container.style.alignItems = "center";
    container.style.justifyContent = "space-between";
    container.style.width = `calc(${buttonWidth} - 40px)`; // Subtract padding for proper width
    container.style.height = buttonHeight; // Explicitly set the height

    // Wrap the text in a div to explicitly define its dimensions
    const textDiv = document.createElement("div");
    textDiv.style.flexGrow = "1";
    textDiv.style.overflow = "hidden"; // Prevent overflow
    textDiv.style.whiteSpace = "nowrap"; // Prevent text wrapping
    textDiv.textContent = text;

    container.appendChild(textDiv);
    container.appendChild(closeButton);

    button.appendChild(container);

    // Apply custom styles from options
    if (options.id) button.id = options.id;
    if (options.bottom) button.style.bottom = options.bottom;
    if (options.left) button.style.left = options.left;
    if (options.transform) button.style.transform = options.transform;

    // Add the click event listener for the main button
    button.addEventListener("click", (e) => {
        onClick(e);  // Call the provided callback function when the button is clicked
    });

    document.body.appendChild(button);

    return button;
}

/**
 * Parses a markdown-style string and converts it to HTML.
 * Supports links in the format [[Link text]](https://url-here.com).
 * Supports bold text using **text** and italic text using __text__.
 * Supports conditional text based on device type.
 * @param {string} text - The markdown-style text to parse.
 * @param {string} deviceType - The device type for conditional text rendering.
 * @returns {string} - The parsed HTML string.
 */
function parseMarkdown(text, deviceType) {
    const linkPattern = /\[\[(.*?)\]\]\((.*?)\)/g;
    const boldPattern = /\*\*(.*?)\*\*/g;
    const italicPattern = /__(.*?)__/g;
    const devicePattern = /\{\{(.*?)\}\}/g;

    // Custom parser to extract and parse device-specific content
    const parseDeviceSpecificText = (content) => {
        try {
            const deviceContent = {};
            const entries = content.split('",').map(entry => entry.trim());

            entries.forEach(entry => {
                const [key, value] = entry.split(/:(.+)/).map(part => part.trim().replace(/^"|"$/g, ''));
                deviceContent[key] = value;
            });

            return deviceContent[deviceType] || "";
        } catch (error) {
            console.error("Failed to parse device-specific content:", error);
            return "";
        }
    };

    // Replace markdown patterns with corresponding HTML
    let parsedText = text
        .replace(linkPattern, '<a href="$2" target="_blank">$1</a>')
        .replace(boldPattern, '<span style="font-weight: 700;">$1</span>')
        .replace(italicPattern, '<span style="font-weight: 200; font-style: italic;">$1</span>')
        .replace(devicePattern, (match, content) => parseDeviceSpecificText(content));

    return parsedText;
}



/**
 * Displays a message in the messageBox with optional fade in/out.
 * @param {string} text - The text to display, can include markdown-style links, bold, italic formatting, and device-specific text.
 * @param {number} fadeInTime - Duration in seconds for the message to fade in.
 * @param {number} displayTime - Duration in seconds for the message to remain visible.
 * @param {number} fadeOutTime - Duration in seconds for the message to fade out.
 */
function displayMessage(text, fadeInTime = 0.5, displayTime = 3, fadeOutTime = 0.5) {
    const messageBox = document.getElementById("messageBox");
    if (!messageBox) {
        console.error("Message box not found in the DOM.");
        return;
    }

    // Get the user's device type
    const deviceType = window.user?.userDevice.replace(/ /g, '_').toLowerCase() || 'desktop_with_mouse';

    // Parse the text for markdown-style links, bold, italic formatting, and device-specific text
    const parsedText = parseMarkdown(text, deviceType);
    messageBox.innerHTML = parsedText;
    messageBox.style.display = "block";
    messageBox.style.opacity = 0;
    messageBox.style.fontWeight = 300; // Set the default font weight to 300

    // Fade in
    messageBox.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: fadeInTime * 1000,
        fill: "forwards",
    });

    // Display for a set amount of time, then fade out
    setTimeout(() => {
        messageBox.animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: fadeOutTime * 1000,
            fill: "forwards",
        }).onfinish = () => {
            messageBox.style.display = "none";
        };
    }, (fadeInTime + displayTime) * 1000);
}


/**
 * Creates and appends the "Save View" button to the DOM if it doesn't already exist.
 * The button will call printViewConfiguration on click.
 */
function addSaveViewButton() {
    createReusableButton("Save 6D Camera View", () => {
        printViewConfiguration(window.map3D.viewer);
    }, {
        id: "saveViewButton",
        bottom: "50px",
        left: "50%",
        transform: "translateX(-50%)"
    });
}



/**
 * Function to print the current view configuration to the console.
 * @param {object} viewer - The Cesium viewer object.
 */
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


/**
 * Calls the addSaveViewButton function to add the debug button.
 */
function debug() {
    addSaveViewButton();
}

/**
 * Initializes all the required systems and sets them on the window object.
 * This includes the CesiumManager, GoogleMaps2DManager, and UserManager.
 */
async function allSystemsGo() {
    // Instantiate the CesiumManager
    window.map3D = new CesiumManager('cesiumContainer');

    // Instantiate the GoogleMaps2DManager and wait for it to be ready
    window.map2D = await new GoogleMaps2DManager('map2D');
    console.log("Google Map object is ready:", window.map2D);

    // Instantiate the UserManager and store it globally
    window.user = new UserManager(window.map3D);
}

// Expose the functions globally
window.parseMarkdown = parseMarkdown;
window.displayMessage = displayMessage;
window.addSaveViewButton = addSaveViewButton;
window.printViewConfiguration = printViewConfiguration;
window.allSystemsGo = allSystemsGo;
window.debug = debug;
window.createReusableButton = createReusableButton;
