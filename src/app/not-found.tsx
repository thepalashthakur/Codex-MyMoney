import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
export default function NotFound() { return <main className="auth-page"><Paper variant="outlined" sx={{ p: { xs: 3, sm: 5 }, maxWidth: 480, textAlign: "center" }}><Stack spacing={2} sx={{ alignItems: "center" }}><Typography variant="h1">Page not found</Typography><Typography color="text.secondary">This page is unavailable.</Typography><Button component="a" href="/" variant="contained">Go to workspace</Button></Stack></Paper></main>; }
