import random
import graphviz
import os

# Definizione della classe Node per rappresentare ogni nodo dell'albero
class Node:
    id_counter = 0  # Variabile di classe per tenere traccia degli id unici

    @staticmethod
    def set_id_counter(node):
        if node.value is None:
            # Assegna un id univoco ai nodi intermedi (senza valore)
            node.id = f'node_{Node.id_counter}'
            Node.id_counter += 1
        else:
            # Usa il valore come id per i nodi foglia
            node.id = node.value

    def __init__(self, value=None):
        self.value = value            # Valore del nodo (None per nodi intermedi)
        self.children = []            # Lista dei nodi figli
        self.parent = None            # Riferimento al nodo genitore
        Node.set_id_counter(self)     # Imposta l'id del nodo
        self.splitted = False         # Indica se il nodo è stato diviso

    # Metodo per scambiare la posizione di due nodi figli
    def switch_children(self, i1, i2):
        temp = self.children[i1]
        self.children[i1] = self.children[i2]
        self.children[i2] = temp

    # Metodo per impostare i figli del nodo, assicurandosi che non ci siano duplicati
    def set_children(self, new_children):
        final_c = []
        already_seen = set()
        for c in new_children:
            if c.value is None or c.value not in already_seen:
                c.parent = self              # Imposta il nodo corrente come genitore
                final_c.append(c)            # Aggiunge il figlio alla lista finale
                if c.value is not None:
                    already_seen.add(c.value)  # Aggiunge il valore all'insieme dei valori già visti
        self.children = final_c              # Aggiorna la lista dei figli

# Simplify get_linear_order using list comprehension
def get_linear_order(V):
    if isinstance(V, str):
        return [V]
    if isinstance(V, Node):
        if not V.children:
            return [V.value]
        V = V.children
    return [leaf for c in V for leaf in get_linear_order(c)]

# Function to count crossings on a node
def crossings_on_node(tau_orders, n):
    if n not in tau_orders:
        return 0
    j = tau_orders.index(n)
    incroci = 0
    for i in range(len(tau_orders)):
        if tau_orders[i] >= 0 and ((tau_orders[i] > n and i < j) or (tau_orders[i] < n and i > j)):
            incroci += 1
    return incroci

# Function to count total crossings
def n_crossings(sigma, tau_orders):
    incroci = 0
    for i in range(len(sigma)):
        incroci += crossings_on_node(tau_orders, i)
    return incroci / 2

# Function to count crossings on a binary cluster
def crossings_on_binary_cluster(v, tau_orders):
    r_bounds_min, r_bounds_max = v.children[1].min_bound, v.children[1].max_bound
    l_bounds_min, l_bounds_max = v.children[0].min_bound, v.children[0].max_bound
    possible_crossings = actual_crossings = 0
    possible_crossings_switched = actual_crossings_switched = 0
    ltau = list()

    for label in tau_orders:
        if label < 0:
            continue
        if l_bounds_min <= label <= l_bounds_max:
            ltau.append(label)
            actual_crossings += possible_crossings
            possible_crossings_switched += 1
        elif r_bounds_min <= label <= r_bounds_max:
            possible_crossings += 1
            actual_crossings_switched += possible_crossings_switched

    return actual_crossings, actual_crossings_switched, ltau

# Function to add a node to the graph
def add_node(root, dot):
    dot.node(root.id)
    if root.parent:
        dot.edge(root.parent.id, root.id)
    for child in root.children:
        add_node(child, dot)

# Function to plot the tree
def plot(root, name, run_n):
    dot = graphviz.Digraph(comment='tree')
    add_node(root, dot)
    dot.render(f'{name}_run_{run_n}', view=False, directory=f'output_{name}', format='png')

# Function to compute crossings in the tree
def compute_crossings(v, tau_orders):
    if len(v.children) <= 1:
        return

    crossings, crossings_switched, ltau = crossings_on_binary_cluster(v, tau_orders)
    rtau = [x for x in tau_orders if (x not in ltau and x != -1)]

    if crossings_switched < crossings:
        v.switch_children(0, 1)
        ltau, rtau = rtau, ltau

    compute_crossings(v.children[0], ltau)
    compute_crossings(v.children[1], rtau)

