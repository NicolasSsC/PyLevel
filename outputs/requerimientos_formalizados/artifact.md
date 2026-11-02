# Contrato de fidelidad de las tablas de PyLevel

Referencia retenida: `C:\Users\nicol\Downloads\formatos.docx`
SHA256: `bed2c34f5ab1ca3e283976936c9edc3bea06349cbcefe537af6d947d7a179fb5`
Una sección vertical A4 de 11909 por 16834 twips. Márgenes 1440 twips;
distancia de encabezado y pie 720 twips. No hay encabezados, pies, imágenes,
campos ni controles de contenido. Se conservan todas las partes del paquete
excepto document.xml, según qa/template-inventory.json.

## Tipografía y componentes

Las celdas usan Aptos 10,5 puntos y línea simple de 240 unidades. Encabezados
de celda azules 377CB7, texto blanco FFFFFF, cuerpo negro. Bordes de las
celdas 202020, grosor 8. Los estilos Table1 y Table2 conservan márgenes de
celda, definición, alineación y anchos originales. La tabla HU mide
9025,511811 twips y tiene rejilla 2254,994521 / 2254,994521 / 4515,522770.
La tabla RF mide 9792 twips con dos columnas iguales de 4896 twips.
Las tablas se clonan desde la referencia; no se añaden columnas ni campos.
Las alturas son mínimas y pueden crecer. Se evita dividir una ficha entre páginas.

## Mapa de campos

Tabla HU de seis filas: fila 0 Fuente / valor de la fuente / identificador HU;
fila 1 Historia de Usuario en dos columnas combinadas / historia en la tercera;
fila 2 Necesidad combinada a todo el ancho; fila 3 texto de la necesidad;
fila 4 Requerimientos Derivados combinada; fila 5 relación de RF con código y nombre.
Se conservan los rótulos y se reemplazan solo valores y ejemplos de código.

Tabla RF de seis filas: fila 0 Nombre / identificador y nombre del RF;
fila 1 Resumen / texto del resumen; fila 2 Entradas combinada; fila 3 entradas;
fila 4 Resultados combinada; fila 5 resultados. Se conservan rótulos y combinaciones.

Los párrafos de ejemplo externos a las tablas se sustituyen por el título y
por los encabezados del complemento. Se reutilizan Title y Heading2 existentes.
Se permiten copias de ambos patrones, saltos de página entre fichas y ajustes
de keepNext/cantSplit para conservar cada ficha completa. Cada párrafo clonado
recibe un paraId único. No se cambian los anchos ni las alturas mínimas de las celdas.

## Contenido y trazabilidad

Primero alcance y decisiones. Después historias nuevas y ampliadas, seguidas
por las fichas de requisitos derivados. Se mantienen HU 01 06 08 09 11 14
para cambios; HU 16 a HU 28 para incorporaciones. Fuente Propuesta de la docente
en HU 24 a HU 27; Observación en las demás. RF12 retirado y RF10 pendiente.

## Verificación

Comparar todos los rótulos, filas, combinaciones, colores, bordes, rejillas,
fuentes, alturas mínimas y propiedades de sección con la referencia. Verificar
que todos los RF citados en historias tengan ficha y que no existan duplicados.
Las partes preserve-only deben permanecer idénticas byte a byte.

El renderizador empaquetado se intentó y falló porque no hay LibreOffice
disponible. Tampoco hay Microsoft Word instalado. No existe render nativo
verificado ni recuento de páginas nativo de la referencia. La revisión de
maquetación alternativa genera una previsualización interna a partir de las
tablas OOXML con Arial como sustitución local de Aptos, sin alterar las fuentes
del DOCX. No debe presentarse esta revisión como verificación nativa de Word.

Normalización técnica: las anchuras fraccionarias de la referencia se redondean al twip más cercano en document.xml (desviación inferior a 0,5 twips). Se mantienen rejillas, proporciones y medidas visuales; las otras ocho partes permanecen idénticas.
Revisión alternativa de 41 páginas completada; no se verificó paginación nativa.
