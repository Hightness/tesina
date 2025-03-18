
// Classe che rappresenta un nodo nell'albero
class Node {
    static id_counter = 0; // Contatore statico per assegnare ID unici ai nodi interni

    static set_id_counter(node) {
        // Assegna un ID al nodo: se il valore è null (si tratta di un nodo interno), utilizza il contatore
        node.id = node.value === null ? `(${Node.id_counter++})` : node.value;
    }

    constructor(value = null) {
        this.value = value; // Valore del nodo (può essere null)
        this.children = []; // Array dei nodi figli
        Object.defineProperty(this, 'parent', { value: null, writable: true, enumerable: false }); // Riferimento al nodo genitore
        Node.set_id_counter(this); // Imposta l'ID del nodo
        this.splitted = false; // Indica se il nodo è stato suddiviso durante la binarizzazione, utile per la de-binarizzazione
        this.standard_dev = 0; // Deviazione standard utilizzata nell'euristica per spostare i figli
    }

    switch_children(i1, i2) {
        // Scambia di posizione due figli nell'array
        [this.children[i1], this.children[i2]] = [this.children[i2], this.children[i1]];
    }

    set_children(new_children) {
        // Imposta i nuovi figli del nodo evitando duplicati
        const final_c = [], already_seen = new Set();
        for (let c of new_children) {
            if (c.value === null || !already_seen.has(c.value)) {
                c.parent = this; // Imposta il genitore del figlio
                final_c.push(c); // Aggiunge il figlio all'array finale
                if (c.value !== null) already_seen.add(c.value); // Per evitare che due nodi con stesso valore siano figli dello stesso nodo
                //questo accade perché normalizzando le foglie si creano nodi con lo stesso valore (vedi funzione normalize_leafs)
            }
        }
        this.children = final_c; // Aggiorna i figli del nodo
    }
}

// Variabili globali utilizzate nel programma
let max_depth = 0; // Profondità massima dell'albero
let test = 0;
let bestTrees = []; // Array per memorizzare i migliori alberi trovati
let currentBestIndex = 0; // Indice dell'albero migliore corrente
let connectionsSVG; // SVG per le connessioni tra i nodi
let startTime; // Tempo di inizio dell'algoritmo
let originalS = new Node(); // Albero S originale
let originalT = new Node(); // Albero T originale
let L = []; // Lista dei collegamenti tra i nodi

const get_linear_order = (V) => {
    // Se il nodo non ha figli, restituisce il suo valore come un array con un solo elemento
    if (V.children.length === 0)return [V.value];
    let linearOrder = [];
    for (let child of V.children)linearOrder = linearOrder.concat(get_linear_order(child));
    return linearOrder;
}

const crossings_on_node = (tau_orders, tau_indexes, sigma_pos) => {
    // Calcola il numero di intersezioni sul nodo in sigma_pos su albero S
    //tau_indexes é la lista degli indici di tau connessi al nodo in sigma_pos
    if (tau_indexes.length == 0)return 0;
    let crossings = 0;
    for (let k = 0; k < tau_indexes.length; k++) {
        tau_index = tau_indexes[k];
        for (let i = 0; i < tau_orders.length; i++) {
            temp_array = Array.from(tau_orders[i]);
            for(let j = 0; j < temp_array.length; j++){
                if ((temp_array[j] > sigma_pos && i < tau_index) || (temp_array[j] < sigma_pos && i > tau_index))
                    crossings += 1;
            }
        }
    };
    return crossings;
}

const n_crossings = (sigma, tau_orders) => {
    // Calcola il numero totale di intersezioni dato un ordine lineare
    let totalCrossings = 0;
    // Itera su ogni elemento in sigma
    for (let i = 0; i < sigma.length; i++) {
        // Calcola il numero di intersezioni per l'elemento corrente
        indexes_of_taus_connected_on_sigmai = [];
        tau_orders.forEach((el, index) => {
            // Verifica se l'insieme el contiene l'elemento i
            if (el.has(i))indexes_of_taus_connected_on_sigmai.push(index);
        });

        let crossingsForElement = crossings_on_node(tau_orders, indexes_of_taus_connected_on_sigmai, i);
        // Aggiunge le intersezioni per l'elemento corrente al totale
        totalCrossings += crossingsForElement;
    }
    // Poiché ogni intersezione è contata due volte, divide il totale per 2
    return totalCrossings / 2;
}