# Function to set links between nodes
def set_links(s, t, L):
    s_links = dict()
    t_links = dict()
    for n in get_linear_order(s):
        s_links[n] = 0
    for n in get_linear_order(t):
        t_links[n] = 0
    links = dict()
    for link in L:
        node_name_T = f'{link[1]}_{t_links[link[1]]}'
        node_name_S = f'{link[0]}_{s_links[link[0]]}'

        links[node_name_S] = node_name_T
        s_links[link[0]] += 1
        t_links[link[1]] += 1
    return links, s_links, t_links

# Function to binarize the tree
def binarize_tree(root, seed):
    l = len(root.children)

    if l > 2:
        root.splitted = True
        random.seed(seed)
        q = random.randint(0, l-2)
        n1 = Node()
        n2 = Node()
        n1.set_children(root.children[0:q+1])
        n2.set_children(root.children[q+1:l])
        root.set_children([n1, n2])
    for c in root.children:
        binarize_tree(c, seed)

# Function to print the tree
def print_tree(root):
    if not root.children or root.value is not None:
        return f'{root.value} ' if root.value else 'None '
    return ''.join(print_tree(c) for c in root.children)

# Funzione per normalizzare i nodi foglia
def normalize_leafs(root, links):
    if root.value is None:
        # Se il nodo è intermedio, normalizza ricorsivamente i figli
        for c in root.children:
            normalize_leafs(c, links)
    else:
        # Se il nodo è una foglia
        new_children = []
        for i in range(links[root.value]):
            # Crea nuovi nodi foglia con identificatori univoci
            new_node = Node(f'{root.value}_{i}')
            new_children.append(new_node)
        if len(new_children) <= 1:
            # Se non ci sono duplicati, rinomina la foglia
            root.value = f'{root.value}_{0}'
            Node.set_id_counter(root)  # Aggiorna l'id del nodo
        else:
            # Se ci sono duplicati, il nodo diventa intermedio
            root.splitted = True
            root.value = None
            Node.set_id_counter(root)   # Aggiorna l'id del nodo
            root.set_children(new_children)  # Imposta i nuovi figli

# Function to create a tree from a list
def create_tree(root, lista):
    if isinstance(lista, str):
        root.value = lista
        Node.set_id_counter(root)
        return

    newchildren = list()
    for c in lista:
        n = Node()
        create_tree(n, c)
        newchildren.append(n)

    root.set_children(newchildren)

# Funzione per de-binarizzare l'albero (ripristinare la struttura originale)
def de_binarize_tree(root):
    for c in root.children:
        de_binarize_tree(c)
    if len(root.children) == 0:
        # Rimuove l'appendice '_x' dal valore dei nodi foglia
        root.value = root.value.split('_')[0]
        Node.set_id_counter(root)  # Aggiorna l'id del nodo
    if root.splitted:
        # Se il nodo è stato splittato, combina i figli
        temp_c = []
        if root.children[0].children:
            temp_c.extend(root.children[0].children)
        else:
            temp_c.append(root.children[0])
        if root.children[1].children:
            temp_c.extend(root.children[1].children)
        else:
            temp_c.append(root.children[1])
        root.set_children(temp_c)
        root.splitted = False  # Resetta il flag di splitting

# Use enumerate and simplify conditionals in get_tau_indexes
def get_tau_indexes(rT, sigma, links):
    tau = get_linear_order(rT)
    tau_order = [-1] * len(tau)
    for i, s in enumerate(sigma):
        if s in links:
            node_name_T = links[s]
            tau_order[tau.index(node_name_T)] = i
    return tau_order

# Function to set ranges on the tree
def set_ranges_on_tree(root, order):
    if len(root.children) == 0:
        root.min_bound = root.max_bound = order.index(root.value)
    else:
        set_ranges_on_tree(root.children[0], order)
        set_ranges_on_tree(root.children[-1], order)
        root.max_bound = root.children[-1].max_bound
        root.min_bound = root.children[0].min_bound

# Simplify remove_single_child function
def remove_single_child(root):
    while len(root.children) == 1:
        child = root.children[0]
        root.value, root.id, root.splitted = child.value, child.id, child.splitted
        root.set_children(child.children)
    for c in root.children:
        remove_single_child(c)

