# Height Adjustment Guide

## Overview
The polygon height calculation system now preserves relative height differences from GeoJSON survey data while aligning with Google Earth's 3D surface.

## How It Works

1. **Altitude Analysis**: The system analyzes all vertices in the GeoJSON to find minimum, maximum, and average altitudes
2. **Multi-Point Sampling**: Samples Google Earth height at 5 points around the maximum altitude location for accuracy
3. **Median Height**: Uses the median of sampled heights to avoid outliers from trees or buildings
4. **Height Offset**: Calculates the difference between Google Earth and GeoJSON altitudes
5. **Relative Preservation**: Each vertex maintains its relative height difference from the survey

## Manual Height Adjustment

If polygons appear too high or low, you can manually adjust the height offset:

```javascript
// Raise polygons by 5 meters
adjustHeightOffset(5);

// Lower polygons by 3 meters
adjustHeightOffset(-3);

// Check current offset
console.log(window.currentHeightOffset);
```

## Debugging Information

The console will show:
- GeoJSON altitude statistics (min, max, average)
- Sampled Google Earth heights
- Calculated height offset
- Any warnings about adjusted vertices

## Common Issues

1. **Polygons too high**: Trees or buildings may affect height sampling
   - Solution: Use `adjustHeightOffset(-10)` to lower by 10m

2. **Polygons underground**: Google Earth terrain may be lower than expected
   - Solution: Use `adjustHeightOffset(5)` to raise by 5m

3. **Inconsistent heights**: Different sites may have different reference systems
   - Solution: Height offset resets automatically when switching sites