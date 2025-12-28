import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { useLang } from '../context/LangContext';
import { toast } from 'react-toastify';
import { LogIn, Mail, Lock, Loader } from 'lucide-react';

export default function Login() {
  const { t } = useLang(); // Hook lấy ngôn ngữ
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast.success(t('Đăng nhập thành công!', 'Login successfully!'));
      navigate('/admin'); // Chuyển hướng vào trang quản trị
      
    } catch (error) {
      toast.error(t('Đăng nhập thất bại: ', 'Login failed: ') + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-slate-50 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-100 animate-fade-in-up">
        
        {/* HEADER */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
            <LogIn size={32} />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-800">
            {t('Đăng nhập', 'Welcome Back')}
          </h2>
          <p className="text-slate-500 text-sm mt-2">
            {t('Vui lòng đăng nhập để tiếp tục quản lý', 'Please sign in to continue managing')}
          </p>
        </div>

        {/* FORM */}
        <form onSubmit={handleLogin} className="space-y-5">
          
          {/* Email Input */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              {t('Email', 'Email Address')}
            </label>
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition bg-slate-50 focus:bg-white text-slate-700 font-medium"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              {t('Mật khẩu', 'Password')}
            </label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                required
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition bg-slate-50 focus:bg-white text-slate-700 font-medium"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
          >
            {loading ? <Loader size={20} className="animate-spin" /> : <LogIn size={20} />}
            {t('Đăng nhập', 'Sign In')}
          </button>

        </form>

      </div>
    </div>
  );
}