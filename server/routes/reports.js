import express from 'express';
import database from '../database/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Dados em memória para fallback
let fallbackReports = {
  totalSales: 0,
  totalRevenue: 0,
  topProducts: [],
  salesByPeriod: []
};

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

// Relatório de vendas
router.get('/sales', authenticateToken, async (req, res) => {
  try {
    const businessId = req.headers['x-business-id'] || req.user.businessId;
    const { startDate, endDate } = req.query;

    const report = await safeQuery(
      async () => {
        const totalSales = await database.get(
          `SELECT COUNT(*) as count, SUM(total) as revenue 
           FROM sales 
           WHERE business_id = ? AND created_at BETWEEN ? AND ?`,
          [businessId, startDate || '2024-01-01', endDate || new Date().toISOString()]
        );

        const topProducts = await database.all(
          `SELECT p.name, SUM(si.quantity) as total_sold, SUM(si.total) as revenue
           FROM sale_items si
           JOIN products p ON si.product_id = p.id
           JOIN sales s ON si.sale_id = s.id
           WHERE s.business_id = ? AND s.created_at BETWEEN ? AND ?
           GROUP BY p.id, p.name
           ORDER BY total_sold DESC
           LIMIT 10`,
          [businessId, startDate || '2024-01-01', endDate || new Date().toISOString()]
        );

        return {
          totalSales: totalSales.count || 0,
          totalRevenue: totalSales.revenue || 0,
          topProducts: topProducts || []
        };
      },
      () => fallbackReports
    );

    res.json(report);
  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;