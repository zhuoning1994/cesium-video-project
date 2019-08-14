/**
 * 个人编程习惯不好，没有写注释。大概思路就是根据cesium原生的 classificationprimitive ，
 * 直接修改shader，让其支持纹理贴图最终实现投影效果。当前第一步实现图片的正确加载。
 * 
 */

function createRenderStatesFunction(primitive, context, appearance, twoPasses) {
    createRenderStates(primitive, context);
}

function getStencilPreloadRenderState(enableStencil, mask3DTiles) {
    var stencilFunction = mask3DTiles ? Cesium.StencilFunction.EQUAL : Cesium.StencilFunction.ALWAYS;
    return {
        colorMask: {
            red: false,
            green: false,
            blue: false,
            alpha: false
        },
        stencilTest: {
            enabled: enableStencil,
            frontFunction: stencilFunction,
            frontOperation: {
                fail: Cesium.StencilOperation.KEEP,
                zFail: Cesium.StencilOperation.DECREMENT_WRAP,
                zPass: Cesium.StencilOperation.DECREMENT_WRAP
            },
            backFunction: stencilFunction,
            backOperation: {
                fail: Cesium.StencilOperation.KEEP,
                zFail: Cesium.StencilOperation.INCREMENT_WRAP,
                zPass: Cesium.StencilOperation.INCREMENT_WRAP
            },
            reference: Cesium.StencilConstants.CESIUM_3D_TILE_MASK,
            mask: Cesium.StencilConstants.CESIUM_3D_TILE_MASK
        },
        stencilMask: Cesium.StencilConstants.CLASSIFICATION_MASK,
        depthTest: {
            enabled: false
        },
        depthMask: false
    };
}

function getStencilDepthRenderState(enableStencil, mask3DTiles) {
    var stencilFunction = mask3DTiles ? Cesium.StencilFunction.EQUAL : Cesium.StencilFunction.ALWAYS;
    return {
        colorMask: {
            red: false,
            green: false,
            blue: false,
            alpha: false
        },
        stencilTest: {
            enabled: enableStencil,
            frontFunction: stencilFunction,
            frontOperation: {
                fail: Cesium.StencilOperation.KEEP,
                zFail: Cesium.StencilOperation.KEEP,
                zPass: Cesium.StencilOperation.INCREMENT_WRAP
            },
            backFunction: stencilFunction,
            backOperation: {
                fail: Cesium.StencilOperation.KEEP,
                zFail: Cesium.StencilOperation.KEEP,
                zPass: Cesium.StencilOperation.DECREMENT_WRAP
            },
            reference: Cesium.StencilConstants.CESIUM_3D_TILE_MASK,
            mask: Cesium.StencilConstants.CESIUM_3D_TILE_MASK
        },
        stencilMask: Cesium.StencilConstants.CLASSIFICATION_MASK,
        depthTest: {
            enabled: true,
            func: Cesium.DepthFunction.LESS_OR_EQUAL
        },
        depthMask: false
    };
}

function getColorRenderState(enableStencil) {
    return {
        stencilTest: {
            enabled: enableStencil,
            frontFunction: Cesium.StencilFunction.NOT_EQUAL,
            frontOperation: {
                fail: Cesium.StencilOperation.KEEP,
                zFail: Cesium.StencilOperation.KEEP,
                zPass: Cesium.StencilOperation.DECREMENT_WRAP
            },
            backFunction: Cesium.StencilFunction.NOT_EQUAL,
            backOperation: {
                fail: Cesium.StencilOperation.KEEP,
                zFail: Cesium.StencilOperation.KEEP,
                zPass: Cesium.StencilOperation.DECREMENT_WRAP
            },
            reference: 0,
            mask: Cesium.StencilConstants.CLASSIFICATION_MASK
        },
        stencilMask: Cesium.StencilConstants.CLASSIFICATION_MASK,
        depthTest: {
            enabled: false
        },
        depthMask: false,
        blending: Cesium.BlendingState.ALPHA_BLEND
    };
}

function boundingVolumeIndex(commandIndex, length) {
    return Math.floor((commandIndex % length) / 3);
}

var pickRenderState = {
    stencilTest: {
        enabled: true,
        frontFunction: Cesium.StencilFunction.NOT_EQUAL,
        frontOperation: {
            fail: Cesium.StencilOperation.KEEP,
            zFail: Cesium.StencilOperation.KEEP,
            zPass: Cesium.StencilOperation.DECREMENT_WRAP
        },
        backFunction: Cesium.StencilFunction.NOT_EQUAL,
        backOperation: {
            fail: Cesium.StencilOperation.KEEP,
            zFail: Cesium.StencilOperation.KEEP,
            zPass: Cesium.StencilOperation.DECREMENT_WRAP
        },
        reference: 0,
        mask: Cesium.StencilConstants.CLASSIFICATION_MASK
    },
    stencilMask: Cesium.StencilConstants.CLASSIFICATION_MASK,
    depthTest: {
        enabled: false
    },
    depthMask: false
};

function updateAndQueueCommands(testPrimitive, frameState, colorCommands, pickCommands, modelMatrix, cull, debugShowBoundingVolume, twoPasses) {
    var primitive = testPrimitive;
    Cesium.Primitive._updateBoundingVolumes(primitive, frameState, modelMatrix);

    var boundingVolumes;
    if (frameState.mode === Cesium.SceneMode.SCENE3D) {
        boundingVolumes = primitive._boundingSphereWC;
    } else if (frameState.mode === Cesium.SceneMode.COLUMBUS_VIEW) {
        boundingVolumes = primitive._boundingSphereCV;
    } else if (frameState.mode === Cesium.SceneMode.SCENE2D && defined(primitive._boundingSphere2D)) {
        boundingVolumes = primitive._boundingSphere2D;
    } else if (Cesium.defined(primitive._boundingSphereMorph)) {
        boundingVolumes = primitive._boundingSphereMorph;
    }

    var classificationType = testPrimitive.classificationType;
    var queueTerrainCommands = (classificationType !== Cesium.ClassificationType.CESIUM_3D_TILE);
    var queue3DTilesCommands = (classificationType !== Cesium.ClassificationType.TERRAIN);

    var passes = frameState.passes;

    var i;
    var boundingVolume;
    var command;

    if (passes.render) {
        var colorLength = colorCommands.length;
        for (i = 0; i < colorLength; ++i) {
            boundingVolume = boundingVolumes[boundingVolumeIndex(i, colorLength)];
            if (queueTerrainCommands) {
                // command = colorCommands[i];
                // updateAndQueueRenderCommand(command, frameState, modelMatrix, cull, boundingVolume, debugShowBoundingVolume);
            }
            if (queue3DTilesCommands) {
                command = colorCommands[i].derivedCommands.tileset;
                updateAndQueueRenderCommand(command, frameState, modelMatrix, cull, boundingVolume, debugShowBoundingVolume);
            }
        }
    }
}

