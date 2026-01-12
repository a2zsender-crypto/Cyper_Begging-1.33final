import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { LangProvider } from './context/LangContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import ProductDetail from './pages/ProductDetail';
import Products from './pages/Products'; // Import trang mới
import Cart from './pages/Cart';
import Success from './pages/Success';
import Admin from './pages/Admin';
import Login from './pages/Login';
import Contact from './pages/Contact';
import Support from './pages/Support';

function App() {
  return (
    <LangProvider>
      <CartProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="products" element={<Products />} /> {/* Route mới */}
              <Route path="product/:id" element={<ProductDetail />} />
              <Route path="cart" element={<Cart />} />
              <Route path="success" element={<Success />} />
              <Route path="login" element={<Login />} />
              <Route path="admin" element={<Admin />} />
              <Route path="contact" element={<Contact />} />
              <Route path="support" element={<Support />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </LangProvider>
  );
}
export default App;