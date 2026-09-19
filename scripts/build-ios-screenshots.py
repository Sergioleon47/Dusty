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
ORIGEN = 'store-screenshots/ios/raw'
DESTINO = 'store-screenshots/ios'

# Las frases van en inglés porque la UI de estas capturas está en inglés — una
# frase en español sobre una pantalla en inglés se lee descuidado. Para la
# localización en español hay que sacar capturas con la app en español y volver
# a correr esto con las frases traducidas.
CAPTURAS = [
    ('dashboard.png',  'Your month, at a glance',  'Budget, spending and stock in one screen'),
    ('inventory.png',  'Stock that counts itself', 'Every receipt updates what you have'),
    ('reports.png',    'Know if you made money',   'Revenue, costs and margin, worked out for you'),
    ('production.png', 'Recipes that discount stock', 'Log a batch, ingredients come off by themselves'),
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


    # NUNCA se agranda la captura: agrandar inventa píxeles y se nota. Las de
    # capture-ios-screenshots.js ya vienen a 1290x2796, o sea el lienzo entero, así
    # que hay que achicarlas para que entre el texto — achicar sí es seguro, cada
    # píxel del resultado sale de varios del original. Una captura más chica que el
    # ancho disponible se deja como está.
    ALTO_TEXTO = 92 + 54 + 95
    ancho_maximo = ANCHO - 45 * 2
    alto_maximo = ALTO - ALTO_TEXTO - 60
    escala = min(ancho_maximo / captura.width, alto_maximo / captura.height, 1.0)
    if escala < 1.0:
        captura = captura.resize(
            (int(captura.width * escala), int(captura.height * escala)), Image.LANCZOS)
    ancho_captura, alto_captura = captura.size
    margen = (ANCHO - ancho_captura) // 2
    captura = esquinas_redondeadas(captura, 56)

    # Texto y captura se centran como un solo bloque en vez de repartirse el
    # lienzo por separado: al no agrandar la captura sobra bastante alto, y
    # anclando el texto arriba del todo quedaba un pozo entre la bajada y la
    # imagen que se leía como un olvido.
    ALTO_TITULO, ALTO_BAJADA, AIRE = 92, 54, 95
    alto_bloque = ALTO_TITULO + ALTO_BAJADA + AIRE + alto_captura
    y = (ALTO - alto_bloque) // 2

    centrar_texto(draw, titulo, y, fuente(76, negrita=True), TINTA)
    centrar_texto(draw, bajada, y + ALTO_TITULO, fuente(42), TINTA_SUAVE)
    arriba = y + ALTO_TITULO + ALTO_BAJADA + AIRE
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
    salida = os.path.join(DESTINO, '%02d-%s' % (i, archivo))
    medida = armar(archivo, titulo, bajada, salida)
    print('%s  %dx%d' % (salida, medida[0], medida[1]))
