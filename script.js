/* ============================================================
   starGo - Full JavaScript File
   Version: 5.0 (With Backend Integration)
   Author: starGo Team
============================================================ */

/* ============================================================
   Config & Wallet Settings
============================================================ */

const RECEIVER_WALLET = "UQBPpnRDUyTVXzJk4Qxr02z4iPFZfWv8NC2fvOjHe8UtmpHE";
const FIXED_FEE = 0.20;
const TON_PER_STAR = 0.0099273;

let tonConnectUI = null;
let windowTonPrice = null;
let pendingVerification = null;
let selectedPlanTon = null;
let currentOrderId = null;
let verificationInterval = null;

// Backend URL Configuration
function getBackendUrl() {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:5000';
    }
    return 'https://stars-backend.onrender.com';
}

const BACKEND_URL = getBackendUrl();
console.log('🔗 Backend URL:', BACKEND_URL);

/* ============================================================
   Helper Functions
============================================================ */

function toNano(tonAmount) {
    return String(Math.floor(Number(tonAmount) * 1e9));
}

function base64Encode(str) {
    try {
        return btoa(str);
    } catch (e) {
        return btoa(unescape(encodeURIComponent(str)));
    }
}

function getFormattedDate() {
    const date = new Date();
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} ${date.getHours()}:${date.getMinutes()}`;
}

function showNotification(message, type = 'success') {
    const oldNotification = document.querySelector('.notification');
    if (oldNotification) oldNotification.remove();
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';
    if (type === 'warning') icon = 'fa-exclamation-triangle';
    
    notification.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideUp 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) notification.remove();
        }, 300);
    }, 3000);
}

/* ============================================================
   TON Connect Functions
============================================================ */

function initTonConnect() {
    const MANIFEST_URL = window.location.origin + '/tonconnect-manifest.json';
    console.log('🔗 Manifest URL:', MANIFEST_URL);
    
    if (typeof TON_CONNECT_UI === 'undefined') {
        console.error('❌ TON Connect UI library not loaded');
        showNotification('جاري تحميل مكتبة TON Connect...', 'warning');
        setTimeout(initTonConnect, 1000);
        return;
    }
    
    try {
        tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
            manifestUrl: MANIFEST_URL,
            walletsList: [
                {
                    name: "Tonkeeper",
                    appName: "tonkeeper",
                    imageUrl: "https://tonkeeper.com/assets/tonkeeper-icon.png",
                    aboutUrl: "https://tonkeeper.com",
                    bridgeUrl: "https://bridge.tonapi.io/bridge",
                    universalUrl: "https://app.tonkeeper.com/ton-connect"
                },
                {
                    name: "Tonhub",
                    appName: "tonhub", 
                    imageUrl: "https://tonhub.com/tonhub-icon.png",
                    aboutUrl: "https://tonhub.com",
                    bridgeUrl: "https://connect.tonhubapi.com/tonconnect",
                    universalUrl: "https://tonhub.com/ton-connect"
                },
                {
                    name: "TonWallet",
                    appName: "tonwallet",
                    imageUrl: "https://wallet.ton.org/assets/logo.png",
                    aboutUrl: "https://wallet.ton.org",
                    bridgeUrl: "https://bridge.ton.org/bridge",
                    universalUrl: "https://wallet.ton.org/ton-connect"
                }
            ]
        });

        tonConnectUI.onStatusChange(function (wallet) {
            if (wallet) {
                console.log('✅ Wallet connected:', wallet);
                
                const rawAddress = wallet.account.address;
                const providerName = wallet.device ? wallet.device.appName : 'TON Wallet';

                document.getElementById('walletAddress').value = rawAddress;
                document.getElementById('walletProvider').value = providerName;

                const shortAddr = rawAddress.slice(0, 6) + '...' + rawAddress.slice(-4);
                document.getElementById('connectedAddress').textContent = shortAddr;

                document.getElementById('walletInfo').style.display = 'block';
                const connectBtn = document.getElementById('connectTonWalletBtn');
                if (connectBtn) connectBtn.style.display = 'none';
                
                localStorage.setItem('connected_wallet', JSON.stringify({
                    address: rawAddress,
                    provider: providerName,
                    connectedAt: new Date().toISOString()
                }));

                showNotification('✅ تم ربط المحفظة بنجاح', 'success');
                getWalletBalance(rawAddress);

            } else {
                console.log('❌ Wallet disconnected');
                
                document.getElementById('walletInfo').style.display = 'none';
                const connectBtn = document.getElementById('connectTonWalletBtn');
                if (connectBtn) connectBtn.style.display = 'block';
                document.getElementById('walletAddress').value = '';
                document.getElementById('walletProvider').value = '';
                
                localStorage.removeItem('connected_wallet');
                showNotification('❌ تم قطع اتصال المحفظة', 'warning');
            }
        });
        
        setTimeout(() => {
            if (tonConnectUI && tonConnectUI.wallet) {
                console.log('✅ Restored previous connection');
            }
        }, 1000);
        
        console.log('✅ TON Connect UI initialized successfully');

    } catch (e) {
        console.error('❌ TON Connect error:', e);
        showNotification('❌ فشل تهيئة TON Connect', 'error');
    }
}

async function connectTonWallet() {
    closeSidebar();
    
    if (!tonConnectUI) {
        showNotification('جاري تحميل المحفظة... حاول مجدداً بعد لحظة', 'warning');
        return;
    }
    
    try {
        await tonConnectUI.openModal();
    } catch (e) {
        console.error('❌ Error opening wallet:', e);
        showNotification('حدث خطأ أثناء فتح نافذة المحفظة', 'error');
    }
}

async function disconnectWallet() {
    if (!tonConnectUI) return;
    
    try {
        await tonConnectUI.disconnect();
        showNotification('تم قطع الاتصال بالمحفظة', 'success');
    } catch (e) {
        console.error('❌ Error disconnecting:', e);
    }
}

function checkWalletBeforePurchase() {
    const walletInfo = document.getElementById('walletInfo');
    if (!walletInfo || walletInfo.style.display !== 'block') {
        showNotification('⚠️ يجب ربط المحفظة أولاً قبل الشراء', 'warning');
        
        const sidebar = document.getElementById("sidebar");
        const overlay = document.getElementById("overlay");
        sidebar.classList.add("open");
        overlay.style.display = "block";
        
        setTimeout(() => {
            const walletSection = document.getElementById('ton-wallet-section');
            if (walletSection) {
                walletSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 300);
        
        return false;
    }
    return true;
}

async function getWalletBalance(address) {
    try {
        const response = await fetch(`https://toncenter.com/api/v2/getAddressBalance?address=${address}`);
        const data = await response.json();
        if (data.ok) {
            const balance = data.result / 1e9;
            const balanceElement = document.getElementById('balanceAmount');
            const walletBalanceDiv = document.getElementById('walletBalance');
            if (balanceElement) balanceElement.textContent = balance.toFixed(2);
            if (walletBalanceDiv) walletBalanceDiv.style.display = 'flex';
        }
    } catch (error) {
        console.error('Error getting balance:', error);
    }
}

