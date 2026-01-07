import React, { useEffect, useState, useContext } from 'react';
import { supabase } from '../supabaseClient';
import { CartContext } from '../context/CartContext';
import { Link } from 'react-router-dom';
import { FaShoppingCart, FaSearch, FaFilter } from 'react-icons/fa';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  
  const { addToCart, calculateStock } = useContext(CartContext);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, searchTerm, categoryFilter]);

  const fetchProducts = async () => {
    setLoading(true);
    // Nhớ fetch cả variants để tính tồn kho chính xác
    const { data, error } = await supabase
      .from('products')
      .select('*, variants(*)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching products:', error);
    } else {
      setProducts(data || []);
      setFilteredProducts(data || []);
    }
    setLoading(false);
  };

  const filterProducts = () => {
    let temp = [...products];

    if (searchTerm) {
      temp = temp.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    if (categoryFilter !== 'All') {
      temp = temp.filter(p => p.category === categoryFilter);
    }

    setFilteredProducts(temp);
  };

  // Helper render Badge (Tái sử dụng logic chuẩn)
  const getStockStatus = (product) => {
    const stock = calculateStock(product);
    return {
      isStock: stock > 0,
      stockCount: stock
    };
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">All Products</h1>

        {/* Filters & Search */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-white p-4 rounded-lg shadow-sm">
          <div className="relative w-full md:w-1/3">
            <FaSearch className="absolute left-3 top-3 text-gray-400" />
            <input 
              type="text"
              placeholder="Search products..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-2 w-full md:w-auto">
            <FaFilter className="text-gray-500" />
            <select 
              className="border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="All">All Categories</option>
              <option value="Digital">Digital Keys</option>
              <option value="Physical">Physical Goods</option>
              {/* Thêm các category khác nếu có trong DB */}
            </select>
          </div>
        </div>

        {/* Product Grid */}
        {loading ? (
          <div className="text-center py-20">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredProducts.map((product) => {
              const { isStock, stockCount } = getStockStatus(product);

              return (
                <div key={product.id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300 flex flex-col">
                  <div className="relative">
                    <Link to={`/products/${product.id}`}>
                      <img 
                        src={product.image_url || 'https://via.placeholder.com/300'} 
                        alt={product.name} 
                        className="w-full h-52 object-cover"
                      />
                    </Link>
                    {/* Status Badge */}
                    <span className={`absolute top-2 right-2 text-xs font-bold px-2 py-1 rounded-full shadow-sm text-white ${isStock ? 'bg-green-500' : 'bg-red-500'}`}>
                      {isStock ? 'In Stock' : 'Out of Stock'}
                    </span>
                  </div>

                  <div className="p-5 flex-grow flex flex-col justify-between">
                    <div>
                      <Link to={`/products/${product.id}`}>
                        <h2 className="text-lg font-bold text-gray-800 hover:text-blue-600 mb-1">{product.name}</h2>
                      </Link>
                      <p className="text-gray-500 text-sm mb-3 line-clamp-2">{product.description}</p>
                    </div>

                    <div className="mt-4">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-xl font-bold text-blue-600">${product.price}</span>
                        {/* Hiển thị số lượng tồn nếu muốn, hoặc ẩn đi */}
                        {isStock && stockCount < 100 && stockCount > 0 && (
                          <span className="text-xs text-orange-500 font-semibold">Only {stockCount} left</span>
                        )}
                      </div>

                      <button
                        onClick={() => addToCart(product)}
                        disabled={!isStock}
                        className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg font-medium transition-colors ${
                          isStock 
                            ? 'bg-blue-600 text-white hover:bg-blue-700' 
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        <FaShoppingCart />
                        {isStock ? 'Add to Cart' : 'Sold Out'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filteredProducts.length === 0 && !loading && (
          <div className="text-center py-20 text-gray-500">
            No products found matching your criteria.
          </div>
        )}
      </div>
    </div>
  );
};

export default Products;
