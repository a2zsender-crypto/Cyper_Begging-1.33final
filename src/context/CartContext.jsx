import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    try {
      const savedCart = localStorage.getItem('cart');
      if (savedCart) {
        setCartItems(JSON.parse(savedCart));
      }
    } catch (error) {
      console.error('Error loading cart:', error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cartItems));
  }, [cartItems]);

  // --- LOGIC TÍNH TỒN KHO ---
  const getAvailableStock = (product, selectedVariant = null) => {
    // 1. Cho phép key ngoài -> Tồn kho vô cực
    if (product.allow_external_key) return 999999;

    // 2. Sản phẩm vật lý
    if (!product.is_digital) return product.physical_stock || 0;

    // 3. Sản phẩm số (Check theo biến thể)
    if (selectedVariant) {
        if (!product.variant_stocks) return 0;
        const variantInStock = product.variant_stocks.find(v => 
            JSON.stringify(v.options) === JSON.stringify(selectedVariant)
        );
        return variantInStock ? (Number(variantInStock.stock) || 0) : 0;
    } else {
         // Check tổng
         if (product.variant_stocks && Array.isArray(product.variant_stocks)) {
            return product.variant_stocks.reduce((acc, v) => acc + (Number(v.stock) || 0), 0);
         }
         return product.physical_stock || 0;
    }
  };

  const addToCart = (product, quantity = 1, selectedVariant = null) => {
    const hasVariants = product.variants && product.variants.length > 0;
    
    // Logic bắt buộc: Có biến thể thì phải chọn mới được add
    if (hasVariants && !selectedVariant) {
        toast.error('Vui lòng chọn phân loại sản phẩm!');
        return; 
    }

    const availableStock = getAvailableStock(product, selectedVariant);
    
    const existingItemIndex = cartItems.findIndex((item) => {
        const sameId = item.id === product.id;
        const sameVariant = selectedVariant 
            ? JSON.stringify(item.selectedVariant) === JSON.stringify(selectedVariant)
            : true; 
        return sameId && sameVariant;
    });

    const currentQtyInCart = existingItemIndex > -1 ? cartItems[existingItemIndex].quantity : 0;
    
    // Check nếu vượt quá tồn kho thì báo lỗi chuẩn và RETURN ngay
    if (currentQtyInCart + quantity > availableStock) {
        toast.error(`Sản phẩm này chỉ còn ${availableStock} sản phẩm!`);
        return; 
    }

    setCartItems((prevItems) => {
      if (existingItemIndex > -1) {
        const newItems = [...prevItems];
        newItems[existingItemIndex].quantity += quantity;
        toast.success('Đã cập nhật số lượng!');
        return newItems;
      }
      toast.success('Đã thêm vào giỏ hàng!');
      return [...prevItems, { 
          ...product, 
          quantity, 
          selectedVariant, 
          cartItemId: `${product.id}-${selectedVariant ? JSON.stringify(selectedVariant) : 'default'}` 
      }];
    });
    
    setIsCartOpen(true);
  };

  const removeFromCart = (cartItemId) => {
    setCartItems((prevItems) => prevItems.filter((item) => item.cartItemId !== cartItemId));
    toast.success('Đã xóa sản phẩm khỏi giỏ hàng');
  };

  const updateQuantity = (cartItemId, newQuantity) => {
    if (newQuantity < 1) return;
    
    setCartItems((prevItems) =>
      prevItems.map((item) => {
          if (item.cartItemId === cartItemId) {
               const stock = getAvailableStock(item, item.selectedVariant);
               if (newQuantity > stock) {
                   toast.error(`Kho chỉ còn ${stock} sản phẩm!`);
                   return item;
               }
               return { ...item, quantity: newQuantity };
          }
          return item;
      })
    );
  };

  const clearCart = () => {
    setCartItems([]);
    localStorage.removeItem('cart');
  };

  const getCartTotal = () => {
    return cartItems.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getCartTotal,
        isCartOpen,
        setIsCartOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
