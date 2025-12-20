// ═══════════════════════════════════════════════════════════
// REVEAL ANIMATIONS - Intersection Observer
// ═══════════════════════════════════════════════════════════

const observerOptions = {
    root: null,
    rootMargin: '0px 0px -80px 0px',
    threshold: 0.1
};

const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
        }
    });
}, observerOptions);

// Observe all elements with data-reveal attribute
document.querySelectorAll('[data-reveal]').forEach(el => {
    revealObserver.observe(el);
});

// ═══════════════════════════════════════════════════════════
// READING PROGRESS BAR
// ═══════════════════════════════════════════════════════════

function updateProgressBar() {
    const progressBar = document.getElementById('progressBar');
    if (!progressBar) return;
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = (scrollTop / docHeight) * 100;
    progressBar.style.width = scrollPercent + '%';
}

// ═══════════════════════════════════════════════════════════
// SCROLL TO TOP INDICATOR
// ═══════════════════════════════════════════════════════════

function updateScrollIndicator() {
    const scrollIndicator = document.getElementById('scrollIndicator');
    if (!scrollIndicator) return;
    if (window.scrollY > 300) {
        scrollIndicator.classList.add('visible');
    } else {
        scrollIndicator.classList.remove('visible');
    }
}

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.scrollToTop = scrollToTop;

// ═══════════════════════════════════════════════════════════
// CURSOR GLOW EFFECT
// ═══════════════════════════════════════════════════════════

const cursorGlow = document.getElementById('cursorGlow');
let mouseX = 0, mouseY = 0;
let glowX = 0, glowY = 0;

if (cursorGlow) {
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        cursorGlow.classList.add('active');
    });

    document.addEventListener('mouseleave', () => {
        cursorGlow.classList.remove('active');
    });

    // Smooth cursor glow follow
    function animateCursorGlow() {
        const ease = 0.08;
        glowX += (mouseX - glowX) * ease;
        glowY += (mouseY - glowY) * ease;
        cursorGlow.style.left = glowX + 'px';
        cursorGlow.style.top = glowY + 'px';
        requestAnimationFrame(animateCursorGlow);
    }
    animateCursorGlow();
}

// ═══════════════════════════════════════════════════════════
// THROTTLED SCROLL HANDLER
// ═══════════════════════════════════════════════════════════

function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

const handleScroll = throttle(() => {
    updateProgressBar();
    updateScrollIndicator();
}, 16);

window.addEventListener('scroll', handleScroll);

// ═══════════════════════════════════════════════════════════
// INITIAL LOAD - Reveal elements already in viewport
// ═══════════════════════════════════════════════════════════

window.addEventListener('load', () => {
    document.querySelectorAll('[data-reveal]').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight) {
            setTimeout(() => {
                el.classList.add('revealed');
            }, 100);
        }
    });
});

// ═══════════════════════════════════════════════════════════
// DISABLE CURSOR GLOW ON TOUCH DEVICES
// ═══════════════════════════════════════════════════════════

if (cursorGlow && 'ontouchstart' in window) {
    cursorGlow.style.display = 'none';
}

// ═══════════════════════════════════════════════════════════
// LANGUAGE OVERLAY SYSTEM (Epic)
// ═══════════════════════════════════════════════════════════

