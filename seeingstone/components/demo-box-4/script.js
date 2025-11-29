function toggleCard(headerElement) {
    const card = headerElement.closest('.entity-card');
    card.classList.toggle('expanded');
}

function toggleSwitch(switchEl) {
    event.stopPropagation();
    
    const rowControls = switchEl.closest('.row-controls');
    if (rowControls.parentElement.querySelector('.check-wrapper input').checked === false) return;

    if (switchEl.classList.contains('manual')) {
        switchEl.classList.remove('manual');
        switchEl.classList.add('auto');
        switchEl.querySelector('.state-label').innerText = "Auto";
    } else {
        switchEl.classList.remove('auto');
        switchEl.classList.add('manual');
        switchEl.querySelector('.state-label').innerText = "Review";
    }
}

function toggleRow(checkbox) {
    event.stopPropagation();
    const row = checkbox.closest('.protocol-row');
    const controls = row.querySelector('.row-controls');
    const select = row.querySelector('select');
    const input = row.querySelector('.context-input');
    
    if (checkbox.checked) {
        controls.classList.remove('disabled');
        select.disabled = false;
        input.disabled = false;
        input.style.opacity = "1";
    } else {
        controls.classList.add('disabled');
        select.disabled = true;
        input.disabled = true;
        input.style.opacity = "0.5";
    }
}

document.querySelectorAll('button, input, select').forEach(el => {
    el.addEventListener('click', (e) => e.stopPropagation());
});