/* ============================================================
   Login Functions
============================================================ */

function openLogin() {
    closeSidebar();
    resetLoginForm();
    document.getElementById("login-popup").style.display = "flex";
    document.body.style.overflow = 'hidden';
}

function closeLogin() {
    document.getElementById("login-popup").style.display = "none";
    document.body.style.overflow = '';
    resetLoginForm();
}

function resetLoginForm() {
    document.getElementById('login-username').value = '';
    document.getElementById('login-code').value = '';
    document.getElementById('login-send').style.display = 'block';
    document.getElementById('code-input-container').style.display = 'none';
    document.getElementById('login-link-wrap').style.display = 'none';
    document.getElementById('login-status').style.display = 'none';
    pendingVerification = null;
}

async function sendVerificationCode() {
    const username = document.getElementById("login-username").value.trim();
    if (!username) {
        showNotification('❌ من فضلك أدخل اسم المستخدم', 'error');
        return;
    }
    
    let formattedUsername = username.startsWith('@') ? username.substring(1) : username;
    
    const sendBtn = document.getElementById('login-send');
    const originalText = sendBtn.innerHTML;
    sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإرسال...';
    sendBtn.disabled = true;
    
    try {
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        pendingVerification = {
            username: formattedUsername,
            code: verificationCode,
            timestamp: Date.now()
        };
        
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        showNotification(`📱 تم إرسال الرمز ${verificationCode} إلى ${formattedUsername}`, 'success');
        
        document.getElementById('login-send').style.display = 'none';
        document.getElementById('code-input-container').style.display = 'block';
        document.getElementById('login-msg').innerText = `تم إرسال رمز التحقق إلى @${formattedUsername}`;
        document.getElementById('login-link-wrap').style.display = 'block';
        document.getElementById('login-code').value = verificationCode;
        
    } catch (error) {
        console.error('Error sending code:', error);
        showNotification('❌ فشل إرسال رمز التحقق', 'error');
    } finally {
        sendBtn.innerHTML = originalText;
        sendBtn.disabled = false;
    }
}

