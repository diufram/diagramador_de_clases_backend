// src/modules/ia/ia.controller.ts
import { Request, Response } from 'express'
import { IAService } from './ia.service'

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
  console.log("ENTRO")
  try {
    const prompt = req.body.prompt || ''
    const imagePath = req.file?.path     // viene desde multer
    const mimeType = req.file?.mimetype  // tipo de archivo

    if (!imagePath) {
      return res.status(400).json({ message: 'No se recibió la imagen' })
    }

    const resultado = await IAService.generarDesdeImagen({
      prompt,
      imagePath,
      mimeType,
    })

    res.json({ resultado })
  } catch (err: any) {
    res.status(500).json({ message: 'Error al generar desde imagen', error: err.message })
  }
}
