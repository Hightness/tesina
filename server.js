
const express = require('express');
const path = require("path");
const app = express();
const port = 3000;
const { findFirstCommonParent } = require('./public/kanaglegram');

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

// Serve the HTML file
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "index.html"));
});

// Endpoint per eseguire lo script Python
app.get("/run-python", (req, res) => {
    // Esegui lo script Python
    exec("python3 scripts/script.py", (error, stdout, stderr) => {
        if (error) {
            console.error(`Errore: ${error.message}`);
            return res.status(500).send(`Errore: ${error.message}`);
        }
        if (stderr) {
            console.error(`Stderr: ${stderr}`);
            return res.status(500).send(`Stderr: ${stderr}`);
        }
        console.log(`Output: ${stdout}`);
        res.send(`Output: ${stdout}`);
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});