// Tree-related functions extracted from kanaglegram.js
let leaf_value_counter = 0;
const max_depth = 4; // Profondità massima dell'albero
let L = []; // Lista dei collegamenti tra i nodi
let bestTrees = []; // Array per memorizzare i migliori alberi trovati
let currentBestIndex = 0; // Indice dell'albero migliore corrente

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
        this.parent = null; // Riferimento al nodo genitore
        this.min_bound = 0; // Limite inferiore per il nodo nell'ordine lineare
        this.max_bound = Infinity; // Limite superiore per il nodo nell'ordine lineare
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


let originalS = new Node(); // Albero S originale
let originalT = new Node(); // Albero T originale

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

//restituisce il numero di nodi interni
const get_internal_nodes = (root) => {
    let count = 0;
    if (root.children.length === 0) return 0;
    if (root.children.length === 1) return get_internal_nodes(root.children[0]);
    for (let c of root.children) count += get_internal_nodes(c);
    return count + 1;
}

const de_binarize_tree = root => {
    // De-binarizza l'albero riportandolo alla forma originale
    de_binarize_tree_r(root);
    assign_depth(root, 0);
    remove_single_child(root, max_depth);
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

const set_ranges_on_tree = (root) => {
    // Imposta i limiti minimo e massimo per ogni nodo nell'albero
    if (root.children.length === 0) {
        // For leaf nodes, set min and max to the index in the provided order
        root.min_bound = root.max_bound = parseInt(root.value);
    } else if (root.children.length === 1) {
        // For nodes with one child, inherit bounds from child
        set_ranges_on_tree(root.children[0]);
        root.max_bound = root.children[0].max_bound;
        root.min_bound = root.children[0].min_bound;
    } else {
        // For internal nodes, calculate bounds from children
        for (const child of root.children) {
            set_ranges_on_tree(child);
        }
        // min_bound is the minimum of all children's min_bounds
        root.min_bound = Math.min(...root.children.map(c => c.min_bound));
        // max_bound is the maximum of all children's max_bounds
        root.max_bound = Math.max(...root.children.map(c => c.max_bound));
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

const assign_depth = (node, current_depth = 0) => {
    // Assegna la profondità a ogni nodo nell'albero
    if (node.children.length === 0 && node.value !== null) {
        node.depth = current_depth;
    } else {
        node.children.forEach(child => assign_depth(child, current_depth + 1));
    }
}

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

let n_children = 0;
const create_random_tree = (root, depth, max_children, n_leafs) => {
    // Crea un albero casuale dato una profondità e un numero massimo di figli
    if (depth == 0) {
        root.value = `${leaf_value_counter++}`;
        n_children++;
        Node.set_id_counter(root);
        return;
    }
    let new_children = [];
    let n_children = Math.floor(Math.random() * max_children) + 1;
    for (let i = 0; i < n_children; i++) {
        let n = new Node();
        create_random_tree(n, depth - 1, max_children, n_leafs);
        if (n_children == n_leafs) {break;}
        new_children.push(n);
    }
    if(new_children.length == 0){console.log('problemaaa');}
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

const cloneTree = node => {
    // Crea una copia profonda dell'albero
    let newNode = new Node(node.value);
    newNode.id = node.id;
    newNode.splitted = node.splitted;
    newNode.children = node.children.map(child => cloneTree(child));
    return newNode;
}

// Recreate the tree structure by converting the JSON objects back to Node instances
const rebuildTree = (json, node) => {
    if(json.value){node.value = json.value;}
    if(json.id){node.id = json.id;}
    if(json.splitted){node.splitted = json.splitted;}
    if(json.standard_dev){node.standard_dev = json.standard_dev;}
    if(json.depth){node.depth = json.depth;}
    if(json.min_bound){node.min_bound = json.min_bound;}
    if(json.max_bound){node.max_bound = json.max_bound;}
                            
    if (json.children && json.children.length > 0) {
        json.children.forEach(childJson => {
            const childNode = new Node();
            rebuildTree(childJson, childNode);
            childNode.parent = node;
            node.children.push(childNode);
        });
    }
};

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

const order_tree = (root, order) => {
    // arriva alle foglie e assegna l'ordine
    let new_children = [];
    while(new_children.length < root.children.length){
        let minimo = Infinity;
        let next_index = 0;
        for (let i = 0; i < root.children.length; i++) {
            let ind = order.indexOf(root.children[i].min_bound);
            if (ind < minimo && !new_children.includes(root.children[i])) {
                minimo = ind;
                next_index = i;
            }
        }
        new_children.push(root.children[next_index]);
    }
    root.children = new_children;
    root.children.forEach(c => order_tree(c, order));
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

// Export the functions for use in other files
if (typeof module !== 'undefined' && module.exports) {
    // For Node.js environment
    module.exports = {
        binarize_tree,
        printSwappednodes,
        compute_crossings,
        set_standard_dev,
        randomly_swap_children,
        set_links,
        get_tau_indexes,
        crossings_on_binary_cluster,
        order_tree,
        create_random_tree,
        create_random_links,
        get_linear_order,
        rebuildTree,
        crossings_on_node,
        create_tree,
        cloneTree,
        n_crossings,
        binarize_tree_r,
        normalize_leafs,
        de_binarize_tree,
        de_binarize_tree_r,
        set_ranges_on_tree,
        get_depth,
        remove_single_child,
        assign_depth,
        Node,
        L,
        bestTrees,
        currentBestIndex,
        originalS,
        originalT,
        max_depth,
        leaf_value_counter

    };
} else {
    // For browser environment
    window.TreeFunctions = {
        binarize_tree,
        get_linear_order,
        binarize_tree_r,
        create_random_tree,
        create_random_links,
        compute_crossings,
        printSwappednodes,
        set_standard_dev,
        randomly_swap_children,
        set_links,
        get_tau_indexes,
        crossings_on_binary_cluster,
        order_tree,
        create_tree,
        crossings_on_node,
        n_crossings,
        cloneTree,
        normalize_leafs,
        rebuildTree,
        de_binarize_tree,
        de_binarize_tree_r,
        set_ranges_on_tree,
        get_depth,
        remove_single_child,
        assign_depth,
        Node,
        L,
        bestTrees,
        currentBestIndex,
        originalS,
        originalT,
        max_depth,
        leaf_value_counter
    };
}
