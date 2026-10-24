import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils';

// Draws the static meshes under `group` as one mesh per material (and
// vertex layout): every mesh is a draw call (one per material group for a
// multi-material box, like the walls with their inside and outside finish),
// twice with the outline pass, and a bar's walls, roof and railings are
// dozens of them. The originals stay in place, hidden, so colliders, camera
// occluders and raycasts keep using them.
// Skipped: anything clickable (`userData.type` on it or above it), with a
// hover highlight, hidden now, skinned/instanced, or that `include` rejects.
// Only for things that never move, change visibility or swap materials
// afterwards.
export function mergeStatic(group, include = () => true) {
    group.updateMatrixWorld(true);
    const toGroup = group.matrixWorld.clone().invert();
    const matrix = new THREE.Matrix4();
    const buckets = new Map(); // material uuid + attributes -> { material, geometries }
    const add = (material, geometry) => {
        const key = `${material.uuid}|${Object.keys(geometry.attributes).sort().join(',')}`;
        if (!buckets.has(key)) buckets.set(key, { material, geometries: [] });
        buckets.get(key).geometries.push(geometry);
    };
    const candidates = [];
    group.traverse(object => {
        if (!object.isMesh || object.isSkinnedMesh || object.isInstancedMesh) return;
        if (!include(object) || object.userData.highlightMaterial || !visibleUnder(object, group) || clickable(object, group)) return;
        candidates.push(object);
    });
    candidates.forEach(mesh => {
        // Non-indexed, in the group's frame: every piece merges with any other.
        const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
        source.applyMatrix4(matrix.multiplyMatrices(toGroup, mesh.matrixWorld));
        if (!Array.isArray(mesh.material)) {
            add(mesh.material, source);
            return;
        }
        mesh.geometry.groups.forEach(({ start, count, materialIndex }) => {
            const material = mesh.material[materialIndex];
            if (material) add(material, slice(source, start, count));
        });
    });

    // Every bucket becomes a mesh (one piece or many), so every candidate is
    // fully drawn by them and can be hidden.
    buckets.forEach(({ material, geometries }) => {
        const merged = geometries.length > 1 ? mergeGeometries(geometries) : geometries[0];
        (merged ? [merged] : geometries).forEach(geometry => {
            const mesh = new THREE.Mesh(geometry, material);
            mesh.name = 'Merged';
            mesh.raycast = () => {}; // the originals answer raycasts
            group.add(mesh);
        });
    });
    candidates.forEach(original => { original.visible = false; });
    return candidates.length - buckets.size;
}

// Vertices [start, start + count) of a non-indexed geometry.
function slice(geometry, start, count) {
    const piece = new THREE.BufferGeometry();
    Object.entries(geometry.attributes).forEach(([name, attribute]) => {
        const size = attribute.itemSize;
        piece.setAttribute(name, new THREE.BufferAttribute(attribute.array.slice(start * size, (start + count) * size), size, attribute.normalized));
    });
    return piece;
}

function visibleUnder(object, group) {
    for (let node = object; node && node !== group; node = node.parent) {
        if (!node.visible) return false;
    }
    return true;
}

function clickable(object, group) {
    for (let node = object; node && node !== group; node = node.parent) {
        if (node.userData?.type) return true;
    }
    return false;
}