function initLanguageSystem() {
    // 1. Inject Overlay HTML
    if (!document.getElementById('langOverlay')) {
        const overlayHTML = `
            <div class="lang-overlay" id="langOverlay">
                <button class="lang-close" id="langClose" aria-label="Close">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                        <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                </button>
                <div class="lang-content">
                    <button class="lang-option active" data-lang="en">English <span>International</span></button>
                    <button class="lang-option" data-lang="de">Deutsch <span>Germany</span></button>
                    <button class="lang-option" data-lang="fr">Français <span>France</span></button>
                    <button class="lang-option" data-lang="es">Español <span>Spain</span></button>
                    <button class="lang-option" data-lang="ko">Korean <span>South Korea</span></button>
                    <button class="lang-option" data-lang="zh">Chinese <span>China</span></button>
                    <button class="lang-option" data-lang="ar">Arabic <span>UAE</span></button>
                    <button class="lang-option" data-lang="hi">Hindi <span>India</span></button>
                    <button class="lang-option" data-lang="uk">Ukranian <span>Ukraine</span></button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', overlayHTML);
    }

    // 2. Find and Upgrade Existing Selectors (or Attach to Triggers)
    const existingSelectors = document.querySelectorAll('.lang-selector');
    const existingTriggers = document.querySelectorAll('.lang-trigger');
    const overlay = document.getElementById('langOverlay');
    const closeBtn = document.getElementById('langClose');
    const options = document.querySelectorAll('.lang-option');

    // Helper to open overlay
    function openOverlay() {
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent scrolling
    }

    // Helper to close overlay
    function closeOverlay() {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    // Upgrade old <select> elements to new Buttons
    existingSelectors.forEach(select => {
        const parent = select.parentElement;
        const currentLang = localStorage.getItem('preferred-language') || 'en';
        
        const newBtn = document.createElement('button');
        newBtn.className = 'lang-trigger';
        newBtn.textContent = '[ ' + currentLang.toUpperCase() + ' ]';
        newBtn.onclick = openOverlay;
        
        parent.replaceChild(newBtn, select);
    });

    // Attach listeners to hardcoded triggers (if any)
    existingTriggers.forEach(btn => {
        btn.onclick = openOverlay;
    });

    // Close Button Logic
    if (closeBtn) {
        closeBtn.onclick = closeOverlay;
    }

    // Close on Escape Key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeOverlay();
    });

    // Language Selection Logic
    options.forEach(opt => {
        opt.addEventListener('click', function() {
            const lang = this.getAttribute('data-lang');
            
            // 1. Save Preference
            localStorage.setItem('preferred-language', lang);
            
            // 2. Load Translations
            loadTranslations(lang);

            // 3. Update all triggers on page
            document.querySelectorAll('.lang-trigger').forEach(btn => {
                btn.textContent = '[ ' + lang.toUpperCase() + ' ]';
            });

            // 4. Visual Feedback in Overlay
            options.forEach(o => o.classList.remove('active'));
            this.classList.add('active');

            // 5. Close Overlay
            setTimeout(closeOverlay, 300);
        });
    });

    // Initialize Active State & Load Content
    const savedLang = localStorage.getItem('preferred-language') || 'en';
    
    // Set active class in overlay
    options.forEach(o => {
        if (o.getAttribute('data-lang') === savedLang) {
            o.classList.add('active');
        } else {
            o.classList.remove('active');
        }
    });
    
    // Update triggers
    document.querySelectorAll('.lang-trigger').forEach(btn => {
        btn.textContent = '[ ' + savedLang.toUpperCase() + ' ]';
    });

    // Initial Load
    loadTranslations(savedLang);
}

// ═══════════════════════════════════════════════════════════
// I18N CONTENT LOADER
// ═══════════════════════════════════════════════════════════

const i18nCache = {};

function loadTranslations(lang) {
    // Access global data object defined in translations.js
    const allTranslations = window.I18N_DATA;

    if (!allTranslations || !allTranslations[lang]) {
        console.warn(`Translation data for '${lang}' not found. Falling back to English.`);
        if (lang !== 'en' && allTranslations && allTranslations['en']) {
            loadTranslations('en');
        }
        return;
    }

    const translations = allTranslations[lang];
    applyTranslations(translations);
    
    // Update html lang attribute
    document.documentElement.lang = lang;
}

function applyTranslations(translations) {
    const elements = document.querySelectorAll('[data-i18n]');
    
    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        const value = getNestedValue(translations, key);
        
        if (value) {
            // Check if element has fade animation class
            if (el.classList.contains('reveal') || el.classList.contains('reveal-fade')) {
                // Smooth transition for text change
                el.style.opacity = '0';
                setTimeout(() => {
                    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                        el.placeholder = value;
                    } else {
                        el.innerHTML = value; // innerHTML allows <em> or <br> in JSON
                    }
                    el.style.opacity = '1';
                }, 300);
            } else {
                // Instant update
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                    el.placeholder = value;
                } else {
                    el.innerHTML = value;
                }
            }
        }
    });
}

function getNestedValue(obj, key) {
    return key.split('.').reduce((prev, curr) => {
        return prev ? prev[curr] : null;
    }, obj);
}

// Initialize on Load
document.addEventListener('DOMContentLoaded', initLanguageSystem);
// Fallback if already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initLanguageSystem();
}

// ═══════════════════════════════════════════════════════════
// MOBILE NAVIGATION TOGGLE
// ═══════════════════════════════════════════════════════════

const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
        navToggle.classList.toggle('active');
        navLinks.classList.toggle('active');
    });
}

