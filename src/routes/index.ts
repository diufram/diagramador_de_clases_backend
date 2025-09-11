import { Router } from 'express';

// Importar rutas de módulos
import authRoutes from '../modules/auth/auth.routes';
import salaRoutes from '../modules/sala/sala.routes';
import userSalaRoutes from '../modules/userSala/userSala.routes';
import iaRoutes from '../modules/ia/ia.routes'
import { authenticateJWT } from '../middlewares/authenticate.middleware';
// Agrega aquí más rutas según crezcas

const router = Router();

// Prefijos por módulo
router.use('/auth', authRoutes);     // /api/auth/*
router.use('/salas', authenticateJWT, salaRoutes);    // /api/salas/*
router.use('/user-salas', authenticateJWT, userSalaRoutes);
router.use('/ia', iaRoutes)
export default router;