function updateAndQueueRenderCommand(command, frameState, modelMatrix, cull, boundingVolume, debugShowBoundingVolume) {
    command.modelMatrix = modelMatrix;
    command.boundingVolume = boundingVolume;
    command.cull = cull;
    command.debugShowBoundingVolume = debugShowBoundingVolume;

    frameState.commandList.push(command);
}

function createRenderStates(testPrimitive, context, appearance, twoPasses) {
    if (Cesium.defined(testPrimitive._rsStencilPreloadPass)) {
        return;
    }
    var stencilEnabled = !testPrimitive.debugShowShadowVolume;

    testPrimitive._rsStencilPreloadPass = Cesium.RenderState.fromCache(getStencilPreloadRenderState(stencilEnabled, false));
    testPrimitive._rsStencilPreloadPass3DTiles = Cesium.RenderState.fromCache(getStencilPreloadRenderState(stencilEnabled, true));
    testPrimitive._rsStencilDepthPass = Cesium.RenderState.fromCache(getStencilDepthRenderState(stencilEnabled, false));
    testPrimitive._rsStencilDepthPass3DTiles = Cesium.RenderState.fromCache(getStencilDepthRenderState(stencilEnabled, true));
    testPrimitive._rsColorPass = Cesium.RenderState.fromCache(getColorRenderState(stencilEnabled, false));
    testPrimitive._rsPickPass = Cesium.RenderState.fromCache(pickRenderState);
}

function createColorCommands(testPrimitive, colorCommands) {
    // var primitive = testPrimitive._primitive;
    var primitive = testPrimitive;
    var length = primitive._va.length * 3; // each geometry (pack of vertex attributes) needs 3 commands: front/back stencils and fill
    colorCommands.length = length;

    var i;
    var command;
    var derivedCommand;
    var vaIndex = 0;
    var uniformMap = primitive._batchTable.getUniformMapCallback()(testPrimitive._uniformMap);

    // var needs2DShader = testPrimitive._needs2DShader;
    var needs2DShader = false;

    for (i = 0; i < length; i += 3) {
        var vertexArray = primitive._va[vaIndex++];

        // Stencil preload command
        command = colorCommands[i];
        if (!Cesium.defined(command)) {
            command = colorCommands[i] = new Cesium.DrawCommand({
                owner: testPrimitive,
                primitiveType: primitive._primitiveType
            });
        }

        command.vertexArray = vertexArray;
        command.renderState = testPrimitive._rsStencilPreloadPass;
        command.shaderProgram = testPrimitive._sp;
        command.uniformMap = uniformMap;
        command.pass = Cesium.Pass.TERRAIN_CLASSIFICATION;

        derivedCommand = Cesium.DrawCommand.shallowClone(command, command.derivedCommands.tileset);
        derivedCommand.renderState = testPrimitive._rsStencilPreloadPass3DTiles;
        derivedCommand.pass = Cesium.Pass.CESIUM_3D_TILE_CLASSIFICATION;
        command.derivedCommands.tileset = derivedCommand;

        // Stencil depth command
        command = colorCommands[i + 1];
        if (!Cesium.defined(command)) {
            command = colorCommands[i + 1] = new Cesium.DrawCommand({
                owner: testPrimitive,
                primitiveType: primitive._primitiveType
            });
        }

        command.vertexArray = vertexArray;
        command.renderState = testPrimitive._rsStencilDepthPass;
        command.shaderProgram = testPrimitive._sp;
        command.uniformMap = uniformMap;
        command.pass = Cesium.Pass.TERRAIN_CLASSIFICATION;

        derivedCommand = Cesium.DrawCommand.shallowClone(command, command.derivedCommands.tileset);
        derivedCommand.renderState = testPrimitive._rsStencilDepthPass3DTiles;
        derivedCommand.pass = Cesium.Pass.CESIUM_3D_TILE_CLASSIFICATION;
        command.derivedCommands.tileset = derivedCommand;

        // Color command
        command = colorCommands[i + 2];
        if (!Cesium.defined(command)) {
            command = colorCommands[i + 2] = new Cesium.DrawCommand({
                owner: testPrimitive,
                primitiveType: primitive._primitiveType
            });
        }

        command.vertexArray = vertexArray;
        command.renderState = testPrimitive._rsColorPass;
        command.shaderProgram = testPrimitive._spColor;
        command.pass = Cesium.Pass.TERRAIN_CLASSIFICATION;

        var appearance = testPrimitive.appearance;
        var material = appearance.material;
        if (Cesium.defined(material)) {
            uniformMap = Cesium.combine(uniformMap, material._uniforms);
        }

        command.uniformMap = uniformMap;

        derivedCommand = Cesium.DrawCommand.shallowClone(command, command.derivedCommands.tileset);
        derivedCommand.pass = Cesium.Pass.CESIUM_3D_TILE_CLASSIFICATION;
        command.derivedCommands.tileset = derivedCommand;

        // Derive for 2D if texture coordinates are ever computed
        if (needs2DShader) {
            // First derive from the terrain command
            var derived2DCommand = Cesium.DrawCommand.shallowClone(command, command.derivedCommands.appearance2D);
            derived2DCommand.shaderProgram = testPrimitive._spColor2D;
            command.derivedCommands.appearance2D = derived2DCommand;

            // Then derive from the 3D Tiles command
            derived2DCommand = Cesium.DrawCommand.shallowClone(derivedCommand, derivedCommand.derivedCommands.appearance2D);
            derived2DCommand.shaderProgram = testPrimitive._spColor2D;
            derivedCommand.derivedCommands.appearance2D = derived2DCommand;
        }
    }
    if (!Cesium.defined(testPrimitive._commandsIgnoreShow)) {
        testPrimitive._commandsIgnoreShow = [];
    }
    var commandsIgnoreShow = testPrimitive._commandsIgnoreShow;
    var spStencil = testPrimitive._spStencil;

    var commandIndex = 0;
    length = commandsIgnoreShow.length = length / 3 * 2;

    for (var j = 0; j < length; j += 2) {
        var commandIgnoreShow = commandsIgnoreShow[j] = Cesium.DrawCommand.shallowClone(colorCommands[commandIndex], commandsIgnoreShow[j]);
        commandIgnoreShow.shaderProgram = spStencil;
        commandIgnoreShow.pass = Cesium.Pass.CESIUM_3D_TILE_CLASSIFICATION_IGNORE_SHOW;

        commandIgnoreShow = commandsIgnoreShow[j + 1] = Cesium.DrawCommand.shallowClone(colorCommands[commandIndex + 1], commandsIgnoreShow[j + 1]);
        commandIgnoreShow.shaderProgram = spStencil;
        commandIgnoreShow.pass = Cesium.Pass.CESIUM_3D_TILE_CLASSIFICATION_IGNORE_SHOW;

        commandIndex += 3;
    }
}


