import * as THREE from 'three';

// Per-space ambient and directional light. The scene has one ambient and one
// directional light, and they follow the space you are in (RoomLighting), so
// through an open door the other side would show your light, not its own.
// Every lit material is patched at compile time: each pixel finds which
// space it is in (the bars and their bathrooms are rotated boxes, anything
// else is outside) and uses that space's ambient and directional light
// instead. RoomLighting fills the uniforms every frame.
export const REGION_MAX = 12;

export const regionUniforms = {
    regionCount: { value: 0 },
    // Per region: center x, center z, cos(yaw), sin(yaw) / half width, half depth.
    regionBoxes: { value: Array.from({ length: REGION_MAX }, () => new THREE.Vector4()) },
    regionHalf: { value: Array.from({ length: REGION_MAX }, () => new THREE.Vector2()) },
    regionAmbient: { value: Array.from({ length: REGION_MAX }, () => new THREE.Color()) },
    regionDirectional: { value: Array.from({ length: REGION_MAX }, () => new THREE.Color()) },
    outdoorAmbient: { value: new THREE.Color() },
    outdoorDirectional: { value: new THREE.Color() }
};

const VERTEX_HEADER = 'varying vec3 vRegionWorld;\n';
const VERTEX_WORLD = `
vec4 regionWorld = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	regionWorld = batchingMatrix * regionWorld;
#endif
#ifdef USE_INSTANCING
	regionWorld = instanceMatrix * regionWorld;
#endif
vRegionWorld = ( modelMatrix * regionWorld ).xyz;
`;

const FRAGMENT_HEADER = `
#define REGION_MAX ${REGION_MAX}
uniform int regionCount;
uniform vec4 regionBoxes[ REGION_MAX ];
uniform vec2 regionHalf[ REGION_MAX ];
uniform vec3 regionAmbient[ REGION_MAX ];
uniform vec3 regionDirectional[ REGION_MAX ];
uniform vec3 outdoorAmbient;
uniform vec3 outdoorDirectional;
varying vec3 vRegionWorld;

// The first region containing p (bathrooms come before their bar), else outside.
void regionLightAt( vec3 p, out vec3 ambient, out vec3 directional ) {
	ambient = outdoorAmbient;
	directional = outdoorDirectional;
	for ( int i = 0; i < REGION_MAX; i ++ ) {
		if ( i >= regionCount ) break;
		vec4 box = regionBoxes[ i ];
		vec2 d = p.xz - box.xy;
		vec2 local = vec2( box.z * d.x - box.w * d.y, box.w * d.x + box.z * d.y );
		if ( abs( local.x ) <= regionHalf[ i ].x && abs( local.y ) <= regionHalf[ i ].y ) {
			ambient = regionAmbient[ i ];
			directional = regionDirectional[ i ];
			return;
		}
	}
}
`;

// A wall's two faces sit on either side of the boundary: a point a little in
// front of the surface tells which space a face looks into.
const FRAGMENT_LIGHTS = `
vec3 regionAmbientLight;
vec3 regionDirectionalLight;
regionLightAt( vRegionWorld + inverseTransformDirection( normal, viewMatrix ) * 0.05, regionAmbientLight, regionDirectionalLight );
` + THREE.ShaderChunk.lights_fragment_begin
    .replace('getAmbientLightIrradiance( ambientLightColor )', 'getAmbientLightIrradiance( regionAmbientLight )')
    .replace('getDirectionalLightInfo( directionalLight, directLight );',
        'getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color = regionDirectionalLight;');

// Installs the patch for every lit material drawn by `renderer` (other
// renderers, like the character preview, keep plain lighting). Must run
// before the first frame, so nothing compiles unpatched.
export function installRegionLights(renderer) {
    THREE.Material.prototype.onBeforeCompile = function (shader, compilingRenderer) {
        if (compilingRenderer !== renderer) return;
        if (!shader.fragmentShader.includes('#include <lights_fragment_begin>')
            || !shader.vertexShader.includes('#include <project_vertex>')) return;
        Object.assign(shader.uniforms, regionUniforms);
        shader.vertexShader = VERTEX_HEADER + shader.vertexShader
            .replace('#include <project_vertex>', `#include <project_vertex>\n${VERTEX_WORLD}`);
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', `#include <common>\n${FRAGMENT_HEADER}`)
            .replace('#include <lights_fragment_begin>', FRAGMENT_LIGHTS);
    };
}
