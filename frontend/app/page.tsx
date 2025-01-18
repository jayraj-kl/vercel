"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Github } from 'lucide-react';
import { Fira_Code } from 'next/font/google';
import axios from "axios";

const firaCode = Fira_Code({ subsets: ["latin"] });

export default function Home() {
  const [repoURL, setURL] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [ , setProjectId] = useState<string | undefined>();
  const [ , setDeploymentId] = useState<string | undefined>();
  const [deployPreviewURL, setDeployPreviewURL] = useState<string | undefined>();
  const pollingRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const logContainerRef = useRef<HTMLElement>(null);

  const isValidURL: [boolean, string | null] = useMemo(() => {
    if (!repoURL || repoURL.trim() === "") return [false, null];
    const regex = new RegExp(
      /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/]+)\/([^\/]+)(?:\/)?$/
    );
    return [regex.test(repoURL), "Enter valid Github Repository URL"];
  }, [repoURL]);

  interface LogEntry {
    event_id: string;
    deployment_id: string;
    log: string;
    timestamp: string;
  }
  
  interface DeploymentLogs {
    logs: LogEntry[];
  }
  

  const pollDeploymentLogs = useCallback(async (deployId: string) => {
    try {
      const { data } = await axios.get(`https://backend1.jayrajkl.com/logs/${deployId}`);
      if (data && data.logs) {
        const newLogs: string[] = (data as DeploymentLogs).logs.map((log: LogEntry): string => log.log);
        setLogs(newLogs);
        
        // Check if deployment is complete
        const isComplete = newLogs.some((log: string) => log === "Service uploaded");
        if (isComplete && pollingRef.current) {
          clearInterval(pollingRef.current);
          setLoading(false);
        }
      }
    } catch (error) {
      console.error("Error polling logs:", error);
    }
  }, []);

  const handleClickDeploy = useCallback(async () => {
    try {
      setLoading(true);
      setLogs([]);

      // Create project
      const { data: projectData } = await axios.post(`https://backend1.jayrajkl.com/project`, {
        gitURL: repoURL,
        name: "",
      });

      if (projectData?.data?.project) {
        const { id, subDomain } = projectData.data.project;
        setProjectId(id);
        setDeployPreviewURL(`http://${subDomain}.backend2.jayrajkl.com/`);

        // Start deployment
        const { data: deployData } = await axios.post(`https://backend1.jayrajkl.com/deploy`, {
          projectId: id,
        });

        if (deployData?.data?.deploymentId) {
          setDeploymentId(deployData.data.deploymentId);
          
          // Start polling logs
          pollingRef.current = setInterval(() => {
            pollDeploymentLogs(deployData.data.deploymentId);
          }, 2000);
        }
      }
    } catch (error) {
      console.error("Error deploying:", error);
      setLoading(false);
    }
  }, [repoURL, pollDeploymentLogs]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  // Auto scroll logs
  useEffect(() => {
    if (logs.length > 0) {
      logContainerRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  return (
    <main className="flex justify-center items-center min-h-[100vh] p-4">
      <div className="w-full max-w-[600px]">
        <span className="flex justify-start items-center gap-2">
          <Github className="text-5xl" />
          <Input
            disabled={loading}
            value={repoURL}
            onChange={(e) => setURL(e.target.value)}
            type="url"
            placeholder="Github URL"
          />
        </span>
        <Button
          onClick={handleClickDeploy}
          disabled={!isValidURL[0] || loading}
          className="w-full mt-3"
        >
          {loading ? "Deploying..." : "Deploy"}
        </Button>
        {deployPreviewURL && (
          <div className="mt-2 bg-slate-900 py-4 px-2 rounded-lg">
            <p>
              Preview URL{" "}
              <a
                target="_blank"
                className="text-sky-400 bg-sky-950 px-3 py-2 rounded-lg"
                href={deployPreviewURL}
              >
                {deployPreviewURL}
              </a>
            </p>
          </div>
        )}
        {logs.length > 0 && (
          <div
            className={`${firaCode.className} text-sm text-green-500 logs-container mt-5 border-green-500 border-2 rounded-lg p-4 h-[300px] overflow-y-auto`}
          >
            <pre className="flex flex-col gap-1">
              {logs.map((log, i) => (
                <code
                  ref={logs.length - 1 === i ? logContainerRef : undefined}
                  key={i}
                >{`> ${log}`}</code>
              ))}
            </pre>
          </div>
        )}
      </div>
    </main>
  );
}

