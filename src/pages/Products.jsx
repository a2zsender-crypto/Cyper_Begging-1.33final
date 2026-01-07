import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useCart } from '../context/CartContext';
import { Search, Filter, ShoppingCart, Star } from 'lucide-react';
import { useLang } from '../context/LangContext';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { addToCart } = useCart();
  const { t } = useLang();

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [searchParams]);

  const fetchCategories = async () => {
    try {
      // Lấy danh sách category unique từ bảng products
      const { data, error } = await supabase
        .from('products')
        .select('category');
      
      if (error) throw error;
      
      const uniqueCategories = [...new Set(data.map(item => item.category).filter(Boolean))];
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      let query = supabase.from('products').select('*');

      // Filter by Category
      if (selectedCategory !== 'all') {
        query = query.eq('category', selectedCategory);
      }

      // Filter by Search
      if (searchQuery) {
        query = query.ilike('name', `%${searchQuery}%`);
      }

      // Sort
      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error.message);
    } finally {
      setLoading(false);
    }
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts();
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedCategory]);

  return (
    <div className="space-y-8">
      {/* Header & Filters */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold dark:text-white">{t('allProducts')}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              {products.length} {t('productsAvailable')}
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder={t('searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-64 pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-white"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>

            {/* Category Filter */}
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full sm:w-48 pl-10 pr-8 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all appearance-none cursor-pointer dark:text-white"
              >
                <option value="all">{t('allCategories')}</option>
                {categories.map((cat, index) => (
                  <option key={index} value={cat}>{cat}</option>
                ))}
              </select>
              <Filter className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-lg animate-pulse">
              <div className="w-full h-48 bg-gray-200 dark:bg-gray-700 rounded-xl mb-4" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : products.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product) => {
            // LOGIC TÍNH TOÁN STOCK CHÍNH XÁC (Đồng nhất với Home)
            const isAvailable = product.get_key_via_api === true || (product.physical_stock > 0);

            return (
              <div key={product.id} className="group bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col">
                <Link to={`/products/${product.id}`} className="relative block aspect-[4/3] overflow-hidden">
                  <img
                    src={product.image_url || 'https://via.placeholder.com/400x300?text=No+Image'}
                    alt={product.name}
                    className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                  />
                  {/* Badge Stock */}
                  {!isAvailable && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                        {t('outOfStock')}
                      </span>
                    </div>
                  )}
                  {isAvailable && (
                     <div className="absolute top-3 right-3 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">
                       {t('inStock')}
                     </div>
                  )}
                </Link>
                
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                     <div className="flex items-center space-x-1">
                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                        <span className="text-sm text-gray-500 dark:text-gray-400">4.9</span>
                     </div>
                     <span className="text-xs px-2 py-1 bg-blue-100 text-blue-600 rounded-full font-medium dark:bg-blue-900/30 dark:text-blue-400">
                        {product.category || 'Digital'}
                     </span>
                  </div>
                  
                  <Link to={`/products/${product.id}`} className="block mb-2">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white line-clamp-2 hover:text-blue-600 transition-colors">
                      {product.name}
                    </h3>
                  </Link>
                  
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-4 flex-1">
                    {product.description}
                  </p>
                  
                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100 dark:border-gray-700">
                    <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                      {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.price)}
                    </span>
                    
                    <button
                      onClick={() => addToCart(product)}
                      disabled={!isAvailable}
                      className={`p-2 rounded-xl transition-colors ${
                        isAvailable
                          ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-blue-600 hover:text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                      }`}
                      title={isAvailable ? t('addToCart') : t('outOfStock')}
                    >
                      <ShoppingCart className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{t('noProductsFound')}</h3>
          <p className="text-gray-500 dark:text-gray-400">{t('tryDifferentSearch')}</p>
        </div>
      )}
    </div>
  );
};

export default Products;
