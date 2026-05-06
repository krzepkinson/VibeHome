// ==========================================
// LOGIKA: ZMIANA WYKONAWCY (user-log.js)
// ==========================================

window.openChangeUserModal = function(type, id, currentName) {
    document.getElementById('change-user-type').value = type;
    document.getElementById('change-user-id').value = id;
    
    let names = new Set();
    
    if (window.currentUser && window.currentUser.name) {
        names.add(window.currentUser.name);
    }
    
    document.querySelectorAll('[data-user-name]').forEach(el => {
        const n = el.getAttribute('data-user-name');
        if (n && n !== '?' && n !== 'Ja') {
            names.add(n);
        }
    });
    
    if (currentName && currentName !== 'Ja') {
        names.add(currentName);
    }
    
    const listEl = document.getElementById('change-user-list');
    listEl.innerHTML = Array.from(names).map(name => `
        <button onclick="window.saveChangedUser('${window.esc(name)}')" class="w-full text-left px-4 py-3 bg-[#1e1f20] border border-[#333537] rounded-[16px] mb-2 text-neutral-200 active:scale-95 transition-colors">
            <span class="font-medium">${window.esc(name)}</span>
        </button>
    `).join('');
        
    document.getElementById('change-user-custom').value = '';
    
    document.querySelectorAll('#change-user-modal').forEach(modal => {
        modal.classList.remove('hidden');
    });

    setTimeout(() => {
        const input = document.getElementById('change-user-custom');
        if (input) input.focus();
    }, 100);
};

window.saveChangedUser = async function(newName) {
    if (!window.currentUser || !window.currentUser.household_id) {
        window.showToast("Błąd krytyczny: Brak przypisanego domu!");
        return;
    }

    if (!newName) {
        newName = document.getElementById('change-user-custom').value.trim();
    }
    
    if (!newName) return;
    
    const type = document.getElementById('change-user-type').value;
    const id = parseInt(document.getElementById('change-user-id').value);

    let table = type; 
    let col = 'user_name';
    
    if (type === 'todos') { 
        table = 'todos'; 
        col = 'completer_name'; 
    } else if (type === 'todos_creator') { 
        table = 'todos'; 
        col = 'creator_name'; 
    } else if (type === 'activity_logs') { 
        table = 'activity_logs'; 
        col = 'user_name'; 
    } else if (type === 'health_logs') { 
        table = 'health_logs'; 
        col = 'user_name'; 
    }
    
    const { error } = await window.supabaseClient.from(table)
        .update({ [col]: newName })
        .eq('id', id)
        .eq('household_id', window.currentUser.household_id);
        
    if (error) { 
        window.showToast("Błąd: " + error.message); 
    } else {
        window.closeChangeUserModal();
        window.showToast("Zmieniono osobę!");
        
        if (typeof window.invalidateDashboardCache === 'function') {
            window.invalidateDashboardCache();
        }
        
        if (typeof window.refreshCurrentView === 'function') {
            await window.refreshCurrentView();
        }
    }
};

window.closeChangeUserModal = function() { 
    document.querySelectorAll('#change-user-modal').forEach(modal => {
        modal.classList.add('hidden');
    }); 
};
