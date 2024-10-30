import random

class Node:
    def __init__(self, parent = None):
        self.value = None
        self.children = []
        self.parent = parent
        self.splitted = False

    def switch_children(self, i1, i2, verbose):
        if verbose: print(f'Swapping node on group range {self.children[i1].min_bound}/{self.children[i1].max_bound} with node on group range {self.children[i2].min_bound}/{self.children[i2].max_bound}')
        temp = self.children[i1]
        self.children[i1] = self.children[i2]
        self.children[i2] = temp

def get_linear_order_tree(root):
    if len(root.children) == 0:return [root.value]
    lo = list()
    for c in root.children:lo += get_linear_order_tree(c)
    return lo

def get_linear_order(V):
    lo = list()
    for first_level in V:
        for second_level in first_level:
            for third_level in second_level:lo.append(third_level)
    return lo

def crossings_on_node(tau_orders, n):
    if n not in tau_orders:return 0
    j = tau_orders.index(n) #posizione tau del link
    incroci = 0
    for i in range(len(tau_orders)):
        if tau_orders[i] >= 0 and ((tau_orders[i] > n and i < j) or (tau_orders[i] < n and i > j)):incroci+=1 #ho incrocio
    return incroci

def n_crossings(sigma, tau_orders):
    incroci = 0
    for i in range(len(sigma)):incroci += crossings_on_node(tau_orders, i)
    return incroci/2

def crossings_on_binary_cluster(v, tau_orders):
    r_bounds_min, r_bounds_max = v.children[1].min_bound, v.children[1].max_bound
    l_bounds_min, l_bounds_max = v.children[0].min_bound, v.children[0].max_bound
    possible_crossings = actual_crossings = 0
    possible_crossings_switched = actual_crossings_switched = 0
    ltau = list()

    for label in tau_orders:
        if label < 0:continue
        if l_bounds_min <= label <= l_bounds_max:
            ltau.append(label)
            actual_crossings += possible_crossings
            possible_crossings_switched += 1

        elif r_bounds_min <= label <= r_bounds_max:
            possible_crossings += 1
            actual_crossings_switched += possible_crossings_switched

    return actual_crossings, actual_crossings_switched, ltau
def compute_crossings(v, tau_orders, verbose):
    if len(tau_orders) <= 1:return

    crossings, crossings_switched, ltau = crossings_on_binary_cluster(v, tau_orders)
    rtau = [x for x in tau_orders if (x not in ltau and x != -1)]

    if crossings_switched < crossings:
        v.switch_children(0, 1, verbose)
        compute_crossings(v.children[0], rtau, verbose)
        compute_crossings(v.children[1], ltau, verbose)
    else:
        compute_crossings(v.children[0], ltau, verbose)
        compute_crossings(v.children[1], rtau, verbose)

def set_links(s, t, L):
    s_links = dict()
    t_links = dict()
    for n in get_linear_order(s):s_links[n] = 0
    for n in get_linear_order(t):t_links[n] = 0
    links = dict()
    for link in L:
        node_name_T = f'{link[1]}_{t_links[link[1]]}'
        node_name_S = f'{link[0]}_{s_links[link[0]]}'

        links[node_name_S] = node_name_T
        s_links[link[0]] += 1
        t_links[link[1]] += 1
    return links, s_links, t_links

def binarize_tree(root):
    l = len(root.children)
    if l == 0:return
    if l == 1:
        root.value = root.children[0].value
        for c in root.children[0].children:c.parent = root
        root.children = root.children[0].children
        return binarize_tree(root)

    if l > 2:
        root.splitted = True
        q = random.randint(0, l-2)
        n1 = Node(root)
        n2 = Node(root)
        for i in range(q+1):
            root.children[i].parent = n1
            n1.children.append(root.children[i])
        for i in range(q+1, l):
            root.children[i].parent = n2
            n2.children.append(root.children[i])
        root.children = [n1, n2]
        binarize_tree(root.children[0])
        binarize_tree(root.children[1])

    elif l == 2:
        binarize_tree(root.children[0])
        binarize_tree(root.children[1])

