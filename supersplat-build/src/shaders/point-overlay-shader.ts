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

    // Pack triangle data in vec4 uniforms (max 8 triangles for now)
    uniform vec4 triangleData0;     // Triangle 0: v0.x, v0.z, v1.x, v1.z
    uniform vec4 triangleData1;     // Triangle 0: v2.x, v2.z, color.r, color.g
    uniform vec4 triangleData2;     // Triangle 1: v0.x, v0.z, v1.x, v1.z
    uniform vec4 triangleData3;     // Triangle 1: v2.x, v2.z, color.r, color.g
    uniform vec4 triangleData4;     // Triangle 2: v0.x, v0.z, v1.x, v1.z
    uniform vec4 triangleData5;     // Triangle 2: v2.x, v2.z, color.r, color.g
    uniform vec4 triangleData6;     // Triangle 3: v0.x, v0.z, v1.x, v1.z
    uniform vec4 triangleData7;     // Triangle 3: v2.x, v2.z, color.r, color.g
    uniform vec4 triangleData8;     // Triangle 4: v0.x, v0.z, v1.x, v1.z
    uniform vec4 triangleData9;     // Triangle 4: v2.x, v2.z, color.r, color.g
    uniform vec4 triangleData10;    // Triangle 5: v0.x, v0.z, v1.x, v1.z
    uniform vec4 triangleData11;    // Triangle 5: v2.x, v2.z, color.r, color.g
    uniform vec4 triangleData12;    // Triangle 6: v0.x, v0.z, v1.x, v1.z
    uniform vec4 triangleData13;    // Triangle 6: v2.x, v2.z, color.r, color.g
    uniform vec4 triangleData14;    // Triangle 7: v0.x, v0.z, v1.x, v1.z
    uniform vec4 triangleData15;    // Triangle 7: v2.x, v2.z, color.r, color.g

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
        vec2 uv = fract(gl_FragCoord.xy / 32.0);
        float noise = texture2DLod(blueNoiseTex32, uv, 0.0).y;
        return alpha > noise;
    }

    // Helper function to get triangle data from vec4 uniforms
    void getTriangleData(int index, out vec2 v0, out vec2 v1, out vec2 v2, out vec3 color) {
        // Each triangle uses 2 vec4 uniforms
        // Even indices: v0.x, v0.z, v1.x, v1.z
        // Odd indices: v2.x, v2.z, color.r, color.g (color.b = 0 for now)

        if (index == 0) {
            v0 = triangleData0.xy;
            v1 = triangleData0.zw;
            v2 = triangleData1.xy;
            color = vec3(triangleData1.z, triangleData1.w, 0.0);
        } else if (index == 1) {
            v0 = triangleData2.xy;
            v1 = triangleData2.zw;
            v2 = triangleData3.xy;
            color = vec3(triangleData3.z, triangleData3.w, 0.0);
        } else if (index == 2) {
            v0 = triangleData4.xy;
            v1 = triangleData4.zw;
            v2 = triangleData5.xy;
            color = vec3(triangleData5.z, triangleData5.w, 0.0);
        } else if (index == 3) {
            v0 = triangleData6.xy;
            v1 = triangleData6.zw;
            v2 = triangleData7.xy;
            color = vec3(triangleData7.z, triangleData7.w, 0.0);
        } else if (index == 4) {
            v0 = triangleData8.xy;
            v1 = triangleData8.zw;
            v2 = triangleData9.xy;
            color = vec3(triangleData9.z, triangleData9.w, 0.0);
        } else if (index == 5) {
            v0 = triangleData10.xy;
            v1 = triangleData10.zw;
            v2 = triangleData11.xy;
            color = vec3(triangleData11.z, triangleData11.w, 0.0);
        } else if (index == 6) {
            v0 = triangleData12.xy;
            v1 = triangleData12.zw;
            v2 = triangleData13.xy;
            color = vec3(triangleData13.z, triangleData13.w, 0.0);
        } else if (index == 7) {
            v0 = triangleData14.xy;
            v1 = triangleData14.zw;
            v2 = triangleData15.xy;
            color = vec3(triangleData15.z, triangleData15.w, 0.0);
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

        // Loop through all triangles using vec4 packed data
        vec3 finalColor = vec3(0.0, 0.0, 0.0);
        float alpha = 0.0;
        bool foundTriangle = false;

        for (int i = 0; i < 8; i++) {
            if (i >= triangleCount) break; // Only process active triangles

            // Get triangle data from vec4 uniforms
            vec2 v0, v1, v2;
            vec3 triangleColor;
            getTriangleData(i, v0, v1, v2, triangleColor);

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

                // Distance-based fading
                float distFromCamera = length(worldPos - view_position);
                float fade = 1.0 - smoothstep(50.0, 200.0, distFromCamera);

                // View-dependent opacity
                vec3 viewDir = normalize(worldPos - view_position);
                float viewAngleFactor = abs(viewDir.y);
                float viewOpacity = viewDir.y < 0.0 ?
                    mix(0.4, 1.0, viewAngleFactor) :
                    mix(0.8, 0.1, viewAngleFactor);

                // Border effect calculation
                float triangleSize = 3.0;
                float distToEdge = min(min(abs(d0), abs(d1)), abs(d2)) / triangleSize;
                float borderWidth = 0.1;
                bool isBorder = distToEdge < borderWidth;

                // Use triangle color from vec4 data, white border
                finalColor = isBorder ? vec3(1.0, 1.0, 1.0) : triangleColor;
                alpha = fade * viewOpacity;
                break; // Stop at first triangle found (no overlaps expected)
            }
        }

        // Discard if no triangle contains this pixel
        if (!foundTriangle || alpha < 0.01) {
            discard;
        }

        gl_FragColor = vec4(finalColor, alpha);
        gl_FragDepth = writeDepth(alpha) ? calcDepth(worldPos) : 1.0;
    }
`;

export { vertexShader, fragmentShader };