const drawConnections = links => {
    // Disegna le connessioni tra i nodi foglia degli alberi S e T
    connectionsSVG.selectAll('*').remove();
    const lines = [];
    for ([sourceId, targetId] of Object.entries(links)) {
        nodes = document.querySelectorAll(`p.node-name`);
        const targetNode = Array.from(nodes).find(node => node.textContent.trim() === sourceId.split('_')[0]);
        const sourceNode = Array.from(nodes).find(node => node.textContent.trim() === targetId.split('_')[0]);

        // Verifica se entrambi sourceNode e targetNode sono definiti
        if (!sourceNode || !targetNode) {
            console.warn(`Node not found: sourceNode=${sourceNode}, targetNode=${targetNode}`);
            continue;
        }

        const [sourceRect, targetRect] = [sourceNode.getBoundingClientRect(), targetNode.getBoundingClientRect()];
        const containerRect = document.querySelector('#tree-container').getBoundingClientRect();
        const [x1, y1] = [sourceRect.left + sourceRect.width / 2 - containerRect.left, sourceRect.top + sourceRect.height / 2 - containerRect.top];
        const [x2, y2] = [targetRect.left + targetRect.width / 2 - containerRect.left, targetRect.top + targetRect.height / 2 - containerRect.top];
        lines.push({ x1, y1, x2, y2, sourceId, targetId });
        connectionsSVG.append('line').attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('x2', x2).attr('y2', y2);
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
    testo = document.getElementById('crossings').innerText;
    if (!testo.includes("Crossings:"))document.getElementById('crossings').innerText = `Crossings: ${tot_intersections} | ${testo}`;
    else {
        testo = testo.split("|")[1];
        document.getElementById('crossings').innerText = `Crossings: ${bestTrees[currentBestIndex].crossings} | ${testo}`;
    }
}

const isBetween = (value, min, max) => (
    // Verifica se un valore è compreso tra min e max
    value >= Math.min(min, max) && value <= Math.max(max, min)
);

const getLineIntersection = (line1, line2) => {
    // Calcola il punto di intersezione tra due linee
    const { x1: x1, y1: y1, x2: x2, y2: y2 } = line1;
    const { x1: x3, y1: y3, x2: x4, y2: y4 } = line2;

    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (denom === 0) return null; // Le linee sono parallele

    const intersectX = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / denom;
    const intersectY = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / denom;

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
        children: node.children.length > 0 ? node.children.map(convertToTreant) : undefined
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
                levelSeparation: window.innerHeight / (max_depth*10),
                siblingSeparation: window.innerWidth / (number_of_leafs*5),
                subTeeSeparation: window.innerWidth / (number_of_leafs*10),
                rootOrientation: 'NORTH',
                padding: window.innerHeight / 20,
                zoom: true
            },
            nodeStructure: convertToTreant(root)
        };

        // Crea una promessa per gestire il rendering dell'albero
        new Promise((resolve) => {
            const tree = new Treant(treeConfig);
            // Attende che il DOM venga aggiornato
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    resolve(tree);
                });
            });
        }).then(() => {
            // Disegna le connessioni dopo che l'albero è stato completamente renderizzato
            if (containerId === 'bestT') {
                drawConnections(links);
            }
        });
    };

    renderTreant();
    // Aggiunge un listener per l'evento di ridimensionamento con debouncing
    let resizeTimer;
    window.addEventListener('resize', () => {
        let progressBar = document.getElementById('progress-bar');
        if (progressBar.style.width === '100%'){
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(renderTreant, 250);
        }
    });
}

