// src/modules/ia/ia.controller.ts
import { Request, Response } from 'express'
import { IAService } from './ia.service'
import { successResponse } from '../../utils/response'

export async function generarTextoHandler(req: Request, res: Response) {
  try {
    const { diagrama, promptext } = req.body
    const prompt = `Eres un transformador de diagramas UML en JSON.

TAREA
Recibirás:
1) JSON_ACTUAL: un JSON con el formato de mi diagramador (classes, links).
2) INSTRUCCIONES: texto en español con cambios solicitados (agregar atributos, renombrar clases, mover posiciones, etc.).

Debes aplicar las INSTRUCCIONES a JSON_ACTUAL y devolver EXCLUSIVAMENTE el JSON actualizado (sin texto extra, sin Markdown).

REGLAS DEL MODELO DE DATOS
- Tipos permitidos para atributos/métodos: {int,bigint,float,double,decimal,string,text,bool,date,time,datetime,uuid,json}.
- Visibilidad (vis): {+, -, #, ~}. Si no se especifica en la instrucción → usa por defecto "+".
- Multiplicidades permitidas en labels: {'0..1','1','0..*','1..*','*'}; si no se especifica → "".
- IDs (id) nunca cambian. Los links usan IDs; renombrar una clase NO cambia links.
- Coordenadas y tamaño: x,y,w,h son enteros en px. Si se indica mover, cambia x,y; si se indica tamaño, cambia w,h.

OPERACIONES QUE DEBES ENTENDER EN INSTRUCCIONES (interpreta flexiblemente):
- "Renombra clase <NombreActual> a <NombreNuevo>"
  → Actualiza classes[...].name. (Si se da id, úsalo; si hay duplicados por nombre y no hay id, ignora por ambigüedad.)
- "Mueve <Clase> a x=<int>, y=<int>"
  → Actualiza x,y de esa clase.
- "Redimensiona <Clase> a w=<int>, h=<int>"
  → Actualiza w,h.
- "Agrega a <Clase>: +campo1:tipo1, -campo2:tipo2, #campo3:tipo3, …"
  → Para cada atributo: si existe por name, actualiza {vis,type}; si no, lo añade al final de attributes.
  → Si falta 'vis' en el token, usa '+' por defecto.
  → Si el tipo no está en el set permitido, usa "string".
- "Elimina atributo(s) de <Clase>: campo1, campo2"
  → Elimina por name exacto en attributes.
- "Agrega método(s) a <Clase>: +metodo1():ret, ~metodo2(p1:tipo, p2:tipo):ret"
  → Igual a atributos: vis por defecto '+', tipos fuera de set → "string". Si no hay return, usa "".
- "Multiplicidad entre <ClaseA> y <ClaseB>: src=<m>, tgt=<m>"
  → Busca el/los link(s) que conectan por IDs de esas clases (por nombre exacto). Actualiza labels.src/labels.tgt con valores del set permitido; si no coinciden, deja "".
- "Cambia tipo de link entre <ClaseA> y <ClaseB> a <Associate|Aggregate|Compose|Generalize|Dependency|AssociateClass>"
  → Actualiza 'kind' del/los link(s) pertinentes.
- "Fija anclajes del link <idLink>: anchorSrc.side=<T|B|L|R>, anchorSrc.t=<0..1>, anchorTgt.side=..., anchorTgt.t=..."
  → Actualiza anchorSrc/anchorTgt.

VALIDACIÓN Y COMPORTAMIENTO
- No modifiques nada que no se pida. Mantén todo lo demás igual.
- Si una clase o link no se encuentra de forma inequívoca, ignora SOLO esa instrucción y continúa con las demás (sin mensajes de error).
- Siempre respeta el conjunto de tipos, visibilidades y multiplicidades definidos arriba.
- Orden: conserva el orden original; los nuevos atributos/métodos se agregan al final.
- Salida: SOLO el JSON final válido.

ENTRADA
JSON_ACTUAL:
${JSON.stringify(diagrama, null, 2)}

INSTRUCCIONES:
${promptext}`;



    const raw = await IAService.generarTexto(prompt)
    console.log(raw)
    const diagram =
      typeof raw === 'string'
        ? parseMaybeJson(raw)   // convierte "```json ...```" o texto → objeto
        : raw;


    return successResponse(res, diagram, 'Diagrama Actualizado');
  } catch (err: any) {
    res.status(500).json({ message: 'Error al generar texto', error: err.message })
  }
}
function parseMaybeJson(s: string) {
  // si viene con ```json ... ```
  const fence = /```json\s*([\s\S]*?)```/i.exec(s);
  if (fence?.[1]) return JSON.parse(fence[1]);
  // recorta desde la 1.ª '{' hasta la última '}'
  const i = s.indexOf('{'), j = s.lastIndexOf('}');
  if (i >= 0 && j > i) return JSON.parse(s.slice(i, j + 1));
  // o JSON.parse directo si ya es JSON puro en string
  return JSON.parse(s);
}
function coerceToJsonObject(candidate: unknown): any {
  // ya es objeto
  if (candidate && typeof candidate === 'object') return candidate

  // intenta parsear string
  if (typeof candidate === 'string') {
    // 1) ```json ... ```
    const fenced = /```json\s*([\s\S]*?)```/i.exec(candidate)
    if (fenced?.[1]) {
      return JSON.parse(fenced[1])
    }
    // 2) ``` ... ```
    const fencedAny = /```+\s*([\s\S]*?)```+/i.exec(candidate)
    if (fencedAny?.[1]) {
      return JSON.parse(fencedAny[1])
    }
    // 3) best effort: primer '{' a último '}'
    const i = candidate.indexOf('{')
    const j = candidate.lastIndexOf('}')
    if (i >= 0 && j > i) {
      return JSON.parse(candidate.slice(i, j + 1))
    }
    // 4) último intento: parse directo
    return JSON.parse(candidate)
  }

  throw new Error('La respuesta del modelo no es JSON parseable')
}

