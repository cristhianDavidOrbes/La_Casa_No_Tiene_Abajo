// Semanas 7 y 8: convertir los módulos antiguos de la casa a GLB una sola vez.
// Se ejecuta al desarrollar; el navegador solo utiliza los GLB resultantes.
import fs from 'node:fs/promises';
import { MeshStandardMaterial, Box3, Vector3 } from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

const root = new URL('../public/assets/house/', import.meta.url);
const names = [
  'Structure_Floor',
  'Structure_Wall_Straight_Main',
  'Structure_Wall_Straight_Base',
  'Structure_Wall_Straight_Top',
  'Structure_Wall_Door',
  'Structure_Wall_Doorway',
  'Structure_Exterior_Window_Double',
  'Prop_Curtains_Double'
];

// El exportador usa FileReader en el navegador; Node obtiene los mismos bytes del Blob.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((data) => {
      this.result = data;
      this.onloadend?.();
    });
  }
};

for (const name of names) {
  const mtl = await fs.readFile(new URL(name + '.mtl', root), 'utf8');
  if (/^\s*map_/m.test(mtl)) throw new Error('Hay una textura que debe empaquetarse: ' + name);
  const materials = new MTLLoader().parse(mtl);
  const source = await fs.readFile(new URL(name + '.obj', root), 'utf8');
  const model = new OBJLoader().setMaterials(materials).parse(source);
  let triangles = 0;
  model.traverse((mesh) => {
    if (!mesh.isMesh) return;
    triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
    const convert = (material) =>
      new MeshStandardMaterial({
        name: material.name,
        color: material.color,
        opacity: material.opacity,
        transparent: material.transparent,
        side: material.side,
        roughness: 0.9
      });
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(convert)
      : convert(mesh.material);
  });
  const bounds = new Box3().setFromObject(model).getSize(new Vector3()).toArray();
  const glb = await new GLTFExporter().parseAsync(model, { binary: true });
  await fs.writeFile(new URL(name + '.glb', root), Buffer.from(glb));
  console.log(name, JSON.stringify({ triangles, bounds, bytes: glb.byteLength }));
}
