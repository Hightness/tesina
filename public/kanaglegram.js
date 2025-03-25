let connectionsSVG; // SVG per le connessioni tra i nodi
let startTime; // Tempo di inizio dell'algoritmo
//let sOrder, tOrder;
//let gurobi_time = -1;
//let gurobi_crossings = -1;

// Add these helper functions near the top of the file
// Update the disableAllButtons function to be more robust and add visual feedback
function disableAllButtons() {
  document.querySelectorAll('button, .btn, input[type="button"]').forEach(btn => {
    btn.disabled = true;
    btn.style.opacity = '0.6';
    btn.style.cursor = 'not-allowed';
  });
}

// Update the enableAllButtons function similarly
function enableAllButtons() {
  document.querySelectorAll('button, .btn, input[type="button"]').forEach(btn => {
    btn.disabled = false;
    btn.style.opacity = '';
    btn.style.cursor = '';
  });
}

//make function async
async function setGurobi() {
    disableAllButtons(); // Disable all buttons during processing
    
    const response = await fetch('/run-python', {
      method: 'POST'
    });

    const result = await response.json();

    const sOrder = result.sOrder;
    const tOrder = result.tOrder;
    const gurobi_time = result.execution_time;
    const gurobi_crossings = parseInt(result.crossings)/2;

    let clonedS = cloneTree(originalS);
    let clonedT = cloneTree(originalT);
    
    set_ranges_on_tree(clonedS);
    set_ranges_on_tree(clonedT);

    order_tree(clonedS, sOrder);
    order_tree(clonedT, tOrder);

    const [links, s_links, t_links] = set_links(clonedS, clonedT, L);

    bestTrees.push({
        swapped: false,
        rootS: clonedS,
        rootT: clonedT,
        links: links,
        time: gurobi_time,
        crossings: gurobi_crossings,
        optimal: true
    });

  enableAllButtons(); // Re-enable all buttons
}

document.getElementById('runGurobiBtn').addEventListener('click', async () => {
    let alreadyRun = false;
    bestTrees.forEach(tree => {
        if (tree.optimal) {
            alert('Gurobi has already been run for this tree.');
            alreadyRun = true;
            return;
        }});
    if(!alreadyRun){await setGurobi();}
});

document.addEventListener('DOMContentLoaded', () => {
    // Initialize SVG
    connectionsSVG = d3.select('.connections-svg');
    
    // Function to update SVG positioning and dimensions
    function updateSVGPosition() {
        const treeContainer = document.querySelector('.tree-container');
        if (!treeContainer) return;
        
        // Reset SVG attributes
        connectionsSVG
            .attr('width', treeContainer.offsetWidth)
            .attr('height', treeContainer.offsetHeight)
            .style('position', 'absolute')
            .style('top', '0')
            .style('left', '0');
            
        // If trees are visible, redraw connections
        if (bestTrees.length > 0) {
            drawConnections(bestTrees[currentBestIndex].links);
        }
    }
    
    // Update the SVG position initially and whenever relevant events occur
    updateSVGPosition();
    window.addEventListener('resize', updateSVGPosition);
    
    // Handle scroll events on any relevant container
    const containers = [
        document.querySelector('.tree-container'),
        document.getElementById('bestS'),
        document.getElementById('bestT')
    ];
    
    // Debounce function to avoid excessive redraws
    let scrollTimeout;
    const handleScroll = () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            updateSVGPosition();
        }, 1);
    };
    
    // Add scroll listeners
    containers.forEach(container => {
        if (container) {
            container.addEventListener('scroll', handleScroll);
        }
    });
    
    // Also redraw on window scroll
    window.addEventListener('scroll', handleScroll);
    
    // Add a listener for after the trees are rendered
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length) {
                centerTreeInContainer('bestS');
                centerTreeInContainer('bestT');
            }
        });
    });
    
    // Start observing the tree containers
    const config = { childList: true, subtree: true };
    observer.observe(document.querySelector('.tree-container'), config);
});