function createShaderProgramFunction(primitive, frameState, appearance) {
    var context = frameState.context;
    var attributeLocations = primitive._attributeLocations;
    primitive._sp = VideoProjectionPrimitive.createShaderProgram(frameState, primitive, attributeLocations, VideoProjectionPrimitive.createShaderArray(false));
    primitive._spColor = VideoProjectionPrimitive.createShaderProgram(frameState, primitive, attributeLocations, VideoProjectionPrimitive.createShaderArray(true));
}

function createCommandsFunction(primitive, appearance, material, translucent, twoPasses, colorCommands, pickCommands) {
    createColorCommands(primitive, colorCommands);
}

class VideoProjectionPrimitive {
    constructor(options) {
        var viewer = options.viewer;
        var url = options.url ? options.url : './source/background.jpg';

        var frustum = options.frustum.clone();
        var orientation = options.orientation;
        var origin = options.origin;

        frustum.far = 250;
        this.geometry = this.createFrustumGeomtry(frustum, origin, orientation, false);
        this.appearance = VideoProjectionPrimitive.createAppearence(true);
        this.id = Cesium.defaultValue(options.id, Cesium.createGuid());
        this.outline = Cesium.defaultValue(options.outline, false);

        if (this.outline) {
            this.outlineColor = Cesium.defaultValue(options.outlineColor, new Cesium.Color(1, 0, 0, 1));
            this.outlinePrimitive = new Cesium.Primitive({
                geometryInstances: new Cesium.GeometryInstance({
                    geometry: Cesium.FrustumOutlineGeometry.createGeometry(new Cesium.FrustumOutlineGeometry({
                        frustum: frustum,
                        origin: origin,
                        orientation: orientation,
                    })),
                    attributes: {
                        color: Cesium.ColorGeometryInstanceAttribute.fromColor(this.outlineColor)
                    },
                    id: this.id + "_outline",
                }),
                appearance: new Cesium.PerInstanceColorAppearance({
                    translucent: false,
                    flat: true
                }),
                asynchronous: false
            });
        }

        this.primitive = new Cesium.Primitive({
            geometryInstances: new Cesium.GeometryInstance({
                geometry: this.geometry,
                id: this.id + "_video",
                attributes: {
                    color: Cesium.ColorGeometryInstanceAttribute.fromColor(new Cesium.Color(1.0, 1.0, 1.0, 0.2))
                }
            }),
            allowPicking: false,
            appearance: this.appearance,
            asynchronous: false,
            releaseGeometryInstances: false,
            compressVertices: true,
            _createShaderProgramFunction: createShaderProgramFunction,
            _createCommandsFunction: createCommandsFunction,
            _createRenderStatesFunction: createRenderStatesFunction,
            _updateAndQueueCommandsFunction: updateAndQueueCommands,
        });
    };

    createNearFarPlane(frustum, origin, orientation) {
        let positions = new Float64Array(3 * 4 * 6);
        let scratchRotationMatrix = new Cesium.Matrix3();
        let x = new Cesium.Cartesian3();
        let y = new Cesium.Cartesian3();
        let z = new Cesium.Cartesian3();
        let rotationMatrix = Cesium.Matrix3.fromQuaternion(orientation, scratchRotationMatrix);
        let scratchViewMatrix = new Cesium.Matrix4();
        var scratchInverseMatrix = new Cesium.Matrix4();

        x = Cesium.Matrix3.getColumn(rotationMatrix, 0, x);
        y = Cesium.Matrix3.getColumn(rotationMatrix, 1, y);
        z = Cesium.Matrix3.getColumn(rotationMatrix, 2, z);

        this.scratchXDirection = x;
        this.scratchYDirection = y;
        this.scratchZDirection = z;

        Cesium.Cartesian3.normalize(x, x);
        Cesium.Cartesian3.normalize(y, y);
        Cesium.Cartesian3.normalize(z, z);

        Cesium.Cartesian3.negate(x, x);

        let view = Cesium.Matrix4.computeView(origin, z, y, x, scratchViewMatrix);

        let inverseView;
        let inverseViewProjection;
        let projection = frustum.projectionMatrix;

        let viewProjection = Cesium.Matrix4.multiply(projection, view, scratchInverseMatrix);
        inverseViewProjection = Cesium.Matrix4.inverse(viewProjection, scratchInverseMatrix);

        let frustumSplits = new Array(3);

        if (Cesium.defined(inverseViewProjection)) {
            frustumSplits[0] = frustum.near;
            frustumSplits[1] = frustum.far;
        }

        let frustumCornersNDC = new Array(4);
        frustumCornersNDC[0] = new Cesium.Cartesian4(-1.0, -1.0, 1.0, 1.0);
        frustumCornersNDC[1] = new Cesium.Cartesian4(1.0, -1.0, 1.0, 1.0);
        frustumCornersNDC[2] = new Cesium.Cartesian4(1.0, 1.0, 1.0, 1.0);
        frustumCornersNDC[3] = new Cesium.Cartesian4(-1.0, 1.0, 1.0, 1.0);

        let scratchFrustumCorners = new Array(4);
        for (let i = 0; i < 4; ++i) {
            scratchFrustumCorners[i] = new Cesium.Cartesian4();
        }

        for (let i = 0; i < 2; ++i) {
            for (let j = 0; j < 4; ++j) {
                let corner = Cesium.Cartesian4.clone(frustumCornersNDC[j], scratchFrustumCorners[j]);
                corner = Cesium.Matrix4.multiplyByVector(inverseViewProjection, corner, corner);

                // Reverse perspective divide
                var w = 1.0 / corner.w;
                Cesium.Cartesian3.multiplyByScalar(corner, w, corner);
                Cesium.Cartesian3.subtract(corner, origin, corner);
                Cesium.Cartesian3.normalize(corner, corner);

                var fac = Cesium.Cartesian3.dot(z, corner);
                Cesium.Cartesian3.multiplyByScalar(corner, frustumSplits[i] / fac, corner);
                Cesium.Cartesian3.add(corner, origin, corner);

                positions[12 * i + j * 3] = corner.x;
                positions[12 * i + j * 3 + 1] = corner.y;
                positions[12 * i + j * 3 + 2] = corner.z;
            }
        }
        return positions;
    };