# Simplify heuristic function
def heuristic(rootS, rootT, s_l, t_l, depth, hd, link):
    best = 9999
    number_of_prints = 10
    for _ in range(depth):
        if best == 0:
            break
        verbose = _ % (depth // number_of_prints) == 0
        normalize_leafs(rootS, s_l)
        normalize_leafs(rootT, t_l)
        binarize_tree(rootS, _)
        binarize_tree(rootT, _)
        if verbose:
            print(f'starting computation n.{_}, (best found: {best}), current crossings: {n_crossings(get_linear_order(rootS), get_tau_indexes(rootT, get_linear_order(rootS), link))}')
        for __ in range(hd):
            sigma = get_linear_order(rootS)
            tau_order = get_tau_indexes(rootT, sigma, link)
            temp_nc = n_crossings(sigma, tau_order)
            set_ranges_on_tree(rootS, sigma)
            compute_crossings(rootS, tau_order)
            link = {v: k for k, v in link.items()}
            s_l, t_l = t_l, s_l
            rootS, rootT = rootT, rootS
            if temp_nc < best:
                best = temp_nc
                de_binarize_tree(rootS)
                de_binarize_tree(rootT)
                remove_single_child(rootS)
                remove_single_child(rootT)
                plot(rootS, 'bestS', _)
                plot(rootT, 'bestT', _)
                normalize_leafs(rootS, s_l)
                normalize_leafs(rootT, t_l)
                binarize_tree(rootS, _)
                binarize_tree(rootT, _)

        de_binarize_tree(rootS)
        de_binarize_tree(rootT)
        remove_single_child(rootS)
        remove_single_child(rootT)
        randomly_swap_children(rootS)
        randomly_swap_children(rootT)
        if verbose:
            print(f'finished computation n.{_} (best found: {best})\n')
    return best

# Funzione per scambiare casualmente i nodi figli
def randomly_swap_children(root):
    if len(root.children) > 1:
        # Mescola casualmente la lista dei figli
        random.shuffle(root.children)
    # Applica ricorsivamente ai nodi figli
    for child in root.children:
        randomly_swap_children(child)

# Funzione principale per eseguire il programma
def main(S, T, L):
    depth = int(input('Inserisci il numero di iterazioni: '))
    heuristic_d = int(input('Inserisci il numero di iterazioni per l\'euristica: '))
    link, s_l, t_l = set_links(S, T, L)
    rootS, rootT = Node(), Node()
    create_tree(rootS, S)
    create_tree(rootT, T)
    # Rimuove i vecchi output dalle directory
    for filename in os.listdir('output_S'):
        os.remove(f'output_S/{filename}')
    for filename in os.listdir('output_T'):
        os.remove(f'output_T/{filename}')
    plot(rootS, 'S', 0)  # Plot iniziale dell'albero S
    plot(rootT, 'T', 0)  # Plot iniziale dell'albero T
    heuristic(rootS, rootT, s_l, t_l, depth, heuristic_d, link)  # Avvia l'euristica per ridurre gli incroci

# Esempio di utilizzo della funzione main
main(
[[["t0", "t1", "t2", "t3"],["t4", "t5", "t6"]],[["t7"]],[["t8", "t9"], ["t10", "t11"], ["t12"]],[["t13", "t14"]],[["t15", "t16"]]],
[[["b0"]],[["b1", "b2"], ["b3", "b4", "b5"], ["b6"]],[["b7", "b8"]],[["b9", "b10"],["b11", "b12"],["b13", "b14"]]],
[["t0", "b0"],["t0", "b1"],["t0", "b2"],["t1", "b1"],["t1", "b2"],["t2", "b1"],["t2", "b2"],["t2", "b6"],["t3", "b1"],["t3", "b2"],["t3", "b6"],["t4", "b5"],
["t5", "b4"],["t5", "b1"],["t6", "b0"],["t7", "b0"],["t8", "b11"],["t8", "b12"],["t10", "b9"],["t11", "b9"],["t13", "b6"],["t14", "b6"],["t15", "b7"],["t16", "b8"]],
)

#main([[['a', 'b'], ['c']], [['d', 'e'], ['f', 'g']]], [[['1', '2'], ['3']], [['4', '5'], ['6', '7']]], [['a', '6'], ['b', '2'], ['f', '3'], ['d', '5'], ['f', '5'], ['f', '6'], ['g', '7']],)