const automaticRun = async () => {
    let n = parseInt(document.getElementById('number_automatic_runs').value);
    let n_start = n;
    while (n > 0) {
        await startVisualization(true);
        document.title = `Automatic Run ${n_start - n + 1}`;
        document.getElementById('titolo').innerText = `Automatic Run ${n_start - n + 1}`;

        let heuristic_time = bestTrees.at(-1).time;
        let heuristic_crossings = bestTrees.at(-1).crossings;

        // Run Gurobi optimization
        await setGurobi();
        await showNextBestTree(0);

        let number_of_leafs = get_linear_order(bestTrees.at(-1).rootS).length;
        number_of_leafs += get_linear_order(bestTrees.at(-1).rootT).length;

        let number_internal_nodes = get_internal_nodes(bestTrees.at(-1).rootS);
        number_internal_nodes += get_internal_nodes(bestTrees.at(-1).rootT);

        let json_data = {
            initial_crossings: bestTrees.at(0).crossings,
            heuristic_time: heuristic_time,
            heuristic_crossings: heuristic_crossings,
            gurobi_time: bestTrees.at(-1).time,
            gurobi_crossings: bestTrees.at(-1).crossings,
            number_of_leafs: number_of_leafs,
            number_internal_nodes: number_internal_nodes,
            number_of_links: Object.keys(bestTrees.at(-1).links).length
        };

        let jsonString = JSON.stringify(json_data, null, 2);
        fetch('/save_results', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: jsonString
        });
        n--;
    }

    fetch('/store_results', {
        method: 'POST'
    });

    document.title = "Kanaglegram Visualization";
    document.getElementById('titolo').innerText = "Kanaglegram Visualization";
}

const drawConnections = links => {
    // Clear existing connections
    connectionsSVG.selectAll('*').remove();
    
    // Get the tree container for positioning reference
    const treeContainer = document.querySelector('.tree-container');
    const containerRect = treeContainer.getBoundingClientRect();
    
    // Find all node-name elements
    const nodes = document.querySelectorAll('p.node-name');
    
    const lines = [];
    
    // Draw connections between nodes
    for (const [sourceId, targetId] of Object.entries(links)) {
        const sourceNode = Array.from(nodes).find(node => node.textContent.trim() === targetId.split('_')[0]);
        const targetNode = Array.from(nodes).find(node => node.textContent.trim() === sourceId.split('_')[0]);
        
        if (sourceNode && targetNode) {
            const sourceRect = sourceNode.getBoundingClientRect();
            const targetRect = targetNode.getBoundingClientRect();
            
            // Calculate line coordinates relative to the SVG
            const x1 = sourceRect.left + sourceRect.width / 2 - containerRect.left;
            const y1 = sourceRect.top + sourceRect.height / 2 - containerRect.top;
            const x2 = targetRect.left + targetRect.width / 2 - containerRect.left;
            const y2 = targetRect.top + targetRect.height / 2 - containerRect.top;
            
            // Draw the line
            connectionsSVG.append('line')
                .attr('x1', x1)
                .attr('y1', y1)
                .attr('x2', x2)
                .attr('y2', y2)
                .attr('stroke', 'rgb(105, 117, 101)')
                .attr('stroke-width', 1.5);
                
            lines.push({ x1, y1, x2, y2, sourceId, targetId });
        }
    }
    
    // Verifica le intersezioni e aggiunge punti rossi con numeri
    const intersections = {};
    for (let i = 0; i < lines.length; i++) {
        for (let j = i + 1; j < lines.length; j++) {
            const intersection = getLineIntersection(lines[i], lines[j]);
            if (intersection && lines[i].sourceId.split('_')[0] != lines[j].sourceId.split('_')[0] && lines[i].targetId.split('_')[0] != lines[j].targetId.split('_')[0]) {
                [x_rounded, y_rounded] = [Math.round(intersection.x * 10) / 10, Math.round(intersection.y * 10) / 10];
                const key = `${x_rounded},${y_rounded}`;
                if (intersections[key] === undefined)intersections[key] = {count: 0, x: intersection.x, y: intersection.y };
                intersections[key].count += 1;
            }
        }
    }

    Object.values(intersections).forEach(({ x, y, count }) => {
        connectionsSVG.append('circle').attr('cx', x).attr('cy', y);
        //if(count - 1 > 1)connectionsSVG.append('text').attr('class', 'circle').attr('x', x).attr('y', y).attr('dy', -2).text(count - 1);
    });

    document.getElementById('crossings').innerText = `Crossings: ${bestTrees[currentBestIndex].crossings} | Time: ${bestTrees[currentBestIndex].time} ms`;
    document.getElementById('crossings').style.color = 'rgb(236, 223, 204)';
    document.getElementById('crossings').style.backgroundColor = 'rgb(105, 117, 101)';
    if (bestTrees[currentBestIndex].optimal) {
        document.getElementById('crossings').innerText = `Crossings: ${bestTrees[currentBestIndex].crossings} | Time: ${bestTrees[currentBestIndex].time/1000} s`;
        document.getElementById('crossings').style.color = 'teal';
        //change backgroundcolor to darkgreen if optimal solution
        document.getElementById('crossings').style.backgroundColor = 'rgb(60, 61, 55)';
    }
}

