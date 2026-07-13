// src/hooks/useDashboard.ts
import { useState, useEffect } from "react";
import type { DashboardStats, QueueItem, RecentItem } from "../types";

export interface DashboardData {
    stats: DashboardStats;
    recentUrls: RecentItem[];
    queue: QueueItem[];
}

export function useDashboard(initialData: DashboardData) {
    const [data, setData] = useState<DashboardData>(initialData);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const [statsRes, queueRes, recentRes] = await Promise.all([
                    fetch("/api/dashboard/stats", { cache: "no-store" }),
                    fetch("/api/dashboard/queue", { cache: "no-store" }),
                    fetch("/api/dashboard/recent", { cache: "no-store" }),
                ]);

                if (statsRes.ok && queueRes.ok && recentRes.ok) {
                    const stats = await statsRes.json();
                    const queue = await queueRes.json();
                    const recentUrls = await recentRes.json();

                    setData({
                        stats,
                        queue,
                        recentUrls,
                    });
                }
            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            }
        };

        const intervalId = setInterval(fetchDashboardData, 2000); // Poll every 2 seconds

        return () => clearInterval(intervalId);
    }, []);

    return data;
}
