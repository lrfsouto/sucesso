import database from '../database/connection.js';

const initDatabase = async () => {
  try {
    console.log('🔧 Inicializando banco de dados...');
    
    // Conectar ao banco
    await database.connect();
    
    // SQL para criar todas as tabelas
    const createTablesSQL = `
      -- Tabela de usuários (solicitações de acesso)
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20),
        business_name VARCHAR(255) NOT NULL,
        business_type VARCHAR(100),
        status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );

      -- Tabela de credenciais de usuários (senhas admin/operador)
      CREATE TABLE IF NOT EXISTS user_credentials (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        business_id VARCHAR(36) NOT NULL,
        role ENUM('admin', 'operator') NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_business_role (user_id, business_id, role)
      );

      -- Tabela de estabelecimentos
      CREATE TABLE IF NOT EXISTS businesses (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address TEXT,
        phone VARCHAR(20),
        email VARCHAR(255),
        cnpj VARCHAR(18),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );

      -- Tabela de produtos
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(36) PRIMARY KEY,
        business_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        barcode VARCHAR(50),
        price DECIMAL(10,2) NOT NULL,
        cost DECIMAL(10,2) DEFAULT 0,
        stock INT DEFAULT 0,
        min_stock INT DEFAULT 0,
        category VARCHAR(100) DEFAULT 'Geral',
        unit VARCHAR(10) DEFAULT 'UN',
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
        INDEX idx_business_products (business_id),
        INDEX idx_barcode (barcode)
      );

      -- Tabela de vendas
      CREATE TABLE IF NOT EXISTS sales (
        id VARCHAR(36) PRIMARY KEY,
        business_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        total DECIMAL(10,2) NOT NULL,
        discount DECIMAL(10,2) DEFAULT 0,
        payment_method VARCHAR(50) DEFAULT 'dinheiro',
        customer_name VARCHAR(255),
        status ENUM('pending', 'completed', 'cancelled') DEFAULT 'completed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
        INDEX idx_business_sales (business_id),
        INDEX idx_created_at (created_at)
      );

      -- Tabela de itens das vendas
      CREATE TABLE IF NOT EXISTS sale_items (
        id VARCHAR(36) PRIMARY KEY,
        sale_id VARCHAR(36) NOT NULL,
        product_id VARCHAR(36) NOT NULL,
        quantity INT NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        total DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        INDEX idx_sale_items (sale_id)
      );

      -- Tabela de movimentações de estoque
      CREATE TABLE IF NOT EXISTS stock_movements (
        id VARCHAR(36) PRIMARY KEY,
        business_id VARCHAR(36) NOT NULL,
        product_id VARCHAR(36) NOT NULL,
        type ENUM('in', 'out', 'adjustment') NOT NULL,
        quantity INT NOT NULL,
        reason VARCHAR(255),
        user_id VARCHAR(36),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        INDEX idx_business_movements (business_id),
        INDEX idx_product_movements (product_id)
      );

      -- Tabela de NFCe
      CREATE TABLE IF NOT EXISTS nfce (
        id VARCHAR(36) PRIMARY KEY,
        business_id VARCHAR(36) NOT NULL,
        sale_id VARCHAR(36),
        number VARCHAR(50),
        \`key\` VARCHAR(100),
        xml LONGTEXT,
        status ENUM('pending', 'authorized', 'cancelled', 'error') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL,
        INDEX idx_business_nfce (business_id)
      );

      -- Tabela de configurações
      CREATE TABLE IF NOT EXISTS settings (
        id VARCHAR(36) PRIMARY KEY,
        business_id VARCHAR(36) NOT NULL,
        key_name VARCHAR(100) NOT NULL,
        value TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
        UNIQUE KEY unique_business_setting (business_id, key_name)
      );
    `;

    // Dividir o SQL em comandos individuais e executar
    const commands = createTablesSQL
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0);

    for (const command of commands) {
      await database.run(command);
    }

    console.log('✅ Banco de dados inicializado com sucesso!');
    console.log('📋 Tabelas criadas:');
    console.log('   - users (solicitações de acesso)');
    console.log('   - user_credentials (senhas admin/operador)');
    console.log('   - businesses (estabelecimentos)');
    console.log('   - products (produtos)');
    console.log('   - sales (vendas)');
    console.log('   - sale_items (itens das vendas)');
    console.log('   - stock_movements (movimentações de estoque)');
    console.log('   - nfce (notas fiscais)');
    console.log('   - settings (configurações)');

  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error);
    throw error;
  } finally {
    await database.close();
  }
};

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  initDatabase()
    .then(() => {
      console.log('🎉 Inicialização concluída!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Falha na inicialização:', error);
      process.exit(1);
    });
}

export default initDatabase;