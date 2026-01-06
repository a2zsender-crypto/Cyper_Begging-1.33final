import { createContext, useState, useContext, useEffect } from 'react';
import { toast } from 'react-toastify'; 
import { useLang } from './LangContext'; 

const CartContext = createContext();

export function CartProvider({ children }) {
  const { t } = useLang(); 

  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem('cart');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  // Tạo ID duy nhất cho sản phẩm + biến thể
  const generateCartItemId = (product) => {
    const variantKey = product.selectedVariants 
      ? JSON.stringify(product.selectedVariants) 
      : '';
    return `${product.id}-${variantKey}`;
  };

  const addToCart = (product) => {
    setCart(prev => {
      const cartItemId = generateCartItemId(product);
      // Tìm theo cartItemId để chính xác với biến thể
      const exist = prev.find(item => (item.cartItemId || generateCartItemId(item)) === cartItemId);
      
      const limit = product.allow_external_key ? 999999 : (product.maxStock || 0);
      
      if (exist) {
        if (exist.quantity + 1 > limit) {
            toast.error(t(`Chỉ còn ${limit} sản phẩm trong kho!`, `Only ${limit} items left in stock!`));
            return prev;
        }
        return prev.map(item => 
          (item.cartItemId || generateCartItemId(item)) === cartItemId 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }

      if (1 > limit) {
          toast.error(t("Sản phẩm đã hết hàng!", "Product is out of stock!"));
          return prev;
      }

      // Lưu luôn cartItemId vào item để dễ truy xuất sau này
      return [...prev, { ...product, quantity: 1, cartItemId }];
    });
  };

  // SỬA: Nhận 'quantity' là số lượng mới mong muốn (absolute value), không phải delta
  const updateQuantity = (cartItemId, quantity) => {
    setCart(prev => prev.map(item => {
      const currentId = item.cartItemId || generateCartItemId(item);
      
      if (currentId === cartItemId) {
        // Kiểm tra tồn kho
        const limit = item.allow_external_key ? 999999 : (item.maxStock || 0);
        
        if (quantity > limit) {
            toast.warn(t(`Kho chỉ còn ${limit} sản phẩm này.`, `Only ${limit} items of this product left.`));
            // Trả về item cũ, không update
            return item; 
        }

        // Cập nhật số lượng mới (nếu > 0)
        return quantity > 0 ? { ...item, quantity: quantity } : item;
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
