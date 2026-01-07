import React, { useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';
import Layout from '../components/Layout';
import { Link } from 'react-router-dom';
import { CartContext } from '../context/CartContext';
import { FaShoppingCart, FaFilter, FaSearch } from 'react-icons/fa';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const { addToCart } = useContext(CartContext);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      // LẤY ĐẦY ĐỦ DATA RELATIONS
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_variants(*),
          product_keys(id, is_used)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error.message);
    } finally {
      setLoading(false);
    }
  };

  // LOGIC TÍNH STOCK CHUẨN
  const checkStockStatus = (product) => {
    if (product.check_stock_api) return true;
    if (product.has_variants && product.product_variants?.length > 0) {
      const totalVariantStock = product.product_variants.reduce(
        (acc, variant) => acc + (variant.stock_quantity || 0), 
        0
      );
      return totalVariantStock > 0;
    }
    if (product.is_digital) {
      const availableKeys = product.product_keys 
        ? product.product_keys.filter(k => !k.is_used).length 
        : 0;
      return availableKeys > 0;
    }
    return (product.physical_stock || 0) > 0;
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || product.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = ['All', ...new Set(products.map(p => p.category).filter(Boolean))];

  return (
    <Layout>
      <div className="bg-gray-100 py-10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <h1 className="text-3xl font-bold text-gray-800">All Products</h1>
            
            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search products..."
                  className="pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <FaSearch className="absolute left-3 top-3 text-gray-400" />
              </div>

              {/* Filter */}
              <div className="relative">
                <select
                  className="pl-10 pr-8 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white w-full"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <FaFilter className="absolute left-3 top-3 text-gray-400" />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredProducts.map((product) => {
                const inStock = checkStockStatus(product);

                return (
                  <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300 flex flex-col">
                    <Link to={`/products/${product.id}`} className="relative h-48 overflow-hidden bg-gray-200">
                      <img
                        src={product.image_url || 'https://placehold.co/600x400?text=No+Image'}
                        alt={product.name}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                      />
                      {!inStock && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <span className="bg-red-500 text-white px-3 py-1 text-sm font-bold rounded">OUT OF STOCK</span>
                        </div>
                      )}
                    </Link>

                    <div className="p-4 flex-grow flex flex-col justify-between">
                      <div>
                        <div className="text-xs text-gray-500 mb-1 uppercase tracking-wide">{product.category}</div>
                        <Link to={`/products/${product.id}`}>
                          <h3 className="font-bold text-gray-800 mb-2 hover:text-blue-600 line-clamp-2">{product.name}</h3>
                        </Link>
                      </div>
                      
                      <div className="flex justify-between items-center mt-4 pt-4 border-t">
                        <span className="text-lg font-bold text-blue-600">${product.price}</span>
                        <button
                          onClick={() => inStock && addToCart(product)}
                          disabled={!inStock}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            inStock 
                              ? 'bg-blue-600 text-white hover:bg-blue-700' 
                              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          }`}
                        >
                          <FaShoppingCart /> {inStock ? 'Add' : 'Sold Out'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Products;
