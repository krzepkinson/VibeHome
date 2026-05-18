// ==========================================
// LOGIKA: ZMIANA WYKONAWCY (user-log.js)
// ==========================================

window.UserLogModule = (() => {

    window.openChangeUserModal = async function(type, id, currentName) {
        document.getElementById('change-user-type').value = type;
        document.getElementById('change-user-id').value = id;
        
        const listEl = document.getElementById('change-user-list');
        
        listEl.innerHTML = `<p class="text-center text-neutral-500 text-xs py-6 animate-pulse">Szukam domowników...</p>`;
        document.getElementById('change-user-custom').value = '';
        
        document.querySelectorAll('#change-user-modal').forEach(modal => {
            modal.classList.remove('hidden');
        });

        let names = new Set();
        
        if (window.currentUser && window.currentUser.name) {
            names.add(window.currentUser.name);
        }
        
        try {
            const { data, error } = await window.supabaseClient
                .from('profiles')
                .select('name')
                .eq('household_id', window.currentUser.household_id);

            if (!error && data) {
                data.forEach(profile => {
                    if (profile.name && profile.name !== '?' && profile.name !== 'Ja') {
                        names.add(profile.name);
                    }
                });
            }
        } catch (e) {
            console.error("Błąd pobierania domowników:", e);
        }
        
        if (currentName && currentName !== 'Ja' && currentName !== '?') {
            names.add(currentName);
        }
        
        listEl.innerHTML = Array.from(names).map(name => `
            <button class="js-save-changed-user w-full text-left px-4 py-3 bg-[#1e1f20] border border-[#333537] rounded-[16px] mb-2 text-neutral-200 active:scale-95 transition-colors" data-name="${window.esc(name)}">
                <span class="font-medium">${window.esc(name)}</span>
            </button>
        `).join('');
        
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

    // ==========================================
    // DELEGACJA ZDARZEŃ (VIA DISPATCHER)
    // ==========================================
    if (window.EventDispatcher) {
        window.EventDispatcher.onClick('.js-save-changed-user', (e, el) => {
            const name = el.dataset.name || '';
            window.saveChangedUser(name);
        });
        window.EventDispatcher.onClick('.js-close-change-user', () => window.closeChangeUserModal());
    } else {
        console.error("EventDispatcher nie został załadowany!");
    }

    return {};
})();