    createOtherPlane(positions) {
        var offset = 3 * 4 * 2;
        // -x plane
        positions[offset] = positions[3 * 4];
        positions[offset + 1] = positions[3 * 4 + 1];
        positions[offset + 2] = positions[3 * 4 + 2];
        positions[offset + 3] = positions[0];
        positions[offset + 4] = positions[1];
        positions[offset + 5] = positions[2];
        positions[offset + 6] = positions[3 * 3];
        positions[offset + 7] = positions[3 * 3 + 1];
        positions[offset + 8] = positions[3 * 3 + 2];
        positions[offset + 9] = positions[3 * 7];
        positions[offset + 10] = positions[3 * 7 + 1];
        positions[offset + 11] = positions[3 * 7 + 2];

        // -y plane
        offset += 3 * 4;
        positions[offset] = positions[3 * 5];
        positions[offset + 1] = positions[3 * 5 + 1];
        positions[offset + 2] = positions[3 * 5 + 2];
        positions[offset + 3] = positions[3];
        positions[offset + 4] = positions[3 + 1];
        positions[offset + 5] = positions[3 + 2];
        positions[offset + 6] = positions[0];
        positions[offset + 7] = positions[1];
        positions[offset + 8] = positions[2];
        positions[offset + 9] = positions[3 * 4];
        positions[offset + 10] = positions[3 * 4 + 1];
        positions[offset + 11] = positions[3 * 4 + 2];

        // +x plane
        offset += 3 * 4;
        positions[offset] = positions[3];
        positions[offset + 1] = positions[3 + 1];
        positions[offset + 2] = positions[3 + 2];
        positions[offset + 3] = positions[3 * 5];
        positions[offset + 4] = positions[3 * 5 + 1];
        positions[offset + 5] = positions[3 * 5 + 2];
        positions[offset + 6] = positions[3 * 6];
        positions[offset + 7] = positions[3 * 6 + 1];
        positions[offset + 8] = positions[3 * 6 + 2];
        positions[offset + 9] = positions[3 * 2];
        positions[offset + 10] = positions[3 * 2 + 1];
        positions[offset + 11] = positions[3 * 2 + 2];

        // +y plane
        offset += 3 * 4;
        positions[offset] = positions[3 * 2];
        positions[offset + 1] = positions[3 * 2 + 1];
        positions[offset + 2] = positions[3 * 2 + 2];
        positions[offset + 3] = positions[3 * 6];
        positions[offset + 4] = positions[3 * 6 + 1];
        positions[offset + 5] = positions[3 * 6 + 2];
        positions[offset + 6] = positions[3 * 7];
        positions[offset + 7] = positions[3 * 7 + 1];
        positions[offset + 8] = positions[3 * 7 + 2];
        positions[offset + 9] = positions[3 * 3];
        positions[offset + 10] = positions[3 * 3 + 1];
        positions[offset + 11] = positions[3 * 3 + 2];

        return positions;
    };

    getAttributes(offset, normals, tangents, bitangents, st, normal, tangent, bitangent, st_all_zero = true) {
        var stOffset = offset / 3 * 2;

        for (var i = 0; i < 4; ++i) {
            if (Cesium.defined(normals)) {
                normals[offset] = normal.x;
                normals[offset + 1] = normal.y;
                normals[offset + 2] = normal.z;
            }
            if (Cesium.defined(tangents)) {
                tangents[offset] = tangent.x;
                tangents[offset + 1] = tangent.y;
                tangents[offset + 2] = tangent.z;
            }
            if (Cesium.defined(bitangents)) {
                bitangents[offset] = bitangent.x;
                bitangents[offset + 1] = bitangent.y;
                bitangents[offset + 2] = bitangent.z;
            }
            offset += 3;
        }
        if (st_all_zero) {
            st[stOffset] = 0.0;
            st[stOffset + 1] = 0.0;
            st[stOffset + 2] = 0.0;
            st[stOffset + 3] = 0.0;
            st[stOffset + 4] = 0.0;
            st[stOffset + 5] = 0.0;
            st[stOffset + 6] = 0.0;
            st[stOffset + 7] = 0.0;

        } else {
            st[stOffset] = 0.0;
            st[stOffset + 1] = 0.0;
            st[stOffset + 2] = 1.0;
            st[stOffset + 3] = 0.0;
            st[stOffset + 4] = 1.0;
            st[stOffset + 5] = 1.0;
            st[stOffset + 6] = 0.0;
            st[stOffset + 7] = 1.0;
        }
    };

