from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
for name,file in [('Book','arial.ttf'),('Bold','arialbd.ttf'),('Serif','georgia.ttf')]:
    pdfmetrics.registerFont(TTFont(name,str(Path('C:/Windows/Fonts')/file)))
OUT=ROOT/'PROYECTO_LA_CASA_NO_TIENE_ABAJO.pdf'
W,H=595.28,841.89
c=canvas.Canvas(str(OUT),pagesize=(W,H))
c.setTitle('La casa no tiene abajo - Proyecto revisado')
c.setAuthor('Proyecto de entorno multimedia')
green=HexColor('#263e35');ink=HexColor('#23342d');muted=HexColor('#5a695f')
body=ParagraphStyle('body',fontName='Book',fontSize=10.2,leading=15,textColor=ink)
small=ParagraphStyle('small',parent=body,fontSize=8.7,leading=12)
head=ParagraphStyle('heading',fontName='Serif',fontSize=26,leading=31,textColor=green)
def page(n,label):
    c.setFillColor(HexColor('#f3f1e9'));c.rect(0,0,W,H,fill=1,stroke=0)
    c.setFillColor(green);c.rect(42,H-57,30,3,fill=1,stroke=0);c.setFont('Bold',8);c.drawString(83,H-58,label.upper())
    c.setStrokeColor(HexColor('#cad0c3'));c.line(42,45,W-42,45)
    c.setFont('Book',8);c.setFillColor(muted);c.drawString(42,30,'LA CASA NO TIENE ABAJO / ENTREGA LOCAL');c.drawRightString(W-42,30,f'{n:02d} / 04')
def para(text,y,style=body,x=42,width=W-84,gap=12):
    p=Paragraph(text,style);_,h=p.wrap(width,H)
    if y-h<60: raise RuntimeError(f'Contenido fuera del margen: {text[:65]}')
    p.drawOn(c,x,y-h);return y-h-gap
def table(rows,y,widths):
    cells=[[Paragraph(str(v),small) for v in row] for row in rows]
    t=Table(cells,colWidths=widths)
    t.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('BACKGROUND',(0,0),(-1,0),HexColor('#dce2d6')),('LINEBELOW',(0,0),(-1,-1),.35,HexColor('#c3cdc0')),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8)]))
    _,h=t.wrap(W-84,H)
    if y-h<65:raise RuntimeError('Tabla fuera del margen')
    t.drawOn(c,42,y-h);return y-h-17
def picture(file,y,width=W-84,maxheight=290):
    path=ROOT/'docs/capturas'/file
    iw,ih=Image.open(path).size
    h=min(maxheight,width*ih/iw);w=h*iw/ih
    c.drawImage(str(path),42+(width-w)/2,y-h,width=w,height=h)
    return y-h-15

page(1,'Archivo doméstico / 28-09-2026')
y=para('La casa<br/>no tiene abajo.',745,head)
y=para('TERROR ANALÓGICO PROGRESIVO / PRIMERA PERSONA',y,small)
y=para('Tu tío Julián lleva once días desaparecido. Mañana vacían su casa. Tu madre te entrega sus llaves y un sobre: debes recuperar la única copia de una tarde familiar. Dentro, las habitaciones obedecen a una señal de televisión.',y)
y=picture('sala-revisada.png',y,maxheight=280)
y=para('La sala revisada: mobiliario descargado, bombilla central, suelo continuo y televisor apagado al entrar.',y,small)
y=para('Una misma casa. Cinco orientaciones.',y,head)
y=para('Sala, pasillo, taller, archivo familiar y cuarto de emisión. Cuatro pasos a ras del suelo giran la gravedad 90 grados y permiten regresar. La luz revela la orientación del polvo; los pensamientos del protagonista indican la siguiente acción sin letreros artificiales en las paredes.',y)
y=para('Incluye código, versión compilada, recursos locales, cinco emisiones con audio, documentación y referencias de clase. No se ha publicado el proyecto.',y,small)
c.showPage()

page(2,'01 / Historia, interacción y recorrido')
y=para('Volver es parte del juego.',744,head)
y=para('Julián grabó una habitación que no existía. Al reproducirla hizo sitio para una figura en su casa. La mantuvo quieta en un bucle y separó la señal en tres circuitos. La cinta PARA VOLVER conserva el último fotograma vacío, capaz de devolverla al receptor original.',y)
y=table([['Lugar','Acción y consecuencia'],['Sala','Abrir el sobre y leer la carta corta. Terminar el canal 02; recoger el fusible de la mesa de entrada e instalarlo en el cuadro eléctrico.'],['Pasillo','Sintonizar la radio a 83.0 MHz. Se abre el taller. Aparecen sonidos y contradicciones espaciales, todavía sin persecución.'],['Taller','Activar PARED, TECHO, SUELO. El archivo queda abierto en ambos sentidos.'],['Archivo familiar','Recoger PARA VOLVER del mueble central y continuar al cuarto de emisión.'],['Emisión y regreso','Rebobinar durante siete segundos. La presencia despierta. Volver por los cuatro umbrales, manteniendo la linterna sobre ella.'],['Sala / cierre','Insertar la cinta, sentarse y terminar el canal 03. Salir por la puerta original con la grabación familiar. Julián sigue desaparecido.']],y,[115,W-199])
y=para('Controles',y,head)
y=para('<b>WASD / flechas:</b> caminar. <b>Ratón:</b> mirar. <b>E:</b> interactuar, sentarse o levantarse. <b>Shift:</b> correr. <b>Espacio:</b> saltar. <b>F:</b> linterna. <b>H:</b> recordar objetivo. <b>J:</b> notas. <b>1-5:</b> canales estando sentado. <b>Esc:</b> pausa.',y)
y=para('La linterna no consume batería. Las notas y acertijos pausan la amenaza. Brillo, volumen, sensibilidad y reducción de balanceo/VHS se ajustan desde la pausa. Si no se permite capturar el cursor, se mira manteniendo pulsado el botón izquierdo.',y,small)
c.showPage()

