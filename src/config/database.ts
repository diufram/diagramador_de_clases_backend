import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

// Validar que las variables necesarias estén presentes
const {
  DATABASE_NAME,
  DATABASE_USER,
  DATABASE_PASSWORD,
  DATABASE_HOST,
  DATABASE_DIALECT
} = process.env;

if (!DATABASE_NAME || !DATABASE_USER || !DATABASE_PASSWORD || !DATABASE_HOST || !DATABASE_DIALECT) {
  throw new Error('Faltan variables de entorno para configurar Sequelize');
}

// Crear la instancia
const sequelize = new Sequelize(
  DATABASE_NAME,
  DATABASE_USER,
  DATABASE_PASSWORD,
  {
    host: DATABASE_HOST,
    dialect: DATABASE_DIALECT as any, // forzar el tipo si no se tipifica directamente
    logging: false,
  }
);

export default sequelize;
