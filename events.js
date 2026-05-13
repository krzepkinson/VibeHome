// ==========================================
// CENTRALNY DYSPOZYTOR ZDARZEŃ (events.js)
// ==========================================

window.EventDispatcher = (() => {
    // Tablica przechowująca wszystkie zarejestrowane kliknięcia
    const clickHandlers = [];

    // Funkcja do rejestrowania akcji przez inne moduły
    const onClick = (selector, callback) => {
        clickHandlers.push({ selector, callback });
    };

    // JEDEN główny nasłuchiwacz na całą aplikację
    document.addEventListener('click', (e) => {
        for (let i = 0; i < clickHandlers.length; i++) {
            const { selector, callback } = clickHandlers[i];
            const targetElement = e.target.closest(selector);
            
            if (targetElement) {
                // Jeśli kliknięto w zarejestrowany element, odpalamy jego funkcję 
                // i przekazujemy e (event) oraz targetElement (kliknięty węzeł)
                callback(e, targetElement);
            }
        }
    });

    return { onClick };
})();