function verifyCode() {
    const enteredCode = document.getElementById('login-code').value.trim();
    
    if (!enteredCode) {
        showNotification('❌ من فضلك أدخل الكود', 'error');
        return;
    }
    
    if (!pendingVerification) {
        showNotification('❌ لا توجد عملية تحقق نشطة', 'error');
        return;
    }
    
    const timeElapsed = Date.now() - pendingVerification.timestamp;
    if (timeElapsed > 5 * 60 * 1000) {
        showNotification('❌ انتهت صلاحية الكود، أعد المحاولة', 'error');
        resetLoginForm();
        return;
    }
    
    if (enteredCode === pendingVerification.code) {
        const userObj = {
            telegram_id: Math.floor(10000000 + Math.random() * 90000000).toString(),
            telegram_username: '@' + pendingVerification.username,
            logged_in_at: getFormattedDate()
        };
        
        localStorage.setItem("stellagram_user", JSON.stringify(userObj));
        setLoggedUI(userObj);
        
        showNotification(`✅ مرحباً ${userObj.telegram_username}`, 'success');
        
        setTimeout(() => {
            closeLogin();
            resetLoginForm();
        }, 1500);
    } else {
        showNotification('❌ الكود غير صحيح، حاول مرة أخرى', 'error');
    }
}

function refreshLoginUI() {
    try {
        const raw = localStorage.getItem("stellagram_user");
        if (!raw) {
            setLoggedOutUI();
            return null;
        }
        const user = JSON.parse(raw);
        setLoggedUI(user);
        return user;
    } catch (e) {
        setLoggedOutUI();
        return null;
    }
}

function setLoggedUI(userObj) {
    try {
        const loginBtn = document.getElementById("login-btn");
        if (loginBtn) loginBtn.style.display = "none";
        
        const ui = document.getElementById("user-info");
        if (ui) ui.style.display = "block";
        
        if (userObj.telegram_username) {
            const sname = document.getElementById("sidebar-username");
            if (sname) sname.innerText = userObj.telegram_username;
        }
    } catch (e) {
        console.error(e);
    }
}

function setLoggedOutUI() {
    try {
        const ui = document.getElementById("user-info");
        if (ui) ui.style.display = "none";
        
        const userCard = document.getElementById("user-card");
        if (userCard) userCard.style.display = "none";
        
        const userInputContainer = document.getElementById("user-input-container");
        if (userInputContainer) userInputContainer.style.display = "flex";
        
    } catch (e) {
        console.error(e);
    }
}

