import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

export const CartContext = createContext();

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedCart = localStorage.getItem('cart');
    if (storedCart) {
      setCart(JSON.parse(storedCart));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  // --- HÀM TÍNH STOCK CHUẨN (Dùng chung logic này) ---
  const calculateStock = (product) => {
    // 1. Nếu bật chế độ lấy Key qua API -> Luôn coi là max tồn kho
    if (product.check_stock_on_api) {
      return 999999; 
    }

    // 2. Nếu có biến thể -> Cộng tổng tồn kho các biến thể
    if (product.variants && Array.isArray(product.variants) && product.variants.length > 0) {
      return product.variants.reduce((total, v) => {
        // Ưu tiên physical_stock, fallback sang stock hoặc quantity nếu cấu trúc data khác
        const vStock = v.physical_stock ?? v.stock ?? v.quantity ?? 0;
        return total + Number(vStock);
      }, 0);
    }

    // 3. Mặc định: Trả về tồn kho vật lý của sản phẩm cha
    return Number(product.physical_stock) || 0;
  };

  const addToCart = (product, quantity = 1, variant = null) => {
    // Tính toán tồn kho thực tế khả dụng
    let availableStock = 0;

    if (variant) {
      // Nếu chọn biến thể cụ thể, chỉ check stock của biến thể đó
      // Trừ khi là hàng API (check_stock_on_api của cha hoặc variant)
      const isApi = product.check_stock_on_api || variant.check_stock_on_api;
      availableStock = isApi ? 999999 : (variant.physical_stock ?? variant.stock ?? 0);
    } else {
      // Nếu add sản phẩm cha (hoặc sp không có biến thể), dùng hàm tính tổng
      availableStock = calculateStock(product);
    }

    setCart((prevCart) => {
      // Tìm xem sản phẩm (hoặc biến thể) đã có trong giỏ chưa
      const existingItemIndex = prevCart.findIndex((item) => {
        const isSameId = item.id === product.id;
        const isSameVariant = variant ? item.variant?.id === variant.id : !item.variant;
        return isSameId && isSameVariant;
      });

      if (existingItemIndex > -1) {
        // Sản phẩm đã có -> Tăng số lượng
        const currentQty = prevCart[existingItemIndex].quantity;
        const newQty = currentQty + quantity;

        if (newQty > availableStock) {
          toast.error(`Sản phẩm này chỉ còn ${availableStock} đơn vị!`);
          return prevCart; // Không thay đổi gì
        }

        const newCart = [...prevCart];
        newCart[existingItemIndex].quantity = newQty;
        toast.success("Đã cập nhật số lượng trong giỏ hàng!");
        return newCart;
      } else {
        // Sản phẩm chưa có -> Thêm mới
        if (quantity > availableStock) {
          toast.error("Sản phẩm đã hết hàng hoặc không đủ số lượng!");
          return prevCart;
        }

        toast.success("Đã thêm vào giỏ hàng!");
        return [...prevCart, { ...product, quantity, variant }];
      }
    });
  };

  const removeFromCart = (productId, variantId = null) => {
    setCart((prevCart) =>
      prevCart.filter((item) => {
        if (variantId) {
          return !(item.id === productId && item.variant?.id === variantId);
        }
        return item.id !== productId;
      })
    );
    toast.success("Đã xóa sản phẩm khỏi giỏ!");
  };

  const updateQuantity = (productId, amount, variantId = null) => {
    setCart((prevCart) => {
      return prevCart.map((item) => {
        if (item.id === productId && (variantId ? item.variant?.id === variantId : !item.variant)) {
           // Cần check stock lại ở đây nếu muốn chặt chẽ (optional)
           // Tạm thời chỉ chặn < 1
           const newQty = Math.max(1, item.quantity + amount);
           return { ...item, quantity: newQty };
        }
        return item;
      });
    });
  };

  const clearCart = () => {
    setCart([]);
    localStorage.removeItem('cart');
  };

  const cartTotal = cart.reduce((total, item) => {
    const price = item.variant ? (item.variant.price || item.price) : item.price;
    return total + price * item.quantity;
  }, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        cartTotal,
        loading,
        calculateStock // Export hàm này để các trang khác dùng nếu cần hiển thị
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
