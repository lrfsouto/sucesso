import mysql from 'mysql2/promise';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Database {
  constructor() {
    this.pool = null;
  }

  async connect() {
    try {
      // Se não tiver configuração MySQL, usar modo fallback
      if (!process.env.MYSQL_HOST && !process.env.MYSQL_URL) {
        console.log('⚠️ MySQL não configurado, usando modo fallback');
        throw new Error('MySQL não configurado');
      }
      
      // Configuração do MySQL
      const config = {
        host: process.env.MYSQL_HOST || 'localhost',
        port: process.env.MYSQL_PORT || 3306,
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE || 'vitana_db',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        acquireTimeout: 60000,
        timeout: 60000,
        reconnect: true,
        charset: 'utf8mb4',
        timezone: '+00:00'
      };

      console.log('🔌 Conectando ao MySQL...');
      console.log(`📍 Host: ${config.host}:${config.port}`);
      console.log(`🗄️ Database: ${config.database}`);
      console.log(`👤 User: ${config.user}`);

      this.pool = mysql.createPool(config);

      // Testar conexão
      const connection = await this.pool.getConnection();
      console.log('✅ Conectado ao MySQL com sucesso!');
      connection.release();

      return this.pool;
    } catch (error) {
      console.error('❌ Erro ao conectar com MySQL:', error.message);
      console.log('💡 Para usar MySQL:');
      console.log('   1. Configure as variáveis MYSQL_* no .env');
      console.log('   2. Ou use MYSQL_URL do Railway');
      console.log('   3. Verifique se o MySQL está rodando');
      throw error;
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log('🔒 Conexão com MySQL fechada');
    }
  }

  async run(sql, params = []) {
    try {
      const [result] = await this.pool.execute(sql, params);
      return {
        id: result.insertId,
        changes: result.affectedRows,
        result
      };
    } catch (error) {
      console.error('❌ Erro SQL:', error.message);
      console.error('📝 Query:', sql);
      console.error('📋 Params:', params);
      throw error;
    }
  }

  async get(sql, params = []) {
    try {
      const [rows] = await this.pool.execute(sql, params);
      return rows[0] || null;
    } catch (error) {
      console.error('❌ Erro SQL:', error.message);
      console.error('📝 Query:', sql);
      console.error('📋 Params:', params);
      throw error;
    }
  }

  async all(sql, params = []) {
    try {
      const [rows] = await this.pool.execute(sql, params);
      return rows;
    } catch (error) {
      console.error('❌ Erro SQL:', error.message);
      console.error('📝 Query:', sql);
      console.error('📋 Params:', params);
      throw error;
    }
  }

  async transaction(operations) {
    const connection = await this.pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      const results = [];
      for (const operation of operations) {
        const [result] = await connection.execute(operation.sql, operation.params);
        results.push({
          id: result.insertId,
          changes: result.affectedRows,
          result
        });
      }
      
      await connection.commit();
      return results;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Método para executar múltiplas queries (útil para inicialização)
  async executeMultiple(queries) {
    const connection = await this.pool.getConnection();
    
    try {
      for (const query of queries) {
        if (query.trim()) {
          await connection.execute(query);
        }
      }
    } finally {
      connection.release();
    }
  }
}

// Instância singleton
const database = new Database();

export default database;