function confirmLogout() {
    closeSidebar();
    document.getElementById('logout-confirm-popup').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeConfirmPopup() {
    document.getElementById('logout-confirm-popup').style.display = 'none';
    document.body.style.overflow = '';
}

function logout() {
    localStorage.removeItem("stellagram_user");
    closeConfirmPopup();
    setLoggedOutUI();
    showNotification('✅ تم تسجيل الخروج بنجاح', 'success');
}

/* ============================================================
   UI Functions
============================================================ */

function toggleSidebar() {
    const sb = document.getElementById("sidebar");
    const ov = document.getElementById("overlay");
    if (sb.classList.contains("open")) {
        sb.classList.remove("open");
        ov.style.display = "none";
        document.body.style.overflow = '';
    } else {
        sb.classList.add("open");
        ov.style.display = "block";
        document.body.style.overflow = 'hidden';
    }
}

function closeSidebar() {
    const sb = document.getElementById("sidebar");
    const ov = document.getElementById("overlay");
    sb.classList.remove("open");
    ov.style.display = "none";
    document.body.style.overflow = '';
}

function switchTab(tabName) {
    const starsContent = document.getElementById('stars-content');
    const premiumContent = document.getElementById('premium-content');
    const tabs = document.querySelectorAll('.tab-btn');
    
    if (tabName === 'stars') {
        starsContent.style.display = 'block';
        premiumContent.style.display = 'none';
        tabs[0].classList.add('active');
        tabs[1].classList.remove('active');
    } else {
        starsContent.style.display = 'none';
        premiumContent.style.display = 'block';
        tabs[0].classList.remove('active');
        tabs[1].classList.add('active');
    }
}

/* ============================================================
   Stars Functions
============================================================ */

async function fetchTonPrice() {
    try {
        const res = await fetch("https://api.coinbase.com/v2/exchange-rates?currency=TON");
        const j = await res.json();
        const rate = parseFloat(j.data.rates.USD);
        let usdPerTon = rate;
        if (rate < 0.001) usdPerTon = 1 / rate;
        windowTonPrice = usdPerTon;
        updatePackages();
        updatePremiumPrices();
        calculateCustomAmount();
    } catch (e) {
        console.error("TON price error", e);
        windowTonPrice = 5.5;
        updatePackages();
        updatePremiumPrices();
        calculateCustomAmount();
    }
}

function updatePackages() {
    if (!windowTonPrice) return;
    document.querySelectorAll(".package").forEach(pkg => {
        const ton = parseFloat(pkg.getAttribute("data-ton"));
        const usd = ton * windowTonPrice;
        const final = usd + FIXED_FEE;
        const el = pkg.querySelector(".pack-usd");
        if (el) el.innerText = "~ $" + final.toFixed(2);
    });
}

function updatePremiumPrices() {
    if (!windowTonPrice) return;
    document.querySelectorAll(".plan").forEach(plan => {
        const ton = parseFloat(plan.getAttribute("data-ton"));
        const usd = ton * windowTonPrice;
        const final = usd + FIXED_FEE;
        const usdEl = plan.querySelector(".usd-value");
        if (usdEl) usdEl.innerText = "~ $" + final.toFixed(2);
    });
}

function calculateCustomAmount() {
    const input = document.getElementById("stars-amount");
    const out = document.getElementById("calc-result");
    if (!input || !out) return;
    const amount = Number(input.value);
    if (!amount || amount < 50) {
        out.innerHTML = "";
        return;
    }
    if (!windowTonPrice) {
        out.innerHTML = "";
        return;
    }
    const tonNeeded = amount * TON_PER_STAR;
    const usd = tonNeeded * windowTonPrice;
    const final = usd + FIXED_FEE;
    out.innerHTML = ` <b style="color:#4dd0ff">$${final.toFixed(2)}</b> for <b>${amount} ⭐</b>`;
}

function selectPackage(amount, ton) {
    const starsInput = document.getElementById("stars-amount");
    if (starsInput) starsInput.value = amount;
    calculateCustomAmount();
    
    document.querySelectorAll(".package").forEach(pkg => {
        pkg.classList.remove("active-package");
        const radio = pkg.querySelector("input");
        if (radio) radio.checked = false;
    });
    
    event.currentTarget.classList.add("active-package");
    const radio = event.currentTarget.querySelector("input");
    if (radio) radio.checked = true;
}

function checkUser() {
    let user = document.getElementById("username-input").value.trim();
    if (!user) return showNotification("ادخل يوزر التليجرام", 'error');
    if (!user.startsWith("@")) user = "@" + user;
    
    const userNameEl = document.getElementById("user-name");
    if (userNameEl) userNameEl.innerText = user;
    
    const card = document.getElementById("user-card");
    const inputContainer = document.getElementById("user-input-container");
    if (card) card.style.display = "flex";
    if (inputContainer) inputContainer.style.display = "none";
}

function removeUser() {
    const card = document.getElementById("user-card");
    const inputContainer = document.getElementById("user-input-container");
    if (card) card.style.display = "none";
    if (inputContainer) inputContainer.style.display = "flex";
    const inp = document.getElementById("username-input");
    if (inp) inp.value = "";
}

async function buyStars() {
    if (!checkWalletBeforePurchase()) return;
    
    const userData = refreshLoginUI();
    if (!userData) {
        showNotification('⚠️ يجب تسجيل الدخول أولاً', 'warning');
        openLogin();
        return;
    }
    
    const username = document.getElementById("user-name").innerText || document.getElementById("username-input").value.trim();
    const amount = document.getElementById("stars-amount").value;
    
    if (!username) {
        showNotification('❌ من فضلك أدخل اسم المستخدم', 'error');
        return;
    }
    
    if (!amount || amount < 50) {
        showNotification('❌ أقل كمية 50 نجمة', 'error');
        return;
    }
    
    const tonAmount = (amount * TON_PER_STAR + FIXED_FEE).toFixed(6);
    
    showNotification(`🔄 جاري إنشاء طلب شراء ${amount} نجمة...`, 'success');
    
    try {
        const orderResponse = await fetch(`${BACKEND_URL}/api/order/stars`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_id: userData.telegram_id || '1',
                recipient: username.replace('@', ''),
                amount: amount,
                ton_amount: tonAmount
            })
        });
        
        const orderData = await orderResponse.json();
        
        if (!orderData.success) {
            showNotification('❌ فشل إنشاء الطلب: ' + orderData.message, 'error');
            return;
        }
        
        currentOrderId = orderData.data.order_id;
        
        showNotification(`💰 المطلوب: ${tonAmount} TON. جاري فتح المحفظة...`, 'success');
        
        if (tonConnectUI && tonConnectUI.wallet) {
            const payload = base64Encode(`STARS:${orderData.data.order_id}:${username}:${amount}`);
            const messages = [{
                address: RECEIVER_WALLET,
                amount: toNano(tonAmount),
                payload: payload
            }];
            const validUntil = Math.floor(Date.now() / 1000) + 10 * 60;
            
            await tonConnectUI.sendTransaction({
                validUntil: validUntil,
                messages: messages
            });
            
            showNotification(`✅ تم إرسال المعاملة! جاري التأكيد...`, 'success');
            
            startPaymentVerification(currentOrderId, amount, username);
            
        } else {
            showNotification('❌ المحفظة غير متصلة', 'error');
        }
        
    } catch (error) {
        console.error('Buy stars error:', error);
        showNotification('❌ فشل إتمام العملية', 'error');
    }
}

