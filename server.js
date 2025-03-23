const express = require('express');
const fs = require('fs'); // Add fs module to read files
const { exec } = require("child_process");
const path = require("path");
const app = express();
const port = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, "public")));
// Serve the HTML file with dynamic title

app.get("/", (req, res) => {
    const htmlFilePath = path.join(__dirname, "views", "index.html");
    res.sendFile(htmlFilePath);
});

// Endpoint per eseguire lo script Python e riordinare gli alberi
app.post("/run-gurobi", (req, res) => {
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
                res.json({ sOrder, tOrder });
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

// Update the endpoint to handle POST requests properly
app.post('/save_data', (req, res) => {
    try {
        // Log to debug
        console.log('Received POST request to /save_data');
        
        // The data is already available in req.body due to express.json() middleware
        const treeData = req.body;
        
        // Save to file
        fs.writeFileSync(
            path.join(__dirname, 'public', 'tree_data.json'), 
            JSON.stringify(treeData, null, 2)
        );
        
        console.log('Data saved to tree_data.json');
        res.status(200).send('Data saved successfully');
    } catch (error) {
        console.error('Error saving data:', error);
        res.status(500).send('Error saving data: ' + error.message);
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});