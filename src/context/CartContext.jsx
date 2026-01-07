import { createContext, useState, useContext, useEffect } from 'react';
import { toast } from 'react-toastify'; 
import { useLang } from './LangContext'; 

const CartContext = createContext();

export function CartProvider({ children }) {
  const { t } = useLang(); 

  const [cart, setCart] = useState(() => {
    try {
        const saved = localStorage.getItem('cart');
        return saved ? JSON.parse(saved) : [];
    } catch (e) {
        return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  // Tạo ID duy nhất cho sản phẩm + biến thể
  const generateCartItemId = (product) => {
    const variantKey = product.selectedVariants 
      ? JSON.stringify(product.selectedVariants) 
      : '';
    return `${product.id}-${variantKey}`;
  };

  // --- HÀM TÍNH TỒN KHO NỘI BỘ ---
  const getProductStockLimit = (product) => {
    // 1. Nếu cho phép lấy key ngoài -> Vô cực
    if (product.allow_external_key) return 999999;

    // 2. Nếu đã được truyền maxStock từ bên ngoài (từ Products.jsx) thì dùng luôn
    if (product.maxStock !== undefined && product.maxStock !== null) return product.maxStock;

    // 3. Nếu không, tự tính lại dựa trên dữ liệu raw
    if (!product.is_digital) return product.physical_stock || 0;
    
    // Logic cho hàng digital có biến thể
    if (product.variant_stocks && Array.isArray(product.variant_stocks)) {
        // Nếu đã chọn biến thể
        if (product.selectedVariants) {
             const vStock = product.variant_stocks.find(v => JSON.stringify(v.options) === JSON.stringify(product.selectedVariants));
             return vStock ? (Number(vStock.stock) || 0) : 0;
        }
        // Nếu chưa chọn biến thể (add generic)
        return product.variant_stocks.reduce((acc, v) => acc + (Number(v.stock) || 0), 0);
    }
    
    return 0; // Mặc định hết hàng
  };

  const addToCart = (product) => {
    const cartItemId = generateCartItemId(product);
    
    setCart(prev => {
      // Tìm theo cartItemId để chính xác với biến thể
      const exist = prev.find(item => (item.cartItemId || generateCartItemId(item)) === cartItemId);
      
      // Tính tồn kho thực tế
      const limit = getProductStockLimit(product);
      
      if (exist) {
        // Kiểm tra xem cộng thêm 1 có vượt quá giới hạn không
        if (exist.quantity + 1 > limit) {
            toast.error(t(`Chỉ còn ${limit} sản phẩm trong kho!`, `Only ${limit} items left in stock!`));
            return prev; // Trả về cart cũ, KHÔNG cộng thêm
        }
        
        toast.success(t('Đã cập nhật số lượng!', 'Quantity updated!'));
        return prev.map(item => 
          (item.cartItemId || generateCartItemId(item)) === cartItemId 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }

      // Thêm mới
      if (limit < 1) {
          toast.error(t('Sản phẩm đã hết hàng!', 'Product is out of stock!'));
          return prev;
      }

      toast.success(t('Đã thêm vào giỏ!', 'Added to cart!'));
      // Lưu luôn cartItemId vào item để dễ truy xuất sau này
      // Lưu ý: maxStock được truyền vào item để dùng cho updateQuantity
      return [...prev, { ...product, quantity: 1, cartItemId, maxStock: limit }];
    });
  };

  // SỬA: Nhận 'quantity' là số lượng mới mong muốn (absolute value), không phải delta
  const updateQuantity = (cartItemId, quantity) => {
    setCart(prev => prev.map(item => {
      const currentId = item.cartItemId || generateCartItemId(item);
      
      if (currentId === cartItemId) {
        // Tính lại limit để chắc chắn (ưu tiên maxStock đã lưu, hoặc tính lại)
        const limit = getProductStockLimit(item);
        
        if (quantity > limit) {
            toast.warn(t(`Kho chỉ còn ${limit} sản phẩm này.`, `Only ${limit} items of this product left.`));
            // Trả về item cũ, không update
            return item; 
        }

        // Cập nhật số lượng mới (nếu > 0)
        return quantity > 0 ? { ...item, quantity: quantity } : item;
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
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart, totalAmount }}>
      {children}
    </CartContext.Provider>
  );
}