/* ============================================================
   Premium Functions
============================================================ */

function selectPremiumPlan(ton, planName) {
    selectedPlanTon = ton;
    document.querySelectorAll(".plan").forEach(plan => {
        plan.classList.remove("active-plan");
        const radio = plan.querySelector("input");
        if (radio) radio.checked = false;
    });
    
    event.currentTarget.classList.add("active-plan");
    const radio = event.currentTarget.querySelector("input");
    if (radio) radio.checked = true;
}

function checkPremiumUser() {
    let user = document.getElementById("premium-username-input").value.trim();
    if (!user) return showNotification("ادخل يوزر التليجرام", 'error');
    if (!user.startsWith("@")) user = "@" + user;
    
    const nameEl = document.getElementById("premium-user-name");
    if (nameEl) nameEl.innerText = user;
    
    const card = document.getElementById("premium-user-card");
    const inputContainer = document.getElementById("premium-user-input-container");
    if (card) card.style.display = "flex";
    if (inputContainer) inputContainer.style.display = "none";
}

function removePremiumUser() {
    const card = document.getElementById("premium-user-card");
    const inputContainer = document.getElementById("premium-user-input-container");
    if (card) card.style.display = "none";
    if (inputContainer) inputContainer.style.display = "flex";
    const inp = document.getElementById("premium-username-input");
    if (inp) inp.value = "";
}