const groupTreesIntoBlock = () => {
    // Raggruppa gli alberi S e T in un unico contenitore
    const bestS = document.getElementById('bestS');
    const bestT = document.getElementById('bestT');
    const container = document.createElement('div');
    container.id = 'tree-container';
    container.appendChild(bestS);
    container.appendChild(bestT);
    document.body.appendChild(container);

    // Assicura che connectionsSVG sia ridimensionabile
    const svgContainer = document.createElement('div');
    svgContainer.className = 'svg-container';
    container.appendChild(svgContainer);
    connectionsSVG = d3.select(svgContainer).append('svg').attr('class', 'connections-svg');
}

const showNextBestTree = (n) => {
    // Mostra l'albero migliore successivo o precedente
    if (bestTrees.length === 0) {
        alert('No best trees found yet.');
        return;
    }
    currentBestIndex = (currentBestIndex + n + bestTrees.length) % bestTrees.length;
    const bestTree = bestTrees[currentBestIndex];
    const links = bestTree.links;
    let swappedT, swappedS;
    if (bestTree.swapped) {
        swappedS = printSwappednodes(bestTree.rootT, originalS);
        swappedT = printSwappednodes(bestTree.rootS, originalT);
    } else {
        swappedT = printSwappednodes(bestTree.rootT, originalT);
        swappedS = printSwappednodes(bestTree.rootS, originalS);
    }

    // Visualizza le informazioni sui nodi scambiati nel browser
    document.getElementById('swappedT').innerText = `Swapped Nodes in T: ${swappedT}`;
    document.getElementById('swappedS').innerText = `Swapped Nodes in S: ${swappedS}`;

    plot(bestTree.rootS, 'bestS', links);
    plot(bestTree.rootT, 'bestT', links);
    groupTreesIntoBlock();

    // Aggiorna le intersezioni con il tempo
    let testo = document.getElementById('crossings').innerText;
    if (!testo.includes("Time:")) {
        document.getElementById('crossings').innerText = `${testo} | Time: ${bestTree.time} ms`;
    } else {
        testo = testo.split("|")[0];
        document.getElementById('crossings').innerText = `${testo} | Time: ${bestTree.time} ms`;
    }
}

const compute_crossings = (v, tau_orders) => {
    // Calcola le intersezioni per un nodo binarizzato
    if (v.children.length == 0)return;
    if (v.children.length == 1)return compute_crossings(v.children[0], tau_orders);
    let [crossings, crossings_switched, ltau] = crossings_on_binary_cluster(v, tau_orders);
    let rtau = tau_orders.filter(x => !ltau.includes(x));
    if (crossings_switched < crossings) {
        v.switch_children(0, 1);
        [ltau, rtau] = [rtau, ltau];
    }
    compute_crossings(v.children[0], ltau);
    compute_crossings(v.children[1], rtau);
}

const binarize_tree = (root, seed, links) => {
    // Binarizza l'albero trasformando nodi con più di due figli
    normalize_leafs(root, links);
    binarize_tree_r(root, seed);
}

const binarize_tree_r = (root, seed) => {
    // Funzione ricorsiva per binarizzare l'albero
    let l = root.children.length;
    if (l > 2) {
        root.splitted = true;
        let q = Math.floor(Math.random(seed) * (l - 1));
        let [n1, n2] = [new Node(), new Node()];
        n1.set_children(root.children.slice(0, q + 1));
        n2.set_children(root.children.slice(q + 1));
        root.set_children([n1, n2]);
    }
    for (let c of root.children) binarize_tree_r(c, seed);
}

const create_random_tree = (root, depth, max_children) => {
    // Crea un albero casuale dato una profondità e un numero massimo di figli
    if (depth == 0) {
        root.value = `${test++}`;
        Node.set_id_counter(root);
        return;
    }
    let new_children = [];
    let n_children = Math.floor(Math.random() * max_children) + 1;
    for (let i = 0; i < n_children; i++) {
        let n = new Node();
        create_random_tree(n, depth - 1, max_children);
        new_children.push(n);
    }
    root.set_children(new_children);
};

