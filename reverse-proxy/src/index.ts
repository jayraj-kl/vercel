import express from 'express';
import cors from 'cors';
import httpProxy from 'http-proxy';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const proxy = httpProxy.createProxyServer();
const port = process.env.PORT;
const BASE_URL = process.env.BASE_URL;

app.use(cors())
app.use(express.json());
app.use((req, res) => {
    const hostname = req.hostname;
    const subdomain = hostname.split('.')[0];

    // Custom Domain
    // DB Query = prisma.

    // kafka event page visit

    const id = 'aa5b21bf-53b0-4528-a794-01dbeb99cf52';
    // const resolvesTo = `${BASE_URL}${subdomain}`;
    const resolvesTo = `${BASE_URL}${id}`;
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