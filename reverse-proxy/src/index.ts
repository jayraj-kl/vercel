import express from 'express';
import cors from 'cors';
import httpProxy from 'http-proxy';
import dotenv from 'dotenv';
import { PrismaClient } from "@prisma/client";

dotenv.config();

const app = express();
const proxy = httpProxy.createProxyServer();
const port = process.env.PORT || 3001;
const BASE_URL = process.env.BASE_URL;

const prisma = new PrismaClient();

app.use(cors())
app.use(express.json());
app.use(async (req, res) => {
    const hostname = req.hostname;
    console.log('hostname', hostname);
    const subdomain = hostname.split('.')[0];
    console.log('subdomain', subdomain);

    // Custom Domain
    // DB Query = prisma.
    const id = await prisma.project.findMany( { where: { subDomain: subdomain }  }  );

    // Futurte implementation for analytics
    // kafka event page visit

    // const id1 = 'aa5b21bf-53b0-4528-a794-01dbeb99cf52';
    // const resolvesTo = `${BASE_URL}${subdomain}`;

    const resolvesTo = `${BASE_URL}${id[0].id}`;
    return proxy.web(req, res, { target: resolvesTo, changeOrigin: true })
})

proxy.on('proxyReq', (proxyReq, req, res) => {
    const url = req.url;
    if (url === '/') proxyReq.path += 'index.html'

})

app.listen(port, () => {
    console.log(`⚡️[server-reverse-proxy]: Server is running at http://localhost:${port}`);
});

export default app;