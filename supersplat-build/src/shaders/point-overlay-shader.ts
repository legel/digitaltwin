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

    // Triangle rendering uniforms
    uniform float triangleYPlane;  // Y plane for all triangles
    uniform vec3 triangleColor;    // Color for current triangle
    uniform vec2 triangleV0;       // XZ coordinates of vertex 0
    uniform vec2 triangleV1;       // XZ coordinates of vertex 1
    uniform vec2 triangleV2;       // XZ coordinates of vertex 2

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

        // Use triangle vertices from uniforms
        vec2 v0 = triangleV0;
        vec2 v1 = triangleV1;
        vec2 v2 = triangleV2;

        // Cross product test for triangle inclusion (same as working hardcoded version)
        vec2 e0 = v1 - v0;
        vec2 e1 = v2 - v1;
        vec2 e2 = v0 - v2;

        vec2 c0 = currentPos - v0;
        vec2 c1 = currentPos - v1;
        vec2 c2 = currentPos - v2;

        float d0 = e0.x * c0.y - e0.y * c0.x;
        float d1 = e1.x * c1.y - e1.y * c1.x;
        float d2 = e2.x * c2.y - e2.y * c2.x;

        // Triangle bounds check - discard if outside triangle
        if (!((d0 >= 0.0 && d1 >= 0.0 && d2 >= 0.0) || (d0 <= 0.0 && d1 <= 0.0 && d2 <= 0.0))) {
            discard;
        }

        // Distance-based fading
        float distFromCamera = length(worldPos - view_position);
        float fade = 1.0 - smoothstep(50.0, 200.0, distFromCamera);
        if (fade < 0.01) {
            discard;
        }

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

        // Final color: use triangle color from uniform, white border
        vec3 finalColor = isBorder ? vec3(1.0, 1.0, 1.0) : triangleColor;
        float alpha = fade * viewOpacity;

        gl_FragColor = vec4(finalColor, alpha);
        gl_FragDepth = writeDepth(alpha) ? calcDepth(worldPos) : 1.0;
    }
`;

export { vertexShader, fragmentShader };