const getLineIntersection = (line1, line2) => {
    // Calcola il punto di intersezione tra due linee
    const { x1: x1, y1: y1, x2: x2, y2: y2 } = line1;
    const { x1: x3, y1: y3, x2: x4, y2: y4 } = line2;

    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (denom === 0) return null; // Le linee sono parallele

    const intersectX = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / denom;
    const intersectY = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / denom;

    const isBetween = (value, min, max) => (
        // Verifica se un valore è compreso tra min e max
        value >= Math.min(min, max) && value <= Math.max(max, min)
    );

    if (isBetween(intersectX, x1, x2) && isBetween(intersectX, x3, x4) &&
        isBetween(intersectY, y1, y2) && isBetween(intersectY, y3, y4)) {
        return { x: intersectX, y: intersectY };
    }
    return null;
}

const plot = (root, containerId, links) => {
    // Genera la visualizzazione dell'albero utilizzando Treant.js
    const convertToTreant = node => ({
        text: { name: node.id}, // Avvolge l'ID del nodo in <p class="node-name">
        HTMLclass: node.children.length > 0 ? `internal-node` : `leaf-node`,
        attributes: { 'data-id': node.id },
        children: node.children.length > 0 ? node.children.map(convertToTreant) : []
    });

    // Funzione per renderizzare il grafico Treant
    const renderTreant = () => {
        // Cancella i grafici Treant esistenti
        document.querySelector(`#${containerId}`).innerHTML = '';

        // Ricrea treeConfig con dimensioni aggiornate
        const number_of_leafs = get_linear_order(root).length;
        
        // Calculate spacing based on the number of leaf nodes
        const levelSep = 50;
        const siblingSep = Math.max(20, window.innerWidth / (number_of_leafs * 4));
        const subTreeSep = Math.max(10, window.innerWidth / (number_of_leafs * 6));
        
        const treeConfig = {
            chart: {
                container: `#${containerId}`,
                connectors: { 
                    type: 'curve',
                    style: {
                        'stroke-width': 2,
                        'stroke': 'rgb(105, 117, 101)'
                    }
                },
                node: { 
                    HTMLclass: containerId === 'bestT' ? 'flipped' : '' 
                },
                levelSeparation: levelSep,
                siblingSeparation: siblingSep,
                subTeeSeparation: subTreeSep,
                rootOrientation: 'NORTH',
                padding: 20,
                zoom: true,
                scrollbar: 'native',
                nodeAlign: 'CENTER',
                animation: { nodeSpeed: 300, connectorsSpeed: 300 }
            },
            nodeStructure: convertToTreant(root)
        };

        // Crea una promessa per gestire il rendering dell'albero
        return new Promise((resolve) => {
            try {
                const tree = new Treant(treeConfig);
                // Wait longer for trees to fully render
                setTimeout(() => resolve(tree), 10);
            } catch (error) {
                console.error(`Error rendering tree in ${containerId}:`, error);
                resolve(null);
            }
        });
    };
    
    return renderTreant(); // Return the promise
}

// Function to center trees in their containers
function centerTreeInContainer(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // Find the actual tree content within the container
    const treeContent = container.querySelector('.Treant');
    if (!treeContent) return;
    
    // Calculate centering position
    const contentWidth = treeContent.scrollWidth;
    const containerWidth = container.clientWidth;
    
    // If content is wider than container, center it
    if (contentWidth > containerWidth) {
        const scrollAmount = (contentWidth - containerWidth) / 2;
        container.scrollLeft = scrollAmount;
    }
    
    // For vertical centering if needed
    const contentHeight = treeContent.scrollHeight;
    const containerHeight = container.clientHeight;
    
    if (contentHeight > containerHeight) {
        const scrollAmount = (contentHeight - containerHeight) / 2;
        container.scrollTop = scrollAmount;
    }
}

