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

function get_linear_order(V) {
    if (typeof V === 'string') return [V];
    if (V instanceof Node) return V.children.length === 0 ? [V.value] : V.children.flatMap(get_linear_order);
    return V.flatMap(get_linear_order);
}

function n_crossings(sigma, tau_orders) {
    return sigma.reduce((incroci, _, i) => incroci + crossings_on_node(tau_orders, i), 0) / 2;
}

// Modify the plot function to calculate levelSeparation based on tree depth
function plot(root, containerId) {
    const convertToTreant = node => ({
        text: { name: node.value || node.id },
        HTMLclass: node.children.length === 0 ? `leaf-node depth-${node.depth}` : '',
        attributes: { 'data-id': node.value || node.id },
        children: node.children.length > 0 ? node.children.map(convertToTreant) : undefined
    });

    const treeConfig = {
        chart: {
            container: `#${containerId}`,
            connectors: { type: 'straight' }, // Changed from 'curve' to 'straight'
            node: { HTMLclass: containerId === 'bestT' ? 'flipped' : '' },
            levelSeparation: 50,          // Reduced from 100
            siblingSeparation: 25,        // Reduced from 50
            subTeeSeparation: 25,         // Reduced from 50
            rootOrientation: 'NORTH'
        },
        nodeStructure: convertToTreant(root)
    };
    new Treant(treeConfig);
}

// Function to compute crossings in the tree
function compute_crossings(v, tau_orders) {
    if (v.children.length <= 1) return;
    let [crossings, crossings_switched, ltau] = crossings_on_binary_cluster(v, tau_orders);
    let rtau = tau_orders.filter(x => !ltau.includes(x) && x !== -1);
    if (crossings_switched < crossings) {
        v.switch_children(0, 1);
        [ltau, rtau] = [rtau, ltau];
    }
    compute_crossings(v.children[0], ltau);
    compute_crossings(v.children[1], rtau);
}

// Function to binarize the tree
function binarize_tree(root, seed) {
    let l = root.children.length;
    if (l > 2) {
        root.splitted = true;
        let q = Math.floor(Math.random() * (l - 1));
        let n1 = new Node();
        let n2 = new Node();
        n1.set_children(root.children.slice(0, q + 1));
        n2.set_children(root.children.slice(q + 1));
        root.set_children([n1, n2]);
    }
    for (let c of root.children) binarize_tree(c, seed);
}

