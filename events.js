// ==========================================
// SYSTEM DELEGACJI ZDARZEŃ - ULTRA STABLE (events.js)
// ==========================================

window.EventDispatcher = (() => {
    const clickHandlers = new Map();
    let lastClickTime = 0;
    let lastClickTarget = null;

    // 1. STYLE OPTYMALIZACYJNE DLA EKRANÓW DOTYKOWYCH
    // Eliminujemy opóźnienie 300ms na iOS oraz wymuszamy traktowanie klas 'js-' jako przycisków
    const style = document.createElement('style');
    style.innerHTML = `
        [class*="js-"] { 
            cursor: pointer !important; 
            -webkit-tap-highlight-color: transparent; 
            touch-action: manipulation;
        }
    `;
    document.head.appendChild(style);

    // Fix dla zachowania delegacji zdarzeń w iOS Safari
    document.body.addEventListener('touchstart', () => {}, { passive: true });

    // 2. REJESTRACJA HANDLERA (Używamy Map dla błyskawicznego dostępu)
    const onClick = (selector, callback) => {
        if (!clickHandlers.has(selector)) {
            clickHandlers.set(selector, []);
        }
        clickHandlers.get(selector).push(callback);
    };

    // 3. GLÓWNA PĘTLA OBSŁUGI ZDARZEŃ (NATURALNY DOM BUBBLING)
    document.addEventListener('click', (e) => {
        // Ochrona przed podwójnym kliknięciem (Debounce / Double-Tap Guard - 200ms)
        const now = Date.now();
        if (e.target === lastClickTarget && (now - lastClickTime < 200)) {
            e.preventDefault();
            return;
        }
        lastClickTime = now;
        lastClickTarget = e.target;

        let node = e.target;

        // Idziemy w górę od klikniętego elementu do korzenia document
        while (node && node !== document) {
            if (node.nodeType !== 1) { // Ochrona dla węzłów tekstowych / SVG
                node = node.parentNode;
                continue;
            }

            for (const [selector, callbacks] of clickHandlers.entries()) {
                if (node.matches(selector)) {
                    for (const callback of callbacks) {
                        try {
                            // BEZPIECZNA KAPSUŁKA: Błąd w jednym kliknięciu nie wywala całej aplikacji!
                            callback(e, node);
                        } catch (err) {
                            console.error(`[EventDispatcher Error] na selectorze "${selector}":`, err);
                            if (window.showToast) {
                                window.showToast("Wystąpił drobny błąd interfejsu");
                            }
                        }
                    }
                    // Po znalezieniu i obsłudze najbliższego elementu przerywamy,
                    // aby nie odpalać rodziców z tą samą klasą
                    return;
                }
            }
            node = node.parentNode;
        }
    }, true); // Capture phase dla pewniejszego przechwytywania zdarzeń mobilnych

    return { onClick };
})();
