from gurobipy import Model, GRB
import requests
import json
import os

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

# Aggiunta delle variabili xs, xt, ..., xn - use name parameter directly when creating variables
xs = model.addVars(s_leafs, s_leafs, vtype=GRB.BINARY)


# Aggiunta delle variabili xt, y2, ..., yn
xt = model.addVars(t_leafs, t_leafs, vtype=GRB.BINARY)

e = []
for arco in edges:e.append(f'arco_{arco[0]}_{arco[1]}')

def P(i, j, tree_type):
    response = requests.get("http://localhost:3000/findfirstcommonparent", params={"tree_type": tree_type, "leaf1": i, "leaf2": j})
    return str(response.json().get("commonParentId", ""))

def set_order_constraint(model, x, h, start, end, tree_type):
    if h >= end:return
    
    for i in range(end-start):
        for j in range(end-start):
            # Get parent info safely
            if i == j or i == h or h == j: continue
            #model.addConstr((x[h-start, i] + x[i, j] - x[h-start, j] <= 1))
            #model.addConstr((x[h-start, i] + x[i, j] - x[h-start, j] >= 0))
            parent_hi = P(h, i+start, tree_type)
            parent_ij = P(i+start, j+start, tree_type)
            #parent_hj = P(h, j+start, tree_type)
                    
            # Only add constraints if we have valid parent info
            parent_of_hi_and_j = P(parent_hi, j + start, tree_type)
            #if parent_of_hi_and_j == parent_ij:# and h-start != j and i != j:
                #model.addConstr(x[h - start, j] == x[i, j])
                        
            parent_of_ij_and_h = P(parent_ij, h, tree_type)
            #print(f'parent of {h} and {i + start}: {parent_hi}')
            #print(f'parent of {h} and {j + start}: {parent_hj}')
            #print(f'parent of {i + start} and {j + start}: {parent_ij}')
            #print(f'parent of {parent_hi} and {j + start}: {parent_of_hi_and_j}')
            #print(f'parent of {parent_ij} and {h}: {parent_of_ij_and_h}')
            #if parent_of_ij_and_h == parent_ij:# and h-start != i and h-start != j:
                #model.addConstr(x[h - start, i] == x[h - start, j])
    
    # Recursive call with proper parameters
    set_order_constraint(model, x, h+1, start, end, tree_type)

# Apply constraints safely
print('adding constraints for xs')
model.addConstrs((xs[h,i] + xs[i, j] - xs[h, j] <= 1 for i in range(s_leafs) for j in range(s_leafs) for h in range(s_leafs) if h != i and j != i and h != j))
model.addConstrs((xs[h,i] + xs[i, j] - xs[h, j] >= 0 for i in range(s_leafs) for j in range(s_leafs) for h in range(s_leafs) if h != i and j != i and h != j))
model.addConstrs((xs[i, j] + xs[j, i] == 1 for i in range(s_leafs) for j in range(s_leafs) if i != j))
model.addConstrs((xs[i, i] == 0 for i in range(s_leafs)))
set_order_constraint(model, xs, 0, 0, s_leafs, s_tree)
print('adding constraints for xt')
model.addConstrs((xt[h,i] + xt[i, j] - xt[h, j] <= 1 for i in range(t_leafs) for j in range(t_leafs) for h in range(t_leafs) if h != i and j != i and h != j))
model.addConstrs((xt[h,i] + xt[i, j] - xt[h, j] >= 0 for i in range(t_leafs) for j in range(t_leafs) for h in range(t_leafs) if h != i and j != i and h != j))
model.addConstrs((xt[i, j] + xt[j, i] == 1 for i in range(t_leafs) for j in range(t_leafs) if i != j))
model.addConstrs((xt[i, i] == 0 for i in range(t_leafs)))
set_order_constraint(model, xt, s_leafs, s_leafs, s_leafs+t_leafs, t_tree)

# Create crossing variables properly
# create dictionary c with keys i-j-k-l 
c = model.addVars(s_leafs, s_leafs, t_leafs, t_leafs, vtype=GRB.BINARY)

for i in range(s_leafs):
    for j in range(s_leafs):
        for k in range(t_leafs):
            for l in range(t_leafs):
                if f'arco_{i}_{k+s_leafs}' in e and f'arco_{j}_{l+s_leafs}' in e and (i != j or k != l):
                    model.addConstr(c[i, j, k, l] == (xs[i, j]*(1-xt[k, l]) + xt[k, l]*(1-xs[i, j])))
    
# Set objective with proper variable access
# sum all elements on dictionary c
model.setObjective(sum(c[i, j, k, l] for i in range(s_leafs) for j in range(s_leafs) for k in range(t_leafs) for l in range(t_leafs) if i < j and k < l), GRB.MAXIMIZE)

# Ottimizzazione del modello
model.optimize()

# Stampa dei risultati
if model.status == GRB.OPTIMAL:
    #creami lista con n zeri:
    ordinamento_s = [i for i in range(s_leafs)]
    print("\n\nSoluzione ottimale trovata:")
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