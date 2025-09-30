// src/modules/ia/ia.controller.ts
import { Request, Response } from 'express'
import { IAService } from './ia.service'
import { successResponse } from '../../utils/response'

export async function generarTextoHandler(req: Request, res: Response) {
  try {
    const { prompt } = req.body
    const resultado = await IAService.generarTexto(prompt)
    res.json({ resultado })
  } catch (err: any) {
    res.status(500).json({ message: 'Error al generar texto', error: err.message })
  }
}

export async function generarDesdeImagenHandler(req: Request, res: Response) {
  try {
    const imagePath = req.file?.path     // viene desde multer
    const mimeType = req.file?.mimetype  // tipo de archivo

    if (!imagePath) {
      return res.status(400).json({ message: 'No se recibió la imagen' })
    }

    const prompt = `Eres un analizador de imágenes UML. Recibirás UNA imagen de un diagrama de clases y debes devolver ÚNICAMENTE un JSON (sin texto extra, sin Markdown) con este esquema EXACTO:

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
        { "vis": "<+|#|-|~>", "name": "<string>", "type": "<int|bigint|float|double|decimal|string|text|bool|date|time|datetime|uuid|json>" }
      ],
      "methods": [
        {
          "vis": "<+|#|-|~>",
          "name": "<string>",
          "returnType": "<int|bigint|float|double|decimal|string|text|bool|date|time|datetime|uuid|json|''>",
          "params": [
            { "name": "<string>", "type": "<int|bigint|float|double|decimal|string|text|bool|date|time|datetime|uuid|json>" }
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
      "labels": {
        "src": "<'0..1'|'1'|'0..*'|'1..*'|'*'|''>",
        "tgt": "<'0..1'|'1'|'0..*'|'1..*'|'*'|''>"
      },
      "anchorSrc": { "side": "<T|B|L|R>", "t": <float 0..1> } | null,
      "anchorTgt": { "side": "<T|B|L|R>", "t": <float 0..1> } | null,
      "assocClassId": "<uuid solo si kind=AssociateClass>"
    }
  }
}

REGLAS:
1) IDs  
   - Genera UUID v4 únicos para todas las clases y links.  
   - sourceId/targetId/assocClassId deben existir en "classes".  

2) Coordenadas y tamaño  
   - Origen (0,0) en la esquina superior-izquierda de la imagen.  
   - x,y = esquina sup-izq de la clase (px).  
   - w,h = ancho/alto estimados (px).  
   - Estima valores coherentes si no puedes medir con precisión.  

3) Clases  
   - name = nombre exacto visible.  
   - attributes = cada atributo como objeto {vis,name,type}.  
     · vis = usa "+", "-", "#", "~".  
     · Si no se distingue en la imagen → por defecto usa "+".  
     · type = solo uno de {int,bigint,float,double,decimal,string,text,bool,date,time,datetime,uuid,json}. Si no se distingue, usa "".  
   - methods = cada operación como objeto {vis,name,returnType,params[]}.  
     · vis = usa "+", "-", "#", "~".  
     · Si no se distingue en la imagen → por defecto usa "+".  
     · returnType = mismo conjunto de tipos o "".  
     · params = lista de {name,type}; si no hay, [].  
   - Si no hay atributos o métodos, usa [].  

4) Relaciones ("kind")  
   - Associate: línea simple (labels opcionales).  
   - Aggregate: rombo blanco en el "todo" → sourceId = todo, targetId = parte.  
   - Compose: rombo negro en el "todo" → sourceId = todo, targetId = parte.  
   - Generalize: flecha triangular hueca hacia la superclase → sourceId = subclase, targetId = superclase.  
   - Dependency: línea discontinua con flecha abierta.  
   - AssociateClass: relación con clase de asociación → incluye "assocClassId".  

5) Labels y anclajes  
   - labels.src y labels.tgt SOLO pueden contener multiplicidades {'0..1','1','0..*','1..*','*'} o "".  
   - anchorSrc / anchorTgt: si se infiere, usa { side: "T|B|L|R", t: 0..1 }; si no, null.  

6) Salida estricta  
   - Devuelve SOLO JSON válido. Nada de comentarios ni texto fuera.  
   - Si no hay datos legibles → usa "" en strings, [] en arrays, null en anchors.`



    const resultado = await IAService.generarDesdeImagen({
      prompt,
      imagePath,
      mimeType,
    })
    return successResponse(res, resultado, 'Diagrama Generado');
  } catch (err: any) {
    res.status(500).json({ message: 'Error al generar desde imagen', error: err.message })
  }
}
