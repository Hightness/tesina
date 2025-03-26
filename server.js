const express = require('express');
const path = require("path");
const fs = require('fs'); // Add fs module to read files
const app = express();
const port = 3000;
const { exec } = require("child_process");
//import all functions from trees.js inside public/trees.js
const {Node, rebuildTree, binarize_tree, cloneTree, de_binarize_tree, get_linear_order, get_tau_indexes, set_ranges_on_tree, compute_crossings, n_crossings, set_standard_dev, randomly_swap_children} = require('./public/trees.js');

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    const htmlFilePath = path.join(__dirname, "views", "index.html");
    res.sendFile(htmlFilePath);
});

// Endpoint per eseguire lo script Python e riordinare gli alberi
app.post("/run-python", (req, res) => {
    // Esegui lo script Python
    // salva in una variabile il tempo di esecuzione
    const start = new Date();
    exec("python scripts/gurobi_implementation.py", (error, stdout, stderr) => {
        if (error) {
            console.error(`Errore: ${error.message}`);
            return res.status(500).send(`Errore: ${error.message}`);
        }
        if (stderr) {
            console.error(`Stderr: ${stderr}`);
            return res.status(500).send(`Stderr: ${stderr}`);
        }
        
        try {
            // Parse the output to extract orderings
            const sOrderMatch = stdout.match(/Ordinamento s:\s*\[(.*?)\]/);
            const tOrderMatch = stdout.match(/Ordinamento t:\s*\[(.*?)\]/);
            //get only the integer value of the crossings
            const crossings = stdout.match(/Valore obiettivo:\s*(\d+)/)[1];

            const execution_time = new Date() - start;
            
            if (sOrderMatch && tOrderMatch) {
                // Convert string arrays to actual arrays of numbers
                const sOrder = sOrderMatch[1].split(',').map(Number);
                const tOrder = tOrderMatch[1].split(',').map(Number);
                
                res.json({ sOrder, tOrder, execution_time, crossings});
            } else {
                console.error('Could not extract ordering from output');
                res.send(`Output format not recognized. Raw output:<br><pre>${stdout}</pre>`);
            }
        } catch (parseError) {
            console.error('Error processing Python output:', parseError);
            res.send(`Error processing Python output: ${parseError.message}<br><pre>${stdout}</pre>`);
        }
    });
});

app.post('/save_results', (req, res) => {
    try {
        // Log to debug
        // The data is already available in req.body due to express.json() middleware
        const treeData = req.body;
        //add req.body to json array in treeData.file_name
        //get the json file

        let old_data;
        if (fs.existsSync('public/automatic_run.json')) {
            old_data = JSON.parse(fs.readFileSync('public/automatic_run.json'));
        }else {old_data = [];}
        old_data.push(treeData);

        // Save to file
        fs.writeFileSync(
            path.join(__dirname, 'public', 'automatic_run.json'), 
            JSON.stringify(old_data, null, 2)
        );
        
        res.status(200).send('Data saved successfully');
    } catch (error) {
        console.error('Error saving data:', error);
        res.status(200).send('too much memory: ' + error.message);
    }
});


// Update the endpoint to handle POST requests properly
app.post('/save_data', (req, res) => {
    try {
        // Log to debug
        
        // The data is already available in req.body due to express.json() middleware
        const treeData = req.body;
        
        // Save to file
        fs.writeFileSync(
            path.join(__dirname, 'public', 'tree_data.json'), 
            JSON.stringify(treeData, null, 2)
        );
        
        res.status(200).send('Data saved successfully');
    } catch (error) {
        console.error('Error saving data:', error);
        res.status(500).send('Error saving data: ' + error.message);
    }
});

