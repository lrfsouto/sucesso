import database from '../database/connection.js';
import bcrypt from 'bcryptjs';

const initDatabase = async () => {
  try {
    console.log('🔧 Inicializando banco de dados MySQL...');
    
    await database.connect();

    // Criar tabelas
    console.log('📋 Criando tabelas...');

    // Tabela de usuários e autenticação
    await database.run(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        business_name VARCHAR(255) NOT NULL,
        business_description TEXT,
        status ENUM('pending', 'approved', 'rejected', 'restricted') DEFAULT 'pending',
        rejection_reason TEXT,
        restriction_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_at TIMESTAMP NULL,
        restricted_at TIMESTAMP NULL,
        INDEX idx_email (email),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Tabela de credenciais (senhas)
    await database.run(`
      CREATE TABLE IF NOT EXISTS user_credentials (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        username VARCHAR(100) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('admin', 'operator') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_username (user_id, username),
        INDEX idx_user_id (user_id),
        INDEX idx_username (username)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Tabela de estabelecimentos
    await database.run(`
      CREATE TABLE IF NOT EXISTS businesses (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        subtitle VARCHAR(255),
        logo_url TEXT,
        use_custom_logo BOOLEAN DEFAULT FALSE,
        plan ENUM('free', 'premium') DEFAULT 'free',
        owner_id VARCHAR(36),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_id) REFERENCES users (id),
        INDEX idx_owner_id (owner_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Tabela de produtos
    await database.run(`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(36) PRIMARY KEY,
        business_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        barcode VARCHAR(50),
        category VARCHAR(100),
        brand VARCHAR(100),
        price DECIMAL(10,2) NOT NULL,
        cost DECIMAL(10,2),
        stock INT DEFAULT 0,
        min_stock INT DEFAULT 0,
        unit VARCHAR(20) DEFAULT 'unidade',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE,
        INDEX idx_business_id (business_id),
        INDEX idx_barcode (barcode),
        INDEX idx_category (category),
        INDEX idx_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Tabela de vendas
    await database.run(`
      CREATE TABLE IF NOT EXISTS sales (
        id VARCHAR(36) PRIMARY KEY,
        business_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        total DECIMAL(10,2) NOT NULL,
        payment_method VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users (id),
        INDEX idx_business_id (business_id),
        INDEX idx_user_id (user_id),
        INDEX idx_created_at (created_at),
        INDEX idx_payment_method (payment_method)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Tabela de itens de venda
    await database.run(`
      CREATE TABLE IF NOT EXISTS sale_items (
        id VARCHAR(36) PRIMARY KEY,
        sale_id VARCHAR(36) NOT NULL,
        product_id VARCHAR(36) NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        quantity INT NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        total DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products (id),
        INDEX idx_sale_id (sale_id),
        INDEX idx_product_id (product_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Tabela de movimentações de estoque
    await database.run(`
      CREATE TABLE IF NOT EXISTS stock_movements (
        id VARCHAR(36) PRIMARY KEY,
        business_id VARCHAR(36) NOT NULL,
        product_id VARCHAR(36) NOT NULL,
        type ENUM('entrada', 'saida') NOT NULL,
        quantity INT NOT NULL,
        reason VARCHAR(255),
        unit_cost DECIMAL(10,2),
        total_cost DECIMAL(10,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products (id),
        INDEX idx_business_id (business_id),
        INDEX idx_product_id (product_id),
        INDEX idx_type (type),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Tabela de NFCe
    await database.run(`
      CREATE TABLE IF NOT EXISTS nfce (
        id VARCHAR(36) PRIMARY KEY,
        business_id VARCHAR(36) NOT NULL,
        sale_id VARCHAR(36) NOT NULL,
        numero INT NOT NULL,
        serie INT NOT NULL,
        chave_acesso VARCHAR(44),
        status ENUM('pendente', 'autorizada', 'rejeitada', 'cancelada') DEFAULT 'pendente',
        protocolo_autorizacao VARCHAR(50),
        motivo_rejeicao TEXT,
        xml_gerado LONGTEXT,
        xml_autorizado LONGTEXT,
        valor_total DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        authorized_at TIMESTAMP NULL,
        FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE,
        FOREIGN KEY (sale_id) REFERENCES sales (id),
        INDEX idx_business_id (business_id),
        INDEX idx_sale_id (sale_id),
        INDEX idx_numero_serie (numero, serie),
        INDEX idx_status (status),
        INDEX idx_chave_acesso (chave_acesso)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Tabela de configurações
    await database.run(`
      CREATE TABLE IF NOT EXISTS settings (
        id VARCHAR(36) PRIMARY KEY,
        business_id VARCHAR(36) NOT NULL,
        \`key\` VARCHAR(100) NOT NULL,
        value TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (business_id) REFERENCES businesses (id) ON DELETE CASCADE,
        UNIQUE KEY unique_business_key (business_id, \`key\`),
        INDEX idx_business_id (business_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Inserir dados iniciais
    console.log('📦 Inserindo dados iniciais...');

    // Verificar se já existe um estabelecimento padrão
    const existingBusiness = await database.get('SELECT id FROM businesses LIMIT 1');
    
    if (!existingBusiness) {
      // Criar estabelecimento padrão
      const businessId = 'default-business';
      await database.run(`
        INSERT INTO businesses (id, name, subtitle, plan)
        VALUES (?, ?, ?, ?)
      `, [businessId, 'Sistema de Gestão', 'Depósito de Bebidas', 'free']);

      // Inserir produtos iniciais
      const initialProducts = [
        {
          id: 'prod-1',
          name: 'Coca-Cola 2L',
          barcode: '7894900011517',
          category: 'Refrigerante',
          brand: 'Coca-Cola',
          price: 8.50,
          cost: 5.20,
          stock: 48,
          minStock: 10
        },
        {
          id: 'prod-2',
          name: 'Cerveja Skol Lata 350ml',
          barcode: '7891991010924',
          category: 'Cerveja',
          brand: 'Skol',
          price: 3.20,
          cost: 2.10,
          stock: 120,
          minStock: 24
        },
        {
          id: 'prod-3',
          name: 'Água Crystal 500ml',
          barcode: '7891910000147',
          category: 'Água',
          brand: 'Crystal',
          price: 2.00,
          cost: 1.20,
          stock: 8,
          minStock: 20
        },
        {
          id: 'prod-4',
          name: 'Guaraná Antarctica 2L',
          barcode: '7891991010931',
          category: 'Refrigerante',
          brand: 'Antarctica',
          price: 7.80,
          cost: 4.90,
          stock: 32,
          minStock: 15
        },
        {
          id: 'prod-5',
          name: 'Cerveja Brahma Long Neck',
          barcode: '7891991010948',
          category: 'Cerveja',
          brand: 'Brahma',
          price: 4.50,
          cost: 2.80,
          stock: 96,
          minStock: 30
        }
      ];

      for (const product of initialProducts) {
        await database.run(`
          INSERT INTO products (id, business_id, name, barcode, category, brand, price, cost, stock, min_stock, unit)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          product.id,
          businessId,
          product.name,
          product.barcode,
          product.category,
          product.brand,
          product.price,
          product.cost,
          product.stock,
          product.minStock,
          'unidade'
        ]);
      }

      console.log('✅ Produtos iniciais inseridos');
    }

    console.log('🎉 Banco de dados MySQL inicializado com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao inicializar banco:', error);
    throw error;
  } finally {
    await database.close();
  }
};

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  initDatabase().catch(console.error);
}

export default initDatabase;