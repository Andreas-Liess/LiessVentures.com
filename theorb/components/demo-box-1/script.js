// Wait for the component's HTML to be loaded
document.addEventListener("DOMContentLoaded", () => {
    
    // --- DOM Elements ---
    const userQueryBox = document.getElementById("user-query-box");
    const logList = document.getElementById("log-list");
    const finalReportBox = document.getElementById("final-report-box");

    // --- Data for the Demo ---
    // This array holds all the steps of the demo
    const script = [
        { 
            type: "user", 
            label: "[User]",
            content: "What do you know about John Doe and how to connect with him about collaborating on Project X?" 
        },
        { 
            type: "thinking", 
            label: "[Agent Thinking]",
            content: "→ Full-spectrum scan initiated: Gmail, Contacts, Calendar, LinkedIn...\n→ Target: John Doe (VP @ NeuraCorp)\n→ Objective: reconstruct identity, proximity graph, optimal warm-intro path" 
        },
        { 
            type: "toolCall", 
            label: "[Tool Call]",
            content: "search_entity(query=\"John Doe\", scope=all)" 
        },
        { 
            type: "toolResult", 
            label: "[Tool Result]",
            content: "→ 13 matches located\n    • 7 emails\n    • 2 Telegram groups\n    • 1 LinkedIn message (sent by user)\n    • 1 calendar invite (declined)"
        },
        { 
            type: "toolResult", 
            label: "[Tool Result]",
            content: "Emails:\n    • 3 CCs from Jane Doe (user → Jane, Jane → John)\n    • 1 forward from Alex Jakarta (user deck → John)\n    • 1 reply from Claude Junker (user intro → “excited to explore synergy”)"
        },
        { 
            type: "thinking", 
            label: "[Agent Thinking]",
            content: "→ User is **not** a stranger to John Doe\n→ **Jane Doe** is the **strongest bridge** (100% reply rate, unread coffee invite)\n→ **Claude Junker** is a **warm secondary** (positive reply)\n→ Drafting human-friendly, context-rich outreach via Jane"
        },
        { 
            type: "toolCall", 
            label: "[Tool Call]",
            content: "analyze_relationship(email_ids=[12,45,78], telegram_group=\"AI Founders EU\")"
        },
        { 
            type: "toolResult", 
            label: "[Tool Result]",
            content: "Running sentiment + memory extraction + proximity scoring…\n\nJane Doe:\n    • Warmth: 94% (reply speed <4h, ethical overlap)\n    • Last signal: “let’s grab coffee?” (unread by user)\n\nJohn Doe – Personal Signals:\n    • Birthday: **March 15** (Telegram)\n    • Location: **Berlin** (email signature)\n    • Current Focus: **Project X – Phase 2** (roadmap PDF)"
        },
        { 
            type: "thinking", 
            label: "[Agent Thinking]",
            content: "→ User is **one message away** from John\n→ Jane is the **perfect conduit**\n→ Birthday next week → **perfect timing**\n→ Confidence: **96% intro success**"
        },
        { 
            type: "final", 
            label: "[Agent Response – Final Summary]",
            title: "You-Lens Insight Report: John Doe",
            intro: "Hey Lea — you’re already in the room. You just never looked up.",
            body: "<p>You think John Doe is a stranger. He’s not. You’re one warm message away from collaborating on Project X — and you’ve been this close for three years.</p><strong>Your Hidden Network (Uncovered)</strong><ul><li><strong>Jane Doe – Your Strongest Bridge:</strong> You messaged her in 2022. She replied: “Absolutely! When are you free?” <strong>You never saw it.</strong> She’s your ethical twin — and she’s been waiting.</li><li><strong>Claude Junker – Your Warm Backup:</strong> Replied to your intro: “Really excited to explore synergy”</li><li><strong>Alex Jakarta – Your Silent Champion:</strong> Forwarded your deck to John: “worth a look”</li></ul>",
            draft: "<strong>Drafted Email (via Jane)</strong><div class=\"email-draft\"><p><strong>Subject:</strong> Project X + Happy Early Birthday, John!</p><p>Hi Jane,</p><p>Hope you’re well — finally taking you up on that coffee from 2022!</p><p>Looping in John (cc’d) — I saw he’s leading Project X Phase 2, and our “Conscience as Code” vision aligns perfectly. Claude mentioned he’s excited to explore ideas, and Alex forwarded my deck to John a while back — small world!</p><p>John, happy early birthday (March 15, right?) — would love to grab a virtual coffee next week and explore collaboration.</p><p>Best,<br>Lea</p></div>"
        }
    ];

    // --- Helper Functions ---

    /**
     * A simple promise-based delay
     * @param {number} ms - Milliseconds to wait
     */
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    /**
     * Simulates typing text into an element, one character at a time.
     * Supports multi-line strings.
     * @param {HTMLElement} element - The element to type into
     * @param {string} text - The text to type
     * @param {number} speed - Milliseconds between characters
     */
    const typeText = async (element, text, speed = 20) => {
        element.classList.add("typing"); // Add blinking cursor
        const lines = text.split('\n');
        for (const line of lines) {
            for (const char of line) {
                element.innerHTML += char;
                await delay(speed);
            }
            element.innerHTML += '\n'; // Add newline after typing a line
        }
        element.classList.remove("typing"); // Remove cursor when done
    };

    /**
     * Creates and appends a log entry to the list.
     * @param {object} item - The script item object
     */
    const addLogEntry = async (item) => {
        const li = document.createElement("li");
        li.className = `log-entry ${item.type}`;
        
        const label = document.createElement("strong");
        label.className = "log-label";
        label.textContent = item.label;
        li.appendChild(label);

        const content = document.createElement("pre");
        li.appendChild(content);
        
        logList.appendChild(li);

        // Make the new entry visible with animation
        li.style.opacity = 1;

        // Scroll the list to the bottom
        logList.scrollTop = logList.scrollHeight;

        if (item.type === "thinking") {
            await typeText(content, item.content, 10); // Faster typing for thoughts
        } else {
            content.innerHTML = item.content; // Instant display for tool calls/results
        }
    };

    // --- Main Demo Logic ---
    const runDemo = async () => {
        // 1. Clear previous run (if any)
        userQueryBox.innerHTML = "";
        logList.innerHTML = "";
        finalReportBox.innerHTML = "";
        userQueryBox.style.opacity = 0;
        finalReportBox.style.opacity = 0;

        await delay(500); // Initial pause

        for (const item of script) {
            switch (item.type) {
                case "user":
                    userQueryBox.style.opacity = 1;
                    userQueryBox.innerHTML = `<strong class="log-label">${item.label}</strong><p>${item.content}</p>`;
                    await delay(1500); // Pause after user query
                    break;
                case "thinking":
                    await addLogEntry(item);
                    await delay(1000); // Pause after thinking
                    break;
                case "toolCall":
                    await addLogEntry(item);
                    await delay(800); // Short pause for tool call
                    break;
                case "toolResult":
                    await addLogEntry(item);
                    await delay(1200); // Pause to read results
                    break;
                case "final":
                    finalReportBox.style.opacity = 1;
                    finalReportBox.innerHTML = `
                        <strong class="log-label">${item.label}</strong>
                        <div class="report-content">
                            <h3></h3>
                            <p class="report-intro"></p>
                            <div class="report-body"></div>
                            <div class="report-draft"></div>
                        </div>
                    `;
                    
                    const reportContent = finalReportBox.querySelector('.report-content');
                    reportContent.style.display = 'block';

                    // Select inner elements
                    const titleEl = finalReportBox.querySelector('h3');
                    const introEl = finalReportBox.querySelector('.report-intro');
                    const bodyEl = finalReportBox.querySelector('.report-body');
                    const draftEl = finalReportBox.querySelector('.report-draft');

                    // Animate the final report
                    await typeText(titleEl, item.title, 30);
                    await delay(500);
                    await typeText(introEl, item.intro, 30);
                    await delay(500);
                    
                    // Instantly show the body and draft for demo purposes
                    // (Typing them would take too long)
                    bodyEl.innerHTML = item.body;
                    await delay(1000);
                    draftEl.innerHTML = item.draft;

                    break;
            }
        }
        
        // Wait 10 seconds and restart the demo
        await delay(10000);
        runDemo();
    };

    // Start the demo!
    runDemo();
});