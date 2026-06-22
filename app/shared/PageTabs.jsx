'use client'
import Tabs from '@mui/material/Tabs'
import LinkTab from '@mui/material/Tab'
import {usePathname} from "next/navigation";

let valueMap = ["/simulation","/dashboard","/management"]

function useRouteMatch(patterns) {
    const basePath = usePathname()

    for (let i = 0; i < patterns.length; i += 1) {
        const pattern = patterns[i];
        const possibleMatch = basePath?.includes(pattern) ? i : null;
        if (possibleMatch !== null) {
            return possibleMatch;
        }
    }

    return null;
}

export default function PageTabs(){
    const routeMatch = useRouteMatch(valueMap);
    const currentTab = routeMatch ?? 0;
    return (routeMatch !== null) && (
        <Tabs
            value={currentTab}
            aria-label="Pestañas de navegación"
            role="navigation"
            sx={{
                '& .MuiTab-root': {
                    color: '#000000',
                },
                '& .MuiTab-root.Mui-selected': {
                    color: '#000000',
                },
                '& .MuiTabs-indicator': {
                    backgroundColor: '#000000',
                },
            }}
        >
            <LinkTab  label="SIMULACIÓN" href="/simulation" />
            <LinkTab label="DASHBOARD" href="/dashboard" />
            <LinkTab label="GEST. ENTIDADES" href="/management" />
        </Tabs>)
}
