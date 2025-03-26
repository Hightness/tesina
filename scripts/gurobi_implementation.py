from gurobipy import Model, GRB
import json
import os
#nodi foglia
#rapporto archi e nodi foglia 2, 4, 10
#rapport nodi interni e nodi foglia 1/4 1/2 2/3


# Read from JSON file instead of command line arguments
json_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'public', 'tree_data.json')

with open(json_path, 'r') as file:
    data = json.load(file)
    s_leafs = int(data.get('s_leafs', 10))
    t_leafs = int(data.get('t_leafs', 10))
    edges = data.get('L', [])
    edges = [(int(edge[0]), int(edge[1])) for edge in edges]
    s_tree = data.get('s_tree')
    t_tree = data.get('t_tree')
    print(f"Successfully loaded data: s_leafs={s_leafs}, t_leafs={t_leafs}, edges={edges}")
    #transform all edges entries into integers
#remove json_path file
#os.remove(json_path)

# Creazione del modello
model = Model("Vincoli condizionali")
model.Params.MemLimit = 12 # 12 GB
model.Params.NodefileStart = 11 # 11 GB 
model.Params.LogToConsole = 1  # Enable logging


# Aggiunta delle variabili xs, xt, ..., xn - use name parameter directly when creating variables
xs = model.addVars(s_leafs, s_leafs, vtype=GRB.BINARY)


# Aggiunta delle variabili xt, y2, ..., yn
xt = model.addVars(t_leafs, t_leafs, vtype=GRB.BINARY)

e = []
for arco in edges:e.append(f'arco_{arco[0]}_{arco[1]}')
e = set(e)

def find_first_common_parent(tree_json, leaf1, leaf2):

    if isinstance(tree_json, str):
        root = json.loads(tree_json)
    else:
        root = tree_json  # Already parsed
    
    def path_to_leaf(node, leaf, path=None):
        """Find the path from root to the given leaf"""
        if path is None:
            path = []
        
        # Check if current node is the leaf we're looking for
        if str(node.get('id', '')) == str(leaf):
            return path + [node]
        
        # Recursively search in children
        for child in node.get('children', []):
            result = path_to_leaf(child, leaf, path + [node])
            if result:
                return result
        
        return None
    
    # Get paths from root to each leaf
    path1 = path_to_leaf(root, leaf1)
    path2 = path_to_leaf(root, leaf2)
    
    # If either path doesn't exist, return None
    if not path1 or not path2:
        return None
    
    # Find the last common node in both paths
    common_parent = None
    for i in range(min(len(path1), len(path2))):
        if path1[i].get('id') == path2[i].get('id'):
            common_parent = path1[i]
        else:
            break
    
    # Return the value or ID of the common parent
    if common_parent:
        return common_parent.get('value') or common_parent.get('id')
    else:
        return None

def P(i, j, tree_type):
    common_parent = find_first_common_parent(tree_type, i, j)
    return str(common_parent or "")

# Apply constraints safely
print('adding constraints for xs')
model.addConstrs((xs[h,i] + xs[i, j] - xs[h, j] <= 1 for h in range(s_leafs) for i in range(h+1, s_leafs) for j in range(i+1, s_leafs)))
model.addConstrs((xs[h,i] + xs[i, j] - xs[h, j] >= 0 for h in range(s_leafs) for i in range(h+1, s_leafs) for j in range(i+1, s_leafs)))
model.addConstrs((xs[i, j] + xs[j, i] == 1 for i in range(s_leafs) for j in range(s_leafs) if i != j))
model.addConstrs((xs[i, i] == 0 for i in range(s_leafs)))

model.addConstrs((xs[h, j] == xs[i, j] for h in range(s_leafs) for i in range(h+1, s_leafs) for j in range(i+1, s_leafs) if P(h, i, s_tree) != P(P(h, i, s_tree), j, s_tree)))
model.addConstrs((xs[h, i] == xs[h, j] for h in range(s_leafs) for i in range(h+1, s_leafs) for j in range(i+1, s_leafs) if P(i, j, s_tree) != P(h, P(i, j, s_tree), s_tree)))

print('adding constraints for xt')
model.addConstrs((xt[h,i] + xt[i, j] - xt[h, j] <= 1 for h in range(t_leafs) for i in range(h+1, t_leafs) for j in range(i+1, t_leafs)))
model.addConstrs((xt[h,i] + xt[i, j] - xt[h, j] >= 0 for h in range(t_leafs) for i in range(h+1, t_leafs) for j in range(i+1, t_leafs)))
model.addConstrs((xt[i, j] + xt[j, i] == 1 for i in range(t_leafs) for j in range(t_leafs) if i != j))
model.addConstrs((xt[i, i] == 0 for i in range(t_leafs)))

model.addConstrs((xt[h, j] == xt[i, j] for h in range(t_leafs) for i in range(h+1, t_leafs) for j in range(i+1, t_leafs) if P(h+s_leafs, i+s_leafs, t_tree) != P(P(h+s_leafs, i+s_leafs, t_tree), j+s_leafs, t_tree)))
model.addConstrs((xt[h, i] == xt[h, j] for h in range(t_leafs) for i in range(h+1, t_leafs) for j in range(i+1, t_leafs) if P(i+s_leafs, j+s_leafs, t_tree) != P(h+s_leafs, P(i+s_leafs, j+s_leafs, t_tree), t_tree)))

# Create crossing variables properly
# create dictionary c with keys i-j-k-l 
c = model.addVars(s_leafs, s_leafs, t_leafs, t_leafs, vtype=GRB.BINARY)

print('adding constraints for c')
model.addConstrs(c[i, j, k, l] == (xs[i, j]*(1-xt[k, l]) + xt[k, l]*(1-xs[i, j])) for i in range(s_leafs) for j in range(s_leafs) for k in range(t_leafs) for l in range(t_leafs) if f'arco_{i}_{k+s_leafs}' in e and f'arco_{j}_{l+s_leafs}' in e and i != j and k != l)
# Set objective with proper variable access
# sum all elements on dictionary c
print('setting objective')	
model.setObjective(sum(c[i, j, k, l] for i in range(s_leafs) for j in range(s_leafs) for k in range(t_leafs) for l in range(t_leafs)), GRB.MINIMIZE)

# Ottimizzazione del modello
print('optimizing model')
model.optimize()

# Stampa dei risultati
if model.status == GRB.OPTIMAL:
    #creami lista con n zeri:
    ordinamento_s = [i for i in range(s_leafs)]
    print("\n\nSoluzione ottimale trovata:")
    print("Valore obiettivo:", model.objVal)
    for i in range(s_leafs):
        posizione = 0
        for j in range(s_leafs):
            if int(xs[i, j].X) == 1:posizione += 1
        ordinamento_s[s_leafs-posizione-1] = i

    #sortami questa lista ordinando gli indici in base al valore nella posizione ([3,2,4,1,5])
    print("Ordinamento s:", ordinamento_s)

    ordinamento_t = [i for i in range(t_leafs)]
    for i in range(t_leafs):
        posizione = 0
        for j in range(t_leafs):
            if int(xt[i, j].X) == 1:posizione += 1
        ordinamento_t[posizione] = i+s_leafs

    print("Ordinamento t:", ordinamento_t)
else:
    print(f"Nessuna soluzione ottimale trovata. {model.Status}")