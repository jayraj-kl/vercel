import express from 'express';
import cors from 'cors';
import httpProxy from 'http-proxy';

const app = express();
const proxy = httpProxy.createProxyServer();
const port = process.env.PORT || 3000;
const BASE_URL = 'https://vercel-clone-outputs-v7.s3.ap-south-1.amazonaws.com/__outputs/'

app.use(cors())
app.use(express.json());
app.use((req, res) => {
    const hostname = req.hostname;
    const subdomain = hostname.split('.')[0];

    //Custom Domain

    const resolvesTo = `${BASE_URL}${subdomain}`;
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