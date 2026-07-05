'use client'
import Tabs from '@mui/material/Tabs'
import LinkTab from '@mui/material/Tab'
import {usePathname} from "next/navigation";
import { useEffect, useState } from 'react'
import { AuthService, AuthUser } from '@/app/services/auth.service'

let allTabs = [
    { label: 'REG. MALETAS', href: '/registro', roles: ['REGISTRADOR', 'ADMINISTRADOR'] },
    { label: 'VISUALIZADOR', href: '/operaciones', roles: ['LOGISTICA', 'ADMINISTRADOR'] },
    { label: 'SIMULACION', href: '/simulation', roles: ['ADMINISTRADOR'] },
]

function useRouteMatch(patterns: string[], pathname: string | null): number | null {
    for (let i = 0; i < patterns.length; i += 1) {
        if (pathname?.startsWith(patterns[i])) {
            return i
        }
    }
    return null
}

export default function PageTabs(){
    const pathname = usePathname()
    const [user, setUser] = useState<AuthUser | null>(null)

    useEffect(() => {
        setUser(AuthService.getUser())
    }, [])

    if (!user) return null

    const tabs = allTabs.filter(t => t.roles.includes(user.rol))
    if (tabs.length === 0) return null

    const tabRoutes = tabs.map(t => t.href)
    const routeMatch = useRouteMatch(tabRoutes, pathname)
    const currentTab = routeMatch !== null ? routeMatch : 0

    return (
        <Tabs
            value={currentTab}
            aria-label="Pestañas de navegación"
            role="navigation"
            sx={{
                '& .MuiTab-root': { color: '#000000' },
                '& .MuiTab-root.Mui-selected': { color: '#000000' },
                '& .MuiTabs-indicator': { backgroundColor: '#000000' },
            }}
        >
            {tabs.map(tab => (
                <LinkTab key={tab.href} label={tab.label} href={tab.href} />
            ))}
        </Tabs>
    )
}
