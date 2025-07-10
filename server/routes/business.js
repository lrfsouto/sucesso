import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import database from '../database/connection.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Dados em memória para fallback
let fallbackBusinesses = [];

// Função para usar banco ou fallback
async function safeQuery(operation, fallbackOperation) {
  try {
    if (database.pool) {
      return await operation();
    }
  } catch (error) {
    console.log('⚠️ Usando dados em memória (fallback)');
  }
  return fallbackOperation();
}

// Listar estabelecimentos
router.get('/', authenticateToken, async (req, res) => {
  try {
    const businesses = await safeQuery(
      async () => {
        if (req.user.role === 'super_admin') {
          return await database.all('SELECT * FROM businesses ORDER BY name');
        } else {
          return await database.all('SELECT * FROM businesses WHERE id = ?', [req.user.businessId]);
        }
      },
      () => {
        if (req.user.role === 'super_admin') {
          return fallbackBusinesses;
        } else {
          return fallbackBusinesses.filter(b => b.id === req.user.businessId);
        }
      }
    );

    res.json(businesses);
  } catch (error) {
    console.error('Erro ao listar estabelecimentos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Criar estabelecimento
router.post('/', authenticateToken, requireRole(['super_admin']), async (req, res) => {
  try {
    const { name, address, phone, email, cnpj } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nome é obrigatório' });
    }

    const businessId = uuidv4();
    const businessData = {
      id: businessId,
      name,
      address: address || '',
      phone: phone || '',
      email: email || '',
      cnpj: cnpj || '',
      created_at: new Date().toISOString()
    };

    await safeQuery(
      async () => {
        await database.run(
          `INSERT INTO businesses (id, name, address, phone, email, cnpj, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [businessId, name, address || '', phone || '', email || '', cnpj || '', new Date()]
        );
      },
      () => {
        fallbackBusinesses.push(businessData);
      }
    );

    res.status(201).json(businessData);
  } catch (error) {
    console.error('Erro ao criar estabelecimento:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;