async function buyPremium() {
    if (!checkWalletBeforePurchase()) return;
    
    const userData = refreshLoginUI();
    if (!userData) {
        showNotification('⚠️ يجب تسجيل الدخول أولاً', 'warning');
        openLogin();
        return;
    }
    
    const username = document.getElementById("premium-user-name").innerText || document.getElementById("premium-username-input").value.trim();
    const selectedPlan = document.querySelector('.plan.active-plan');
    
    if (!username) {
        showNotification('❌ من فضلك أدخل اسم المستخدم', 'error');
        return;
    }
    
    if (!selectedPlan) {
        showNotification('❌ من فضلك اختر المدة', 'error');
        return;
    }
    
    const tonAmount = selectedPlan.getAttribute('data-ton');
    const planName = selectedPlan.querySelector('span').innerText;
    
    showNotification(`🔄 جاري إنشاء طلب شراء ${planName}...`, 'success');
    
    try {
        const orderResponse = await fetch(`${BACKEND_URL}/api/order/premium`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_id: userData.telegram_id || '1',
                recipient: username.replace('@', ''),
                plan: planName,
                ton_amount: tonAmount
            })
        });
        
        const orderData = await orderResponse.json();
        
        if (!orderData.success) {
            showNotification('❌ فشل إنشاء الطلب: ' + orderData.message, 'error');
            return;
        }
        
        currentOrderId = orderData.data.order_id;
        
        showNotification(`💰 المطلوب: ${tonAmount} TON. جاري فتح المحفظة...`, 'success');
        
        if (tonConnectUI && tonConnectUI.wallet) {
            const payload = base64Encode(`PREMIUM:${orderData.data.order_id}:${username}:${planName}`);
            const messages = [{
                address: RECEIVER_WALLET,
                amount: toNano(tonAmount),
                payload: payload
            }];
            const validUntil = Math.floor(Date.now() / 1000) + 10 * 60;
            
            await tonConnectUI.sendTransaction({
                validUntil: validUntil,
                messages: messages
            });
            
            showNotification(`✅ تم إرسال المعاملة! جاري التأكيد...`, 'success');
            
            startPremiumPaymentVerification(currentOrderId, planName, username);
            
        } else {
            showNotification('❌ المحفظة غير متصلة', 'error');
        }
        
    } catch (error) {
        console.error('Buy premium error:', error);
        showNotification('❌ فشل إتمام العملية', 'error');
    }
}

/* ============================================================
   Payment Verification Functions
============================================================ */

async function startPaymentVerification(orderId, starsAmount, username) {
    if (verificationInterval) {
        clearInterval(verificationInterval);
    }
    
    let attempts = 0;
    const maxAttempts = 60;
    
    showPaymentWaitingModal(orderId, starsAmount);
    
    verificationInterval = setInterval(async () => {
        attempts++;
        
        try {
            const response = await fetch(`${BACKEND_URL}/api/order/check-payment/${orderId}`);
            const data = await response.json();
            
            if (data.success && data.data?.status === 'completed') {
                clearInterval(verificationInterval);
                verificationInterval = null;
                
                updatePaymentStatus('completed', starsAmount);
                
                saveOrder({
                    type: 'stars',
                    username: username,
                    amount: starsAmount,
                    tonAmount: data.data.ton_amount,
                    orderId: orderId,
                    status: 'completed',
                    date: getFormattedDate(),
                    txHash: data.data.txHash
                });
                
                showNotification(`✅ تم شراء ${starsAmount} نجمة بنجاح!`, 'success');
                
                setTimeout(() => {
                    closePaymentModal();
                }, 3000);
                
            } else if (attempts >= maxAttempts) {
                clearInterval(verificationInterval);
                verificationInterval = null;
                updatePaymentStatus('timeout', starsAmount);
                showNotification('⏰ انتهى وقت الانتظار. لم يتم استلام الدفع.', 'warning');
            } else {
                updatePaymentStatus('waiting', starsAmount, attempts);
            }
            
        } catch (error) {
            console.error('Check payment error:', error);
        }
    }, 5000);
}

async function startPremiumPaymentVerification(orderId, planName, username) {
    if (verificationInterval) {
        clearInterval(verificationInterval);
    }
    
    let attempts = 0;
    const maxAttempts = 60;
    
    showPaymentWaitingModal(orderId, planName);
    
    verificationInterval = setInterval(async () => {
        attempts++;
        
        try {
            const response = await fetch(`${BACKEND_URL}/api/order/check-payment/${orderId}`);
            const data = await response.json();
            
            if (data.success && data.data?.status === 'completed') {
                clearInterval(verificationInterval);
                verificationInterval = null;
                
                updatePaymentStatus('completed', planName);
                
                saveOrder({
                    type: 'premium',
                    username: username,
                    plan: planName,
                    tonAmount: data.data.ton_amount,
                    orderId: orderId,
                    status: 'completed',
                    date: getFormattedDate(),
                    txHash: data.data.txHash
                });
                
                showNotification(`✅ تم شراء ${planName} بنجاح!`, 'success');
                
                setTimeout(() => {
                    closePaymentModal();
                }, 3000);
                
            } else if (attempts >= maxAttempts) {
                clearInterval(verificationInterval);
                verificationInterval = null;
                updatePaymentStatus('timeout', planName);
                showNotification('⏰ انتهى وقت الانتظار. لم يتم استلام الدفع.', 'warning');
            } else {
                updatePaymentStatus('waiting', planName, attempts);
            }
            
        } catch (error) {
            console.error('Check payment error:', error);
        }
    }, 5000);
}

