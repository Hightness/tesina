const express = require('express');
const path = require("path");
const fs = require('fs'); // Add fs module to read files
const app = express();
const port = 3000;
const { exec } = require("child_process");
const trees = require('./public/trees');
const { findFirstCommonParent } = trees;

app.get('/findfirstcommonparent', (req, res) => {
    const { tree_type, leaf1, leaf2 } = req.query;
    if (!tree_type || !leaf1 || !leaf2) {
        return res.status(400).send('Missing required query parameters: tree_type, leaf1, leaf2');
    }
    const result = findFirstCommonParent(tree_type, leaf1, leaf2);
    res.json({ commonParentId: result });
});

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, "public")));
// Serve the HTML file with dynamic title

app.get("/", (req, res) => {
    // Get the title from the query string or use default
    let titolo = "Kanaglegram Visualization";
    if (req.query.titolo) {
        titolo = req.query.titolo;
    }
    
    // Read the HTML file
    const htmlFilePath = path.join(__dirname, "views", "index.html");
    fs.readFile(htmlFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error("Error reading HTML file:", err);
            return res.status(500).send("Error reading HTML file");
        }
        
        // Replace title placeholder with actual title
        const modifiedHTML = data.replace('<title> esempio titolo </title>', `<title>${titolo}</title>`);
        
        // Send the modified HTML
        res.send(modifiedHTML);
    });
});

// Endpoint per eseguire lo script Python e riordinare gli alberi
app.get("/run-python", (req, res) => {
    // Esegui lo script Python
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
            
            if (sOrderMatch && tOrderMatch) {
                // Convert string arrays to actual arrays of numbers
                const sOrder = sOrderMatch[1].split(',').map(Number);
                const tOrder = tOrderMatch[1].split(',').map(Number);
                
                console.log('Extracted S order:', sOrder);
                console.log('Extracted T order:', tOrder);

                // save the orderings on the tree_data file
                const tree_data = fs.readFileSync('public/tree_data.json');
                const tree_data_json = JSON.parse(tree_data);

                tree_data_json.s_order = sOrder;
                tree_data_json.t_order = tOrder;

                fs.writeFileSync('public/tree_data.json', JSON.stringify(tree_data_json, null, 2));

                // Redirect to home with Gurobi title
                res.redirect('/?titolo=Gurobi');
                
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

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});