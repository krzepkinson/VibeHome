// ==========================================
// SYSTEM DELEGACJI ZDARZEŃ (events.js)
// ==========================================

window.EventDispatcher = (() => {
    const clickHandlers = [];

    // ZMIANA KRYTYCZNA - FIX DLA TELEFONÓW (iOS Safari Bug):
    // Wymuszamy, by mobilne przeglądarki traktowały wszystkie elementy z klasami 'js-'
    // jako interaktywne przyciski, by przekazywały z nich zdarzenie 'click'.
    const style = document.createElement('style');
    style.innerHTML = '[class*="js-"] { cursor: pointer; -webkit-tap-highlight-color: transparent; }';
    document.head.appendChild(style);

    // Dodatkowy fix dla starszych wersji mobilnych (odblokowuje delegację kliknięć)
    document.body.addEventListener('touchstart', () => {}, { passive: true });

    // Rejestracja globalnego nasłuchiwacza
    const onClick = (selector, callback) => {
        clickHandlers.push({ selector, callback });
    };

    // Zaawansowane szukanie najspecyficzniejszego dopasowania
    document.addEventListener('click', (e) => {
        let bestMatch = null;
        let bestDepth = Infinity;

        for (let i = 0; i < clickHandlers.length; i++) {
            const { selector, callback } = clickHandlers[i];
            const targetElement = e.target.closest(selector);

            if (!targetElement) continue;

            // Obliczamy głębokość
            let depth = 0;
            let node = e.target;
            while (node && node !== targetElement) {
                depth++;
                node = node.parentNode; // Użyto parentNode (bezpieczne dla ikon SVG)
            }

            if (depth < bestDepth) {
                bestDepth = depth;
                bestMatch = { callback, targetElement };
            }
        }

        if (bestMatch) {
            bestMatch.callback(e, bestMatch.targetElement);
        }
    });

    return { onClick };
})();
