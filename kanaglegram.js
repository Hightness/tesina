class Node {
    static id_counter = 0;
    static set_id_counter(node) {
        node.id = node.value === null ? Node.id_counter++ : node.value;
    }
    constructor(value = null) {
        this.value = value;
        this.children = [];
        Object.defineProperty(this, 'parent', { value: null, writable: true, enumerable: false });
        Node.set_id_counter(this);
        this.splitted = false;
        this.standard_dev = 0; // Add standard_dev property
    }
    switch_children(i1, i2) {
        [this.children[i1], this.children[i2]] = [this.children[i2], this.children[i1]];
    }
    set_children(new_children) {
        const final_c = [], already_seen = new Set();
        for (let c of new_children) {
            if (c.value === null || !already_seen.has(c.value)) {
                c.parent = this;
                final_c.push(c);
                if (c.value !== null) already_seen.add(c.value);
            }
        }
        this.children = final_c;
    }
}

max_depth = 0;
initial_crossings = 0;
let bestTrees = [];
let currentBestIndex = 0;
let connectionsSVG;
let startTime; // Initialize start time
let originalS = new Node();
let originalT = new Node();
const get_linear_order = V => typeof V === 'string' ? [V] : V instanceof Node ? V.children.length === 0 ? [V.value] : V.children.flatMap(get_linear_order) : V.flatMap(get_linear_order);

const n_crossings = (sigma, tau_orders) => sigma.reduce((incroci, _, i) => incroci + crossings_on_node(tau_orders, i), 0) / 2;

const drawConnections = links => {
    connectionsSVG.selectAll('*').remove();
    const lines = [];
    for ([sourceId, targetId] of Object.entries(links)) {
        nodes = document.querySelectorAll(`p.node-name`);
        const targetNode = Array.from(nodes).find(node => node.textContent.trim() === sourceId.split('_')[0]);
        const sourceNode = Array.from(nodes).find(node => node.textContent.trim() === targetId.split('_')[0]);

        // Check if both sourceNode and targetNode are defined
        if (!sourceNode || !targetNode) {
            console.warn(`Node not found: sourceNode=${sourceNode}, targetNode=${targetNode}`);
            continue;
        }

        const [sourceRect, targetRect] = [sourceNode.getBoundingClientRect(), targetNode.getBoundingClientRect()];
        const containerRect = document.querySelector('#tree-container').getBoundingClientRect();
        const [x1, y1] = [sourceRect.left + sourceRect.width / 2 - containerRect.left, sourceRect.top + sourceRect.height / 2 - containerRect.top];
        const [x2, y2] = [targetRect.left + targetRect.width / 2 - containerRect.left, targetRect.top + targetRect.height / 2 - containerRect.top];
        lines.push({ x1, y1, x2, y2, sourceId, targetId });
        connectionsSVG.append('line').attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2);
    }

    // Check for intersections and add red dots with numbers
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
    let tot_intersections = 0;
    for (let key in intersections) {
        tot_intersections += intersections[key].count === 1 ? 1 : intersections[key].count - 1;
    }

    Object.values(intersections).forEach(({ x, y, count }) => {
        connectionsSVG.append('circle').attr('cx', x).attr('cy', y);
        if(count - 1 > 1)connectionsSVG.append('text').attr('class', 'circle').attr('x', x).attr('y', y).attr('dy', -2).text(count - 1);
    });
    //get only the text with the Time, so split the string and get the second part
    testo = document.getElementById('crossings').innerText;
    if (!testo.includes("Crossings:"))document.getElementById('crossings').innerText = `Crossings: ${tot_intersections} | ${testo}`;
    else {
        testo = testo.split("|")[1];
        document.getElementById('crossings').innerText = `Crossings: ${tot_intersections} | ${testo}`;
    }
}

const isBetween = (value, min, max) => (value >= Math.min(min, max) && value <= Math.max(max, min));
const getLineIntersection = (line1, line2) => {
    const { x1: x1, y1: y1, x2: x2, y2: y2 } = line1;
    const { x1: x3, y1: y3, x2: x4, y2: y4 } = line2;

    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (denom === 0) return null; // Lines are parallel

    const intersectX = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / denom;
    const intersectY = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / denom;

    if (isBetween(intersectX, x1, x2) && isBetween(intersectX, x3, x4) &&
        isBetween(intersectY, y1, y2) && isBetween(intersectY, y3, y4)) {
        return { x: intersectX, y: intersectY };
    }
    return null;
}


const plot = (root, containerId, links) => {
    const convertToTreant = node => ({
        text: { name: node.id}, // Wrap node id in <p class="node-name">
        HTMLclass: node.children.length > 0 ? `internal-node` : `leaf-node`,
        attributes: { 'data-id': node.id },
        children: node.children.length > 0 ? node.children.map(convertToTreant) : undefined
    });

    // Function to render the Treant chart
    const renderTreant = () => {
        // Clear existing Treant charts
        document.querySelector(`#${containerId}`).innerHTML = '';

        // Recreate treeConfig with updated dimensions
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

        // Create a promise to handle tree rendering
        new Promise((resolve) => {
            const tree = new Treant(treeConfig);
            // Wait for DOM to be updated
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    resolve(tree);
                });
            });
        }).then(() => {
            // Draw connections after tree is fully rendered
            if (containerId === 'bestT') {
                drawConnections(links);
            }
        });
    };

    renderTreant();
    // Add resize event listener with debouncing
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(renderTreant, 250);
    });
}

