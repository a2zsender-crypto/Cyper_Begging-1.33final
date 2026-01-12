import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { 
  Search, Eye, EyeOff, Filter, ChevronLeft, ChevronRight, 
  Clock, CheckCircle, XCircle, AlertTriangle, Package, Key, Copy, X, Save, MapPin
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useLang } from '../../context/LangContext';

// --- COMPONENT CON: HIỂN THỊ KEY BẢO MẬT ---
const MaskedKeyDisplay = ({ text, t }) => {
    const [isVisible, setIsVisible] = useState(false);

    const getMaskedText = (rawText) => {
        if (!rawText) return '';
        return rawText.split('\n').map(line => {
            if (line.length > 15) {
                const start = line.substring(0, 10);
                const end = line.substring(line.length - 4);
                return `${start}••••••••${end}`;
            }
            return line;
        }).join('\n');
    };

    const copyToClipboard = (txt) => {
        navigator.clipboard.writeText(txt);
        toast.success(t('Đã copy mã (Full)!', 'Copied full key!'));
    };

    return (
        <div className="mt-2 p-3 bg-green-50 border border-green-100 rounded-lg text-sm group relative">
            <div className="font-bold text-green-700 flex items-center justify-between mb-1">
                <div className="flex items-center gap-1">
                    <Key size={14}/> {t('Mã bản quyền / Key:', 'License Key:')}
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setIsVisible(!isVisible)} className="text-green-600 hover:bg-green-100 p-1 rounded transition">
                        {isVisible ? <EyeOff size={16}/> : <Eye size={16}/>}
                    </button>
                    <button onClick={() => copyToClipboard(text)} className="text-green-600 hover:bg-green-100 p-1 rounded transition">
                        <Copy size={16}/>
                    </button>
                </div>
            </div>
            <div className="font-mono text-slate-700 whitespace-pre-line break-all">
                {isVisible ? text : getMaskedText(text)}
            </div>
        </div>
    );
};