page(3,'02 / Procedencia de los recursos')
y=para('Modelos de Internet.<br/>Procedencia documentada.',744,head)
y=table([['Colección / licencia','Uso activo'],['Poly Haven / CC0','Television 02, ArmChair 01, mesas, estantería, radio, cuadro eléctrico, lámpara, silla y cámara antigua.'],['Modular House / Keith / CC0','Paredes, suelo, puerta, molduras, ventana y cortinas. Los módulos se escalan y colocan para componer los cuartos.'],['Kenney / CC0','Furniture Kit, Space Station Kit e Impact Sounds: complementos, tuberías, interruptores, pasos y golpes.'],['GGBotNet / Paul Wortmann / CC0','Casete VHS y Paper Debris: cartas físicas de papel envejecido.'],['3DAssets.dev / CC0','Ceramic Fuse. Su publicador declara generación con IA; se descargó ya existente. No fue generado por este proyecto.'],['Texturas Poly Haven / CC0','Wood Floor; Painted Plaster Wall, de Amal Kumar; Dirty Carpet, de Rohit Seervi. Mapas 1K de color, normales y rugosidad.']],y,[163,W-247])
y=para('La criatura de la referencia se recuperó del modelo original Stable Fast 3D y se riggeó en Blender: 17 huesos, 7.840 triángulos y apoyos IK. No se declara CC0. Meshy no recibió autorización ni generó tareas. Procedencia en CREATURA.md y docs/licencias.',y,small)
y=para('Historia, interfaz, distribución y emisiones narradas son contenido del proyecto. La voz se sintetizó localmente con una voz instalada de Windows. Estos vídeos no se presentan como clips CC0 descargados. Los PDF de clase tampoco se atribuyen a CC0.',y,small)
y=para('Fuentes y licencias',y,head)
for label,url in [('Poly Haven','https://polyhaven.com/license'),('Modular House','https://opengameart.org/content/modular-house-3d-models'),('Kenney Furniture Kit','https://kenney.nl/assets/furniture-kit'),('VHS / GGBotNet','https://opengameart.org/content/vhs-cassette-3d')]:
    y=para(f'{label}: <link href="{url}" color="#325647">{url}</link>',y,small,gap=6)
y=para('Autores, enlaces individuales, excepciones y archivos de origen: docs/ASSETS_Y_LICENCIAS.md. Paquetes originales y metadatos en sources; licencias en docs/licencias.',y,small)
c.showPage()

page(4,'03 / Técnica, pruebas y entrega')
y=para('Encajes corregidos.<br/>Recorrido comprobado.',744,head)
y=table([['Sistema','Implementación y revisión'],['Televisor','El vídeo usa 392 triángulos originales de cristal curvo. No hay pantalla plana flotante. Colisión del cuerpo activada.'],['Arquitectura','Cinco cuartos separados y conductos cerrados. Bordes debajo del pavimento, sin caras superpuestas. Caja eléctrica anclada fuera de la pared. Ventana con abertura real.'],['Movimiento','Cápsula, velocidad, gravedad por zona y colisiones 3D. WASD/ratón activos al cruzar. Sin Bézier ni teletransporte. El regreso restituye la gravedad anterior y aplica un impulso de salto.'],['Clase multimedia','Materiales PBR, mapas de normales/rugosidad, luces cálidas y frías, sombras PCF y 1.600 partículas en cinco BufferGeometry. CanvasTexture y audio espacial.'],['Estado y guardado','Canal 02 se valida por tiempo real de vídeo y ended, no por temporizador de espera. Guardado por cuarto en el navegador; QA no lo sobrescribe.']],y,[105,W-189])
y=para('<b>Verificación:</b> 50 pruebas automáticas superadas; compilación correcta. Canal 02 completado realmente a 29,1 s e instalación de fusible comprobada. Rig, IK y perseguidor persistente comprobados. Prueba acelerada con doce cruces físicos, acertijos y regreso hasta el final. Luz, avance y pausa de la amenaza comprobados.',y)
y=para('La prueba acelerada adelanta la reproducción final y el rebobinado; no se presenta como una partida manual completa. La revisión visual cubre los cinco cuartos, TV, piso, ventana y carta. No se garantiza ausencia universal de errores ni compatibilidad con todo hardware.',y,small)
y=para('Abrir en este equipo',y,head)
y=para('Doble clic en <b>INICIAR_JUEGO.cmd</b>. Dirección: <b>http://127.0.0.1:5180/</b>. Node.js está instalado. Los recursos están en el disco: no se necesita Internet para jugar. La ruta normal no muestra el panel QA.',y)
y=para('Límites: teclado y ratón; colliders aproximados; rig ligero sin dedos individuales ni ragdoll. El equipo de rebobinado usa una cámara antigua CC0 como representación del aparato ficticio, no una videocasetera exacta. Fuentes de clase en docs/referencias; nada se ha publicado.',y,small)
c.showPage();c.save();print(OUT)
