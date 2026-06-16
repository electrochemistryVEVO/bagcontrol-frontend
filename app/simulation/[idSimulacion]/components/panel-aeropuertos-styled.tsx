import {Box, Stack, styled} from "@mui/material";

export const AeropuertosScrollList = styled(Stack)({
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    pr: 0.5,
    scrollbarWidth: 'thin',
    scrollbarColor: '#64748b rgba(15, 23, 42, 0.45)',
    '&::-webkit-scrollbar': {
        width: 10,
    },
    '&::-webkit-scrollbar-track': {
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        borderRadius: 8,
    },
    '&::-webkit-scrollbar-thumb': {
        backgroundColor: '#64748b',
        borderRadius: 8,
        border: '2px solid rgba(15, 23, 42, 0.45)',
    },
})

export const AeropuertoEnvioBox = styled(Box)({
    border: '1px solid rgba(148, 163, 184, 0.2)',
    borderRadius: 1,
    overflow: 'hidden',
    bgcolor: 'rgba(30, 41, 59, 0.82)',
    flexShrink: 0,
})