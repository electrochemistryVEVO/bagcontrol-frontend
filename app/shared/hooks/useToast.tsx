'use client';

import { useState, useCallback } from 'react';
import { Snackbar, Alert, AlertColor } from '@mui/material';

export function useToast() {
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [severity, setSeverity] = useState<AlertColor>('error');

    const hideToast = useCallback(() => {
        setOpen(false);
    }, []);

    const showToast = useCallback((msg: string, type: AlertColor = 'error') => {
        setMessage(msg);
        setSeverity(type);
        setOpen(true);
    }, []);

    const ToastComponent = (
        <Snackbar
            open={open}
            autoHideDuration={4000}
            onClose={hideToast}
            anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            // FORZAMOS EL SNEAKBAR POR ENCIMA DE CUALQUIER MAPA O MODAL
            sx={{ 
                zIndex: 99999, 
                position: 'fixed',
                top: '24px !important',
                right: '24px !important'
            }}
        >
            <Alert 
                onClose={hideToast} 
                severity={severity} 
                variant="filled" 
                sx={{ 
                    width: '100%', 
                    fontWeight: 600,
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)' 
                }}
            >
                {message}
            </Alert>
        </Snackbar>
    );

    return { showToast, ToastComponent };
}