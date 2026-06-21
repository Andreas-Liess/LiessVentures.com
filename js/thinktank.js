(() => {
    const state = {
        session: null,
        personas: [],
        selectedPrivatePersonaId: null,
        queuedAdvisorComments: [],
        betweenMeetingsRunning: false,
        paused: true,
        autoRunning: false,
        inFlight: false,
        injectingAdvisor: false
    };

    const els = {
        sessionForm: document.getElementById('sessionForm'),
        problemInput: document.getElementById('problemInput'),
        pdfInput: document.getElementById('pdfInput'),
        fileLabel: document.getElementById('fileLabel'),
        maxMeetingsInput: document.getElementById('maxMeetingsInput'),
        createSessionBtn: document.getElementById('createSessionBtn'),
        statusLine: document.getElementById('statusLine'),
        personaList: document.getElementById('personaList'),
        sceneStatus: document.getElementById('sceneStatus'),
        roundStatus: document.getElementById('roundStatus'),
        startBtn: document.getElementById('startBtn'),
        skipBtn: document.getElementById('skipBtn'),
        chatLog: document.getElementById('chatLog'),
        commentForm: document.getElementById('commentForm'),
        commentInput: document.getElementById('commentInput'),
        manifestList: document.getElementById('manifestList'),
        nextSessionBtn: document.getElementById('nextSessionBtn'),
        privateTabs: document.getElementById('privateTabs'),
        betweenStatus: document.getElementById('betweenStatus'),
        privateScene: document.getElementById('privateScene')
    };

    document.addEventListener('DOMContentLoaded', init);
    init();

    function init() {
        if (init.done) return;
        init.done = true;

        els.sessionForm.addEventListener('submit', createSession);
        els.pdfInput.addEventListener('change', updateFileLabel);
        els.startBtn.addEventListener('click', startAutoRun);
        els.skipBtn.addEventListener('click', () => finishScene(true));
        els.commentForm.addEventListener('submit', insertComment);
        els.commentInput.addEventListener('keydown', handleAdvisorKeydown);
        els.nextSessionBtn.addEventListener('click', startNextSession);

        document.querySelectorAll('.insight-tabs button').forEach((button) => {
            button.addEventListener('click', () => switchInsightPanel(button.dataset.panel));
        });

        const urlSession = new URLSearchParams(window.location.search).get('session');
        const savedSession = localStorage.getItem('thinktankSessionId');
        if (urlSession || savedSession) {
            loadSession(urlSession || savedSession);
        } else {
            renderAll();
        }
    }

    async function createSession(event) {
        event.preventDefault();
        const problem = els.problemInput.value.trim();
        if (!problem || state.inFlight) return;

        setBusy(true, 'Creating personas');

        try {
            let pdfContext = null;
            const pdfFile = els.pdfInput.files[0];
            if (pdfFile) {
                setStatus('Extracting PDF');
                const fileBase64 = await readFileAsDataUrl(pdfFile);
                const extracted = await apiPost('/api/extract-pdf', { fileBase64, filename: pdfFile.name });
                pdfContext = extracted.text || null;
            }

            const data = await apiPost('/api/create-session', {
                problem,
                pdfContext,
                maxSessions: Number(els.maxMeetingsInput.value || 3)
            });

            state.session = {
                sessionId: data.sessionId,
                originalProblem: problem,
                maxSessions: data.maxSessions,
                status: data.status,
                currentScene: data.currentScene,
                manifests: []
            };
            state.personas = data.personas || [];
            state.selectedPrivatePersonaId = state.personas[0]?.personaId || null;
            state.paused = false;
            state.autoRunning = true;

            localStorage.setItem('thinktankSessionId', data.sessionId);
            updateSessionUrl(data.sessionId);
            renderAll();
            setStatus('Simulation started');
            await sleep(1000);
            state.inFlight = false;
            updateControls();
            await runTurn();
        } catch (error) {
            console.error(error);
            setStatus(error.message || 'Session creation failed');
        } finally {
            setBusy(false);
        }
    }

    async function loadSession(sessionId) {
        setBusy(true, 'Loading session');
        try {
            const data = await apiPost('/api/get-session', { sessionId });
            state.session = data.session;
            state.personas = data.personas || [];
            state.selectedPrivatePersonaId = state.personas[0]?.personaId || null;
            state.paused = true;
            state.autoRunning = false;
            els.problemInput.value = state.session.originalProblem || '';
            localStorage.setItem('thinktankSessionId', state.session.sessionId);
            updateSessionUrl(state.session.sessionId);
            renderAll();
            setStatus('Session loaded');
        } catch (error) {
            console.error(error);
            localStorage.removeItem('thinktankSessionId');
            renderAll();
            setStatus('No stored session');
        } finally {
            setBusy(false);
        }
    }

    async function startAutoRun() {
        if (!state.session || state.inFlight) return;
        if (state.session.status === 'scene_ended' || state.session.status === 'done') return;
        state.paused = false;
        state.autoRunning = true;
        const injected = await flushAdvisorQueueIfSafe();
        if (state.queuedAdvisorComments.length) {
            state.paused = true;
            state.autoRunning = false;
            updateControls();
            return;
        }
        if (injected) {
            await sleep(1000);
        }
        await runTurn();
    }

    async function runTurn() {
        if (!state.session || state.inFlight || state.paused) return;
        state.inFlight = true;
        updateControls();

        try {
            setStatus('Choosing speaker');
            const decision = await apiPost('/api/orchestrate-turn', {
                sessionId: state.session.sessionId
            });

            if (decision.endScene) {
                state.inFlight = false;
                updateControls();
                const injected = await flushAdvisorQueueIfSafe();
                if (injected) return;
                if (state.queuedAdvisorComments.length) return;
                await finishScene(false);
                return;
            }

            const persona = findPersona(decision.nextSpeaker);
            const pendingEl = appendMessage({
                speaker: decision.nextSpeaker,
                speakerName: persona?.name || 'Persona',
                content: ''
            }, true);

            setStatus(persona ? `${persona.name} is speaking` : 'Generating message');
            const message = await apiPost('/api/generate-message', {
                sessionId: state.session.sessionId,
                nextSpeaker: decision.nextSpeaker,
                respondingTo: decision.respondingTo,
                regieHinweis: decision.regieHinweis,
                isFinalTurn: decision.isFinalTurn
            });

            fillPendingMessage(pendingEl, message.content);
            state.session.currentScene.transcript.push({
                speaker: message.speaker,
                speakerName: message.speakerName,
                content: message.content,
                timestamp: new Date().toISOString()
            });
            state.session.currentScene.roundNumber = message.roundNumber;
            state.session.currentScene.maxRounds = message.maxRounds;
            renderMeta();

            state.inFlight = false;
            updateControls();

            const injected = await flushAdvisorQueueIfSafe();
            if (injected) return;
            if (state.queuedAdvisorComments.length) return;

            await sleep(1000);

            const delayedInjection = await flushAdvisorQueueIfSafe();
            if (delayedInjection) return;
            if (state.queuedAdvisorComments.length) return;

            if (message.roundNumber >= message.maxRounds) {
                if (!state.paused) {
                    await finishScene(false);
                } else {
                    setStatus('Paused at message limit');
                }
                return;
            }

            if (state.paused || !state.autoRunning) {
                setStatus('Paused');
                return;
            }

            setStatus('Listening');

            if (state.autoRunning && !state.paused) {
                runTurn();
            }
        } catch (error) {
            console.error(error);
            state.autoRunning = false;
            state.paused = true;
            setStatus(error.message || 'Turn failed');
        } finally {
            state.inFlight = false;
            updateControls();
        }
    }

    async function finishScene(fromSkip) {
        if (!state.session || state.inFlight && fromSkip) return;
        state.autoRunning = false;
        state.paused = true;
        state.inFlight = true;
        updateControls();

        try {
            setStatus(fromSkip ? 'Skipping to manifest' : 'Writing manifest');
            const data = await apiPost('/api/end-scene', {
                sessionId: state.session.sessionId,
                skipped: Boolean(fromSkip)
            });

            state.session.status = data.status;
            state.session.manifests = state.session.manifests || [];
            state.session.manifests.push(data.manifest);
            renderAll();
            setStatus(data.archive?.ok ? 'Manifest archived' : 'Manifest ready');
            await runBetweenMeetingsIfNeeded();
        } catch (error) {
            console.error(error);
            setStatus(error.message || 'Scene ending failed');
        } finally {
            state.inFlight = false;
            updateControls();
        }
    }

    async function insertComment(event) {
        event.preventDefault();
        const comment = els.commentInput.value.trim();
        if (!comment) return;

        if (!state.session) {
            setStatus('Create a session before adding an Anonymous Advisor message');
            return;
        }

        const ended = state.session.status === 'scene_ended'
            || state.session.status === 'private_scene'
            || state.session.status === 'done';
        if (ended) {
            setStatus('This meeting is not accepting new Anonymous Advisor messages');
            return;
        }

        state.paused = true;
        state.autoRunning = false;
        state.queuedAdvisorComments.push(comment);
        els.commentInput.value = '';
        updateControls();

        if (state.inFlight) {
            setStatus('Anonymous Advisor message queued');
            return;
        }

        await flushAdvisorQueueIfSafe();
    }

    async function startNextSession() {
        if (!state.session || state.inFlight) return;

        state.inFlight = true;
        updateControls();
        setStatus('Starting next session');
        try {
            const data = await apiPost('/api/start-next-session', {
                sessionId: state.session.sessionId
            });

            state.session.sessionNumber = data.sessionNumber;
            state.session.maxSessions = data.maxSessions || state.session.maxSessions || 3;
            state.session.status = data.status;
            state.session.currentScene = data.currentScene;
            state.session.manifests = data.manifests || state.session.manifests || [];
            state.paused = false;
            state.autoRunning = true;
            renderAll();
            setStatus('Next session ready');
            await sleep(1000);
            state.inFlight = false;
            updateControls();
            await runTurn();
        } catch (error) {
            console.error(error);
            setStatus(error.message || 'Next session failed');
        } finally {
            state.inFlight = false;
            updateControls();
        }
    }

    function renderAll() {
        renderMeta();
        renderPersonas();
        renderTranscript();
        renderManifest();
        renderPrivatePanel();
        updateControls();
    }

    function renderMeta() {
        if (!state.session) {
            els.sceneStatus.textContent = 'No Session';
            els.roundStatus.textContent = '0 / 0';
            return;
        }

        const scene = state.session.currentScene || {};
        els.sceneStatus.textContent = `Meeting ${state.session.sessionNumber || 1} / ${state.session.maxSessions || 3} - ${formatStatus(state.session.status)}`;
        els.roundStatus.textContent = `Messages ${scene.roundNumber || 0} / ${scene.maxRounds || 0}`;
    }

    function renderPersonas() {
        els.personaList.innerHTML = '';
        if (!state.personas.length) {
            els.personaList.innerHTML = '<p class="empty-state">No personas yet.</p>';
            return;
        }

        state.personas.forEach((persona) => {
            const item = document.createElement('article');
            item.className = 'persona-item';
            item.innerHTML = `
                <div class="avatar">${initials(persona.name)}</div>
                <div>
                    <h2>${escapeHtml(persona.name)}</h2>
                    <p class="persona-role">${escapeHtml(persona.role)}</p>
                    <p>${escapeHtml(persona.shortBio || '')}</p>
                    <span>${escapeHtml(persona.currentEmotionalState || '')}</span>
                </div>
            `;
            els.personaList.appendChild(item);
        });
    }

    function renderTranscript() {
        els.chatLog.innerHTML = '';
        const transcript = state.session?.currentScene?.transcript || [];
        if (!transcript.length) {
            els.chatLog.innerHTML = '<p class="empty-chat">No messages yet.</p>';
            return;
        }
        transcript.forEach((message) => appendMessage(message, false));
    }

    function appendMessage(message, pending) {
        const empty = els.chatLog.querySelector('.empty-chat');
        if (empty) empty.remove();

        const item = document.createElement('article');
        const advisor = message.speaker === 'anonymous_advisor';
        item.className = `chat-message${pending ? ' pending' : ''}${advisor ? ' advisor' : ''}`;
        item.innerHTML = `
            <div class="avatar">${advisor ? 'AA' : initials(message.speakerName)}</div>
            <div class="message-body">
                <header>${escapeHtml(message.speakerName || 'Persona')}</header>
                <p>${message.content ? escapeHtml(message.content) : '<span class="pending-dot"></span>'}</p>
            </div>
        `;
        els.chatLog.appendChild(item);
        els.chatLog.scrollTop = els.chatLog.scrollHeight;
        return item;
    }

    function fillPendingMessage(item, content) {
        const paragraph = item.querySelector('.message-body p');
        paragraph.textContent = content || '';
        item.classList.remove('pending');
        item.classList.add('filled');
        els.chatLog.scrollTop = els.chatLog.scrollHeight;
    }

    function renderManifest() {
        els.manifestList.innerHTML = '';
        const manifests = state.session?.manifests || [];
        if (!manifests.length) {
            els.manifestList.innerHTML = '<p class="empty-state">No manifest yet.</p>';
        } else {
            manifests.slice().reverse().forEach((manifest) => {
                const article = document.createElement('article');
                article.className = 'manifest-item';
                article.innerHTML = `
                    <span>Session ${escapeHtml(String(manifest.sessionNumber || ''))}</span>
                    <h2>Consensus</h2>
                    <p>${escapeHtml(manifest.consensus || '')}</p>
                    <h2>Open Questions</h2>
                    <p>${escapeHtml(manifest.openQuestions || '')}</p>
                    <pre>${escapeHtml(manifest.fullText || '')}</pre>
                `;
                els.manifestList.appendChild(article);
            });
        }

        const canContinue = state.session
            && (state.session.status === 'scene_ended' || state.session.status === 'private_scene')
            && Number(state.session.sessionNumber || 1) < Number(state.session.maxSessions || 1);
        els.nextSessionBtn.hidden = !canContinue || state.autoRunning || state.betweenMeetingsRunning;
    }

    function renderPrivatePanel() {
        els.privateTabs.innerHTML = '';
        if (!state.personas.length) {
            els.privateScene.innerHTML = '<p class="empty-state">No personas yet.</p>';
            return;
        }

        if (!state.selectedPrivatePersonaId) {
            state.selectedPrivatePersonaId = state.personas[0].personaId;
        }

        state.personas.forEach((persona) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = persona.name;
            button.className = persona.personaId === state.selectedPrivatePersonaId ? 'active' : '';
            button.addEventListener('click', () => {
                state.selectedPrivatePersonaId = persona.personaId;
                renderPrivatePanel();
            });
            els.privateTabs.appendChild(button);
        });

        const selected = findPersona(state.selectedPrivatePersonaId);
        const latestEntry = latestPrivateEntry(selected);
        const canGenerate = state.session && (state.session.status === 'scene_ended' || state.session.status === 'private_scene');
        if (els.betweenStatus) {
            if (!state.session) {
                els.betweenStatus.textContent = 'Internal agent scenes will appear between meetings.';
            } else if (state.betweenMeetingsRunning) {
                els.betweenStatus.textContent = 'Generating internal agent scenes...';
            } else if (state.session.status === 'done') {
                els.betweenStatus.textContent = 'Final meeting complete.';
            } else if (canGenerate) {
                els.betweenStatus.textContent = 'Between-meeting scenes are prepared automatically.';
            } else {
                els.betweenStatus.textContent = 'Internal agent scenes will appear between meetings.';
            }
        }

        if (!selected) {
            els.privateScene.innerHTML = '<p class="empty-state">No persona selected.</p>';
            return;
        }

        if (!latestEntry) {
            els.privateScene.innerHTML = `<p class="empty-state">${canGenerate ? 'Waiting for the next internal scene.' : 'Available after the meeting ends.'}</p>`;
            return;
        }

        els.privateScene.innerHTML = `
            <h2>${escapeHtml(selected.name)}</h2>
            <p class="state-note">${escapeHtml(selected.currentEmotionalState || '')}</p>
            <pre>${escapeHtml(latestEntry.scene || '')}</pre>
        `;
    }

    function updateControls() {
        const hasSession = Boolean(state.session);
        const ended = state.session && (state.session.status === 'scene_ended' || state.session.status === 'private_scene' || state.session.status === 'done');
        els.startBtn.disabled = !hasSession || state.inFlight || ended;
        els.skipBtn.disabled = !hasSession || state.inFlight || ended;
        els.createSessionBtn.disabled = state.inFlight;
        els.commentForm.hidden = false;
        els.commentInput.disabled = !hasSession || ended;
        els.startBtn.querySelector('span').textContent = state.session?.currentScene?.transcript?.length ? 'Continue' : 'Start';
        renderMeta();
        renderPrivatePanel();
    }

    function switchInsightPanel(panelId) {
        document.querySelectorAll('.insight-tabs button').forEach((button) => {
            button.classList.toggle('active', button.dataset.panel === panelId);
        });
        document.querySelectorAll('.insight-panel').forEach((panel) => {
            panel.classList.toggle('active', panel.id === panelId);
        });
    }

    function updateFileLabel() {
        const file = els.pdfInput.files[0];
        els.fileLabel.textContent = file ? file.name : 'PDF';
    }

    function setBusy(isBusy, message) {
        state.inFlight = Boolean(isBusy);
        if (message) setStatus(message);
        updateControls();
    }

    function setStatus(message) {
        els.statusLine.textContent = message;
    }

    function handleAdvisorKeydown(event) {
        if (event.key !== 'Enter' || event.shiftKey) return;
        event.preventDefault();
        if (els.commentForm.requestSubmit) {
            els.commentForm.requestSubmit();
        } else {
            els.commentForm.dispatchEvent(new Event('submit', { cancelable: true }));
        }
    }

    async function flushAdvisorQueueIfSafe() {
        if (!state.session || state.inFlight || state.injectingAdvisor || !state.queuedAdvisorComments.length) {
            return false;
        }

        state.injectingAdvisor = true;
        updateControls();
        setStatus('Inserting Anonymous Advisor message');

        try {
            while (state.queuedAdvisorComments.length) {
                const comment = state.queuedAdvisorComments[0];
                const data = await apiPost('/api/insert-comment', {
                    sessionId: state.session.sessionId,
                    comment
                });
                state.queuedAdvisorComments.shift();
                state.session.currentScene.transcript.push(data.entry);
                appendMessage(data.entry, false);
            }

            setStatus('Anonymous Advisor inserted');
            return true;
        } catch (error) {
            console.error(error);
            setStatus(error.message || 'Anonymous Advisor insertion failed');
            return false;
        } finally {
            state.injectingAdvisor = false;
            updateControls();
        }
    }

    function sleep(ms) {
        return new Promise((resolve) => window.setTimeout(resolve, ms));
    }

    async function runBetweenMeetingsIfNeeded() {
        if (!state.session || state.betweenMeetingsRunning) return;
        if (state.session.status === 'done') {
            switchInsightPanel('manifestPanel');
            setStatus('Simulation complete');
            return;
        }

        const canContinue = Number(state.session.sessionNumber || 1) < Number(state.session.maxSessions || 1);
        if (!canContinue) return;

        state.betweenMeetingsRunning = true;
        state.inFlight = true;
        state.paused = true;
        state.autoRunning = false;
        switchInsightPanel('privatePanel');
        updateControls();

        try {
            for (const persona of state.personas) {
                if (latestPrivateEntry(persona)) continue;
                state.selectedPrivatePersonaId = persona.personaId;
                renderPrivatePanel();
                setStatus(`Between meetings: ${persona.name}`);
                if (els.betweenStatus) {
                    els.betweenStatus.textContent = `Generating ${persona.name}...`;
                }

                const data = await apiPost('/api/generate-private-scene', {
                    sessionId: state.session.sessionId,
                    personaId: persona.personaId
                });

                persona.currentEmotionalState = data.currentEmotionalState;
                persona.privateLifeTranscript = persona.privateLifeTranscript || [];
                persona.privateLifeTranscript.push({
                    sessionNumber: state.session.sessionNumber,
                    scene: data.scene,
                    categories: data.categories,
                    timestamp: new Date().toISOString()
                });
                state.session.status = 'private_scene';
                renderPersonas();
                renderPrivatePanel();
                await sleep(400);
            }

            setStatus('Between meetings complete');
            if (els.betweenStatus) {
                els.betweenStatus.textContent = 'Between-meeting scenes complete. Starting the next meeting...';
            }
            await sleep(1000);
        } catch (error) {
            console.error(error);
            state.paused = true;
            state.autoRunning = false;
            setStatus(error.message || 'Between-meeting scene generation failed');
            return;
        } finally {
            state.betweenMeetingsRunning = false;
            state.inFlight = false;
            updateControls();
        }

        await startNextSession();
    }

    async function apiPost(path, payload) {
        const response = await fetch(path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload || {})
        });
        const text = await response.text();
        const data = text ? JSON.parse(text) : {};
        if (!response.ok) {
            throw new Error(data.error || `Request failed: ${response.status}`);
        }
        return data;
    }

    function readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function updateSessionUrl(sessionId) {
        const url = new URL(window.location.href);
        url.searchParams.set('session', sessionId);
        window.history.replaceState({}, '', url.toString());
    }

    function findPersona(personaId) {
        return state.personas.find((persona) => persona.personaId === personaId);
    }

    function latestPrivateEntry(persona) {
        if (!persona || !state.session) return null;
        const entries = persona.privateLifeTranscript || [];
        const sameSession = entries.filter((entry) => entry.sessionNumber === state.session.sessionNumber);
        return sameSession[sameSession.length - 1] || null;
    }

    function initials(name) {
        return String(name || '?')
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() || '')
            .join('') || '?';
    }

    function formatStatus(status) {
        return String(status || 'idle').replace(/_/g, ' ');
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
})();