const create_tree = (root, lista) => {
    // Crea un albero a partire da una struttura annidata
    if (typeof lista === 'string') {
        root.value = lista;
        Node.set_id_counter(root);
        return;
    }
    let new_children = [];
    for (let c of lista) {
        let n = new Node();
        create_tree(n, c);
        new_children.push(n);
    }
    root.set_children(new_children);
}

// Funzione per calcolare la deviazione standard per l'euristica
function set_standard_dev(root, tau, tau_orders) {
    root.standard_dev = 0;
    if (root.children.length === 0) {
        const ind = tau.indexOf(root.value);
        for (let i = 0; i < tau_orders[ind].length; i++) 
            root.standard_dev += tau_orders[ind][i]/tau_orders.length - ind/tau.length;
        root.standard_dev /= tau_orders[ind].length;
    } else {
        root.children.forEach(c => {
            set_standard_dev(c, tau, tau_orders);
            root.standard_dev += c.standard_dev;
        });
        root.standard_dev /= root.children.length;
    }
}

// Funzione per scambiare i figli dei nodi basandosi sulla deviazione standard
function randomly_swap_children(root) {
    if (root.children.length > 0) {
        // Regola le posizioni dei figli in base alla deviazione standard
        root.children.forEach((child, i) => {
            root.children.splice(i, 1);
            if (child.standard_dev < 0) {
                const newIndex = Math.max(0, i + Math.floor(child.standard_dev*root.children.length));
                root.children.splice(newIndex, 0, child);
            }else{
                const newIndex = Math.min(root.children.length - 1, i + Math.floor(child.standard_dev*root.children.length));
                root.children.splice(newIndex, 0, child);
            }
        });
        // Applica ricorsivamente ai figli
        root.children.forEach(child => randomly_swap_children(child));
    }
}

const set_links = (rootS, rootT, L) => {
    // Imposta i collegamenti tra i nodi foglia degli alberi S e T
    let s_links = {}, t_links = {};

    for (let n of get_linear_order(rootS)) s_links[n] = 0;
    for (let n of get_linear_order(rootT)) t_links[n] = 0;
    let links = {};
    for (let link of L) {
        let node_name_T = `${link[1]}_${t_links[link[1]]}`;
        let node_name_S = `${link[0]}_${s_links[link[0]]}`;
        links[node_name_S] = node_name_T;
        s_links[link[0]] += 1;
        t_links[link[1]] += 1;
    }
    return [links, s_links, t_links];
}

const normalize_leafs = (root, links) => {
    // Normalizza i nodi foglia per gestire nodi con collegamenti multipli
    if (root.value === null) {
        for (let c of root.children) normalize_leafs(c, links);
    } else {
        let new_children = [];
        for (let i = 0; i < links[root.value]; i++) {
            let new_node = new Node(`${root.value}_${i}`);
            new_children.push(new_node);
        }
        if (new_children.length <= 1) {
            root.value = `${root.value}_0`;
            Node.set_id_counter(root);
        } else {
            root.splitted = true;
            root.value = null;
            Node.set_id_counter(root);
            root.set_children(new_children);
        }
    }
}

const get_tau_indexes = (rT, sigma, links) => {
    // Ottiene gli indici di tau per la valutazione delle intersezioni
    let tau = get_linear_order(rT);
    let tau_order = new Array();

    // Verifica se sigma[0] contiene il carattere '_'
    if (sigma[0].includes('_') && tau[0].includes('_')) {
        tau_order = new Array(tau.length).fill(-1);
        sigma.forEach((s, i) => {
            if (links[s]) {
                let node_name_T = links[s];
                tau_order[tau.indexOf(node_name_T)] = i;
            }
        });
    }else{
        tau.forEach(() => tau_order.push(new Set()));
        sigma.forEach((s, i) => {
            // Trova tutti i collegamenti che hanno chiavi che iniziano come s
            for (let k in links) {
                let node_name_T = links[k];
                if (k === s) {
                    index = tau.indexOf(node_name_T);
                    tau_order[index].add(i);
                }else if(k !== s && k.split('_')[0] === s.split('_')[0]){
                    index = tau.indexOf(node_name_T.split('_')[0]); 
                    tau_order[index].add(i);
                }
            }
        });
    }
    // Inverte tau_order in modo che il primo elemento sia l'ultimo
    return tau_order.reverse();
}