function showPaymentWaitingModal(orderId, itemName) {
    const existingModal = document.getElementById('paymentWaitingModal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'paymentWaitingModal';
    modal.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 10000; display: flex; align-items: center; justify-content: center;">
            <div style="background: #0a1622; border-radius: 20px; padding: 25px; max-width: 90%; width: 320px; text-align: center; border: 1px solid #2a4a6e;">
                <i class="fas fa-spinner fa-pulse" style="font-size: 48px; color: #4dd0ff;"></i>
                <h3 style="color: #fff; margin: 15px 0;">جاري معالجة الدفع</h3>
                <p style="color: #9fb7d8; font-size: 14px;">المنتج: ${itemName}</p>
                <p style="color: #9fb7d8; font-size: 12px;" id="paymentTimer">في انتظار تأكيد الدفع...</p>
                <div style="background: #0d2130; border-radius: 10px; padding: 10px; margin-top: 15px;">
                    <p style="color: #6c9ebf; font-size: 11px; margin: 0;">رقم الطلب</p>
                    <p style="color: #ffd966; font-size: 11px; word-break: break-all; margin: 5px 0 0;">${orderId}</p>
                </div>
                <button onclick="closePaymentModal()" style="margin-top: 20px; background: #c0392b; border: none; padding: 10px 20px; border-radius: 10px; color: white; cursor: pointer;">
                    <i class="fas fa-times"></i> إلغاء
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function updatePaymentStatus(status, itemName, attempts = 0) {
    const modal = document.getElementById('paymentWaitingModal');
    if (!modal) return;
    
    const timerElement = modal.querySelector('#paymentTimer');
    if (!timerElement) return;
    
    if (status === 'waiting') {
        const elapsedSeconds = attempts * 5;
        const minutes = Math.floor(elapsedSeconds / 60);
        const seconds = elapsedSeconds % 60;
        timerElement.innerHTML = `⏳ في انتظار الدفع... ${minutes}:${seconds.toString().padStart(2, '0')}`;
    } else if (status === 'completed') {
        timerElement.innerHTML = `✅ تم تأكيد الدفع! جاري إضافة ${itemName}...`;
        timerElement.style.color = '#00c853';
    } else if (status === 'timeout') {
        timerElement.innerHTML = `❌ لم يتم استلام الدفع. انتهى وقت الانتظار.`;
        timerElement.style.color = '#ff5555';
    }
}

function closePaymentModal() {
    if (verificationInterval) {
        clearInterval(verificationInterval);
        verificationInterval = null;
    }
    const modal = document.getElementById('paymentWaitingModal');
    if (modal) modal.remove();
}

function saveOrder(order) {
    try {
        const orders = JSON.parse(localStorage.getItem('orders') || '[]');
        orders.push(order);
        localStorage.setItem('orders', JSON.stringify(orders));
        console.log('✅ Order saved:', order);
    } catch (e) {
        console.error('Error saving order:', e);
    }
}

/* ============================================================
   Mobile Enhancements
============================================================ */

function detectDeviceType() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) document.body.classList.add('is-mobile');
}

function setVHVariable() {
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}

/* ============================================================
   Event Listeners
============================================================ */

