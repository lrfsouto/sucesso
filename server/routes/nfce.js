import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import database from '../database/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Dados em memória para fallback
let fallbackNFCe = [];

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

// Listar NFCe
router.get('/', authenticateToken, async (req, res) => {
  try {
    const businessId = req.headers['x-business-id'] || req.user.businessId;
    
    const nfces = await safeQuery(
      async () => {
        return await database.all(
          'SELECT * FROM nfce WHERE business_id = ? ORDER BY created_at DESC',
          [businessId]
        );
      },
      () => {
        return fallbackNFCe.filter(n => n.business_id === businessId);
      }
    );

    res.json(nfces);
  } catch (error) {
    console.error('Erro ao listar NFCe:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Criar NFCe
router.post('/', authenticateToken, async (req, res) => {
  try {
    const businessId = req.headers['x-business-id'] || req.user.businessId;
    const { saleId, number, key, xml, status } = req.body;

    const nfceId = uuidv4();
    const nfceData = {
      id: nfceId,
      business_id: businessId,
      sale_id: saleId,
      number: number || '',
      key: key || '',
      xml: xml || '',
      status: status || 'pending',
      created_at: new Date().toISOString()
    };

    await safeQuery(
      async () => {
        await database.run(
          `INSERT INTO nfce (id, business_id, sale_id, number, key, xml, status, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [nfceId, businessId, saleId, number || '', key || '', xml || '', status || 'pending', new Date()]
        );
      },
      () => {
        fallbackNFCe.push(nfceData);
      }
    );

    res.status(201).json(nfceData);
  } catch (error) {
    console.error('Erro ao criar NFCe:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;