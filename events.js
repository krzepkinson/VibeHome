// ==========================================
// SYSTEM DELEGACJI ZDARZEŃ (events.js)
// ==========================================

window.EventDispatcher = (() => {
    const clickHandlers = [];

    // Rejestracja globalnego nasłuchiwacza na klasę (np. .js-open-modal)
    const onClick = (selector, callback) => {
        clickHandlers.push({ selector, callback });
    };

    // ZMIANA KRYTYCZNA: Zaawansowane szukanie najspecyficzniejszego (najbliższego) dopasowania!
    document.addEventListener('click', (e) => {
        let bestMatch = null;
        let bestDepth = Infinity;

        for (let i = 0; i < clickHandlers.length; i++) {
            const { selector, callback } = clickHandlers[i];
            const targetElement = e.target.closest(selector);

            if (!targetElement) continue;

            // Obliczamy głębokość: im bliżej e.target (klikanego miejsca) tym mniejsza głębokość (wyższy priorytet)
            let depth = 0;
            let node = e.target;
            while (node && node !== targetElement) {
                depth++;
                node = node.parentElement;
            }

            if (depth < bestDepth) {
                bestDepth = depth;
                bestMatch = { callback, targetElement };
            }
        }

        // Uruchamiamy TYLKO jedno, najdokładniejsze trafienie!
        if (bestMatch) {
            bestMatch.callback(e, bestMatch.targetElement);
        }
    });

    return { onClick };
})();
