import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  Search, 
  Filter,
  Download,
  Eye,
  Scan,
  Plus,
  CreditCard,
  Smartphone,
  Banknote,
  X,
  Package,
  Clock,
  User,
  Receipt
} from 'lucide-react';
import { useSales } from '../hooks/useSales';
import { useProducts } from '../hooks/useProducts';
import { useStockMovements } from '../hooks/useStockMovements';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { BarcodeScanner } from './BarcodeScanner';
import { Sale, SaleItem, Product } from '../types';

interface CartItem extends SaleItem {
  product: Product;
}

type PaymentMethod = 'dinheiro' | 'pix' | 'cartão' | 'débito';

export function SalesManagement() {
  const { user } = useAuth();
  const { sales, addSale } = useSales();
  const { products, updateStock, findByBarcode } = useProducts();
  const { addMovement } = useStockMovements();
  const { showNotification } = useNotifications();

  // Estados
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('today');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [showNewSaleModal, setShowNewSaleModal] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('dinheiro');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');

  // Filtrar vendas
  const filteredSales = sales.filter(sale => {
    // Filtro de busca
    const matchesSearch = sale.items.some(item => 
      item.productName.toLowerCase().includes(searchTerm.toLowerCase())
    ) || sale.id.toLowerCase().includes(searchTerm.toLowerCase());

    // Filtro de data
    const today = new Date();
    const saleDate = new Date(sale.date);
    let matchesDate = true;

    switch (dateFilter) {
      case 'today':
        matchesDate = saleDate.toDateString() === today.toDateString();
        break;
      case 'week':
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        matchesDate = saleDate >= weekAgo;
        break;
      case 'month':
        matchesDate = saleDate.getMonth() === today.getMonth() && 
                     saleDate.getFullYear() === today.getFullYear();
        break;
    }

    // Filtro de pagamento
    const matchesPayment = paymentFilter === 'all' || sale.paymentMethod === paymentFilter;

    return matchesSearch && matchesDate && matchesPayment;
  });

  // Estatísticas
  const stats = {
    totalSales: filteredSales.length,
    totalRevenue: filteredSales.reduce((sum, sale) => sum + sale.total, 0),
    averageTicket: filteredSales.length > 0 
      ? filteredSales.reduce((sum, sale) => sum + sale.total, 0) / filteredSales.length 
      : 0,
    topPaymentMethod: getTopPaymentMethod(filteredSales)
  };

  function getTopPaymentMethod(salesList: Sale[]) {
    const paymentCounts = salesList.reduce((acc, sale) => {
      acc[sale.paymentMethod] = (acc[sale.paymentMethod] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topMethod = Object.entries(paymentCounts)
      .sort(([,a], [,b]) => b - a)[0];

    return topMethod ? topMethod[0] : 'N/A';
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPaymentMethodIcon = (method: PaymentMethod) => {
    switch (method) {
      case 'dinheiro': return <Banknote className="h-4 w-4" />;
      case 'pix': return <Smartphone className="h-4 w-4" />;
      case 'cartão': return <CreditCard className="h-4 w-4" />;
      case 'débito': return <CreditCard className="h-4 w-4" />;
      default: return <DollarSign className="h-4 w-4" />;
    }
  };

  const getPaymentMethodName = (method: PaymentMethod) => {
    const names = {
      dinheiro: 'Dinheiro',
      pix: 'PIX',
      cartão: 'Cartão de Crédito',
      débito: 'Cartão de Débito'
    };
    return names[method];
  };

  // Funções do carrinho
  const addToCart = (product: Product, quantity: number = 1) => {
    if (product.stock < quantity) {
      showNotification({
        type: 'warning',
        title: 'Estoque Insuficiente',
        message: `Apenas ${product.stock} unidades disponíveis de ${product.name}`
      });
      return;
    }

    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.productId === product.id);
      
      if (existingItem) {
        const newQuantity = existingItem.quantity + quantity;
        if (newQuantity > product.stock) {
          showNotification({
            type: 'warning',
            title: 'Estoque Insuficiente',
            message: `Apenas ${product.stock} unidades disponíveis`
          });
          return prevCart;
        }
        
        return prevCart.map(item =>
          item.productId === product.id
            ? {
                ...item,
                quantity: newQuantity,
                total: newQuantity * item.unitPrice
              }
            : item
        );
      } else {
        const newItem: CartItem = {
          productId: product.id,
          productName: product.name,
          quantity,
          unitPrice: product.price,
          total: quantity * product.price,
          product
        };
        return [...prevCart, newItem];
      }
    });

    showNotification({
      type: 'success',
      title: 'Produto Adicionado',
      message: `${quantity}x ${product.name}`,
      duration: 2000
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prevCart => prevCart.filter(item => item.productId !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setBarcodeInput('');
  };

  const calculateTotal = () => {
    return cart.reduce((total, item) => total + item.total, 0);
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const product = findByBarcode(barcodeInput.trim());
    if (product) {
      addToCart(product);
      setBarcodeInput('');
    } else {
      showNotification({
        type: 'error',
        title: 'Produto Não Encontrado',
        message: `Código de barras: ${barcodeInput}`
      });
      setBarcodeInput('');
    }
  };

  const handleScannerResult = (barcode: string) => {
    const product = findByBarcode(barcode);
    if (product) {
      addToCart(product);
    } else {
      showNotification({
        type: 'error',
        title: 'Produto Não Encontrado',
        message: `Código de barras: ${barcode}`
      });
    }
    setScannerOpen(false);
  };

  const finalizeSale = async () => {
    if (cart.length === 0) return;

    try {
      // Criar venda
      await addSale({
        items: cart.map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total
        })),
        total: calculateTotal(),
        paymentMethod: selectedPaymentMethod
      });

      // Atualizar estoque e registrar movimentações
      for (const item of cart) {
        const newStock = item.product.stock - item.quantity;
        await updateStock(item.productId, newStock);
        
        addMovement({
          productId: item.productId,
          type: 'saída',
          quantity: item.quantity,
          reason: `Venda - ${selectedPaymentMethod}`
        });
      }

      showNotification({
        type: 'sale',
        title: '🎉 Venda Finalizada!',
        message: `Total: ${formatCurrency(calculateTotal())} - ${getPaymentMethodName(selectedPaymentMethod)}`,
        duration: 4000
      });

      // Limpar e fechar
      clearCart();
      setShowNewSaleModal(false);

    } catch (error) {
      showNotification({
        type: 'error',
        title: 'Erro na Venda',
        message: 'Não foi possível finalizar a venda'
      });
    }
  };

  const exportSales = () => {
    const csvContent = [
      ['Data', 'ID', 'Total', 'Pagamento', 'Itens'].join(','),
      ...filteredSales.map(sale => [
        formatDate(sale.date),
        sale.id,
        sale.total.toFixed(2),
        getPaymentMethodName(sale.paymentMethod),
        sale.items.length
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vendas-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    showNotification({
      type: 'success',
      title: 'Exportação Concluída',
      message: 'Arquivo CSV baixado com sucesso'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Gestão de Vendas</h1>
          <p className="text-gray-400">Visualize e gerencie todas as vendas</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={exportSales}
            className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </button>
          
          {user?.role === 'admin' && (
            <button
              onClick={() => setShowNewSaleModal(true)}
              className="flex items-center px-4 py-2 bg-gradient-to-r from-yellow-400 to-yellow-600 text-black rounded-lg font-medium hover:from-yellow-500 hover:to-yellow-700 transition-all duration-200"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Venda
            </button>
          )}
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900 rounded-xl border border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total de Vendas</p>
              <p className="text-2xl font-bold text-white">{stats.totalSales}</p>
            </div>
            <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <ShoppingCart className="h-6 w-6 text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Receita Total</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(stats.totalRevenue)}</p>
            </div>
            <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Ticket Médio</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(stats.averageTicket)}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-yellow-400" />
            </div>
          </div>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Pagamento Principal</p>
              <p className="text-2xl font-bold text-white">{getPaymentMethodName(stats.topPaymentMethod as PaymentMethod)}</p>
            </div>
            <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
              {getPaymentMethodIcon(stats.topPaymentMethod as PaymentMethod)}
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-gray-900 rounded-xl border border-gray-700 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Buscar
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por produto ou ID..."
                className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Período
            </label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20"
            >
              <option value="today">Hoje</option>
              <option value="week">Última Semana</option>
              <option value="month">Este Mês</option>
              <option value="all">Todas</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Pagamento
            </label>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20"
            >
              <option value="all">Todos</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="pix">PIX</option>
              <option value="cartão">Cartão de Crédito</option>
              <option value="débito">Cartão de Débito</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchTerm('');
                setDateFilter('today');
                setPaymentFilter('all');
              }}
              className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center justify-center"
            >
              <Filter className="h-4 w-4 mr-2" />
              Limpar
            </button>
          </div>
        </div>
      </div>

      {/* Lista de Vendas */}
      <div className="bg-gray-900 rounded-xl border border-gray-700">
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">
            Vendas Recentes ({filteredSales.length})
          </h2>
        </div>

        {filteredSales.length === 0 ? (
          <div className="p-12 text-center">
            <ShoppingCart className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">Nenhuma venda encontrada</p>
            <p className="text-gray-500">Ajuste os filtros ou registre uma nova venda</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {filteredSales.map((sale) => (
              <div key={sale.id} className="p-6 hover:bg-gray-800/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                        <Receipt className="h-5 w-5 text-green-400" />
                      </div>
                      
                      <div>
                        <div className="flex items-center space-x-3">
                          <h3 className="font-medium text-white">#{sale.id.slice(-8)}</h3>
                          <div className="flex items-center text-gray-400">
                            {getPaymentMethodIcon(sale.paymentMethod)}
                            <span className="ml-1 text-sm">{getPaymentMethodName(sale.paymentMethod)}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4 mt-1">
                          <div className="flex items-center text-gray-400 text-sm">
                            <Clock className="h-4 w-4 mr-1" />
                            {formatDate(sale.date)}
                          </div>
                          <div className="flex items-center text-gray-400 text-sm">
                            <Package className="h-4 w-4 mr-1" />
                            {sale.items.length} {sale.items.length === 1 ? 'item' : 'itens'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="text-lg font-bold text-white">{formatCurrency(sale.total)}</p>
                      <p className="text-sm text-gray-400">
                        {sale.items.map(item => item.productName).join(', ').substring(0, 30)}
                        {sale.items.map(item => item.productName).join(', ').length > 30 ? '...' : ''}
                      </p>
                    </div>
                    
                    <button
                      onClick={() => setSelectedSale(sale)}
                      className="p-2 text-gray-400 hover:text-yellow-400 transition-colors"
                      title="Ver detalhes"
                    >
                      <Eye className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Detalhes da Venda */}
      {selectedSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl border border-gray-700 p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">
                Detalhes da Venda #{selectedSale.id.slice(-8)}
              </h2>
              <button
                onClick={() => setSelectedSale(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Informações Gerais */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400">Data e Hora</p>
                  <p className="text-white font-medium">{formatDate(selectedSale.date)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Forma de Pagamento</p>
                  <div className="flex items-center text-white font-medium">
                    {getPaymentMethodIcon(selectedSale.paymentMethod)}
                    <span className="ml-2">{getPaymentMethodName(selectedSale.paymentMethod)}</span>
                  </div>
                </div>
              </div>

              {/* Itens */}
              <div>
                <h3 className="text-lg font-medium text-white mb-4">Itens da Venda</h3>
                <div className="space-y-3">
                  {selectedSale.items.map((item, index) => (
                    <div key={index} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-white">{item.productName}</h4>
                          <p className="text-sm text-gray-400">
                            {item.quantity}x {formatCurrency(item.unitPrice)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-white">{formatCurrency(item.total)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-lg p-4 text-black">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-80">Total da Venda</p>
                    <p className="text-2xl font-bold">{formatCurrency(selectedSale.total)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm opacity-80">Itens</p>
                    <p className="text-lg font-semibold">{selectedSale.items.length}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Nova Venda */}
      {showNewSaleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl border border-gray-700 p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Nova Venda</h2>
              <button
                onClick={() => {
                  setShowNewSaleModal(false);
                  clearCart();
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Scanner e Produtos */}
              <div className="space-y-6">
                {/* Scanner */}
                <div>
                  <h3 className="text-lg font-medium text-white mb-4">Adicionar Produtos</h3>
                  
                  <form onSubmit={handleBarcodeSubmit} className="space-y-4">
                    <div className="flex space-x-3">
                      <input
                        type="text"
                        value={barcodeInput}
                        onChange={(e) => setBarcodeInput(e.target.value)}
                        placeholder="Código de barras"
                        className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20"
                      />
                      <button
                        type="submit"
                        className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-black px-6 py-3 rounded-lg font-medium hover:from-yellow-500 hover:to-yellow-700 transition-all duration-200"
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                    </div>
                  </form>

                  <button
                    onClick={() => setScannerOpen(true)}
                    className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center"
                  >
                    <Scan className="h-5 w-5 mr-2" />
                    Scanner Visual
                  </button>
                </div>

                {/* Lista de Produtos */}
                <div>
                  <h4 className="text-md font-medium text-white mb-3">Produtos Disponíveis</h4>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {products.slice(0, 10).map((product) => (
                      <div key={product.id} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="font-medium text-white text-sm">{product.name}</h5>
                            <p className="text-xs text-gray-400">
                              {formatCurrency(product.price)} • Estoque: {product.stock}
                            </p>
                          </div>
                          <button
                            onClick={() => addToCart(product)}
                            disabled={product.stock === 0}
                            className="bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-600 text-black disabled:text-gray-400 px-3 py-1 rounded text-sm font-medium transition-colors"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Carrinho e Pagamento */}
              <div className="space-y-6">
                {/* Carrinho */}
                <div>
                  <h3 className="text-lg font-medium text-white mb-4">
                    Carrinho ({cart.length} {cart.length === 1 ? 'item' : 'itens'})
                  </h3>
                  
                  {cart.length === 0 ? (
                    <div className="text-center py-8">
                      <ShoppingCart className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-400">Carrinho vazio</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {cart.map((item) => (
                        <div key={item.productId} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium text-white text-sm">{item.productName}</h4>
                              <p className="text-xs text-gray-400">
                                {item.quantity}x {formatCurrency(item.unitPrice)}
                              </p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-white text-sm">{formatCurrency(item.total)}</span>
                              <button
                                onClick={() => removeFromCart(item.productId)}
                                className="text-red-400 hover:text-red-300 transition-colors"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Total */}
                <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-lg p-4 text-black">
                  <p className="text-sm opacity-80">Total</p>
                  <p className="text-2xl font-bold">{formatCurrency(calculateTotal())}</p>
                </div>

                {/* Forma de Pagamento */}
                <div>
                  <h4 className="text-md font-medium text-white mb-3">Forma de Pagamento</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'dinheiro' as PaymentMethod, name: 'Dinheiro', icon: Banknote },
                      { id: 'pix' as PaymentMethod, name: 'PIX', icon: Smartphone },
                      { id: 'cartão' as PaymentMethod, name: 'Crédito', icon: CreditCard },
                      { id: 'débito' as PaymentMethod, name: 'Débito', icon: CreditCard }
                    ].map((method) => (
                      <button
                        key={method.id}
                        onClick={() => setSelectedPaymentMethod(method.id)}
                        className={`p-3 rounded-lg border-2 transition-all duration-200 flex items-center justify-center ${
                          selectedPaymentMethod === method.id
                            ? 'border-yellow-500 bg-yellow-500/10 text-yellow-400'
                            : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-500'
                        }`}
                      >
                        <method.icon className="h-4 w-4 mr-2" />
                        <span className="text-sm font-medium">{method.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Botões */}
                <div className="flex space-x-3">
                  <button
                    onClick={clearCart}
                    disabled={cart.length === 0}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-medium transition-all duration-200"
                  >
                    Limpar
                  </button>
                  <button
                    onClick={finalizeSale}
                    disabled={cart.length === 0}
                    className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white py-3 px-4 rounded-lg font-medium transition-all duration-200"
                  >
                    Finalizar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scanner Modal */}
      <BarcodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScannerResult}
      />
    </div>
  );
}