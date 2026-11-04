# Fotografías de mantenimiento: renderizar los mismos assets CC0 que utiliza el juego.
from pathlib import Path
from mathutils import Vector
import bpy

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / 'public/images/instructions'
OUTPUT.mkdir(parents=True, exist_ok=True)

def material(name, color):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    return mat

def box(name, location, scale, color):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(material(name, color))
    return obj

def asset(relative, height, location):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / 'public/models' / relative))
    objects = set(bpy.data.objects) - before
    root = bpy.data.objects.new('asset', None)
    bpy.context.collection.objects.link(root)
    for obj in objects:
        if obj.parent not in objects:
            obj.parent = root
    bpy.context.view_layer.update()
    points = [obj.matrix_world @ Vector(v) for obj in objects if obj.type == 'MESH' for v in obj.bound_box]
    low = Vector(tuple(min(p[i] for p in points) for i in range(3)))
    high = Vector(tuple(max(p[i] for p in points) for i in range(3)))
    scale = height / (high.z - low.z)
    root.scale = (scale,) * 3
    center = Vector(((low.x + high.x)/2, (low.y + high.y)/2, low.z))
    root.location = Vector(location) - center * scale
    return root

for shot in ['fusible', 'panel', 'televisor', 'radio']:
    # Las dos capturas proporcionadas por el usuario tienen prioridad sobre estos renders.
    if shot in ['fusible', 'panel'] and (OUTPUT / ('instruccion-' + shot + '.png')).exists():
        continue
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 768
    scene.render.resolution_y = 432
    scene.render.resolution_percentage = 100
    scene.world.color = (0.12, 0.12, 0.12)
    box('pared', (0, .55, 1.2), (4, .08, 2.5), (.28, .29, .22))
    box('suelo', (0, 0, -.04), (5, 5, .08), (.12, .07, .035))
    if shot == 'fusible':
        asset('haven/side_table_01/side_table_01.gltf', .75, (0, 0, 0))
        asset('props/ceramic-fuse.glb', .16, (.02, -.04, .79))
        eye, target = (1.0, -1.3, 1.42), (0, 0, .68)
    elif shot == 'panel':
        asset('haven/power_box_01/power_box_01.gltf', .85, (0, .25, .85))
        asset('station/wall-switch.glb', .18, (.5, .12, 1.0))
        eye, target = (1.0, -1.8, 1.7), (0, .1, 1.28)
    elif shot == 'televisor':
        asset('haven/side_table_01/side_table_01.gltf', .75, (0, 0, 0))
        asset('haven/television_02/television_02.gltf', .72, (0, 0, .77))
        eye, target = (1.2, -2.2, 1.5), (0, 0, .95)
    else:
        asset('haven/side_table_01/side_table_01.gltf', .75, (0, 0, 0))
        asset('haven/vintage_radio_transceiver/vintage_radio_transceiver.gltf', .48, (0, 0, .77))
        eye, target = (.8, -1.7, 1.35), (0, 0, .93)
    bpy.ops.object.light_add(type='AREA', location=(1.2, -1.8, 3.0))
    bpy.context.object.data.energy = 160
    bpy.context.object.data.shape = 'DISK'
    bpy.context.object.data.size = 2.3
    bpy.ops.object.camera_add(location=eye)
    camera = bpy.context.object
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera.data.lens = 47
    scene.camera = camera
    scene.render.filepath = str(OUTPUT / ('instruccion-' + shot + '.png'))
    bpy.ops.render.render(write_still=True)
