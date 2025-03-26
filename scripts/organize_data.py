import os
import json
import glob
import matplotlib.pyplot as plt
import numpy as np

number_of_groups = 10
folder_path = ""
current_path = os.path.dirname(os.path.abspath(__file__)).split("/")
for i in range(len(current_path)-1):folder_path += current_path[i] + "/"
folder_path += "public/dati_sperimentali"

json_files = glob.glob(os.path.join(folder_path, "*.json"))
all_data = []

def make_graphs(name, group_names):

    # Separate data into Gurobi and heuristic results
    gurobi_matrix = []
    heuristic_matrix = []

    for group in sorted_for_graphs:
        gurobi_group = [item for item in group if "gurobi_crossings" in item]
        heuristic_group = [item for item in group if "heuristic_crossings" in item]
    
        # If still empty, try to infer from solver_type
        if not gurobi_group:
            gurobi_group = [item for item in group if item.get("solver_type") == "gurobi"]
        if not heuristic_group:
            heuristic_group = [item for item in group if item.get("solver_type", "") != "gurobi" and item.get("solver_type") is not None]
    
        gurobi_matrix.append(gurobi_group)
        heuristic_matrix.append(heuristic_group)

    # 1. Compare Gurobi vs Heuristic crossings
    plt.figure(figsize=(14, 8))
    bar_width = 0.35
    index = np.arange(len(group_names))

    # Calculate averages for each group (handling potential empty groups)
    gurobi_crossings_values = []
    heuristic_crossings_values = []

    for i in range(len(group_names)):
        g_group = gurobi_matrix[i]
        h_group = heuristic_matrix[i]
    
        # Directly use gurobi_crossings and heuristic_crossings without fallbacks
        g_cross = np.mean([item["gurobi_crossings"] for item in g_group]) if g_group and all("gurobi_crossings" in item for item in g_group) else 0
        h_cross = np.mean([item["heuristic_crossings"] for item in h_group]) if h_group and all("heuristic_crossings" in item for item in h_group) else 0
    
        gurobi_crossings_values.append(g_cross)
        heuristic_crossings_values.append(h_cross)

    plt.bar(index, gurobi_crossings_values, bar_width, label='Gurobi Crossings', color='blue', alpha=0.7)
    plt.bar(index + bar_width, heuristic_crossings_values, bar_width, label='Heuristic Crossings', color='green', alpha=0.7)

    plt.xlabel(f'Number of {name}')
    plt.ylabel('Average Crossings')
    plt.title('Comparison of Gurobi vs Heuristic Crossings')
    plt.xticks(index + bar_width/2, group_names)
    plt.legend()
    plt.grid(axis='y', linestyle='--', alpha=0.7)
    plt.savefig(os.path.join(graphs_dir, f"{name}_sorted_gurobi_vs_heuristic_crossings.png"))
    plt.close()

    # 2. Compare Gurobi vs Heuristic execution times
    plt.figure(figsize=(14, 8))
    gurobi_times = []
    heuristic_times = []

    for i in range(len(group_names)):
        g_group = gurobi_matrix[i]
        h_group = heuristic_matrix[i]
    
        # Directly use gurobi_time and heuristic_time without fallbacks
        g_time = np.mean([item["gurobi_time"] for item in g_group]) if g_group and all("gurobi_time" in item for item in g_group) else 0
        h_time = np.mean([item["heuristic_time"] for item in h_group]) if h_group and all("heuristic_time" in item for item in h_group) else 0
    
        gurobi_times.append(g_time/1000)
        heuristic_times.append(h_time/1000)

    plt.bar(index, gurobi_times, bar_width, label='Gurobi Execution Time', color='blue', alpha=0.7)
    plt.bar(index + bar_width, heuristic_times, bar_width, label='Heuristic Execution Time', color='green', alpha=0.7)

    plt.xlabel(f'Number of {name}')
    plt.ylabel('Average Execution Time (s)')
    plt.title('Comparison of Gurobi vs Heuristic Execution Times')
    plt.xticks(index + bar_width/2, group_names)
    plt.legend()
    plt.grid(axis='y', linestyle='--', alpha=0.7)
    plt.savefig(os.path.join(graphs_dir, f"{name}_sorted_gurobi_vs_heuristic_times.png"))
    plt.close()

    print(f"Graphs generated and saved to {graphs_dir}")

    # After creating the bar charts, add line graphs
    
    # 3. Create line graph for Gurobi vs Heuristic crossings
    plt.figure(figsize=(14, 8))

    # Use numeric x-axis for smoother line
    x_positions = np.arange(len(group_names))

    # Plot lines for crossings
    plt.plot(x_positions, gurobi_crossings_values, 'o-', linewidth=2.5, markersize=8, label='Gurobi Crossings', color='blue')
    plt.plot(x_positions, heuristic_crossings_values, 'o-', linewidth=2.5, markersize=8, label='Heuristic Crossings', color='green')

    # Fill area under the curves for better visualization
    plt.fill_between(x_positions, gurobi_crossings_values, alpha=0.1, color='blue')
    plt.fill_between(x_positions, heuristic_crossings_values, alpha=0.1, color='green')

    plt.xlabel(f'Number of {name}')
    plt.ylabel('Average Crossings')
    plt.title(f'Trend of Gurobi vs Heuristic Crossings by {name.capitalize()}')
    plt.xticks(x_positions, group_names)
    plt.legend()
    plt.grid(True, linestyle='--', alpha=0.7)
    plt.savefig(os.path.join(graphs_dir, f"{name}_sorted_gurobi_vs_heuristic_crossings_line.png"))
    plt.close()

    # 4. Create line graph for Gurobi vs Heuristic execution times
    plt.figure(figsize=(14, 8))

    # Plot lines for execution times
    plt.plot(x_positions, gurobi_times, 'o-', linewidth=2.5, markersize=8, label='Gurobi Execution Time', color='blue')
    plt.plot(x_positions, heuristic_times, 'o-', linewidth=2.5, markersize=8, label='Heuristic Execution Time', color='green')

    # Fill area under the curves
    plt.fill_between(x_positions, gurobi_times, alpha=0.1, color='blue')
    plt.fill_between(x_positions, heuristic_times, alpha=0.1, color='green')

    # Add data point labels
    for i, (g_time, h_time) in enumerate(zip(gurobi_times, heuristic_times)):
        plt.annotate(f"{g_time:.2f}s", (i, g_time), textcoords="offset points", 
                     xytext=(0,10), ha='center', color='blue', fontweight='bold')
        plt.annotate(f"{h_time:.2f}s", (i, h_time), textcoords="offset points", 
                     xytext=(0,-15), ha='center', color='green', fontweight='bold')

    plt.xlabel(f'Number of {name}')
    plt.ylabel('Average Execution Time (s)')
    plt.title(f'Trend of Gurobi vs Heuristic Execution Times by {name.capitalize()}')
    plt.xticks(x_positions, group_names)
    plt.legend()
    plt.grid(True, linestyle='--', alpha=0.7)
    plt.savefig(os.path.join(graphs_dir, f"{name}_sorted_gurobi_vs_heuristic_times_line.png"))
    plt.close()

