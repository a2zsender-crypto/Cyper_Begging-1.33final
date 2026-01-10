import { useState, useEffect, useContext } from 'react';
import { supabase } from '../../supabaseClient';
import { LangContext } from '../../context/LangContext'; // Import Context Ngôn ngữ

// Component hiển thị Key (Giữ nguyên thiết kế)
const KeyDisplay = ({ text }) => {
    const [visible, setVisible] = useState(false);
    
    if (!text || text.length < 5) return <span className="text-gray-400 italic">---</span>;

    const handleCopy = (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        alert("Copied!");
    };

    return (
        <div className="flex items-center space-x-2 bg-gray-50 p-1 rounded border border-gray-200 text-sm font-mono max-w-xs">
            <span className="truncate flex-1">
                {visible ? text : '••••••••••••••••••••'}
            </span>
            <button onClick={() => setVisible(!visible)} className="text-gray-500 hover:text-blue-600" title="Toggle View">
                {visible ? '👁️' : '🔒'}
            </button>
            <button onClick={handleCopy} className="text-gray-500 hover:text-green-600" title="Copy">
                📋
            </button>
        </div>
    );
};

export default function AdminOrders() {
    const { lang } = useContext(LangContext); // Lấy ngôn ngữ hiện tại (vi/en)
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState(null);
    
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [newStatus, setNewStatus] = useState('');

    // Dictionary ngôn ngữ cho trang này
    const t = {
        title: lang === 'vi' ? 'Quản lý Đơn hàng' : 'Order Management',
        col_id: lang === 'vi' ? 'Mã ĐH' : 'ID',
        col_cust: lang === 'vi' ? 'Khách hàng' : 'Customer',
        col_total: lang === 'vi' ? 'Tổng tiền' : 'Total',
        col_status: lang === 'vi' ? 'Trạng thái' : 'Status',
        col_date: lang === 'vi' ? 'Ngày tạo' : 'Date',
        col_action: lang === 'vi' ? 'Hành động' : 'Actions',
        btn_detail: lang === 'vi' ? 'Chi tiết' : 'Detail',
        btn_delete: lang === 'vi' ? 'Xóa' : 'Delete',
        loading: lang === 'vi' ? 'Đang tải dữ liệu...' : 'Loading orders...',
        modal_title: lang === 'vi' ? 'Chi tiết đơn hàng' : 'Order Detail',
        modal_close: lang === 'vi' ? 'Đóng' : 'Close',
        ship_addr: lang === 'vi' ? 'Địa chỉ giao hàng' : 'Shipping Address',
        track_id: lang === 'vi' ? 'Mã vận đơn' : 'Track ID',
        update_status: lang === 'vi' ? 'Cập nhật trạng thái' : 'Update Status',
        btn_update: lang === 'vi' ? 'Cập nhật' : 'Update',
        updating: lang === 'vi' ? 'Đang lưu...' : 'Saving...',
        list_prod: lang === 'vi' ? 'Danh sách sản phẩm' : 'Product List',
        quantity: lang === 'vi' ? 'Số lượng' : 'Qty',
        confirm_del: lang === 'vi' ? 'Bạn chắc chắn muốn xóa?' : 'Are you sure to delete?',
        alert_success: lang === 'vi' ? 'Thành công!' : 'Success!',
        alert_fail: lang === 'vi' ? 'Thất bại: ' : 'Failed: ',
        st_pending: lang === 'vi' ? 'Chờ thanh toán' : 'Pending',
        st_paid: lang === 'vi' ? 'Đã thanh toán' : 'Paid',
        st_shipping: lang === 'vi' ? 'Đang vận chuyển' : 'Shipping',
        st_completed: lang === 'vi' ? 'Hoàn thành' : 'Completed',
        st_cancelled: lang === 'vi' ? 'Đã hủy' : 'Cancelled',
        phy_paid: lang === 'vi' ? '📦 Chờ vận chuyển' : '📦 Ready to ship',
        phy_ship: lang === 'vi' ? '🚚 Đang giao hàng' : '🚚 Shipping',
        phy_done: lang === 'vi' ? '✅ Giao hàng thành công' : '✅ Delivered',
        phy_wait: lang === 'vi' ? '⏳ Đang xử lý' : '⏳ Processing',
    };

    useEffect(() => {
        fetchOrders();
        const channel = supabase
            .channel('admin-orders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    async function fetchOrders() {
        // Load orders kèm items và product info (title, is_digital)
        const { data, error } = await supabase
            .from('orders')
            .select('*, order_items(*, products(title, is_digital))') 
            .order('created_at', { ascending: false });
        
        if (error) console.error("Error fetching orders:", error);
        else setOrders(data || []);
        setLoading(false);
    }

    const handleViewOrder = (order) => {
        setSelectedOrder(order);
        setNewStatus(order.status);
    };

    const handleDeleteOrder = async (id) => {
        if (!confirm(t.confirm_del)) return;
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-actions`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ action: 'delete_order', orderId: id })
            });
            
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || "Failed to delete");
            
            alert(t.alert_success);
            fetchOrders();
            if (selectedOrder?.id === id) setSelectedOrder(null);
        } catch (err) {
            alert(t.alert_fail + err.message);
        }
    };

    const handleUpdateStatus = async () => {
        if (!selectedOrder) return;
        setUpdatingStatus(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-actions`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ 
                    action: 'update_order_status', 
                    orderId: selectedOrder.id,
                    status: newStatus,
                    customerEmail: selectedOrder.customer_email
                })
            });
            
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || "Update failed");

            alert(t.alert_success);
            setSelectedOrder({ ...selectedOrder, status: newStatus }); 
        } catch (err) {
            alert(t.alert_fail + err.message);
        } finally {
            setUpdatingStatus(false);
        }
    };

    // Hàm hiển thị trạng thái của từng món hàng (Vật lý vs Digital)
    const renderItemStatus = (item) => {
        // 1. Nếu có key thì hiển thị Key (Digital đã trả hàng)
        if (item.assigned_key && item.assigned_key.length > 5) {
            return (
                <div className="mt-1">
                    <div className="text-xs text-gray-500 mb-1">Key/Code:</div>
                    <KeyDisplay text={item.assigned_key} />
                </div>
            );
        }

        // 2. Nếu không có key -> Check xem là Vật lý hay Digital hết hàng
        const isDigital = item.products?.is_digital !== false; // Mặc định true nếu ko xác định
        
        if (!isDigital) {
            // --- LOGIC HIỂN THỊ HÀNG VẬT LÝ ---
            let statusText = t.phy_wait;
            const s = selectedOrder.status;
            
            if (s === 'paid') statusText = t.phy_paid;
            else if (s === 'shipping') statusText = t.phy_ship;
            else if (s === 'completed') statusText = t.phy_done;
            else if (s === 'pending') statusText = t.st_pending;

            // Màu sắc
            let colorClass = "text-orange-600";
            if (s === 'shipping') colorClass = "text-blue-600";
            if (s === 'completed') colorClass = "text-green-600";

            return (
                <div className={`mt-2 text-sm font-bold ${colorClass} bg-gray-100 p-2 rounded border border-gray-200 inline-block`}>
                    {statusText}
                </div>
            );
        } else {
            // Digital nhưng chưa có key
            return (
                <div className="text-xs italic text-red-500 mt-1">
                    * {lang === 'vi' ? 'Hết hàng / Lỗi cấp key' : 'Out of stock / Key error'}
                </div>
            );
        }
    };

    if (loading) return <div>{t.loading}</div>;

    return (
        <div>
            <h2 className="text-xl font-bold mb-4 text-gray-800">{t.title}</h2>
            <div className="overflow-x-auto bg-white rounded shadow border border-gray-200">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-100 border-b text-gray-700">
                            <th className="p-3">{t.col_id}</th>
                            <th className="p-3">{t.col_cust}</th>
                            <th className="p-3">{t.col_total}</th>
                            <th className="p-3">{t.col_status}</th>
                            <th className="p-3">{t.col_date}</th>
                            <th className="p-3">{t.col_action}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {orders.map(order => (
                            <tr key={order.id} className="border-b hover:bg-gray-50">
                                <td className="p-3 font-mono text-sm">#{order.id}</td>
                                <td className="p-3">
                                    <div className="font-medium text-gray-900">{order.customer_email}</div>
                                    <div className="text-xs text-gray-500">{order.customer_name}</div>
                                </td>
                                <td className="p-3 font-bold text-gray-700">${order.amount}</td>
                                <td className="p-3">
                                    <span className={`px-2 py-1 rounded text-xs font-bold 
                                        ${order.status === 'paid' ? 'bg-green-100 text-green-800' : 
                                          order.status === 'shipping' ? 'bg-blue-100 text-blue-800' :
                                          order.status === 'completed' ? 'bg-purple-100 text-purple-800' :
                                          order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                          'bg-yellow-100 text-yellow-800'}`}>
                                        {order.status.toUpperCase()}
                                    </span>
                                </td>
                                <td className="p-3 text-sm text-gray-500">
                                    {new Date(order.created_at).toLocaleDateString()}
                                </td>
                                <td className="p-3 space-x-2">
                                    <button onClick={() => handleViewOrder(order)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">{t.btn_detail}</button>
                                    <button onClick={() => handleDeleteOrder(order.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">{t.btn_delete}</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal Chi tiết đơn hàng */}
            {selectedOrder && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="text-xl font-bold text-gray-800">{t.modal_title} #{selectedOrder.id}</h3>
                            <button onClick={() => setSelectedOrder(null)} className="text-gray-500 hover:text-red-500 text-2xl font-bold">&times;</button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
                            <div className="space-y-2">
                                <p><strong className="text-gray-600">Email:</strong> {selectedOrder.customer_email}</p>
                                <p><strong className="text-gray-600">{t.col_cust}:</strong> {selectedOrder.customer_name || '---'}</p>
                                <p><strong className="text-gray-600">Phone:</strong> {selectedOrder.phone_number || selectedOrder.contact_info || '---'}</p>
                                <p><strong className="text-gray-600">{t.track_id}:</strong> {selectedOrder.oxapay_track_id || '---'}</p>
                            </div>
                            
                            <div className="space-y-2">
                                <p><strong className="text-gray-600">{t.col_date}:</strong> {new Date(selectedOrder.created_at).toLocaleString()}</p>
                                <p><strong className="text-gray-600">{t.col_status}:</strong> <span className="uppercase font-bold">{selectedOrder.status}</span></p>
                                
                                {/* CHỈ HIỂN THỊ NẾU CÓ ĐỊA CHỈ (SẢN PHẨM VẬT LÝ) */}
                                {selectedOrder.shipping_address && (
                                    <div className="mt-2 bg-yellow-50 p-3 border border-yellow-200 rounded">
                                        <strong className="block text-yellow-800 mb-1">📍 {t.ship_addr}:</strong>
                                        <span className="text-gray-800 break-words">{selectedOrder.shipping_address}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* KHU VỰC CẬP NHẬT TRẠNG THÁI */}
                        <div className="mb-6 p-4 bg-blue-50 rounded border border-blue-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
                            <div className="flex-1 w-full">
                                <label className="block text-xs font-bold text-blue-700 mb-1 uppercase">{t.update_status}</label>
                                <div className="flex gap-2">
                                    <select 
                                        value={newStatus} 
                                        onChange={(e) => setNewStatus(e.target.value)}
                                        className="border border-gray-300 rounded p-2 flex-1 outline-none focus:border-blue-500 bg-white"
                                    >
                                        <option value="pending">{t.st_pending}</option>
                                        <option value="paid">{t.st_paid}</option>
                                        <option value="shipping">{t.st_shipping}</option>
                                        <option value="completed">{t.st_completed}</option>
                                        <option value="cancelled">{t.st_cancelled}</option>
                                    </select>
                                    <button 
                                        onClick={handleUpdateStatus}
                                        disabled={updatingStatus}
                                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
                                    >
                                        {updatingStatus ? t.updating : t.btn_update}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="border-t pt-4">
                            <h4 className="font-bold mb-3 text-lg text-gray-800">{t.list_prod}</h4>
                            <ul className="space-y-3">
                                {selectedOrder.order_items.map(item => (
                                    <li key={item.id} className="flex flex-col border p-3 rounded bg-gray-50 hover:bg-white transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <div className="font-medium text-base text-blue-900">
                                                    {item.product_name || item.products?.title}
                                                    {item.variant_name && <span className="text-gray-600 font-normal"> ({item.variant_name})</span>}
                                                </div>
                                                <div className="text-sm text-gray-500 mt-1">{t.quantity}: <strong>{item.quantity}</strong></div>
                                            </div>
                                            <div className="font-bold text-gray-700">
                                                ${item.price_at_purchase}
                                            </div>
                                        </div>
                                        
                                        {/* LOGIC HIỂN THỊ TRẠNG THÁI SẢN PHẨM */}
                                        {renderItemStatus(item)}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        
                        <div className="text-right mt-6 pt-4 border-t text-xl font-bold text-red-600">
                            {t.col_total}: ${selectedOrder.amount}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
