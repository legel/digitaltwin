# Known Issues

### Performance
- Initial page load is ~15MB due to Cesium and libraries
- No code splitting or lazy loading implemented

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