import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { toast } from 'react-toastify';
import { Save, ArrowLeft, Plus, Trash2, Upload, AlertCircle } from 'lucide-react';
import { useLang } from '../../context/LangContext';

// Hàm helper tạo mã SKU tự động
const generateSlug = (text) => {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, "a")
    .replace(/[èéẹẻẽêềếệểễ]/g, "e")
    .replace(/[ìíịỉĩ]/g, "i")
    .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, "o")
    .replace(/[ùúụủũưừứựửữ]/g, "u")
    .replace(/[ỳýỵỷỹ]/g, "y")
    .replace(/đ/g, "d")
    .replace(/\s+/g, '-')     
    .replace(/[^\w\-]+/g, '') 
    .replace(/\-\-+/g, '-');  
};

export default function ProductDetail() {
  const { t } = useLang();
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = id !== 'new';
  
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState({
    title: '',
    description: '',
    price: 0,
    category: 'Voucher',
    is_digital: true,
    images: [],
    variants: [] // Cấu trúc DB: [{"name": "value", "options": [...]}]
  });

  // State riêng để quản lý danh sách biến thể trên giao diện phẳng
  const [uiVariants, setUiVariants] = useState([]);

  useEffect(() => {
    if (isEdit) fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
    if (error) { toast.error(t('Lỗi tải sản phẩm', 'Error loading product')); return; }
    
    setProduct(data);

    // --- CHUYỂN ĐỔI DỮ LIỆU TỪ DB (Lồng nhau) SANG UI (Phẳng) ---
    // DB: [{"name": "value", "options": [{"label": "10k", "price_mod": 0, ...}]}]
    if (data.variants && Array.isArray(data.variants) && data.variants.length > 0) {
        const variantGroup = data.variants[0]; // Lấy nhóm đầu tiên (thường là "value")
        if (variantGroup.options) {
            const mapped = variantGroup.options.map(opt => ({
                name: opt.label,              // "10k"
                code: opt.code || generateSlug(opt.label).toUpperCase(), // code hoặc tự sinh
                price: opt.price_mod || 0     // giá thêm/bớt
            }));
            setUiVariants(mapped);
        }
    }
  };

  const handleImageUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const fileName = `prod_${Date.now()}`;
      const { error } = await supabase.storage.from('product-images').upload(fileName, file);
      if(error) return toast.error(error.message);
      const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
      setProduct({ ...product, images: [...(product.images||[]), data.publicUrl] });
  };

  // --- LOGIC UI BIẾN THỂ ---
  const addVariant = () => {
      setUiVariants([...uiVariants, { name: '', code: '', price: 0 }]);
  };

  const removeVariant = (index) => {
      const newVars = [...uiVariants];
      newVars.splice(index, 1);
      setUiVariants(newVars);
  };

  const updateVariant = (index, field, value) => {
      const newVars = [...uiVariants];
      newVars[index][field] = value;

      // Auto-fill code nếu nhập tên
      if (field === 'name' && !newVars[index].code) {
           newVars[index].code = generateSlug(value).toUpperCase();
      }
      setUiVariants(newVars);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);

    // --- CHUYỂN ĐỔI NGƯỢC TỪ UI SANG DB ---
    // Tạo cấu trúc variants giống hệt mẫu bạn cung cấp
    // Mặc định tên nhóm là "value" (hoặc "Mệnh giá")
    let finalVariants = [];
    
    if (uiVariants.length > 0) {
        finalVariants = [{
            name: "value", // Key cố định theo cấu trúc cũ của bạn
            options: uiVariants.map(v => ({
                image: "",          // Giữ nguyên structure
                label: v.name,      // Tên tiếng Việt
                label_en: v.name,   // Tên tiếng Anh (tạm lấy giống TV)
                price_mod: Number(v.price), // Giá
                code: v.code || generateSlug(v.name).toUpperCase() // THÊM CỘT NÀY ĐỂ KHỚP LOGIC MỚI
            }))
        }];
    }

    const payload = { 
        ...product, 
        variants: finalVariants, // Lưu vào cột variants
        // variants_config: null // (Tùy chọn) Xóa cột cũ nếu muốn dọn dẹp
    };
    
    delete payload.id; 
    delete payload.created_at;

    let error;
    if (isEdit) {
      ({ error } = await supabase.from('products').update(payload).eq('id', id));
    } else {
      ({ error } = await supabase.from('products').insert(payload));
    }

    setLoading(false);
    if (error) toast.error("Error: " + error.message);
    else {
        toast.success(t("Đã lưu sản phẩm!", "Product Saved!"));
        navigate('/admin/products');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20 animate-fade-in">
        <div className="flex items-center gap-4 mb-6">
            <button onClick={() => navigate('/admin/products')} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                <ArrowLeft size={20}/>
            </button>
            <h1 className="text-2xl font-bold text-slate-800">
                {isEdit ? t(`Sửa sản phẩm #${id}`, `Edit Product #${id}`) : t('Thêm sản phẩm mới', 'New Product')}
            </h1>
        </div>

        <form onSubmit={handleSave} className="grid grid-cols-3 gap-8">
            {/* Cột trái: Thông tin chính */}
            <div className="col-span-2 space-y-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
                    <h3 className="font-bold text-slate-700 border-b pb-2">{t('Thông tin chung', 'General Info')}</h3>
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">{t('Tên sản phẩm', 'Product Name')}</label>
                        <input required className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            value={product.title} onChange={e=>setProduct({...product, title: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">{t('Mô tả chi tiết', 'Description')}</label>
                        <textarea className="w-full border p-2 rounded-lg h-32 focus:ring-2 focus:ring-blue-500 outline-none"
                            value={product.description} onChange={e=>setProduct({...product, description: e.target.value})}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">{t('Danh mục', 'Category')}</label>
                            <select className="w-full border p-2 rounded-lg"
                                value={product.category} onChange={e=>setProduct({...product, category: e.target.value})}>
                                <option>Voucher</option>
                                <option>Game Key</option>
                                <option>Top-up</option>
                                <option>Software</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">{t('Loại hàng', 'Product Type')}</label>
                            <select className="w-full border p-2 rounded-lg"
                                value={product.is_digital} onChange={e=>setProduct({...product, is_digital: e.target.value === 'true'})}>
                                <option value="true">{t('Digital (Key/Code)', 'Digital (Key/Code)')}</option>
                                <option value="false">{t('Vật lý (Giao hàng)', 'Physical (Shipping)')}</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">{t('Giá mặc định (VNĐ)', 'Default Price (VND)')}</label>
                        <input type="number" className="w-full border p-2 rounded-lg font-mono"
                            value={product.price} onChange={e=>setProduct({...product, price: Number(e.target.value)})}
                        />
                    </div>
                </div>

                {/* Phần cấu hình biến thể (ĐÃ KHỚP CẤU TRÚC DB CŨ) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
                    <div className="flex justify-between items-center border-b pb-2">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2">
                            {t('Cấu hình biến thể', 'Variants Config')}
                        </h3>
                        <button type="button" onClick={addVariant} className="text-sm bg-blue-50 text-blue-600 px-3 py-1 rounded-lg hover:bg-blue-100 flex items-center gap-1 font-medium transition">
                            <Plus size={16}/> {t('Thêm dòng', 'Add Row')}
                        </button>
                    </div>

                    {uiVariants.length === 0 ? (
                        <p className="text-sm text-slate-400 italic text-center py-4">
                            {t('Sản phẩm này chưa có biến thể (Bán theo giá gốc).', 'No variants configured.')}
                        </p>
                    ) : (
                        <div className="space-y-3">
                            <div className="grid grid-cols-12 gap-2 text-xs font-bold text-slate-500 uppercase bg-slate-50 p-2 rounded">
                                <div className="col-span-5">{t('Tên hiển thị', 'Label')}</div>
                                <div className="col-span-4">{t('Mã SKU (API/Key)', 'SKU Code')}</div>
                                <div className="col-span-2">{t('Giá riêng', 'Price')}</div>
                                <div className="col-span-1"></div>
                            </div>
                            {uiVariants.map((v, idx) => (
                                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                                    <div className="col-span-5">
                                        <input 
                                            placeholder="VD: 50k, 123..."
                                            className="w-full border p-2 rounded focus:border-blue-500 outline-none"
                                            value={v.name}
                                            onChange={e => updateVariant(idx, 'name', e.target.value)}
                                        />
                                    </div>
                                    <div className="col-span-4 relative">
                                        <input 
                                            placeholder="AUTO..."
                                            className="w-full border p-2 rounded font-mono text-sm text-blue-600 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none"
                                            value={v.code}
                                            onChange={e => updateVariant(idx, 'code', e.target.value)}
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <input 
                                            type="number"
                                            placeholder="0"
                                            className="w-full border p-2 rounded text-right focus:border-blue-500 outline-none"
                                            value={v.price}
                                            onChange={e => updateVariant(idx, 'price', Number(e.target.value))}
                                        />
                                    </div>
                                    <div className="col-span-1 text-center">
                                        <button type="button" onClick={() => removeVariant(idx)} className="text-red-400 hover:text-red-600 transition">
                                            <Trash2 size={18}/>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    {uiVariants.length > 0 && (
                        <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 flex gap-2 items-start text-xs text-yellow-700 mt-2">
                            <AlertCircle size={14} className="mt-0.5 shrink-0"/>
                            <p>
                                {t(
                                    'Lưu ý: "Tên hiển thị" cần khớp với "Value" trong bảng Product Keys nếu bạn dùng key cũ.',
                                    'Note: "Label" must match "Value" in Product Keys table for existing keys.'
                                )}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Cột phải: Ảnh & Action */}
            <div className="space-y-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-slate-700 mb-4 border-b pb-2">{t('Hình ảnh', 'Images')}</h3>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                        {product.images?.map((img, i) => (
                            <img key={i} src={img} className="w-full h-24 object-cover rounded border" alt="prod" />
                        ))}
                    </div>
                    <label className="block w-full border-2 border-dashed border-slate-300 rounded-xl p-4 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition text-slate-500">
                        <Upload className="mx-auto mb-2" size={24}/>
                        <span className="text-sm">{t('Tải ảnh lên', 'Upload Image')}</span>
                        <input type="file" className="hidden" onChange={handleImageUpload}/>
                    </label>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                   <button disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-200 disabled:opacity-50 flex justify-center items-center gap-2">
                       {loading ? (
                           <span>{t('Đang lưu...', 'Saving...')}</span>
                       ) : (
                           <>
                               <Save size={18}/>
                               <span>{isEdit ? t('Cập nhật', 'Update') : t('Tạo mới', 'Create')}</span>
                           </>
                       )}
                   </button>
                </div>
            </div>
        </form>
    </div>
  );
}
