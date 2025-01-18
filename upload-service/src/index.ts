import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { v4 as uuidv4 } from "uuid";
import cors from "cors";
import dotenv from 'dotenv';
import express from 'express';
import { Kafka, logLevel } from "kafkajs";
// import { Server } from "socket.io";
import { createClient } from "@clickhouse/client";
import { PrismaClient } from "@prisma/client";
import { generateSlug } from 'random-word-slugs';
import { ECSClient, RunTaskCommand } from '@aws-sdk/client-ecs';

// import { IoManager } from './IoManager';

dotenv.config();

const port = process.env.PORT || 3000;
// const portSocket = parseInt(process.env.PORT_SOCKET || '3001');
const app= express();
// const io = new Server({ cors: { origin: '*' } })
const ecsClient = new ECSClient({ region: process.env.REGION, credentials: { accessKeyId: process.env.CREDENTIALS_ACCESS_KEY_ID || '',  secretAccessKey: process.env.CREDENTIALS_SECRET_ACCESS_KEY || ''  } } );
const client = createClient({ host: process.env.CLICKHOUSE_HOST, database: process.env.CLICKHOUSE_DATABASE, username: process.env.CLICKHOUSE_USER, password: process.env.CLICKHOUSE_PASSWORD });
const prisma = new PrismaClient();
const kafka = new Kafka({
    clientId: `api-server`,
    brokers: [process.env.BROKER1 || ''],
    connectionTimeout: 30000,
    authenticationTimeout: 30000, 
    ssl: { ca: [fs.readFileSync(path.join(__dirname, 'kafka.pem'), 'utf-8')] },
    sasl: { mechanism: 'plain', username: process.env.SASL_USERNAME || '', password: process.env.SASL_PASSWORD || '' }
});
const consumer = kafka.consumer({ groupId: 'api-server-logs-consumer' })


const config = { CLUSTER: process.env.CONFIG_CLUSTER, TASK: process.env.CONFIG_TASK }

app.use(cors())
app.use(express.json());

// io.on('connection', (socket: any) => {
//     socket.on('subscribe', (channel: string) => {
//         socket.join(channel);
//         socket.emit('message', `Joined ${channel}`);
//     });
// });

app.post('/project', async (req, res) => {
    const schema = z.object({ name: z.string(), gitURL: z.string() })
    const safeParseResult = schema.safeParse(req.body)

    if (safeParseResult.error) return res.status(400).json({ error: safeParseResult.error })

    const { name, gitURL } = safeParseResult.data
    const project = await prisma.project.create({ data: { name, gitURL, subDomain: generateSlug() } })

    return res.json({ status: 'success', data: { project } })
});

app.post('/deploy', async (req, res) => {
    const { projectId } = req.body
    console.log({ projectId })
    const project = await prisma.project.findUnique({ where: { id: projectId } })
    console.log(project)
    if (!project) return res.status(404).json({ error: 'Project not found' })

    // Check if there is no running deployment
    const deployment = await prisma.deployement.create({ data: { project: { connect: { id: projectId } }, status: 'QUEUED' } })

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
                    environment: [ { name: 'GIT_REPOSITORY__URL', value: project.gitURL }, { name: 'PROJECT_ID', value: projectId }, { name: 'DEPLOYEMENT_ID', value: deployment.id } ]
                }]
        }
    })
    await ecsClient.send(command);
    return res.json({ status: 'queued', data: { deploymentId: deployment.id } })

});

app.get('/logs/:id', async (req, res) => {
    const id = req.params.id;
    const logs = await client.query({
        query: `SELECT event_id, deployment_id, log, timestamp from log_events where deployment_id = {deployment_id:String}`,
        query_params: { deployment_id: id },
        format: 'JSONEachRow'
    })

    const rawLogs = await logs.json()
    return res.json({ logs: rawLogs })
});

async function initkafkaConsumer() {
    await consumer.connect();
    await consumer.subscribe({ topics: ['container-logs'], fromBeginning: true })

    await consumer.run({
        eachBatch: async function ({ batch, heartbeat, commitOffsetsIfNecessary, resolveOffset }) {
            const messages = batch.messages;
            for (const message of messages) {
                if (!message.value) continue;
                const stringMessage = message.value.toString()
                const { DEPLOYEMENT_ID, log } = JSON.parse(stringMessage)
                console.log({ log, DEPLOYEMENT_ID })
                try {
                    const { query_id } = await client.insert({
                        table: 'log_events',
                        values: [{ event_id: uuidv4(),  deployment_id: DEPLOYEMENT_ID, log }],
                        format: 'JSONEachRow'
                    })
                    console.log(query_id)
                    resolveOffset(message.offset)
                    // @ts-ignore
                    await commitOffsetsIfNecessary(message.offset)
                    await heartbeat()
                } catch (err) {
                    console.log(err)
                }
            }
        }
    })
}

initkafkaConsumer()


app.listen(port, () => {
    console.log(`⚡️[server-upload-service]: Server is running at http://localhost:${port}`);
});

// io.listen(portSocket);
// console.log(`⚡️[server-upload-service]: Server is running at http://localhost:${portSocket}`);