import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import database from './database/connection.js';
import initDatabase from './scripts/init-database.js';

// Configurar __dirname para ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carregar variáveis de ambiente
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Configurar variáveis de ambiente padrão se não existirem
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'vitana-jwt-secret-key-2024';
  console.log('🔑 JWT_SECRET configurado com valor padrão');
}

if (!process.env.SUPER_ADMIN_PASSWORD) {
  process.env.SUPER_ADMIN_PASSWORD = 'SuperAdmin2024!';
  console.log('🔐 SUPER_ADMIN_PASSWORD configurado com valor padrão');
}

console.log('🚀 Iniciando servidor...');
console.log('📁 __dirname:', __dirname);
console.log('🌍 NODE_ENV:', process.env.NODE_ENV);
console.log('🔌 PORT:', PORT);

// Configurar MySQL a partir da URL do Railway se disponível
if (process.env.MYSQL_URL && !process.env.MYSQL_HOST) {
  try {
    const url = new URL(process.env.MYSQL_URL);
    process.env.MYSQL_HOST = url.hostname;
    process.env.MYSQL_PORT = url.port || '3306';
    process.env.MYSQL_USER = url.username;
    process.env.MYSQL_PASSWORD = url.password;
    process.env.MYSQL_DATABASE = url.pathname.substring(1);
    console.log('🔗 Configuração MySQL extraída da MYSQL_URL');
  } catch (error) {
    console.error('❌ Erro ao processar MYSQL_URL:', error);
  }
}

console.log('🗄️ MySQL Config:');
console.log('   Host:', process.env.MYSQL_HOST);
console.log('   Port:', process.env.MYSQL_PORT);
console.log('   Database:', process.env.MYSQL_DATABASE);
console.log('   User:', process.env.MYSQL_USER);

// Health check PRIMEIRO - antes de qualquer middleware
app.get('/health', (req, res) => {
  console.log('❤️ Health check acessado');
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'production',
    uptime: process.uptime(),
    port: PORT,
    pid: process.pid,
    database: 'MySQL'
  });
});

// Health check alternativo
app.get('/api/health', (req, res) => {
  console.log('❤️ API Health check acessado');
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'production',
    uptime: process.uptime(),
    port: PORT,
    pid: process.pid,
    database: 'MySQL'
  });
});

// Inicializar banco de dados
async function initializeDatabase() {
  try {
    console.log('🔧 Inicializando conexão com banco de dados...');
    await database.connect();
    
    // Executar script de inicialização apenas se necessário
    const tables = await database.all("SHOW TABLES");
    if (tables.length === 0) {
      console.log('📋 Banco vazio, executando inicialização...');
      await initDatabase();
    } else {
      console.log('✅ Banco já inicializado');
    }
  } catch (error) {
    console.error('❌ Erro na inicialização do banco:', error);
    // Não parar o servidor, apenas logar o erro
  }
}

// Middleware básico primeiro
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS simples para produção
app.use(cors({
  origin: '*',
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Business-ID']
}));

// Middleware de logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Servir arquivos estáticos do front-end
const staticPath = path.join(__dirname, '../dist');
console.log('📂 Servindo arquivos estáticos de:', staticPath);
app.use(express.static(staticPath));

// Importar e usar rotas apenas se necessário
try {
  console.log('📋 Carregando rotas...');
  
  // Importar rotas dinamicamente para evitar erros de inicialização
  const authRoutes = await import('./routes/auth.js');
  const businessRoutes = await import('./routes/business.js');
  const productRoutes = await import('./routes/products.js');
  const salesRoutes = await import('./routes/sales.js');
  const stockRoutes = await import('./routes/stock.js');
  const reportsRoutes = await import('./routes/reports.js');
  const nfceRoutes = await import('./routes/nfce.js');

  // Rotas da API
  app.use('/api/auth', authRoutes.default);
  app.use('/api/business', businessRoutes.default);
  app.use('/api/products', productRoutes.default);
  app.use('/api/sales', salesRoutes.default);
  app.use('/api/stock', stockRoutes.default);
  app.use('/api/reports', reportsRoutes.default);
  app.use('/api/nfce', nfceRoutes.default);
  
  console.log('✅ Rotas carregadas com sucesso');
} catch (error) {
  console.error('❌ Erro ao carregar rotas:', error);
  // Continuar mesmo com erro nas rotas para que o health check funcione
}

// Rota catch-all para SPA (deve vir por último)
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '../dist/index.html');
  console.log('📄 Servindo index.html de:', indexPath);
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('❌ Erro ao servir index.html:', err);
      res.status(500).send('Erro interno do servidor');
    }
  });
});

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
  console.error('❌ Erro no servidor:', err);
  
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido' });
  }
  
  res.status(500).json({ 
    error: 'Erro interno do servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Algo deu errado'
  });
});

// Inicializar servidor
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('🎉 SERVIDOR INICIADO COM SUCESSO!');
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`🌐 Frontend: http://localhost:${PORT}`);
  console.log(`🔌 API: http://localhost:${PORT}/api`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log(`🔒 Ambiente: ${process.env.NODE_ENV || 'production'}`);
  console.log(`⏰ Uptime: ${process.uptime()}s`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Recebido SIGTERM, encerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor encerrado graciosamente');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Recebido SIGINT, encerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor encerrado graciosamente');
    process.exit(0);
  });
});

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
  console.error('❌ Erro não capturado:', error);
  // Não sair imediatamente em produção
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promise rejeitada não tratada:', reason);
  // Não sair imediatamente em produção
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

console.log('📋 Servidor configurado, aguardando conexões...');