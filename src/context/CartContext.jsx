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
    // LOGIC KIỂM TRA TỒN KHO MỚI
    // 1. Nếu sp cho phép lấy key qua API khi hết hàng -> Luôn cho phép mua (In Stock)
    // 2. Nếu không, kiểm tra physical_stock (tổng tồn kho)
    // 3. Nếu có biến thể, physical_stock là tổng của các biến thể, nên logic này vẫn đúng ở mức Product. 
    //    Tuy nhiên, nếu chọn variant cụ thể, cần check tồn kho của variant đó (nếu logic FE có lưu variant_stocks).
    //    Ở đây ta check mức độ sản phẩm cơ bản trước.

    const isAvailable = product.get_key_via_api === true || (product.physical_stock && product.physical_stock > 0);

    if (!isAvailable) {
      toast.error('Sản phẩm đã hết hàng!');
      return; // QUAN TRỌNG: Dừng hàm ngay lập tức, không chạy tiếp code bên dưới
    }

    setCart((prevCart) => {
      // Tạo ID duy nhất cho item trong giỏ: ProductID + VariantName (nếu có)
      const cartItemId = variant 
        ? `${product.id}-${variant.name}` 
        : `${product.id}`;

      const existingItem = prevCart.find((item) => item.cartItemId === cartItemId);

      if (existingItem) {
        // Kiểm tra tồn kho khi tăng số lượng (tùy chọn, ở đây tạm bỏ qua để đơn giản hoặc check tiếp)
        // Nếu muốn chặt chẽ: if (!product.get_key_via_api && existingItem.quantity >= product.physical_stock) ...

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
            cartItemId, // Lưu ID định danh
            selectedVariant: variant, // Lưu thông tin variant đã chọn
            quantity: 1,
            // Giá có thể thay đổi theo variant, đảm bảo lấy đúng giá
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
      // Giá item đã được xử lý khi add to cart (variant price hoặc product price)
      // Cần đảm bảo item.price là số
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
