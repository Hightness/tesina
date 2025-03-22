// Variabili globali utilizzate nel programma
let connectionsSVG; // SVG per le connessioni tra i nodi
let startTime; // Tempo di inizio dell'algoritmo

// Initialize D3 selection after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    connectionsSVG = d3.select('.connections-svg');
    console.log("Connection SVG initialized:", connectionsSVG.node());
});

const drawConnections = links => {
    // Disegna le connessioni tra i nodi foglia degli alberi S e T
    connectionsSVG.selectAll('*').remove();
    const lines = [];
    for ([sourceId, targetId] of Object.entries(links)) {
        nodes = document.querySelectorAll(`p.node-name`);
        const targetNode = Array.from(nodes).find(node => node.textContent.trim() === sourceId.split('_')[0]);
        const sourceNode = Array.from(nodes).find(node => node.textContent.trim() === targetId.split('_')[0]);
        //console.log(sourceId, targetId, sourceNode, targetNode);

        if (sourceNode && targetNode){
            const [sourceRect, targetRect] = [sourceNode.getBoundingClientRect(), targetNode.getBoundingClientRect()];
            const [x1, y1] = [sourceRect.left + sourceRect.width / 2, sourceRect.top + sourceRect.height / 2];
            const [x2, y2] = [targetRect.left + targetRect.width / 2, targetRect.top + targetRect.height / 2];
            lines.push({ x1, y1, x2, y2, sourceId, targetId });
            connectionsSVG.append('line').attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2);
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
        if(count - 1 > 1)connectionsSVG.append('text').attr('class', 'circle').attr('x', x).attr('y', y).attr('dy', -2).text(count - 1);
    });

    // Ottiene solo il testo con il tempo, quindi divide la stringa e ottiene la seconda parte
    let testo = document.getElementById('crossings').innerText;
    if (!testo.includes("Crossings:")) {
        document.getElementById('crossings').innerText = `Crossings: ${bestTrees[currentBestIndex].crossings} | ${testo}`;
    } else {
        testo = testo.split("|")[0];
        document.getElementById('crossings').innerText = `Crossings: ${bestTrees[currentBestIndex].crossings} | ${testo}`;
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
        const treeConfig = {
            chart: {
                container: `#${containerId}`,
                connectors: { type: 'curve' },
                node: { HTMLclass: containerId === 'bestT' ? 'flipped' : '' },
                levelSeparation: window.innerHeight / (max_depth * 5),
                siblingSeparation: window.innerWidth / (number_of_leafs * 5) + 20, // Add extra spacing
                subTeeSeparation: window.innerWidth / (number_of_leafs * 10) + 20, // Add extra spacing
                rootOrientation: 'NORTH',
                padding: window.innerHeight / 100,
                zoom: true,
                scrollbar: 'native', // Change to native for better browser scrollbar support
                nodeAlign: 'CENTER', // Center the nodes
                connectors: {
                    type: 'curve',
                    style: {
                        'stroke-width': 2,
                        'stroke': 'rgb(105, 117, 101)'
                    }
                }
            },
            nodeStructure: convertToTreant(root)
        };

        // Crea una promessa per gestire il rendering dell'albero
        //console.log('rendering');
        new Promise((resolve) => {
            const tree = new Treant(treeConfig);
            // Attende che il DOM venga aggiornato
            requestAnimationFrame(() => {
                    setTimeout(() => resolve(tree), 100);
            });
        }).then(() => {
            // Disegna le connessioni dopo che l'albero è stato completamente renderizzato
            if (containerId === 'bestT') {
                drawConnections(links);
            }
        });
    };
    renderTreant();

    let treeContainers = document.querySelectorAll('.chart');
    treeContainers.forEach(container => {
        container.scrollLeft = -container.scrollWidth / 2;
    });
}

// After the tree is drawn, ensure it's properly positioned
//window.addEventListener('treantLoaded', function() {
    // Make sure all trees are visible by scrolling to center
    //const treeContainers = document.querySelectorAll('.chart');
    //treeContainers.forEach(container => {
        //if (container.scrollWidth > container.clientWidth) {
            //container.scrollLeft = (container.scrollWidth - container.clientWidth) / 2;
        //}
    //});
//});

