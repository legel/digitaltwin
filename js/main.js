document.addEventListener("DOMContentLoaded", async function() {
    console.log("DOM fully loaded and parsed");
    //debug();

    // Run all systems initialization
    await allSystemsGo();

    // Comment out old narratives
    // introductionTutorialToVizcaya();
    // introductionTutorialToDixHite();
    
    // Start the Scott Boyd site introduction after 2 seconds
    if (window.map3D && window.map3D.viewer) {
        window.setTimeout(() => introductionToScottBoydSite(), 2000);
    }

});