    createOtherAttributes(attributes) {
        let numberOfPlanes = 6;
        var normals = new Float32Array(3 * 4 * numberOfPlanes);
        var tangents = new Float32Array(3 * 4 * numberOfPlanes);
        var bitangents = new Float32Array(3 * 4 * numberOfPlanes);
        var st = new Float32Array(2 * 4 * numberOfPlanes);

        var scratchNegativeX = new Cesium.Cartesian3();
        var scratchNegativeY = new Cesium.Cartesian3();
        var scratchNegativeZ = new Cesium.Cartesian3();

        var x = this.scratchXDirection;
        var y = this.scratchYDirection;
        var z = this.scratchZDirection;

        var negativeX = Cesium.Cartesian3.negate(x, scratchNegativeX);
        var negativeY = Cesium.Cartesian3.negate(y, scratchNegativeY);
        var negativeZ = Cesium.Cartesian3.negate(z, scratchNegativeZ);

        var offset = 0;
        this.getAttributes(offset, normals, tangents, bitangents, st, negativeZ, x, y); // near

        offset += 3 * 4;
        this.getAttributes(offset, normals, tangents, bitangents, st, z, negativeX, y, false); // far

        offset += 3 * 4;
        this.getAttributes(offset, normals, tangents, bitangents, st, negativeX, negativeZ, y); // -x

        offset += 3 * 4;
        this.getAttributes(offset, normals, tangents, bitangents, st, negativeY, negativeZ, negativeX); // -y

        offset += 3 * 4;
        this.getAttributes(offset, normals, tangents, bitangents, st, x, z, y); // +x

        offset += 3 * 4;
        this.getAttributes(offset, normals, tangents, bitangents, st, y, z, negativeX); // +y

        if (Cesium.defined(normals)) {
            attributes.normal = new Cesium.GeometryAttribute({
                componentDatatype: Cesium.ComponentDatatype.FLOAT,
                componentsPerAttribute: 3,
                values: normals
            });
        }
        if (Cesium.defined(tangents)) {
            attributes.tangent = new Cesium.GeometryAttribute({
                componentDatatype: Cesium.ComponentDatatype.FLOAT,
                componentsPerAttribute: 3,
                values: tangents
            });
        }
        if (Cesium.defined(bitangents)) {
            attributes.bitangent = new Cesium.GeometryAttribute({
                componentDatatype: Cesium.ComponentDatatype.FLOAT,
                componentsPerAttribute: 3,
                values: bitangents
            });
        }
        if (Cesium.defined(st)) {
            attributes.st = new Cesium.GeometryAttribute({
                componentDatatype: Cesium.ComponentDatatype.FLOAT,
                componentsPerAttribute: 2,
                values: st
            });
        }


        var indices = new Uint16Array(6 * 6);
        for (var i = 0; i < 6; ++i) {
            var indexOffset = i * 6;
            var index = i * 4;

            indices[indexOffset] = index;
            indices[indexOffset + 1] = index + 1;
            indices[indexOffset + 2] = index + 2;
            indices[indexOffset + 3] = index;
            indices[indexOffset + 4] = index + 2;
            indices[indexOffset + 5] = index + 3;
        }

        return indices;
    };

    createFrustumGeomtry(frustum, origin, orientation, onePlaneTex = true) {
        let positions = this.createNearFarPlane(frustum, origin, orientation);
        positions = this.createOtherPlane(positions);

        let attributes = new Cesium.GeometryAttributes({
            position: new Cesium.GeometryAttribute({
                componentDatatype: Cesium.ComponentDatatype.DOUBLE,
                componentsPerAttribute: 3,
                values: positions
            })
        });

        let indices = this.createOtherAttributes(attributes);

        return new Cesium.Geometry({
            attributes: attributes,
            indices: indices,
            primitiveType: Cesium.PrimitiveType.TRIANGLES,
            boundingSphere: Cesium.BoundingSphere.fromVertices(positions)
        });

    };

    createAppearence(fs, vs, ms, url) {

        var appearance = new Cesium.MaterialAppearance({
            flat: true,
            translucent: false,
            material: new Cesium.Material({
                fabric: {
                    type: 'Image',
                    uniforms: {
                        image: 'http://localhost:1000/Apps/SampleData/fire.png'
                    }
                }
            })
        });

        return new Cesium.Appearance({
            material: new Cesium.Material({
                fabric: {
                    uniforms: {
                        image: url
                    },
                    source: ms
                }
            }),
            aboveGround: true,
            faceForward: true,
            flat: true,
            translucent: false,
            renderState: {
                blending: Cesium.BlendingState.PRE_MULTIPLIED_ALPHA_BLEND,
                depthTest: { enabled: true },
                depthMask: true,
            },
            fragmentShaderSource: fs,
            vertexShaderSource: vs
        });
    };

    update(frameState) {
        if (this.primitive) {
            this.primitive.update(frameState);
        }
        if (this.outlinePrimitive) {
            this.outlinePrimitive.update(frameState);
        }
    };
    isSupported(scene) {
        return scene.context.stencilBuffer;
    };
    destroy() {
        return undefined;
    };
}

VideoProjectionPrimitive.createOratetionFromCamera = function (camera) {
    let cameraRight = new Cesium.Cartesian3();
    let cameraRotation = new Cesium.Matrix3();
    var cameraQuaternion = new Cesium.Quaternion();
    let position = camera.positionWC;
    let direction = camera.directionWC;
    let up = camera.upWC;
    let right = camera.rightWC;
    right = Cesium.Cartesian3.negate(right, cameraRight);

    let rotation = cameraRotation;
    Cesium.Matrix3.setColumn(rotation, 0, right, rotation);
    Cesium.Matrix3.setColumn(rotation, 1, up, rotation);
    Cesium.Matrix3.setColumn(rotation, 2, direction, rotation);
    //计算视锥姿态
    let orientation = Cesium.Quaternion.fromRotationMatrix(rotation, cameraQuaternion);
    return orientation;
}

VideoProjectionPrimitive.createShaderProgram = function (frameState, primitive, attributeLocations, shaderSourceArray) {
    var context = frameState.context;
    var shaderVS = shaderSourceArray[0];
    var shaderFS = shaderSourceArray[1];
    // var shaderMS = createMS();

    var vertexShaderSource = new Cesium.ShaderSource({
        defines: [],
        sources: [shaderVS],
        includeBuiltIns: true,
        pickColorQualifier: undefined
    });

    var fragmentShaderSource = new Cesium.ShaderSource({
        defines: [],
        sources: [shaderFS],
        includeBuiltIns: true,
        pickColorQualifier: undefined
    });

    var shaderCache = context.shaderCache;
    var keyword = shaderVS + shaderFS + JSON.stringify(attributeLocations);
    if (Cesium.defined(shaderCache._shaders[keyword])) {
        cachedShader = shaderCache._shaders[keyword];

        // No longer want to release this if it was previously released.
        delete shaderCache._shadersToRelease[keyword];
    }

    var shaderProgram = new Cesium.ShaderProgram({
        gl: frameState.context._gl,
        logShaderCompilation: context.logShaderCompilation,
        debugShaders: context.debugShaders,
        vertexShaderSource: vertexShaderSource,
        vertexShaderText: shaderVS,
        fragmentShaderSource: fragmentShaderSource,
        fragmentShaderText: shaderFS,
        attributeLocations: attributeLocations
    });



    //add to cache

    var cachedShader = {
        cache: shaderCache,
        shaderProgram: shaderProgram,
        keyword: keyword,
        derivedKeywords: [],
        count: 0
    };


    shaderProgram._cachedShader = cachedShader;
    shaderCache._shaders[keyword] = cachedShader;
    ++shaderCache._numberOfShaders;
    ++cachedShader.count;

    //drived command shader cache
    var derivedShaderProgram = new Cesium.ShaderProgram({
        gl: frameState.context._gl,
        logShaderCompilation: context.logShaderCompilation,
        debugShaders: context.debugShaders,
        vertexShaderSource: vertexShaderSource,
        vertexShaderText: shaderVS,
        fragmentShaderSource: fragmentShaderSource,
        fragmentShaderText: shaderFS,
        attributeLocations: attributeLocations
    });

    var derivedKeyword = "logDepth" + keyword;

    var derivedCachedShader = {
        cache: shaderCache,
        shaderProgram: derivedShaderProgram,
        keyword: derivedKeyword,
        derivedKeywords: [],
        count: 0
    };

    cachedShader.derivedKeywords.push("logDepth");
    derivedShaderProgram._cachedShader = derivedCachedShader;
    shaderCache._shaders[derivedKeyword] = derivedCachedShader;


    //hdr command shader cache
    //drived command shader cache
    var hdrShaderProgram = new Cesium.ShaderProgram({
        gl: frameState.context._gl,
        logShaderCompilation: context.logShaderCompilation,
        debugShaders: context.debugShaders,
        vertexShaderSource: vertexShaderSource,
        vertexShaderText: shaderVS,
        fragmentShaderSource: fragmentShaderSource,
        fragmentShaderText: shaderFS,
        attributeLocations: attributeLocations
    });

    var hdrKeyword = "HDR" + derivedKeyword;

    var hdrCachedShader = {
        cache: shaderCache,
        shaderProgram: hdrShaderProgram,
        keyword: hdrKeyword,
        derivedKeywords: [],
        count: 0
    };

    cachedShader.derivedKeywords.push("HDR");
    hdrShaderProgram._cachedShader = hdrCachedShader;
    shaderCache._shaders[hdrKeyword] = hdrCachedShader;

    return shaderProgram;
}

