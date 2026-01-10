import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

// Component con để xử lý hiển thị từng Item (giúp quản lý trạng thái ẩn/hiện key riêng biệt)
const OrderItemRow = ({ item }) => {
    const [showKey, setShowKey] = useState(false);

    return (
        <li className="border-b last:border-0 pb-3 mb-3">
            <div className="flex justify-between items-start">
                <div>
                    <div className="font-medium text-gray-800">
                        {item.product_name || item.products?.title}
                        {item.variant_name && <span className="text-gray-500 text-sm"> ({item.variant_name})</span>}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">x {item.quantity}</div>
                    
                    {/* Phần hiển thị Key - Chỉ hiện khi có key */}
                    {item.assigned_key && (
                        <div className="mt-2 flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded border">
                                KEY
                            </span>
                            <div className={`text-sm font-mono ${showKey ? 'text-green-700' : 'text-gray-400 tracking-widest'}`}>
                                {showKey ? item.assigned_key : '••••••••••••••••••••'}
                            </div>
                            <button 
                                onClick={() => setShowKey(!showKey)}
                                className="text-gray-500 hover:text-blue-600 focus:outline-none p-1"
                                title={showKey ? "Ẩn key" : "Xem key"}
                            >
                                {showKey ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    )}
                </div>
                <div className="font-bold text-gray-700">
                    ${item.price_at_purchase}
                </div>
            </div>
        </li>
    );
};

export default function AdminOrders() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState(null);
    
    // State cho việc update status
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [newStatus, setNewStatus] = useState('');

    useEffect(() => {
        fetchOrders();
        
        const channel = supabase
            .channel('admin-orders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                fetchOrders();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    async function fetchOrders() {
        const { data, error } = await supabase
            .from('orders')
            .select('*, order_items(*, products(title))')
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
        if (!confirm("Bạn có chắc muốn xóa đơn này?")) return;
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
            if (!res.ok) throw new Error("Failed to delete");
            fetchOrders();
            if (selectedOrder?.id === id) setSelectedOrder(null);
        } catch (err) {
            alert(err.message);
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

            alert("Cập nhật trạng thái thành công!");
            setSelectedOrder({ ...selectedOrder, status: newStatus }); 
        } catch (err) {
            alert(err.message);
        } finally {
            setUpdatingStatus(false);
        }
    };

    if (loading) return <div className="p-4 text-center text-gray-500">Đang tải đơn hàng...</div>;

    return (
        <div>
            <h2 className="text-xl font-bold mb-4">Quản lý Đơn hàng</h2>
            <div className="overflow-x-auto bg-white rounded shadow">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-100 border-b text-sm text-gray-600 uppercase">
                            <th className="p-3">ID</th>
                            <th className="p-3">Khách hàng</th>
                            <th className="p-3">Tổng tiền</th>
                            <th className="p-3">Trạng thái</th>
                            <th className="p-3">Ngày tạo</th>
                            <th className="p-3 text-center">Hành động</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm text-gray-700">
                        {orders.map(order => (
                            <tr key={order.id} className="border-b hover:bg-gray-50 transition">
                                <td className="p-3 font-medium">#{order.id}</td>
                                <td className="p-3">
                                    <div className="font-semibold">{order.customer_email}</div>
                                    <div className="text-xs text-gray-500">{order.customer_name}</div>
                                </td>
                                <td className="p-3 font-bold text-green-600">${order.amount}</td>
                                <td className="p-3">
                                    <span className={`px-2 py-1 rounded text-xs font-bold 
                                        ${order.status === 'paid' ? 'bg-green-100 text-green-800' : 
                                          order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                                          order.status === 'shipping' ? 'bg-blue-100 text-blue-800' :
                                          order.status === 'completed' ? 'bg-gray-200 text-gray-800' :
                                          'bg-red-100 text-red-800'}`}>
                                        {order.status.toUpperCase()}
                                    </span>
                                </td>
                                <td className="p-3 text-gray-500">
                                    {new Date(order.created_at).toLocaleString('vi-VN')}
                                </td>
                                <td className="p-3 text-center space-x-2">
                                    <button 
                                        onClick={() => handleViewOrder(order)}
                                        className="text-blue-600 hover:text-blue-800 hover:underline font-medium">
                                        Chi tiết
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteOrder(order.id)}
                                        className="text-red-600 hover:text-red-800 hover:underline font-medium">
                                        Xóa
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal Chi tiết đơn hàng */}
            {selectedOrder && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
                        
                        {/* Header Modal */}
                        <div className="flex justify-between items-start mb-6 border-b pb-4">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">Đơn hàng #{selectedOrder.id}</h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    Ngày tạo: {new Date(selectedOrder.created_at).toLocaleString('vi-VN')}
                                </p>
                            </div>
                            <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-600 transition">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        
                        {/* Thông tin chung & Cập nhật trạng thái */}
                        <div className="bg-gray-50 rounded p-4 mb-6 border border-gray-200">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                                <div>
                                    <span className="text-xs font-bold text-gray-500 uppercase block mb-1">Trạng thái hiện tại</span>
                                    <span className={`px-3 py-1 rounded text-sm font-bold inline-block
                                        ${selectedOrder.status === 'paid' ? 'bg-green-100 text-green-800' : 
                                          selectedOrder.status === 'shipping' ? 'bg-blue-100 text-blue-800' :
                                          selectedOrder.status === 'completed' ? 'bg-gray-200 text-gray-800' :
                                          'bg-yellow-100 text-yellow-800'}`}>
                                        {selectedOrder.status.toUpperCase()}
                                    </span>
                                </div>
                                
                                {/* Form cập nhật trạng thái - Gọn gàng */}
                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                    <select 
                                        value={newStatus} 
                                        onChange={(e) => setNewStatus(e.target.value)}
                                        className="border-gray-300 border rounded px-3 py-1.5 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                                    >
                                        <option value="pending">Pending</option>
                                        <option value="paid">Paid</option>
                                        <option value="shipping">Shipping</option>
                                        <option value="completed">Completed</option>
                                        <option value="cancelled">Cancelled</option>
                                    </select>
                                    <button 
                                        onClick={handleUpdateStatus}
                                        disabled={updatingStatus || newStatus === selectedOrder.status}
                                        className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                    >
                                        {updatingStatus ? '...' : 'Cập nhật'}
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm border-t border-gray-200 pt-4">
                                <div>
                                    <p className="mb-1"><span className="font-semibold text-gray-600">Email:</span> {selectedOrder.customer_email}</p>
                                    <p className="mb-1"><span className="font-semibold text-gray-600">Tên:</span> {selectedOrder.customer_name || '---'}</p>
                                    <p><span className="font-semibold text-gray-600">SĐT:</span> {selectedOrder.phone_number || selectedOrder.contact_info || '---'}</p>
                                </div>
                                <div>
                                    <p className="mb-1"><span className="font-semibold text-gray-600">Track ID:</span> {selectedOrder.oxapay_track_id || '---'}</p>
                                    <p><span className="font-semibold text-gray-600">Ghi chú:</span> {selectedOrder.notes || 'Không có'}</p>
                                </div>
                            </div>
                            
                            {/* Địa chỉ giao hàng - Chỉ hiển thị khi có dữ liệu */}
                            {selectedOrder.shipping_address && (
                                <div className="mt-4 pt-3 border-t border-gray-200">
                                    <span className="font-semibold text-gray-600 block text-sm mb-1">📍 Địa chỉ giao hàng:</span>
                                    <p className="bg-white p-2 rounded border border-gray-200 text-sm text-gray-800">
                                        {selectedOrder.shipping_address}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Danh sách sản phẩm */}
                        <div>
                            <h4 className="font-bold text-gray-800 mb-3 text-lg">Chi tiết sản phẩm</h4>
                            <ul className="space-y-0">
                                {selectedOrder.order_items.map(item => (
                                    <OrderItemRow key={item.id} item={item} />
                                ))}
                            </ul>
                        </div>
                        
                        {/* Footer Modal: Tổng tiền */}
                        <div className="mt-6 pt-4 border-t flex justify-end items-center">
                            <span className="text-gray-600 mr-2">Tổng thanh toán:</span>
                            <span className="text-2xl font-bold text-green-600">${selectedOrder.amount}</span>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}
