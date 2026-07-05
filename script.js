// ========================================
// script.js - Sản phẩm và thanh toán game
// ========================================

(function() {
    'use strict';

    // ===== CONFIG =====
    const TELEGRAM_BOT_TOKEN = '8854670785:AAEM4ct2tEJwhJbginwQQSldX-vv4VfYCV0';
    const TELEGRAM_CHAT_ID = '5718360748';

    // ===== DATA =====
    const GAMES = {
        freefire: {
            id: 'FF',
            name: 'Free Fire',
            packages: [
                { code: '10', name: '25 Kim cương', price: 5000 },
                { code: '20', name: '51 Kim cương', price: 10000 },
                { code: '40', name: '113 Kim cương', price: 20000 },
                { code: '100', name: '283 Kim cương', price: 50000 },
                { code: '200', name: '566 Kim cương', price: 100000 },
                { code: '400', name: '1132 Kim cương', price: 200000 },
                { code: '1000', name: '2830 Kim cương', price: 500000 },
                { code: 'sung_3n', name: 'Thẻ nâng cấp súng 3 ngày', price: 14000 },
                { code: 'sung_7n', name: 'Thẻ nâng cấp súng 7 ngày', price: 21000 },
                { code: 'sung_30n', name: 'Thẻ nâng cấp súng 30 ngày', price: 57000 },
                { code: 'vip_tietkiem', name: 'Thẻ ví tuần tiết kiệm', price: 12000 },
                { code: 'week', name: 'Thẻ tuần', price: 50000 },
                { code: 'booyah', name: 'Thẻ Booyah', price: 55000 },
                { code: 'month', name: 'Thẻ tháng', price: 220000 }
            ]
        },
        lienquan: {
            id: 'LQ',
            name: 'Liên Quân',
            packages: [
                { code: '10|lien-quan-mobile', name: '10 Quân Huy', price: 5000 },
                { code: '20|lien-quan-mobile', name: '20 Quân Huy', price: 10000 },
                { code: '40|lien-quan-mobile', name: '40 Quân Huy', price: 20000 },
                { code: '100|lien-quan-mobile', name: '102 Quân Huy', price: 50000 },
                { code: '200|lien-quan-mobile', name: '204 Quân Huy', price: 100000 },
                { code: '400|lien-quan-mobile', name: '408 Quân Huy', price: 200000 },
                { code: '1000|lien-quan-mobile', name: '1,020 Quân Huy', price: 500000 },
                { code: '2000|lien-quan-mobile', name: '2,090 Quân Huy', price: 1000000 }
            ]
        }
    };

    // ===== STATE =====
    let currentGame = 'freefire';
    let isProcessing = false;

    // ===== DOM REFS =====
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    const toastClose = document.getElementById('toastClose');
    const loginOverlay = document.getElementById('loginOverlay');
    const bannedOverlay = document.getElementById('bannedOverlay');

    // ===== HELPERS =====
    function formatCurrency(amount) {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount).replace('₫', 'đ');
    }

    function getFee(form) {
        const select = form.querySelector('.fee-code');
        if (!select) return 0;
        return parseFloat(select.options[select.selectedIndex].dataset.fee) || 0;
    }

    function getTotalAfterDiscount(form) {
        const amountInput = form.querySelector('.selected-amount');
        const price = parseInt(amountInput.value) || 0;
        const fee = getFee(form);
        return Math.round(price - (price * fee / 100));
    }

    function generateOrderId() {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `ORD-${timestamp}-${random}`;
    }

    function showToast(message, type = 'success') {
        if (!toast || !toastMessage) return;
        toast.className = `toast-custom toast-${type}`;
        toastMessage.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 4000);
    }

    if (toastClose) {
        toastClose.addEventListener('click', () => toast.classList.remove('show'));
    }

    // ===== SEND TELEGRAM =====
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

    // ===== RENDER PACKAGES =====
    function renderPackages(gameKey, containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('Container not found:', containerId);
            return;
        }
        
        const game = GAMES[gameKey];
        if (!game) {
            console.error('Game not found:', gameKey);
            return;
        }
        
        container.innerHTML = '';
        
        game.packages.forEach((pkg, index) => {
            const col = document.createElement('div');
            col.className = 'col-6 col-md-4 col-lg-3 mb-3';
            
            const div = document.createElement('div');
            div.className = `package-item${index === 0 ? ' selected' : ''}`;
            div.dataset.code = pkg.code;
            div.dataset.price = pkg.price;
            div.innerHTML = `
                <div class="package-name">${pkg.name}</div>
                <div class="package-price">${formatCurrency(pkg.price)}</div>
            `;
            
            div.addEventListener('click', function() {
                container.querySelectorAll('.package-item').forEach(el => el.classList.remove('selected'));
                this.classList.add('selected');
                const form = this.closest('.game-panel').querySelector('form');
                if (form) {
                    const codeInput = form.querySelector('.selected-package-code');
                    const amountInput = form.querySelector('.selected-amount');
                    if (codeInput) codeInput.value = pkg.code;
                    if (amountInput) amountInput.value = pkg.price;
                    updateOrderSummary(form);
                }
            });
            
            col.appendChild(div);
            container.appendChild(col);
        });
        
        const form = container.closest('.game-panel').querySelector('form');
        if (form) {
            const firstPkg = game.packages[0];
            const codeInput = form.querySelector('.selected-package-code');
            const amountInput = form.querySelector('.selected-amount');
            if (codeInput) codeInput.value = firstPkg.code;
            if (amountInput) amountInput.value = firstPkg.price;
            updateOrderSummary(form);
        }
    }

    // ===== UPDATE ORDER =====
    function updateOrderSummary(form) {
        if (!form) return;
        const amountInput = form.querySelector('.selected-amount');
        const price = parseInt(amountInput.value) || 0;
        const fee = getFee(form);
        const discount = price * fee / 100;
        const total = Math.round(price - discount);
        
        const subtotal = form.querySelector('.subtotal');
        const feePercent = form.querySelector('.fee-percent');
        const feeDisplay = form.querySelector('.fee-display');
        const totalDisplay = form.querySelector('.total-display');
        const btn = form.querySelector('.payment-btn');
        
        if (subtotal) subtotal.textContent = formatCurrency(price);
        if (feePercent) feePercent.textContent = fee;
        if (feeDisplay) feeDisplay.textContent = formatCurrency(discount);
        if (totalDisplay) totalDisplay.textContent = formatCurrency(total);
        
        if (btn) {
            btn.innerHTML = `<i class="fas fa-wallet"></i> Thanh toán bằng Ví ${formatCurrency(total)}`;
        }
    }

    // ===== HANDLE PAYMENT =====
    async function handlePayment(e) {
        if (isProcessing) return;
        
        if (!window.isLoggedIn()) {
            if (loginOverlay) loginOverlay.style.display = 'flex';
            showToast('⚠️ Vui lòng đăng nhập!', 'error');
            return;
        }
        
        const user = window.getCurrentUser ? window.getCurrentUser() : null;
        if (user) {
            const users = JSON.parse(localStorage.getItem('shop_users_data') || '{}');
            if (users[user.id] && users[user.id].banned) {
                if (bannedOverlay) bannedOverlay.style.display = 'flex';
                if (loginOverlay) loginOverlay.style.display = 'none';
                showToast('🚫 Tài khoản đã bị khóa!', 'error');
                return;
            }
        }
        
        const form = e.target.closest('form');
        if (!form) return;
        
        const totalAmount = getTotalAfterDiscount(form);
        const amountInput = form.querySelector('.selected-amount');
        const originalPrice = parseInt(amountInput.value) || 0;
        const fee = getFee(form);
        
        if (originalPrice < 5000) {
            showToast('Số tiền tối thiểu là 5,000đ!', 'error');
            return;
        }
        
        const idGame = form.querySelector('input[name="id_game"]');
        if (idGame && !idGame.value.trim()) {
            showToast('Vui lòng nhập ID Game!', 'error');
            idGame.focus();
            return;
        }
        
        const balance = window.getWalletBalance ? window.getWalletBalance() : 0;
        if (balance < totalAmount) {
            showToast(`⚠️ Số dư không đủ! Cần ${formatCurrency(totalAmount)} - Có ${formatCurrency(balance)}`, 'error');
            return;
        }
        
        isProcessing = true;
        const btn = form.querySelector('.payment-btn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';
        }
        
        try {
            const gamePanel = form.closest('.game-panel');
            const gameKey = gamePanel?.id?.replace('panel-', '') || 'freefire';
            const gameData = GAMES[gameKey];
            const gameName = gameData ? gameData.name : 'Game';
            
            const packageCode = form.querySelector('.selected-package-code').value;
            let pkgName = '';
            if (gameData) {
                const pkg = gameData.packages.find(p => p.code === packageCode);
                if (pkg) pkgName = pkg.name;
            }
            
            const idGameValue = idGame ? idGame.value.trim() : 'Không có';
            const orderId = generateOrderId();
            
            if (user && window.deductWalletBalance) {
                const deducted = window.deductWalletBalance(user.id, totalAmount);
                if (deducted) {
                    const message = `
📋 *Mã đơn:* ${orderId}
🎮 *Game:* ${gameName}
👤 *User:* ${user.displayName || user.username}
🆔 *User ID:* \`${user.id}\`
👤 *ID Game:* ${idGameValue}
📦 *Gói:* ${pkgName}
💸 *Chiết khấu:* ${fee}%
💎 *Tổng thanh toán:* ${formatCurrency(totalAmount)}
🕐 *Thời gian:* ${new Date().toLocaleString('vi-VN')}
                    `;
                    sendTelegramMessage(message);
                    
                    showToast(`✅ Thanh toán thành công! -${formatCurrency(totalAmount)}`, 'success');
                    
                    if (btn) {
                        btn.innerHTML = '<i class="fas fa-check-circle"></i> Đã thanh toán';
                        btn.disabled = true;
                    }
                    
                    if (window.updateWalletUI) window.updateWalletUI();
                    form.querySelector('input[name="id_game"]').value = '';
                    
                } else {
                    showToast('❌ Lỗi thanh toán!', 'error');
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = `<i class="fas fa-wallet"></i> Thanh toán bằng Ví ${formatCurrency(totalAmount)}`;
                    }
                }
            }
            
            isProcessing = false;
            
        } catch (error) {
            console.error('Lỗi:', error);
            showToast('⚠️ Lỗi xử lý!', 'error');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i class="fas fa-wallet"></i> Thanh toán bằng Ví ${formatCurrency(totalAmount)}`;
            }
            isProcessing = false;
        }
    }

    // ===== TAB SWITCHING =====
    function switchTab(gameKey) {
        currentGame = gameKey;
        
        document.querySelectorAll('.game-tabs li').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.game === gameKey);
        });
        
        document.querySelectorAll('.game-panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === `panel-${gameKey}`);
        });
        
        const panel = document.getElementById(`panel-${gameKey}`);
        if (panel) {
            const container = panel.querySelector('.package-grid');
            if (container && !container.querySelector('.package-item') && gameKey !== 'admin') {
                renderPackages(gameKey, container.id);
            }
        }
    }

    // ===== CHECK LOGIN =====
    function checkLoginStatus() {
        const isLoggedIn = window.isLoggedIn ? window.isLoggedIn() : false;
        
        if (!isLoggedIn) {
            if (loginOverlay) loginOverlay.style.display = 'flex';
            if (bannedOverlay) bannedOverlay.style.display = 'none';
            document.querySelectorAll('.game-panel').forEach(panel => {
                panel.style.opacity = '0.3';
                panel.style.pointerEvents = 'none';
            });
        } else {
            const user = window.getCurrentUser ? window.getCurrentUser() : null;
            if (user) {
                const users = JSON.parse(localStorage.getItem('shop_users_data') || '{}');
                if (users[user.id] && users[user.id].banned) {
                    if (bannedOverlay) bannedOverlay.style.display = 'flex';
                    if (loginOverlay) loginOverlay.style.display = 'none';
                    document.querySelectorAll('.game-panel').forEach(panel => {
                        panel.style.opacity = '0.3';
                        panel.style.pointerEvents = 'none';
                    });
                    return;
                }
            }
            
            if (loginOverlay) loginOverlay.style.display = 'none';
            if (bannedOverlay) bannedOverlay.style.display = 'none';
            document.querySelectorAll('.game-panel').forEach(panel => {
                panel.style.opacity = '1';
                panel.style.pointerEvents = 'auto';
            });
        }
    }

    // ===== OVERLAY BUTTONS =====
    function setupOverlayButtons() {
        const overlayLoginBtn = document.getElementById('overlayLoginBtn');
        if (overlayLoginBtn) {
            overlayLoginBtn.addEventListener('click', function(e) {
                e.preventDefault();
                if (loginOverlay) loginOverlay.style.display = 'none';
                $('#loginModal').modal('show');
            });
        }

        const overlayRegisterBtn = document.getElementById('overlayRegisterBtn');
        if (overlayRegisterBtn) {
            overlayRegisterBtn.addEventListener('click', function(e) {
                e.preventDefault();
                if (loginOverlay) loginOverlay.style.display = 'none';
                $('#registerModal').modal('show');
            });
        }
    }

    // ===== EVENTS =====
    document.addEventListener('click', function(e) {
        if (e.target.closest('.payment-btn')) {
            handlePayment(e);
        }
    });

    document.addEventListener('change', function(e) {
        if (e.target.classList.contains('fee-code')) {
            const form = e.target.closest('form');
            if (form) updateOrderSummary(form);
        }
    });

    // ===== INIT =====
    renderPackages('freefire', 'packageGridFF');
    renderPackages('lienquan', 'packageGridLQ');
    
    setupOverlayButtons();
    
    setTimeout(function() {
        checkLoginStatus();
        console.log('✅ Script.js đã sẵn sàng!');
    }, 500);

    document.addEventListener('loginSuccess', function() {
        checkLoginStatus();
        if (window.updateWalletUI) window.updateWalletUI();
    });
    
    document.addEventListener('logoutSuccess', function() {
        checkLoginStatus();
    });

    $(document).on('hidden.bs.modal', '#loginModal', function() {
        setTimeout(checkLoginStatus, 300);
    });
    
    $(document).on('hidden.bs.modal', '#registerModal', function() {
        setTimeout(checkLoginStatus, 300);
    });

    // ========================================
    // ADMIN PANEL - Quản lý user thật
    // ========================================

    // ===== ADMIN DATA =====
    let adminHistory = JSON.parse(localStorage.getItem('admin_transfer_history')) || [];

    // ===== LẤY USER THẬT TỪ LOCALSTORAGE =====
    function getRealUsers() {
        const users = JSON.parse(localStorage.getItem('shop_users_data') || '{}');
        const result = [];
        for (const id in users) {
            const u = users[id];
            result.push({
                id: id,
                name: u.displayName || u.username || 'Unknown',
                email: u.email || '',
                balance: u.wallet || 0,
                role: u.role || 'user',
                banned: u.banned || false
            });
        }
        result.sort((a, b) => b.balance - a.balance);
        return result;
    }

    function getRealUserById(id) {
        const users = JSON.parse(localStorage.getItem('shop_users_data') || '{}');
        if (users[id]) {
            return {
                id: id,
                name: users[id].displayName || users[id].username || 'Unknown',
                email: users[id].email || '',
                balance: users[id].wallet || 0,
                role: users[id].role || 'user',
                banned: users[id].banned || false
            };
        }
        return null;
    }

    function updateRealUserBalance(userId, newBalance) {
        const users = JSON.parse(localStorage.getItem('shop_users_data') || '{}');
        if (users[userId]) {
            users[userId].wallet = newBalance;
            users[userId].updatedAt = new Date().toISOString();
            localStorage.setItem('shop_users_data', JSON.stringify(users));
            
            const auth = JSON.parse(localStorage.getItem('shop_auth_data') || '{}');
            if (auth && auth.id === userId) {
                auth.wallet = newBalance;
                localStorage.setItem('shop_auth_data', JSON.stringify(auth));
                if (window.updateWalletUI) window.updateWalletUI();
            }
            return true;
        }
        return false;
    }

    // ===== RENDER ADMIN =====
    window.renderAdminPanel = function() {
        const users = getRealUsers();
        const memberList = document.getElementById('memberList');
        const fromMember = document.getElementById('fromMember');
        const toMember = document.getElementById('toMember');
        
        if (!memberList) return;

        memberList.innerHTML = users.map((u, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>
                    <strong>${u.name}</strong>
                    ${u.role === 'admin' ? ' <span class="badge badge-primary">Admin</span>' : ''}
                    ${u.banned ? ' <span class="badge badge-danger">Banned</span>' : ''}
                </td>
                <td class="small">${u.email || 'N/A'}</td>
                <td class="text-right font-weight-bold" style="color: ${u.balance > 0 ? '#10b981' : '#6c757d'};">
                    ${formatCurrency(u.balance)}
                </td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-primary" onclick="adminSetBalance('${u.id}')" title="Set số dư">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${u.role !== 'admin' ? `
                        <button class="btn btn-sm btn-outline-${u.banned ? 'success' : 'danger'}" onclick="adminToggleBan('${u.id}')" title="${u.banned ? 'Mở khóa' : 'Khóa'}">
                            <i class="fas fa-${u.banned ? 'unlock' : 'ban'}"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="adminDeleteUser('${u.id}')" title="Xóa user">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </td>
            </tr>
        `).join('');

        const options = users.map(u => 
            `<option value="${u.id}">${u.name} (${formatCurrency(u.balance)})</option>`
        ).join('');

        if (fromMember) {
            fromMember.innerHTML = `<option value="">Chọn người gửi</option>${options}`;
        }
        if (toMember) {
            toMember.innerHTML = `<option value="">Chọn người nhận</option>${options}`;
        }

        const total = users.reduce((sum, u) => sum + u.balance, 0);
        const avg = users.length > 0 ? Math.round(total / users.length) : 0;
        const max = users.length > 0 ? Math.max(...users.map(u => u.balance)) : 0;

        const totalMembersEl = document.getElementById('totalMembers');
        const totalBalanceEl = document.getElementById('totalBalance');
        const avgBalanceEl = document.getElementById('avgBalance');
        const maxBalanceEl = document.getElementById('maxBalance');
        const totalFundEl = document.getElementById('totalFund');
        const lastUpdateEl = document.getElementById('lastUpdate');

        if (totalMembersEl) totalMembersEl.textContent = users.length;
        if (totalBalanceEl) totalBalanceEl.textContent = formatCurrency(total);
        if (avgBalanceEl) avgBalanceEl.textContent = formatCurrency(avg);
        if (maxBalanceEl) maxBalanceEl.textContent = formatCurrency(max);
        if (totalFundEl) totalFundEl.textContent = formatCurrency(total);
        if (lastUpdateEl) lastUpdateEl.textContent = new Date().toLocaleString('vi-VN');

        renderAdminHistory();
    };

    function renderAdminHistory() {
        const historyList = document.getElementById('historyList');
        if (!historyList) return;

        if (adminHistory.length === 0) {
            historyList.innerHTML = `<tr><td colspan="4" class="text-center text-muted">Chưa có giao dịch</td></tr>`;
            return;
        }

        historyList.innerHTML = adminHistory.slice(0, 50).map(item => `
            <tr>
                <td class="small">${item.time}</td>
                <td>${item.from}</td>
                <td>${item.to}</td>
                <td class="text-right font-weight-bold text-primary">${formatCurrency(item.amount)}</td>
            </tr>
        `).join('');
    }

    // ===== ADMIN ACTIONS =====
    window.adminSetBalance = function(userId) {
        const user = getRealUserById(userId);
        if (!user) {
            showToast('⚠️ Không tìm thấy user!', 'error');
            return;
        }

        const amount = prompt(`💰 Nhập số dư mới cho ${user.name}:`, user.balance || 0);
        if (amount === null) return;

        const num = parseFloat(amount.replace(/,/g, ''));
        if (isNaN(num) || num < 0) {
            showToast('❌ Số tiền không hợp lệ!', 'error');
            return;
        }

        if (updateRealUserBalance(userId, num)) {
            showToast(`✅ Đã set ${formatCurrency(num)} cho ${user.name}`, 'success');
            renderAdminPanel();
            if (window.updateWalletUI) window.updateWalletUI();
        } else {
            showToast('❌ Lỗi cập nhật!', 'error');
        }
    };

    window.adminToggleBan = function(userId) {
        const users = JSON.parse(localStorage.getItem('shop_users_data') || '{}');
        if (!users[userId]) return;

        if (users[userId].role === 'admin') {
            showToast('⚠️ Không thể khóa Admin!', 'error');
            return;
        }

        users[userId].banned = !users[userId].banned;
        users[userId].updatedAt = new Date().toISOString();
        localStorage.setItem('shop_users_data', JSON.stringify(users));

        const action = users[userId].banned ? 'đã khóa' : 'đã mở khóa';
        showToast(`✅ ${action} ${users[userId].displayName || users[userId].username}`, 'success');
        renderAdminPanel();
    };

    // ===== XÓA USER =====
    window.adminDeleteUser = function(userId) {
        const users = JSON.parse(localStorage.getItem('shop_users_data') || '{}');
        if (!users[userId]) {
            showToast('❌ Không tìm thấy user!', 'error');
            return;
        }
        
        if (users[userId].role === 'admin') {
            showToast('⚠️ Không thể xóa Admin!', 'error');
            return;
        }
        
        const name = users[userId].displayName || users[userId].username;
        if (!confirm(`⚠️ Bạn có chắc muốn xóa user "${name}"?\n📧 Email: ${users[userId].email || 'Không có'}\n💰 Số dư: ${formatCurrency(users[userId].wallet || 0)}\n\nHành động này không thể hoàn tác!`)) return;
        
        delete users[userId];
        localStorage.setItem('shop_users_data', JSON.stringify(users));
        
        const auth = JSON.parse(localStorage.getItem('shop_auth_data') || '{}');
        if (auth && auth.id === userId) {
            localStorage.removeItem('shop_auth_data');
            if (window.updateUI) window.updateUI();
        }
        
        showToast(`✅ Đã xóa user ${name}`, 'success');
        renderAdminPanel();
        if (window.renderPendingTransactions) renderPendingTransactions();
    };

    window.adminAddMember = function() {
        const name = prompt('👤 Nhập tên thành viên mới:');
        if (!name || !name.trim()) return;

        const email = prompt('📧 Nhập email (hoặc để trống):');
        const password = prompt('🔑 Nhập mật khẩu (mặc định: 123456):') || '123456';

        const users = JSON.parse(localStorage.getItem('shop_users_data') || '{}');
        const username = email ? email.split('@')[0] : name.trim().toLowerCase().replace(/\s/g, '');

        for (const id in users) {
            if (users[id].username === username) {
                showToast('❌ Tên đăng nhập đã tồn tại!', 'error');
                return;
            }
        }

        const userId = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);

        function hashPassword(pwd) {
            let hash = 0;
            for (let i = 0; i < pwd.length; i++) {
                const char = pwd.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            return 'hash_' + hash.toString(36);
        }

        users[userId] = {
            username: username,
            email: email || '',
            displayName: name.trim(),
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

        localStorage.setItem('shop_users_data', JSON.stringify(users));
        showToast(`✅ Đã thêm ${name.trim()}`, 'success');
        renderAdminPanel();
    };

    // ===== HANDLE TRANSFER =====
    window.handleTransfer = function() {
        const fromId = document.getElementById('fromMember').value;
        const toId = document.getElementById('toMember').value;
        const amountInput = document.querySelector('#transferForm input[name="amount"]');
        const noteInput = document.querySelector('#transferForm input[name="note"]');
        const amount = parseInt(amountInput.value);
        const note = noteInput.value.trim() || 'Chuyển tiền';
        const statusDiv = document.getElementById('transferStatus');

        statusDiv.style.display = 'none';

        if (!fromId || !toId) {
            showToast('⚠️ Vui lòng chọn người gửi và người nhận!', 'error');
            return;
        }

        if (fromId === toId) {
            showToast('⚠️ Không thể chuyển cho chính mình!', 'error');
            return;
        }

        if (!amount || amount < 1000) {
            showToast('⚠️ Số tiền tối thiểu 1,000đ!', 'error');
            return;
        }

        const users = JSON.parse(localStorage.getItem('shop_users_data') || '{}');
        const fromUser = users[fromId];
        const toUser = users[toId];

        if (!fromUser || !toUser) {
            showToast('⚠️ Không tìm thấy user!', 'error');
            return;
        }

        if ((fromUser.wallet || 0) < amount) {
            showToast(`⚠️ Số dư ${fromUser.displayName} không đủ!`, 'error');
            return;
        }

        fromUser.wallet = (fromUser.wallet || 0) - amount;
        toUser.wallet = (toUser.wallet || 0) + amount;
        fromUser.updatedAt = new Date().toISOString();
        toUser.updatedAt = new Date().toISOString();
        localStorage.setItem('shop_users_data', JSON.stringify(users));

        adminHistory.unshift({
            time: new Date().toLocaleString('vi-VN'),
            from: fromUser.displayName || fromUser.username,
            to: toUser.displayName || toUser.username,
            amount: amount,
            note: note
        });
        localStorage.setItem('admin_transfer_history', JSON.stringify(adminHistory));

        const auth = JSON.parse(localStorage.getItem('shop_auth_data') || '{}');
        if (auth && auth.id === fromId) {
            auth.wallet = fromUser.wallet;
            localStorage.setItem('shop_auth_data', JSON.stringify(auth));
        }
        if (auth && auth.id === toId) {
            auth.wallet = toUser.wallet;
            localStorage.setItem('shop_auth_data', JSON.stringify(auth));
        }

        statusDiv.className = 'status-success';
        statusDiv.innerHTML = `
            ✅ <strong>Chuyển tiền thành công!</strong><br>
            <i class="fas fa-arrow-up text-success"></i> ${fromUser.displayName} → <i class="fas fa-arrow-down text-danger"></i> ${toUser.displayName}<br>
            Số tiền: <strong>${formatCurrency(amount)}</strong>
        `;
        statusDiv.style.display = 'block';

        showToast(`✅ Chuyển ${formatCurrency(amount)} thành công!`, 'success');
        renderAdminPanel();
        if (window.updateWalletUI) window.updateWalletUI();

        amountInput.value = '';
        noteInput.value = '';
    };

    // ===== CHECK ADMIN =====
    function checkAdminAndShowTab() {
        const auth = JSON.parse(localStorage.getItem('shop_auth_data') || '{}');
        const users = JSON.parse(localStorage.getItem('shop_users_data') || '{}');
        const adminTab = document.getElementById('adminTab');

        if (auth && auth.id && users[auth.id] && users[auth.id].role === 'admin') {
            if (adminTab) adminTab.style.display = 'inline-block';
        } else {
            if (adminTab) adminTab.style.display = 'none';
        }
    }

    // ===== RENDER PENDING TRANSACTIONS =====
    window.renderPendingTransactions = function() {
        const container = document.getElementById('pendingTxList');
        const noPending = document.getElementById('noPendingTx');
        if (!container) return;
        
        const transactions = JSON.parse(localStorage.getItem('wallet_transactions') || '{}');
        const users = JSON.parse(localStorage.getItem('shop_users_data') || '{}');
        
        let pendingList = '';
        let count = 0;
        
        for (const id in transactions) {
            const tx = transactions[id];
            if (tx.status === 'pending' || tx.status === 'confirmed_by_user') {
                count++;
                const user = users[tx.userId];
                const userName = user ? (user.displayName || user.username || 'Unknown') : 'Unknown';
                const statusText = tx.status === 'confirmed_by_user' ? '✅ Đã xác nhận' : '⏳ Chờ xác nhận';
                
                pendingList += `
                    <div class="pending-tx-item" style="background: #f8f9fa; border-radius: 8px; padding: 10px 14px; margin-bottom: 8px; border-left: 3px solid ${tx.status === 'confirmed_by_user' ? '#10b981' : '#f59e0b'};">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <strong style="font-size: 13px;">${userName}</strong>
                                <span class="badge ${tx.status === 'confirmed_by_user' ? 'badge-success' : 'badge-warning'}" style="font-size: 10px;">${statusText}</span>
                                <div style="font-size: 12px; color: #6c757d;">
                                    <i class="fas fa-hashtag"></i> ${id.substring(0, 20)}...
                                </div>
                            </div>
                            <div class="text-right">
                                <div style="font-weight: 700; color: #d82d8b; font-size: 15px;">${formatCurrency(tx.amount)}</div>
                                ${tx.status === 'confirmed_by_user' ? `
                                    <button class="btn btn-sm btn-success" onclick="approveTransaction('${id}')" style="font-size: 11px; padding: 2px 10px;">
                                        <i class="fas fa-check"></i> Duyệt
                                    </button>
                                ` : `
                                    <button class="btn btn-sm btn-outline-secondary" disabled style="font-size: 11px; padding: 2px 10px;">
                                        <i class="fas fa-clock"></i> Chờ xác nhận
                                    </button>
                                `}
                            </div>
                        </div>
                        <div style="font-size: 11px; color: #6c757d; margin-top: 4px;">
                            <i class="fas fa-clock"></i> ${new Date(tx.time).toLocaleString('vi-VN')}
                        </div>
                    </div>
                `;
            }
        }
        
        if (count === 0) {
            container.innerHTML = '';
            if (noPending) noPending.style.display = 'block';
        } else {
            container.innerHTML = pendingList;
            if (noPending) noPending.style.display = 'none';
        }
    };

    // ===== DUYỆT GIAO DỊCH =====
    window.approveTransaction = function(txId) {
        if (!confirm('Bạn có chắc muốn duyệt giao dịch này?')) return;
        
        const transactions = JSON.parse(localStorage.getItem('wallet_transactions') || '{}');
        const users = JSON.parse(localStorage.getItem('shop_users_data') || '{}');
        
        const tx = transactions[txId];
        if (!tx) {
            showToast('❌ Không tìm thấy giao dịch!', 'error');
            return;
        }
        
        if (tx.status === 'completed') {
            showToast('⚠️ Giao dịch đã được duyệt!', 'error');
            return;
        }
        
        if (tx.status !== 'confirmed_by_user') {
            showToast('⚠️ Giao dịch chưa được xác nhận!', 'error');
            return;
        }
        
        const user = users[tx.userId];
        if (!user) {
            showToast('❌ Không tìm thấy user!', 'error');
            return;
        }
        
        const oldBalance = user.wallet || 0;
        user.wallet = oldBalance + tx.amount;
        user.totalRecharge = (user.totalRecharge || 0) + tx.amount;
        user.updatedAt = new Date().toISOString();
        
        tx.status = 'completed';
        tx.completedAt = new Date().toISOString();
        tx.completedBy = 'admin';
        
        localStorage.setItem('shop_users_data', JSON.stringify(users));
        localStorage.setItem('wallet_transactions', JSON.stringify(transactions));
        
        const auth = JSON.parse(localStorage.getItem('shop_auth_data') || '{}');
        if (auth && auth.id === tx.userId) {
            auth.wallet = user.wallet;
            auth.totalRecharge = user.totalRecharge;
            localStorage.setItem('shop_auth_data', JSON.stringify(auth));
            if (window.updateWalletUI) window.updateWalletUI();
        }
        
        showToast(`✅ Đã duyệt ${formatCurrency(tx.amount)} cho ${user.displayName || user.username}`, 'success');
        
        if (window.sendTelegramMessage) {
            const msg = `
✅ *DUYỆT NẠP VÍ THÀNH CÔNG*

📋 *Mã GD:* ${txId}
👤 *User:* ${user.displayName || user.username}
💵 *Số tiền:* +${formatCurrency(tx.amount)}
💰 *Số dư mới:* ${formatCurrency(user.wallet)}
🕐 *Thời gian:* ${new Date().toLocaleString('vi-VN')}
            `;
            window.sendTelegramMessage(msg);
        }
        
        renderPendingTransactions();
        renderAdminPanel();
        if (window.updateWalletUI) window.updateWalletUI();
    };

    // ===== INIT ADMIN =====
    setTimeout(function() {
        checkAdminAndShowTab();
        const activeTab = document.querySelector('.game-tabs li.active');
        if (activeTab && activeTab.dataset.game === 'admin') {
            setTimeout(renderAdminPanel, 300);
            setTimeout(renderPendingTransactions, 400);
        }
        console.log('✅ Admin Panel loaded!');
    }, 1000);

    document.addEventListener('loginSuccess', function() {
        setTimeout(checkAdminAndShowTab, 500);
        setTimeout(renderAdminPanel, 600);
        setTimeout(renderPendingTransactions, 700);
    });

    document.addEventListener('logoutSuccess', function() {
        const adminTab = document.getElementById('adminTab');
        if (adminTab) adminTab.style.display = 'none';
    });

    document.addEventListener('authUpdated', function() {
        checkAdminAndShowTab();
        const activeTab = document.querySelector('.game-tabs li.active');
        if (activeTab && activeTab.dataset.game === 'admin') {
            setTimeout(renderAdminPanel, 300);
            setTimeout(renderPendingTransactions, 400);
        }
    });

})();

