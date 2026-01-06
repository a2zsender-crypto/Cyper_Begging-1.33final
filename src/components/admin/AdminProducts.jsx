import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { Package, Plus, Edit, X, Upload, Key, Layers, Settings, Image as ImageIcon, Trash2 } from 'lucide-react';
import { useLang } from '../../context/LangContext';
import { toast } from 'react-toastify';
import { useQuery, useQueryClient } from '@tanstack/react-query'; 

export default function AdminProducts() {
  const { t } = useLang();
  const queryClient = useQueryClient(); 
  
  // --- FETCH DATA ---
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['admin-products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').order('id', {ascending: false});
      if (error) throw error;
      return data;
    }
  });

  // --- SỬA ĐỔI QUAN TRỌNG: LOGIC ĐẾM STOCK CHUẨN XÁC ---
  const { data: stockCounts = {} } = useQuery({
    queryKey: ['admin-stock'],
    queryFn: async () => {
      // 1. Lấy thông tin cơ bản của tất cả sản phẩm
      const { data: allProds, error: prodError } = await supabase.from('products').select('id, physical_stock, is_digital');
      if (prodError) throw prodError;

      // 2. Lấy toàn bộ KEY chưa sử dụng từ bảng product_keys để đếm thực tế
      const { data: allKeys, error: keyError } = await supabase
        .from('product_keys')
        .select('product_id')
        .eq('is_used', false);
      
      if (keyError) throw keyError;

      const map = {}; 
      
      // 3. Tính toán lại kho
      allProds?.forEach(p => {
          if (p.is_digital) {
              // Nếu là Digital: Đếm số lượng key thực tế trong bảng keys
              // (Khắc phục lỗi lệch tồn kho khi sửa DB thủ công)
              const realCount = allKeys.filter(k => k.product_id === p.id).length;
              map[p.id] = realCount;
          } else {
              // Nếu là Vật lý: Sử dụng số lượng đã nhập trong bảng products
              map[p.id] = p.physical_stock || 0;
          }
      });
      return map;
    }
  });

  // Modal States
  const [showProductModal, setShowProductModal] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(null); // { product: p, variant: comboObj }
  
  const [productForm, setProductForm] = useState({
    id: null, title: '', title_en: '', price: '', 
    description: '', description_en: '', is_digital: true, 
    physical_stock: 0, images: [], 
    variants: [], 
    variant_stocks: [],
    allow_external_key: false 
  });
  
  const [keyInput, setKeyInput] = useState(''); 
  const [stockInput, setStockInput] = useState(0); 
  const [uploading, setUploading] = useState(false);
  const [variantUploading, setVariantUploading] = useState(false);

  // --- LOGIC TẠO MA TRẬN BIẾN THỂ ---
  useEffect(() => {
    if (!productForm.variants || productForm.variants.length === 0) {
        return;
    }

    const generateCombinations = (groups, prefix = {}) => {
        if (!groups.length) return [prefix];
        const firstGroup = groups[0];
        const restGroups = groups.slice(1);
        let combinations = [];
        if(!firstGroup.options || firstGroup.options.length === 0) return generateCombinations(restGroups, prefix);
        firstGroup.options.forEach(opt => {
            if (opt.label) combinations = combinations.concat(generateCombinations(restGroups, { ...prefix, [firstGroup.name]: opt.label }));
        });
        return combinations;
    };

    const validVariants = productForm.variants.filter(v => v.name && v.options.length > 0);
    if(validVariants.length === 0) return;

    const combos = generateCombinations(validVariants);
    
    // Merge với dữ liệu cũ
    const mergedStocks = combos.map(combo => {
        const existing = productForm.variant_stocks?.find(s => JSON.stringify(s.options) === JSON.stringify(combo));
        return existing || { options: combo, stock: 0 };
    });

    const totalVariantStock = mergedStocks.reduce((sum, item) => sum + (parseInt(item.stock) || 0), 0);
    
    setProductForm(prev => {
        const isSame = JSON.stringify(prev.variant_stocks?.map(x=>x.options)) === JSON.stringify(mergedStocks.map(x=>x.options));
        if(isSame) {
             if (!productForm.is_digital && prev.physical_stock !== totalVariantStock) {
                 return { ...prev, physical_stock: totalVariantStock };
             }
             return prev;
        }
        return { 
            ...prev, 
            variant_stocks: mergedStocks,
            physical_stock: productForm.is_digital ? prev.physical_stock : totalVariantStock 
        };
    });

  }, [productForm.variants, productForm.is_digital]);

  const handleVariantStockChange = (idx, value) => {
      if(productForm.is_digital) return; 
      const newStocks = [...productForm.variant_stocks];
      newStocks[idx].stock = parseInt(value) || 0;
      const total = newStocks.reduce((sum, item) => sum + item.stock, 0);
      setProductForm(prev => ({ ...prev, variant_stocks: newStocks, physical_stock: total }));
  };

  // --- VARIANT HANDLERS ---
  const addVariantGroup = () => setProductForm(prev => ({ ...prev, variants: [...(prev.variants || []), { name: '', options: [] }] }));
  const removeVariantGroup = (idx) => setProductForm(prev => { const n = [...prev.variants]; n.splice(idx, 1); return { ...prev, variants: n }; });
  const updateVariantName = (idx, val) => setProductForm(prev => { const n = [...prev.variants]; n[idx].name = val; return { ...prev, variants: n }; });
  const addOptionToGroup = (idx) => setProductForm(prev => { const n = [...prev.variants]; n[idx].options.push({ label: '', label_en: '', price_mod: 0, image: '' }); return { ...prev, variants: n }; });
  const removeOptionFromGroup = (gIdx, oIdx) => setProductForm(prev => { const n = [...prev.variants]; n[gIdx].options.splice(oIdx, 1); return { ...prev, variants: n }; });
  const updateOption = (gIdx, oIdx, field, val) => setProductForm(prev => { const n = [...prev.variants]; n[gIdx].options[oIdx][field] = val; return { ...prev, variants: n }; });

  const handleVariantImageUpload = async (e, gIdx, oIdx) => {
      const file = e.target.files[0];
      if (!file) return;
      setVariantUploading(true);
      try {
          const fileName = `var-${Date.now()}`;
          const { error } = await supabase.storage.from('product-images').upload(fileName, file);
          if(error) throw error;
          const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
          updateOption(gIdx, oIdx, 'image', data.publicUrl);
          toast.success("Đã tải ảnh biến thể!");
      } catch (err) { toast.error(err.message); } finally { setVariantUploading(false); }
  };

  // --- BASIC HANDLERS ---
  const handleImageUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setUploading(true);
      try {
          const fileName = `prod-${Date.now()}`;
          const { error } = await supabase.storage.from('product-images').upload(fileName, file);
          if(error) throw error;
          const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
          setProductForm(prev => ({ ...prev, images: [...(prev.images || []), data.publicUrl] }));
          toast.success("Upload ảnh thành công!");
      } catch (err) { toast.error(err.message); } finally { setUploading(false); }
  };
  const handleRemoveImage = (idx) => setProductForm(prev => ({...prev, images: prev.images.filter((_, i) => i !== idx)}));

  const openAddModal = () => {
      setProductForm({ 
        id: null, title: '', title_en: '', price: '', 
        description: '', description_en: '', is_digital: true, 
        physical_stock: 0, images: [], variants: [], variant_stocks: [], allow_external_key: false 
      });
      setShowProductModal(true);
  };
  const openEditModal = (p) => {
      // Khi mở modal, nếu là SP số, ta có thể dùng số lượng thực tế đã tính toán được
      // để hiển thị đúng trong form, tránh save đè số cũ.
      const realStock = p.is_digital ? (stockCounts[p.id] || 0) : (p.physical_stock || 0);

      setProductForm({
        id: p.id, title: p.title, title_en: p.title_en || '', price: p.price,
        description: p.description || '', description_en: p.description_en || '',
        is_digital: p.is_digital, 
        physical_stock: realStock, // Sử dụng số thực tế
        images: p.images || [], variants: p.variants || [],
        variant_stocks: p.variant_stocks || [], allow_external_key: p.allow_external_key || false
      });
      setShowProductModal(true);
  };

  const handleSaveProduct = async (e) => {
      e.preventDefault();
      
      const safeStock = parseInt(productForm.physical_stock) || 0;
      
      const productData = {
          title: productForm.title, title_en: productForm.title_en,
          price: parseFloat(productForm.price) || 0,
          description: productForm.description, description_en: productForm.description_en,
          images: productForm.images, is_digital: productForm.is_digital,
          physical_stock: safeStock,
          variants: productForm.variants,
          variant_stocks: productForm.variant_stocks, 
          allow_external_key: productForm.allow_external_key
      };
      
      try {
          if (productForm.id) {
              const { error } = await supabase.from('products').update(productData).eq('id', productForm.id);
              if (error) throw error;
          } else {
              const { error } = await supabase.from('products').insert(productData);
              if (error) throw error;
          }
          setShowProductModal(false);
          queryClient.invalidateQueries({ queryKey: ['admin-products'] });
          queryClient.invalidateQueries({ queryKey: ['admin-stock'] });
          toast.success(t("Lưu thành công!", "Saved successfully!"));
      } catch (err) { toast.error(err.message); }
  };

  // --- LOGIC NHẬP KHO ---
  const handleImportStock = async () => {
    try {
        if (!showKeyModal?.product) return;
        const currentProd = showKeyModal.product;
        
        let updatedPhysicalStock = 0;
        let updatedVariantStocks = [];

        if (currentProd.is_digital) {
            // 1. Nhập Key Digital
            if (!keyInput.trim()) return;
            const codes = keyInput.split('\n').filter(c => c.trim() !== '');
            
            let variantInfo = showKeyModal.variant ? { ...showKeyModal.variant } : {}; 
            const variantStr = showKeyModal.variant ? Object.values(showKeyModal.variant).join(' ') : '';
            const fullTitle = `${currentProd.title} ${variantStr}`.trim();
            
            variantInfo = {
                ...variantInfo,
                _product_name: currentProd.title,
                _full_title: fullTitle
            };

            const insertData = codes.map(code => ({ 
                product_id: currentProd.id, 
                key_value: code.trim(),
                variant_info: variantInfo, 
                is_used: false 
            }));

            const { error } = await supabase.from('product_keys').insert(insertData);
            if (error) throw error;

            // 2. Cập nhật cache stock trong bảng products (để đồng bộ)
            const countToAdd = insertData.length;
            const { data: latestProd } = await supabase.from('products').select('*').eq('id', currentProd.id).single();
            
            updatedPhysicalStock = (latestProd.physical_stock || 0) + countToAdd;
            updatedVariantStocks = latestProd.variant_stocks || [];

            if (showKeyModal.variant) {
                const vIndex = updatedVariantStocks.findIndex(v => JSON.stringify(v.options) === JSON.stringify(showKeyModal.variant));
                if (vIndex >= 0) {
                    updatedVariantStocks[vIndex].stock = (parseInt(updatedVariantStocks[vIndex].stock) || 0) + countToAdd;
                } else {
                    updatedVariantStocks.push({ options: showKeyModal.variant, stock: countToAdd });
                }
            }

            await supabase.from('products').update({
                physical_stock: updatedPhysicalStock,
                variant_stocks: updatedVariantStocks
            }).eq('id', currentProd.id);

            toast.success(t(`Đã thêm ${countToAdd} Keys!`, `Added ${countToAdd} Keys!`));

        } else {
            // Nhập kho Vật lý
            const qtyToAdd = parseInt(stockInput);
            if (isNaN(qtyToAdd) || qtyToAdd <= 0) return toast.warn("Số lượng > 0");
            
            const { data: latestProd } = await supabase.from('products').select('*').eq('id', currentProd.id).single();
            updatedPhysicalStock = (latestProd.physical_stock || 0) + qtyToAdd;
            
            await supabase.from('products').update({ physical_stock: updatedPhysicalStock }).eq('id', currentProd.id);
            toast.success("Đã cập nhật kho!");
        }
        
        // Update form state if matching
        if (productForm.id === currentProd.id) {
            setProductForm(prev => ({
                ...prev,
                physical_stock: updatedPhysicalStock,
                variant_stocks: updatedVariantStocks.length > 0 ? updatedVariantStocks : prev.variant_stocks
            }));
        }

        setKeyInput(''); setStockInput(0); setShowKeyModal(null);
        queryClient.invalidateQueries({ queryKey: ['admin-products'] });
        queryClient.invalidateQueries({ queryKey: ['admin-stock'] }); // Trigger fetch lại số đúng

    } catch (err) { toast.error("Lỗi: " + err.message); }
  };

  if (isLoading) return <div className="p-8 text-center">Loading Inventory...</div>;

  return (
    <div className="animate-fade-in">
       <div className="flex justify-between mb-6 items-center">
         <h2 className="text-2xl font-bold text-slate-800">{t('Kho Sản Phẩm', 'Inventory')}</h2>
         <button onClick={openAddModal} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow hover:bg-blue-700 transition"><Plus size={18}/> {t('Thêm Mới', 'Add New')}</button>
       </div>
       
       <div className="bg-white shadow-sm rounded-xl overflow-hidden border border-slate-200">
         <table className="w-full text-left">
           <thead className="bg-slate-50 border-b text-slate-500 text-xs uppercase font-bold tracking-wider"><tr><th className="p-4">Product</th><th className="p-4">Type</th><th className="p-4">API Mode</th><th className="p-4">Stock</th><th className="p-4">Action</th></tr></thead>
           <tbody className="divide-y divide-slate-100">
             {products.map(p => (
               <tr key={p.id} className="hover:bg-slate-50 transition">
                 <td className="p-4 flex gap-3 items-center">
                    <img src={p.images?.[0]} className="w-10 h-10 rounded object-cover bg-slate-100 border"/> 
                    <div>
                        <span className="font-medium text-sm text-slate-700 block">{p.title}</span>
                        {p.variants?.length > 0 && <span className="text-[10px] bg-purple-100 text-purple-700 px-1 rounded border border-purple-200">{p.variants.length} Option Groups</span>}
                    </div>
                 </td>
                 <td className="p-4 text-xs font-medium text-slate-500">{p.is_digital ? 'Digital' : 'Physical'}</td>
                 <td className="p-4">{p.allow_external_key ? <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold">API ON</span> : <span className="text-[10px] text-slate-400">Local Only</span>}</td>
                 <td className="p-4"><span className={`px-2 py-1 rounded-md text-xs font-bold ${stockCounts[p.id]>0?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{stockCounts[p.id]||0}</span></td>
                 <td className="p-4 flex gap-2">
                    <button onClick={()=>openEditModal(p)} className="p-2 bg-slate-100 rounded hover:bg-blue-100 text-blue-600 transition"><Edit size={16}/></button>
                    {!p.variants?.length && (
                        <button onClick={()=>setShowKeyModal({product: p, variant: null})} className="p-2 bg-slate-100 rounded hover:bg-green-100 text-green-600 transition"><Plus size={16}/></button>
                    )}
                 </td>
               </tr>
             ))}
           </tbody>
         </table>
       </div>

       {/* MODAL EDIT PRODUCT */}
       {showProductModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
           <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-auto animate-scale-in">
              <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-slate-800">{productForm.id ? 'Edit Product' : 'Add New Product'}</h2>
                  <button onClick={() => setShowProductModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition"><X size={20}/></button>
              </div>
              <form onSubmit={handleSaveProduct} className="space-y-6">
                 {/* BASIC INFO */}
                 <div className="grid grid-cols-2 gap-5">
                    <div><label className="block text-sm font-bold mb-1.5 text-slate-600">Title (VN)</label><input required className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={productForm.title} onChange={e=>setProductForm({...productForm, title: e.target.value})}/></div>
                    <div><label className="block text-sm font-bold mb-1.5 text-slate-600">Title (EN)</label><input className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={productForm.title_en} onChange={e=>setProductForm({...productForm, title_en: e.target.value})}/></div>
                 </div>
                 <div className="grid grid-cols-2 gap-5">
                    <div><label className="block text-sm font-bold mb-1.5 text-slate-600">Base Price (USDT)</label><input type="number" step="0.01" required className="w-full border p-2.5 rounded-lg font-mono font-bold text-green-600 focus:ring-2 focus:ring-blue-500 outline-none" value={productForm.price} onChange={e=>setProductForm({...productForm, price: e.target.value})}/></div>
                    <div>
                         <label className="block text-sm font-bold mb-1.5 text-slate-600">Type</label>
                         <select className="w-full border p-2.5 rounded-lg outline-none bg-white" value={productForm.is_digital ? 'digital' : 'physical'} onChange={e => setProductForm({...productForm, is_digital: e.target.value === 'digital'})}>
                             <option value="digital">Digital (Key)</option>
                             <option value="physical">Physical (Ship)</option>
                         </select>
                    </div>
                 </div>

                 {productForm.is_digital && (
                     <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
                         <input type="checkbox" id="apiKeyToggle" className="mt-1 w-4 h-4" checked={productForm.allow_external_key} onChange={e => setProductForm({...productForm, allow_external_key: e.target.checked})} />
                         <div>
                             <label htmlFor="apiKeyToggle" className="block text-sm font-bold text-blue-800">Get Key over API if Out of Stock</label>
                             <p className="text-xs text-blue-600 mt-1">Bật: Khi hết key Local, tự gọi API lấy key và gửi khách.</p>
                         </div>
                     </div>
                 )}
                 
                 {/* VARIANTS SECTION */}
                 <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                    <div className="flex justify-between items-center mb-3">
                        <label className="block text-sm font-bold text-slate-700 flex items-center gap-2"><Settings size={16}/> Product Options (Variants)</label>
                        <button type="button" onClick={addVariantGroup} className="text-xs bg-slate-200 hover:bg-slate-300 px-3 py-1.5 rounded-lg font-bold transition">+ Add Option Group</button>
                    </div>
                    <div className="space-y-4 mb-4">
                        {productForm.variants?.map((group, gIdx) => (
                            <div key={gIdx} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm relative group">
                                <button type="button" onClick={() => removeVariantGroup(gIdx)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 transition"><X size={16}/></button>
                                <div className="mb-3">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Option Name</label>
                                    <input type="text" placeholder="Name" className="block w-full border-b focus:border-blue-500 outline-none py-1 text-sm font-medium" value={group.name} onChange={(e) => updateVariantName(gIdx, e.target.value)} />
                                </div>
                                <div>
                                    <div className="space-y-2 mb-2">
                                        {group.options?.map((opt, oIdx) => (
                                            <div key={oIdx} className="flex items-center gap-2">
                                                <input placeholder="Label (VN)" className="flex-1 border p-1.5 rounded text-sm" value={opt.label} onChange={e => updateOption(gIdx, oIdx, 'label', e.target.value)} />
                                                <input placeholder="Label (EN)" className="flex-1 border p-1.5 rounded text-sm bg-slate-50" value={opt.label_en} onChange={e => updateOption(gIdx, oIdx, 'label_en', e.target.value)} />
                                                <div className="flex items-center gap-1 bg-green-50 px-2 rounded border border-green-100">
                                                    <span className="text-xs text-green-600 font-bold">+</span>
                                                    <input type="number" step="0.01" placeholder="0" className="w-16 bg-transparent p-1.5 text-sm font-mono outline-none" value={opt.price_mod} onChange={e => updateOption(gIdx, oIdx, 'price_mod', e.target.value)} />
                                                    <span className="text-xs text-green-600 font-bold">$</span>
                                                </div>
                                                <label className={`w-9 h-9 flex items-center justify-center rounded border cursor-pointer hover:bg-slate-100 transition relative overflow-hidden ${opt.image ? 'border-blue-500' : 'border-slate-200'}`}>
                                                    {opt.image ? <img src={opt.image} className="w-full h-full object-cover" /> : <ImageIcon size={14} className="text-slate-400"/>}
                                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleVariantImageUpload(e, gIdx, oIdx)} disabled={variantUploading}/>
                                                </label>
                                                <button type="button" onClick={() => removeOptionFromGroup(gIdx, oIdx)} className="text-slate-400 hover:text-red-500"><X size={14}/></button>
                                            </div>
                                        ))}
                                    </div>
                                    <button type="button" onClick={() => addOptionToGroup(gIdx)} className="text-xs text-blue-600 hover:underline font-medium">+ Add Value</button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {productForm.is_digital && productForm.variant_stocks.length > 0 && (
                        <div className="mt-6 border-t pt-4">
                             <label className="block text-sm font-bold text-slate-700 mb-2">Manage Keys per Variant</label>
                             <div className="overflow-x-auto rounded-lg border border-slate-200">
                                <table className="w-full text-sm text-left bg-white">
                                    <thead className="bg-slate-100 text-xs uppercase text-slate-500"><tr><th className="p-3">Variant</th><th className="p-3 w-32">Stock</th><th className="p-3 w-32">Action</th></tr></thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {productForm.variant_stocks.map((item, idx) => (
                                            <tr key={idx}>
                                                <td className="p-3 font-medium text-slate-700">{Object.entries(item.options).map(([k, v]) => <span key={k} className="mr-2 px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs border border-purple-100">{k}: {v}</span>)}</td>
                                                <td className="p-3 font-bold text-center">{item.stock}</td>
                                                <td className="p-3">
                                                    <button type="button" onClick={() => setShowKeyModal({product: productForm, variant: item.options})} className="flex items-center gap-1 bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-black transition">
                                                        <Key size={12}/> Add Keys
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                 </div>

                 {productForm.is_digital && (!productForm.variants || productForm.variants.length === 0) && (
                     <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 flex justify-between items-center">
                         <div>
                            <label className="block text-sm font-bold text-purple-800 mb-1">Digital Stock (No Variants)</label>
                            <p className="text-xs text-purple-600">Total keys available: <strong className="text-lg">{productForm.physical_stock}</strong></p>
                         </div>
                         <button type="button" onClick={() => {
                             if(!productForm.id) return toast.warn("Please save product first!");
                             setShowKeyModal({product: productForm, variant: null});
                         }} className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-purple-700 transition shadow-sm">
                             <Key size={16}/> Add Keys
                         </button>
                     </div>
                 )}

                 {!productForm.is_digital && (
                     <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                         <label className="block text-sm font-bold text-orange-800 mb-1">Physical Stock (Total)</label>
                         <input type="number" className={`w-full border p-2.5 rounded-lg ${productForm.variants?.length > 0 ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white'}`} value={productForm.physical_stock} onChange={e=>setProductForm({...productForm, physical_stock: e.target.value})} readOnly={productForm.variants?.length > 0}/>
                     </div>
                 )}
                 
                 <div className="grid grid-cols-2 gap-5">
                     <div><label className="block text-sm font-bold mb-1.5 text-slate-600">Description (VN)</label><textarea className="w-full border p-2.5 rounded-lg h-28 resize-none focus:ring-2 focus:ring-blue-500 outline-none" value={productForm.description} onChange={e=>setProductForm({...productForm, description: e.target.value})}></textarea></div>
                     <div><label className="block text-sm font-bold mb-1.5 text-slate-600">Description (EN)</label><textarea className="w-full border p-2.5 rounded-lg h-28 resize-none focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" value={productForm.description_en} onChange={e=>setProductForm({...productForm, description_en: e.target.value})}></textarea></div>
                 </div>
                 <div>
                    <label className="block text-sm font-bold mb-2 text-slate-600">Images</label>
                    <div className="flex flex-wrap gap-3 mb-3">
                        {productForm.images && productForm.images.map((img, idx) => (
                            <div key={idx} className="relative group w-24 h-24 border rounded-lg overflow-hidden shadow-sm">
                                <img src={img} className="w-full h-full object-cover"/>
                                <button type="button" onClick={() => handleRemoveImage(idx)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow hover:bg-red-600 opacity-0 group-hover:opacity-100 transition"><X size={12}/></button>
                            </div>
                        ))}
                    </div>
                    <label className="cursor-pointer inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-medium transition text-slate-600">
                        <Upload size={16}/> {uploading ? 'Uploading...' : 'Add Image'}
                        <input type="file" className="hidden" onChange={e => handleImageUpload(e)} disabled={uploading}/>
                    </label>
                 </div>
                 <div className="flex justify-end gap-3 mt-6 pt-4 border-t"><button type="button" onClick={() => setShowProductModal(false)} className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition">Cancel</button><button disabled={uploading || variantUploading} className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow transition">Save Product</button></div>
              </form>
           </div>
        </div>
      )}

      {/* MODAL IMPORT STOCK / KEY */}
      {showKeyModal && (
         <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md animate-scale-in">
               <h3 className="font-bold mb-4 text-lg text-slate-800 flex items-center gap-2">
                   {showKeyModal.product.is_digital ? <Key className="text-blue-600"/> : <Layers className="text-orange-600"/>}
                   {showKeyModal.product.is_digital ? 'Import Keys' : 'Add Stock'}
               </h3>
               {showKeyModal.variant && <div className="mb-4 bg-purple-50 p-2 rounded text-xs text-purple-700 font-bold border border-purple-100">Variant: {Object.values(showKeyModal.variant).join(' / ')}</div>}
               {showKeyModal.product.is_digital ? (
                   <div>
                       <p className="text-xs text-slate-500 mb-2 font-medium uppercase">Enter keys (One per line)</p>
                       <textarea className="w-full border p-3 h-48 rounded-xl font-mono text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none resize-none" value={keyInput} onChange={e => setKeyInput(e.target.value)} placeholder="AAAA-BBBB-CCCC&#10;XXXX-YYYY-ZZZZ"></textarea>
                   </div>
               ) : (
                   <div className="bg-orange-50 p-6 rounded-xl border border-orange-100 text-center">
                       <input type="number" className="w-24 border p-2 rounded-lg text-center font-bold text-2xl" value={stockInput} onChange={e => setStockInput(e.target.value)}/>
                   </div>
               )}
               <div className="flex justify-end gap-2 mt-6">
                   <button onClick={() => setShowKeyModal(null)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg font-medium transition">Close</button>
                   <button onClick={handleImportStock} className="px-6 py-2 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-900 shadow transition">Save</button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
