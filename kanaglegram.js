max_depth = 0;
initial_crossings = 0;
let bestTrees = [];
let currentBestIndex = 0;
let connectionsSVG;
let startTime; // Initialize start time

class Node {
    static id_counter = 0;
    static set_id_counter(node) {
        node.id = node.value === null ? `(${Node.id_counter++})` : node.value;
    }
    constructor(value = null) {
        this.value = value;
        this.children = [];
        Object.defineProperty(this, 'parent', { value: null, writable: true, enumerable: false });
        Node.set_id_counter(this);
        this.splitted = false;
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

const get_linear_order = V => typeof V === 'string' ? [V] : V instanceof Node ? V.children.length === 0 ? [V.value] : V.children.flatMap(get_linear_order) : V.flatMap(get_linear_order);

const n_crossings = (sigma, tau_orders) => sigma.reduce((incroci, _, i) => incroci + crossings_on_node(tau_orders, i), 0) / 2;

const drawConnections = links => {
    connectionsSVG.selectAll('*').remove();
    const lines = [];
    for ([sourceId, targetId] of Object.entries(links)) {
        nodes = document.querySelectorAll(`p.node-name`);
        const targetNode = Array.from(nodes).find(node => node.textContent.trim() === sourceId.split('_')[0]);
        const sourceNode = Array.from(nodes).find(node => node.textContent.trim() === targetId.split('_')[0]);
        const [sourceRect, targetRect] = [sourceNode.getBoundingClientRect(), targetNode.getBoundingClientRect()];
        const containerRect = document.querySelector('#tree-container').getBoundingClientRect();
        const [x1, y1] = [sourceRect.left + sourceRect.width / 2 - containerRect.left, sourceRect.top + sourceRect.height / 2 - containerRect.top];
        const [x2, y2] = [targetRect.left + targetRect.width / 2 - containerRect.left, targetRect.top + targetRect.height / 2 - containerRect.top];
        lines.push({ x1, y1, x2, y2, sourceId, targetId });
        connectionsSVG.append('line').attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2);
    }

    // Check for intersections and add red dots with numbers
    const intersections = {};
    let tot_intersections = 0;
    for (let i = 0; i < lines.length; i++) {
        for (let j = i + 1; j < lines.length; j++) {
            const intersection = getLineIntersection(lines[i], lines[j]);
            if (intersection && lines[i].sourceId.split('_')[0] != lines[j].sourceId.split('_')[0] && lines[i].targetId.split('_')[0] != lines[j].targetId.split('_')[0]) {
                [x_rounded, y_rounded] = [Math.round(intersection.x * 10) / 10, Math.round(intersection.y * 10) / 10];
                const key = `${x_rounded},${y_rounded}`;
                if (intersections[key] === undefined)intersections[key] = {count: 0, x: intersection.x, y: intersection.y };
                intersections[key].count += 1;
                tot_intersections += 1;
            }
        }
    }

    Object.values(intersections).forEach(({ x, y, count }) => {
        connectionsSVG.append('circle').attr('cx', x).attr('cy', y);
        if(count - 1 > 1)connectionsSVG.append('text').attr('class', 'circle').attr('x', x).attr('y', y).attr('dy', -2).text(count);
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
        text: { name: node.value !== null ? node.value : '' },
        HTMLclass: node.children.length > 0 ? `internal-node` : `leaf-node`,
        attributes: { 'data-id': node.id },
        children: node.children.length > 0 ? node.children.map(convertToTreant) : undefined
    });

    // Function to render the Treant chart
    const renderTreant = () => {
        // Clear existing Treant charts
        document.querySelector(`#${containerId}`).innerHTML = '';

        // Recreate treeConfig with updated dimensions
        const treeConfig = {
            chart: {
                container: `#${containerId}`,
                connectors: { type: 'curve' },
                node: { HTMLclass: containerId === 'bestT' ? 'flipped' : '' },
                levelSeparation: window.innerHeight / 25,
                siblingSeparation: window.innerWidth / 30,
                subTeeSeparation: window.innerWidth / 30,
                rootOrientation: 'NORTH',
                padding: window.innerHeight / 10,
                zoom: true
            },
            nodeStructure: convertToTreant(root)
        };
        new Treant(treeConfig);

        if (containerId === 'bestT') {
            setTimeout(() => drawConnections(links), 500);
        }
    };

    renderTreant();
    // Add resize event listener
    window.addEventListener('resize', renderTreant);
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
    de_binarize_tree(bestTree.rootS);
    de_binarize_tree(bestTree.rootT);
    plot(bestTree.rootS, 'bestS', links);
    plot(bestTree.rootT, 'bestT', links);
    groupTreesIntoBlock();

    // Update crossings with time
    testo = document.getElementById('crossings').innerText;
    if(!testo.includes("Time:"))document.getElementById('crossings').innerText = `${testo} | Time: ${bestTree.time} ms`;
    else {
        testo = testo.split("|")[0];
        document.getElementById('crossings').innerText = `${testo} |Time: ${bestTree.time} ms`;
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

const randomly_swap_children = root => {
    if (root.children.length > 1) {
        // Shuffle the children array
        root.children.sort(() => Math.random() - 0.5);
    }
    // Recursively apply to children
    root.children.forEach(child => randomly_swap_children(child));
}

const set_links = (S, T, L) => {
    let s_links = {}, t_links = {};
    for (let n of get_linear_order(S)) s_links[n] = 0;
    for (let n of get_linear_order(T)) t_links[n] = 0;
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

const heuristic = (rootS, rootT, s_l, t_l, depth, heuristic_d, random_d, link, best) => {
    let bestRootS, bestRootT, rand_call = 0;
    for (let i = 0; i < depth; i++) {
        if (best === 0) break;
        binarize_tree(rootS, i, s_l);
        binarize_tree(rootT, i, t_l);
        for (let j = 0; j < heuristic_d; j++) {
            let sigma = get_linear_order(rootS);
            let tau_order = get_tau_indexes(rootT, sigma, link);
            set_ranges_on_tree(rootS, sigma);
            compute_crossings(rootS, tau_order);
            sigma = get_linear_order(rootS);
            tau_order = get_tau_indexes(rootT, sigma, link);
            let temp_nc = n_crossings(sigma, tau_order);
            link = Object.fromEntries(Object.entries(link).map(([k, v]) => [v, k]));
            if (temp_nc < best) {
                best = temp_nc;
                const elapsedTime = Date.now() - startTime; // Calculate elapsed time
                [bestRootS ,bestRootT] = [cloneTree(rootS), cloneTree(rootT)];
                bestTrees.push({ rootS: bestRootS, rootT: bestRootT, crossings: best, links: link, time: elapsedTime});
            }
            [s_l, t_l] = [t_l, s_l];
            [rootS, rootT] = [rootT, rootS];
        }
        de_binarize_tree(rootS);
        de_binarize_tree(rootT);
        if (++rand_call === random_d) {
            randomly_swap_children(rootS);
            randomly_swap_children(rootT);
            rand_call = 0;
        }
    }
}

const main = (S, T, L) => {
    startTime = Date.now(); // Record the start time
    [links, s_links, t_links] = set_links(S, T, L);
    let rootS = new Node();
    let rootT = new Node();
    create_tree(rootS, S);
    create_tree(rootT, T);
    max_depth = get_depth(rootS);
    binarize_tree(rootS, 0, s_links);
    binarize_tree(rootT, 0, t_links);

    sigma = get_linear_order(rootS);
    tau_order = get_tau_indexes(rootT, sigma, links);

    let initial_crossings = n_crossings(sigma, tau_order);
    bestTrees.push({ rootS: cloneTree(rootS), rootT: cloneTree(rootT), crossings: initial_crossings, links: links , time:0});

    de_binarize_tree(rootS);
    de_binarize_tree(rootT);

    plot(rootS, 'bestS', links);
    plot(rootT, 'bestT', links);
    return [rootS, rootT, s_links, t_links, links, initial_crossings];
}

const startVisualization = () => {
    bestTrees = [];
    currentBestIndex = 0;
    Node.id_counter = 0;
    let depth = parseInt(document.getElementById('depth').value);
    let heuristic_d = parseInt(document.getElementById('heuristic_d').value);
    let random_d = parseInt(document.getElementById('random_d').value);
    [rootS, rootT, s_links, t_links, links, initial_crossings] = main(
        [[["t0", "t1", "t2", "t3"], ["t4", "t5", "t6"]],
         [["t7"]],
         [["t8", "t9"], ["t10", "t11"], ["t12"]],
         [["t13", "t14"]],
         [["t15", "t16"]]],
        [[["b0"]],
         [["b1", "b2"], ["b3", "b4", "b5"], ["b6"]],
         [["b7", "b8"]],
         [["b9", "b10"], ["b11", "b12"], ["b13", "b14"]]],
        [["t0", "b0"], ["t0", "b1"], ["t0", "b2"],
         ["t1", "b1"], ["t1", "b2"], ["t2", "b1"],
         ["t2", "b2"], ["t2", "b6"], ["t3", "b1"],
         ["t3", "b2"], ["t3", "b6"], ["t4", "b5"],
         ["t5", "b4"], ["t5", "b1"], ["t6", "b0"],
         ["t7", "b0"], ["t8", "b11"], ["t8", "b12"],
         ["t10", "b9"], ["t11", "b9"], ["t13", "b6"],
         ["t14", "b6"], ["t15", "b7"], ["t16", "b8"]]
    );

    // [rootS, rootT, s_links, t_links, links, initial_crossings] = main([[['a', 'b'], ['c']], [['d', 'e'], ['f', 'g']]], [[['1', '2'], ['3']], [['4', '5'], ['6', '7']]], [['a', '6'], ['b', '2'], ['f', '3'], ['d', '5'], ['f', '5'], ['f', '6'], ['g', '7']],)
    heuristic(rootS, rootT, s_links, t_links, depth, heuristic_d, random_d, links, initial_crossings);
    groupTreesIntoBlock();
}

document.addEventListener('DOMContentLoaded', () => {
    connectionsSVG = d3.select('.connections-svg')
        .attr('width', '100%')
        .attr('height', '100%');
    startVisualization();
    document.getElementById('crossings').innerText = `Time: 0 ms`;
});