app.post('/store_results', (req, res) => {
    //move the tree_data.json to the dati_sperimentali folder, and add a counter to the file name
    const old_data = JSON.parse(fs.readFileSync('public/automatic_run.json'));
    let counter = 1;
    while (fs.existsSync('public/dati_sperimentali/automatic_run' + counter + '.json')) {
        counter++;
    }

    fs.writeFileSync(
        path.join(__dirname, 'public', 'dati_sperimentali', 'automatic_run' + counter + '.json'), 
        JSON.stringify(old_data, null, 2)
    );

    //delete old file json in the path public/automatic_run.json
    fs.rmSync('public/automatic_run.json');

    exec("python public/dati_sperimentali/organize_data.py", (error, stdout, stderr) => {
        if (error) {
            console.error(`Errore: ${error.message}`);
            return res.status(500).send(`Errore: ${error.message}`);
        }
        if (stderr) {
            console.error(`Stderr: ${stderr}`);
            return res.status(500).send(`Stderr: ${stderr}`);
        }
    });
});

//aggiungi endpoint per la funzione heuristic
app.post("/run-heuristic", (req, res) => {
    let depth, heuristic_d, random_d;
    //depth = parseInt(document.getElementById('depth').value);
    //heuristic_d = parseInt(document.getElementById('heuristic_d').value);
    //random_d = parseInt(document.getElementById('random_d').value);

    depth = req.body.depth;
    heuristic_d = req.body.heuristic_d;
    random_d = req.body.random_d;
    let startTime = Date.now(); // Registra il tempo di inizio
    let s_l = req.body.s_links;
    let t_l = req.body.t_links;
    let link = req.body.links;
    let initial_crossings = req.body.initial_crossings;
    //prendi jrootS da tree_data.json
    let jrootS = JSON.parse(JSON.parse(fs.readFileSync('public/tree_data.json')).s_tree);
    let jrootT = JSON.parse(JSON.parse(fs.readFileSync('public/tree_data.json')).t_tree);
    let rootS = new Node();
    let rootT = new Node();
    rebuildTree(jrootS, rootS);
    rebuildTree(jrootT, rootT);
    
    let rand_call = 0;
    swapped = false;
    let best = initial_crossings;

    let c_ind = p_ind = 0;
    let bestTrees = [];
    //for (let i = 0; i < depth && best > 0; i++) {
    while(c_ind - p_ind < depth && best > 0) {
        binarize_tree(rootS, c_ind, s_l);
        binarize_tree(rootT, c_ind, t_l);
        c_ind++;
        cur_ind = prev_ind = 0;
        //for (let j = 0; j < heuristic_d; j++) {
        while (cur_ind - prev_ind < heuristic_d && best > 0) {
            cur_ind++;
            let sigma = get_linear_order(rootS);
            let tau_order = get_tau_indexes(rootT, sigma, link);
            set_ranges_on_tree(rootS);
            compute_crossings(rootS, tau_order);
            let bestRootS = cloneTree(rootS);
            let bestRootT = cloneTree(rootT);
            de_binarize_tree(bestRootS);
            de_binarize_tree(bestRootT);
            sigma = get_linear_order(bestRootS);
            tau_order = get_tau_indexes(bestRootT, sigma, link);
            let temp_nc = n_crossings(sigma, tau_order);
            if (temp_nc < best) {
                prev_ind = cur_ind;
                p_ind = c_ind;
                best = temp_nc;
                bestTrees.push({swapped:swapped, rootS: JSON.stringify(bestRootS, null, 2), rootT: JSON.stringify(bestRootT, null, 2), links: link, time: Date.now() - startTime , crossings: best, optimal: false});
            }
            [s_l, t_l] = [t_l, s_l];
            [rootS, rootT] = [rootT, rootS];
            link = Object.fromEntries(Object.entries(link).map(([k, v]) => [v, k]));
            swapped = !swapped;
            // Cede il controllo per aggiornare la UI ogni tot iterazioni
            //await new Promise(resolve => setTimeout(resolve, 0));
        }
        de_binarize_tree(rootS);
        de_binarize_tree(rootT);
        if (++rand_call === random_d) {
            sigma = get_linear_order(rootS);
            tau_order = get_tau_indexes(rootT, sigma, link);
            tau = get_linear_order(rootT);
            set_standard_dev(rootT, tau, tau_order); // Call set_standard_dev
            randomly_swap_children(rootT); // Pass tau and tau_orders
            rand_call = 0;
        }
    }
    res.json({bestTrees});
});



// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});