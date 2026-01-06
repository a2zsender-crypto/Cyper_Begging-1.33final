import { createContext, useState, useContext, useEffect } from 'react';

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem('cart');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  // Hàm tạo ID duy nhất cho sản phẩm trong giỏ hàng dựa trên ID gốc và các biến thể đã chọn
  const generateCartItemId = (product) => {
    const variantKey = product.selectedVariants 
      ? JSON.stringify(product.selectedVariants) 
      : '';
    return `${product.id}-${variantKey}`;
  };

  const addToCart = (product) => {
    setCart(prev => {
      const cartItemId = generateCartItemId(product);
      
      // Tìm xem sản phẩm với CÙNG biến thể này đã có trong giỏ chưa
      const exist = prev.find(item => generateCartItemId(item) === cartItemId);
      
      if (exist) {
        return prev.map(item => 
          generateCartItemId(item) === cartItemId 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      // Lưu ý: product thêm vào phải chứa selectedVariants và price đã tính toán lại
      return [...prev, { ...product, quantity: 1, cartItemId }];
    });
  };

  const updateQuantity = (cartItemId, amount) => {
    setCart(prev => prev.map(item => {
      // So sánh dựa trên cartItemId (ID ảo kết hợp biến thể) thay vì ID gốc
      const currentId = item.cartItemId || generateCartItemId(item);
      
      if (currentId === cartItemId) {
        const newQty = item.quantity + amount;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }));
  };

  const removeFromCart = (cartItemId) => {
    setCart(prev => prev.filter(item => {
      const currentId = item.cartItemId || generateCartItemId(item);
      return currentId !== cartItemId;
    }));
  };

  const clearCart = () => setCart([]);
  
  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, clearCart, updateQuantity, totalAmount }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);