const set_ranges_on_tree = (root, order) => {
    // Imposta i limiti minimo e massimo per ogni nodo nell'albero
    if (root.children.length === 0) {
        root.min_bound = root.max_bound = order.indexOf(root.value);
    } else if (root.children.length === 1) {
        set_ranges_on_tree(root.children[0], order);
        root.max_bound = root.min_bound = root.children[0].max_bound
    } else {
        set_ranges_on_tree(root.children[0], order);
        set_ranges_on_tree(root.children[1], order);
        root.max_bound = root.children[1].max_bound;
        root.min_bound = root.children[0].min_bound;
    }
}

const get_depth = root => (
    // Calcola la profondità dell'albero
    root.children.length === 0 ? 1 : 1 + get_depth(root.children[0])
);

const remove_single_child = (root, max_depth) => {
    // Rimuove nodi con un solo figlio che superano la profondità massima
    if (root.children.length === 1 && root.children[0].depth >= max_depth) {
        let child = root.children[0];
        root.value = child.value;
        root.standard_dev = child.standard_dev;
        root.id = child.id;
        root.splitted = child.splitted;
        root.set_children(child.children);
    }
    root.children.forEach(child => remove_single_child(child, max_depth));
}

const de_binarize_tree_r = root => {
    // Funzione ricorsiva per de-binarizzare l'albero
    root.children.forEach(child => de_binarize_tree(child));
    if (root.children.length === 0) {
        root.value = root.value.split('_')[0];
        Node.set_id_counter(root);
    }
    if (root.splitted) {
        let temp_c = [];
        if (root.children[0].children.length > 0) temp_c.push(...root.children[0].children);
        else temp_c.push(root.children[0]);
        if (root.children[1].children.length > 0) temp_c.push(...root.children[1].children);
        else temp_c.push(root.children[1]);
        root.set_children(temp_c);
        root.splitted = false;
    }
}

const de_binarize_tree = root => {
    // De-binarizza l'albero riportandolo alla forma originale
    de_binarize_tree_r(root);
    assign_depth(root, 0);
    remove_single_child(root, max_depth);
}

const crossings_on_binary_cluster = (v, tau_orders) => {
    // Calcola le intersezioni in un cluster binario
    let r_bounds_min = v.children[1].min_bound;
    let r_bounds_max = v.children[1].max_bound;
    let l_bounds_min = v.children[0].min_bound;
    let l_bounds_max = v.children[0].max_bound;
    let possible_crossings = 0;
    let actual_crossings = 0;
    let possible_crossings_switched = 0;
    let actual_crossings_switched = 0;
    let ltau = [];

    for (let label of tau_orders) {
        if (label < 0) continue;
        if (label >= l_bounds_min && label <= l_bounds_max) {
            ltau.push(label);
            actual_crossings += possible_crossings;
            possible_crossings_switched += 1;
        } else if (label >= r_bounds_min && label <= r_bounds_max) {
            possible_crossings += 1;
            actual_crossings_switched += possible_crossings_switched;
        }
    }

    return [actual_crossings, actual_crossings_switched, ltau];
}

const cloneTree = node => {
    // Crea una copia profonda dell'albero
    let newNode = new Node(node.value);
    newNode.id = node.id;
    newNode.splitted = node.splitted;
    newNode.children = node.children.map(child => cloneTree(child));
    return newNode;
}

