// Wait for the component's HTML to be loaded
document.addEventListener("DOMContentLoaded", () => {
    
    // --- DOM Elements ---
    const userQueryBox = document.getElementById("user-query-box");
    const logList = document.getElementById("log-list");
    const finalReportBox = document.getElementById("final-report-box");

    // --- State for Auto-Scroll ---
    let isAutoScrollActive = true;

    // --- Data for the Demo ---
    const script = [
        { type: "user", label: "[User]", content: "I would love to work with John Doe on Project X." },
        { 
            type: "thinking", 
            label: "[Agent Thinking]", 
            content: "Okay, my task is to assist the user with their goal: connecting with John Doe about Project X. To do that, I first need to build a complete picture of who John Doe is and, crucially, what the user's existing relationship or proximity to him is. I'm initiating a full-spectrum query to find all traces of him." 
        },
        { type: "toolCall", label: "[Tool Call]", content: "query_databases(query=\"John Doe ID:582\", scope=all)" },
        { type: "toolResult", label: "[Tool Result]", content: "→ 13 matches located\n    • 7 emails\n    • 2 Telegram groups\n    • 4 Internal Documents\n    • 1 calendar invite (declined)" },
        { 
            type: "thinking", 
            label: "[Agent Thinking]", 
            content: "Okay, I have 13 data points. These are just the containers; I don't know the content or context yet. I need to look inside these 7 emails, 2 Telegram groups, and 4 documents to find the actual *pathway* to John Doe.\n\nMy goal is to find the *warmest* possible connection. I'll deploy a sub-process to analyze these items and extract:\n1.  **Key People:** Who are the mutual connections involved?\n2.  **Relationship Context:** What is the nature of their past conversations? Is the sentiment positive? Is there any *unanswered* call to action?\n3.  **Personal Signals:** What are John's current priorities (like Project X), stated interests (like AI ethics), or personal details (location, birthday) that can be used to build rapport?\n\nI'm looking for the strongest, most actionable bridge."
        },
        { type: "toolCall", label: "[Tool Call]", content: "DeploySubinstance(task=\"Analyze Emails\", item_ids=['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7'])" },
        { type: "toolCall", label: "[Tool Call]", content: "DeploySubinstance(task=\"Analyze Documents\", item_ids=['d1', 'd2', 'd3', 'd4'])" },
        { type: "toolCall", label: "[Tool Call]", content: "DeploySubinstance(task=\"Analyze Telegram Groups\", item_ids=['t1', 't2'])" },
        { type: "toolResult", label: "[Tool Result - Email]", content: "Analysis complete. Found 3 emails (e2, e5, e7) where User and John Doe (ID:582) are both recipients. Key entity 'Jane Doe (ID:134)' found in CC on e5." },
        { type: "toolResult", label: "[Tool Result - Documents]", content: "Analysis complete. Document d3 ('Q3 Roadmap v2.pdf') mentions 'Project X - Phase 2'. Document d1 ('Conscience as Code - User Pitch Deck.pdf') was forwarded by 'Alex Jakarta (ID:798)'." },
        { type: "toolResult", label: "[Tool Result - Telegram]", content: "Analysis complete. Group t1 ('AI Founders EU') contains User (member) and John Doe (admin). Group t2 ('Project X Early Access') also contains User and John Doe (admin)." },
        { type: "thinking", label: "[Agent Thinking]", content: "Okay, this is interesting. The sub-processes found two new key people: 'Jane Doe (ID:134)' and 'Alex Jakarta (ID:798)'. I need to know who these two people are and what their relationship is to the user and to John Doe. I'm going to look both of them up." },
        { type: "toolCall", label: "[Tool Call]", content: "query_databases(query=\"Jane Doe ID:134\", scope=all)" },
        { type: "toolCall", label: "[Tool Call]", content: "query_databases(query=\"Alex Jakarta ID:798\", scope=all)" },
        { type: "toolResult", label: "[Tool Result - Jane Doe]", content: "→ 5 matches found.\n    • 1 Telegram DM (2022, from Jane):\n      'Love your take on AI ethics—let’s grab coffee? When are you free?'\n    • **Status: UNREAD BY USER**." },
        { type: "toolResult", label: "[Tool Result - Alex Jakarta]", content: "→ 2 matches found.\n    • 1 Email (3 months ago, From: Alex, To: John Doe):\n      'Fwd: Conscience as Code...'\n    • Body Excerpt: 'worth a look—ethics angle could de-risk Project X.'\n    • **Note: User was not on this thread**." },
        { 
            type: "thinking", 
            label: "[Agent Thinking]", 
            content: "This is a major breakthrough. The user isn't a stranger at all.\n\n1.  **Jane Doe:** This is the primary path. The user has a warm, unanswered invitation from 2022 on a topic ('AI ethics') that is directly relevant. The user just... missed it. Reviving this is the most natural and powerful entry point.\n2.  **Alex Jakarta:** This is a strong secondary signal. John Doe has *already* seen the user's pitch deck, forwarded by a trusted contact (Alex) with a positive note. This means John is already primed on the user's work.\n3.  **Direct Context:** The user is also in two Telegram groups with John and knows 'Project X - Phase 2' is his current focus.\n\nMy hypothesis is clear: The strongest, warmest path is not a cold outreach. It's a *warm revival* of the conversation with **Jane Doe**, using the shared context of AI ethics and Alex's introduction as supporting points.\n\nBefore I propose this, I need one last piece of information to make the introduction perfect: personal signals about John. I'll scan the Telegram groups for any rapport-building details."
        },
        { 
            type: "final", 
            label: "[Agent Response – Final Summary]",
            title: "Your Path to John Doe",
            intro: "You asked for a way to connect with John Doe about Project X. My analysis shows you don't need an introduction—you're already in his inner circle, but the connections have been invisible to you until now.",
            body: "<h3>Here is the path I've uncovered:</h3><ol><li><strong>Your Strongest Bridge: Jane Doe (The Unread Message)</strong><ul><li><strong>Who she is:</strong> A key mutual contact you're CC'd on emails with.</li><li><strong>The Hidden Connection:</strong> In 2022, you sent her a Telegram message. She replied enthusiastically: \"Love your take on AI ethics—let’s grab coffee? When are you free?\"</li><li><strong>The Breakthrough:</strong> You never saw this. That warm, unanswered invitation is your primary and most powerful way in. She is your direct, personal link.</li></ul></li><li><strong>Your Silent Champion: Alex Jakarta (The Forwarded Deck)</strong><ul><li><strong>Who he is:</strong> The person who forwarded your pitch deck.</li><li><strong>The Hidden Connection:</strong> Three months ago, Alex sent your own deck (\"Conscience as Code\") directly to John Doe.</li><li><strong>The Breakthrough:</strong> He endorsed it, telling John it was \"worth a look—ethics angle could de-risk Project X.\" This means John Doe is already primed; he's seen your work and your specific vision, recommended by a trusted contact.</li></ul></li><li><strong>Your Shared Context: John Doe (The Digital Proximity)</strong><ul><li><strong>Who he is:</strong> Your target.</li><li><strong>The Hidden Connection:</strong> You are already a member of two of the same private Telegram groups as him (\"AI Founders EU\" and \"Project X Early Access\"), and in both, he is an admin. You also have access to his team's \"Q3 Roadmap,\" which confirms his current priority is \"Project X - Phase 2.\"</li><li><strong>The Breakthrough:</strong> You aren't an outsider. You're in the same rooms, and you know exactly what he's working on right now.</li></ul></li></ol><h3>Recommendation:</h3><p>Your path isn't a cold outreach. It's a <strong>warm revival</strong>.</p><p>The best strategy is to reply to Jane Doe's two-year-old message. You can reference your shared interest in AI ethics (her reason for the coffee invite) and your own \"Conscience as Code\" deck (which Alex already sent to John), and connect it directly to John's \"Project X - Phase 2.\"</p><p>You're not asking for an introduction; you're simply connecting the dots that are already there.</p>",
            draft: "<strong>Drafted Message (via Telegram to Jane)</strong><div class=\"email-draft\" style=\"font-family: Arial, sans-serif; padding: 12px; border: 1px solid #ddd; border-radius: 8px; background: #ffcdabff;\"><p>Hi Jane,</p><p>I can't believe it's been two years, but I was just reviewing my messages and saw I never replied to your incredibly kind offer to grab coffee back in 2022. My apologies – things got hectic, but I'd still love to take you up on that!</p><p>My reason for reaching out now is twofold: I saw that John Doe (who I see you're connected to) is leading 'Project X - Phase 2'. My work on 'Conscience as Code' (which Alex Jakarta actually forwarded to him a while back) aligns perfectly with that.</p><p>Would you be open to a virtual coffee and, if it feels right, looping John in? Would love to explore collaboration.</p><p>Best,<br>Lea</p></div>"
        }
    ];

    // --- Helper Functions ---

    /**
     * Logic: If user is close to bottom (within 20px), stay attached to bottom.
     * If user scrolls up, detach.
     */
    logList.addEventListener('scroll', () => {
        const threshold = 20;
        const position = logList.scrollTop + logList.clientHeight;
        const height = logList.scrollHeight;
        
        // If we are close to the bottom, enable auto-scroll
        if (height - position <= threshold) {
            isAutoScrollActive = true;
        } else {
            // If user scrolled up manually, disable auto-scroll
            isAutoScrollActive = false;
        }
    });

    /**
     * Snap to absolute bottom
     */
    const scrollToBottom = () => {
        logList.scrollTop = logList.scrollHeight;
    };

    /**
     * Simple promise-based delay
     */
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    /**
     * Simulates typing text.
     * Checks 'isAutoScrollActive' flag to decide whether to force scroll.
     */
    const typeText = async (element, text, speed = 20) => {
        element.classList.add("typing");
        const lines = text.split('\n');
        for (const line of lines) {
            for (const char of line) {
                element.innerHTML += char;
                if (isAutoScrollActive) scrollToBottom();
                await delay(speed);
            }
            element.innerHTML += '\n';
        }
        element.classList.remove("typing");
    };

    /**
     * Creates and appends a log entry.
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

        // Make visible
        li.style.opacity = 1;

        // If sticky mode is active, snap to bottom to reveal new entry
        if (isAutoScrollActive) scrollToBottom();

        if (item.type === "thinking") {
            await typeText(content, item.content, 10);
        } else {
            content.innerHTML = item.content;
            if (isAutoScrollActive) scrollToBottom();
        }
    };

    // --- Main Demo Logic ---
    const runDemo = async () => {
        userQueryBox.innerHTML = "";
        logList.innerHTML = "";
        finalReportBox.innerHTML = "";
        userQueryBox.style.opacity = 0;
        finalReportBox.style.opacity = 0;
        
        // Ensure we start with auto-scroll active
        isAutoScrollActive = true; 

        await delay(500);

        for (const item of script) {
            switch (item.type) {
                case "user":
                    userQueryBox.style.opacity = 1;
                    const userLabel = document.createElement("strong");
                    userLabel.className = "log-label";
                    userLabel.textContent = item.label;
                    const userContent = document.createElement("p");
                    userQueryBox.appendChild(userLabel);
                    userQueryBox.appendChild(userContent);
                    
                    await typeText(userContent, item.content, 50);
                    await delay(900);
                    break;
                case "thinking":
                    await addLogEntry(item);
                    await delay(400);
                    break;
                case "toolCall":
                    await addLogEntry(item);
                    await delay(200);
                    break;
                case "toolResult":
                    await addLogEntry(item);
                    await delay(450);
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

                    const titleEl = finalReportBox.querySelector('h3');
                    const introEl = finalReportBox.querySelector('.report-intro');
                    const bodyEl = finalReportBox.querySelector('.report-body');
                    const draftEl = finalReportBox.querySelector('.report-draft');

                    await typeText(titleEl, item.title, 30);
                    await delay(500);
                    await typeText(introEl, item.intro, 30);
                    await delay(500);
                    
                    bodyEl.innerHTML = item.body;
                    await delay(1000);
                    draftEl.innerHTML = item.draft;
                    
                    // Final bump to ensure report is seen if user is in sticky mode
                    if (isAutoScrollActive) {
                        // For the report, we might need to scroll the report itself if it's huge, 
                        // but here we just ensure the parent list doesn't hide it.
                        // Since report is outside logList, nothing to scroll in logList.
                    }
                    break;
            }
        }
    };

    runDemo();
});