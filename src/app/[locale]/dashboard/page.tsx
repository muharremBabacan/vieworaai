'use client';
export const dynamic = 'force-dynamic';
import { useEffect } from 'react';
import AnalizMerkezi from '@/modules/dashboard/components/AnalizMerkezi';

export default function Page() {
    useEffect(() => {
        const renderStart = performance.now();
        console.log("🚀 DASHBOARD_RENDER initialized.");
        return () => {
            const duration = performance.now() - renderStart;
            console.log(`⏱️ DASHBOARD_RENDER: ${duration.toFixed(2)}ms`);
        };
    }, []);

    return <AnalizMerkezi />;
}
