const fs = require('fs')
const path = require('path')
const mime = require('mime-types')
const { exec } = require('child_process')
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')

console.log('Building service...');

const PROJECT_ID = process.env.PROJECT_ID;
if (!PROJECT_ID) { console.error('PROJECT_ID is not set. Exiting.'); process.exit(1) }

const s3Client = new S3Client({
    region: 'ap-south-1',
    credentials: {
        accessKeyId: 'AKIA6GBMHBQOQCV7VFMX',
        secretAccessKey:'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'
    } 
});


async function main()  {
    const outDir = path.join(__dirname, 'output');
    const buildProcess = exec(`cd ${outDir} && npm install && npm run build`);

    buildProcess.stdout.on('data', (data) => console.log(data));
    buildProcess.stderr.on('data', (data) => console.error(data));

    buildProcess.on('close', async function () {
        const distDir = path.join(__dirname, 'output', 'dist');
        const distDirContent = fs.readdirSync(path.resolve(distDir), { recursive: true });

        for(const file of distDirContent) {
            const filePath = path.join(distDir, file);

            if (fs.lstatSync(filePath).isDirectory()) continue;

            const command = new PutObjectCommand({
                Bucket: 'vercel-clone-outputs-v7',
                Key: `__outputs/${PROJECT_ID}/${file}`,
                Body: fs.createReadStream(filePath),
                ContentType: mime.lookup(filePath) 
            });
            await s3Client.send(command)
        }
        console.log('Service uploaded');
    });
}
main();