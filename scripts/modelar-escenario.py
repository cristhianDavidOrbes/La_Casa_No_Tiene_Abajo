# Semana 8: modelar, aplicar transformaciones, UV, empaquetar y exportar GLB.
# Ejecutar después de exportar-escenario.mjs con Blender en modo background.
import bpy, bmesh, json, math
from itertools import product
from pathlib import Path
from mathutils import Vector, Euler
ROOT=Path(__file__).resolve().parent.parent
DATA=json.loads((ROOT/'blender/escenario.json').read_text(encoding='utf-8'))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
COLORS=['#c9c0a6','#9da997','#afb0a1','#c4b59a','#a4b2aa']
def color(value):
    rgb=[int(value[i:i+2],16)/255 for i in (1,3,5)]
    return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb)+(1,)
materials={}
def material(room,kind):
    key=(room,kind)
    if key in materials:return materials[key]
    mat=bpy.data.materials.new('room_'+str(room)+'_'+kind)
    mat.use_nodes=True
    nodes=mat.node_tree.nodes; links=mat.node_tree.links; shader=nodes.get('Principled BSDF')
    prefix='wood' if kind=='wood' else 'plaster'
    tint='#9b8870' if kind=='wood' else '#78867c' if kind=='connector' else COLORS[room]
    shader.inputs['Base Color'].default_value=color(tint)
    mat.diffuse_color=color(tint)
    shader.inputs['Roughness'].default_value=.88 if kind=='wood' else 1
    names={'wood':['wood-diff.jpg','wood-nor_gl.jpg','wood-rough.jpg'],'plaster':['plaster-diffuse.jpg','plaster-nor_gl.jpg','plaster-rough.jpg']}[prefix]
    for slot,name in enumerate(names):
        tex=nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(ROOT/'public/textures/materials'/name),check_existing=True)
        if slot:tex.image.colorspace_settings.name='Non-Color'
        if slot==0:
            multiply=nodes.new('ShaderNodeMixRGB');multiply.blend_type='MULTIPLY';multiply.inputs[0].default_value=1;multiply.inputs[2].default_value=color(tint)
            links.new(tex.outputs['Color'],multiply.inputs[1]);links.new(multiply.outputs[0],shader.inputs['Base Color'])
        elif slot==1:
            normal=nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.3 if kind=='wood' else .25
            links.new(tex.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],shader.inputs['Normal'])
        else:links.new(tex.outputs['Color'],shader.inputs['Roughness'])
    materials[key]=mat
    return mat
# Dividir el volumen en celdas rectangulares y modelar solo su superficie.
# Se unen los bloques adyacentes y se descartan las caras internas.
def blender_point(world):
    x, y, z = world
    return (round(x, 5), round(-z, 5), round(y, 5))

bounds = []
for box in DATA['boxes']:
    corners = [blender_point(vertex['world']) for vertex in box['corners']]
    bounds.append([(min(axis), max(axis)) for axis in zip(*corners)])
planes = [sorted({value for bound in bounds for value in bound[axis]}) for axis in range(3)]
indices = [{value: index for index, value in enumerate(axis)} for axis in planes]
occupied = {}
for box, bound in zip(DATA['boxes'], bounds):
    cells = [range(indices[axis][low], indices[axis][high])
             for axis, (low, high) in enumerate(bound)]
    for cell in product(*cells):
        occupied.setdefault(cell, (box['room'], box['material']))

vertices, faces, face_data = [], [], []
vertex_indices = {}
for cell, material_key in occupied.items():
    for axis in range(3):
        u, v = (axis + 1) % 3, (axis + 2) % 3
        for sign in (-1, 1):
            neighbor = list(cell)
            neighbor[axis] += sign
            if tuple(neighbor) in occupied:
                continue
            face = []
            for du, dv in ((0, 0), (1, 0), (1, 1), (0, 1)):
                corner = list(cell)
                corner[axis] += int(sign > 0)
                corner[u] += du
                corner[v] += dv
                key = tuple(corner)
                if key not in vertex_indices:
                    vertex_indices[key] = len(vertices)
                    vertices.append(tuple(planes[i][n] for i, n in enumerate(corner)))
                face.append(vertex_indices[key])
            faces.append(face if sign > 0 else face[::-1])
            face_data.append(material_key)

mesh = bpy.data.meshes.new('casa_habitaciones_pasillos')
mesh.from_pydata(vertices, [], faces)
mesh.update()
slots = {}
for polygon, key in zip(mesh.polygons, face_data):
    room, kind = key
    if key not in slots:
        slots[key] = len(mesh.materials)
        mesh.materials.append(material(room, kind))
    polygon.material_index = slots[key]

# Quitar las aristas coplanares antes de proyectar las UV.
bm = bmesh.new()
bm.from_mesh(mesh)
bm.normal_update()
bmesh.ops.dissolve_limit(bm, angle_limit=0.001, verts=list(bm.verts),
                         edges=list(bm.edges), delimit={'MATERIAL'})
bm.to_mesh(mesh)
bm.free()
mesh.update()

keys = list(slots)
uv = mesh.uv_layers.new(name='UVMap')
for polygon in mesh.polygons:
    room, kind = keys[polygon.material_index]
    axis = max(range(3), key=lambda axis: abs(polygon.normal[axis]))
    layout = DATA['rooms'][room]
    ox, oy, oz = blender_point(layout['pos'])
    c, s = round(math.cos(layout['angle'])), round(math.sin(layout['angle']))
    horizontal = (axis == 2 and c != 0) or (axis == 0 and s != 0)
    side = (axis == 0 and c != 0) or (axis == 2 and s != 0)
    scale = 2 if horizontal else 5
    for loop in polygon.loop_indices:
        x, z, y = mesh.vertices[mesh.loops[loop].vertex_index].co
        local_x = c * (x - ox) + s * (y - oz)
        local_y = -s * (x - ox) + c * (y - oz)
        local_z = oy - z
        uv.data[loop].uv = ((local_z if side else local_x) / scale,
                            (local_z if horizontal else local_y) / scale)

obj = bpy.data.objects.new('escenario_completo', mesh)
bpy.context.collection.objects.link(obj)
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
obj['habitaciones']=5;obj['conexiones']=4;obj['huecos']='entrada, ventana y accesos de gravedad'
# Pack Resources guarda las imágenes dentro del .blend y el GLB incluye sus texturas.
for image in bpy.data.images:
    if image.source=='FILE':image.pack()
# Al abrir el .blend se ve el conjunto seleccionado y completo en unidades métricas.
bpy.context.scene.unit_settings.system='METRIC'
bpy.context.preferences.filepaths.save_version=0
center=sum((Vector(v.co) for v in obj.data.vertices),Vector())/len(obj.data.vertices)
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_location=center
            area.spaces.active.region_3d.view_distance=38
            area.spaces.active.region_3d.view_rotation=Euler((math.radians(65),0,math.radians(35))).to_quaternion()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'blender/escenario.blend'))
# El factor de color se aplica en Three a la textura sin añadir nuevas imágenes.
for (room,kind),mat in materials.items():
    nodes=mat.node_tree.nodes;links=mat.node_tree.links;shader=nodes.get('Principled BSDF')
    tex=next(n for n in nodes if n.type=='TEX_IMAGE' and ('-diff' in n.image.name))
    links.new(tex.outputs['Color'],shader.inputs['Base Color'])
    shader.inputs['Base Color'].default_value=mat.diffuse_color
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/escenario.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_cameras=False,export_lights=False)
print('ESCENARIO:',len(obj.data.vertices),'vértices;',len(obj.data.polygons),'caras; 1 objeto Mesh')