# Read and load each JSON file
for json_file in json_files:
    with open(json_file, 'r') as f:
        if "automatic_run" in os.path.basename(json_file):
            data = json.load(f)
            all_data.extend(data)
            print(f"Loaded data from {json_file}")

        elif "sorted_by_leafs" in os.path.basename(json_file):
            with open(json_file, 'r') as f:
                data = json.load(f)[1:]
                all_data.extend(data)

sorted_data = sorted(all_data, key=lambda x: x.get('number_of_leafs', 0))
step = int(len(sorted_data)/number_of_groups)
sorted_matrix = []
if step == 0:
    print('errore madornale, troppi pochi dati')
else:
    for i in range(6):sorted_matrix.append(sorted_data[i*step:(i+1)*step])
    sorted_matrix.append(sorted_data[6*step:])
    sorted_for_graphs = sorted_matrix.copy()

    for json_file in json_files:
        if "sorted_by_leafs" in os.path.basename(json_file):os.remove(json_file)

    for i in range(len(sorted_matrix)):
        dati_nuovi = {}
        for key in sorted_matrix[i][0].keys():
            dati_nuovi[f"media_{key}"] = round(sum([x[key] for x in sorted_matrix[i]]) / len(sorted_matrix[i]), 2)
        sorted_matrix[i].insert(0, dati_nuovi)

        output_file = os.path.join(folder_path, f"sorted_by_leafs_{round(dati_nuovi["media_number_of_leafs"],0)}.json")
        with open(output_file, 'w') as f:
            json.dump(sorted_matrix[i], f, indent=2)

    for json_file in json_files:
        if "automatic_run" in os.path.basename(json_file):os.remove(json_file)

    # Create graphs directory if it doesn't exist
    graphs_dir = os.path.join(folder_path, "graphs")
    if not os.path.exists(graphs_dir):
        os.makedirs(graphs_dir)

    # Generate graphs for each group in sorted_for_graphs
    leaf_group_names = []
    for dataset in sorted_for_graphs:leaf_group_names.append(dataset[int(len(dataset)/2)]["number_of_leafs"])
    make_graphs("leafs", leaf_group_names)


    sorted_data = sorted(all_data, key=lambda x: x.get('number_internal_nodes', 0))
    sorted_for_graphs = []
    for i in range(number_of_groups):sorted_for_graphs.append(sorted_data[i*step:(i+1)*step])
    internal_node_group_names = []
    for dataset in sorted_for_graphs:internal_node_group_names.append(dataset[int(len(dataset)/2)]["number_internal_nodes"])
    make_graphs("internal_nodes", internal_node_group_names)


    sorted_data = sorted(all_data, key=lambda x: x.get('number_of_links', 0))
    sorted_for_graphs = []
    for i in range(number_of_groups):sorted_for_graphs.append(sorted_data[i*step:(i+1)*step])
    link_group_names = []
    for dataset in sorted_for_graphs:link_group_names.append(dataset[int(len(dataset)/2)]["number_of_links"])
    make_graphs("links", link_group_names)
