import express from 'express';
import cors from "cors";

const app= express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors())
app.use(express.json());

app.post('/deploy', (req, res) => {});

app.listen(port, () => {
    console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
});