// Function to create a tree from a list
function create_tree(root, lista) {
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

// Function to randomly swap child nodes
function randomly_swap_children(root) {
    if (root.children.length > 1) root.children.sort(() => Math.random() - 0.5);
    for (let child of root.children) randomly_swap_children(child);
}

// Sets links
function set_links(S, T, L) {
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

// Function to normalize leaf nodes
function normalize_leafs(root, links) {
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

// Function to get tau indexes
function get_tau_indexes(rT, sigma, links) {
    let tau = get_linear_order(rT);
    let tau_order = new Array(tau.length).fill(-1);
    sigma.forEach((s, i) => {
        if (links[s]) {
            let node_name_T = links[s];
            tau_order[tau.indexOf(node_name_T)] = i;
        }
    });
    return tau_order;
}

// Function to set ranges on the tree
function set_ranges_on_tree(root, order) {
    if (root.children.length === 0) {
        root.min_bound = root.max_bound = order.indexOf(root.value);
    } else {
        set_ranges_on_tree(root.children[0], order);
        set_ranges_on_tree(root.children[root.children.length - 1], order);
        root.max_bound = root.children[root.children.length - 1].max_bound;
        root.min_bound = root.children[0].min_bound;
    }
}
function get_depth(root) {
    if (root.children.length === 0) return 1;
    return 1 + get_depth(root.children[0]);
}

// Function to remove single child nodes
function remove_single_child(root, max_depth) {
    if (root.children.length === 1 && root.children[0].depth >= max_depth) {
        let child = root.children[0];
        root.value = child.value;
        root.id = child.id;
        root.splitted = child.splitted;
        root.set_children(child.children);
    }
    root.children.forEach(child => remove_single_child(child, max_depth));
}

// Function to de-binarize the tree
function de_binarize_tree_r(root) {
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
function de_binarize_tree(root) {
    de_binarize_tree_r(root);
    assign_depth(root, 0);
    remove_single_child(root, max_depth);
}

// Function to count crossings on a node
function crossings_on_node(tau_orders, n) {
    if (!tau_orders.includes(n)) return 0;
    let j = tau_orders.indexOf(n);
    let crossings = 0;
    for (let i = 0; i < tau_orders.length; i++) {
        if (tau_orders[i] >= 0 && ((tau_orders[i] > n && i < j) || (tau_orders[i] < n && i > j))) crossings += 1;
    }
    return crossings;
}

// Function to count crossings on a binary cluster
function crossings_on_binary_cluster(v, tau_orders) {
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

// Function to deep clone a tree without the 'parent' property
function cloneTree(node) {
    let newNode = new Node(node.value);
    newNode.id = node.id;
    newNode.splitted = node.splitted;
    newNode.children = node.children.map(child => cloneTree(child));
    return newNode;
}

let bestTrees = [];
let currentBestIndex = 0;

// Add a function to assign depth to leaf nodes
function assign_depth(node, current_depth = 0) {
    if (node.children.length === 0 && node.value !== null) {
        node.depth = current_depth;
    } else {
        node.children.forEach(child => assign_depth(child, current_depth + 1));
    }
}

// Ensure pad_tree is called after tree manipulations to align all leaves
function heuristic(rootS, rootT, s_l, t_l, depth, heuristic_d, random_d, link, best) {
    let bestRootS, bestRootT, rand_call = 0;
    for (let i = 0; i < depth; i++) {
        if (best === 0) break;
        normalize_leafs(rootS, s_l);
        normalize_leafs(rootT, t_l);
        binarize_tree(rootS, i);
        binarize_tree(rootT, i);
        for (let j = 0; j < heuristic_d; j++) {
            let sigma = get_linear_order(rootS), tau_order = get_tau_indexes(rootT, sigma, link);
            set_ranges_on_tree(rootS, sigma);
            compute_crossings(rootS, tau_order);
            let temp_nc = n_crossings(sigma, tau_order);
            link = Object.fromEntries(Object.entries(link).map(([k, v]) => [v, k]));
            [s_l, t_l] = [t_l, s_l];
            [rootS, rootT] = [rootT, rootS];
            if (temp_nc < best) {
                best = temp_nc;
                bestRootS = cloneTree(rootS);
                bestRootT = cloneTree(rootT);
                bestTrees.push({ rootS: bestRootS, rootT: bestRootT, crossings: best });
            }
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

// Modify the showNextBestTree function to pad trees before plotting
function showNextBestTree() {
    if (bestTrees.length === 0) {
        alert('No best trees found yet.');
        return;
    }
    currentBestIndex = (currentBestIndex + 1) % bestTrees.length;
    const bestTree = bestTrees[currentBestIndex];
    
    // Apply de-binarizing and remove single children before padding
    de_binarize_tree(bestTree.rootS);
    de_binarize_tree(bestTree.rootT);
    
    // Plot the padded trees
    plot(bestTree.rootS, 'bestS');
    plot(bestTree.rootT, 'bestT');
    document.getElementById('crossings').innerText = `Crossings: ${bestTree.crossings}`;
}
max_depth = 0;

// Main function to execute the program
function main(S, T, L, depth, heuristic_d, random_d) {
    let [link, s_l, t_l] = set_links(S, T, L);
    let rootS = new Node();
    let rootT = new Node();
    create_tree(rootS, S);
    create_tree(rootT, T);
    max_depth = get_depth(rootS);
    normalize_leafs(rootS, s_l);
    normalize_leafs(rootT, t_l);
    binarize_tree(rootS, 0);
    binarize_tree(rootT, 0);

    
    initial_crossings = n_crossings(get_linear_order(rootS), get_tau_indexes(rootT, get_linear_order(rootS), link));
    bestTrees.push({ rootS: rootS, rootT: rootT, crossings: initial_crossings});

    de_binarize_tree(rootS);
    de_binarize_tree(rootT);

    plot(rootS, 'bestS');
    plot(rootT, 'bestT');
    document.getElementById('crossings').innerText = `Crossings: ${initial_crossings}`;

    heuristic(rootS, rootT, s_l, t_l, depth, heuristic_d, random_d, link, initial_crossings);
}

// Function to start the visualization
function startVisualization() {
    let depth = parseInt(document.getElementById('depth').value);
    let heuristic_d = parseInt(document.getElementById('heuristic_d').value);
    let random_d = parseInt(document.getElementById('random_d').value);
    main(
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
         ["t14", "b6"], ["t15", "b7"], ["t16", "b8"]],
        depth, heuristic_d, random_d
    );
}

document.addEventListener('DOMContentLoaded', () => {
    startVisualization();
});