const showNextBestTree = (n) => {
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
    if (bestTree.swapped) {
        swappedS = printSwappednodes(bestTree.rootT, originalS);
        swappedT = printSwappednodes(bestTree.rootS, originalT);
        plot(bestTree.rootT, 'bestS', links);
        plot(bestTree.rootS, 'bestT', links);
    } else {
        swappedT = printSwappednodes(bestTree.rootT, originalT);
        swappedS = printSwappednodes(bestTree.rootS, originalS);
        plot(bestTree.rootS, 'bestS', links);
        plot(bestTree.rootT, 'bestT', links);
    }

    // Visualizza le informazioni sui nodi scambiati nel browser
    document.getElementById('swappedT').innerText = `Swapped Nodes in T: ${swappedT}`;
    document.getElementById('swappedS').innerText = `Swapped Nodes in S: ${swappedS}`;
    
    // Aggiorna le intersezioni con il tempo
    let testo = document.getElementById('crossings').innerText;
    if (!testo.includes("Time:")) {
        document.getElementById('crossings').innerText = `${testo} | Time: ${bestTree.time} ms`;
    } else {
        testo = testo.split("|")[0];
        document.getElementById('crossings').innerText = `${testo} | Time: ${bestTree.time} ms`;
    }
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
            set_ranges_on_tree(rootS, sigma);
            compute_crossings(rootS, tau_order);
            let bestRootS = cloneTree(rootS);
            let bestRootT = cloneTree(rootT);
            de_binarize_tree(bestRootS);
            de_binarize_tree(bestRootT);
            sigma = get_linear_order(bestRootS);
            tau_order = get_tau_indexes(bestRootT, sigma, link);
            let temp_nc = n_crossings(sigma, tau_order);
            if (temp_nc < best) {
                console.log(`Found new best tree with ${temp_nc} crossings`);
                prev_ind = cur_ind;
                p_ind = c_ind;
                best = temp_nc;
                bestTrees.push({swapped:swapped, rootS: bestRootS, rootT: bestRootT, links: link, time: Date.now() - startTime , crossings: best});
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
const startVisualization = (new_run) => {

    // Inizializza variabili e pulisce lo schermo
    bestTrees = [];
    if(connectionsSVG) connectionsSVG.selectAll('*').remove();
    console.clear();
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
    test = 0;
    
    //check on index.html the title of the page
    if(document.title === 'Gurobi'){
        //Fetch tree data from JSON file
        fetch('/tree_data.json')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok: ' + response.statusText);
                }
                return response.json();
            })
            .then(treeData => {
                // Parse tree structures
                const originalS = JSON.parse(treeData.s_tree);
                const originalT = JSON.parse(treeData.t_tree);
                const L = treeData.L;
                const sOrder = treeData.s_order;
                const tOrder = treeData.t_order;
                        
                // Clone the trees
                const clonedS = new Node();
                const clonedT = new Node();
                        
                // Recreate the tree structure by converting the JSON objects back to Node instances
                const rebuildTree = (json, node) => {
                    node.value = json.value;
                    node.id = json.id;
                    node.splitted = json.splitted;
                            
                    if (json.children && json.children.length > 0) {
                        json.children.forEach(childJson => {
                            const childNode = new Node();
                            rebuildTree(childJson, childNode);
                            childNode.parent = node;
                            node.children.push(childNode);
                        });
                    }
                };
                        
                rebuildTree(originalS, clonedS);
                rebuildTree(originalT, clonedT);
                        
                // Set ranges on trees before ordering
                set_ranges_on_tree(clonedS, get_linear_order(clonedS));
                set_ranges_on_tree(clonedT, get_linear_order(clonedT));
                        
                // Apply the ordering to the trees
                order_tree(clonedS, sOrder);
                order_tree(clonedT, tOrder);
                        
                // Add the optimally ordered trees to the bestTrees array
                const [links, s_links, t_links] = set_links(clonedS, clonedT, L);
                        
                // Add the trees to the bestTrees array with a special flag
                bestTrees.push({
                    swapped: false,
                    rootS: clonedS,
                    rootT: clonedT,
                    links: links,
                    time: 0,
                    crossings: 0,
                    isOptimal: true // Flag to identify this as the optimal solution from Gurobi
                });
                        
            })
            .catch(error => {
                console.error('Error fetching tree data:', error);
                alert('Failed to load tree data. See console for details.');
            });
            
        return; // Skip the rest of the function when in Gurobi mode
    }
    
    if(new_run){
        // Se è una nuova esecuzione, crea alberi casuali e collegamenti
        console.log('new run');
        let m_c, td, n_connections;
        L = [];
        
        m_c = parseInt(document.getElementById('max_children').value); // Numero massimo di figli
        td = parseInt(document.getElementById('tree_depth').value); // Profondità dell'albero
        n_connections = parseInt(document.getElementById('n_connections').value); // Numero di collegamenti

        create_random_tree(rootS, depth = td-1, max_children = m_c); // Crea l'albero S casuale
        create_random_tree(rootT, depth = td-1, max_children = m_c); // Crea l'albero T casuale
        create_random_links(rootS, rootT, max_links = n_connections); // Crea collegamenti casuali

        originalS = cloneTree(rootS); // Clona l'albero S originale
        originalT = cloneTree(rootT); // Clona l'albero T originale

    } else {
        // Se si sta rielaborando, clona gli alberi originali
        console.log('rerunning..');
        rootS = cloneTree(originalS);
        rootT = cloneTree(originalT);
    }

    //let s_leafs = get_linear_order(rootS).length;
    //let t_leafs = get_linear_order(rootT).length;
    //let s_tree = JSON.stringify(originalS, null, 2);
    //let t_tree = JSON.stringify(originalT, null, 2);
    //let treeData = {
        //s_leafs,
        //t_leafs,
        //L,
        //s_tree,
        //t_tree
    //};

    // Convert the data to a JSON string
    //let jsonString = JSON.stringify(treeData, null, 2);

    // Create a Blob with the JSON data
    //let blob = new Blob([jsonString], { type: 'application/json' });

    // Create a link element
    //let link = document.createElement('a');
    //link.href = URL.createObjectURL(blob);
    //link.download = 'tree_data.json'; // Name of the file to download

    // Trigger the download
    //link.click();

    // Clean up
    //URL.revokeObjectURL(link.href);
        
        // Write the data to a JSON file in the public directory
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

// Export the module for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        // Functions
        showNextBestTree,
        startVisualization
    };
}