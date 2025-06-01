document.addEventListener("DOMContentLoaded", async function() {
    console.log("DOM fully loaded and parsed");
    //debug();

    // Run all systems initialization
    await allSystemsGo();

    // Run the introduction tutorial to Vizcaya
    introductionTutorialToVizcaya();
    //introductionTutorialToDixHite();

});