VideoProjectionPrimitive.createFS = function () {
    return `
#extension GL_EXT_frag_depth:enable
precision mediump float;

#define LOG_DEPTH
#define HDR
#define OES_texture_float_linear

uniform float czm_log2NearDistance;
uniform float czm_log2FarDistance;
uniform float czm_gamma;
varying float v_logZ;

void czm_writeLogDepth(float logZ)
{
    float halfLogFarDistance=czm_log2FarDistance*.5;
    float depth=log2(logZ);
    if(depth<czm_log2NearDistance){
        discard;
    }
    gl_FragDepthEXT=depth*halfLogFarDistance;
}
void czm_writeLogDepth(){
    czm_writeLogDepth(v_logZ);
}

varying float v_WindowZ;
void czm_writeDepthClampedToFarPlane()
{

}

vec3 czm_gammaCorrect(vec3 color){
    color=pow(color,vec3(czm_gamma));
    return color;
}
vec4 czm_gammaCorrect(vec4 color){
    color.rgb=pow(color.rgb,vec3(czm_gamma));
    return color;
}

void czm_log_depth_main()
{
    gl_FragColor=vec4(1.);
    czm_writeDepthClampedToFarPlane();
}

#line 0

void main()
{
    czm_log_depth_main();
    czm_writeLogDepth();
}
`
}

VideoProjectionPrimitive.createVS = function () {
    return `
    #define ENABLE_GL_POSITION_LOG_DEPTH_AT_HEIGHT
    #define LOG_DEPTH
    #define HDR
    #define OES_texture_float_linear
    precision mediump float;

    uniform float czm_log2FarDistance;
    uniform mat4 czm_inverseProjection;
    uniform vec3 czm_encodedCameraPositionMCLow;
    uniform vec3 czm_encodedCameraPositionMCHigh;
    varying float v_logZ;

    void czm_updatePositionDepth(){
        vec3 logPositionEC=(czm_inverseProjection*gl_Position).xyz;
        if(length(logPositionEC)<2.e6)
        {
            return;
        }
        gl_Position.z=log2(max(1e-6,1.+gl_Position.w))*czm_log2FarDistance-1.;
        gl_Position.z*=gl_Position.w;
    }
    void czm_vertexLogDepth()
    {
        v_logZ=1.+gl_Position.w;
        czm_updatePositionDepth();
    }
    void czm_vertexLogDepth(vec4 clipCoords)
    {
        v_logZ=1.+clipCoords.w;
        czm_updatePositionDepth();
    }

    vec4 czm_columbusViewMorph(vec4 position2D,vec4 position3D,float time)
    {
        vec3 p=mix(position2D.xyz,position3D.xyz,time);
        return vec4(p,1.);
    }

    uniform mat4 czm_modelViewProjectionRelativeToEye;
    varying float v_WindowZ;
    vec4 czm_depthClampFarPlane(vec4 coords)
    {
        v_WindowZ=(.5*(coords.z/coords.w)+.5)*coords.w;
        coords.z=min(coords.z,coords.w);
        return coords;
    }

    vec4 czm_translateRelativeToEye(vec3 high,vec3 low)
    {
        vec3 highDifference=high-czm_encodedCameraPositionMCHigh;
        vec3 lowDifference=low-czm_encodedCameraPositionMCLow;
        return vec4(highDifference+lowDifference,1.);
    }

    vec4 czm_computePosition();

    attribute vec3 position2DHigh;
    attribute vec3 position2DLow;

    attribute vec3 position3DHigh;
    attribute vec3 position3DLow;
    attribute float batchId;

    uniform sampler2D batchTexture;
    uniform vec4 batchTextureStep;

    void czm_log_depth_main()
    {
        vec4 position=czm_computePosition();
        gl_Position=czm_depthClampFarPlane(czm_modelViewProjectionRelativeToEye*position);
    }

    vec4 czm_computePosition()
    {
        vec4 p=czm_translateRelativeToEye(position3DHigh,position3DLow);
        return p;
    }

    #line 0

    void main()
    {
        czm_log_depth_main();
        czm_vertexLogDepth();
    }
    `
};

