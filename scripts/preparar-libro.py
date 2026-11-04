# Semana 8: convertir el Book CC0 de stendec a GLB una sola vez, fuera del juego.
# Abrir book.blend con --disable-autoexec y ejecutar este script con --python.
from pathlib import Path
import json
import bpy
from mathutils import Matrix, Vector

target = Path(__file__).resolve().parent.parent / 'public/assets/books/book-stendec.glb'
target.parent.mkdir(parents=True, exist_ok=True)
meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
if {obj.name for obj in meshes} != {'Cube', 'Cube.001'}:
    raise ValueError('Se esperaba el libro original: cubierta Cube y páginas Cube.001.')

# Una subdivisión conserva los bordes redondeados sin exportar una malla pesada.
for obj in meshes:
    bpy.context.view_layer.objects.active = obj
    for modifier in list(obj.modifiers):
        if modifier.type == 'SUBSURF':
            modifier.levels = modifier.render_levels = 1
            bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.data.transform(obj.matrix_world)
    obj.matrix_world = Matrix.Identity(4)

# Libro de pie: grosor en X, altura en Y de glTF, lomo hacia +Z de glTF.
turn = Matrix(((0, 0, 1), (1, 0, 0), (0, 1, 0))).to_4x4()
for obj in meshes:
    obj.data.transform(turn)
points = [vertex.co for obj in meshes for vertex in obj.data.vertices]
low = Vector(tuple(min(p[i] for p in points) for i in range(3)))
high = Vector(tuple(max(p[i] for p in points) for i in range(3)))
scale = 0.30 / (high.z - low.z)
center = Vector(((low.x + high.x) / 2, (low.y + high.y) / 2, low.z))
transform = Matrix.Diagonal((scale, scale, scale, 1)) @ Matrix.Translation(-center)
for obj in meshes:
    is_cover = obj.name == 'Cube'
    obj.name = 'cover' if is_cover else 'pages'
    obj.data.transform(transform)
    obj.data.materials.clear()
    material = bpy.data.materials.new('book_cover' if is_cover else 'book_pages')
    material.use_nodes = True
    color = (0.05, 0.012, 0.023, 1) if is_cover else (0.48, 0.41, 0.29, 1)
    shader = material.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = color
    shader.inputs['Roughness'].default_value = 0.9
    material.diffuse_color = color
    obj.data.materials.append(material)

bpy.ops.object.select_all(action='DESELECT')
for obj in meshes:
    obj.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=str(target), export_format='GLB', use_selection=True,
    export_yup=True, export_animations=False, export_cameras=False,
    export_lights=False, export_materials='EXPORT'
)
triangles = 0
for obj in meshes:
    obj.data.calc_loop_triangles()
    triangles += len(obj.data.loop_triangles)
print('LIBRO_EXPORTADO', json.dumps({'triangles': triangles, 'bytes': target.stat().st_size}))
