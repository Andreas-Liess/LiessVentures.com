document.addEventListener("DOMContentLoaded", () => {
    const rawData = [
        {person: "You",
        rel1: "Co-led a project at Bain & Company designing ethical AI frameworks for financial services in New York.", conn1: "Sophie Carter",
        rel2: "Collaborated on student mentorship and research projects in AI ethics with Ethan Hall.", conn2: "Ethan Hall",
        rel3: "Guided family member Olivia Grant on math club activities and ethics discussions.", conn3: "Olivia Grant",
        rel4: "Professional identity shaped by leadership in AI ethics initiatives at Bain & Company.", conn4: "Bain & Company (Ai Transformation)"
        },
        {person: "Sophie Carter",
        rel1: "Provided mentorship and career guidance to You, advising on consulting and AI ethics projects.", conn1: "You",
        rel2: "Mentored Ethan Hall in AI research methodologies and project management.", conn2: "Ethan Hall",
        rel3: "Mentored Noah Kim on AI ethics coursework and supervised his research projects.", conn3: "Noah Kim",
        rel4: "Fielded media inquiries from Mia Sanders (CampusTV) regarding AI ethics panels.", conn4: "Mia Sanders (CampusTV)"
        },
        {person: "Ethan Hall",
        rel1: "Worked closely with You on data analysis and AI ethics project reviews.", conn1: "You",
        rel2: "Collaborated with Noah Kim on student research assignments and joint presentations.", conn2: "Noah Kim",
        rel3: "Received coaching and project guidance from Sophie Carter.", conn3: "Sophie Carter",
        rel4: "Sent progress updates and draft reports to Sophie Carter for review.", conn4: "Sophie Carter"
        },
        {person: "Isabella Reed",
        rel1: "Coordinated logistics and project timelines with You for ethical AI research projects.", conn1: "You",
        rel2: "Communicated occasionally with Alex Jordan regarding project resources and schedules.", conn2: "Alex Jordan",
        rel3: "Collaborated with Sophie Carter on operational and organizational support for student projects.", conn3: "Sophie Carter"
        },
        {person: "Noah Kim",
        rel1: "Worked with You on AI ethics projects at New York research initiatives.", conn1: "You",
        rel2: "Collaborated with Ethan Hall on research projects and presentations.", conn2: "Ethan Hall",
        rel3: "Received mentorship and coaching from Sophie Carter on ethics research.", conn3: "Sophie Carter"
        },
        {person: "Olivia Grant",
        rel1: "Advised You on family-related math and ethics discussions and supported your mentoring of younger members.", conn1: "You",
        rel2: "Discussed project progress and family matters with Liam Brooks.", conn2: "Liam Brooks",
srel3: "Shared insights and coordinated family activities with Grace Thompson.", conn3: "Grace Thompson",
        rel4: "Collaborated and exchanged ideas on projects and family responsibilities with Aiden Foster.", conn4: "Aiden Foster"
        },
        {person: "Liam Brooks",
        rel1: "Included Olivia Grant in family correspondence and project discussions.", conn1: "Olivia Grant",
        rel2: "Maintained communication with You for updates on family and shared projects.", conn2: "You"
        },
        {person: "Grace Thompson",
        rel1: "Included Olivia Grant in CC lists for family and project discussions.", conn1: "Olivia Grant",
        rel2: "Maintained connection with You on family matters and collaborative initiatives.", conn2: "You"
        },
        {person: "Aiden Foster",
        rel1: "Coordinated family discussions and shared responsibilities with Olivia Grant.", conn1: "Olivia Grant",
        rel2: "Maintained communication with You regarding shared family and project matters.", conn2: "You"
        },
        {person: "AliExpress",
        rel1: "Acted as a seller and buyer of Mini-PCs for You's research and personal use.", conn1: "You"
        },
        {person: "LinkedIn",
        rel1: "Served as You's login service provider and professional networking platform.", conn1: "You"
        },
        {person: "Börsenmedien AG",
        rel1: "Provided You with financial and market subscription services for professional research.", conn1: "You"
        },
        {person: "Bain & Company Karriere Team",
        rel1: "Acted as recruiting and career event contact for You at Bain & Company.", conn1: "You"
        },
        {person: "John Doe",
        rel1: "Admin of AI Founders EU Telegram group, connecting AI founders including You.", conn1: "You",
        rel2: "Indirect collaborator via forwarded pitch from Alex Jakarta and shared interests in AI ethics.", conn2: "Alex Jakarta"
        },
        {person: "Jane Doe",
        rel1: "Sent a LinkedIn coffee invite to You which remains unanswered, indicating interest in discussion of AI ethics.", conn1: "You",
        rel2: "Shares professional network overlap with John Doe in AI ethics initiatives, potentially facilitating introductions.", conn2: "John Doe"
        },
        {person: "Alex Jakarta",
        rel1: "Received Your pitch deck 'Conscience as Code' regarding AI ethics projects.", conn1: "You",
        rel2: "Forwarded the pitch to John Doe to initiate potential collaboration.", conn2: "John Doe",
        rel3: "Serves as VC contact reviewing ethical AI projects and funding opportunities.", conn3: "You"
        },
        {person: "Claude Junker",
        rel1: "Met You at Munich AI meetup discussing transparent and explainable AI models.", conn1: "You",
        rel2: "Mentioned You in the AI Founders EU Telegram group to highlight shared interests.", conn2: "You",
        rel3: "Engaged with You on shared interest in transparent AI research and practical implementations.", conn3: "You"
        }
    ];

    const nodes = [];
    const edges = [];
    const nodeSet = new Set();
    const nodeConnections = {};
    rawData.forEach(row => {
        const source = row.person;
        if (!nodeSet.has(source)) {
            nodeSet.add(source);
            nodes.push({data: {id: source}});
            nodeConnections[source] = [];
        }
        for (let i = 1; i <= 4; i++) {
            const rel = row[`rel${i}`];
            const target = row[`conn${i}`];
            if (target && target !== "N/A") {
                if (!nodeSet.has(target)) {
                    nodeSet.add(target);
                    nodes.push({data: {id: target}});
                    nodeConnections[target] = [];
                }
                edges.push({data: {source, target, label: rel}});
                nodeConnections[source].push({target, relationship: rel});
            }
        }
    });
    const cy = cytoscape({
            container: document.getElementById('cy'),
            minZoom: 0.5,
            maxZoom: 3,
            elements: {nodes, edges},
        style: [
            {
                selector: 'node',
                style: {
                    'background-color': '#10b981',
                    'label': (ele) => {
                        const id = ele.data('id');
                        return id.length > 15 ? id.substring(0, 13) + '...' : id;
                    },
                    'color': '#e2e8f0',
                    'font-size': '10px',
                    'font-weight': 500,
                    'text-valign': 'bottom',
                    'text-margin-y': 10,
                    'width': 16,
                    'height': 16,
                    'text-opacity': 0.9,
                    'border-width': 2,
                    'border-color': '#10b981',
                    'border-opacity': 0.3
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 1,
                    'line-color': 'rgba(165, 142, 251, 0.15)',
                    'curve-style': 'bezier',
                    'target-arrow-shape': 'triangle',
                    'target-arrow-color': 'rgba(165, 142, 251, 0.15)',
                    'arrow-scale': 0.8,
                    'font-size': '8px',
                    'text-rotation': 'autorotate',
                    'text-margin-y': -4,
                    'color': '#4b5563'
                }
            },
            {
                selector: '.highlighted',
                style: {
                    'background-color': '#fff',
                    'line-color': '#a58efb',
                    'target-arrow-color': '#a58efb',
                    'width': 2.5,
                    'z-index': 999,
                    'text-opacity': 1
                }
            },
            {
                selector: '.dimmed',
                style: {'opacity': 0.15}
            }
        ],
        layout: {
            name: 'breadthfirst',
            directed: true,
            animate: true,
            animationDuration: 800,
            fit: true,
            padding: 80,
            spacingFactor: 1.3,
            avoidOverlap: true,
            roots: '#' + 'Lucas Bennett'.replace(/\s/g, '\\ '),
            circle: true
        }
    });
    const infoPanel = document.getElementById('info-panel');
    cy.on('tap', 'node', (evt) => {
        const node = evt.target;
        const id = node.data('id');
        cy.elements().removeClass('highlighted dimmed');
        
        const connected = node.neighborhood().add(node);
        connected.addClass('highlighted');
        cy.elements().not(connected).addClass('dimmed');
        let html = `<div class="detail-name">${id}</div>`;
        
        const conns = nodeConnections[id] || [];
        if (conns.length > 0) {
            conns.forEach(c => {
                html += `<div class="connection-item"><span class="connection-label">${c.relationship}</span> → <span class="connection-target">${c.target}</span></div>`;
            });
        }
        infoPanel.innerHTML = html;
    });
    cy.on('tap', (evt) => {
        if (evt.target === cy) {
            cy.elements().removeClass('highlighted dimmed');
            infoPanel.innerHTML = '';
        }
    });
});