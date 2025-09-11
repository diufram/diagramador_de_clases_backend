// types/express/index.d.ts
import { JwtPayload } from 'jsonwebtoken';

declare module 'express-serve-static-core' {
  interface Request {
    user?: JwtPayload | { id: number; correo: string; nombre: string };
  }
}