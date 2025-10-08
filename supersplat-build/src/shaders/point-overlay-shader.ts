const vertexShader = /* glsl*/ `
    uniform vec3 near_origin;
    uniform vec3 near_x;
    uniform vec3 near_y;

    uniform vec3 far_origin;
    uniform vec3 far_x;
    uniform vec3 far_y;

    attribute vec2 vertex_position;

    varying vec3 worldFar;
    varying vec3 worldNear;

    void main(void) {
        gl_Position = vec4(vertex_position, 0.0, 1.0);

        vec2 p = vertex_position * 0.5 + 0.5;
        worldNear = near_origin + near_x * p.x + near_y * p.y;
        worldFar = far_origin + far_x * p.x + far_y * p.y;
    }
`;

const fragmentShader = /* glsl*/ `
    uniform vec3 view_position;
    uniform mat4 matrix_viewProjection;
    uniform sampler2D blueNoiseTex32;

    // Triangle rendering uniforms using vec4 packing (PlayCanvas compatible)
    uniform float triangleYPlane;   // Y plane for all triangles
    uniform int triangleCount;      // Number of active triangles

    // Pack triangle data in vec4 uniforms - now using 4 vec4 per triangle for outline colors
    // Max triangles expanded to 8 (8 * 4 = 32 vec4 uniforms used)
    uniform vec4 triangleData0;     // Triangle 0: v0.x, v0.z, v1.x, v1.z
    uniform vec4 triangleData1;     // Triangle 0: v2.x, v2.z, color.r, color.g
    uniform vec4 triangleData2;     // Triangle 0: color.b, outlineThickness, outlineColor.r, outlineColor.g
    uniform vec4 triangleData3;     // Triangle 0: outlineColor.b, fillAlpha, unused, unused
    uniform vec4 triangleData4;     // Triangle 1: v0.x, v0.z, v1.x, v1.z
    uniform vec4 triangleData5;     // Triangle 1: v2.x, v2.z, color.r, color.g
    uniform vec4 triangleData6;     // Triangle 1: color.b, outlineThickness, outlineColor.r, outlineColor.g
    uniform vec4 triangleData7;     // Triangle 1: outlineColor.b, fillAlpha, unused, unused
    uniform vec4 triangleData8;     // Triangle 2: v0.x, v0.z, v1.x, v1.z
    uniform vec4 triangleData9;     // Triangle 2: v2.x, v2.z, color.r, color.g
    uniform vec4 triangleData10;    // Triangle 2: color.b, outlineThickness, outlineColor.r, outlineColor.g
    uniform vec4 triangleData11;    // Triangle 2: outlineColor.b, fillAlpha, unused, unused
    uniform vec4 triangleData12;    // Triangle 3: v0.x, v0.z, v1.x, v1.z
    uniform vec4 triangleData13;    // Triangle 3: v2.x, v2.z, color.r, color.g
    uniform vec4 triangleData14;    // Triangle 3: color.b, outlineThickness, outlineColor.r, outlineColor.g
    uniform vec4 triangleData15;    // Triangle 3: outlineColor.b, fillAlpha, unused, unused
    uniform vec4 triangleData16;    // Triangle 4: v0.x, v0.z, v1.x, v1.z
    uniform vec4 triangleData17;    // Triangle 4: v2.x, v2.z, color.r, color.g
    uniform vec4 triangleData18;    // Triangle 4: color.b, outlineThickness, outlineColor.r, outlineColor.g
    uniform vec4 triangleData19;    // Triangle 4: outlineColor.b, fillAlpha, unused, unused
    uniform vec4 triangleData20;    // Triangle 5: v0.x, v0.z, v1.x, v1.z
    uniform vec4 triangleData21;    // Triangle 5: v2.x, v2.z, color.r, color.g
    uniform vec4 triangleData22;    // Triangle 5: color.b, outlineThickness, outlineColor.r, outlineColor.g
    uniform vec4 triangleData23;    // Triangle 5: outlineColor.b, fillAlpha, unused, unused
    uniform vec4 triangleData24;    // Triangle 6: v0.x, v0.z, v1.x, v1.z
    uniform vec4 triangleData25;    // Triangle 6: v2.x, v2.z, color.r, color.g
    uniform vec4 triangleData26;    // Triangle 6: color.b, outlineThickness, outlineColor.r, outlineColor.g
    uniform vec4 triangleData27;    // Triangle 6: outlineColor.b, fillAlpha, unused, unused
    uniform vec4 triangleData28;    // Triangle 7: v0.x, v0.z, v1.x, v1.z
    uniform vec4 triangleData29;    // Triangle 7: v2.x, v2.z, color.r, color.g
    uniform vec4 triangleData30;    // Triangle 7: color.b, outlineThickness, outlineColor.r, outlineColor.g
    uniform vec4 triangleData31;    // Triangle 7: outlineColor.b, fillAlpha, unused, unused

    varying vec3 worldNear;
    varying vec3 worldFar;

    // Intersect ray with plane using SuperSplat pattern
    bool intersectPlane(inout float t, vec3 pos, vec3 dir, vec4 plane) {
        float d = dot(dir, plane.xyz);
        if (abs(d) < 1e-06) {
            return false;
        }

        float n = -(dot(pos, plane.xyz) + plane.w) / d;
        if (n < 0.0) {
            return false;
        }

        t = n;
        return true;
    }

    // Helper for Y plane intersection
    bool intersectYPlane(inout float t, vec3 pos, vec3 dir, float planeY) {
        vec4 plane = vec4(0.0, 1.0, 0.0, -planeY);
        return intersectPlane(t, pos, dir, plane);
    }

    float calcDepth(vec3 p) {
        vec4 v = matrix_viewProjection * vec4(p, 1.0);
        return (v.z / v.w) * 0.5 + 0.5;
    }

    bool writeDepth(float alpha) {
        // Skip noise for near-opaque pixels (like 100% alpha borders)
        if (alpha >= 0.95) {
            return true;  // Always write depth for solid borders
        }

        // Use blue noise only for semi-transparent areas - remove fract() to fix tile gaps
        vec2 uv = gl_FragCoord.xy / 32.0;
        float noise = texture2DLod(blueNoiseTex32, uv, 0.0).y;
        return alpha > noise;
    }

    // Helper function to get triangle data from vec4 uniforms
    void getTriangleData(int index, out vec2 v0, out vec2 v1, out vec2 v2, out vec3 color, out float fillAlpha, out vec3 outlineColor, out float outlineThickness, out float edgeFlags) {
        // Each triangle uses 4 vec4 uniforms (max 8 triangles)
        // Index*4+0: v0.x, v0.z, v1.x, v1.z
        // Index*4+1: v2.x, v2.z, color.r, color.g
        // Index*4+2: color.b, outlineThickness, outlineColor.r, outlineColor.g
        // Index*4+3: outlineColor.b, fillAlpha, edgeFlags, unused

        if (index == 0) {
            v0 = triangleData0.xy;
            v1 = triangleData0.zw;
            v2 = triangleData1.xy;
            color = vec3(triangleData1.z, triangleData1.w, triangleData2.x);
            outlineThickness = triangleData2.y;
            outlineColor = vec3(triangleData2.z, triangleData2.w, triangleData3.x);
            fillAlpha = triangleData3.y;
            edgeFlags = triangleData3.z;
        } else if (index == 1) {
            v0 = triangleData4.xy;
            v1 = triangleData4.zw;
            v2 = triangleData5.xy;
            color = vec3(triangleData5.z, triangleData5.w, triangleData6.x);
            outlineThickness = triangleData6.y;
            outlineColor = vec3(triangleData6.z, triangleData6.w, triangleData7.x);
            fillAlpha = triangleData7.y;
            edgeFlags = triangleData7.z;
        } else if (index == 2) {
            v0 = triangleData8.xy;
            v1 = triangleData8.zw;
            v2 = triangleData9.xy;
            color = vec3(triangleData9.z, triangleData9.w, triangleData10.x);
            outlineThickness = triangleData10.y;
            outlineColor = vec3(triangleData10.z, triangleData10.w, triangleData11.x);
            fillAlpha = triangleData11.y;
            edgeFlags = triangleData11.z;
        } else if (index == 3) {
            v0 = triangleData12.xy;
            v1 = triangleData12.zw;
            v2 = triangleData13.xy;
            color = vec3(triangleData13.z, triangleData13.w, triangleData14.x);
            outlineThickness = triangleData14.y;
            outlineColor = vec3(triangleData14.z, triangleData14.w, triangleData15.x);
            fillAlpha = triangleData15.y;
            edgeFlags = triangleData15.z;
        } else if (index == 4) {
            v0 = triangleData16.xy;
            v1 = triangleData16.zw;
            v2 = triangleData17.xy;
            color = vec3(triangleData17.z, triangleData17.w, triangleData18.x);
            outlineThickness = triangleData18.y;
            outlineColor = vec3(triangleData18.z, triangleData18.w, triangleData19.x);
            fillAlpha = triangleData19.y;
            edgeFlags = triangleData19.z;
        } else if (index == 5) {
            v0 = triangleData20.xy;
            v1 = triangleData20.zw;
            v2 = triangleData21.xy;
            color = vec3(triangleData21.z, triangleData21.w, triangleData22.x);
            outlineThickness = triangleData22.y;
            outlineColor = vec3(triangleData22.z, triangleData22.w, triangleData23.x);
            fillAlpha = triangleData23.y;
            edgeFlags = triangleData23.z;
        } else if (index == 6) {
            v0 = triangleData24.xy;
            v1 = triangleData24.zw;
            v2 = triangleData25.xy;
            color = vec3(triangleData25.z, triangleData25.w, triangleData26.x);
            outlineThickness = triangleData26.y;
            outlineColor = vec3(triangleData26.z, triangleData26.w, triangleData27.x);
            fillAlpha = triangleData27.y;
            edgeFlags = triangleData27.z;
        } else if (index == 7) {
            v0 = triangleData28.xy;
            v1 = triangleData28.zw;
            v2 = triangleData29.xy;
            color = vec3(triangleData29.z, triangleData29.w, triangleData30.x);
            outlineThickness = triangleData30.y;
            outlineColor = vec3(triangleData30.z, triangleData30.w, triangleData31.x);
            fillAlpha = triangleData31.y;
            edgeFlags = triangleData31.z;
        }
    }

    void main(void) {
        vec3 p = worldNear;
        vec3 v = normalize(worldFar - worldNear);

        // Triangle rendering using Y-plane intersection
        float t;
        if (!intersectYPlane(t, p, v, triangleYPlane)) {
            discard;
        }

        vec3 worldPos = p + v * t;
        vec2 currentPos = worldPos.xz;

        // Loop through all triangles and accumulate edge information
        vec3 finalColor = vec3(0.0, 0.0, 0.0);
        float alpha = 0.0;
        bool foundTriangle = false;
        bool isOnVisibleEdge = false;

        for (int i = 0; i < 8; i++) { // Max 8 triangles with 4 vec4 per triangle
            if (i >= triangleCount) break; // Only process active triangles

            // Get triangle data from vec4 uniforms
            vec2 v0, v1, v2;
            vec3 triangleColor, triangleOutlineColor;
            float triangleFillAlpha, outlineThickness, edgeFlags;
            getTriangleData(i, v0, v1, v2, triangleColor, triangleFillAlpha, triangleOutlineColor, outlineThickness, edgeFlags);

            // Cross product test for triangle inclusion
            vec2 e0 = v1 - v0;
            vec2 e1 = v2 - v1;
            vec2 e2 = v0 - v2;

            vec2 c0 = currentPos - v0;
            vec2 c1 = currentPos - v1;
            vec2 c2 = currentPos - v2;

            float d0 = e0.x * c0.y - e0.y * c0.x;
            float d1 = e1.x * c1.y - e1.y * c1.x;
            float d2 = e2.x * c2.y - e2.y * c2.x;

            // Check if point is inside this triangle
            bool insideTriangle = (d0 >= 0.0 && d1 >= 0.0 && d2 >= 0.0) || (d0 <= 0.0 && d1 <= 0.0 && d2 <= 0.0);

            if (insideTriangle) {
                foundTriangle = true;

                // Store fill color and alpha (will be overridden if we find visible edge)
                if (!isOnVisibleEdge) {
                    finalColor = triangleColor;

                    // Distance-based fading
                    float distFromCamera = length(worldPos - view_position);
                    float fade = 1.0 - smoothstep(50.0, 200.0, distFromCamera);

                    // View-dependent opacity
                    vec3 viewDir = normalize(worldPos - view_position);
                    float viewAngleFactor = abs(viewDir.y);
                    float viewOpacity = viewDir.y < 0.0 ?
                        mix(0.4, 1.0, viewAngleFactor) :
                        mix(0.8, 0.1, viewAngleFactor);

                    alpha = fade * viewOpacity * triangleFillAlpha;
                }

                // Calculate proper distance to each edge using point-to-line distance
                float distToEdge0 = abs(d0) / length(e0); // Distance to edge v0→v1
                float distToEdge1 = abs(d1) / length(e1); // Distance to edge v1→v2
                float distToEdge2 = abs(d2) / length(e2); // Distance to edge v2→v0

                // Extract edge visibility flags from packed float
                bool edge01Visible = mod(floor(edgeFlags), 2.0) >= 1.0;        // bit 0
                bool edge12Visible = mod(floor(edgeFlags / 2.0), 2.0) >= 1.0;  // bit 1
                bool edge20Visible = mod(floor(edgeFlags / 4.0), 2.0) >= 1.0;  // bit 2

                // Check if pixel is near any visible edge
                if (edge01Visible && distToEdge0 < outlineThickness) {
                    isOnVisibleEdge = true;
                    finalColor = triangleOutlineColor;

                    float distFromCamera = length(worldPos - view_position);
                    float fade = 1.0 - smoothstep(50.0, 200.0, distFromCamera);
                    vec3 viewDir = normalize(worldPos - view_position);
                    float viewAngleFactor = abs(viewDir.y);
                    float viewOpacity = viewDir.y < 0.0 ?
                        mix(0.4, 1.0, viewAngleFactor) :
                        mix(0.8, 0.1, viewAngleFactor);
                    alpha = fade * viewOpacity * 1.0;
                }
                if (edge12Visible && distToEdge1 < outlineThickness) {
                    isOnVisibleEdge = true;
                    finalColor = triangleOutlineColor;

                    float distFromCamera = length(worldPos - view_position);
                    float fade = 1.0 - smoothstep(50.0, 200.0, distFromCamera);
                    vec3 viewDir = normalize(worldPos - view_position);
                    float viewAngleFactor = abs(viewDir.y);
                    float viewOpacity = viewDir.y < 0.0 ?
                        mix(0.4, 1.0, viewAngleFactor) :
                        mix(0.8, 0.1, viewAngleFactor);
                    alpha = fade * viewOpacity * 1.0;
                }
                if (edge20Visible && distToEdge2 < outlineThickness) {
                    isOnVisibleEdge = true;
                    finalColor = triangleOutlineColor;

                    float distFromCamera = length(worldPos - view_position);
                    float fade = 1.0 - smoothstep(50.0, 200.0, distFromCamera);
                    vec3 viewDir = normalize(worldPos - view_position);
                    float viewAngleFactor = abs(viewDir.y);
                    float viewOpacity = viewDir.y < 0.0 ?
                        mix(0.4, 1.0, viewAngleFactor) :
                        mix(0.8, 0.1, viewAngleFactor);
                    alpha = fade * viewOpacity * 1.0;
                }
            }
        }

        // Discard if no triangle contains this pixel
        if (!foundTriangle || alpha < 0.01) {
            discard;
        }

        gl_FragColor = vec4(finalColor, alpha);
        // Ensure polygons always render in front of splats with slight depth bias
        float baseDepth = calcDepth(worldPos);
        gl_FragDepth = writeDepth(alpha) ? (baseDepth - 0.00001) : 1.0;
    }
`;

export { vertexShader, fragmentShader };