def print_tree(root):
    if len(root.children) == 0 or root.value != None: return root.value + ' ' if root.value != None else 'None '
    p = ''
    for c in root.children:p += print_tree(c)
    return p

def normalize_leafs(root, links):
    if root.value == None:
        for c in root.children:normalize_leafs(c, links)
    else:
        newchildren = list()
        for i in range(links[root.value]):
            new_node = Node(root)
            new_node.value = f'{root.value}_{i}'
            newchildren.append(new_node)
        if len(newchildren) <= 1:root.value = f'{root.value}_{0}'
        else:
            root.value = None
            root.children = newchildren

def create_tree(root, lista):
    for first_level in lista:
        f = Node(root)
        for second_level in first_level:
            s = Node(f)
            for third_level in second_level:
                t = Node(s)
                t.value = third_level
                s.children.append(t)
            f.children.append(s)
        root.children.append(f)

def de_binarize_tree(root):
    l = len(root.children)
    if l == 0:
        if '_' in root.value:
            i = root.value.index('_')
            root.value = root.value[0:i]
        return
    de_binarize_tree(root.children[0])
    de_binarize_tree(root.children[1])
    if root.splitted == True:
        original_c = root.children[0].children if root.children[0].value == None else [root.children[0]]
        original_c += root.children[1].children if root.children[1].value == None else [root.children[1]]
        already_seen = list()
        i = 0
        while i < len(original_c):
            c = original_c[i]
            if c.value in already_seen:
                original_c.remove(c)
                i-=1
            if c.value != None:already_seen.append(c.value)
            i+=1

        for c in original_c:c.parent = root
        root.children = original_c
        root.splitted = False

def get_S_from_tree(rootS):
    if len(rootS.children)==0:return f'\"{rootS.value}\"'
    S = list()
    for c in rootS.children:S.append(get_S_from_tree(c))
    return S

def set_trees(S, T, s_l, t_l):
    rootS = Node()
    create_tree(rootS, S)

    rootT = Node()
    create_tree(rootT, T)

    print('ok')
    normalize_leafs(rootT, t_l)
    normalize_leafs(rootS, s_l)
    print('ok')

    binarize_tree(rootT)
    binarize_tree(rootS)

    return rootS, rootT

def get_tau_indexes(tau, sigma, links):
    tau_order = [-1]*len(tau)
    for i in range(len(sigma)):
        if links.__contains__(sigma[i]):
            node_name_T = links[sigma[i]]
            tau_order[tau.index(node_name_T)] = i
    return tau_order

def set_ranges_on_tree(root, order):
    if len(root.children) == 0:root.min_bound = root.max_bound = order.index(root.value)
    else:
        set_ranges_on_tree(root.children[0], order)
        set_ranges_on_tree(root.children[-1], order)
        root.max_bound = root.children[-1].max_bound
        root.min_bound = root.children[0].min_bound

def manual_clone(V):
    v_clone_1 = list()
    for first_level in V:
        v_clone_2 = list()
        for second_level in first_level:
            v_clone_3 = list()
            for third_level in second_level:
                v_clone_3.append(third_level)
            v_clone_2.append(v_clone_3)
        v_clone_1.append(v_clone_2)
    return v_clone_1

