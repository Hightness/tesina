from gurobipy import Model, GRB
import requests


s_leafs = 10
t_leafs = 10
#from S leafs to T leafs
edges = [(0, 1), (0, 2), (1, 3), (1, 4), (2, 5), (2, 6), (3, 7), (3, 8), (4, 9), (4, 10)]

# Creazione del modello
model = Model("Vincoli condizionali")

# Aggiunta delle variabili x1, x2, ..., xn
x1 = model.addVars(s_leafs, s_leafs, vtype=GRB.BINARY)
for i in range(s_leafs):
    for j in range(s_leafs):
        x1[i,j].name = f"x1_{i}_{j}"
        model.addConstr(x1[i,j] == (i<j))

# Aggiunta delle variabili x1, x2, ..., xn
x2 = model.addVars(t_leafs, t_leafs, vtype=GRB.BINARY)
for i in range(t_leafs):
    for j in range(t_leafs):
        x2[i,j].name = f"x2_{i}_{j}"
        model.addConstr(x2[i,j] == (i<j))

e = model.addVars(s_leafs, t_leafs, vtype=GRB.BINARY, lb = 0, ub = 0)

for t in edges:
    e[t[0], t[1]].lb = e[t[0], t[1]].ub = 1
    
#x1
S = [[["t0", "t1", "t2", "t3"], ["t4", "t5", "t6"]],[["t7"]],[["t8", "t9"], ["t10", "t11"], ["t12"]],[["t13", "t14"]],[["t15", "t16"]]];
#x2
T = [[["t0", "t1", "t2", "t3"], ["t4", "t5", "t6"]],[["t7"]],[["t8", "t9"], ["t10", "t11"], ["t12"]],[["t13", "t14"]],[["t15", "t16"]]];

def P(i, j, tree_type):
    # Call the JavaScript function via the API
    response = requests.get("http://localhost:3000/findfirstcommonparent", params={"tree_type": tree_type, "leaf1": i, "leaf2": j})
    return str(response.json()["result"])

def set_order_constraint(model, x, h, length, tree_type):
    if h >= length:return
    for i in range(x):
        for j in range(x[i]):
            model.addConstr(0 <= x[h,i] + x[i,j] - x[h,j] <= 1)
            if P(h, i, tree_type) != P(P(h, i, tree_type), j, tree_type):model.addConstr(x[h,j] == x[i,j])
            if P(i, j, tree_type) != P(h,P(i, j, tree_type), tree_type):model.addConstr(x[h,j] == x[i,j])
    set_order_constraint(model, x1, h+1)

set_order_constraint(model, x1, 0, s_leafs, "s_tree")
set_order_constraint(model, x2, 0, t_leafs, "t_tree")

c = model.addVars(s_leafs, s_leafs, t_leafs, t_leafs, vtype=GRB.BINARY)
for i in range(s_leafs):
    for j in range(s_leafs):
        for k in range(t_leafs):
            for l in range(t_leafs):
                c[i,j,k,l].name = f"c_{i}_{j}_{k}_{l}"
                model.addConstr(c[i,j,k,l] == e[i,k]*e[j,l]*(x1[i,j]*(1-x2[k,l]) + x2[k,l]*(1-x1[i,j])))
    

model.setObjective(sum(c[i, j, k, l] for i in range(s_leafs) for j in range(s_leafs) for k in range(t_leafs) for l in range(t_leafs)), GRB.MINIMIZE)
# Ottimizzazione del modello
model.optimize()

# Stampa dei risultati
if model.status == GRB.OPTIMAL:
    print("Soluzione ottimale trovata:")
    for i in range(s_leafs):
        for j in range(s_leafs):
            print(f"x1_{i}_{j} = {x1[i,j]}")
else:
    print("Nessuna soluzione ottimale trovata.")