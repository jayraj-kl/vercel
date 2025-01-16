const fs = require('fs')
const path = require('path')
const mime = require('mime-types')
const { exec } = require('child_process')
const Redis  = require('ioredis')
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')

dotenv = require('dotenv');

dotenv.config();

console.log('Building service...');

const PROJECT_ID = process.env.PROJECT_ID;
console.log('PROJECT_ID:', PROJECT_ID);
const publisher = new Redis(process.env.REDIS_URL);
function publishLog(log) { publisher.publish(`logs:${PROJECT_ID}`, JSON.stringify({ log })) }


const s3Client = new S3Client({
    region: process.env.REGION,
    credentials: {
        accessKeyId: process.env.CREDENTIALS_ACCESS_KEY_ID,
        secretAccessKey: process.env.CREDENTIALS_SECRET_ACCESS_KEY
    } 
});


async function main()  {
    publishLog('Build Started...')
    const outDir = path.join(__dirname, 'output');
    const buildProcess = exec(`cd ${outDir} && npm install && npm run build`);

    buildProcess.stdout.on('data', (data) => console.log(data) ||  publishLog(data.toString()));
    buildProcess.stderr.on('data', (data) => console.error(data) || publishLog(data.toString()));

    buildProcess.on('close', async function () {
        publishLog(`Build Complete`)
        const distDir = path.join(__dirname, 'output', 'dist');
        const distDirContent = fs.readdirSync(path.resolve(distDir), { recursive: true });

        publishLog(`Uploading service to S3...`)
        for(const file of distDirContent) {
            const filePath = path.join(distDir, file);

            if (fs.lstatSync(filePath).isDirectory()) continue;

            publishLog(`Uploading ${file}...`)
            const command = new PutObjectCommand({
                Bucket: process.env.BUCKET_NAME,
                Key: `__outputs/${PROJECT_ID}/${file}`,
                Body: fs.createReadStream(filePath),
                ContentType: mime.lookup(filePath) 
            });
            await s3Client.send(command)
            publishLog(`Uploaded ${file}`)
        }
        publishLog('Service uploaded');
        console.log('Service uploaded');
    });
}
main();