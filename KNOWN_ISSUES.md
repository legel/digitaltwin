# Known Issues

### Performance
- Initial page load is ~15MB due to Cesium and libraries
- No code splitting or lazy loading implemented
- **Gaussian Splat Performance**: Severe performance degradation when Gaussian splats are loaded - framerate drops significantly, especially during camera movement and interaction
- **Memory Usage**: Gaussian splats consume substantial memory, potentially causing browser slowdowns on lower-end devices

### Security
- API keys are hardcoded in client-side JavaScript
- CORS allows all origins
- No authentication on any endpoints

### Architecture
- Heavy use of global variables on window object
- No error boundaries - single error can crash entire app
- No automated tests

### User Experience
- Tour auto-starts and can interrupt user actions
- No loading indicators during data fetches
- Missing accessibility features (ARIA labels, keyboard navigation)

### Gaussian Splat Integration Issues
- **Polygon Visibility**: Plantable areas, non-plantable areas, and ecological niche metrics have visibility issues when Gaussian splats are loaded
- **Workaround Applied**: Polygons and outlines elevated 3m above original position to render above splat surface
- **Partial Solution**: Enhanced depth testing and material properties improve but don't fully resolve visibility conflicts
- **Toggle Limitation**: Splat visibility toggle unreliable - removal button implemented as alternative