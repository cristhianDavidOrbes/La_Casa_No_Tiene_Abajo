import * as THREE from 'three';

// Asfalto PBR CC0: una calzada continua y marcas instanciadas, sin cruces repetidos.
export function createRoad(maps) {
  const road = new THREE.Group();
  road.name = 'carretera-asfalto-cc0';
  const material = new THREE.MeshStandardMaterial({
    map: maps.map,
    normalMap: maps.normalMap,
    roughnessMap: maps.arm,
    aoMap: maps.arm,
    metalnessMap: maps.arm,
    metalness: 0,
    roughness: 0.95,
    normalScale: new THREE.Vector2(0.5, 0.5)
  });
  const surface = new THREE.Mesh(new THREE.BoxGeometry(132, 0.08, 6), material);
  surface.position.set(0, -0.036, 17);
  surface.receiveShadow = true;
  road.add(surface);
  const shoulder = new THREE.MeshStandardMaterial({ color: '#37392e', roughness: 1 });
  for (const z of [13.75, 20.25]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(132, 0.04, 0.5), shoulder);
    strip.position.set(0, -0.04, z);
    road.add(strip);
  }
  const marks = [
    [0, 14.22, 132, 0.075],
    [0, 19.78, 132, 0.075]
  ];
  for (let x = -63; x <= 63; x += 6) marks.push([x, 17, 2.4, 0.09]);
  const paint = new THREE.MeshStandardMaterial({ color: '#aca58a', roughness: 1 });
  const lines = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), paint, marks.length);
  const placement = new THREE.Object3D();
  marks.forEach(([x, z, length, width], i) => {
    placement.position.set(x, 0.009, z);
    placement.scale.set(length, 0.006, width);
    placement.updateMatrix();
    lines.setMatrixAt(i, placement.matrix);
  });
  lines.instanceMatrix.needsUpdate = true;
  road.add(lines);
  return road;
}