export async function generarDesdeImagenHandler(req: Request, res: Response) {
  try {
    const imagePath = (req as any).file?.path        // si usas diskStorage
    const mimeType = (req as any).file?.mimetype

    if (!imagePath) {
      return res.status(400).json({ success: false, message: 'No se recibió la imagen (campo esperado: "imagen")' })
    }

    const prompt = buildUmlImagePrompt()

    // Llama a tu servicio de IA (debe devolver JSON puro O texto que podamos parsear)
    const raw = await IAService.generarDesdeImagen({ prompt, imagePath, mimeType })

    // Asegura que sea objeto JSON (sin fences)
    const parsed = coerceToJsonObject(raw)
    console.log(parsed)
    // Respuesta estándar esperada por tu frontend (unwrapDiagramPayload soporta objeto o string)
    return res.json({
      success: true,
      message: 'Diagrama Generado',
      data: parsed
    })
  } catch (err: any) {
    console.error('[generarDesdeImagenHandler] error:', err)
    return res.status(500).json({ success: false, message: 'Error al generar desde imagen', error: err?.message || String(err) })
  }
}
function buildUmlImagePrompt(): string {
  return (
    `Eres un analizador de imágenes UML. Recibirás UNA imagen con un diagrama de clases y debes devolver EXCLUSIVAMENTE un objeto JSON válido (sin Markdown, sin backticks, sin texto adicional). La salida debe seguir este esquema EXACTO:

{
  "classes": {
    "<uuid>": {
      "id": "<uuid>",
      "x": <int>,
      "y": <int>,
      "w": <int>,
      "h": <int>,
      "name": "<string>",
      "attributes": [
        { "visibility": "<+|#|-|~>", "name": "<string>", "type": "<int|bigint|float|double|decimal|string|text|bool|date|time|datetime|uuid|json|''>" }
      ],
      "methods": [
        {
          "visibility": "<+|#|-|~>",
          "name": "<string>",
          "returnType": "<int|bigint|float|double|decimal|string|text|bool|date|time|datetime|uuid|json|''>",
          "params": [
            { "name": "<string>", "type": "<int|bigint|float|double|decimal|string|text|bool|date|time|datetime|uuid|json|''>" }
          ]
        }
      ]
    }
  },
  "links": {
    "<uuid>": {
      "id": "<uuid>",
      "kind": "<Associate|Aggregate|Compose|Generalize|Dependency|AssociateClass>",
      "sourceId": "<uuid>",
      "targetId": "<uuid>",
      "labels": { "src": "<'0..1'|'1'|'0..*'|'1..*'|'*'|''>", "tgt": "<'0..1'|'1'|'0..*'|'1..*'|'*'|''>" },
      "anchorSrc": { "side": "<T|B|L|R>", "t": <number 0..1> } | null,
      "anchorTgt": { "side": "<T|B|L|R>", "t": <number 0..1> } | null,
      "assocClassId": "<uuid>"
    }
  }
}

REGLAS ESTRICTAS
1) Salida:
   - Devuelve SOLO un objeto JSON válido. No uses bloques de código, ni \`\`\`, ni explicaciones fuera del JSON.

2) IDs:
   - Usa UUID v4 únicos para todas las claves de "classes" y "links" y para cada campo "id".
   - "sourceId", "targetId" y (si existe) "assocClassId" deben referenciar IDs presentes en "classes".
   - Si "kind" ≠ "AssociateClass", no incluyas "assocClassId".

3) Coordenadas y tamaño:
   - Origen (0,0) en la esquina superior izquierda de la imagen.
   - x,y = esquina superior izquierda de la caja (px); w,h = ancho/alto (px).
   - Usa enteros. Si no puedes medir, estima valores coherentes.

4) Clases:
   - "name" = texto visible del nombre de la clase.
   - "attributes": lista de {visibility,name,type}. Si no se distingue, visibility="+", type="".
   - "methods": lista de {visibility,name,returnType,params[]}. Si no se distingue, visibility="+", returnType=""; params=[] si no hay.
   - Si no hay atributos o métodos, usa [].

5) Relaciones:
   - Associate: línea simple.
   - Aggregate: rombo blanco en el TODO → sourceId = TODO, targetId = PARTE.
   - Compose: rombo negro en el TODO → sourceId = TODO, targetId = PARTE.
   - Generalize: flecha triangular hueca hacia la superclase → sourceId = SUBCLASE, targetId = SUPERCLASE.
   - Dependency: línea discontinua con flecha abierta.
   - AssociateClass: relación + clase de asociación (incluye "assocClassId" con el id de la clase de asociación).

6) Labels y anclajes:
   - "labels.src"/"labels.tgt": solo "0..1","1","0..*","1..*","*" o "".
   - "anchorSrc"/"anchorTgt": si se puede inferir, {side:"T|B|L|R", t:0..1}; si no, null.

7) Valores por defecto:
   - visibility="+", type="" y returnType="" cuando no se distingan.
   - attributes=[] y methods=[] cuando no existan.`
  )
}