const groupTreesIntoBlock = () => {
    const bestS = document.getElementById('bestS');
    const bestT = document.getElementById('bestT');
    const container = document.createElement('div');
    container.id = 'tree-container';
    container.appendChild(bestS);
    container.appendChild(bestT);
    document.body.appendChild(container);

    // Ensure connectionsSVG is resizable
    const svgContainer = document.createElement('div');
    svgContainer.className = 'svg-container';
    container.appendChild(svgContainer);
    connectionsSVG = d3.select(svgContainer).append('svg').attr('class', 'connections-svg');
}

const showNextBestTree = (n) => {
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

    // Display swapped nodes information in the browser
    document.getElementById('swappedT').innerText = `Swapped Nodes in T: ${swappedT}`;
    document.getElementById('swappedS').innerText = `Swapped Nodes in S: ${swappedS}`;

    plot(bestTree.rootS, 'bestS', links);
    plot(bestTree.rootT, 'bestT', links);
    groupTreesIntoBlock();

    // Update crossings with time
    let testo = document.getElementById('crossings').innerText;
    if (!testo.includes("Time:")) {
        document.getElementById('crossings').innerText = `${testo} | Time: ${bestTree.time} ms`;
    } else {
        testo = testo.split("|")[0];
        document.getElementById('crossings').innerText = `${testo} | Time: ${bestTree.time} ms`;
    }
}

const compute_crossings = (v, tau_orders) => {
    if (v.children.length <= 1)return;
    let [crossings, crossings_switched, ltau] = crossings_on_binary_cluster(v, tau_orders);
    let rtau = tau_orders.filter(x => !ltau.includes(x) && x !== -1);
    if (crossings_switched < crossings) {
        v.switch_children(0, 1);
        [ltau, rtau] = [rtau, ltau];
    }
    compute_crossings(v.children[0], ltau);
    compute_crossings(v.children[1], rtau);
}

const binarize_tree = (root, seed, links) => {
    normalize_leafs(root, links);
    binarize_tree_r(root, seed);
}

