(() => {
    const RECOVERY_DELAYS_MS = [1200, 2500, 5000, 10000, 20000];

    const state = {
        session: null,
        personas: [],
        selectedPrivatePersonaId: null,
        queuedAdvisorComments: [],
        betweenMeetingsRunning: false,
        paused: true,
        autoRunning: false,
        inFlight: false,
        injectingAdvisor: false,
        recoveryTimer: null,
        recoveryAttempts: 0
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
        chatLog: document.getElementById('chatLog'),
        commentForm: document.getElementById('commentForm'),
        commentInput: document.getElementById('commentInput'),
        manifestList: document.getElementById('manifestList'),
        privateTabs: document.getElementById('privateTabs'),
        betweenStatus: document.getElementById('betweenStatus'),
        betweenProgress: document.getElementById('betweenProgress'),
        betweenProgressLabel: document.getElementById('betweenProgressLabel'),
        betweenProgressCount: document.getElementById('betweenProgressCount'),
        betweenProgressBar: document.getElementById('betweenProgressBar'),
        privateScene: document.getElementById('privateScene')
    };

    document.addEventListener('DOMContentLoaded', init);
    init();

    function init() {
        if (init.done) return;
        init.done = true;

        els.sessionForm.addEventListener('submit', createSession);
        els.pdfInput.addEventListener('change', updateFileLabel);
        els.commentForm.addEventListener('submit', insertComment);
        els.commentInput.addEventListener('keydown', handleAdvisorKeydown);

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
        if (!problem || state.inFlight || isPipelineActive()) return;

        setBusy(true, 'Creating personas');

        try {
            let pdfContext = null;
            const pdfFile = els.pdfInput.files[0];
            if (pdfFile) {
                setStatus('Extracting PDF');
                const fileBase64 = await readFileAsDataUrl(pdfFile);
                const extracted = await apiPost('/api/thinktank/extract-pdf', { fileBase64, filename: pdfFile.name });
                pdfContext = extracted.text || null;
            }

            const data = await apiPost('/api/thinktank/create-session', {
                problem,
                pdfContext,
                maxSessions: Number(els.maxMeetingsInput.value || 3)
            });

            state.session = {
                sessionId: data.sessionId,
                originalProblem: problem,
                goalBrief: data.goalBrief || null,
                maxSessions: data.maxSessions,
                status: data.status,
                currentScene: data.currentScene,
                manifests: []
            };
            state.personas = data.personas || [];
            state.selectedPrivatePersonaId = state.personas[0]?.personaId || null;
            state.paused = false;
            state.autoRunning = true;
            markPipelineProgress();

            localStorage.setItem('thinktankSessionId', data.sessionId);
            updateSessionUrl(data.sessionId);
            renderAll();
            setStatus('Simulation started');
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
        let shouldResume = false;
        let shouldContinueBetweenMeetings = false;
        try {
            const data = await apiPost('/api/thinktank/get-session', { sessionId });
            state.session = data.session;
            state.personas = data.personas || [];
            state.selectedPrivatePersonaId = state.personas[0]?.personaId || null;
            shouldResume = state.session.status === 'discussing';
            shouldContinueBetweenMeetings = isBetweenMeetingsContinuationAvailable();
            state.paused = !shouldResume;
            state.autoRunning = shouldResume;
            markPipelineProgress();
            els.problemInput.value = state.session.originalProblem || '';
            localStorage.setItem('thinktankSessionId', state.session.sessionId);
            updateSessionUrl(state.session.sessionId);
            renderAll();
            setStatus(shouldResume || shouldContinueBetweenMeetings ? 'Session loaded, continuing' : 'Session loaded');
        } catch (error) {
            console.error(error);
            localStorage.removeItem('thinktankSessionId');
            renderAll();
            setStatus('No stored session');
        } finally {
            setBusy(false);
        }
        if (shouldResume) {
            await continuePipeline();
        } else if (shouldContinueBetweenMeetings) {
            await continuePipeline();
        }
    }

    async function runTurn() {
        if (!state.session || state.inFlight) return;
        if (state.session.status !== 'discussing') {
            await continuePipeline();
            return;
        }
        if (state.paused) {
            state.paused = false;
            state.autoRunning = true;
        }
        state.inFlight = true;
        updateControls();

        try {
            setStatus('Choosing speaker');
            const decision = await apiPost('/api/thinktank/orchestrate-turn', {
                sessionId: state.session.sessionId
            });
            markPipelineProgress();

            if (decision.endScene) {
                state.inFlight = false;
                updateControls();
                const injected = await flushAdvisorQueueIfSafe();
                if (injected) {
                    await continuePipeline();
                    return;
                }
                if (state.queuedAdvisorComments.length) {
                    schedulePipelineRecovery('Anonymous Advisor insertion');
                    return;
                }
                await finishScene();
                return;
            }

            const persona = findPersona(decision.nextSpeaker);
            const pendingEl = appendMessage({
                speaker: decision.nextSpeaker,
                speakerName: persona?.name || 'Persona',
                content: ''
            }, true);

            setStatus(persona ? `${persona.name} is speaking` : 'Generating message');
            const message = await apiPost('/api/thinktank/generate-message', {
                sessionId: state.session.sessionId,
                nextSpeaker: decision.nextSpeaker,
                respondingTo: decision.respondingTo,
                regieHinweis: decision.regieHinweis,
                isFinalTurn: decision.isFinalTurn
            });
            markPipelineProgress();

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
            if (injected) {
                await continuePipeline();
                return;
            }
            if (state.queuedAdvisorComments.length) {
                schedulePipelineRecovery('Anonymous Advisor insertion');
                return;
            }

            if (message.roundNumber >= message.maxRounds) {
                await finishScene();
                return;
            }

            if (state.paused || !state.autoRunning) {
                state.paused = false;
                state.autoRunning = true;
                updateControls();
            }

            setStatus('Listening');

            if (state.autoRunning && !state.paused) {
                await runTurn();
            }
        } catch (error) {
            console.error(error);
            schedulePipelineRecovery('Turn flow', error);
        } finally {
            state.inFlight = false;
            updateControls();
        }
    }

    async function finishScene() {
        if (!state.session) return;
        state.autoRunning = false;
        state.paused = true;
        state.inFlight = true;
        updateControls();

        try {
            setStatus('Writing manifest');
            const data = await apiPost('/api/thinktank/end-scene', {
                sessionId: state.session.sessionId
            });
            markPipelineProgress();

            state.session.status = data.status;
            state.session.manifests = state.session.manifests || [];
            state.session.manifests.push(data.manifest);
            renderAll();
            setStatus(data.archive?.ok ? 'Manifest archived' : 'Manifest ready');
            await runBetweenMeetingsIfNeeded();
        } catch (error) {
            console.error(error);
            schedulePipelineRecovery('Manifest flow', error);
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

        const injected = await flushAdvisorQueueIfSafe();
        if (injected) {
            await continuePipeline();
        } else if (state.queuedAdvisorComments.length) {
            schedulePipelineRecovery('Anonymous Advisor insertion');
        }
    }

    async function startNextSession() {
        if (!state.session || state.inFlight) return;

        state.inFlight = true;
        updateControls();
        setStatus('Starting next session');
        try {
            const data = await apiPost('/api/thinktank/start-next-session', {
                sessionId: state.session.sessionId
            });
            markPipelineProgress();

            state.session.sessionNumber = data.sessionNumber;
            state.session.maxSessions = data.maxSessions || state.session.maxSessions || 3;
            state.session.status = data.status;
            state.session.currentScene = data.currentScene;
            state.session.manifests = data.manifests || state.session.manifests || [];
            state.paused = false;
            state.autoRunning = true;
            renderAll();
            setStatus('Next session ready');
            state.inFlight = false;
            updateControls();
            await runTurn();
        } catch (error) {
            console.error(error);
            schedulePipelineRecovery('Next meeting flow', error);
        } finally {
            state.inFlight = false;
            updateControls();
        }
    }

    function isBetweenMeetingsContinuationAvailable() {
        return state.session
            && (state.session.status === 'scene_ended' || state.session.status === 'private_scene')
            && Number(state.session.sessionNumber || 1) < Number(state.session.maxSessions || 1);
    }

    function isPipelineActive() {
        return state.session
            && state.session.status !== 'done'
            && (state.autoRunning || state.betweenMeetingsRunning || state.inFlight || state.recoveryTimer);
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
    }

    function renderPrivatePanel() {
        els.privateTabs.innerHTML = '';
        if (!state.personas.length) {
            els.privateScene.innerHTML = '<p class="empty-state">No personas yet.</p>';
            updateBetweenProgress(false);
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

        if (!state.betweenMeetingsRunning) {
            updateBetweenProgress(false);
        }

        if (!selected) {
            els.privateScene.innerHTML = '<p class="empty-state">No persona selected.</p>';
            return;
        }

        if (!latestEntry) {
            const message = state.betweenMeetingsRunning
                ? `Preparing ${escapeHtml(selected.name)}. The next public meeting will start automatically.`
                : (canGenerate ? 'Waiting for the next internal scene.' : 'Available after the meeting ends.');
            els.privateScene.innerHTML = `<p class="empty-state">${message}</p>`;
            return;
        }

        els.privateScene.innerHTML = `
            <h2>${escapeHtml(selected.name)}</h2>
            <p class="state-note">${escapeHtml(selected.currentEmotionalState || '')}</p>
            <pre>${escapeHtml(latestEntry.scene || '')}</pre>
        `;
    }

    function updateBetweenProgress(active, current = 0, total = 0, label = 'Preparing next meeting') {
        if (!els.betweenProgress) return;
        els.betweenProgress.hidden = !active;
        if (!active) return;

        const safeTotal = Math.max(0, Number(total) || 0);
        const safeCurrent = Math.max(0, Math.min(safeTotal, Number(current) || 0));
        const percent = safeTotal ? Math.round((safeCurrent / safeTotal) * 100) : 0;
        els.betweenProgressLabel.textContent = label;
        els.betweenProgressCount.textContent = `${safeCurrent} / ${safeTotal}`;
        els.betweenProgressBar.style.width = `${percent}%`;
    }

    function updateControls() {
        const hasSession = Boolean(state.session);
        const ended = state.session && (state.session.status === 'scene_ended' || state.session.status === 'private_scene' || state.session.status === 'done');
        els.createSessionBtn.disabled = state.inFlight || isPipelineActive();
        els.commentForm.hidden = false;
        els.commentInput.disabled = !hasSession || ended;
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
                const data = await apiPost('/api/thinktank/insert-comment', {
                    sessionId: state.session.sessionId,
                    comment
                });
                state.queuedAdvisorComments.shift();
                state.session.currentScene.transcript.push(data.entry);
                appendMessage(data.entry, false);
            }

            markPipelineProgress();
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

    async function continuePipeline() {
        if (!state.session || state.inFlight || state.injectingAdvisor || state.recoveryTimer) return;

        if (state.queuedAdvisorComments.length) {
            const injected = await flushAdvisorQueueIfSafe();
            if (!injected) {
                schedulePipelineRecovery('Anonymous Advisor insertion');
                return;
            }
        }

        if (state.session.status === 'discussing') {
            state.paused = false;
            state.autoRunning = true;
            updateControls();
            await runTurn();
            return;
        }

        if (state.session.status === 'scene_ended' || state.session.status === 'private_scene') {
            await runBetweenMeetingsIfNeeded();
            return;
        }

        if (state.session.status === 'done') {
            markPipelineProgress();
            state.paused = true;
            state.autoRunning = false;
            switchInsightPanel('manifestPanel');
            setStatus('Simulation complete');
            updateControls();
        }
    }

    async function refreshSessionSnapshot() {
        if (!state.session?.sessionId) return;
        const data = await apiPost('/api/thinktank/get-session', {
            sessionId: state.session.sessionId
        });
        state.session = data.session;
        state.personas = data.personas || [];
        state.selectedPrivatePersonaId = state.personas
            .some((persona) => persona.personaId === state.selectedPrivatePersonaId)
            ? state.selectedPrivatePersonaId
            : state.personas[0]?.personaId || null;
        renderAll();
    }

    function schedulePipelineRecovery(label, error) {
        if (!state.session || state.recoveryTimer) return;
        if (error) console.error(`${label} interrupted:`, error);

        const delay = RECOVERY_DELAYS_MS[Math.min(state.recoveryAttempts, RECOVERY_DELAYS_MS.length - 1)];
        state.recoveryAttempts += 1;
        state.inFlight = false;
        state.injectingAdvisor = false;
        state.paused = false;
        state.autoRunning = true;
        setStatus(`${label} interrupted; retrying automatically`);
        updateControls();

        state.recoveryTimer = window.setTimeout(async () => {
            state.recoveryTimer = null;
            try {
                await refreshSessionSnapshot();
                await continuePipeline();
            } catch (recoveryError) {
                schedulePipelineRecovery(label, recoveryError);
            }
        }, delay);
    }

    function markPipelineProgress() {
        if (state.recoveryTimer) {
            window.clearTimeout(state.recoveryTimer);
            state.recoveryTimer = null;
        }
        state.recoveryAttempts = 0;
    }

    async function runBetweenMeetingsIfNeeded() {
        if (!state.session || state.betweenMeetingsRunning) return;
        if (state.session.status === 'done') {
            markPipelineProgress();
            switchInsightPanel('manifestPanel');
            setStatus('Simulation complete');
            return;
        }

        const canContinue = Number(state.session.sessionNumber || 1) < Number(state.session.maxSessions || 1);
        if (!canContinue) {
            markPipelineProgress();
            state.session.status = 'done';
            state.paused = true;
            state.autoRunning = false;
            switchInsightPanel('manifestPanel');
            renderMeta();
            setStatus('Simulation complete');
            return;
        }

        state.betweenMeetingsRunning = true;
        state.inFlight = true;
        state.paused = true;
        state.autoRunning = false;
        switchInsightPanel('privatePanel');
        const pendingPersonas = state.personas.filter((persona) => !latestPrivateEntry(persona));
        const totalPrivateScenes = pendingPersonas.length;
        let completedPrivateScenes = state.personas.length - totalPrivateScenes;
        updateBetweenProgress(true, completedPrivateScenes, state.personas.length, 'Preparing next meeting');
        updateControls();

        try {
            for (const persona of state.personas) {
                if (latestPrivateEntry(persona)) continue;
                state.selectedPrivatePersonaId = persona.personaId;
                renderPrivatePanel();
                updateBetweenProgress(true, completedPrivateScenes, state.personas.length, `Processing ${persona.name}`);
                setStatus(`Between meetings: ${persona.name}`);
                if (els.betweenStatus) {
                    els.betweenStatus.textContent = `Preparing ${persona.name}'s compact state update. This can take a moment; the next meeting will start automatically.`;
                }

                const data = await apiPost('/api/thinktank/generate-between-meeting-scene', {
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
                completedPrivateScenes += 1;
                updateBetweenProgress(true, completedPrivateScenes, state.personas.length, `${persona.name} ready`);
            }

            setStatus('Between meetings complete');
            if (els.betweenStatus) {
                els.betweenStatus.textContent = 'Between-meeting scenes complete. Starting the next meeting...';
            }
            updateBetweenProgress(true, state.personas.length, state.personas.length, 'Starting next meeting');
        } catch (error) {
            console.error(error);
            setStatus('Between-meeting scene failed; continuing');
            updateBetweenProgress(true, completedPrivateScenes, state.personas.length, 'Continuing after private-scene delay');
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
        let data = {};
        if (text) {
            try {
                data = JSON.parse(text);
            } catch {
                data = { error: text.slice(0, 300) };
            }
        }
        if (!response.ok) {
            const stage = data.details?.stage ? ` (${data.details.stage})` : '';
            const reason = data.details?.reason ? `: ${data.details.reason}` : '';
            throw new Error(`${data.error || `Request failed: ${response.status}`}${stage}${reason}`);
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
