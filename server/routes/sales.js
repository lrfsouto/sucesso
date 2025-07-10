import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import database from '../database/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Dados em memória para fallback
let fallbackSales = [];
let fallbackSaleItems = [];

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

// Listar vendas
router.get('/', authenticateToken, async (req, res) => {
  try {
    const businessId = req.headers['x-business-id'] || req.user.businessId;
    
    const sales = await safeQuery(
      async () => {
        return await database.all(
          `SELECT s.*, 
           (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) as items_count
           FROM sales s 
           WHERE s.business_id = ? 
           ORDER BY s.created_at DESC`,
          [businessId]
        );
      },
      () => {
        return fallbackSales
          .filter(s => s.business_id === businessId)
          .map(s => ({
            ...s,
            items_count: fallbackSaleItems.filter(si => si.sale_id === s.id).length
          }));
      }
    );

    res.json(sales);
  } catch (error) {
    console.error('Erro ao listar vendas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Criar venda
router.post('/', authenticateToken, async (req, res) => {
  try {
    const businessId = req.headers['x-business-id'] || req.user.businessId;
    const { items, paymentMethod, customerName, discount } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Itens são obrigatórios' });
    }

    const saleId = uuidv4();
    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const finalTotal = total - (discount || 0);

    const saleData = {
      id: saleId,
      business_id: businessId,
      user_id: req.user.id,
      total: finalTotal,
      discount: discount || 0,
      payment_method: paymentMethod || 'dinheiro',
      customer_name: customerName || '',
      status: 'completed',
      created_at: new Date().toISOString()
    };

    await safeQuery(
      async () => {
        // Usar transação para garantir consistência
        await database.transaction([
          {
            sql: `INSERT INTO sales (id, business_id, user_id, total, discount, payment_method, customer_name, status, created_at) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            params: [saleId, businessId, req.user.id, finalTotal, discount || 0, paymentMethod || 'dinheiro', customerName || '', 'completed', new Date()]
          },
          ...items.map(item => ({
            sql: `INSERT INTO sale_items (id, sale_id, product_id, quantity, price, total) VALUES (?, ?, ?, ?, ?, ?)`,
            params: [uuidv4(), saleId, item.productId, item.quantity, item.price, item.price * item.quantity]
          }))
        ]);
      },
      () => {
        fallbackSales.push(saleData);
        items.forEach(item => {
          fallbackSaleItems.push({
            id: uuidv4(),
            sale_id: saleId,
            product_id: item.productId,
            quantity: item.quantity,
            price: item.price,
            total: item.price * item.quantity
          });
        });
      }
    );

    res.status(201).json(saleData);
  } catch (error) {
    console.error('Erro ao criar venda:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;