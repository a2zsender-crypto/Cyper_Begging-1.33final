import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { toast } from 'react-toastify';
import { Save, ArrowLeft, Plus, Trash2, Upload, Zap, AlertCircle } from 'lucide-react';
import { useLang } from '../../context/LangContext';

// Helper tạo Slug
const generateSlug = (text) => {
  if (!text) return '';
  return text.toString().toLowerCase().trim()
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
    allow_api_restock: false, 
    images: [],
    variants: [] // Cấu trúc GỐC: [{ name: "Mệnh giá", options: [{label: "10k", value: "10k", code: "VTT10"}] }]
  });

  // UI State: Dùng để hứng dữ liệu hiển thị (chỉ lấy nhóm đầu tiên để đơn giản hóa giao diện nhập liệu như bạn muốn)
  const [uiVariants, setUiVariants] = useState([]);

  useEffect(() => {
    if (isEdit) fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
    if (error) { toast.error(t('Lỗi tải sản phẩm', 'Error loading product')); return; }
    
    setProduct({
        ...data,
        allow_api_restock: data.allow_api_restock === true
    });

    // MAP DỮ LIỆU GỐC LÊN UI
    // Lấy nhóm biến thể đầu tiên (thường là Mệnh giá) để hiển thị ra bảng nhập liệu
    if (data.variants && Array.isArray(data.variants) && data.variants.length > 0) {
        const group = data.variants[0];
        if (group.options) {
            const mapped = group.options.map(opt => ({
                name: opt.label || opt.value, // Label hiển thị
                code: opt.code || '',         // Code API (nếu có)
                price: opt.price_mod || 0
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

  // --- UI HANDLERS ---
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
      // Auto-fill SKU nếu chưa có và chưa bật API mode
      if (field === 'name' && (!newVars[index].code || !product.allow_api_restock)) {
           newVars[index].code = generateSlug(value).toUpperCase();
      }
      setUiVariants(newVars);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);

    // --- ĐÓNG GÓI DỮ LIỆU CHUẨN CẤU TRÚC GỐC ---
    // Tạo lại cấu trúc lồng nhau: variants -> options
    let finalVariants = [];
    if (uiVariants.length > 0) {
        finalVariants = [{
            name: "Mệnh giá", // Tên nhóm mặc định
            options: uiVariants.map(v => ({
                label: v.name,      // QUAN TRỌNG: Client dùng cái này để hiển thị
                value: v.name,      // QUAN TRỌNG: Client dùng cái này để check stock (Nó phải khớp với variant_info->>'value')
                label_en: v.name,   
                price_mod: Number(v.price),
                code: v.code || generateSlug(v.name).toUpperCase(), // Dữ liệu mới cho API
                image: ""           // Giữ nguyên cấu trúc
            }))
        }];
    }

    const payload = { 
        ...product, 
        variants: finalVariants,
        allow_api_restock: product.allow_api_restock
    };
    
    delete payload.id; 
    delete payload.created_at;
    delete payload.variants_config; // Xóa cột rác

    let error;
    if (isEdit) {
      ({ error } = await supabase.from('products').update(payload).eq('id', id));
    } else {
      ({ error } = await supabase.from('products').insert(payload));
    }

    setLoading(false);
    if (error) toast.error("Database Error: " + error.message);
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

                    {/* API CHECKBOX */}
                    {product.is_digital && (
                        <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 flex items-start gap-3 mt-2">
                             <input type="checkbox" className="mt-1 w-5 h-5 text-indigo-600 rounded cursor-pointer"
                                checked={product.allow_api_restock}
                                onChange={e => setProduct({...product, allow_api_restock: e.target.checked})}
                            />
                            <div>
                                <label className="block text-sm font-bold text-indigo-900 flex items-center gap-2">
                                    <Zap size={16}/> {t("Get Key over API if Out of Stock", "Get Key over API")}
                                </label>
                                <p className="text-xs text-indigo-700 mt-1">
                                    {t("Bật: Dùng Mã SKU bên dưới để gọi API khi hết kho.", "Enable: Use SKU below for API calls.")}
                                </p>
                            </div>
                        </div>
                    )}
                    
                    <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">{t('Giá mặc định', 'Default Price')}</label>
                        <input type="number" className="w-full border p-2 rounded-lg font-mono"
                            value={product.price} onChange={e=>setProduct({...product, price: Number(e.target.value)})}
                        />
                    </div>
                </div>

                {/* CẤU HÌNH BIẾN THỂ (Giao diện phẳng -> Lưu lồng nhau) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
                    <div className="flex justify-between items-center border-b pb-2">
                        <h3 className="font-bold text-slate-700">{t('Cấu hình biến thể', 'Variants')}</h3>
                        <button type="button" onClick={addVariant} className="text-sm bg-blue-50 text-blue-600 px-3 py-1 rounded-lg flex items-center gap-1 font-medium">
                            <Plus size={16}/> {t('Thêm dòng', 'Add Row')}
                        </button>
                    </div>

                    {uiVariants.length === 0 ? (
                        <p className="text-sm text-slate-400 italic text-center py-4">{t('Chưa có biến thể.', 'No variants.')}</p>
                    ) : (
                        <div className="space-y-3">
                            <div className="grid grid-cols-12 gap-2 text-xs font-bold text-slate-500 uppercase bg-slate-50 p-2 rounded">
                                <div className="col-span-5">{t('Tên hiển thị', 'Label')}</div>
                                <div className="col-span-4 flex items-center gap-1">Mã SKU {product.allow_api_restock && <Zap size={10} className="text-indigo-600"/>}</div>
                                <div className="col-span-2">{t('Giá (+/-)', 'Price')}</div>
                                <div className="col-span-1"></div>
                            </div>
                            {uiVariants.map((v, idx) => (
                                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                                    <div className="col-span-5">
                                        <input className="w-full border p-2 rounded outline-none focus:border-blue-500"
                                            placeholder="VD: 50k" value={v.name}
                                            onChange={e => updateVariant(idx, 'name', e.target.value)}
                                        />
                                    </div>
                                    <div className="col-span-4">
                                        <input 
                                            readOnly={!product.allow_api_restock}
                                            className={`w-full border p-2 rounded font-mono text-sm outline-none ${product.allow_api_restock ? 'bg-white border-indigo-300 text-indigo-700 font-bold' : 'bg-slate-100 text-slate-400'}`}
                                            placeholder="AUTO" value={v.code}
                                            onChange={e => updateVariant(idx, 'code', e.target.value)}
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <input type="number" className="w-full border p-2 rounded text-right outline-none"
                                            placeholder="0" value={v.price}
                                            onChange={e => updateVariant(idx, 'price', Number(e.target.value))}
                                        />
                                    </div>
                                    <div className="col-span-1 text-center">
                                        <button type="button" onClick={() => removeVariant(idx)} className="text-red-400 hover:text-red-600">
                                            <Trash2 size={18}/>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

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
                       {loading ? <span>Saving...</span> : <><Save size={18}/><span>{isEdit ? t('Cập nhật', 'Update') : t('Tạo mới', 'Create')}</span></>}
                   </button>
                </div>
            </div>
        </form>
    </div>
  );
}
