import React, { useState, useEffect, useRef } from 'react';
import { 
  ShoppingCart, 
  Scan, 
  Plus, 
  Minus, 
  Trash2, 
  CreditCard, 
  DollarSign, 
  Smartphone,
  X,
  Package,
  AlertTriangle,
  CheckCircle,
  Clock,
  Pause,
  Play,
  Monitor
} from 'lucide-react';
import { useProducts } from '../hooks/useProducts';
import { useSales } from '../hooks/useSales';
import { useStockMovements } from '../hooks/useStockMovements';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../hooks/useSettings';
import { BarcodeScanner } from './BarcodeScanner';
import { Product, SaleItem } from '../types';

interface CartItem extends SaleItem {
  product: Product;
}

type PaymentMethod = 'dinheiro' | 'pix' | 'cartão' | 'débito';

const STANDBY_TIMEOUT = 2 * 60 * 1000; // 2 minutos

export function EnhancedPDV() {
  const { user } = useAuth();
  const { products, updateStock, findByBarcode } = useProducts();
  const { addSale } = useSales();
  const { addMovement } = useStockMovements();
  const { showNotification } = useNotifications();
  const { settings } = useSettings();

  // Estados principais
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isStandBy, setIsStandBy] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('dinheiro');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [currentTime, setCurrentTime] = useState(new Date());

  // Refs
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const standbyTimerRef = useRef<number | null>(null);

  // Atualizar relógio
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Gerenciar standby
  useEffect(() => {
    const resetStandbyTimer = () => {
      setLastActivity(Date.now());
      setIsStandBy(false);
      
      if (standbyTimerRef.current) {
        clearTimeout(standbyTimerRef.current);
      }
      
      standbyTimerRef.current = window.setTimeout(() => {
        if (cart.length === 0) {
          setIsStandBy(true);
        }
      }, STANDBY_TIMEOUT);
    };

    const handleActivity = () => {
      resetStandbyTimer();
    };

    // Eventos de atividade
    document.addEventListener('mousedown', handleActivity);
    document.addEventListener('keydown', handleActivity);
    document.addEventListener('touchstart', handleActivity);
    document.addEventListener('scroll', handleActivity);

    // Inicializar timer
    resetStandbyTimer();

    return () => {
      document.removeEventListener('mousedown', handleActivity);
      document.removeEventListener('keydown', handleActivity);
      document.removeEventListener('touchstart', handleActivity);
      document.removeEventListener('scroll', handleActivity);
      
      if (standbyTimerRef.current) {
        clearTimeout(standbyTimerRef.current);
      }
    };
  }, [cart.length]);

  // Focar no input de código de barras
  useEffect(() => {
    if (!isStandBy && !paymentModalOpen && !scannerOpen) {
      barcodeInputRef.current?.focus();
    }
  }, [isStandBy, paymentModalOpen, scannerOpen]);

  // Atalhos de teclado
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (isStandBy || paymentModalOpen || scannerOpen) return;

      switch (e.key) {
        case 'F1':
          e.preventDefault();
          clearCart();
          break;
        case 'F2':
          e.preventDefault();
          if (cart.length > 0) {
            setPaymentModalOpen(true);
          }
          break;
        case 'F3':
          e.preventDefault();
          setIsStandBy(true);
          break;
        case 'F4':
          e.preventDefault();
          setScannerOpen(true);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [cart.length, isStandBy, paymentModalOpen, scannerOpen]);

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

  const updateCartItemQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    const cartItem = cart.find(item => item.productId === productId);
    if (!cartItem) return;

    if (newQuantity > cartItem.product.stock) {
      showNotification({
        type: 'warning',
        title: 'Estoque Insuficiente',
        message: `Apenas ${cartItem.product.stock} unidades disponíveis`
      });
      return;
    }

    setCart(prevCart =>
      prevCart.map(item =>
        item.productId === productId
          ? {
              ...item,
              quantity: newQuantity,
              total: newQuantity * item.unitPrice
            }
          : item
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(prevCart => prevCart.filter(item => item.productId !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setBarcodeInput('');
    showNotification({
      type: 'info',
      title: 'Carrinho Limpo',
      message: 'Todos os itens foram removidos',
      duration: 2000
    });
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

  const calculateTotal = () => {
    return cart.reduce((total, item) => total + item.total, 0);
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

      // Notificação de sucesso
      showNotification({
        type: 'sale',
        title: '🎉 Venda Finalizada!',
        message: `Total: ${formatCurrency(calculateTotal())} - ${getPaymentMethodName(selectedPaymentMethod)}`,
        duration: 4000
      });

      // Limpar carrinho
      setCart([]);
      setPaymentModalOpen(false);
      setBarcodeInput('');

    } catch (error) {
      showNotification({
        type: 'error',
        title: 'Erro na Venda',
        message: 'Não foi possível finalizar a venda'
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
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

  const activateFromStandby = () => {
    setIsStandBy(false);
    setLastActivity(Date.now());
  };

  // Tela de Stand By
  if (isStandBy) {
    return (
      <div 
        className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center cursor-pointer"
        onClick={activateFromStandby}
      >
        <div className="text-center p-8 max-w-md mx-auto">
          <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-yellow-500/25 overflow-hidden">
            {settings.useCustomLogo && settings.logoUrl ? (
              <img 
                src={settings.logoUrl} 
                alt={settings.businessName}
                className="w-full h-full object-cover"
              />
            ) : (
              <Package className="h-12 w-12 text-black" />
            )}
          </div>
          
          <h1 className="text-4xl font-bold text-white mb-2">{settings.businessName}</h1>
          <p className="text-xl text-gray-300 mb-8">{settings.businessSubtitle}</p>
          
          <div className="text-3xl font-mono text-yellow-400 mb-2">
            {currentTime.toLocaleTimeString('pt-BR', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </div>
          <div className="text-lg text-gray-400 mb-8">
            {currentTime.toLocaleDateString('pt-BR', { 
              weekday: 'long', 
              day: 'numeric', 
              month: 'long' 
            })}
          </div>
          
          <div className="flex items-center justify-center text-green-400 mb-6">
            <div className="w-3 h-3 bg-green-400 rounded-full mr-3 animate-pulse"></div>
            <span className="text-lg">Sistema Ativo</span>
          </div>
          
          <p className="text-gray-400 mb-8">Frente de Caixa em Stand By</p>
          
          <div className="space-y-4">
            <p className="text-gray-500">Toque na tela para continuar</p>
            
            <button
              onClick={activateFromStandby}
              className="w-full bg-gradient-to-r from-yellow-400 to-yellow-600 text-black py-4 px-8 rounded-xl font-bold text-lg hover:from-yellow-500 hover:to-yellow-700 transition-all duration-200 shadow-lg shadow-yellow-500/25 flex items-center justify-center"
            >
              <Play className="h-6 w-6 mr-3" />
              Ativar Caixa
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-4 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 to-black rounded-xl border border-yellow-500/30 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center mr-4 shadow-lg shadow-yellow-500/25">
              <ShoppingCart className="h-6 w-6 text-black" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Frente de Caixa</h1>
              <p className="text-gray-400">
                {cart.length} {cart.length === 1 ? 'item' : 'itens'} • {formatCurrency(calculateTotal())}
              </p>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-2xl font-mono text-yellow-400">
              {currentTime.toLocaleTimeString('pt-BR', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </div>
            <div className="text-sm text-gray-400">
              {cart.length === 0 ? 'Stand By' : 'Ativo'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scanner e Input */}
        <div className="lg:col-span-2 space-y-6">
          {/* Scanner */}
          <div className="bg-gray-900 rounded-xl border border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
              <Scan className="h-5 w-5 mr-2 text-yellow-400" />
              Scanner de Código de Barras
            </h2>
            
            <form onSubmit={handleBarcodeSubmit} className="space-y-4">
              <div className="flex space-x-3">
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="Escaneie ou digite o código de barras"
                  className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20 transition-all duration-200"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-black px-6 py-3 rounded-lg font-medium hover:from-yellow-500 hover:to-yellow-700 transition-all duration-200 shadow-lg shadow-yellow-500/25"
                >
                  <Scan className="h-5 w-5" />
                </button>
              </div>
            </form>

            <button
              onClick={() => setScannerOpen(true)}
              className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center"
            >
              <Monitor className="h-5 w-5 mr-2" />
              Abrir Scanner Visual
            </button>
          </div>

          {/* Carrinho */}
          <div className="bg-gray-900 rounded-xl border border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white flex items-center">
                <ShoppingCart className="h-5 w-5 mr-2 text-yellow-400" />
                Carrinho de Compras
              </h2>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-red-400 hover:text-red-300 transition-colors"
                  title="Limpar carrinho (F1)"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingCart className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">Carrinho vazio</p>
                <p className="text-gray-500 text-sm">Escaneie um produto para começar</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {cart.map((item) => (
                  <div key={item.productId} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-white">{item.productName}</h3>
                        <p className="text-sm text-gray-400">
                          {formatCurrency(item.unitPrice)} cada
                        </p>
                        {item.product.stock <= item.product.minStock && (
                          <div className="flex items-center text-yellow-400 text-xs mt-1">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Estoque baixo ({item.product.stock} restantes)
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => updateCartItemQuantity(item.productId, item.quantity - 1)}
                            className="w-8 h-8 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center justify-center transition-colors"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          
                          <span className="w-12 text-center text-white font-medium">
                            {item.quantity}
                          </span>
                          
                          <button
                            onClick={() => updateCartItemQuantity(item.productId, item.quantity + 1)}
                            className="w-8 h-8 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center justify-center transition-colors"
                            disabled={item.quantity >= item.product.stock}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                        
                        <div className="text-right">
                          <p className="font-bold text-white">{formatCurrency(item.total)}</p>
                        </div>
                        
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
        </div>

        {/* Resumo e Pagamento */}
        <div className="space-y-6">
          {/* Total */}
          <div className="bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-xl p-6 text-black">
            <h2 className="text-xl font-semibold mb-2">Total da Venda</h2>
            <p className="text-3xl font-bold">{formatCurrency(calculateTotal())}</p>
            <p className="text-sm opacity-80 mt-1">
              {cart.length} {cart.length === 1 ? 'item' : 'itens'}
            </p>
          </div>

          {/* Botões de Ação */}
          <div className="space-y-3">
            <button
              onClick={() => setPaymentModalOpen(true)}
              disabled={cart.length === 0}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white py-4 px-6 rounded-xl font-bold text-lg transition-all duration-200 shadow-lg flex items-center justify-center"
              title="Finalizar venda (F2)"
            >
              <CreditCard className="h-6 w-6 mr-3" />
              Finalizar Venda
            </button>

            <button
              onClick={clearCart}
              disabled={cart.length === 0}
              className="w-full bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white py-3 px-6 rounded-xl font-medium transition-all duration-200 flex items-center justify-center"
              title="Limpar carrinho (F1)"
            >
              <Trash2 className="h-5 w-5 mr-2" />
              Limpar Carrinho
            </button>

            <button
              onClick={() => setIsStandBy(true)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-xl font-medium transition-all duration-200 flex items-center justify-center"
              title="Modo stand-by (F3)"
            >
              <Pause className="h-5 w-5 mr-2" />
              Stand By
            </button>
          </div>

          {/* Atalhos */}
          <div className="bg-gray-900 rounded-xl border border-gray-700 p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Atalhos do Teclado</h3>
            <div className="space-y-2 text-xs text-gray-500">
              <div className="flex justify-between">
                <span>F1</span>
                <span>Limpar</span>
              </div>
              <div className="flex justify-between">
                <span>F2</span>
                <span>Pagar</span>
              </div>
              <div className="flex justify-between">
                <span>F3</span>
                <span>Stand-By</span>
              </div>
              <div className="flex justify-between">
                <span>F4</span>
                <span>Scanner</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Pagamento */}
      {paymentModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl border border-gray-700 p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Finalizar Venda</h2>
              <button
                onClick={() => setPaymentModalOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-6">
              <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-lg p-4 text-black text-center">
                <p className="text-sm opacity-80">Total a Pagar</p>
                <p className="text-2xl font-bold">{formatCurrency(calculateTotal())}</p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <h3 className="text-sm font-medium text-gray-400">Forma de Pagamento</h3>
              
              {[
                { id: 'dinheiro' as PaymentMethod, name: 'Dinheiro', icon: DollarSign },
                { id: 'pix' as PaymentMethod, name: 'PIX', icon: Smartphone },
                { id: 'cartão' as PaymentMethod, name: 'Cartão de Crédito', icon: CreditCard },
                { id: 'débito' as PaymentMethod, name: 'Cartão de Débito', icon: CreditCard }
              ].map((method) => (
                <button
                  key={method.id}
                  onClick={() => setSelectedPaymentMethod(method.id)}
                  className={`w-full p-4 rounded-lg border-2 transition-all duration-200 flex items-center ${
                    selectedPaymentMethod === method.id
                      ? 'border-yellow-500 bg-yellow-500/10 text-yellow-400'
                      : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  <method.icon className="h-5 w-5 mr-3" />
                  <span className="font-medium">{method.name}</span>
                  {selectedPaymentMethod === method.id && (
                    <CheckCircle className="h-5 w-5 ml-auto" />
                  )}
                </button>
              ))}
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setPaymentModalOpen(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 px-4 rounded-lg font-medium transition-all duration-200"
              >
                Cancelar
              </button>
              <button
                onClick={finalizeSale}
                className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white py-3 px-4 rounded-lg font-medium transition-all duration-200"
              >
                Confirmar
              </button>
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