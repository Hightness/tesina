const express = require('express');
const path = require("path");
const fs = require('fs'); // Add fs module to read files
const app = express();
const port = 3000;
const { exec } = require("child_process");

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
                
                console.log('Extracted S order:', sOrder);
                console.log('Extracted T order:', tOrder);
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
        console.log('Received POST request to /save_results');
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
        
        console.log('Data saved ');
        res.status(200).send('Data saved successfully');
    } catch (error) {
        console.error('Error saving data:', error);
        res.status(500).send('Error saving data: ' + error.message);
    }
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
});
// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});