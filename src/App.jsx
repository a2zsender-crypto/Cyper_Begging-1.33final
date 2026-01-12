import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Contact from './pages/Contact'; // Trang tạo ticket cho User
import Support from './pages/Support';
import Login from './pages/Login';
import Success from './pages/Success';
import AdminLayout from './pages/Admin';

// Admin Components
import AdminDashboard from './components/admin/AdminDashboard'; // Đảm bảo file này tồn tại hoặc xóa dòng này nếu chưa có
import AdminProducts from './components/admin/AdminProducts';
import AdminOrders from './components/admin/AdminOrders';
import AdminUsers from './components/admin/AdminUsers';
import AdminSettings from './components/admin/AdminSettings';
import AdminContacts from './components/admin/AdminContacts'; // [ĐÃ SỬA] Thêm Import này

import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabaseClient';
import { useEffect, useState } from 'react';

function App() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check quyền Admin
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();
        // Cho phép cả admin và mod truy cập trang quản trị
        if (data && (data.role === 'admin' || data.role === 'mod')) {
             setIsAdmin(true);
        }
      }
      setLoading(false);
    };
    checkUser();
  }, []);

  if (loading) return null;

  return (
    <Routes>
      {/* PUBLIC ROUTES */}
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="products" element={<Products />} />
        <Route path="products/:id" element={<ProductDetail />} />
        <Route path="cart" element={<Cart />} />
        <Route path="contact" element={<Contact />} />
        <Route path="support" element={<Support />} />
        <Route path="login" element={<Login />} />
        <Route path="success" element={<Success />} />
      </Route>

      {/* ADMIN ROUTES */}
      <Route path="/admin" element={isAdmin ? <AdminLayout /> : <Navigate to="/login" />}>
        <Route index element={<AdminDashboard />} /> 
        <Route path="products" element={<AdminProducts />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="settings" element={<AdminSettings />} />
        {/* [ĐÃ SỬA] Thêm Route contacts vào đây */}
        <Route path="contacts" element={<AdminContacts />} />
      </Route>
    </Routes>
  );
}

export default App;
