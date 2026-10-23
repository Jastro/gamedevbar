import * as THREE from 'three';

// Per-space ambient and directional light. The scene has one ambient and one
// directional light, and they follow the space you are in (RoomLighting), so
// through an open door the other side would show your light, not its own.
// Every lit material is patched at compile time: each pixel finds which
// space it is in (the bars and their bathrooms are rotated boxes, anything
// else is outside) and uses that space's ambient and directional light
// instead. RoomLighting fills the uniforms every frame.
// The street lamps are lit here too (Weather fills them): only outside
// pixels get their light (no bleeding into the bars), and since they're
// not three.js lights, all of them light at once without the per-light cost
// on every material.
export const REGION_MAX = 12;
export const LAMP_MAX = 32;

export const regionUniforms = {
    regionCount: { value: 0 },
    // Per region: center x, center z, cos(yaw), sin(yaw) / half width, half depth.
    regionBoxes: { value: Array.from({ length: REGION_MAX }, () => new THREE.Vector4()) },
    regionHalf: { value: Array.from({ length: REGION_MAX }, () => new THREE.Vector2()) },
    regionAmbient: { value: Array.from({ length: REGION_MAX }, () => new THREE.Color()) },
    regionDirectional: { value: Array.from({ length: REGION_MAX }, () => new THREE.Color()) },
    outdoorAmbient: { value: new THREE.Color() },
    outdoorDirectional: { value: new THREE.Color() },
    lampCount: { value: 0 },
    lampPositions: { value: Array.from({ length: LAMP_MAX }, () => new THREE.Vector3()) },
    lampColor: { value: new THREE.Color(0, 0, 0) }, // color × intensity, black by day
    lampRange: { value: 26 }
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
#define LAMP_MAX ${LAMP_MAX}
uniform int regionCount;
uniform vec4 regionBoxes[ REGION_MAX ];
uniform vec2 regionHalf[ REGION_MAX ];
uniform vec3 regionAmbient[ REGION_MAX ];
uniform vec3 regionDirectional[ REGION_MAX ];
uniform vec3 outdoorAmbient;
uniform vec3 outdoorDirectional;
uniform int lampCount;
uniform vec3 lampPositions[ LAMP_MAX ];
uniform vec3 lampColor;
uniform float lampRange;
varying vec3 vRegionWorld;

// The first region containing p (bathrooms come before their bar), else
// outside; returns whether p is outside.
bool regionLightAt( vec3 p, out vec3 ambient, out vec3 directional ) {
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
			return false;
		}
	}
	return true;
}
`;

// A wall's two faces sit on either side of the boundary: a point a little in
// front of the surface tells which space a face looks into.
const FRAGMENT_LIGHTS = `
vec3 regionAmbientLight;
vec3 regionDirectionalLight;
bool regionOutdoor = regionLightAt( vRegionWorld + inverseTransformDirection( normal, viewMatrix ) * 0.05, regionAmbientLight, regionDirectionalLight );
` + THREE.ShaderChunk.lights_fragment_begin
    .replace('getAmbientLightIrradiance( ambientLightColor )', 'getAmbientLightIrradiance( regionAmbientLight )')
    .replace('getDirectionalLightInfo( directionalLight, directLight );',
        'getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color = regionDirectionalLight;') + `
// Street lamps: point lights (decay 1, like three's), outside only.
#if defined( RE_Direct )
if ( regionOutdoor && max( lampColor.r, max( lampColor.g, lampColor.b ) ) > 0.0 ) {
	for ( int i = 0; i < LAMP_MAX; i ++ ) {
		if ( i >= lampCount ) break;
		vec3 toLamp = ( viewMatrix * vec4( lampPositions[ i ], 1.0 ) ).xyz - geometryPosition;
		float lampDistance = length( toLamp );
		if ( lampDistance >= lampRange ) continue;
		IncidentLight lampLight;
		lampLight.direction = toLamp / lampDistance;
		lampLight.color = lampColor * getDistanceAttenuation( lampDistance, lampRange, 1.0 );
		lampLight.visible = true;
		RE_Direct( lampLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
}
#endif
`;

function addRegionCode(shader) {
    Object.assign(shader.uniforms, regionUniforms);
    shader.vertexShader = VERTEX_HEADER + shader.vertexShader
        .replace('#include <project_vertex>', `#include <project_vertex>\n${VERTEX_WORLD}`);
    shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${FRAGMENT_HEADER}`);
}

// Installs the patch for every lit material drawn by `renderer` (other
// renderers, like the character preview, keep plain lighting). Must run
// before the first frame, so nothing compiles unpatched.
export function installRegionLights(renderer) {
    THREE.Material.prototype.onBeforeCompile = function (shader, compilingRenderer) {
        if (compilingRenderer !== renderer) return;
        if (!shader.fragmentShader.includes('#include <lights_fragment_begin>')
            || !shader.vertexShader.includes('#include <project_vertex>')) return;
        addRegionCode(shader);
        shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_begin>', FRAGMENT_LIGHTS);
    };
}

// For an unlit material that only belongs outside (the lamps' ground glow):
// it isn't drawn where it reaches into a bar.
export function clipToOutdoors(material) {
    material.onBeforeCompile = (shader) => {
        addRegionCode(shader);
        shader.fragmentShader = shader.fragmentShader.replace('void main() {', `void main() {
	vec3 regionUnusedAmbient;
	vec3 regionUnusedDirectional;
	if ( !regionLightAt( vRegionWorld, regionUnusedAmbient, regionUnusedDirectional ) ) discard;`);
    };
    material.customProgramCacheKey = () => 'region-outdoors';
}
