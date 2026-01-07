import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Load giỏ hàng an toàn, tránh lỗi parse JSON gây trắng trang
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem('cart');
      if (savedCart) {
        setCartItems(JSON.parse(savedCart));
      }
    } catch (error) {
      console.error('Lỗi tải giỏ hàng:', error);
      // Nếu lỗi file lưu cũ, reset lại để web chạy được
      localStorage.removeItem('cart');
      setCartItems([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cartItems));
  }, [cartItems]);

  // --- HÀM KIỂM TRA TỒN KHO (LOGIC CHUẨN) ---
  const getAvailableStock = (product, selectedVariant = null) => {
    // 1. Nếu cho phép lấy key ngoài (API) -> Luôn còn hàng
    if (product.allow_external_key) return 999999;

    // 2. Nếu là sản phẩm vật lý -> Lấy kho vật lý
    if (product.is_digital === false) {
      return product.physical_stock || 0;
    }

    // 3. Nếu là sản phẩm số (Digital)
    // Trường hợp A: Đã chọn biến thể (khi mua ở trang chi tiết)
    if (selectedVariant && product.variant_stocks) {
        // Tìm kho của đúng biến thể đó
        const variantStock = product.variant_stocks.find(v => 
            JSON.stringify(v.options) === JSON.stringify(selectedVariant)
        );
        return variantStock ? (Number(variantStock.stock) || 0) : 0;
    }

    // Trường hợp B: Chưa chọn biến thể (hiển thị ở trang chủ/danh sách)
    // Cộng tổng tất cả các biến thể lại
    if (product.variant_stocks && Array.isArray(product.variant_stocks)) {
         const totalVariantStock = product.variant_stocks.reduce((acc, v) => acc + (Number(v.stock) || 0), 0);
         // Nếu tổng > 0 thì trả về, nếu không check tiếp physical_stock (fallback)
         if (totalVariantStock > 0) return totalVariantStock;
    }

    // Fallback cuối cùng: Trả về physical_stock hoặc 0
    return product.physical_stock || 0;
  };

  const addToCart = (product, quantity = 1, selectedVariant = null) => {
    // Kiểm tra biến thể: Nếu SP có biến thể mà chưa chọn -> Báo lỗi
    const hasVariants = product.variants && product.variants.length > 0;
    if (hasVariants && !selectedVariant) {
        toast.error('Vui lòng chọn phân loại sản phẩm!');
        return;
    }

    // Kiểm tra tồn kho
    const availableStock = getAvailableStock(product, selectedVariant);
    
    // Tìm sản phẩm trong giỏ (so sánh cả ID và Biến thể)
    const existingItemIndex = cartItems.findIndex((item) => {
        const sameId = item.id === product.id;
        const sameVariant = selectedVariant 
            ? JSON.stringify(item.selectedVariant) === JSON.stringify(selectedVariant)
            : !item.selectedVariant; // Nếu không có variant thì so sánh item cũng không có variant
        return sameId && sameVariant;
    });

    const currentQtyInCart = existingItemIndex > -1 ? cartItems[existingItemIndex].quantity : 0;

    // Chặn nếu vượt quá tồn kho
    if (currentQtyInCart + quantity > availableStock) {
        toast.error('Sản phẩm đã hết hàng hoặc không đủ số lượng!');
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
          // Tạo ID duy nhất cho item trong giỏ để không bị trùng lặp
          cartItemId: `${product.id}-${selectedVariant ? JSON.stringify(selectedVariant) : 'default'}` 
      }];
    });
    
    setIsCartOpen(true);
  };

  const removeFromCart = (cartItemId) => {
    setCartItems((prevItems) => prevItems.filter((item) => item.cartItemId !== cartItemId));
    toast.success('Đã xóa khỏi giỏ hàng');
  };

  const updateQuantity = (cartItemId, newQuantity) => {
    if (newQuantity < 1) return;
    
    setCartItems((prevItems) =>
      prevItems.map((item) => {
        if (item.cartItemId === cartItemId) {
             // Check lại tồn kho khi tăng số lượng trong giỏ
             const stock = getAvailableStock(item, item.selectedVariant);
             if (newQuantity > stock) {
                 toast.error('Không đủ hàng trong kho!');
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
