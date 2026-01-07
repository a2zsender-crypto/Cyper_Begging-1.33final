import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState(() => {
    const savedCart = localStorage.getItem('cart');
    return savedCart ? JSON.parse(savedCart) : [];
  });
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  // Hàm kiểm tra tồn kho (Logic mới: Sử dụng RPC hoặc check field có sẵn)
  const checkStock = async (product, variant = null) => {
    try {
      // Nếu là sản phẩm Get Key API -> Luôn có hàng
      if (product.get_key_api) return true;

      // Nếu là sản phẩm vật lý -> Check physical_stock có sẵn (đã được trigger SQL cập nhật)
      if (!product.is_digital) {
        if (variant) {
           // Tìm stock của variant trong mảng variant_stocks
           const variantItem = product.variant_stocks?.find(v => v.options.value === variant.value);
           return variantItem ? variantItem.stock > 0 : false;
        }
        return product.physical_stock > 0;
      }

      // Nếu là sản phẩm Digital -> Gọi hàm RPC an toàn (thay vì query bảng keys)
      const { data: stockCount, error } = await supabase
        .rpc('get_available_stock', { 
          p_product_id: product.id,
          p_variant_name: variant ? variant.value : ''
        });

      if (error) {
        console.error('Stock check error:', error);
        return false;
      }

      return stockCount > 0;
    } catch (error) {
      console.error('Check stock error:', error);
      return false;
    }
  };

  const addToCart = async (product, variant = null) => {
    // 1. Kiểm tra tồn kho trước khi thêm
    const isAvailable = await checkStock(product, variant);
    
    if (!isAvailable) {
      toast.error('Sản phẩm đã hết hàng hoặc không đủ số lượng!');
      return;
    }

    setCart(prev => {
      // Tạo ID duy nhất cho item trong giỏ (kết hợp ID sp và variant)
      const cartItemId = variant 
        ? `${product.id}-${variant.value}`
        : `${product.id}`;

      const existingItem = prev.find(item => item.cartItemId === cartItemId);

      if (existingItem) {
        toast.success('Đã cập nhật số lượng trong giỏ!');
        return prev.map(item =>
          item.cartItemId === cartItemId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      toast.success('Đã thêm vào giỏ hàng!');
      return [...prev, {
        ...product,
        cartItemId,
        selectedVariant: variant,
        quantity: 1
      }];
    });
    
    setIsOpen(true);
  };

  const removeFromCart = (cartItemId) => {
    setCart(prev => prev.filter(item => item.cartItemId !== cartItemId));
    toast.success('Đã xóa sản phẩm khỏi giỏ!');
  };

  const updateQuantity = (cartItemId, newQuantity) => {
    if (newQuantity < 1) return;
    setCart(prev => prev.map(item => 
      item.cartItemId === cartItemId 
        ? { ...item, quantity: newQuantity }
        : item
    ));
  };

  const clearCart = () => {
    setCart([]);
    localStorage.removeItem('cart');
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => {
      const price = item.selectedVariant 
        ? parseInt(item.selectedVariant.value.replace(/\D/g, ''))
        : item.price;
      return total + (price * item.quantity);
    }, 0);
  };

  return (
    <CartContext.Provider value={{
      cart,
      isOpen,
      setIsOpen,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      getCartTotal
    }}>
      {children}
    </CartContext.Provider>
  );
};