const binarize_tree_r = (root, seed) => {
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
test = 0
const create_random_tree = (root, depth, max_children) => {
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

function set_standard_dev(root, tau, tau_orders) {
    if (root.children.length === 0) {
        const ind = tau.indexOf(root.value);
        root.standard_dev = (tau_orders[ind]+1)/tau_orders.length - (ind+1)/tau.length;
    } else {
        root.children.forEach(c => set_standard_dev(c, tau, tau_orders));
        // Compute the average of children's standard_dev
        root.standard_dev = root.children.reduce((sum, c) => sum + c.standard_dev, 0) / root.children.length;
    }
}

function randomly_swap_children(root, tau, tau_orders) {
    if (root.children.length > 1) {
        // Adjust children's positions based on standard_dev
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
    }
    // Recursively apply to children
    root.children.forEach(child => randomly_swap_children(child, tau, tau_orders));
}

const set_links = (rootS, rootT, L) => {
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
    let tau = get_linear_order(rT);
    let tau_order = new Array(tau.length).fill(-1);
    sigma.forEach((s, i) => {
        if (links[s]) {
            let node_name_T = links[s];
            tau_order[tau.indexOf(node_name_T)] = i;
        }
    });
    //reverse tau_order so that first element is last
    return tau_order.reverse();
}

const set_ranges_on_tree = (root, order) => {
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

const get_depth = root => root.children.length === 0 ? 1 : 1 + get_depth(root.children[0]);

const remove_single_child = (root, max_depth) => {
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
    de_binarize_tree_r(root);
    assign_depth(root, 0);
    remove_single_child(root, max_depth);
}

const crossings_on_node = (tau_orders, n) => {
    if (!tau_orders.includes(n)) return 0;
    let j = tau_orders.indexOf(n);
    let crossings = 0;
    for (let i = 0; i < tau_orders.length; i++) {
        if (tau_orders[i] >= 0 && ((tau_orders[i] > n && i < j) || (tau_orders[i] < n && i > j))) crossings += 1;
    }
    return crossings;
}

const crossings_on_binary_cluster = (v, tau_orders) => {
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
    let newNode = new Node(node.value);
    newNode.id = node.id;
    newNode.splitted = node.splitted;
    newNode.children = node.children.map(child => cloneTree(child));
    return newNode;
}

const assign_depth = (node, current_depth = 0) => {
    if (node.children.length === 0 && node.value !== null) {
        node.depth = current_depth;
    } else {
        node.children.forEach(child => assign_depth(child, current_depth + 1));
    }
}

// Rendi la funzione heuristic asincrona e aggiorna la barra di progresso durante l'esecuzione
const heuristic = async (rootS, rootT, s_l, t_l, depth, heuristic_d, random_d, link) => {
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
            sigma = get_linear_order(rootS);
            tau_order = get_tau_indexes(rootT, sigma, link);
            let temp_nc = n_crossings(sigma, tau_order);
            link = Object.fromEntries(Object.entries(link).map(([k, v]) => [v, k]));
            if (temp_nc < best) {
                prev_ind = cur_ind;
                p_ind = c_ind;
                best = temp_nc;
                const elapsedTime = Date.now() - startTime; // Calcola il tempo trascorso
                const bestRootS = cloneTree(rootS);
                const bestRootT = cloneTree(rootT);
                de_binarize_tree(bestRootS);
                de_binarize_tree(bestRootT);
                bestTrees.push({swapped:swapped, rootS: bestRootS, rootT: bestRootT, links: link, time: elapsedTime });
            }
            [s_l, t_l] = [t_l, s_l];
            [rootS, rootT] = [rootT, rootS];
            swapped = !swapped;
            updateProgressBar((c_ind / (p_ind + depth)) * 100);

            // Cede il controllo per aggiornare la UI ogni tot iterazioni
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        const sigma = get_linear_order(rootS);
        const tau = get_linear_order(rootT);
        const tau_order = get_tau_indexes(rootT, sigma, link);
        set_standard_dev(rootT, tau, tau_order); // Call set_standard_dev

        de_binarize_tree(rootS);
        de_binarize_tree(rootT);

        if (++rand_call === random_d) {
            randomly_swap_children(rootT, tau, tau_order); // Pass tau and tau_orders
            rand_call = 0;
        }
    }
}

const main = (rootS, rootT, L) => {
    max_depth = get_depth(rootS);
    [links, s_links, t_links] = set_links(rootS, rootT, L);
    bestTrees.push({swapped:false, rootS: cloneTree(rootS), rootT: cloneTree(rootT), links: links , time:0});
    groupTreesIntoBlock();
    plot(rootS, 'bestS', links);
    plot(rootT, 'bestT', links);
    return [rootS, rootT, s_links, t_links, links, initial_crossings];
}
// Funzione per aggiornare la barra di progresso
const updateProgressBar = (percentage) => {
    const progressBar = document.getElementById('progress-bar');
    progressBar.style.width = `${percentage}%`;
}

const printSwappednodes = (Broot, Oroot) => {
    // Mapping from node ids to their positions in Broot
    const Broot_id_to_index = {};
    res = '';
    Broot.children.forEach((child, index) => {
        Broot_id_to_index[child.id] = index;
    });
    Oroot.children.forEach((Ochild, O_index) => {
        const B_index = Broot_id_to_index[Ochild.id];
        if (B_index !== O_index) {
            if (!res.includes(`${Broot.children[B_index].id},${Broot.children[O_index].id}`))
                res += `${Broot.children[O_index].id},${Broot.children[B_index].id} || `;
        }
        // Recursively check the children
        res += printSwappednodes(Broot.children[B_index], Ochild);
    });
    return res
}

// Modifica la funzione startVisualization per attendere il completamento dell'euristica
const startVisualization = async () => {
    bestTrees = [];
    document.getElementById('swappedT').innerText = `Swapped Nodes in T: `;
    document.getElementById('swappedS').innerText = `Swapped Nodes in S: `;
        document.getElementById('crossings').innerText = `Crossings: | Time: 0 ms`;
    currentBestIndex = 0;
    Node.id_counter = 0;
    let depth = parseInt(document.getElementById('depth').value);
    let heuristic_d = parseInt(document.getElementById('heuristic_d').value);
    let random_d = parseInt(document.getElementById('random_d').value);
    startTime = Date.now(); // Record the start time
    let rootS = new Node();
    let rootT = new Node();
    test = 0
    create_random_tree(rootS, depth = 4, max_children = 4);
    create_random_tree(rootT, depth = 4, max_children = 4);
    L = create_random_links(rootS, rootT, max_links = 15);
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
    //create_tree(rootS, S);
    //create_tree(rootT, T);
    originalS = cloneTree(rootS);
    originalT = cloneTree(rootT);
    [rootS, rootT, s_links, t_links, links] = main(rootS, rootT, L);
    await heuristic(rootS, rootT, s_links, t_links, depth, heuristic_d, random_d, links);
    //groupTreesIntoBlock();
    // Resetta la barra di progresso al termine
    updateProgressBar(100);
}

const create_random_links = (rootS, rootT, max_links) => {
    const sNodes = get_linear_order(rootS);
    const tNodes = get_linear_order(rootT);
    const links = [];
    already_seen = new Set();
    //use function to get min of two values
    while (links.length < Math.min(max_links, sNodes.length*tNodes.length/2)) {
        const sNode = sNodes[Math.floor(Math.random() * sNodes.length)];
        const tNode = tNodes[Math.floor(Math.random() * tNodes.length)];
        if (already_seen.has(`${sNode}${tNode}`)) continue;
        links.push([sNode, tNode]);
        already_seen.add(`${sNode}${tNode}`);
    }
    return links;
};