// --- COMPONENT CHÍNH ---
const AdminOrders = () => {
  const { t, lang } = useLang();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null); 
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [userRole, setUserRole] = useState('user'); 
  const ITEMS_PER_PAGE = 10;

  // State cho việc update status
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState('');

  // --- FIX: TỪ ĐIỂN TRẠNG THÁI ---
  const statusLabels = {
      all: t('Tất cả', 'All'),
      pending: t('Chờ xử lý', 'Pending'),
      paid: t('Đã thanh toán', 'Paid'),
      shipping: t('Đang vận chuyển', 'Shipping'),
      completed: t('Hoàn thành', 'Completed'),
      cancelled: t('Đã hủy', 'Cancelled'),
      expired: t('Hết hạn', 'Expired'),
      failed: t('Thất bại', 'Failed')
  };

  useEffect(() => {
    checkUserRole();
    fetchOrders();
  }, [page, filterStatus]); 

  const checkUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
          const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
          if (data) setUserRole(data.role);
      }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('orders')
        .select(`*, order_items (*, products (title, title_en, images, price, is_digital))`, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1);

      if (filterStatus !== 'all') query = query.eq('status', filterStatus);
      if (searchTerm) query = query.or(`customer_email.ilike.%${searchTerm}%,oxapay_track_id.ilike.%${searchTerm}%`);

      const { data, error } = await query;
      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error(t('Không thể tải danh sách đơn hàng', 'Failed to fetch orders'));
    } finally {
      setLoading(false);
    }
  };

  // --- HÀM ĐÃ SỬA: DÙNG FETCH THAY VÌ SUPABASE.INVOKE ĐỂ TRÁNH LỖI CORS ---
  const handleUpdateStatus = async () => {
      if (!selectedOrder || !newStatus || newStatus === selectedOrder.status) return;
      if (!window.confirm(t(`Bạn có chắc muốn đổi trạng thái thành "${statusLabels[newStatus] || newStatus}"?`, `Confirm update status to "${statusLabels[newStatus] || newStatus}"?`))) return;

      setUpdatingStatus(true);
      try {
          // 1. Lấy Session Token hiện tại
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) throw new Error(t("Phiên đăng nhập hết hạn", "Session expired"));

          // 2. URL Function (Lấy từ log lỗi của bạn)
          const FUNCTION_URL = 'https://csxuarismehewgiedoeg.supabase.co/functions/v1/admin-actions';

          // 3. Gọi Fetch thủ công
          const response = await fetch(FUNCTION_URL, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}` // Tự gửi Token xác thực
              },
              body: JSON.stringify({ 
                  action: 'update_order_status', 
                  orderId: selectedOrder.id, 
                  status: newStatus,
                  customerEmail: selectedOrder.customer_email
              })
          });

          const data = await response.json();

          if (!response.ok) {
              throw new Error(data.error || "Request failed");
          }
          
          if (data.error) throw new Error(data.error);

          toast.success(t('Cập nhật thành công!', 'Updated successfully!'));
          fetchOrders();
          setSelectedOrder(prev => ({...prev, status: newStatus}));
      } catch (err) {
          console.error("Update Error:", err);
          toast.error(err.message || "Update failed");
      } finally {
          setUpdatingStatus(false);
      }
  };

  const formatCurrency = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US') : '';
  const formatTime = (dateString) => dateString ? new Date(dateString).toLocaleTimeString(lang === 'vi' ? 'vi-VN' : 'en-US') : '';

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      paid: 'bg-blue-100 text-blue-800 border-blue-200',
      completed: 'bg-green-100 text-green-800 border-green-200',
      expired: 'bg-gray-100 text-gray-800 border-gray-200',
      failed: 'bg-red-100 text-red-800 border-red-200',
      shipping: 'bg-purple-100 text-purple-800 border-purple-200',
      cancelled: 'bg-red-100 text-red-800 border-red-200'
    };
    return (
      <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status] || styles.expired}`}>
        {/* FIX: HIỂN THỊ TEXT DỊCH */}
        <span className="capitalize">{statusLabels[status] || status}</span>
      </span>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
      <div className="p-6 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
          <h2 className="text-xl font-bold text-slate-800">{t('Quản lý Đơn hàng', 'Order Management')}</h2>
          <div className="flex gap-2">
            <button onClick={fetchOrders} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
              <Clock size={20} />
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder={t('Tìm theo email, Order ID...', 'Search by email, Order ID...')} 
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchOrders()}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
            {['all', 'pending', 'paid', 'completed'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors border
                  ${filterStatus === status ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
              >
                {/* FIX: HIỂN THỊ TEXT DỊCH CHO NÚT LỌC */}
                {statusLabels[status] || status}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">{t('Mã đơn', 'Order ID')}</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">{t('Khách hàng', 'Customer')}</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">{t('Tổng tiền', 'Total Amount')}</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">{t('Trạng thái', 'Status')}</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase">{t('Ngày tạo', 'Created At')}</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase">{t('Hành động', 'Actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              [...Array(5)].map((_, i) => <tr key={i} className="animate-pulse"><td colSpan="6" className="px-6 py-4"><div className="h-10 bg-slate-100 rounded"></div></td></tr>)
            ) : orders.length === 0 ? (
              <tr><td colSpan="6" className="px-6 py-12 text-center text-slate-500">{t('Không tìm thấy đơn hàng nào.', 'No orders found.')}</td></tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">#{order.id}<div className="text-xs text-slate-400 mt-1">{order.oxapay_track_id || '-'}</div></td>
                  <td className="px-6 py-4"><div className="text-sm font-medium text-slate-900">{order.customer_name || 'Guest'}</div><div className="text-xs text-slate-500">{order.customer_email}</div></td>
                  <td className="px-6 py-4 font-bold text-green-600">{formatCurrency(order.amount)}</td>
                  <td className="px-6 py-4">{getStatusBadge(order.status)}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{formatDate(order.created_at)}<div className="text-xs text-slate-400">{formatTime(order.created_at)}</div></td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => { setSelectedOrder(order); setNewStatus(order.status); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Eye size={18} /></button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-slate-100 flex justify-center gap-2">
        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 border rounded-lg hover:bg-slate-50 disabled:opacity-50"><ChevronLeft size={20} /></button>
        <span className="px-4 py-2 bg-slate-50 rounded-lg text-sm font-medium flex items-center">{t('Trang', 'Page')} {page}</span>
        <button onClick={() => setPage(p => p + 1)} disabled={orders.length < ITEMS_PER_PAGE} className="p-2 border rounded-lg hover:bg-slate-50 disabled:opacity-50"><ChevronRight size={20} /></button>
      </div>

      {/* MODAL CHI TIẾT */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-fade-in-up">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-xl font-bold text-slate-800">{t('Chi tiết đơn hàng', 'Order Details')} #{selectedOrder.id}</h3>
                <p className="text-sm text-slate-500 mt-1">{new Date(selectedOrder.created_at).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US')}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500"><XCircle size={24} /></button>
            </div>

            <div className="p-6 overflow-y-auto space-y-8">
              {/* FIX: CẬP NHẬT TRẠNG THÁI VỚI TEXT DỊCH */}
              {userRole === 'admin' && (
                  <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                          <AlertTriangle className="text-indigo-600" size={20}/>
                          <div>
                              <div className="font-bold text-indigo-900">{t('Cập nhật trạng thái', 'Update Status')}</div>
                              <div className="text-xs text-indigo-700">{t('Hệ thống sẽ gửi email thông báo cho khách', 'System will notify customer')}</div>
                          </div>
                      </div>
                      <div className="flex items-center gap-2">
                          <select 
                              value={newStatus} 
                              onChange={(e) => setNewStatus(e.target.value)}
                              className="border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                              <option value="pending">{statusLabels['pending']}</option>
                              <option value="paid">{statusLabels['paid']}</option>
                              <option value="shipping">{statusLabels['shipping']}</option>
                              <option value="completed">{statusLabels['completed']}</option>
                              <option value="cancelled">{statusLabels['cancelled']}</option>
                          </select>
                          <button 
                              onClick={handleUpdateStatus} 
                              disabled={updatingStatus || newStatus === selectedOrder.status}
                              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                          >
                              {updatingStatus ? t('Đang lưu...', 'Saving...') : <><Save size={16}/> {t('Lưu', 'Save')}</>}
                          </button>
                      </div>
                  </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* --- CỘT 1: THÔNG TIN KHÁCH HÀNG & SHIP --- */}
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <h4 className="font-bold text-blue-800 mb-3 flex items-center gap-2"><Filter size={16}/> {t('Thông tin khách hàng', 'Customer Info')}</h4>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-blue-600 font-medium w-24 inline-block">{t('Email:', 'Email:')}</span> {selectedOrder.customer_email}</p>
                    <p><span className="text-blue-600 font-medium w-24 inline-block">{t('Họ tên:', 'Name:')}</span> {selectedOrder.customer_name || 'N/A'}</p>
                    <p><span className="text-blue-600 font-medium w-24 inline-block">{t('Liên hệ:', 'Contact:')}</span> {selectedOrder.contact_method} - {selectedOrder.contact_info}</p>
                    
                    {/* HIỂN THỊ ĐỊA CHỈ SHIP (Nếu có sản phẩm vật lý) */}
                    {(() => {
                        const hasPhysical = selectedOrder.order_items?.some(i => i.products?.is_digital === false);
                        if (hasPhysical && selectedOrder.shipping_address) {
                            return (
                                <div className="mt-3 pt-3 border-t border-blue-200 text-sm">
                                    <div className="font-bold text-blue-800 mb-1 flex items-center gap-2">
                                        <MapPin size={14}/> {t('Địa chỉ nhận hàng', 'Shipping Address')}
                                    </div>
                                    <div className="pl-6 text-slate-700 whitespace-pre-line mb-1">
                                        {selectedOrder.shipping_address}
                                    </div>
                                    {selectedOrder.phone_number && (
                                        <div className="pl-6 text-slate-700">
                                            <span className="font-medium text-blue-600">{t('SĐT:', 'Phone:')}</span> {selectedOrder.phone_number}
                                        </div>
                                    )}
                                </div>
                            );
                        }
                        return null;
                    })()}

                  </div>
                </div>

                {/* --- CỘT 2: THÔNG TIN THANH TOÁN --- */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><Package size={16}/> {t('Thông tin thanh toán', 'Payment Info')}</h4>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-slate-500 font-medium w-32 inline-block">{t('Trạng thái:', 'Status:')}</span> {getStatusBadge(selectedOrder.status)}</p>
                    <p><span className="text-slate-500 font-medium w-32 inline-block">{t('Tổng tiền:', 'Total:')}</span> <span className="font-bold text-green-600 text-lg">{formatCurrency(selectedOrder.amount)}</span></p>
                    <p><span className="text-slate-500 font-medium w-32 inline-block">{t('Track ID:', 'Track ID:')}</span> <span className="font-mono bg-slate-200 px-2 py-0.5 rounded text-xs">{selectedOrder.oxapay_track_id || '-'}</span></p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 mb-4 border-l-4 border-blue-600 pl-3">{t('Sản phẩm đã mua', 'Purchased Items')}</h4>
                <div className="border rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600">{t('Sản phẩm', 'Product')}</th>
                        <th className="px-4 py-3 text-center font-semibold text-slate-600">{t('SL', 'Qty')}</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-600">{t('Giá', 'Price')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedOrder.order_items?.map((item, idx) => {
                        const displayName = item.product_name || item.products?.title || 'Unknown Product';
                        const variantInfo = item.variant_name; 
                        const isDigital = item.products?.is_digital;

                        return (
                          <tr key={idx} className="hover:bg-slate-50 align-top">
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-1">
                                <div className="font-medium text-slate-900 text-base">{displayName}</div>
                                {variantInfo && <div className="text-xs text-slate-500 bg-slate-100 w-fit px-2 py-0.5 rounded">{variantInfo}</div>}
                                
                                {item.assigned_key ? (
                                    <MaskedKeyDisplay text={item.assigned_key} t={t} />
                                ) : (
                                    isDigital && (selectedOrder.status === 'completed' || selectedOrder.status === 'paid') && (
                                        <div className="text-xs text-amber-600 flex items-center gap-1 mt-1 font-medium bg-amber-50 w-fit px-2 py-1 rounded">
                                            <AlertTriangle size={12}/> {t('Đang chờ xử lý key...', 'Processing key...')}
                                        </div>
                                    )
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center font-medium">{item.quantity}</td>
                            <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(item.price_at_purchase * item.quantity)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOrders;
