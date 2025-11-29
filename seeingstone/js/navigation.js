/**
 * Navigation.js - Shared navigation logic for all pages
 * Handles hamburger menu toggle and outside click detection
 */

document.addEventListener('DOMContentLoaded', () => {
    const hamburger = document.getElementById('hamburger-btn');
    const dropdown = document.getElementById('nav-dropdown');

    if (!hamburger || !dropdown) {
        console.warn('Navigation elements not found');
        return;
    }

    // Toggle Menu
    hamburger.addEventListener('click', (e) => {
        e.stopPropagation();
        hamburger.classList.toggle('active');
        dropdown.classList.toggle('active');
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && !hamburger.contains(e.target)) {
            hamburger.classList.remove('active');
            dropdown.classList.remove('active');
        }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hamburger.classList.remove('active');
            dropdown.classList.remove('active');
        }
    });

    // Mark current page as active in navigation
    const currentPath = window.location.pathname;
    const navLinks = dropdown.querySelectorAll('a');
    
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        // Check if link matches current page
        if (currentPath.endsWith(href) || 
            (currentPath.endsWith('/') && href.includes('index.html')) ||
            (currentPath.includes('/features/') && href.includes('/features/')) ||
            (currentPath.includes('/security/') && href.includes('/security/'))) {
            link.classList.add('active');
        }
    });
});
