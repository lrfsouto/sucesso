import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import database from '../database/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Dados em memória para fallback
let fallbackStockMovements = [];

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

// Listar movimentações de estoque
router.get('/movements', authenticateToken, async (req, res) => {
  try {
    const businessId = req.headers['x-business-id'] || req.user.businessId;
    
    const movements = await safeQuery(
      async () => {
        return await database.all(
          `SELECT sm.*, p.name as product_name 
           FROM stock_movements sm 
           JOIN products p ON sm.product_id = p.id 
           WHERE sm.business_id = ? 
           ORDER BY sm.created_at DESC`,
          [businessId]
        );
      },
      () => {
        return fallbackStockMovements.filter(sm => sm.business_id === businessId);
      }
    );

    res.json(movements);
  } catch (error) {
    console.error('Erro ao listar movimentações:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Criar movimentação de estoque
router.post('/movements', authenticateToken, async (req, res) => {
  try {
    const businessId = req.headers['x-business-id'] || req.user.businessId;
    const { productId, type, quantity, reason } = req.body;

    if (!productId || !type || !quantity) {
      return res.status(400).json({ error: 'Produto, tipo e quantidade são obrigatórios' });
    }

    const movementId = uuidv4();
    const movementData = {
      id: movementId,
      business_id: businessId,
      product_id: productId,
      type,
      quantity: parseInt(quantity),
      reason: reason || '',
      user_id: req.user.id,
      created_at: new Date().toISOString()
    };

    await safeQuery(
      async () => {
        await database.run(
          `INSERT INTO stock_movements (id, business_id, product_id, type, quantity, reason, user_id, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [movementId, businessId, productId, type, quantity, reason || '', req.user.id, new Date()]
        );
      },
      () => {
        fallbackStockMovements.push(movementData);
      }
    );

    res.status(201).json(movementData);
  } catch (error) {
    console.error('Erro ao criar movimentação:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;