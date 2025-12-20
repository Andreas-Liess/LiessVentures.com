/**
 * Signup.js - Signup page form handling
 * * =============================================
 * CUSTOMIZE YOUR SIGNUP FORM LOGIC HERE
 * * This is now connected to your Vercel Serverless Function at /api/signup
 * =============================================
 */

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('signup-form');
    const formMessage = document.getElementById('form-message');

    if (!form) {
        console.warn('Signup form not found');
        return;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Get form data
        const formData = new FormData(form);
        const data = {
            name: formData.get('name'),
            email: formData.get('email'),
            company: formData.get('company'),
            message: formData.get('message')
        };

        // Show loading state
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Submitting...';
        submitBtn.disabled = true;

        try {
            // =============================================
            // REAL VERCEL SUBMISSION LOGIC STARTS HERE
            // =============================================
            
            const response = await fetch('/api/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (!response.ok) throw new Error('Submission failed');
            
            console.log('Form submitted successfully');
            
            // Show success message
            showMessage('success', 'Thank you! We\'ll be in touch soon.');
            form.reset();
            
        } catch (error) {
            console.error('Form submission error:', error);
            showMessage('error', 'Something went wrong. Please try again or use the Google Form link below.');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });

    function showMessage(type, text) {
        formMessage.textContent = text;
        formMessage.className = `form-message ${type} visible`;
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            formMessage.classList.remove('visible');
        }, 5000);
    }
});