import { createContext, useState, useContext, useEffect } from 'react';
import { toast } from 'react-toastify'; // Thêm toast để báo lỗi đẹp hơn

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem('cart');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  // Tạo ID duy nhất cho sản phẩm trong giỏ (ID + Biến thể)
  const generateCartItemId = (product) => {
    const variantKey = product.selectedVariants 
      ? JSON.stringify(product.selectedVariants) 
      : '';
    return `${product.id}-${variantKey}`;
  };

  const addToCart = (product) => {
    setCart(prev => {
      const cartItemId = generateCartItemId(product);
      const exist = prev.find(item => generateCartItemId(item) === cartItemId);
      
      // LOGIC CHECK STOCK
      // Nếu có cho phép API -> Không giới hạn (9999). Nếu không -> Lấy maxStock truyền vào
      const limit = product.allow_external_key ? 999999 : (product.maxStock || 0);
      
      if (exist) {
        if (exist.quantity + 1 > limit) {
            toast.error(`Chỉ còn ${limit} sản phẩm trong kho!`);
            return prev;
        }
        return prev.map(item => 
          generateCartItemId(item) === cartItemId 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }

      // Check item mới
      if (1 > limit) {
          toast.error("Sản phẩm đã hết hàng!");
          return prev;
      }

      // Lưu ý: product thêm vào phải chứa selectedVariants, price và maxStock
      return [...prev, { ...product, quantity: 1, cartItemId }];
    });
  };

  const updateQuantity = (cartItemId, amount) => {
    setCart(prev => prev.map(item => {
      const currentId = item.cartItemId || generateCartItemId(item);
      
      if (currentId === cartItemId) {
        const newQty = item.quantity + amount;
        
        // LOGIC CHECK STOCK KHI TĂNG SỐ LƯỢNG
        const limit = item.allow_external_key ? 999999 : (item.maxStock || 0);
        
        if (newQty > limit) {
            toast.warn(`Kho chỉ còn ${limit} sản phẩm này.`);
            return item; // Giữ nguyên số lượng cũ
        }

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
