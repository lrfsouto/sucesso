import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import database from '../database/connection.js';

const router = express.Router();

// Dados em memória para fallback (quando MySQL não está disponível)
let fallbackData = {
  users: [],
  userCredentials: []
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

// Registrar novo usuário (solicitação de acesso)
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, businessName, businessType } = req.body;

    if (!name || !email || !businessName) {
      return res.status(400).json({ error: 'Dados obrigatórios não fornecidos' });
    }

    const userId = uuidv4();
    const userData = {
      id: userId,
      name,
      email,
      phone: phone || '',
      business_name: businessName,
      business_type: businessType || 'Outros',
      status: 'pending',
      created_at: new Date().toISOString()
    };

    await safeQuery(
      async () => {
        await database.run(
          `INSERT INTO users (id, name, email, phone, business_name, business_type, status, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [userId, name, email, phone || '', businessName, businessType || 'Outros', 'pending', new Date()]
        );
      },
      () => {
        fallbackData.users.push(userData);
      }
    );

    res.status(201).json({ 
      message: 'Solicitação de acesso enviada com sucesso! Aguarde aprovação do administrador.',
      userId 
    });
  } catch (error) {
    console.error('Erro ao registrar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({ error: 'Email, senha e função são obrigatórios' });
    }

    // Verificar se é super admin
    if (email === 'admin@vitana.com' && password === process.env.SUPER_ADMIN_PASSWORD) {
      const token = jwt.sign(
        { id: 'super-admin', email, role: 'super_admin' },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.json({
        token,
        user: {
          id: 'super-admin',
          email,
          role: 'super_admin',
          name: 'Super Administrador'
        }
      });
    }

    // Buscar credenciais do usuário
    const credentials = await safeQuery(
      async () => {
        return await database.get(
          `SELECT uc.*, u.name, u.business_name, u.status 
           FROM user_credentials uc 
           JOIN users u ON uc.user_id = u.id 
           WHERE u.email = ? AND uc.role = ?`,
          [email, role]
        );
      },
      () => {
        const user = fallbackData.users.find(u => u.email === email && u.status === 'approved');
        if (!user) return null;
        
        return fallbackData.userCredentials.find(uc => uc.user_id === user.id && uc.role === role);
      }
    );

    if (!credentials) {
      return res.status(401).json({ error: 'Credenciais inválidas ou usuário não aprovado' });
    }

    // Verificar senha
    const validPassword = await bcrypt.compare(password, credentials.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Gerar token
    const token = jwt.sign(
      { 
        id: credentials.user_id, 
        email, 
        role: credentials.role,
        businessId: credentials.business_id 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: credentials.user_id,
        email,
        role: credentials.role,
        name: credentials.name,
        businessName: credentials.business_name,
        businessId: credentials.business_id
      }
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;