const showNextBestTree = async (n) => {
    // Mostra l'albero migliore successivo o precedente
    if (bestTrees.length === 0) {
        alert('No best trees found yet.');
        return;
    }
    // vedi se esiste un file json chiamato gurobi_sol.json

    currentBestIndex = (currentBestIndex + n + bestTrees.length) % bestTrees.length;
    const bestTree = bestTrees[currentBestIndex];
    const links = bestTree.links;
    let swappedT, swappedS;
    let plotPromises = [];

    if (bestTree.swapped) {
        swappedS = printSwappednodes(bestTree.rootT, originalS);
        swappedT = printSwappednodes(bestTree.rootS, originalT);
        plotPromises.push(plot(bestTree.rootT, 'bestS', links));
        plotPromises.push(plot(bestTree.rootS, 'bestT', links));
    } else {
        swappedT = printSwappednodes(bestTree.rootT, originalT);
        swappedS = printSwappednodes(bestTree.rootS, originalS);
        plotPromises.push(plot(bestTree.rootS, 'bestS', links));
        plotPromises.push(plot(bestTree.rootT, 'bestT', links));
    }
    
    // Visualizza le informazioni sui nodi scambiati nel browser
    document.getElementById('swappedT').innerText = `Swapped Nodes in T: ${swappedT}`;
    document.getElementById('swappedS').innerText = `Swapped Nodes in S: ${swappedS}`;

    // Wait for both trees to be plotted
    await Promise.all(plotPromises);
    
    // Center trees in their containers
    centerTreeInContainer('bestS');
    centerTreeInContainer('bestT');
    
    // Update the SVG position and draw connections
    setTimeout(() => {
        // Ensure our SVG is correctly positioned
        const treeContainer = document.querySelector('.tree-container');
        if (treeContainer) {
            connectionsSVG
                .attr('width', treeContainer.offsetWidth)
                .attr('height', treeContainer.offsetHeight);
        }
        
        // Draw the connections
        drawConnections(links);
    }, 50);
}

// Funzione euristica asincrona che aggiorna la barra di progresso durante l'esecuzione
const heuristic = (rootS, rootT, s_l, t_l, link) => {
    let depth, heuristic_d, random_d;
    
    depth = parseInt(document.getElementById('depth').value);
    heuristic_d = parseInt(document.getElementById('heuristic_d').value);
    random_d = parseInt(document.getElementById('random_d').value);
    let rand_call = 0;
    swapped = false;
    let best = Infinity;

    c_ind = p_ind = 0;
    //for (let i = 0; i < depth && best > 0; i++) {
    while(c_ind - p_ind < depth && best > 0) {
        binarize_tree(rootS, c_ind, s_l);
        binarize_tree(rootT, c_ind, t_l);
        c_ind++;
        cur_ind = prev_ind = 0;
        //for (let j = 0; j < heuristic_d; j++) {
        while (cur_ind - prev_ind < heuristic_d && best > 0) {
            cur_ind++;
            let sigma = get_linear_order(rootS);
            let tau_order = get_tau_indexes(rootT, sigma, link);
            set_ranges_on_tree(rootS);
            compute_crossings(rootS, tau_order);
            let bestRootS = cloneTree(rootS);
            let bestRootT = cloneTree(rootT);
            de_binarize_tree(bestRootS);
            de_binarize_tree(bestRootT);
            sigma = get_linear_order(bestRootS);
            tau_order = get_tau_indexes(bestRootT, sigma, link);
            let temp_nc = n_crossings(sigma, tau_order);
            if (temp_nc < best) {
                prev_ind = cur_ind;
                p_ind = c_ind;
                best = temp_nc;
                bestTrees.push({swapped:swapped, rootS: bestRootS, rootT: bestRootT, links: link, time: Date.now() - startTime , crossings: best, optimal: false});
            }
            [s_l, t_l] = [t_l, s_l];
            [rootS, rootT] = [rootT, rootS];
            link = Object.fromEntries(Object.entries(link).map(([k, v]) => [v, k]));
            swapped = !swapped;
            // Cede il controllo per aggiornare la UI ogni tot iterazioni
            //await new Promise(resolve => setTimeout(resolve, 0));
        }
        de_binarize_tree(rootS);
        de_binarize_tree(rootT);
        if (++rand_call === random_d) {
            sigma = get_linear_order(rootS);
            tau_order = get_tau_indexes(rootT, sigma, link);
            tau = get_linear_order(rootT);
            set_standard_dev(rootT, tau, tau_order); // Call set_standard_dev
            randomly_swap_children(rootT); // Pass tau and tau_orders
            rand_call = 0;
        }
        // de_binarize_tree(rootS);
        // de_binarize_tree(rootT);
    }
}

