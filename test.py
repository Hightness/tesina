import ast
import random


class Node:
    def __init__(self):
        self.value = None
        self.children = []

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
def get_linear_order(V, d = 0):
    if len(V) == 1: return f'\'{V[0]}\','
    temp = ''
    for l in V:temp += get_linear_order(l, d+1)
    return temp if d > 0 else ast.literal_eval(f'[{temp[:-1]}]')

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

def set_links(S, T, L):
    s_links = dict()
    t_links = dict()
    for n in get_linear_order(S):s_links[n] = 0
    for n in get_linear_order(T):t_links[n] = 0
    links = dict()
    for link in L:
        node_name_T = f'{link[1]}_{t_links[link[1]]}'
        node_name_S = f'{link[0]}_{s_links[link[0]]}'

        links[node_name_S] = node_name_T
        s_links[link[0]] += 1
        t_links[link[1]] += 1
    return links, s_links, t_links

def expand_nodes_2(arr, i, j):
    iq = (lambda: '' if isinstance(arr[j], list) else '\"')()
    jq = (lambda: '' if isinstance(arr[j], list) else '\"')()

    if i == j:return f'{iq}{arr[i]}{iq}'
    if i + 1 == j:return f'[{iq}{arr[i]}{iq},{jq}{arr[j]}{jq}]'
    newj = random.randint(i, j-1)
    return f'[{expand_nodes_2(arr, i, newj)},{expand_nodes_2(arr, newj+1, j)}]'
def normalize_orders(el, links):
    if len(el) > 1:
        for i in range(len(el)): el[i] = normalize_orders(el[i], links)
        #per forzare albero binario..
        return ast.literal_eval(expand_nodes_2(el, 0, len(el) - 1))
    else:
        if links[el[0]] > 0:
            newl = list()
            for i in range(links[el[0]]):newl.append([f'{el[0]}_{i}'])
            return ast.literal_eval(expand_nodes_2(newl, 0, links[el[0]]-1))
        return [f'{el[0]}_0']
def create_tree(root, lista):
    for l in lista:
        c = Node()
        if len(lista) == 1:
            c.value = lista[0]
        else:create_tree(c, l)
        root.children.append(c)
def set_S_T_tree(S, T, s_l, t_l):

    S = normalize_orders(S, s_l)
    T = normalize_orders(T, t_l)

    rootS = Node()
    create_tree(rootS, S)

    rootT = Node()
    create_tree(rootT, T)
    return rootS, rootT

def get_S_from_tree(rootS):
    if len(rootS.children)==0:return f'\"{rootS.value}\"'
    S = list()
    for c in rootS.children:S.append(get_S_from_tree(c))
    return S

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
    if len(V) == 1:return [V[0]]
    v_clone = list()
    for l in V:v_clone.append(manual_clone(l))
    return v_clone

def main(S, T, L, depth, heuristic_d, best = 9999):
    number_of_prints = 4
    S_clone = manual_clone(S)
    T_clone = manual_clone(T)
    for _ in range(depth):
        if best == 0:break
        link, s_l, t_l = set_links(S, T, L)
        rootS, rootT = set_S_T_tree(S, T, s_l, t_l)
        tau = get_linear_order(T)
        sigma = get_linear_order(S)
        verbose = _%int(depth / number_of_prints) == 0
        if verbose: print(f'\n\n\nInitial state of tanglegram:\nsigma: {sigma}\ntau: {tau}\ntau_orders: {get_tau_indexes(tau, sigma, link)}\nlinks: {link}\ncrossings: {n_crossings(sigma, get_tau_indexes(tau, sigma, link))}\ncrossings of the best sol: {best}\n\nStarting heuristic...')
        nc = heuristics(rootT, rootS, link, heuristic_d, verbose)
        best = best if best <= nc else nc
        S = manual_clone(S_clone)
        T = manual_clone(T_clone)

def heuristics(rootT, rootS, links, depth, verbose):
    #sigma si suppone sempre il grafo da modificare, mentre tau resta invariato
    nc = 9999
    for _ in range(depth):
        sigma = get_linear_order_tree(rootS)
        tau = get_linear_order_tree(rootT)
        tau_order = get_tau_indexes(tau, sigma, links)
        set_ranges_on_tree(rootS, sigma)

        if nc == 0:
            if verbose:print(f'\n\n\nFinished computation.. state of tanglegram:\nsigma: {sigma}\ntau: {tau}\ntau_orders: {tau_order}\nlinks: {links}\ncrossings: {nc}\n\n')
            return nc

        compute_crossings(rootS, tau_order, verbose)
        nc = n_crossings(sigma, tau_order)
        links = {valore: chiave for chiave, valore in links.items()}
        temp = rootT
        rootT = rootS
        rootS = temp
    return nc


main([[['1'], ['2'], [['2.1'], ['2.2']]], [['3'], ['4'], ['5']]],
     [[['1'], ['5'], [['2.1'], ['3.2']]], [['f'], ['a'], ['6']]],
     [['1', '2.1'], ['2.1', '1'], ['2.1', 'f'], ['2', '3.2'], ['4', 'a'], ['2.1', '5'], ['3', '1'], ['2.2', 'a'], ['5', '6']],
     100, 1000)#primo posto nodi di S, secondo nodi di T

#main([[['2'],['1'],['3']], [['5'], ['4'], ['6']]],
#[['a'], [['b'], ['c'], ['d'], ['e']]],
#[['1', 'a'], ['5', 'b'], ['4', 'c'], ['1', 'd'], ['2', 'e'], ['5', 'a'], ['5', 'b'], ['1', 'c'], ['5', 'd'], ['4', 'a']],
#50)#primo posto nodi di S, secondo nodi di T

#main([[['2'],['1']], [['5'], ['4']]],
     #[['a'], [['b'], ['c'], ['d'], ['e']]],
     #[['5', 'b'], ['1', 'c'], ['2', 'd'], ['4', 'a']],
     #50)#primo posto nodi di S, secondo nodi di T
