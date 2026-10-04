import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
export default function Loading() { return <main className="content" aria-label="Loading workspace"><Stack spacing={2}><Skeleton width={180} height={28}/><Skeleton width="45%" height={54}/><Skeleton variant="rounded" height={170} sx={{ borderRadius: 2 }}/><Stack direction={{ xs: "column", sm: "row" }} spacing={2}>{[1, 2, 3].map(i => <Skeleton key={i} variant="rounded" width="100%" height={130} sx={{ borderRadius: 2 }}/>)}</Stack></Stack></main>; }
