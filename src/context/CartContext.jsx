import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState(() => {
    const savedCart = localStorage.getItem('cart');
    return savedCart ? JSON.parse(savedCart) : [];
  });

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = (product, variant = null) => {
    // LOGIC CHECK TỒN KHO CHUẨN:
    // 1. Ưu tiên: Nếu bật get_key_via_api -> Luôn tính là còn hàng (In Stock)
    // 2. Nếu không bật API: Kiểm tra physical_stock > 0
    const isAvailable = product.get_key_via_api === true || (product.physical_stock && product.physical_stock > 0);

    if (!isAvailable) {
      toast.error('Sản phẩm này đã hết hàng!');
      return; // <--- QUAN TRỌNG: Dừng ngay, không chạy tiếp code bên dưới
    }

    setCart((prevCart) => {
      // Tạo ID duy nhất: Nếu có variant thì ID là productID-variantName, nếu không thì là productID
      const cartItemId = variant 
        ? `${product.id}-${variant.name}` 
        : `${product.id}`;

      const existingItem = prevCart.find((item) => item.cartItemId === cartItemId);

      if (existingItem) {
        // (Tùy chọn) Có thể check thêm tồn kho tại đây nếu muốn chặn số lượng > tồn kho
        // Nhưng tạm thời chỉ check ở bước đầu vào
        toast.success('Đã cập nhật số lượng trong giỏ hàng!');
        return prevCart.map((item) =>
          item.cartItemId === cartItemId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        toast.success('Đã thêm vào giỏ hàng!');
        return [
          ...prevCart,
          {
            ...product,
            cartItemId, 
            selectedVariant: variant, 
            quantity: 1,
            // Nếu có biến thể thì lấy giá biến thể, không thì giá gốc
            price: variant ? variant.price : product.price 
          },
        ];
      }
    });
  };

  const removeFromCart = (cartItemId) => {
    setCart((prevCart) => prevCart.filter((item) => item.cartItemId !== cartItemId));
    toast.success('Đã xóa sản phẩm khỏi giỏ hàng');
  };

  const updateQuantity = (cartItemId, newQuantity) => {
    if (newQuantity < 1) return;
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.cartItemId === cartItemId ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  const clearCart = () => {
    setCart([]);
    localStorage.removeItem('cart');
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => {
      const price = parseFloat(item.price) || 0;
      return total + price * item.quantity;
    }, 0);
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getCartTotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