const assign_depth = (node, current_depth = 0) => {
    // Assegna la profondità a ogni nodo nell'albero
    if (node.children.length === 0 && node.value !== null) {
        node.depth = current_depth;
    } else {
        node.children.forEach(child => assign_depth(child, current_depth + 1));
    }
}

// Funzione euristica asincrona che aggiorna la barra di progresso durante l'esecuzione
const heuristic = (rootS, rootT, s_l, t_l, link) => {
    let depth = parseInt(document.getElementById('depth').value);
    let heuristic_d = parseInt(document.getElementById('heuristic_d').value);
    let random_d = parseInt(document.getElementById('random_d').value);
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
            if (cur_ind % 10 === 0) {
                console.log('ok');
                updateProgressBar((c_ind / (p_ind + depth)) * 100);
            }
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

// Funzione per aggiornare la barra di progresso
const updateProgressBar = (percentage) => {
    const progressBar = document.getElementById('progress-bar');
    progressBar.style.width = `${percentage}%`;
    if (percentage === 100) {
        showNextBestTree(0);
        groupTreesIntoBlock();
    }
}

const printSwappednodes = (Broot, Oroot) => {
    // Stampa i nodi scambiati tra l'albero originale e quello ottimizzato
    // Mapping from node ids to their positions in Broot
    const Broot_id_to_index = {};
    res = '';
    Broot.children.forEach((child, index) => {
        Broot_id_to_index[child.id] = index;
    });
    Oroot.children.forEach((Ochild, O_index) => {
        const B_index = Broot_id_to_index[Ochild.id];
        if (B_index !== O_index) {
            if (!res.includes(`${Broot.children[B_index].id};${Broot.children[O_index].id}`))
                res += `${Broot.children[O_index].id};${Broot.children[B_index].id} || `;
        }
        // Recursively check the children
        res += printSwappednodes(Broot.children[B_index], Ochild);
    });
    return res
}

// Funzione per iniziare la visualizzazione e attendere il completamento dell'euristica
const startVisualization = (new_run) => {
    // Inizializza variabili e pulisce lo schermo
    bestTrees = [];
    updateProgressBar(0);
    console.clear();
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
    test = 0;
    if(new_run){
        // Se è una nuova esecuzione, crea alberi casuali e collegamenti
        let m_c = parseInt(document.getElementById('max_children').value); // Numero massimo di figli
        let td = parseInt(document.getElementById('tree_depth').value); // Profondità dell'albero
        let n_connections = parseInt(document.getElementById('n_connections').value); // Numero di collegamenti
        console.log('new run');
        create_random_tree(rootS, depth = td-1, max_children = m_c); // Crea l'albero S casuale
        create_random_tree(rootT, depth = td-1, max_children = m_c); // Crea l'albero T casuale
        L = [];
        create_random_links(rootS, rootT, max_links = n_connections); // Crea collegamenti casuali
        originalS = cloneTree(rootS); // Clona l'albero S originale
        originalT = cloneTree(rootT); // Clona l'albero T originale
    } else {
        // Se si sta rielaborando, clona gli alberi originali
        console.log('rerunning..');
        rootS = cloneTree(originalS);
        rootT = cloneTree(originalT);
    }
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
    console.log('not blocked in heuristic');
    updateProgressBar(100);
}

// Funzione per creare collegamenti casuali tra i nodi foglia di S e T
const create_random_links = (rootS, rootT, max_links) => {
    const sNodes = get_linear_order(rootS);
    const tNodes = get_linear_order(rootT);
    already_seen = new Set();
    // Usa la funzione per ottenere il minimo di due valori
    while (L.length < Math.min(max_links, sNodes.length*tNodes.length/2)) {
        const sNode = sNodes[Math.floor(Math.random() * sNodes.length)];
        const tNode = tNodes[Math.floor(Math.random() * tNodes.length)];
        if (already_seen.has(`${sNode}${tNode}`)) continue;
        L.push([sNode, tNode]);
        already_seen.add(`${sNode}${tNode}`);
    }
};