
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

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});