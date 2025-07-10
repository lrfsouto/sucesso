import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import database from '../database/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Dados em memória para fallback
let fallbackProducts = [];

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

// Listar produtos
router.get('/', authenticateToken, async (req, res) => {
  try {
    const businessId = req.headers['x-business-id'] || req.user.businessId;
    
    const products = await safeQuery(
      async () => {
        return await database.all(
          'SELECT * FROM products WHERE business_id = ? ORDER BY name',
          [businessId]
        );
      },
      () => {
        return fallbackProducts.filter(p => p.business_id === businessId);
      }
    );

    res.json(products);
  } catch (error) {
    console.error('Erro ao listar produtos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Criar produto
router.post('/', authenticateToken, async (req, res) => {
  try {
    const businessId = req.headers['x-business-id'] || req.user.businessId;
    const { name, barcode, price, cost, stock, minStock, category, unit } = req.body;

    if (!name || !price) {
      return res.status(400).json({ error: 'Nome e preço são obrigatórios' });
    }

    const productId = uuidv4();
    const productData = {
      id: productId,
      business_id: businessId,
      name,
      barcode: barcode || '',
      price: parseFloat(price),
      cost: parseFloat(cost) || 0,
      stock: parseInt(stock) || 0,
      min_stock: parseInt(minStock) || 0,
      category: category || 'Geral',
      unit: unit || 'UN',
      created_at: new Date().toISOString()
    };

    await safeQuery(
      async () => {
        await database.run(
          `INSERT INTO products (id, business_id, name, barcode, price, cost, stock, min_stock, category, unit, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [productId, businessId, name, barcode || '', price, cost || 0, stock || 0, minStock || 0, category || 'Geral', unit || 'UN', new Date()]
        );
      },
      () => {
        fallbackProducts.push(productData);
      }
    );

    res.status(201).json(productData);
  } catch (error) {
    console.error('Erro ao criar produto:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;