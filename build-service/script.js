const fs = require('fs')
const path = require('path')
const mime = require('mime-types')
const { exec } = require('child_process')
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
const { Kafka } = require('kafkajs')

dotenv = require('dotenv');

dotenv.config();

console.log('Building service...');

const PROJECT_ID = process.env.PROJECT_ID;
const DEPLOYEMENT_ID = process.env.DEPLOYEMENT_ID

const kafka = new Kafka({
    clientId: `docker-build-server-${DEPLOYEMENT_ID}`,
    brokers: [process.env.BROKER1],
    connectionTimeout: 30000, // Default is 1000 ms; increase to 30 seconds
    authenticationTimeout: 30000, 
    ssl: { ca: [fs.readFileSync(path.join(__dirname, 'kafka.pem'), 'utf-8')] },
    sasl: { mechanism: 'plain', username: process.env.SASL_USERNAME, password: process.env.SASL_PASSWORD }
});

const producer = kafka.producer()
async function publishLog(log) { await producer.send({ topic: `container-logs`, messages: [{ key: 'log', value: JSON.stringify({ PROJECT_ID, DEPLOYEMENT_ID, log }) }] })}

const s3Client = new S3Client({
    region: process.env.REGION,
    credentials: {
        accessKeyId: process.env.CREDENTIALS_ACCESS_KEY_ID,
        secretAccessKey: process.env.CREDENTIALS_SECRET_ACCESS_KEY
    } 
});


async function main()  {
    await producer.connect()
    await publishLog('Build Started...')
    const outDir = path.join(__dirname, 'output');
    const buildProcess = exec(`cd ${outDir} && npm install && npm run build`);

    buildProcess.stdout.on('data', (data) => console.log(data) ||  publishLog(data.toString()));
    buildProcess.stderr.on('data', (data) => console.error(data) || publishLog(data.toString()));

    buildProcess.on('close', async function () {
        await publishLog(`Build Complete`)
        const distDir = path.join(__dirname, 'output', 'dist');
        const distDirContent = fs.readdirSync(path.resolve(distDir), { recursive: true });

        await publishLog(`Uploading service to S3...`)
        for(const file of distDirContent) {
            const filePath = path.join(distDir, file);

            if (fs.lstatSync(filePath).isDirectory()) continue;

            await publishLog(`Uploading ${file}...`)
            const command = new PutObjectCommand({
                Bucket: process.env.BUCKET_NAME,
                Key: `__outputs/${PROJECT_ID}/${file}`,
                Body: fs.createReadStream(filePath),
                ContentType: mime.lookup(filePath) 
            });
            await s3Client.send(command)
            await publishLog(`Uploaded ${file}`)
        }
        await publishLog('Service uploaded');
        console.log('Service uploaded');
        process.exit(0);
    });
}
main();