def main(S, T, L, depth, heuristic_d, best = 9999):
    number_of_prints = 4
    link, s_l, t_l = set_links(S, T, L)
    rootS, rootT = set_trees(S, T, s_l, t_l)
    print(get_S_from_tree(rootT))

    depth = 1
    for _ in range(depth):
        if best == 0:break

        #de_binarize_tree(rootS)
        de_binarize_tree(rootT)

        print(get_S_from_tree(rootT))
        #normalize_leafs(rootS, s_l)
        normalize_leafs(rootT, t_l)

        #binarize_tree(rootS)
        binarize_tree(rootT)

        #print(get_S_from_tree(rootT))

        #tau = get_linear_order_tree(rootT)
        #sigma = get_linear_order_tree(rootS)

        #verbose = _%int(depth / number_of_prints) == 0
        #if verbose: print(f'\n\n\nInitial state of tanglegram:\nsigma: {sigma}\ntau: {tau}\ntau_orders: {get_tau_indexes(tau, sigma, link)}\nlinks: {link}\ncrossings: {n_crossings(sigma, get_tau_indexes(tau, sigma, link))}\ncrossings of the best sol: {best}\n\nStarting heuristic...')
        #nc = heuristics(rootT, rootS, link, heuristic_d, verbose)
        #best = best if best <= nc else nc

def heuristics(rootT, rootS, links, depth, verbose):
    #sigma si suppone sempre il grafo da modificare, mentre tau resta invariato
    nc = 9999
    for _ in range(depth):
        sigma = get_linear_order_tree(rootS)
        tau = get_linear_order_tree(rootT)
        tau_order = get_tau_indexes(tau, sigma, links)
        set_ranges_on_tree(rootS, sigma)

        if nc == 0:break
        compute_crossings(rootS, tau_order, verbose)
        nc = n_crossings(sigma, tau_order)
        links = {valore: chiave for chiave, valore in links.items()}
        temp = rootT
        rootT = rootS
        rootS = temp

    if verbose:print(f'\n\n\nFinished computation.. state of tanglegram:\nsigma: {sigma}\ntau: {tau}\ntau_orders: {tau_order}\nlinks: {links}\ncrossings: {nc}\n\n')
    return nc



#main([[['a'], ['b'], ['c'], ['d', 'e']], [['f']], [['g', 'h']]],
     #[[['1'], ['f'], ['2']],[['3'], ['4'], ['5']]],
     #[['a','1'], ['b', 'f'], ['e', '3'], ['e', '5'], ['f', '1']],
     #100, 100
     #)#primo posto nodi di S, secondo nodi di T

main(
[[["t0", "t1", "t2", "t3"],["t4", "t5", "t6"],],[["t7"]],[["t8", "t9"], ["t10", "t11"], ["t12"]],[["t13", "t14"]],[["t15", "t16"]],],
[[["b0"]],[["b1", "b2"], ["b3", "b4", "b5"], ["b6"]],[["b7", "b8"]],[["b9", "b10"],["b11", "b12"],["b13", "b14"]]],
[["t0", "b0"],["t0", "b1"],["t0", "b2"],["t1", "b1"],["t1", "b2"],["t2", "b1"],["t2", "b2"],["t2", "b6"],["t3", "b1"],["t3", "b2"],["t3", "b6"],["t4", "b5"],
 ["t5", "b4"],["t5", "b1"],["t6", "b0"],["t7", "b0"],["t8", "b11"],["t8", "b12"],["t10", "b9"],["t11", "b9"],["t13", "b6"],["t14", "b6"],["t15", "b7"],["t16", "b8"]],
500,
100)
#main([[['2'],['1'],['3']], [['5'], ['4'], ['6']]],
#[['a'], [['b'], ['c'], ['d'], ['e']]],
#[['1', 'a'], ['5', 'b'], ['4', 'c'], ['1', 'd'], ['2', 'e'], ['5', 'a'], ['5', 'b'], ['1', 'c'], ['5', 'd'], ['4', 'a']],
#50)#primo posto nodi di S, secondo nodi di T

#main([[['2'],['1']], [['5'], ['4']]],
     #[['a'], [['b'], ['c'], ['d'], ['e']]],
     #[['5', 'b'], ['1', 'c'], ['2', 'd'], ['4', 'a']],
     #50)#primo posto nodi di S, secondo nodi di T
