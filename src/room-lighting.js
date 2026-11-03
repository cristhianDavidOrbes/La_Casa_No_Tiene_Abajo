// Ampliación necesaria: oscurecer un cuarto sin apagar el relleno de los cuartos vecinos.
import { ShaderChunk } from 'three';

// Compiled during the existing loading screen. Only a uniform changes in play:
// each room can lose its ambient/IBL fill without darkening its neighbours.
export function bindRoomFill(root, fill) {
  const materials = new Map();
  root.traverse((object) => {
    if (!object.isMesh) return;
    const bind = (source) => {
      if (
        !source.isMeshStandardMaterial &&
        !source.isMeshPhongMaterial &&
        !source.isMeshLambertMaterial
      )
        return source;
      if (materials.has(source)) return materials.get(source);
      const material = source.clone(),
        compile = source.onBeforeCompile,
        cacheKey = source.customProgramCacheKey();
      material.onBeforeCompile = (shader, renderer) => {
        compile.call(material, shader, renderer);
        shader.uniforms.roomIndirectFill = fill;
        shader.fragmentShader = 'uniform float roomIndirectFill;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <lights_fragment_begin>',
          ShaderChunk.lights_fragment_begin
            .replace(
              'getAmbientLightIrradiance( ambientLightColor )',
              'getAmbientLightIrradiance( ambientLightColor ) * roomIndirectFill'
            )
            // Moon/sky belong to the exterior, not the sealed, folded rooms.
            .replace(
              'getDirectionalLightInfo( directionalLight, directLight );',
              'getDirectionalLightInfo( directionalLight, directLight ); directLight.color *= 0.0;'
            )
            .replace(
              'getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal )',
              'getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal ) * 0.0'
            )
            .replace(
              'getPointLightInfo( pointLight, geometryPosition, directLight );',
              'getPointLightInfo( pointLight, geometryPosition, directLight );\n directLight.color *= mix(0.08, 1.0, clamp(roomIndirectFill * 2.0, 0.0, 1.0));'
            )
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <lights_fragment_maps>',
          ShaderChunk.lights_fragment_maps
            .replace(
              'iblIrradiance += getIBLIrradiance( geometryNormal );',
              'iblIrradiance += getIBLIrradiance( geometryNormal ) * roomIndirectFill;'
            )
            .replace('radiance += iblRadiance;', 'radiance += iblRadiance * roomIndirectFill;')
            .replace(
              'clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );',
              'clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness ) * roomIndirectFill;'
            )
        );
      };
      material.customProgramCacheKey = () => cacheKey + '|room-fill-v2';
      materials.set(source, material);
      return material;
    };
    object.material = Array.isArray(object.material)
      ? object.material.map(bind)
      : bind(object.material);
  });
}
