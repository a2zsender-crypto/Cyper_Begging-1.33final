import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { FiSearch, FiFilter, FiShoppingCart, FiCheck, FiX } from 'react-icons/fi';
import { useCart } from '../context/CartContext';
import toast from 'react-hot-toast';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const { addToCart } = useCart();
  
  const categoryFilter = searchParams.get('category') || 'all';
  const searchQuery = searchParams.get('search') || '';

  useEffect(() => {
    fetchProducts();
  }, [categoryFilter, searchQuery]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter);
      }

      if (searchQuery) {
        query = query.ilike('name', `%${searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Không thể tải danh sách sản phẩm');
    } finally {
      setLoading(false);
    }
  };

  // Logic kiểm tra tồn kho chuẩn
  const checkAvailability = (product) => {
    if (product.get_key_api) return true;
    return product.physical_stock > 0;
  };

  const handleAddToCart = (e, product) => {
    e.preventDefault();
    if (!checkAvailability(product)) {
      toast.error('Sản phẩm tạm hết hàng');
      return;
    }
    const defaultVariant = product.variant_stocks && product.variant_stocks.length > 0
      ? product.variant_stocks[0].options
      : null;
    addToCart(product, defaultVariant);
  };

  return (
    <div className="min-h-screen pt-20 pb-10 bg-gray-50">
      <div className="container mx-auto px-4">
        {/* Header & Filter */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <h1 className="text-3xl font-bold text-gray-900">Sản Phẩm</h1>
          
          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            {/* Category Filter */}
            <div className="relative">
              <select 
                value={categoryFilter}
                onChange={(e) => setSearchParams({ category: e.target.value, search: searchQuery })}
                className="appearance-none bg-white border border-gray-200 rounded-lg px-4 py-2 pr-8 focus:outline-none focus:border-blue-500 w-full sm:w-48"
              >
                <option value="all">Tất cả danh mục</option>
                <option value="software">Phần mềm</option>
                <option value="account">Tài khoản</option>
                <option value="physical">Vật lý</option>
              </select>
              <FiFilter className="absolute right-3 top-3 text-gray-400" />
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <input 
                type="text" 
                placeholder="Tìm kiếm..." 
                value={searchQuery}
                onChange={(e) => setSearchParams({ category: categoryFilter, search: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
              />
              <FiSearch className="absolute left-3 top-3 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Product Grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            Không tìm thấy sản phẩm nào phù hợp.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {products.map((product) => {
              const isAvailable = checkAvailability(product);

              return (
                <Link 
                  to={`/products/${product.id}`} 
                  key={product.id}
                  className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden group flex flex-col h-full"
                >
                  <div className="aspect-video bg-gray-100 relative overflow-hidden">
                    <img 
                      src={product.image_url || 'https://via.placeholder.com/400x225?text=No+Image'} 
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    
                    {/* Stock Status Badge */}
                    <div className="absolute top-2 right-2">
                       {isAvailable ? (
                        <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium flex items-center shadow-sm">
                          <FiCheck className="mr-1" />
                          {product.get_key_api ? 'Auto API' : 'Sẵn hàng'}
                        </span>
                      ) : (
                        <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-medium flex items-center shadow-sm">
                          <FiX className="mr-1" />
                          Hết hàng
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-4 flex flex-col flex-grow">
                    <div className="text-xs text-gray-500 mb-1 uppercase tracking-wider font-semibold">
                      {product.category === 'software' ? 'Phần mềm' : 
                       product.category === 'account' ? 'Tài khoản' : 'Vật lý'}
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2 line-clamp-2">
                      {product.name}
                    </h3>
                    <div className="mt-auto flex items-center justify-between">
                      <span className="text-blue-600 font-bold text-lg">
                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.price)}
                      </span>
                      <button 
                        onClick={(e) => handleAddToCart(e, product)}
                        disabled={!isAvailable}
                        className={`p-2 rounded-lg transition-colors ${
                          isAvailable 
                            ? 'bg-blue-100 text-blue-600 hover:bg-blue-200' 
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        <FiShoppingCart className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
