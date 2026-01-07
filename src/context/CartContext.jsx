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

  // --- LOGIC KIỂM TRA TỒN KHO MỚI ---
  const checkAvailability = (product, selectedVariant = null) => {
    // 1. Hàng lấy key ngoài -> Luôn có hàng
    if (product.allow_external_key) return 9999;

    // 2. Hàng Vật lý -> Check physical_stock
    if (!product.is_digital) {
      return product.physical_stock || 0;
    }

    // 3. Hàng Số -> Check theo biến thể (nếu có)
    if (selectedVariant && product.variant_stocks) {
        const variantStock = product.variant_stocks.find(v => 
            JSON.stringify(v.options) === JSON.stringify(selectedVariant)
        );
        return variantStock ? (Number(variantStock.stock) || 0) : 0;
    }

    // Nếu không chọn biến thể (add từ trang chủ), tính tổng
    if (product.variant_stocks && Array.isArray(product.variant_stocks)) {
         return product.variant_stocks.reduce((acc, v) => acc + (Number(v.stock) || 0), 0);
    }

    return 0;
  };

  const addToCart = (product, quantity = 1, selectedVariant = null) => {
    const hasVariants = product.variants && product.variants.length > 0;
    
    // Nếu SP có biến thể mà chưa chọn -> Báo lỗi
    if (hasVariants && !selectedVariant) {
        toast.error('Please select product options first!');
        return; 
    }

    // Check tồn kho
    const available = checkAvailability(product, selectedVariant);
    
    const existingItemIndex = cartItems.findIndex((item) => {
        const sameId = item.id === product.id;
        const sameVariant = selectedVariant 
            ? JSON.stringify(item.selectedVariant) === JSON.stringify(selectedVariant)
            : true;
        return sameId && sameVariant;
    });

    const currentQty = existingItemIndex > -1 ? cartItems[existingItemIndex].quantity : 0;

    // Chặn nếu quá số lượng
    if (currentQty + quantity > available) {
        toast.error('Product is out of stock!');
        return; 
    }

    setCartItems((prevItems) => {
      if (existingItemIndex > -1) {
        const newItems = [...prevItems];
        newItems[existingItemIndex].quantity += quantity;
        toast.success('Updated cart quantity!');
        return newItems;
      }
      
      toast.success('Added to cart!');
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
    toast.success('Removed from cart');
  };

  const updateQuantity = (cartItemId, newQuantity) => {
    if (newQuantity < 1) return;
    setCartItems((prevItems) =>
      prevItems.map((item) =>
        item.cartItemId === cartItemId ? { ...item, quantity: newQuantity } : item
      )
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