// Funzione per iniziare la visualizzazione e attendere il completamento dell'euristica
const startVisualization = async (new_run) => {
    // Inizializza variabili e pulisce lo schermo
    bestTrees = [];
    if(connectionsSVG) connectionsSVG.selectAll('*').remove();
    document.getElementById('bestS').innerHTML = '';
    document.getElementById('bestT').innerHTML = '';
    document.getElementById('swappedT').innerText = `Swapped Nodes in T: `;
    document.getElementById('swappedS').innerText = `Swapped Nodes in S: `;
    document.getElementById('crossings').innerText = `Crossings: | Time: 0 ms`;
    currentBestIndex = 0;
    Node.id_counter = 0;
    startTime = Date.now(); // Registra il tempo di inizio

    let rootS = new Node();
    let rootT = new Node();
    leaf_value_counter = 0;
    let s_leafs;
    let t_leafs;
        
    if(new_run){
        // Se è una nuova esecuzione, crea alberi casuali e collegamenti
        let m_c, td, n_connections;
        L = [];
            
        m_c = parseInt(document.getElementById('max_children').value); // Numero massimo di figli
        td = parseInt(document.getElementById('tree_depth').value); // Profondità dell'albero
        n_connections = parseFloat(document.getElementById('n_connections').value); // Numero di collegamenti

        create_random_tree(rootS, depth = td-1, max_children = m_c); // Crea l'albero S casuale
        create_random_tree(rootT, depth = td-1, max_children = m_c); // Crea l'albero T casuale

        s_leafs = get_linear_order(rootS).length;
        t_leafs = get_linear_order(rootT).length;

        create_random_links(rootS, rootT, max_links = n_connections*(s_leafs+t_leafs)/2); // Crea collegamenti casuali

        originalS = cloneTree(rootS); // Clona l'albero S originale
        originalT = cloneTree(rootT); // Clona l'albero T originale
    } else {
        // Se si sta rielaborando, clona gli alberi originali
        rootS = cloneTree(originalS);
        rootT = cloneTree(originalT);
        s_leafs = get_linear_order(rootS).length;
        t_leafs = get_linear_order(rootT).length;
    }

    let s_tree = JSON.stringify(originalS, null, 2);
    let t_tree = JSON.stringify(originalT, null, 2);
    let treeData = {
        s_leafs,
        t_leafs,
        L,
        s_tree,
        t_tree
    };

    // Convert the data to a JSON string
    let jsonString = JSON.stringify(treeData, null, 2);

    //now post the data to the server on localhost:3000/save_data
    fetch('/save_data', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: jsonString
    })

    // S = [[["t0", "t1", "t2", "t3"], ["t4", "t5", "t6"]],[["t7"]],[["t8", "t9"], ["t10", "t11"], ["t12"]],[["t13", "t14"]],[["t15", "t16"]]];
    // T = [[["b0"]],[["b1", "b2"], ["b3", "b4", "b5"], ["b6"]],[["b7", "b8"]],[["b9", "b10"], ["b11", "b12"], ["b13", "b14"]]];
    // L = [["t0", "b0"], ["t0", "b1"], ["t0", "b2"],
    //      ["t1", "b1"], ["t1", "b2"], ["t2", "b1"],
    //      ["t2", "b2"], ["t2", "b6"], ["t3", "b1"],
    //      ["t3", "b2"], ["t3", "b6"], ["t4", "b5"],
    //      ["t5", "b4"], ["t5", "b1"], ["t6", "b0"],
    //      ["t7", "b0"], ["t8", "b11"], ["t8", "b12"],
    //      ["t10", "b9"], ["t11", "b9"], ["t13", "b6"],
    //      ["t14", "b6"], ["t15", "b7"], ["t16", "b8"]];
    // create_tree(rootS, S);
    // create_tree(rootT, T);

    max_depth = get_depth(rootS); // Calcola la profondità massima
    [links, s_links, t_links] = set_links(rootS, rootT, L); // Imposta i collegamenti

    binarize_tree(rootS, 0, s_links); // Binarizza l'albero S
    binarize_tree(rootT, 0, t_links); // Binarizza l'albero T
    heuristic(rootS, rootT, s_links, t_links, links); // Esegue l'algoritmo euristico
    showNextBestTree(0);
}