VideoProjectionPrimitive.createFS1 = function () {
    return `
#extension GL_EXT_frag_depth:enable
#define OES_texture_float_linear
#define HDR
#define LOG_DEPTH

#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform float czm_log2NearDistance;
uniform float czm_log2FarDistance;
uniform vec4 color_2;
uniform vec2 repeat_1;
uniform sampler2D image_0;

struct czm_material
{
    vec3 diffuse;
    float specular;
    float shininess;
    vec3 normal;
    vec3 emission;
    float alpha;
};

struct czm_materialInput
{
    float s;
    vec2 st;
    vec3 str;
    vec3 normalEC;
    mat3 tangentToEyeMatrix;
    vec3 positionToEyeEC;
    float height;
    float slope;
    float aspect;
};

uniform float czm_gamma;

varying float v_logZ;
varying vec2 v_texture_coors;

czm_material czm_getDefaultMaterial(czm_materialInput materialInput)
{
    czm_material material;
    material.diffuse=vec3(0.);
    material.specular=0.;
    material.shininess=1.;
    material.normal=materialInput.normalEC;
    material.emission=vec3(0.);
    material.alpha=1.;
    return material;
}

vec3 czm_gammaCorrect(vec3 color){
    #ifdef HDR
    color=pow(color,vec3(czm_gamma));
    #endif
    return color;
}
vec4 czm_gammaCorrect(vec4 color){
    #ifdef HDR
    color.rgb=pow(color.rgb,vec3(czm_gamma));
    #endif
    return color;
}

czm_material czm_getMaterial(czm_materialInput materialInput)
{
    czm_material material=czm_getDefaultMaterial(materialInput);
    material.diffuse=czm_gammaCorrect(texture2D(image_0,fract(repeat_1*materialInput.st)).rgb*color_2.rgb);
    material.alpha=czm_gammaCorrect(vec4(vec3(0.),texture2D(image_0,fract(repeat_1*materialInput.st)).a*color_2.a)).a;
    return material;
}

varying float v_WindowZ;
void czm_writeDepthClampedToFarPlane()
{
    #if defined(GL_EXT_frag_depth)&&!defined(LOG_DEPTH)
    gl_FragDepthEXT=min(v_WindowZ*gl_FragCoord.w,1.);
    #endif
}
const float czm_twoPi=6.283185307179586;

void czm_writeLogDepth(float logZ)
{
    float halfLogFarDistance=czm_log2FarDistance*.5;
    float depth=log2(logZ);
    if(depth<czm_log2NearDistance){
        discard;
    }
    gl_FragDepthEXT=depth*halfLogFarDistance;
}
void czm_writeLogDepth(){
    czm_writeLogDepth(v_logZ);
}

void czm_log_depth_main()
{

    czm_materialInput materialInput;
    materialInput.st=v_texture_coors;
    czm_material material=czm_getMaterial(materialInput);
    gl_FragColor=vec4(material.diffuse+material.emission,material.alpha);
    czm_writeDepthClampedToFarPlane();
}

#line 0

void main()
{
    czm_log_depth_main();
    czm_writeLogDepth();
}
`
}

VideoProjectionPrimitive.createVS1 = function () {
    return `

    #define ENABLE_GL_POSITION_LOG_DEPTH_AT_HEIGHT
    #define PER_INSTANCE_COLOR
    #define LOG_DEPTH
    #define HDR
    #define OES_texture_float_linear

    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif

    uniform float czm_log2FarDistance;
    uniform mat4 czm_inverseProjection;
    uniform vec3 czm_encodedCameraPositionMCLow;
    uniform vec3 czm_encodedCameraPositionMCHigh;
    #ifdef LOG_DEPTH
    varying float v_logZ;
    varying vec2 v_texture_coors;

    attribute vec3 compressedAttributes;
    attribute vec3 position2DHigh;
    attribute vec3 position2DLow;

    attribute vec3 position3DHigh;
    attribute vec3 position3DLow;
    attribute float batchId;

    #ifdef PER_INSTANCE_COLOR
    varying vec4 v_color;
    #endif


    #endif
    void czm_updatePositionDepth(){
        vec3 logPositionEC=(czm_inverseProjection*gl_Position).xyz;
        if(length(logPositionEC)<2.e6)
        {
            return;
        }
        gl_Position.z=log2(max(1e-6,1.+gl_Position.w))*czm_log2FarDistance-1.;
        gl_Position.z*=gl_Position.w;
    }
    void czm_vertexLogDepth()
    {
        v_logZ=1.+gl_Position.w;
        czm_updatePositionDepth();
    }

    uniform mat4 czm_modelViewProjectionRelativeToEye;

    varying float v_WindowZ;

    vec2 czm_decompressTextureCoordinates(float encoded)
    {
        float temp=encoded/4096.;
        float xZeroTo4095=floor(temp);
        float stx=xZeroTo4095/4095.;
        float sty=(encoded-xZeroTo4095*4096.)/4095.;
        return vec2(stx,sty);
    }

    vec2 decode_st(){
        vec2 st=czm_decompressTextureCoordinates(compressedAttributes.x);
        return st;
    }

    vec4 czm_depthClampFarPlane(vec4 coords)
    {
        v_WindowZ=(.5*(coords.z/coords.w)+.5)*coords.w;
        coords.z=min(coords.z,coords.w);
        return coords;
    }

    vec4 czm_translateRelativeToEye(vec3 high,vec3 low)
    {
        vec3 highDifference=high-czm_encodedCameraPositionMCHigh;
        vec3 lowDifference=low-czm_encodedCameraPositionMCLow;
        return vec4(highDifference+lowDifference,1.);
    }

    vec4 czm_computePosition();

    uniform sampler2D batchTexture;
    uniform vec4 batchTextureStep;
    vec2 computeSt(float batchId)
    {
        float stepX=batchTextureStep.x;
        float centerX=batchTextureStep.y;
        float numberOfAttributes=float(2);
        return vec2(centerX+(batchId*numberOfAttributes*stepX),.5);
    }

    vec4 czm_batchTable_color(float batchId)
    {
        vec2 st=computeSt(batchId);
        st.x+=batchTextureStep.x*float(0);
        vec4 textureValue=texture2D(batchTexture,st);
        vec4 value=textureValue;
        return value;
    }
    vec4 czm_batchTable_pickColor(float batchId)
    {
        vec2 st=computeSt(batchId);
        st.x+=batchTextureStep.x*float(1);
        vec4 textureValue=texture2D(batchTexture,st);
        vec4 value=textureValue;
        return value;
    }

    void czm_log_depth_main()
    {
        vec4 position=czm_computePosition();
        #ifdef PER_INSTANCE_COLOR
        v_color=czm_batchTable_color(batchId);
        #endif
        gl_Position=czm_depthClampFarPlane(czm_modelViewProjectionRelativeToEye*position);
    }

    vec4 czm_computePosition()
    {
        vec4 p=czm_translateRelativeToEye(position3DHigh,position3DLow);
        return p;
    }

    #line 0

    void main()
    {
        czm_log_depth_main();
        czm_vertexLogDepth();
        v_texture_coors=decode_st();
    }
`
}

