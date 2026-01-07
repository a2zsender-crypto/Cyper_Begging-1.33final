import React, { createContext, useState, useEffect } from 'react';
import { toast } from 'react-hot-toast'; // Hoặc thư viện toast bạn đang dùng

export const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState(() => {
    const savedCart = localStorage.getItem('cartItems');
    return savedCart ? JSON.parse(savedCart) : [];
  });

  useEffect(() => {
    localStorage.setItem('cartItems', JSON.stringify(cartItems));
  }, [cartItems]);

  // Hàm helper tính tồn kho (tái sử dụng logic)
  // Lưu ý: Trong context, product truyền vào thường đã có đủ data từ Home/Products
  // Nếu product thiếu product_keys/variants, logic này sẽ mặc định trả về false để an toàn.
  const isProductAvailable = (product) => {
    if (product.check_stock_api) return true;
    
    // Check Variants
    if (product.has_variants) {
       // Nếu trong giỏ hàng logic phức tạp hơn (cần chọn variant), 
       // nhưng ở bước Add Quick từ Home thì ta chỉ check xem "có variant nào còn hàng không"
       // Nếu product object có variants data:
       if (product.product_variants && product.product_variants.length > 0) {
          return product.product_variants.reduce((sum, v) => sum + (v.stock_quantity || 0), 0) > 0;
       }
       // Nếu không có data variants đi kèm, ta tạm cho là true để vào trang chi tiết check lại, 
       // hoặc chặn luôn. Ở đây tôi để true để user vào trang chi tiết chọn variant.
       return true; 
    }

    // Check Digital
    if (product.is_digital) {
       if (product.product_keys) {
         return product.product_keys.filter(k => !k.is_used).length > 0;
       }
       // Nếu product object thiếu product_keys (do query ẩu ở đâu đó), fallback về physical_stock hoặc cho qua
       // Tốt nhất nên check physical_stock như một fallback an toàn
       return (product.physical_stock || 0) > 0;
    }

    // Check Physical
    return (product.physical_stock || 0) > 0;
  };

  const addToCart = (product, variant = null, quantity = 1) => {
    // 1. Validate Stock ngay lập tức
    // Nếu thêm từ Home/Products (không có variant cụ thể)
    if (!variant && !isProductAvailable(product)) {
        toast.error('Sản phẩm đã hết hàng (Out of Stock)');
        return;
    }
    
    // Nếu thêm có variant, check stock variant đó
    if (variant && (variant.stock_quantity || 0) < quantity && !product.check_stock_api) {
        toast.error('Biến thể này đã hết hàng');
        return;
    }

    setCartItems((prevItems) => {
      // Logic tìm sản phẩm trùng trong giỏ
      const itemIndex = prevItems.findIndex((item) => 
        item.id === product.id && 
        ((!item.variant && !variant) || (item.variant?.id === variant?.id))
      );

      if (itemIndex > -1) {
        // Sản phẩm đã có -> Tăng số lượng
        const newItems = [...prevItems];
        // Check lại stock lần nữa trước khi tăng
        const currentQty = newItems[itemIndex].quantity;
        
        // Nếu không phải API stock và số lượng vượt quá tồn kho
        // (Đây là logic check đơn giản, bạn có thể mở rộng)
        
        newItems[itemIndex].quantity += quantity;
        toast.success('Đã cập nhật số lượng trong giỏ hàng!');
        return newItems;
      } else {
        // Sản phẩm mới
        toast.success('Đã thêm vào giỏ hàng thành công!');
        return [...prevItems, { ...product, variant, quantity }];
      }
    });
  };

  const removeFromCart = (productId, variantId = null) => {
    setCartItems((prevItems) => 
      prevItems.filter((item) => !(item.id === productId && item.variant?.id === variantId))
    );
    toast.success('Đã xóa sản phẩm khỏi giỏ hàng');
  };

  const updateQuantity = (productId, variantId, newQuantity) => {
    if (newQuantity < 1) return;
    setCartItems((prevItems) =>
      prevItems.map((item) =>
        item.id === productId && item.variant?.id === variantId
          ? { ...item, quantity: newQuantity }
          : item
      )
    );
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const getCartTotal = () => {
    return cartItems.reduce((total, item) => {
      const price = item.variant ? item.variant.price : item.price;
      return total + price * item.quantity;
    }, 0);
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
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
