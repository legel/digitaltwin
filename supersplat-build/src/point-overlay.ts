import {
    BLENDMODE_ONE,
    BLENDMODE_ONE_MINUS_SRC_ALPHA,
    BLENDMODE_SRC_ALPHA,
    BLENDEQUATION_ADD,
    CULLFACE_NONE,
    FUNC_LESSEQUAL,
    SEMANTIC_POSITION,
    createShaderFromCode,
    BlendState,
    DepthState,
    Layer,
    QuadRender,
    Shader,
    Vec3
} from 'playcanvas';

import { Element, ElementType } from './element';
import { Serializer } from './serializer';
import { vertexShader, fragmentShader } from './shaders/point-overlay-shader';

interface TriangleData {
    v0: Vec3;
    v1: Vec3;
    v2: Vec3;
    color: Vec3;
    name?: string;
}

class TriangleOverlay extends Element {
    shader: Shader;
    quadRender: QuadRender;
    blendState = new BlendState(false);
    depthState = new DepthState(FUNC_LESSEQUAL, true);

    visible = true;
    triangles: TriangleData[] = [];
    yPlane: number = 3.2; // Default Y plane for all triangles

    constructor() {
        super(ElementType.debug);
    }

    add() {
        console.log('🔺 TriangleOverlay.add() called - setting up triangle rendering system');
        const device = this.scene.app.graphicsDevice;

        this.shader = createShaderFromCode(device, vertexShader, fragmentShader, 'triangle-overlay', {
            vertex_position: SEMANTIC_POSITION
        });

        this.quadRender = new QuadRender(this.shader);
        console.log('🎨 Triangle shader and QuadRender created successfully');

        const blendState = new BlendState(
            true,
            BLENDEQUATION_ADD, BLENDMODE_SRC_ALPHA, BLENDMODE_ONE_MINUS_SRC_ALPHA,
            BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE_MINUS_SRC_ALPHA
        );

        console.log('🔺 Registering triangle rendering event handler');
        this.scene.camera.entity.camera.on('preRenderLayer', (layer: Layer, transparent: boolean) => {
            const shouldRender = this.visible && layer === this.scene.debugLayer && !transparent &&
                this.scene.camera.renderOverlays && this.triangles.length > 0;

            if (shouldRender) {
                device.setBlendState(blendState);
                device.setCullMode(CULLFACE_NONE);
                device.setDepthState(DepthState.WRITEDEPTH);
                device.setStencilState(null, null);

                // Render each triangle
                for (let i = 0; i < this.triangles.length; i++) {
                    const triangle = this.triangles[i];

                    // Set triangle uniforms
                    device.scope.resolve('triangleYPlane').setValue(this.yPlane);
                    device.scope.resolve('triangleColor').setValue([triangle.color.x, triangle.color.y, triangle.color.z]);
                    device.scope.resolve('triangleV0').setValue([triangle.v0.x, triangle.v0.z]); // XZ only
                    device.scope.resolve('triangleV1').setValue([triangle.v1.x, triangle.v1.z]); // XZ only
                    device.scope.resolve('triangleV2').setValue([triangle.v2.x, triangle.v2.z]); // XZ only

                    this.quadRender.render();
                }

                console.log(`🔺 Rendered ${this.triangles.length} triangles at Y-plane ${this.yPlane}`);
            }
        });

        // Register event functions for terrain-3d bridge
        this.scene.events.function('triangleOverlay.addTriangle', (v0: any, v1: any, v2: any, color: any = {x: 0, y: 1, z: 0}, name?: string) => {
            this.addTriangle(v0, v1, v2, color, name);
        });

        this.scene.events.function('triangleOverlay.setYPlane', (yPlane: number) => {
            this.setYPlane(yPlane);
        });

        this.scene.events.function('triangleOverlay.clearTriangles', () => {
            this.clearTriangles();
        });

        // Add hardcoded test triangle (same as working version)
        this.addTriangle(
            {x: 10.0, y: 0, z: 1.731},   // Top vertex
            {x: 8.5, y: 0, z: -0.867},   // Bottom left
            {x: 11.5, y: 0, z: -0.867},  // Bottom right
            {x: 0, y: 1, z: 0},          // Green color
            'Hardcoded Test Triangle'
        );

        console.log('✅ TriangleOverlay initialized with hardcoded test triangle');
    }

    remove() {
        this.shader?.destroy();
        this.quadRender?.destroy();
    }

    addTriangle(v0: Vec3 | {x: number, y: number, z: number}, v1: Vec3 | {x: number, y: number, z: number}, v2: Vec3 | {x: number, y: number, z: number}, color: Vec3 | {x: number, y: number, z: number} = {x: 0, y: 1, z: 0}, name?: string) {
        // Convert plain objects to Vec3 if needed
        const vertex0 = v0 instanceof Vec3 ? v0.clone() : new Vec3(v0.x, v0.y, v0.z);
        const vertex1 = v1 instanceof Vec3 ? v1.clone() : new Vec3(v1.x, v1.y, v1.z);
        const vertex2 = v2 instanceof Vec3 ? v2.clone() : new Vec3(v2.x, v2.y, v2.z);
        const col = color instanceof Vec3 ? color.clone() : new Vec3(color.x, color.y, color.z);

        this.triangles.push({
            v0: vertex0,
            v1: vertex1,
            v2: vertex2,
            color: col,
            name
        });

        const nameStr = name ? ` (${name})` : '';
        console.log(`🔺 Triangle added: v0(${vertex0.x.toFixed(2)}, ${vertex0.z.toFixed(2)}), v1(${vertex1.x.toFixed(2)}, ${vertex1.z.toFixed(2)}), v2(${vertex2.x.toFixed(2)}, ${vertex2.z.toFixed(2)})${nameStr}`);
    }

    setYPlane(yPlane: number) {
        this.yPlane = yPlane;
        console.log(`🔺 Y-plane set to ${yPlane}`);
    }

    clearTriangles() {
        this.triangles = [];
        console.log('🧹 All triangles cleared from overlay');
    }

    serialize(serializer: Serializer): void {
        serializer.pack(this.visible);
        serializer.pack(this.triangles.length);
        serializer.pack(this.yPlane);
        for (const triangle of this.triangles) {
            serializer.pack(triangle.v0.x, triangle.v0.y, triangle.v0.z);
            serializer.pack(triangle.v1.x, triangle.v1.y, triangle.v1.z);
            serializer.pack(triangle.v2.x, triangle.v2.y, triangle.v2.z);
            serializer.pack(triangle.color.x, triangle.color.y, triangle.color.z);
        }
    }
}

export { TriangleOverlay };