document.addEventListener('DOMContentLoaded', () => {
    const hamburger = document.getElementById('hamburger-btn');
    const dropdown = document.getElementById('nav-dropdown');

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
});