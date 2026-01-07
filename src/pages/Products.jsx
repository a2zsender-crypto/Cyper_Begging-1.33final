import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useLang } from '../context/LangContext';
import { toast } from 'react-hot-toast';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  const { addToCart } = useCart();
  const { t, language } = useLang();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      // Lấy thêm các trường variants và variant_stocks để tính tồn kho
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);

      // Tách category từ variants (nếu bạn dùng logic category cũ)
      // Hoặc nếu chưa có bảng category riêng thì tạm thời để logic lọc cơ bản
      const uniqueCats = ['All', ...new Set(data.map(p => p.category || 'Other'))];
      // Nếu không có cột category trong bảng products thì đoạn trên có thể bỏ qua hoặc sửa lại
      // Ở đây tôi giả định chưa có cột category, chỉ hiển thị All
      setCategories(['All']); 
      
    } catch (error) {
      console.error('Error fetching products:', error.message);
      toast.error(t('error_fetching_products'));
    } finally {
      setLoading(false);
    }
  };

  // --- HÀM TÍNH TỒN KHO CHUẨN XÁC ---
  const getProductStockStatus = (product) => {
    // 1. Nếu cho phép lấy key qua API (Auto Restock) -> Luôn coi là CÒN HÀNG (vô tận)
    if (product.allow_external_key) {
      return { totalStock: 9999, inStock: true };
    }

    let totalStock = 0;

    // 2. Tính tổng tồn kho từ các biến thể (nếu có)
    // variant_stocks cấu trúc: [{ options: {...}, stock: 10 }, ...]
    if (product.variants && product.variants.length > 0 && product.variant_stocks) {
      let vStocks = product.variant_stocks;
      // Parse JSON nếu nó bị trả về dạng chuỗi (đề phòng)
      if (typeof vStocks === 'string') {
        try { vStocks = JSON.parse(vStocks); } catch (e) { vStocks = []; }
      }
      
      if (Array.isArray(vStocks)) {
        totalStock = vStocks.reduce((sum, item) => sum + (Number(item.stock) || 0), 0);
      }
    } 
    // 3. Nếu không có biến thể, lấy physical_stock gốc
    else {
      totalStock = Number(product.physical_stock) || 0;
    }

    return { 
      totalStock, 
      inStock: totalStock > 0 
    };
  };

  // Xử lý thêm vào giỏ hàng ngay tại trang danh sách
  const handleAddToCart = (e, product) => {
    e.preventDefault(); // Ngăn chặn nhảy vào trang chi tiết
    e.stopPropagation();

    const { inStock } = getProductStockStatus(product);

    // KIỂM TRA TỒN KHO NGHIÊM NGẶT
    if (!inStock) {
      toast.error(language === 'vi' ? 'Sản phẩm đã hết hàng!' : 'Product out of stock!');
      return; // Dừng ngay, không gọi addToCart
    }

    // Nếu có biến thể, ta cần redirect người dùng vào trang chi tiết để chọn biến thể
    // Thay vì add thẳng (vì chưa biết chọn màu nào, size nào)
    if (product.variants && product.variants.length > 0) {
      toast(language === 'vi' ? 'Vui lòng chọn phân loại!' : 'Please select options!', {
        icon: '👆',
      });
      // Logic điều hướng sẽ do thẻ Link bao ngoài xử lý, 
      // nhưng ở đây ta return để không add item "trống option" vào giỏ.
      return;
    }

    // Nếu là sp đơn giản (không biến thể) và còn hàng -> Add luôn
    addToCart(product);
    // Lưu ý: Nếu CartContext đã có toast success thì dòng dưới có thể bỏ để đỡ bị duplicate toast
    // toast.success(t('added_to_cart')); 
  };

  const filteredProducts = selectedCategory === 'All' 
    ? products 
    : products.filter(p => p.category === selectedCategory);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header & Filter */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-4 md:mb-0">
          {language === 'vi' ? 'Sản phẩm mới' : 'Latest Products'}
        </h1>
        
        {/* Nếu bạn có category thì hiển thị, không thì ẩn hoặc giữ nguyên logic lọc */}
        {categories.length > 1 && (
          <div className="flex space-x-2 overflow-x-auto pb-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Product Grid */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">
            {language === 'vi' ? 'Chưa có sản phẩm nào.' : 'No products found.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredProducts.map((product) => {
            const { inStock, totalStock } = getProductStockStatus(product);
            const hasVariants = product.variants && product.variants.length > 0;

            return (
              <Link 
                to={`/products/${product.id}`} 
                key={product.id}
                className="group bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden border border-gray-100 flex flex-col"
              >
                {/* Image Container */}
                <div className="relative aspect-square overflow-hidden bg-gray-50">
                  {product.images && product.images.length > 0 ? (
                    <img
                      src={product.images[0]}
                      alt={product.title}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  
                  {/* Badges */}
                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                    {product.is_digital && (
                      <span className="bg-blue-500/90 backdrop-blur-sm text-white text-xs px-2 py-1 rounded">
                        Digital
                      </span>
                    )}
                    {!inStock && (
                      <span className="bg-red-500/90 backdrop-blur-sm text-white text-xs px-2 py-1 rounded">
                        {language === 'vi' ? 'Hết hàng' : 'Out of Stock'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 flex flex-col flex-grow">
                  <h3 className="font-semibold text-gray-800 mb-1 line-clamp-2 group-hover:text-blue-600 transition-colors">
                    {language === 'vi' ? product.title : (product.title_en || product.title)}
                  </h3>
                  
                  {/* Stock Status Text */}
                  <div className="text-xs mb-3">
                     {inStock ? (
                        <span className="text-green-600 flex items-center">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5"></span>
                          {product.allow_external_key 
                            ? (language === 'vi' ? 'Luôn sẵn hàng (Auto)' : 'Always Available') 
                            : (language === 'vi' ? `Còn ${totalStock} sản phẩm` : `${totalStock} in stock`)}
                        </span>
                     ) : (
                        <span className="text-red-500 flex items-center">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5"></span>
                          {language === 'vi' ? 'Tạm hết hàng' : 'Out of Stock'}
                        </span>
                     )}
                  </div>

                  <div className="mt-auto flex items-center justify-between">
                    <span className="text-lg font-bold text-blue-600">
                      ${Number(product.price).toLocaleString()}
                    </span>
                    
                    {/* Add to Cart Button */}
                    <button
                      onClick={(e) => handleAddToCart(e, product)}
                      disabled={!inStock}
                      className={`p-2 rounded-lg transition-colors ${
                        inStock
                          ? 'bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                      title={inStock ? t('add_to_cart') : t('out_of_stock')}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Products;
