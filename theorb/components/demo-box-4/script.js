function toggleCard(id) {
    const card = document.getElementById(id);
    document.querySelectorAll('.entity-card').forEach(c => {
        if(c.id !== id) c.classList.remove('expanded');
    });
    card.classList.toggle('expanded');
}

// Enables/Disables the sub-controls based on the checkbox
function toggleRule(checkbox, controlId) {
    const controlDiv = document.getElementById(controlId);
    if (checkbox.checked) {
        controlDiv.classList.remove('disabled');
    } else {
        controlDiv.classList.add('disabled');
    }
}

// Toggles between Safe (Green) and Risky (Orange/Auto)
function toggleMode(switchEl) {
    // AUTHENTICITY CHECK: Prevent Auto Mode if hard-locked
    if(switchEl.classList.contains('hard-lock')) {
        alert("Safety Protocol: Special Events require manual review.");
        return;
    }

    const wrapper = switchEl.closest('.safety-switch');
    const track = wrapper.querySelector('.safety-track');
    const label = wrapper.querySelector('.safety-label');

    // Toggle State
    track.classList.toggle('risky');
    
    if (track.classList.contains('risky')) {
        // Auto Mode (Orange)
        label.innerText = "Auto";
        label.classList.add('risky');
    } else {
        // Self-Review Mode (Green)
        label.innerText = "Self-Review";
        label.classList.remove('risky');
    }
}