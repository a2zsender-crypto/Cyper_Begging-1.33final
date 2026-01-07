import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Load cart from localStorage on mount
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

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cartItems));
  }, [cartItems]);

  // --- HÀM CHECK TỒN KHO ---
  const getAvailableStock = (product, selectedVariant = null) => {
    // 1. Nếu cho phép lấy key ngoài -> Vô cực
    if (product.allow_external_key) return 999999;

    // 2. Nếu là hàng vật lý -> Check physical_stock
    if (!product.is_digital) {
      return product.physical_stock || 0;
    }

    // 3. Nếu là hàng số (Digital)
    if (selectedVariant) {
        // Nếu đã chọn biến thể -> Tìm stock của đúng biến thể đó trong variant_stocks
        // Cấu trúc variant_stocks: [{options: {"Màu": "Đỏ"}, stock: 10}, ...]
        // selectedVariant structure: {"Màu": "Đỏ"}
        
        if (!product.variant_stocks) return 0;

        // Tìm variant trong kho khớp với variant khách chọn
        const variantInStock = product.variant_stocks.find(v => 
            JSON.stringify(v.options) === JSON.stringify(selectedVariant)
        );
        
        return variantInStock ? (Number(variantInStock.stock) || 0) : 0;
    } else {
        // Nếu chưa chọn biến thể (Add từ trang chủ) -> Check tổng
         if (product.variant_stocks && Array.isArray(product.variant_stocks)) {
            return product.variant_stocks.reduce((acc, v) => acc + (Number(v.stock) || 0), 0);
         }
         return product.physical_stock || 0;
    }
  };

  const addToCart = (product, quantity = 1, selectedVariant = null) => {
    // 1. Kiểm tra biến thể
    const hasVariants = product.variants && product.variants.length > 0;
    
    // Nếu SP có biến thể mà người dùng chưa chọn (thường là bấm từ trang chủ)
    if (hasVariants && !selectedVariant) {
        toast.error('Vui lòng chọn phân loại sản phẩm!');
        // Mẹo: Ở đây bạn có thể redirect user sang trang detail nếu muốn
        // window.location.href = `/products/${product.id}`;
        return; // Dừng lại ngay, không add
    }

    // 2. Kiểm tra tồn kho
    const availableStock = getAvailableStock(product, selectedVariant);
    
    // Tìm xem SP đã có trong giỏ chưa để cộng dồn số lượng hiện tại
    const existingItemIndex = cartItems.findIndex((item) => {
        const sameId = item.id === product.id;
        // Nếu có biến thể thì phải so sánh cả biến thể
        const sameVariant = selectedVariant 
            ? JSON.stringify(item.selectedVariant) === JSON.stringify(selectedVariant)
            : true; 
        return sameId && sameVariant;
    });

    const currentQtyInCart = existingItemIndex > -1 ? cartItems[existingItemIndex].quantity : 0;
    
    // Nếu mua thêm quantity mới mà vượt quá tồn kho -> Chặn
    if (currentQtyInCart + quantity > availableStock) {
        toast.error(`Sản phẩm này chỉ còn ${availableStock} sản phẩm!`);
        return; // <--- RETURN QUAN TRỌNG: Dừng hàm ngay lập tức
    }

    // 3. Thực hiện thêm vào giỏ
    setCartItems((prevItems) => {
      // Nếu đã có -> Update số lượng
      if (existingItemIndex > -1) {
        const newItems = [...prevItems];
        newItems[existingItemIndex].quantity += quantity;
        toast.success('Đã cập nhật số lượng trong giỏ!');
        return newItems;
      }
      
      // Nếu chưa có -> Thêm mới
      toast.success('Đã thêm vào giỏ hàng!');
      return [...prevItems, { 
          ...product, 
          quantity, 
          selectedVariant, // Lưu biến thể khách chọn
          // Tạo một ID duy nhất cho cart item (để phân biệt cùng SP nhưng khác màu)
          cartItemId: `${product.id}-${selectedVariant ? JSON.stringify(selectedVariant) : 'default'}` 
      }];
    });
    
    setIsCartOpen(true); // Mở giỏ hàng cho khách thấy
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
               // Check tồn kho lại lần nữa cho chắc
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
