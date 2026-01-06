import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { Package, Plus, Edit, X, Upload, Key, Layers, Settings, Image as ImageIcon, Globe } from 'lucide-react';
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

  // Đếm tồn kho (Local Stock)
  const { data: stockCounts = {} } = useQuery({
    queryKey: ['admin-stock'],
    queryFn: async () => {
      // Logic đếm stock tổng (bao gồm cả variant)
      // Cần query phức tạp hơn hoặc tính toán ở Client nếu DB nhỏ. 
      // Ở đây ta lấy snapshot simple.
      const { data, error } = await supabase.from('products').select('id, physical_stock, variant_stocks');
      if (error) throw error;
      const map = {}; 
      data?.forEach(p => map[p.id] = p.physical_stock);
      return map;
    }
  });

  // Modal States
  const [showProductModal, setShowProductModal] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(null); // Object: { product: p, variant: comboObj }
  
  const [productForm, setProductForm] = useState({
    id: null, title: '', title_en: '', price: '', 
    description: '', description_en: '', is_digital: true, 
    physical_stock: 0, images: [], 
    variants: [], 
    variant_stocks: [],
    allow_external_key: false // NEW: Cờ cho phép lấy key qua API
  });
  
  const [keyInput, setKeyInput] = useState(''); 
  const [stockInput, setStockInput] = useState(0); 
  const [uploading, setUploading] = useState(false);
  const [variantUploading, setVariantUploading] = useState(false);

  // --- LOGIC TẠO MA TRẬN BIẾN THỂ (CARTESIAN PRODUCT) ---
  useEffect(() => {
    if (productForm.is_digital || !productForm.variants || productForm.variants.length === 0) {
        return;
    }

    const generateCombinations = (groups, prefix = {}) => {
        if (!groups.length) return [prefix];
        const firstGroup = groups[0];
        const restGroups = groups.slice(1);
        let combinations = [];
        
        if(!firstGroup.options || firstGroup.options.length === 0) {
             return generateCombinations(restGroups, prefix);
        }

        firstGroup.options.forEach(opt => {
            if (opt.label) {
                combinations = combinations.concat(
                    generateCombinations(restGroups, { ...prefix, [firstGroup.name]: opt.label })
                );
            }
        });
        return combinations;
    };

    const validVariants = productForm.variants.filter(v => v.name && v.options.length > 0);
    if(validVariants.length === 0) return;

    const combos = generateCombinations(validVariants);
    
    // Merge với dữ liệu cũ
    const mergedStocks = combos.map(combo => {
        const existing = productForm.variant_stocks?.find(s => 
            JSON.stringify(s.options) === JSON.stringify(combo)
        );
        return existing || { options: combo, stock: 0 };
    });

    // Chỉ cập nhật physical_stock nếu là SP vật lý
    const totalVariantStock = mergedStocks.reduce((sum, item) => sum + (parseInt(item.stock) || 0), 0);
    
    setProductForm(prev => {
        if(JSON.stringify(prev.variant_stocks?.map(x=>x.options)) === JSON.stringify(mergedStocks.map(x=>x.options)) 
           && prev.physical_stock === totalVariantStock) {
            return prev;
        }
        return {
            ...prev,
            variant_stocks: mergedStocks,
            physical_stock: totalVariantStock 
        };
    });

  }, [productForm.variants, productForm.is_digital]);

  const handleVariantStockChange = (idx, value) => {
      const newStocks = [...productForm.variant_stocks];
      newStocks[idx].stock = parseInt(value) || 0;
      const total = newStocks.reduce((sum, item) => sum + item.stock, 0);
      setProductForm(prev => ({ ...prev, variant_stocks: newStocks, physical_stock: total }));
  };

  // --- VARIANT HANDLERS ---
  const addVariantGroup = () => {
    setProductForm(prev => ({ ...prev, variants: [...(prev.variants || []), { name: '', options: [] }] }));
  };
  const removeVariantGroup = (index) => {
    setProductForm(prev => {
      const newVars = [...prev.variants];
      newVars.splice(index, 1);
      return { ...prev, variants: newVars };
    });
  };
  const updateVariantName = (index, name) => {
    setProductForm(prev => {
      const newVars = [...prev.variants];
      newVars[index].name = name;
      return { ...prev, variants: newVars };
    });
  };
  const addOptionToGroup = (groupIndex) => {
    setProductForm(prev => {
      const newVars = [...prev.variants];
      // NEW: label_en field
      newVars[groupIndex].options.push({ label: '', label_en: '', price_mod: 0, image: '' });
      return { ...prev, variants: newVars };
    });
  };
  const removeOptionFromGroup = (groupIndex, optionIndex) => {
    setProductForm(prev => {
      const newVars = [...prev.variants];
      newVars[groupIndex].options.splice(optionIndex, 1);
      return { ...prev, variants: newVars };
    });
  };
  const updateOption = (groupIndex, optionIndex, field, value) => {
    setProductForm(prev => {
      const newVars = [...prev.variants];
      newVars[groupIndex].options[optionIndex][field] = value;
      return { ...prev, variants: newVars };
    });
  };
  const handleVariantImageUpload = async (e, groupIndex, optionIndex) => {
      const file = e.target.files[0];
      if (!file) return;
      setVariantUploading(true);
      const fileName = `var-${Date.now()}`;
      try {
          const { error } = await supabase.storage.from('product-images').upload(fileName, file);
          if(error) throw error;
          const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
          updateOption(groupIndex, optionIndex, 'image', data.publicUrl);
          toast.success("OK!");
      } catch (err) { toast.error(err.message); } 
      finally { setVariantUploading(false); }
  };

  // --- BASIC HANDLERS ---
  const handleImageUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setUploading(true);
      const fileName = `prod-${Date.now()}`;
      const { error } = await supabase.storage.from('product-images').upload(fileName, file);
      if(error) { toast.error(error.message); setUploading(false); return; }
      const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
      setProductForm(prev => ({ ...prev, images: [...(prev.images || []), data.publicUrl] }));
      setUploading(false);
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
      setProductForm({
        id: p.id, title: p.title, title_en: p.title_en || '', price: p.price,
        description: p.description || '', description_en: p.description_en || '',
        is_digital: p.is_digital, physical_stock: p.physical_stock || 0, 
        images: p.images || [],
        variants: p.variants || [],
        variant_stocks: p.variant_stocks || [],
        allow_external_key: p.allow_external_key || false // NEW field
      });
      setShowProductModal(true);
  };

  const handleSaveProduct = async (e) => {
      e.preventDefault();
      const safeStock = productForm.is_digital ? 0 : (parseInt(productForm.physical_stock) || 0);
      const productData = {
          title: productForm.title, 
          title_en: productForm.title_en,
          price: parseFloat(productForm.price) || 0,
          description: productForm.description, 
          description_en: productForm.description_en,
          images: productForm.images,
          is_digital: productForm.is_digital,
          physical_stock: safeStock,
          variants: productForm.variants,
          variant_stocks: productForm.variant_stocks,
          allow_external_key: productForm.allow_external_key // SAVE FLAG
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
          toast.success(t("Lưu sản phẩm thành công!", "Product saved successfully!"));
      } catch (err) { toast.error(err.message); }
  };

  // --- LOGIC NHẬP KHO (KEY & STOCK) ---
  const handleImportStock = async () => {
    try {
        if (showKeyModal.product.is_digital) {
            // LOGIC MỚI: Nhập Key cho sản phẩm (có thể có hoặc không có variant)
            if (!keyInput.trim()) return;
            const codes = keyInput.split('\n').filter(c => c.trim() !== '');
            
            // Nếu đang nhập cho một Variant cụ thể
            const variantInfo = showKeyModal.variant ? showKeyModal.variant : {};
            
            const insertData = codes.map(code => ({ 
                product_id: showKeyModal.product.id, 
                key_value: code.trim(),
                variant_info: variantInfo, // Lưu thông tin variant vào key
                is_used: false 
            }));

            const { error } = await supabase.from('product_keys').insert(insertData);
            if (error) throw error;
            
            // Cập nhật lại số lượng tồn kho hiển thị (đếm lại)
            // (Tuỳ chọn: trigger backend tự tính, ở đây ta chỉ thông báo)
            toast.success(t(`Đã thêm ${insertData.length} Keys vào kho!`, `Added ${insertData.length} Keys to stock!`));
            
        } else {
            // Hàng vật lý
            const qtyToAdd = parseInt(stockInput);
            if (isNaN(qtyToAdd) || qtyToAdd <= 0) return toast.warn("Qty > 0");
            
            const { data: currentProd } = await supabase.from('products').select('physical_stock').eq('id', showKeyModal.product.id).single();
            const newStock = (currentProd.physical_stock || 0) + qtyToAdd;
            await supabase.from('products').update({ physical_stock: newStock }).eq('id', showKeyModal.product.id);
            toast.success("Stock updated!");
        }
        
        setKeyInput(''); setStockInput(0); setShowKeyModal(null);
        queryClient.invalidateQueries({ queryKey: ['admin-products'] });
        queryClient.invalidateQueries({ queryKey: ['admin-stock'] });
    } catch (err) { toast.error("Error: " + err.message); }
  };

  if (isLoading) return <div className="p-8 text-center">Loading Inventory...</div>;

  return (
    <div className="animate-fade-in">
       <div className="flex justify-between mb-6 items-center">
         <h2 className="text-2xl font-bold text-slate-800">{t('Kho Sản Phẩm', 'Inventory')}</h2>
         <button onClick={openAddModal} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow hover:bg-blue-700 transition"><Plus size={18}/> {t('Thêm Mới', 'Add New')}</button>
       </div>
       
       {/* TABLE PRODUCTS */}
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
                 <td className="p-4">
                     {p.allow_external_key ? <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold">API ON</span> : <span className="text-[10px] text-slate-400">Local Only</span>}
                 </td>
                 <td className="p-4"><span className={`px-2 py-1 rounded-md text-xs font-bold ${stockCounts[p.id]>0?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{stockCounts[p.id]||0}</span></td>
                 <td className="p-4 flex gap-2">
                    <button onClick={()=>openEditModal(p)} className="p-2 bg-slate-100 rounded hover:bg-blue-100 text-blue-600 transition"><Edit size={16}/></button>
                    {!p.variants?.length && (
                        <button onClick={()=>setShowKeyModal({product: p, variant: null})} className="p-2 bg-slate-100 rounded hover:bg-green-100 text-green-600 transition" title="Add Stock/Key"><Plus size={16}/></button>
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
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-sm font-bold mb-1.5 text-slate-600">Type</label>
                            <select className="w-full border p-2.5 rounded-lg outline-none bg-white" value={productForm.is_digital ? 'digital' : 'physical'} onChange={e => setProductForm({...productForm, is_digital: e.target.value === 'digital', physical_stock: 0})}>
                                <option value="digital">Digital (Key)</option>
                                <option value="physical">Physical (Ship)</option>
                            </select>
                        </div>
                    </div>
                 </div>

                 {/* API KEY TOGGLE */}
                 {productForm.is_digital && (
                     <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
                         <input type="checkbox" id="apiKeyToggle" className="mt-1 w-4 h-4" checked={productForm.allow_external_key} onChange={e => setProductForm({...productForm, allow_external_key: e.target.checked})} />
                         <div>
                             <label htmlFor="apiKeyToggle" className="block text-sm font-bold text-blue-800">Get Key over API if Out of Stock</label>
                             <p className="text-xs text-blue-600 mt-1">
                                 Nếu bật: Khi kho hết key, hệ thống sẽ gọi API lấy key và gửi khách (Telegram thông báo).<br/>
                                 Nếu tắt: Kho hết key sẽ báo "Out of Stock" (Hết hàng).
                             </p>
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
                                    <label className="text-xs font-bold text-slate-500 uppercase">Option Name (e.g. Color, RAM)</label>
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

                    {/* MANAGE VARIANT STOCK / KEYS */}
                    {!productForm.is_digital && productForm.variant_stocks.length > 0 && (
                        /* PHYSICAL STOCK TABLE */
                        <div className="mt-6 border-t pt-4">
                            <label className="block text-sm font-bold text-slate-700 mb-2">Manage Stock per Variant</label>
                            <div className="overflow-x-auto rounded-lg border border-slate-200">
                                <table className="w-full text-sm text-left bg-white">
                                    <thead className="bg-slate-100 text-xs uppercase text-slate-500"><tr><th className="p-3">Variant</th><th className="p-3 w-32">Stock</th></tr></thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {productForm.variant_stocks.map((item, idx) => (
                                            <tr key={idx}>
                                                <td className="p-3 font-medium text-slate-700">{Object.entries(item.options).map(([k, v]) => <span key={k} className="mr-2 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs border border-blue-100">{k}: {v}</span>)}</td>
                                                <td className="p-3"><input type="number" min="0" className="w-full border p-1.5 rounded text-center font-bold" value={item.stock} onChange={(e) => handleVariantStockChange(idx, e.target.value)}/></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                    
                    {/* DIGITAL KEYS GROUP MANAGEMENT */}
                    {productForm.is_digital && productForm.variant_stocks.length > 0 && (
                        <div className="mt-6 border-t pt-4">
                             <label className="block text-sm font-bold text-slate-700 mb-2">Manage Keys per Variant</label>
                             <div className="overflow-x-auto rounded-lg border border-slate-200">
                                <table className="w-full text-sm text-left bg-white">
                                    <thead className="bg-slate-100 text-xs uppercase text-slate-500"><tr><th className="p-3">Variant</th><th className="p-3 w-32">Action</th></tr></thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {productForm.variant_stocks.map((item, idx) => (
                                            <tr key={idx}>
                                                <td className="p-3 font-medium text-slate-700">{Object.entries(item.options).map(([k, v]) => <span key={k} className="mr-2 px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs border border-purple-100">{k}: {v}</span>)}</td>
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

                 {/* PHYSICAL STOCK TOTAL (READ ONLY IF VARIANTS EXIST) */}
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
               
               {/* SHOW CONTEXT IF VARIANT */}
               {showKeyModal.variant && (
                   <div className="mb-4 bg-purple-50 p-2 rounded text-xs text-purple-700 font-bold border border-purple-100">
                       Target Variant: {JSON.stringify(showKeyModal.variant)}
                   </div>
               )}

               {showKeyModal.product.is_digital ? (
                   <div>
                       <p className="text-xs text-slate-500 mb-2 font-medium uppercase">Enter keys (One per line)</p>
                       <textarea className="w-full border p-3 h-48 rounded-xl font-mono text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none resize-none" value={keyInput} onChange={e => setKeyInput(e.target.value)} placeholder="AAAA-BBBB-CCCC&#10;XXXX-YYYY-ZZZZ"></textarea>
                   </div>
               ) : (
                   <div className="bg-orange-50 p-6 rounded-xl border border-orange-100 text-center">
                       <p className="text-sm font-bold text-orange-800 mb-3 uppercase tracking-wide">Quantity to Add</p>
                       <input type="number" className="w-24 border p-2 rounded-lg text-center font-bold text-2xl text-slate-800 focus:ring-2 focus:ring-orange-500 outline-none" value={stockInput} onChange={e => setStockInput(e.target.value)}/>
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