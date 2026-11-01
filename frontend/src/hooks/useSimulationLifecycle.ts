"use client";

import { useEffect, useState, useCallback } from "react";
import type { SimulationRecord } from "@/types/dashboard";
import { listSimulations, createSimulation, getSimulation } from "@/lib/api";

const ACTIVE_STATES = new Set([
  "CREATED",
  "INITIALIZING",
  "RUNNING",
  "ANALYSING",
  "AWAITING_APPROVAL",
  "PAUSED",
]);

const SESSION_KEY = "cyberhunt_simulation_id";

interface UseSimulationLifecycleResult {
  simulationId: string | null;
  simulation: SimulationRecord | null;
  isLoading: boolean;
  createNew: () => Promise<SimulationRecord | null>;
}

export function useSimulationLifecycle(): UseSimulationLifecycleResult {
  const [simulationId, setSimulationId] = useState<string | null>(null);
  const [simulation, setSimulation] = useState<SimulationRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: try to reuse an existing active simulation — never auto-create.
  useEffect(() => {
    let cancelled = false;

    async function loadExisting() {
      setIsLoading(true);
      try {
        // 1. Check sessionStorage for a known simulation ID
        const stored = sessionStorage.getItem(SESSION_KEY);
        if (stored) {
          try {
            const sim = await getSimulation(stored);
            if (!cancelled && ACTIVE_STATES.has(sim.state)) {
              setSimulationId(sim.id);
              setSimulation(sim);
              return;
            }
          } catch {
            // Stored ID is gone — fall through
          }
        }

        // 2. Fetch recent simulations and pick the most recent active one
        const sims = await listSimulations(20);
        const active = sims.find((s) => ACTIVE_STATES.has(s.state));
        if (!cancelled && active) {
          sessionStorage.setItem(SESSION_KEY, active.id);
          setSimulationId(active.id);
          setSimulation(active);
          return;
        }
      } catch {
        // Network error — leave simulationId null
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadExisting();
    return () => { cancelled = true; };
  }, []);

  const createNew = useCallback(async (): Promise<SimulationRecord | null> => {
    try {
      const sim = await createSimulation({
        scenario_category: "phishing",
        task_summary: "Email phishing & payment fraud simulation",
        step_limit: 20,
      });
      sessionStorage.setItem(SESSION_KEY, sim.id);
      setSimulationId(sim.id);
      setSimulation(sim);
      return sim;
    } catch {
      return null;
    }
  }, []);

  return { simulationId, simulation, isLoading, createNew };
}

