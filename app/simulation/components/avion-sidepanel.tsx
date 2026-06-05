import {Box, Button, Drawer} from "@mui/material";
import {useEffect, useState} from "react";
import styles from "../../stylesheets/sidepanel.module.css";

function SidePanelContents(){
    return (<Box sx={{width: 250}} role="presentation">
        <div className={styles.header}>
            <h1>Aeropuerto DAV-ILA</h1>
            <button className={styles.header}>×</button>
        </div>

        <div className={styles.card}>

            <div className={styles['section-title']}>
                Información de aeropuertos
            </div>

            <ul className={styles['info-list']}>
                <li>Código: DAV-ILA</li>
                <li>Locación: Lima - Perú</li>
                <li>Hora local: 31/03/2026 - 19:14</li>
                <li>Estado: ACTIVO</li>
            </ul>

            <div className={styles.capacity}>
                <span>Carga actual:</span>
                <span>130/400</span>
            </div>

            <div className={styles.progress}>
                <div className={styles['progress-fill']}>30%</div>
            </div>

            <div className={styles['packages-header']}>
                <span>Paquetes:</span>
                <a href="#" className={styles['view-all']}>ver todos</a>
            </div>

            <div className={styles.subtitle}>
                Mostrando 5 resultados próximos
            </div>

            <div className={styles["package-list"]}>

                <div className={styles["package-item"]}>
                    <span className={styles["package-code"]}>ABC-XDD</span>
                    <span className={styles["package-time red"]}>hasta 13:00</span>

                    <svg className={styles.external} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         strokeWidth="2">
                        <path d="M14 3h7v7"/>
                        <path d="M10 14L21 3"/>
                        <rect x="3" y="7" width="14" height="14" rx="2"/>
                    </svg>
                </div>

                <div className={styles["package-item"]}>
                    <span className={styles["package-code"]}>ABC-XDD</span>
                    <span className={styles["package-time red"]}>hasta 13:00</span>

                    <svg className={styles.external} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         strokeWidth="2">
                        <path d="M14 3h7v7"/>
                        <path d="M10 14L21 3"/>
                        <rect x="3" y="7" width="14" height="14" rx="2"/>
                    </svg>
                </div>

                <div className={styles["package-item"]}>
                    <span className={styles["package-code"]}>ABC-XDD</span>
                    <span className={styles["package-time red"]}>hasta 13:00</span>

                    <svg className={styles.external} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         strokeWidth="2">
                        <path d="M14 3h7v7"/>
                        <path d="M10 14L21 3"/>
                        <rect x="3" y="7" width="14" height="14" rx="2"/>
                    </svg>
                </div>

                <div className={styles["package-item"]}>
                    <span className={styles["package-code"]}>ABC-XDD</span>
                    <span className={styles["package-time red"]}>hasta 13:00</span>

                    <svg className={styles.external} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         strokeWidth="2">
                        <path d="M14 3h7v7"/>
                        <path d="M10 14L21 3"/>
                        <rect x="3" y="7" width="14" height="14" rx="2"/>
                    </svg>
                </div>

                <div className={styles["package-item"]}>
                    <span className={styles["package-code"]}>ABC-XDD</span>
                    <span className={styles["package-time red"]}>hasta 13:00</span>

                    <svg className={styles.external} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         strokeWidth="2">
                        <path d="M14 3h7v7"/>
                        <path d="M10 14L21 3"/>
                        <rect x="3" y="7" width="14" height="14" rx="2"/>
                    </svg>
                </div>

            </div>

        </div>
    </Box>)
}

export type OpenSimulationPanel = {
    open : boolean
    onClick: () => void,
    onClose: () => void
}

export function useOpenPanel(): OpenSimulationPanel{
    const [isOpen, setIsOpen] = useState(false);
    return {open:isOpen,onClick:()=>{setIsOpen(true);},onClose:()=>{setIsOpen(false)}};
}

export default function AvionSidePanel(openPanel:OpenSimulationPanel) {
    const {open,onClick,onClose} = openPanel;
    return (
        <div>
            <Drawer open={open} onClose={onClose}>
                <SidePanelContents/>
            </Drawer>
        </div>
    );
}