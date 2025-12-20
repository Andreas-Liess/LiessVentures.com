/* =============================================
   SECURITY PAGE - FLIP CARD INTERACTIONS
   ============================================= */

/**
 * Flips a card by toggling the 'is-flipped' class
 * @param {HTMLElement} card - The zen-card element to flip
 */
function flipCard(card) {
    card.classList.toggle('is-flipped');
}

/**
 * Initialize all flip cards with click and keyboard interactions
 */
function initializeFlipCards() {
    // Get all flip cards (exclude CTA card which doesn't flip)
    const flipCards = document.querySelectorAll('.zen-card:not(.cta-card)');
    
    flipCards.forEach(card => {
        // Click event
        card.addEventListener('click', function(e) {
            // Prevent flipping if user clicked on a link
            if (e.target.tagName === 'A') return;
            flipCard(this);
        });
        
        // Keyboard accessibility (Enter or Space key)
        card.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                flipCard(this);
            }
        });
        
        // Optional: Flip back when focus is lost (for better UX)
        card.addEventListener('blur', function() {
            // Only flip back if card is currently flipped
            if (this.classList.contains('is-flipped')) {
                // Small delay to prevent immediate flip when tabbing
                setTimeout(() => {
                    if (!this.matches(':focus-within')) {
                        this.classList.remove('is-flipped');
                    }
                }, 100);
            }
        });
    });
    
    console.log('✅ Zen Security Architecture Loaded');
    console.log(`🎴 Initialized ${flipCards.length} flip cards`);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeFlipCards);
} else {
    initializeFlipCards();
}