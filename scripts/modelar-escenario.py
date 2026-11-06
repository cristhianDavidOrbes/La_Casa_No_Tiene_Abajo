# Semana 8: modelar, aplicar transformaciones, UV, empaquetar y exportar GLB.
# Ejecutar después de exportar-escenario.mjs con Blender en modo background.
import bpy, bmesh, json, math
from pathlib import Path
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
# Caras de cada caja: el hueco existe porque NO se modela ningún bloque dentro de él.
faces=[(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)]
objects=[]
for number,box in enumerate(DATA['boxes']):
    mesh=bpy.data.meshes.new('estructura_'+str(number))
    mesh.from_pydata([(v['world'][0],-v['world'][2],v['world'][1]) for v in box['corners']],[],faces)
    mesh.update();uv=mesh.uv_layers.new(name='UVMap')
    for face_index,polygon in enumerate(mesh.polygons):
        horizontal=face_index in (2,3);axis_x=face_index in (4,5);scale=2 if horizontal else 5
        for loop_index in polygon.loop_indices:
            local=box['corners'][mesh.loops[loop_index].vertex_index]['local']
            uv.data[loop_index].uv=((local[0] if horizontal or not axis_x else local[2])/scale,(local[2] if horizontal else local[1])/scale)
    obj=bpy.data.objects.new('muro_'+str(number),mesh);bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material(box['room'],box['material']));objects.append(obj)
# Una sola malla, con sus materiales y UV. No se unen los objetos que deben moverse.
bpy.ops.object.select_all(action='DESELECT')
for obj in objects:obj.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
bpy.ops.object.join()
obj=bpy.context.object;obj.name='escenario_completo';obj.data.name='casa_habitaciones_pasillos'
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
bm=bmesh.new();bm.from_mesh(obj.data)
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
obj['habitaciones']=5;obj['conexiones']=4;obj['huecos']='entrada, ventana y accesos de gravedad'
# Pack Resources guarda las imágenes dentro del .blend y el GLB incluye sus texturas.
for image in bpy.data.images:
    if image.source=='FILE':image.pack()
# Al abrir el .blend se ve el conjunto seleccionado y completo en unidades métricas.
bpy.context.scene.unit_settings.system='METRIC'
bpy.context.preferences.filepaths.save_version=0
from mathutils import Vector, Euler
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