VideoProjectionPrimitive.createFS2 = function () {
    return `
    #extension GL_EXT_frag_depth:enable

    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif

    #define SPHERICAL
    #define PER_INSTANCE_COLOR
    #define FLAT
    #define LOG_DEPTH
    #define OES_texture_float_linear

    uniform float czm_log2NearDistance;
    uniform float czm_log2FarDistance;
    uniform float czm_sceneMode;

    uniform float czm_gamma;

    varying float v_logZ;

    void czm_writeLogDepth(float logZ)
    {
        float halfLogFarDistance=czm_log2FarDistance*.5;
        float depth=log2(logZ);
        if(depth<czm_log2NearDistance){
            discard;
        }
        gl_FragDepthEXT=depth*halfLogFarDistance;
    }

    void czm_writeLogDepth(){
        czm_writeLogDepth(v_logZ);
    }

    vec3 czm_gammaCorrect(vec3 color){
        return color;
    }
    vec4 czm_gammaCorrect(vec4 color){
        return color;
    }

    varying float v_WindowZ;

    void czm_writeDepthClampedToFarPlane()
    {

    }

    varying vec4 v_color;

    void czm_log_depth_main()
    {
        vec4 color=czm_gammaCorrect(v_color);
        gl_FragColor=color;
        czm_writeDepthClampedToFarPlane();
    }

    #line 0

    void main()
    {
        czm_log_depth_main();
        czm_writeLogDepth();
    }
`
}

VideoProjectionPrimitive.createVS2 = function () {
    return `

    #define ENABLE_GL_POSITION_LOG_DEPTH_AT_HEIGHT
    #define PER_INSTANCE_COLOR
    #define LOG_DEPTH
    #define HDR
    #define OES_texture_float_linear

    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    attribute vec3 compressedAttributes;
    uniform float czm_log2FarDistance;
    uniform mat4 czm_inverseProjection;
    uniform vec3 czm_encodedCameraPositionMCLow;
    uniform vec3 czm_encodedCameraPositionMCHigh;
    #ifdef LOG_DEPTH
    varying float v_logZ;

    attribute vec3 position2DHigh;
    attribute vec3 position2DLow;

    attribute vec3 position3DHigh;
    attribute vec3 position3DLow;
    attribute float batchId;

    #ifdef PER_INSTANCE_COLOR
    varying vec4 v_color;
    #endif


    #endif
    void czm_updatePositionDepth(){
        vec3 logPositionEC=(czm_inverseProjection*gl_Position).xyz;
        if(length(logPositionEC)<2.e6)
        {
            return;
        }
        gl_Position.z=log2(max(1e-6,1.+gl_Position.w))*czm_log2FarDistance-1.;
        gl_Position.z*=gl_Position.w;
    }
    void czm_vertexLogDepth()
    {
        v_logZ=1.+gl_Position.w;
        czm_updatePositionDepth();
    }

    uniform mat4 czm_modelViewProjectionRelativeToEye;

    varying float v_WindowZ;

    vec2 czm_decompressTextureCoordinates(float encoded)
    {
        float temp=encoded/4096.;
        float xZeroTo4095=floor(temp);
        float stx=xZeroTo4095/4095.;
        float sty=(encoded-xZeroTo4095*4096.)/4095.;
        return vec2(stx,sty);
    }

    vec2 decode_st(){
        vec2 st=czm_decompressTextureCoordinates(compressedAttributes.x);
        return st;
    }

    vec4 czm_depthClampFarPlane(vec4 coords)
    {
        v_WindowZ=(.5*(coords.z/coords.w)+.5)*coords.w;
        coords.z=min(coords.z,coords.w);
        return coords;
    }

    vec4 czm_translateRelativeToEye(vec3 high,vec3 low)
    {
        vec3 highDifference=high-czm_encodedCameraPositionMCHigh;
        vec3 lowDifference=low-czm_encodedCameraPositionMCLow;
        return vec4(highDifference+lowDifference,1.);
    }

    vec4 czm_computePosition();

    uniform sampler2D batchTexture;
    uniform vec4 batchTextureStep;
    vec2 computeSt(float batchId)
    {
        float stepX=batchTextureStep.x;
        float centerX=batchTextureStep.y;
        float numberOfAttributes=float(2);
        return vec2(centerX+(batchId*numberOfAttributes*stepX),.5);
    }

    vec4 czm_batchTable_color(float batchId)
    {
        vec2 st=computeSt(batchId);
        st.x+=batchTextureStep.x*float(0);
        vec4 textureValue=texture2D(batchTexture,st);
        vec4 value=textureValue;
        return value;
    }
    vec4 czm_batchTable_pickColor(float batchId)
    {
        vec2 st=computeSt(batchId);
        st.x+=batchTextureStep.x*float(1);
        vec4 textureValue=texture2D(batchTexture,st);
        vec4 value=textureValue;
        return value;
    }

    void czm_log_depth_main()
    {
        vec4 position=czm_computePosition();
        #ifdef PER_INSTANCE_COLOR
        v_color=czm_batchTable_color(batchId);
        #endif
        gl_Position=czm_depthClampFarPlane(czm_modelViewProjectionRelativeToEye*position);
    }

    vec4 czm_computePosition()
    {
        vec4 p=czm_translateRelativeToEye(position3DHigh,position3DLow);
        return p;
    }

    #line 0

    void main()
    {
        czm_log_depth_main();
        czm_vertexLogDepth();
    }
`
}

VideoProjectionPrimitive.createAppearence = function (bTexture) {
    if (bTexture)
        return new Cesium.Appearance({
            material: new Cesium.Material({
                translucent: false,
                fabric: {
                    uniforms: {
                        image: "http://localhost:1000/Apps/SampleData/fire.png",
                        repeat: new Cesium.Cartesian2(1, 1),
                        color: new Cesium.Color(1, 1, 1, 1)
                    },
                    // source: VideoProjectionPrimitive.createMS()
                }
            }),
        });
    return new Cesium.PerInstanceColorAppearance({
        fragmentShaderSource: VideoProjectionPrimitive.createFS(),
        vertexShaderSource: VideoProjectionPrimitive.createVS(),
        flat: true,
        translucent: false,
    });
}

VideoProjectionPrimitive.createShaderArray = function (bColor) {
    if (bColor) {
        return [
            VideoProjectionPrimitive.createVS1(),
            VideoProjectionPrimitive.createFS1(),
        ];
    }
    return [
        VideoProjectionPrimitive.createVS(),
        VideoProjectionPrimitive.createFS(),
    ];

}


