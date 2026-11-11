// ==========================================
// SYSTEM DELEGACJI ZDARZEŃ - ULTRA STABLE (events.js)
// ==========================================

window.EventDispatcher = (() => {
    const clickHandlers = new Map();
    const pendingElements = new WeakSet();

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

    // 2. REJESTRACJA HANDLERA (Używamy Map dla błyskawicznego dostępu)
    const onClick = (selector, callback) => {
        if (!clickHandlers.has(selector)) {
            clickHandlers.set(selector, []);
        }
        clickHandlers.get(selector).push(callback);
    };

    // 3. GLÓWNA PĘTLA OBSŁUGI ZDARZEŃ (NATURALNY DOM BUBBLING)
    document.addEventListener('click', (e) => {
        let node = e.target;

        // Idziemy w górę od klikniętego elementu do korzenia document
        while (node && node !== document) {
            if (node.nodeType !== 1) { // Ochrona dla węzłów tekstowych / SVG
                node = node.parentNode;
                continue;
            }

            for (const [selector, callbacks] of clickHandlers.entries()) {
                if (node.matches(selector)) {
                    if (pendingElements.has(node)) {
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                    }

                    const pendingResults = [];
                    for (const callback of callbacks) {
                        try {
                            // BEZPIECZNA KAPSUŁKA: Błąd w jednym kliknięciu nie wywala całej aplikacji!
                            const result = callback(e, node);
                            if (result && typeof result.then === 'function') pendingResults.push(result);
                        } catch (err) {
                            console.error(`[EventDispatcher Error] na selectorze "${selector}":`, err);
                            if (window.showToast) {
                                window.showToast("Wystąpił drobny błąd interfejsu");
                            }
                        }
                    }

                    if (pendingResults.length) {
                        pendingElements.add(node);
                        Promise.all(pendingResults.map(result => Promise.resolve(result)))
                            .catch(err => {
                                console.error(`[EventDispatcher Async Error] na selectorze "${selector}":`, err);
                                window.showToast?.('Nie udało się wykonać tej akcji. Spróbuj ponownie.');
                            })
                            .finally(() => pendingElements.delete(node));
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
