import cors from "cors";
import Redis from 'ioredis';
import dotenv from 'dotenv';
import express from 'express';
import { Server } from "socket.io";
import { generateSlug } from 'random-word-slugs';
import { ECSClient, RunTaskCommand } from '@aws-sdk/client-ecs';
import { PrismaClient } from "@prisma/client";
import { z } from 'zod';
// import { IoManager } from './IoManager';

dotenv.config();

const port = process.env.PORT || 3000;

const app= express();
const io = new Server({ cors: { origin: '*' } })
const subscriber = new Redis(process.env.REDIS_URL || '');
const ecsClient = new ECSClient({ region: process.env.REGION, credentials: { accessKeyId: process.env.CREDENTIALS_ACCESS_KEY_ID || '',  secretAccessKey: process.env.CREDENTIALS_SECRET_ACCESS_KEY || ''  }  });
const prisma = new PrismaClient();

const config = { CLUSTER: process.env.CONFIG_CLUSTER, TASK: process.env.CONFIG_TASK }

app.use(cors())
app.use(express.json());

io.on('connection', (socket: any) => {
    socket.on('subscribe', (channel: string) => {
        socket.join(channel);
        socket.emit('message', `Joined ${channel}`);
    });
});

app.post('project', async (req, res) => {
    const schema = z.object({ name: z.string(), gitURL: z.string() })
    const safeParseResult = schema.safeParse(req.body)

    if (safeParseResult.error) return res.status(400).json({ error: safeParseResult.error })

    const { name, gitURL } = safeParseResult.data
    const project = await prisma.project.create({ data: { name, gitURL, subDomain: generateSlug() } })

    return res.json({ status: 'success', data: { project } })
});

app.post('/deploy', async (req, res) => {
    const { githubURL, slug } = req.body;
    const projectSlug = slug ? slug : generateSlug()

    const command = new RunTaskCommand({
        cluster: config.CLUSTER,
        taskDefinition: config.TASK,
        launchType: 'FARGATE',
        count: 1,
        networkConfiguration: {
            awsvpcConfiguration: {
                assignPublicIp: 'ENABLED',
                subnets: [ process.env.AWSCONFIG_SUBNETS1 || '', process.env.AWSCONFIG_SUBNETS2 || '', process.env.AWSCONFIG_SUBNETS3 || '' ],
                securityGroups: [ process.env.AWSCONFIG_SECURITYGROUPS || '' ],
            }
        },
        overrides: {
            containerOverrides: [
                {
                    name: 'builder-image',
                    environment: [ { name: 'GIT_REPOSITORY__URL', value: githubURL }, { name: 'PROJECT_ID', value: projectSlug } ]
                }]
        }
    })
    await ecsClient.send(command);
    return res.json({ status: 'queued', data: { projectSlug, url: `http://${projectSlug}.localhost:8000/` } });

});

async function initRedisSubscribe() {
    console.log('Subscribed to logs....')
    subscriber.psubscribe('logs:*')
    subscriber.on('pmessage', (pattern, channel, message) => {
        io.to(channel).emit('message', message)
    })
}

initRedisSubscribe();

app.listen(port, () => {
    console.log(`⚡️[server-upload-service]: Server is running at http://localhost:${port}`);
});

io.listen(3001);
console.log('Socket Server 9002');