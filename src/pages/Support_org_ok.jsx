import { useEffect, useState } from 'react';
import { useLang } from '../context/LangContext';
import { supabase } from '../supabaseClient';
import { 
  RotateCcw, CreditCard, HelpCircle, FileText, Headset, 
  Box, Bitcoin, AlertTriangle, CheckCircle, Ticket, MessageSquare, Mail,
  ChevronRight, Scale, ShieldCheck, ShoppingCart, QrCode
} from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'; // [MỚI] Thêm useNavigate, useSearchParams

export default function Support() {
  const { t } = useLang(); 
  const [activeSection, setActiveSection] = useState('returns');
  const [settings, setSettings] = useState({});
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // 1. Load Settings
  useEffect(() => {
    supabase.from('site_settings').select('*').eq('is_public', true)
      .then(({ data }) => {
        const conf = {}; data?.forEach(i => conf[i.key] = i.value);
        setSettings(conf);
      });
  }, []);

  // [MỚI] 2. LOGIC TỰ ĐỘNG CHUYỂN HƯỚNG TICKET
  // Vì trang Support chỉ là trang thông tin, nếu URL có ticketId thì chuyển sang trang /contact
  // để mở giao diện chat ticket.
  useEffect(() => {
      const ticketId = searchParams.get('ticketId');
      if (ticketId) {
          // Chuyển hướng sang trang Contact và giữ nguyên tham số ticketId
          navigate(`/contact?ticketId=${ticketId}`, { replace: true });
      }
  }, [searchParams, navigate]);

  // 3. Logic Scroll Spy
  useEffect(() => {
    const handleScroll = () => {
      const sections = ['returns', 'payment', 'faq', 'terms', 'support'];
      const scrollPosition = window.scrollY + 200; 

      for (const section of sections) {
        const element = document.getElementById(section);
        if (element && element.offsetTop <= scrollPosition && (element.offsetTop + element.offsetHeight) > scrollPosition) {
          setActiveSection(section);
        }
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 4. Auto Scroll from Link (Hash handling)
  useEffect(() => {
      if (location.hash) {
          const id = location.hash.replace('#', '');
          setTimeout(() => scrollTo(id), 100);
      }
  }, [location]);

  const scrollTo = (id) => {
    const element = document.getElementById(id);
    if (element) {
      const headerOffset = 140; 
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
      setActiveSection(id);
    }
  };

  return (
    <div className="max-w-7xl mx-auto md:flex gap-12 py-12 relative px-4 md:px-0">
      
      {/* === SIDEBAR (GIỮ NGUYÊN) === */}
      <aside className="hidden md:block w-72 flex-shrink-0">
        <div className="sticky top-32 bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-100 font-bold text-gray-700 uppercase text-xs tracking-wider">
              {t('Danh mục hỗ trợ', 'Support Menu')}
          </div>
          <ul className="flex flex-col">
            {[
              { id: 'returns', icon: RotateCcw, label: t('Chính sách Đổi trả', 'Return Policy') },
              { id: 'payment', icon: CreditCard, label: t('Hướng dẫn Thanh toán', 'Payment Guide') },
              { id: 'faq', icon: HelpCircle, label: t('Câu hỏi Thường gặp', 'FAQ') },
              { id: 'terms', icon: FileText, label: t('Điều khoản Dịch vụ', 'Terms of Service') },
              { id: 'support', icon: Headset, label: t('Kênh Hỗ trợ', 'Support Channels') },
            ].map((item) => (
              <li key={item.id} className="border-b border-gray-50 last:border-0">
                <button 
                  onClick={() => scrollTo(item.id)}
                  className={`w-full text-left px-5 py-4 flex items-center gap-3 transition-all font-medium text-sm
                    ${activeSection === item.id 
                      ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600' 
                      : 'text-gray-600 hover:bg-gray-50 hover:text-blue-600 border-l-4 border-transparent'}`}
                >
                  <item.icon size={18} className={activeSection === item.id ? 'text-blue-600' : 'text-gray-400'} />
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* === MAIN CONTENT (NỘI DUNG) === */}
      <main className="flex-1 min-w-0">

        {/* 1. CHÍNH SÁCH ĐỔI TRẢ */}
        <section id="returns" className="mb-24 scroll-mt-40">
          <div className="mb-8 border-b border-gray-200 pb-6">
            <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-blue-100 text-blue-600"><RotateCcw size={28} /></div>
                <h1 className="text-3xl font-bold text-slate-800">{t('Chính sách Đổi trả & Hoàn tiền', 'Return & Refund Policy')}</h1>
            </div>
            <p className="text-slate-500 leading-relaxed">
                {t('Tại CryptoShop, sự hài lòng của khách hàng là ưu tiên hàng đầu. Dưới đây là quy định chi tiết về việc đổi trả và hoàn tiền áp dụng cho các giao dịch thanh toán bằng tiền điện tử.', 
                   'At CryptoShop, customer satisfaction is our top priority. Below are the detailed regulations regarding returns and refunds applicable to cryptocurrency transactions.')}
            </p>
          </div>

          <div className="space-y-8">
            {/* Box 1: Điều kiện */}
            <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Box size={24} className="text-blue-600"/> {t('Điều kiện chấp nhận Đổi trả', 'Return Eligibility')}
                </h3>
                <div className="text-slate-600 text-sm space-y-4 leading-7">
                    <p>{t('Chúng tôi hỗ trợ đổi trả trong các trường hợp sau:', 'We support returns in the following cases:')}</p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>
                            <strong>{t('Sản phẩm Vật lý:', 'Physical Products:')}</strong> 
                            {t(' Được đổi trả trong vòng 07 ngày kể từ ngày nhận hàng nếu có lỗi từ nhà sản xuất hoặc hư hỏng do vận chuyển. Sản phẩm phải còn nguyên tem mác, chưa qua sử dụng và đầy đủ bao bì.', 
                               ' Returnable within 07 days of receipt if there is a manufacturer defect or shipping damage. Item must be unused, with original tags and packaging.')}
                        </li>
                        <li>
                            <strong>{t('Sản phẩm Số (Key/License):', 'Digital Products (Keys/Licenses):')}</strong> 
                            {t(' Do đặc thù bảo mật, chúng tôi KHÔNG hỗ trợ hoàn tiền hoặc đổi trả sau khi mã Key đã được gửi đi, trừ trường hợp Key bị lỗi kỹ thuật được xác nhận bởi hệ thống.', 
                               ' Due to security reasons, we do NOT support refunds or returns once the Key has been sent, unless there is a verified technical error.')}
                        </li>
                    </ul>
                </div>
            </div>

            {/* Box 2: Chính sách Crypto */}
            <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Bitcoin size={24} className="text-yellow-600"/> {t('Quy định Hoàn tiền Crypto', 'Crypto Refund Regulations')}
                </h3>
                <div className="text-slate-600 text-sm space-y-4 leading-7">
                    <p>{t('Do tính chất biến động mạnh và không thể đảo ngược của giao dịch Blockchain, chính sách hoàn tiền được áp dụng như sau:', 
                          'Due to the volatility and irreversibility of Blockchain transactions, the refund policy is applied as follows:')}</p>
                    
                    <div className="grid md:grid-cols-2 gap-4 mt-4">
                        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                            <h4 className="font-bold text-yellow-800 mb-2">{t('Giá trị hoàn lại', 'Refund Value')}</h4>
                            <p>{t('Được tính dựa trên giá trị Fiat (USD/USDT) tại thời điểm mua hàng, KHÔNG dựa trên số lượng coin đã gửi (nếu bạn thanh toán bằng BTC/ETH).', 
                                  'Calculated based on the Fiat value (USD/USDT) at the time of purchase, NOT based on the coin amount sent (if paid in BTC/ETH).')}</p>
                        </div>
                        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                            <h4 className="font-bold text-yellow-800 mb-2">{t('Đơn vị hoàn tiền', 'Refund Currency')}</h4>
                            <p>{t('Khoản hoàn lại sẽ được gửi dưới dạng USDT (mạng TRC20 hoặc BEP20) hoặc Voucher mua hàng tương đương giá trị.', 
                                  'Refunds will be sent as USDT (TRC20 or BEP20) or a Store Voucher of equivalent value.')}</p>
                        </div>
                    </div>
                    
                    <p className="italic text-slate-500 mt-2">
                        * {t('Lưu ý: Phí mạng lưới (Gas fee) khi quý khách chuyển tiền sẽ không được hoàn lại. Phí chuyển khoản hoàn tiền (nếu có) sẽ được trừ vào số tiền hoàn.', 
                             'Note: Network fees (Gas) incurred when sending payment are non-refundable. Refund transfer fees (if any) will be deducted from the refund amount.')}
                    </p>
                </div>
            </div>

            {/* Alert */}
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg flex gap-4 text-red-800 text-sm items-start">
                <AlertTriangle size={24} className="flex-shrink-0 mt-1" />
                <div>
                    <strong>{t('Thời gian xử lý:', 'Processing Time:')}</strong>
                    <p>{t('Quy trình xử lý hoàn tiền có thể mất từ 3-7 ngày làm việc tùy thuộc vào xác nhận của mạng lưới Blockchain và quy trình kiểm tra nội bộ.', 
                          'Refund processing may take 3-7 business days depending on Blockchain network confirmation and internal verification procedures.')}</p>
                </div>
            </div>
          </div>
        </section>

        {/* 2. HƯỚNG DẪN THANH TOÁN */}
        <section id="payment" className="mb-24 scroll-mt-40 border-t border-gray-100 pt-16">
            <div className="mb-8 border-b border-gray-200 pb-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-green-100 text-green-600"><CreditCard size={28} /></div>
                    <h2 className="text-3xl font-bold text-slate-800">{t('Hướng dẫn Thanh toán', 'Payment Guide')}</h2>
                </div>
                <p className="text-slate-500">{t('Hệ thống chấp nhận thanh toán tự động qua cổng OxaPay - An toàn, Ẩn danh và Nhanh chóng.', 
                                                 'Our system accepts automated payments via OxaPay - Secure, Anonymous, and Fast.')}</p>
            </div>

            <div className="space-y-6">
                {/* Step 1 */}
                <div className="flex gap-6 group">
                    <div className="flex flex-col items-center">
                        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 font-bold text-xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition shadow-sm border border-slate-200">1</div>
                        <div className="w-0.5 h-full bg-slate-100 my-2"></div>
                    </div>
                    <div className="pb-8">
                        <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2"><ShoppingCart size={18}/> {t('Tạo đơn hàng', 'Create Order')}</h3>
                        <p className="text-slate-600 text-sm leading-6">
                            {t('Chọn sản phẩm mong muốn, thêm vào giỏ hàng và điền đầy đủ thông tin nhận hàng (Email/Địa chỉ). Kiểm tra kỹ thông tin trước khi chuyển sang bước tiếp theo.', 
                               'Select desired products, add to cart, and fill in shipping info (Email/Address). Double-check information before proceeding.')}
                        </p>
                    </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-6 group">
                    <div className="flex flex-col items-center">
                        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 font-bold text-xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition shadow-sm border border-slate-200">2</div>
                        <div className="w-0.5 h-full bg-slate-100 my-2"></div>
                    </div>
                    <div className="pb-8">
                        <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2"><Bitcoin size={18}/> {t('Chọn loại tiền thanh toán', 'Select Cryptocurrency')}</h3>
                        <p className="text-slate-600 text-sm leading-6">
                            {t('Tại trang thanh toán, chọn phương thức "Thanh toán qua OxaPay". Sau đó chọn loại coin bạn muốn sử dụng (Ví dụ: USDT, BTC, ETH, LTC...). Chúng tôi khuyên dùng USDT (mạng TRC20 hoặc BEP20) để phí rẻ và xử lý nhanh.', 
                               'At checkout, select "Pay via OxaPay". Then choose your preferred coin (e.g., USDT, BTC, ETH, LTC...). We recommend USDT (TRC20 or BEP20) for low fees and fast processing.')}
                        </p>
                    </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-6 group">
                    <div className="flex flex-col items-center">
                        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 font-bold text-xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition shadow-sm border border-slate-200">3</div>
                        <div className="w-0.5 h-full bg-slate-100 my-2"></div>
                    </div>
                    <div className="pb-8">
                        <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2"><QrCode size={18}/> {t('Quét mã và Chuyển tiền', 'Scan & Transfer')}</h3>
                        <p className="text-slate-600 text-sm leading-6 mb-3">
                            {t('Hệ thống sẽ hiển thị Mã QR và Địa chỉ ví. Vui lòng thực hiện chuyển khoản với các lưu ý quan trọng sau:', 
                               'The system will display a QR Code and Wallet Address. Please transfer with the following critical notes:')}
                        </p>
                        <div className="bg-orange-50 border border-orange-100 p-4 rounded-lg text-sm text-orange-900">
                            <ul className="list-disc pl-5 space-y-1">
                                <li>{t('Chuyển ĐÚNG MẠNG LƯỚI (Network) đã chọn.', 'Send via the CORRECT NETWORK selected.')}</li>
                                <li>{t('Chuyển CHÍNH XÁC số lượng coin yêu cầu (bao gồm cả số lẻ).', 'Send the EXACT amount requested (including decimals).')}</li>
                                <li>{t('Thực hiện trong thời gian đồng hồ đếm ngược (thường là 30 phút).', 'Complete within the countdown timer (usually 30 mins).')}</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Step 4 */}
                <div className="flex gap-6 group">
                    <div className="flex flex-col items-center">
                        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 font-bold text-xl flex items-center justify-center group-hover:bg-green-600 group-hover:text-white transition shadow-sm border border-slate-200">4</div>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2"><CheckCircle size={18}/> {t('Hoàn tất tự động', 'Automatic Completion')}</h3>
                        <p className="text-slate-600 text-sm leading-6">
                            {t('Sau khi Blockchain xác nhận giao dịch (thường từ 1-10 phút), hệ thống sẽ tự động chuyển trạng thái đơn hàng sang "Đã thanh toán" (Paid) và gửi sản phẩm/email xác nhận cho bạn ngay lập tức.', 
                               'Once Blockchain confirms the transaction (usually 1-10 mins), the system automatically updates order status to "Paid" and delivers the product/confirmation email instantly.')}
                        </p>
                    </div>
                </div>
            </div>
        </section>

        {/* 3. FAQ */}
        <section id="faq" className="mb-24 scroll-mt-40 border-t border-gray-100 pt-16">
            <div className="mb-8 border-b border-gray-200 pb-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-purple-100 text-purple-600"><HelpCircle size={28} /></div>
                    <h2 className="text-3xl font-bold text-slate-800">{t('Câu hỏi Thường gặp', 'Frequently Asked Questions')}</h2>
                </div>
            </div>

            <div className="grid gap-6">
                {[
                    { 
                        q: t("Thanh toán qua OxaPay có an toàn không?", "Is paying via OxaPay secure?"), 
                        a: t("Tuyệt đối an toàn. OxaPay là cổng thanh toán phi tập trung, giao dịch diễn ra trực tiếp trên Blockchain (P2P) giữa ví của bạn và ví hệ thống. Chúng tôi không lưu trữ Private Key hay thông tin ví của bạn.", 
                             "Absolutely secure. OxaPay is a decentralized gateway; transactions occur directly on Blockchain (P2P). We do not store your Private Key or wallet info.") 
                    },
                    { 
                        q: t("Tôi lỡ gửi sai số tiền (thiếu hoặc thừa) thì sao?", "What if I sent the wrong amount (under/overpaid)?"), 
                        a: t("Đừng lo lắng. Nếu gửi thiếu, đơn hàng sẽ ở trạng thái 'Pending'. Hãy liên hệ ngay với bộ phận Hỗ trợ (Live Chat) và cung cấp mã TxID (Transaction Hash). Chúng tôi sẽ kiểm tra và hỗ trợ bạn bù thêm hoặc xử lý thủ công.", 
                             "Don't worry. If underpaid, the order stays 'Pending'. Contact Support (Live Chat) immediately with your TxID. We will assist you in topping up or manual processing.") 
                    },
                    { 
                        q: t("Tôi có cần tài khoản OxaPay để thanh toán không?", "Do I need an OxaPay account?"), 
                        a: t("Không cần. Bạn có thể sử dụng bất kỳ ví điện tử nào (Binance, Remitano, Metamask, Trust Wallet, Coin98...) để quét mã và chuyển tiền.", 
                             "No. You can use any crypto wallet (Binance, Remitano, Metamask, Trust Wallet, Coin98...) to scan and pay.") 
                    },
                    { 
                        q: t("Bao lâu thì tôi nhận được hàng?", "How long until I receive my product?"), 
                        a: t("Đối với sản phẩm số (Key/Account): Hệ thống gửi tự động ngay lập tức sau khi giao dịch được xác nhận (1-5 phút). Đối với sản phẩm vật lý: Thời gian giao hàng từ 2-5 ngày làm việc tùy khu vực.", 
                             "Digital products (Key/Account): Delivered instantly after confirmation (1-5 mins). Physical products: 2-5 business days depending on location.") 
                    }
                ].map((item, idx) => (
                    <div key={idx} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:border-blue-300 transition">
                        <h3 className="font-bold text-slate-800 mb-3 flex items-start gap-3 text-lg">
                            <HelpCircle size={24} className="text-purple-600 mt-0.5 flex-shrink-0"/> {item.q}
                        </h3>
                        <p className="text-slate-600 pl-9 text-sm leading-7">{item.a}</p>
                    </div>
                ))}
            </div>
        </section>

        {/* 4. ĐIỀU KHOẢN DỊCH VỤ */}
        <section id="terms" className="mb-24 scroll-mt-40 border-t border-gray-100 pt-16">
            <div className="mb-8 border-b border-gray-200 pb-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-gray-100 text-gray-600"><FileText size={28} /></div>
                    <h2 className="text-3xl font-bold text-slate-800">{t('Điều khoản Dịch vụ', 'Terms of Service')}</h2>
                </div>
                <p className="text-slate-500">{t('Quy định pháp lý và trách nhiệm của các bên.', 'Legal regulations and responsibilities of parties.')}</p>
            </div>
            
            <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm space-y-8 text-slate-600">
                <div className="flex gap-5">
                    <div className="bg-green-100 p-2.5 h-fit rounded-full text-green-600 flex-shrink-0"><CheckCircle size={24} /></div>
                    <div>
                        <h4 className="font-bold text-slate-800 mb-2 text-lg">1. {t('Chấp thuận Điều khoản', 'Acceptance of Terms')}</h4>
                        <p className="text-sm leading-7">{t('Bằng việc truy cập website và thực hiện mua hàng, bạn đồng ý tuân thủ toàn bộ các chính sách, điều khoản bảo mật và quy định thanh toán của CryptoShop.', 
                                                             'By accessing the website and purchasing, you agree to comply with all CryptoShop policies, privacy terms, and payment regulations.')}</p>
                    </div>
                </div>
                
                <div className="flex gap-5">
                    <div className="bg-blue-100 p-2.5 h-fit rounded-full text-blue-600 flex-shrink-0"><RotateCcw size={24} /></div>
                    <div>
                        <h4 className="font-bold text-slate-800 mb-2 text-lg">2. {t('Tính Không thể Đảo ngược', 'Irreversibility')}</h4>
                        <p className="text-sm leading-7">{t('Khách hàng hiểu và đồng ý rằng các giao dịch trên Blockchain là KHÔNG THỂ ĐẢO NGƯỢC (Irreversible). CryptoShop không thể can thiệp để hủy lệnh chuyển tiền hay lấy lại tiền nếu bạn gửi sai địa chỉ ví.', 
                                                             'Customers understand and agree that Blockchain transactions are IRREVERSIBLE. CryptoShop cannot intervene to cancel transfers or recover funds if sent to the wrong address.')}</p>
                    </div>
                </div>

                <div className="flex gap-5">
                    <div className="bg-orange-100 p-2.5 h-fit rounded-full text-orange-600 flex-shrink-0"><Scale size={24} /></div>
                    <div>
                        <h4 className="font-bold text-slate-800 mb-2 text-lg">3. {t('Biến động Tỷ giá', 'Exchange Rate Volatility')}</h4>
                        <p className="text-sm leading-7">{t('Giá sản phẩm được niêm yết bằng Fiat. Tỷ giá quy đổi sang Crypto được chốt tại thời điểm tạo hóa đơn và chỉ có giá trị trong thời gian hiệu lực của hóa đơn (thường 15-30 phút).', 
                                                             'Product prices are listed in Fiat. Crypto exchange rates are locked at invoice creation and valid only during the invoice validity period (usually 15-30 mins).')}</p>
                    </div>
                </div>

                <div className="flex gap-5">
                    <div className="bg-purple-100 p-2.5 h-fit rounded-full text-purple-600 flex-shrink-0"><ShieldCheck size={24} /></div>
                    <div>
                        <h4 className="font-bold text-slate-800 mb-2 text-lg">4. {t('Tuân thủ Pháp luật & AML', 'Compliance & AML')}</h4>
                        <p className="text-sm leading-7">{t('Khách hàng cam kết nguồn tiền sử dụng để thanh toán là hợp pháp. Chúng tôi có quyền từ chối phục vụ hoặc khóa tài khoản nếu phát hiện dấu hiệu rửa tiền hoặc gian lận tài chính.', 
                                                             'Customers commit that funds used for payment are legal. We reserve the right to refuse service or lock accounts if money laundering or financial fraud is detected.')}</p>
                    </div>
                </div>
            </div>
        </section>

        {/* 5. KÊNH HỖ TRỢ */}
        <section id="support" className="mb-20 scroll-mt-40 border-t border-gray-100 pt-16">
            <div className="mb-8 border-b border-gray-200 pb-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600"><Headset size={28} /></div>
                    <h2 className="text-3xl font-bold text-slate-800">{t('Trung tâm Hỗ trợ', 'Support Center')}</h2>
                </div>
                <p className="text-slate-500">{t('Đội ngũ CSKH của chúng tôi luôn sẵn sàng 24/7 để giải đáp mọi thắc mắc của bạn.', 
                                                 'Our Support Team is available 24/7 to answer all your questions.')}</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                {/* 1. Ticket */}
                <a href="/contact" className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm hover:border-blue-500 hover:shadow-lg transition text-center group h-full flex flex-col justify-center">
                    <div className="w-16 h-16 mx-auto bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mb-5 group-hover:scale-110 transition"><Ticket size={32}/></div>
                    <h3 className="font-bold text-slate-800 text-lg mb-2">{t('Tạo Ticket Hỗ trợ', 'Create Support Ticket')}</h3>
                    <p className="text-sm text-slate-500 mb-4">{t('Gửi yêu cầu chi tiết qua biểu mẫu. Phù hợp cho các vấn đề kỹ thuật phức tạp.', 'Send detailed request via form. Best for complex technical issues.')}</p>
                    <span className="text-blue-600 text-sm font-bold flex items-center justify-center gap-1 group-hover:gap-2 transition-all">{t('Gửi ngay', 'Send Now')} <ChevronRight size={16}/></span>
                </a>

                {/* 2. Live Chat (Link Động) */}
                <a 
                    href={`https://t.me/${settings.contact_telegram?.replace('@','') || 'support'}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm hover:border-blue-500 hover:shadow-lg transition text-center group h-full flex flex-col justify-center"
                >
                    <div className="w-16 h-16 mx-auto bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mb-5 group-hover:scale-110 transition"><MessageSquare size={32}/></div>
                    <h3 className="font-bold text-slate-800 text-lg mb-2">Live Chat</h3>
                    <p className="text-sm text-slate-500 mb-4">{t('Chat trực tiếp với nhân viên qua Telegram. Phản hồi nhanh trong 5 phút.', 'Chat directly with staff via Telegram. Fast response within 5 mins.')}</p>
                    <span className="text-blue-600 text-sm font-bold flex items-center justify-center gap-1 group-hover:gap-2 transition-all">{t('Chat ngay', 'Chat Now')} <ChevronRight size={16}/></span>
                </a>

                {/* 3. Email */}
                <a 
                    href={`mailto:${settings.contact_email || 'support@anvu.vn'}`} 
                    className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm hover:border-blue-500 hover:shadow-lg transition text-center group h-full flex flex-col justify-center"
                >
                    <div className="w-16 h-16 mx-auto bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mb-5 group-hover:scale-110 transition"><Mail size={32}/></div>
                    <h3 className="font-bold text-slate-800 text-lg mb-2">Email</h3>
                    <p className="text-sm text-slate-500 mb-4">{t('Gửi mail cho chúng tôi và nhận phản hồi trong thời gian sớm nhất.', 'Send us an email and receive a response as soon as possible.')}</p>
                    <span className="text-blue-600 text-sm font-bold flex items-center justify-center gap-1 group-hover:gap-2 transition-all">{t('Gửi Email', 'Send Email')} <ChevronRight size={16}/></span>
                </a>
            </div>
        </section>

      </main>
    </div>
  );
}
