# Frontend audit and redesign

- Stack: Next.js 16 App Router, React 19, TypeScript, MUI 9 with Emotion and the v16 App Router cache provider. Icons use Lucide.
- User-facing route: `/` contains sign-in/sign-up and the authenticated Overview, Transactions, Categories, Sources, and Settings views. Root loading, error, and not-found states are included.
- Shell: shared navigation component with a desktop sidebar and temporary MUI mobile Drawer. Dashboard views keep their existing tab state.
- Forms and dialogs: authentication, transaction/category/source editor, detail and attachment upload, deletion confirmation. The finance dashboard was split into navigation, editor, authentication, type, utility, and display modules.
- Data and behavior preserved: session refresh, data fetching and search/filter state, totals, transaction/category/source CRUD, S3 signed upload/download, and sign-out.
- Design: centralized light/dark MUI theme and CSS tokens. System color preference is observed; content columns and transaction details adapt for narrow screens.