document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ DOM loaded, initializing...');
    
    fetchTonPrice();
    setInterval(fetchTonPrice, 30000);
    refreshLoginUI();
    initTonConnect();
    detectDeviceType();
    setVHVariable();
    
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const tab = btn.getAttribute("data-tab");
            switchTab(tab);
        });
    });
    
    const connectBtn = document.getElementById("connectTonWalletBtn");
    if (connectBtn) connectBtn.addEventListener("click", connectTonWallet);
    
    const disconnectBtn = document.getElementById("disconnectWalletBtn");
    if (disconnectBtn) disconnectBtn.addEventListener("click", disconnectWallet);
    
    const hamburger = document.querySelector(".hamburger");
    if (hamburger) hamburger.addEventListener("click", toggleSidebar);
    
    const overlay = document.getElementById("overlay");
    if (overlay) overlay.addEventListener("click", closeSidebar);
    
    const usernameSubmit = document.getElementById("username-submit");
    if (usernameSubmit) usernameSubmit.addEventListener("click", checkUser);
    
    const removeUserBtn = document.getElementById("remove-user");
    if (removeUserBtn) removeUserBtn.addEventListener("click", removeUser);
    
    const starsAmountInput = document.getElementById("stars-amount");
    if (starsAmountInput) starsAmountInput.addEventListener("input", calculateCustomAmount);
    
    const starsContinueBtn = document.getElementById("stars-continue-btn");
    if (starsContinueBtn) starsContinueBtn.addEventListener("click", buyStars);
    
    document.querySelectorAll(".package").forEach(pkg => {
        pkg.addEventListener("click", function(e) {
            const amount = this.getAttribute("data-amount");
            const ton = this.getAttribute("data-ton");
            selectPackage(amount, ton);
        });
    });
    
    const premiumSubmit = document.getElementById("premium-username-submit");
    if (premiumSubmit) premiumSubmit.addEventListener("click", checkPremiumUser);
    
    const premiumRemove = document.getElementById("premium-remove-user");
    if (premiumRemove) premiumRemove.addEventListener("click", removePremiumUser);
    
    const premiumContinueBtn = document.getElementById("premium-continue-btn");
    if (premiumContinueBtn) premiumContinueBtn.addEventListener("click", buyPremium);
    
    document.querySelectorAll(".plan").forEach(plan => {
        plan.addEventListener("click", function(e) {
            const ton = this.getAttribute("data-ton");
            const planName = this.querySelector("span").innerText;
            selectPremiumPlan(ton, planName);
        });
    });
    
    const loginSendBtn = document.getElementById('login-send');
    if (loginSendBtn) loginSendBtn.addEventListener('click', sendVerificationCode);
    
    const verifyCodeBtn = document.getElementById('verify-code-btn');
    if (verifyCodeBtn) verifyCodeBtn.addEventListener('click', verifyCode);
    
    const codeInput = document.getElementById('login-code');
    if (codeInput) {
        codeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') verifyCode();
        });
    }
    
    const closeLoginBtn = document.getElementById('closeLoginBtn');
    if (closeLoginBtn) closeLoginBtn.addEventListener('click', closeLogin);
    
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', confirmLogout);
    
    const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');
    if (confirmLogoutBtn) confirmLogoutBtn.addEventListener('click', logout);
    
    const cancelLogoutBtn = document.getElementById('cancelLogoutBtn');
    if (cancelLogoutBtn) cancelLogoutBtn.addEventListener('click', closeConfirmPopup);
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeSidebar();
            closeLogin();
            closeConfirmPopup();
            closePaymentModal();
            const walletModal = document.querySelector('.ton-connect-modal');
            if (walletModal) walletModal.style.display = 'none';
        }
    });
    
    const modals = ['login-popup', 'logout-confirm-popup'];
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.addEventListener('touchmove', (e) => {
                e.preventDefault();
            }, { passive: false });
        }
    });
    
    window.addEventListener('resize', setVHVariable);
    window.addEventListener('orientationchange', () => setTimeout(setVHVariable, 100));
});

window.connectTonWallet = connectTonWallet;
window.disconnectWallet = disconnectWallet;
window.openLogin = openLogin;
window.closeLogin = closeLogin;
window.confirmLogout = confirmLogout;
window.closeConfirmPopup = closeConfirmPopup;
window.logout = logout;
window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;
window.switchTab = switchTab;
window.checkUser = checkUser;
window.removeUser = removeUser;
window.buyStars = buyStars;
window.checkPremiumUser = checkPremiumUser;
window.removePremiumUser = removePremiumUser;
window.buyPremium = buyPremium;
window.selectPackage = selectPackage;
window.selectPremiumPlan = selectPremiumPlan;
window.calculateCustomAmount = calculateCustomAmount;
window.sendVerificationCode = sendVerificationCode;
window.verifyCode = verifyCode;
window.closePaymentModal = closePaymentModal;
