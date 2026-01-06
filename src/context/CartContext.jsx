import { createContext, useState, useContext, useEffect } from 'react';
import { toast } from 'react-toastify'; 
import { useLang } from './LangContext'; // IMPORT LANG CONTEXT

const CartContext = createContext();

export function CartProvider({ children }) {
  const { t } = useLang(); // LẤY HÀM DỊCH

  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem('cart');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

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
      
      const limit = product.allow_external_key ? 999999 : (product.maxStock || 0);
      
      if (exist) {
        if (exist.quantity + 1 > limit) {
            // SỬA: Đa ngôn ngữ thông báo
            toast.error(t(`Chỉ còn ${limit} sản phẩm trong kho!`, `Only ${limit} items left in stock!`));
            return prev;
        }
        return prev.map(item => 
          generateCartItemId(item) === cartItemId 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }

      if (1 > limit) {
          // SỬA: Đa ngôn ngữ thông báo
          toast.error(t("Sản phẩm đã hết hàng!", "Product is out of stock!"));
          return prev;
      }

      return [...prev, { ...product, quantity: 1, cartItemId }];
    });
  };

  const updateQuantity = (cartItemId, amount) => {
    setCart(prev => prev.map(item => {
      const currentId = item.cartItemId || generateCartItemId(item);
      
      if (currentId === cartItemId) {
        const newQty = item.quantity + amount;
        
        const limit = item.allow_external_key ? 999999 : (item.maxStock || 0);
        
        if (newQty > limit) {
            // SỬA: Đa ngôn ngữ thông báo
            toast.warn(t(`Kho chỉ còn ${limit} sản phẩm này.`, `Only ${limit} items of this product left.`));
            return item; 
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
