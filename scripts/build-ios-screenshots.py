#!/usr/bin/env python3
"""Arma las capturas de App Store a partir de las de Play Store.

Apple pide 1290x2796 o 1320x2868 para iPhone de pantalla grande. Las capturas
de Play son 1080x1920, o sea otra proporción: escalarlas a esa medida las
deformaría, y escalarlas al ancho deja casi 500px de hueco vertical.

En vez de pelear con eso, se usa el formato que la mayoría de las fichas de la
App Store usa igual: la captura montada sobre un fondo, con una frase arriba que
dice qué está mirando uno. Queda intencional en lugar de estirado, y de paso las
capturas explican la app en vez de solo mostrarla.

El fondo es #F0F2F5, el mismo color que ya usa el splash nativo
(capacitor.config.json), así que no se inventa una paleta nueva.

Uso: python3 scripts/build-ios-screenshots.py
Salida: store-screenshots/ios/
"""
from PIL import Image, ImageDraw, ImageFont
import os

ANCHO, ALTO = 1290, 2796
FONDO = (240, 242, 245)          # el mismo del splash nativo
TINTA = (28, 34, 46)
TINTA_SUAVE = (110, 120, 136)
ORIGEN = 'store-screenshots/play'
DESTINO = 'store-screenshots/ios'

# Las frases van en inglés porque la UI de estas capturas está en inglés — una
# frase en español sobre una pantalla en inglés se lee descuidado. Para la
# localización en español hay que sacar capturas con la app en español y volver
# a correr esto con las frases traducidas.
CAPTURAS = [
    ('02-dashboard.png',            'Your month, at a glance',   'Budget, spending and stock in one screen'),
    ('03-inventory.png',            'Stock that counts itself',  'Every receipt updates what you have'),
    ('04-month-recap-reports.png',  'Know before it hurts',      'Price jumps and overspending, flagged early'),
    ('05-production.png',           'From ingredients to plates','Recipes discount stock as you produce'),
    ('01-welcome.png',              'Set up in a minute',        'No spreadsheets, no manual typing'),
]

def fuente(tam, negrita=False):
    ruta = '/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf' % ('-Bold' if negrita else '')
    return ImageFont.truetype(ruta, tam)

def centrar_texto(draw, texto, y, font, color):
    ancho = draw.textbbox((0, 0), texto, font=font)[2]
    draw.text(((ANCHO - ancho) // 2, y), texto, font=font, fill=color)

def esquinas_redondeadas(img, radio):
    mascara = Image.new('L', img.size, 0)
    ImageDraw.Draw(mascara).rounded_rectangle([(0, 0), img.size], radio, fill=255)
    salida = img.convert('RGBA')
    salida.putalpha(mascara)
    return salida

def armar(nombre_origen, titulo, bajada, salida):
    captura = Image.open(os.path.join(ORIGEN, nombre_origen)).convert('RGB')

    lienzo = Image.new('RGB', (ANCHO, ALTO), FONDO)
    draw = ImageDraw.Draw(lienzo)

    centrar_texto(draw, titulo, 150, fuente(76, negrita=True), TINTA)
    centrar_texto(draw, bajada, 265, fuente(42), TINTA_SUAVE)

    # La captura se lleva todo el ancho que permita el margen y se centra en lo
    # que queda debajo del texto. Un margen chico importa: con 90px a cada lado
    # sobraban casi 400px de fondo vacío abajo, que se lee como un error de
    # maquetado y no como aire a propósito.
    margen = 45
    ancho_captura = ANCHO - margen * 2
    escala = ancho_captura / captura.width
    alto_captura = int(captura.height * escala)
    captura = captura.resize((ancho_captura, alto_captura), Image.LANCZOS)
    captura = esquinas_redondeadas(captura, 56)

    tope_texto = 390
    arriba = tope_texto + (ALTO - tope_texto - alto_captura) // 2
    # Sombra: un rectángulo oscuro apenas corrido, sin desenfoque para no sumar
    # dependencias. A este tamaño alcanza para despegar la captura del fondo.
    sombra = Image.new('RGBA', (ancho_captura, alto_captura), (0, 0, 0, 0))
    ImageDraw.Draw(sombra).rounded_rectangle(
        [(0, 0), (ancho_captura, alto_captura)], 56, fill=(28, 34, 46, 38))
    lienzo.paste(sombra, (margen, arriba + 10), sombra)
    lienzo.paste(captura, (margen, arriba), captura)

    lienzo.save(salida, 'PNG')
    return lienzo.size

os.makedirs(DESTINO, exist_ok=True)
for i, (archivo, titulo, bajada) in enumerate(CAPTURAS, start=1):
    origen = os.path.join(ORIGEN, archivo)
    if not os.path.exists(origen):
        print('falta %s — se saltea' % origen)
        continue
    salida = os.path.join(DESTINO, '%02d-%s' % (i, archivo.split('-', 1)[-1]))
    medida = armar(archivo, titulo, bajada, salida)
    print('%s  %dx%d' % (salida, medida[0], medida[1]))
