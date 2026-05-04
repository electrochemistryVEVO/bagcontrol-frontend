'use client'
import Tabs from '@mui/material/Tabs'
import LinkTab from '@mui/material/Tab'
import {usePathname, useRouter} from "next/navigation";

let valueMap = ["/simulation","/dashboard","/management"]

function useRouteMatch(patterns) {
    const basePath = usePathname()

    for (let i = 0; i < patterns.length; i += 1) {
        const pattern = patterns[i];
        console.log(`Patron: ${pattern}`)
        console.log(`basePath: ${basePath}`)
        const possibleMatch = pattern.includes(basePath) ? i : null;
        if (possibleMatch !== null) {
            return possibleMatch;
        }
    }

    return null;
}

export default function PageTabs(){
    const routeMatch = useRouteMatch(valueMap);
    const currentTab = routeMatch ?? 0;
    return (
        <Tabs
            value={currentTab}
            aria-label="nav tabs example"
            role="navigation"
        >
            <LinkTab label="SIMULACIÓN" href="/simulation" />
            <LinkTab label="DASHBOARD" href="/dashboard" />
            <LinkTab label="GEST. ENTIDADES" href="/management" />
        </Tabs>)
}