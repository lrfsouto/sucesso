import mysql from 'mysql2/promise';

class Database {
  constructor() {
    this.pool = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      // Verificar se já está conectado
      if (this.isConnected && this.pool) {
        return this.pool;
      }
      
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
      
      // Se não tiver configuração MySQL, usar modo fallback
      if (!process.env.MYSQL_HOST && !process.env.MYSQL_URL) {
        console.log('⚠️ MySQL não configurado, usando modo fallback');
        this.isConnected = false;
        return null;
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
      this.isConnected = true;
      connection.release();

      return this.pool;
    } catch (error) {
      console.error('❌ Erro ao conectar com MySQL:', error.message);
      console.log('⚠️ Continuando em modo fallback (dados em memória)');
      this.isConnected = false;
      return null;
    }
  }

  async close() {
    if (this.pool && this.isConnected) {
      await this.pool.end();
      this.isConnected = false;
      console.log('🔒 Conexão com MySQL fechada');
    }
  }

  async run(sql, params = []) {
    if (!this.isConnected || !this.pool) {
      throw new Error('MySQL não conectado - usando modo fallback');
    }
    
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
    if (!this.isConnected || !this.pool) {
      throw new Error('MySQL não conectado - usando modo fallback');
    }
    
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
    if (!this.isConnected || !this.pool) {
      throw new Error('MySQL não conectado - usando modo fallback');
    }
    
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
    if (!this.isConnected || !this.pool) {
      throw new Error('MySQL não conectado - usando modo fallback');
    }
    
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
    if (!this.isConnected || !this.pool) {
      throw new Error('MySQL não conectado - usando modo fallback');
    }
    
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

// Tentar conectar automaticamente
database.connect().catch(() => {
  console.log('⚠️ Falha na conexão inicial - modo fallback ativado');
});

export default database;